import { promises as fs } from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import { selectCatalogDirectory } from "@shared/catalogDirectory";
import {
  isPublishableReadyOriginal,
  projectPublicMediaManifest,
} from "../shared/publicMedia.mjs";
import {
  emptyCatalog,
  emptyOriginalLectures,
  type CatalogData,
  type ContentSnapshot,
  type OriginalLecturesData,
} from "@shared/catalog";
import {
  getMedicalMetadata,
  hasQualifyingAutomatedMedicalReview,
  isMedicalCourse,
} from "@shared/medical";
import {
  getLivePublicManifests,
  resolveValidatedManifestSources,
} from "./publicContentFeed";
import { storageGetSignedUrl } from "./storage";
import { registerMedicalReadingRoutes } from "./medicalReadings";
import { getPublicAssetUrl } from "./publicAssetOrigin";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "data");

type JsonObject = Record<string, unknown>;
type CachedJson = { mtimeMs: number; size: number; value: unknown | null };
type JsonFile = { value: unknown | null; version: string };

const jsonCache = new Map<string, CachedJson>();
let snapshotCache: { version: string; value: ContentSnapshot } | undefined;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJsonFile(fileName: string): Promise<JsonFile> {
  const filePath = path.join(DATA_DIR, fileName);
  try {
    const stat = await fs.stat(filePath);
    const cached = jsonCache.get(fileName);
    if (
      cached &&
      cached.mtimeMs === stat.mtimeMs &&
      cached.size === stat.size
    ) {
      return { value: cached.value, version: `${stat.mtimeMs}:${stat.size}` };
    }

    const raw = await fs.readFile(filePath, "utf8");
    const value = JSON.parse(raw) as unknown;
    jsonCache.set(fileName, { mtimeMs: stat.mtimeMs, size: stat.size, value });
    return { value, version: `${stat.mtimeMs}:${stat.size}` };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(
        `[Content] Unable to read ${fileName}:`,
        error instanceof Error ? error.message : error
      );
    }
    return { value: null, version: `missing:${fileName}` };
  }
}

async function readMedicalCatalogFile(): Promise<JsonFile> {
  const index = await readJsonFile("medical/catalog-index.json");
  if (!isObject(index.value) || !Array.isArray(index.value.courseParts)) {
    return readJsonFile("medical/catalog.json");
  }
  const names = index.value.courseParts;
  if (
    !names.every(
      name =>
        typeof name === "string" &&
        /^catalog-parts\/part-\d{3}\.json$/.test(name)
    )
  ) {
    console.warn("[Content] Invalid medical catalogue part names.");
    return { value: null, version: `invalid-parts:${index.version}` };
  }
  const parts = await Promise.all(
    names.map(name => readJsonFile(`medical/${name}`))
  );
  if (parts.some(part => !Array.isArray(part.value))) {
    console.warn(
      "[Content] A saved medical catalogue part is missing or invalid."
    );
    return { value: null, version: `missing-parts:${index.version}` };
  }
  const courses = parts.flatMap(part => part.value as unknown[]);
  if (
    typeof index.value.savedCourseCount === "number" &&
    courses.length !== index.value.savedCourseCount
  ) {
    console.warn(
      "[Content] Medical catalogue part count does not match its saved index."
    );
    return { value: null, version: `incomplete-parts:${index.version}` };
  }
  return {
    value: { ...index.value, courses },
    version: [index.version, ...parts.map(part => part.version)].join("|"),
  };
}

/**
 * The two producer-owned manifests are selected independently. An unavailable,
 * missing, or invalid live row falls back only to its matching bundled file.
 */
async function readCurrentMediaManifests(): Promise<{
  base: JsonFile;
  medical: JsonFile;
}> {
  const [base, medical, live] = await Promise.all([
    readJsonFile("original-lectures.json"),
    readJsonFile("medical/original-lectures.json"),
    getLivePublicManifests(),
  ]);
  const selected = resolveValidatedManifestSources({ base, medical }, live);
  return {
    base: { value: selected.base.value, version: selected.base.version },
    medical: {
      value: selected.medical.value,
      version: selected.medical.version,
    },
  };
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mergeById<T extends { id: string }>(base: T[], overlay: T[]): T[] {
  const merged: T[] = [];
  const indexById = new Map<string, number>();
  for (const record of [...base, ...overlay]) {
    if (!record.id) continue;
    const index = indexById.get(record.id);
    if (index === undefined) {
      indexById.set(record.id, merged.length);
      merged.push(record);
    } else {
      const definedOverlay = Object.fromEntries(
        Object.entries(record).filter(([, value]) => value !== undefined)
      ) as Partial<T>;
      merged[index] = { ...merged[index], ...definedOverlay };
    }
  }
  return merged;
}

function uniqueByValue<T>(items: T[]): T[] {
  const values = new Set<string>();
  return items.filter(item => {
    const key = JSON.stringify(item);
    if (values.has(key)) return false;
    values.add(key);
    return true;
  });
}

export function recomputeCatalogStats(catalog: CatalogData) {
  const documents = catalog.documents;
  const uniqueDocuments = new Map<string, (typeof documents)[number]>();
  for (const document of documents) {
    const key = document.storageUrl || document.sourceUrl || document.id;
    if (!uniqueDocuments.has(key)) uniqueDocuments.set(key, document);
  }
  const units = catalog.courses.reduce(
    (total, course) =>
      total +
      (course.unitMap?.length ??
        (Array.isArray(course.units) ? course.units.length : 0)),
    0
  );
  return {
    programs: catalog.programs.length,
    courses: catalog.courses.length,
    units,
    referencePdfCopies: documents.length,
    uniqueReferencePdfs: uniqueDocuments.size,
    uniquePdfPages: [...uniqueDocuments.values()].reduce(
      (total, document) =>
        total + (Number.isFinite(document.pages) ? document.pages! : 0),
      0
    ),
    lectureEntries: catalog.courses.reduce(
      (total, course) => total + (course.lectures?.length ?? 0),
      0
    ),
  };
}

/** Merges the isolated medical overlay by stable IDs without mutating producer-owned files. */
export function mergeCatalogContent(
  baseValue: unknown,
  medicalValue: unknown
): CatalogData {
  const base = normalizeCatalog(baseValue);
  const medical = normalizeCatalog(medicalValue);
  const courses = mergeById(base.courses, medical.courses);
  const courseCounts = new Map<string, number>();
  for (const course of courses) {
    courseCounts.set(
      course.programId,
      (courseCounts.get(course.programId) ?? 0) + 1
    );
  }
  const merged = {
    programs: mergeById(base.programs, medical.programs).map(program => ({
      ...program,
      courseCount: courseCounts.get(program.id) ?? 0,
    })),
    courses,
    documents: mergeById(base.documents, medical.documents),
    downloads: mergeById(base.downloads, medical.downloads),
    productionOrder: uniqueByValue([
      ...(base.productionOrder ?? []),
      ...(medical.productionOrder ?? []),
    ]),
    credentialNotice: medical.credentialNotice || base.credentialNotice,
    medicalSchool: medical.medicalSchool ?? base.medicalSchool,
  } satisfies CatalogData;
  return { ...merged, stats: recomputeCatalogStats(merged) };
}

/** Merges medical media by lesson/source IDs; no client-provided address is trusted. */
export function mergeOriginalLecturesContent(
  baseValue: unknown,
  medicalValue: unknown
): OriginalLecturesData {
  const base = normalizeOriginalLectures(baseValue);
  const medical = normalizeOriginalLectures(medicalValue);
  const sourceCoverage = [...(base.sourceCoverage ?? [])];
  const coverageIndex = new Map<string, number>();
  sourceCoverage.forEach((entry, index) => {
    if (entry.sourceId) coverageIndex.set(entry.sourceId, index);
  });
  for (const entry of medical.sourceCoverage ?? []) {
    const sourceId = entry.sourceId;
    const index = sourceId ? coverageIndex.get(sourceId) : undefined;
    if (index === undefined) {
      if (sourceId) coverageIndex.set(sourceId, sourceCoverage.length);
      sourceCoverage.push(entry);
    } else {
      sourceCoverage[index] = { ...sourceCoverage[index], ...entry };
    }
  }
  return {
    lessons: mergeById(base.lessons, medical.lessons),
    sourceCoverage,
    productionState: {
      baseProgrammes: base.productionState ?? null,
      medicalSchool: medical.productionState ?? null,
    },
    notes: uniqueByValue([...asArray(base.notes), ...asArray(medical.notes)]),
  };
}

/**
 * Coerces only the structural collection fields. Unstructured curriculum fields
 * intentionally remain untouched: the client renderer handles string, list, and
 * object variants supplied by older source packets.
 */
export function normalizeCatalog(value: unknown): CatalogData {
  if (!isObject(value)) return emptyCatalog();
  return {
    programs: asArray(value.programs)
      .filter(isObject)
      .map(program => ({
        ...program,
        id: asString(program.id),
        name: asString(program.name),
      })) as CatalogData["programs"],
    courses: asArray(value.courses)
      .filter(isObject)
      .map(course => ({
        ...course,
        id: asString(course.id),
        programId: asString(course.programId),
        title: asString(course.title),
        lectures: Array.isArray(course.lectures)
          ? course.lectures.filter(isObject).map(lecture => ({
              ...lecture,
              id: asString(lecture.id),
              title: asString(lecture.title),
            }))
          : undefined,
        unitMap: Array.isArray(course.unitMap)
          ? course.unitMap.filter(isObject)
          : undefined,
      })) as CatalogData["courses"],
    documents: asArray(value.documents)
      .filter(isObject)
      .map(document => ({
        ...document,
        id: asString(document.id),
        title: asString(document.title),
      })) as CatalogData["documents"],
    downloads: asArray(value.downloads)
      .filter(isObject)
      .map(download => ({
        ...download,
        id: asString(download.id),
        title: asString(download.title),
      })) as CatalogData["downloads"],
    stats: isObject(value.stats) ? value.stats : {},
    productionOrder: asArray<string>(value.productionOrder).filter(
      item => typeof item === "string"
    ),
    credentialNotice: asString(value.credentialNotice),
    medicalSchool: isObject(value.medicalSchool)
      ? value.medicalSchool
      : undefined,
  };
}

export function normalizeOriginalLectures(
  value: unknown
): OriginalLecturesData {
  if (!isObject(value)) return emptyOriginalLectures();
  return {
    lessons: asArray(value.lessons)
      .filter(isObject)
      .map(lesson => ({
        ...lesson,
        id: asString(lesson.id),
        title: asString(lesson.title),
        programIds: asArray<string>(lesson.programIds).filter(
          item => typeof item === "string"
        ),
        courseIds: asArray<string>(lesson.courseIds).filter(
          item => typeof item === "string"
        ),
      })) as OriginalLecturesData["lessons"],
    sourceCoverage: asArray(value.sourceCoverage),
    productionState:
      value.productionState as OriginalLecturesData["productionState"],
    notes: asArray(value.notes) as OriginalLecturesData["notes"],
  };
}

const DURABLE_VIDEO_EXTENSION = /\.(mp4|webm|ogg|ogv|m4v)$/i;
const NON_INSTRUCTIONAL_MEDICAL_CONTENT =
  /(?:^|[\s_-])(syllabus|orientation|administrative)(?:$|[\s_-])|reference[\s_-]*only/i;

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasMedicalSourceUrls(
  lesson: OriginalLecturesData["lessons"][number]
): boolean {
  return [lesson.sourceUrls, lesson.medicalSourceUrls].some(
    urls =>
      Array.isArray(urls) &&
      urls.some(url => typeof url === "string" && url.trim().length > 0)
  );
}

function isReferenceOnlyMedicalLesson(
  lesson: OriginalLecturesData["lessons"][number]
): boolean {
  return [lesson.sourceKind, lesson.coverageStatus].some(
    value =>
      typeof value === "string" && NON_INSTRUCTIONAL_MEDICAL_CONTENT.test(value)
  );
}

/**
 * A medical original earns measured hours only when the current medical manifest
 * proves it is a rendered instructional video with source-review evidence. This
 * deliberately does not inspect the producer-owned base media manifest.
 */
function qualifyingMedicalOriginalStorageKey(
  lesson: OriginalLecturesData["lessons"][number],
  courseId: string
): string | null {
  if (
    !isPublishableReadyOriginal(lesson) ||
    !lesson.courseIds?.includes(courseId) ||
    lesson.isInstructional !== true ||
    !hasQualifyingAutomatedMedicalReview(lesson) ||
    lesson.humanClinicalReviewStatus !== "not performed" ||
    !hasMedicalSourceUrls(lesson) ||
    isReferenceOnlyMedicalLesson(lesson) ||
    !isFiniteNonNegativeNumber(lesson.durationSeconds) ||
    lesson.durationSeconds <= 0
  ) {
    return null;
  }
  const storageKey = resolveManusStorageKey(lesson.videoUrl);
  return storageKey && DURABLE_VIDEO_EXTENSION.test(storageKey)
    ? storageKey
    : null;
}

function measuredMedicalGeneratedHours(
  courseId: string,
  lessons: OriginalLecturesData["lessons"]
): number {
  const seenLessonIds = new Set<string>();
  const seenStorageKeys = new Set<string>();
  let durationSeconds = 0;
  for (const lesson of lessons) {
    const storageKey = qualifyingMedicalOriginalStorageKey(lesson, courseId);
    if (!storageKey) continue;
    const lessonId = lesson.id.trim();
    // A repeated ID or durable video URL represents the same clip for this course.
    if (
      (lessonId && seenLessonIds.has(lessonId)) ||
      seenStorageKeys.has(storageKey)
    ) {
      continue;
    }
    if (lessonId) seenLessonIds.add(lessonId);
    seenStorageKeys.add(storageKey);
    durationSeconds += lesson.durationSeconds!;
  }
  return durationSeconds / 3_600;
}

function provenExternalMedicalHours(
  course: CatalogData["courses"][number]
): number {
  const metadata = getMedicalMetadata(course);
  if (isFiniteNonNegativeNumber(metadata.verifiedExternalHours)) {
    return metadata.verifiedExternalHours;
  }
  const specialtyHours = isFiniteNonNegativeNumber(
    metadata.verifiedSpecialtyHours
  )
    ? metadata.verifiedSpecialtyHours
    : undefined;
  const foundationHours = isFiniteNonNegativeNumber(
    metadata.verifiedFoundationHours
  )
    ? metadata.verifiedFoundationHours
    : undefined;
  return specialtyHours !== undefined || foundationHours !== undefined
    ? (specialtyHours ?? 0) + (foundationHours ?? 0)
    : 0;
}

/**
 * Overwrites raw generated/combined declarations with evidence measured from the
 * current `data/medical/original-lectures.json` manifest. External hours retain
 * their existing verified semantics; generated hours can never be supplied by a
 * curriculum row, a clip plan, or the base-programme media manifest.
 */
export function normalizeMedicalGeneratedHours(
  catalog: CatalogData,
  medicalMediaValue: unknown
): CatalogData {
  const medicalMedia = normalizeOriginalLectures(medicalMediaValue);
  return {
    ...catalog,
    courses: catalog.courses.map(course => {
      if (!isMedicalCourse(course)) return course;
      const verifiedExternalHours = provenExternalMedicalHours(course);
      const verifiedGeneratedHours = measuredMedicalGeneratedHours(
        course.id,
        medicalMedia.lessons
      );
      const verifiedTotalHours = verifiedExternalHours + verifiedGeneratedHours;
      const targetHours = getMedicalMetadata(course).targetVideoHours;
      const hoursGap = isFiniteNonNegativeNumber(targetHours)
        ? Math.max(0, targetHours - verifiedTotalHours)
        : 0;
      return {
        ...course,
        verifiedGeneratedHours,
        verifiedTotalHours,
        // The derived actual gap supersedes a raw curriculum declaration.
        hoursGap,
        ...(course.directoryMedicalValidation?.lectureEvidenceValid !==
        undefined
          ? {
              directoryMedicalValidation: {
                ...course.directoryMedicalValidation,
                isReady:
                  course.directoryMedicalValidation.issues.length === 0 &&
                  course.directoryMedicalValidation.lectureEvidenceValid &&
                  course.directoryMedicalValidation.unknownDurationCount ===
                    0 &&
                  (course.directoryMedicalValidation
                    .hasExternalLectureEvidence ||
                    verifiedGeneratedHours > 0) &&
                  isFiniteNonNegativeNumber(targetHours) &&
                  verifiedTotalHours >= targetHours,
              },
            }
          : {}),
      };
    }),
  };
}

export async function getCatalogContent(): Promise<CatalogData> {
  const [catalogFile, medicalFile, media] = await Promise.all([
    readJsonFile("catalog.json"),
    readMedicalCatalogFile(),
    readCurrentMediaManifests(),
  ]);
  return normalizeMedicalGeneratedHours(
    mergeCatalogContent(catalogFile.value, medicalFile.value),
    media.medical.value
  );
}

export async function getOriginalLecturesContent(): Promise<OriginalLecturesData> {
  const media = await readCurrentMediaManifests();
  return projectPublicMediaManifest(
    mergeOriginalLecturesContent(media.base.value, media.medical.value)
  );
}

/** Medical counted hours must use the medical producer feed, never the merged base feed. */
export async function getMedicalOriginalLecturesContent(): Promise<OriginalLecturesData> {
  const media = await readCurrentMediaManifests();
  return projectPublicMediaManifest(media.medical.value);
}

/**
 * Uses mtime/size cache entries so the large production manifests are parsed only
 * when their source files change, while still exposing newly ingested files.
 */
export async function getContentSnapshot(): Promise<ContentSnapshot> {
  const [catalogFile, medicalCatalogFile, media, assetIndexFile] =
    await Promise.all([
      readJsonFile("catalog.json"),
      readMedicalCatalogFile(),
      readCurrentMediaManifests(),
      readJsonFile("asset-index.json"),
    ]);
  const version = [
    catalogFile.version,
    medicalCatalogFile.version,
    media.base.version,
    media.medical.version,
    assetIndexFile.version,
  ].join("|");
  if (snapshotCache?.version === version) return snapshotCache.value;

  const value = {
    catalog: normalizeMedicalGeneratedHours(
      mergeCatalogContent(catalogFile.value, medicalCatalogFile.value),
      media.medical.value
    ),
    media: projectPublicMediaManifest(
      mergeOriginalLecturesContent(media.base.value, media.medical.value)
    ),
    assetIndex: assetIndexFile.value,
    updatedAt: new Date().toISOString(),
  };
  snapshotCache = { version, value };
  return value;
}

/** Public snapshots use directory fields; full selected-course detail uses workspace. */
export async function getPublicContentSnapshot(): Promise<ContentSnapshot> {
  const { getCompactDirectoryContent } = await import("./workspaceContent");
  const [catalog, media] = await Promise.all([
    getCompactDirectoryContent(),
    getOriginalLecturesContent(),
  ]);
  return {
    catalog,
    media,
    assetIndex: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Resolves only a manifest's stable storage address to its object key. */
export function resolveManusStorageKey(address: unknown): string | null {
  if (typeof address !== "string" || !address.startsWith("/manus-storage/"))
    return null;
  try {
    const base = "https://manifest-storage.invalid";
    const parsed = new URL(address, base);
    if (
      parsed.origin !== base ||
      !parsed.pathname.startsWith("/manus-storage/") ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    const key = decodeURIComponent(
      parsed.pathname.slice("/manus-storage/".length)
    );
    if (
      !key ||
      !/^[\x21-\x7e]+$/.test(key) ||
      key.split("/").some(segment => segment === "." || segment === "..")
    ) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

/**
 * Transcript URLs are selected by lesson ID from the trusted local manifest,
 * never accepted as arbitrary client URLs. This keeps large transcript bodies
 * out of catalog.json while retaining a single in-studio reading surface.
 */
export function getInlineLessonTranscript(
  lessonId: string,
  media: OriginalLecturesData
) {
  const lesson = media.lessons.find(item => item.id === lessonId);
  if (
    !lesson ||
    typeof lesson.transcript !== "string" ||
    !lesson.transcript.trim()
  ) {
    return null;
  }
  return {
    status: "ready" as const,
    transcript: lesson.transcript,
    title: lesson.title,
  };
}

export async function getLessonTranscript(lessonId: string) {
  const media = await getOriginalLecturesContent();
  const inlineTranscript = getInlineLessonTranscript(lessonId, media);
  if (inlineTranscript) return inlineTranscript;
  const lesson = media.lessons.find(item => item.id === lessonId);
  if (!lesson) return { status: "unavailable" as const, transcript: "" };
  if (!lesson.transcriptUrl)
    return {
      status: "unavailable" as const,
      transcript: "",
      title: lesson.title,
    };
  const storageKey = resolveManusStorageKey(lesson.transcriptUrl);
  if (!storageKey) {
    console.warn(
      "[Content] Transcript URL is not a stable storage path for lesson",
      lessonId
    );
    return {
      status: "unavailable" as const,
      transcript: "",
      title: lesson.title,
    };
  }
  const publicTranscriptUrl = getPublicAssetUrl(lesson.transcriptUrl);
  try {
    const requestOptions = {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "text/markdown, text/plain, text/vtt" },
    };
    let response: globalThis.Response;
    try {
      const signedUrl = await storageGetSignedUrl(storageKey);
      response = await fetch(signedUrl, requestOptions);
      if (!response.ok)
        throw new Error(`Signed transcript request failed (${response.status})`);
    } catch (signedError) {
      if (!publicTranscriptUrl) throw signedError;
      // This read-only fallback comes only from the trusted local manifest
      // storage path plus a fixed operator origin, never a client-supplied URL.
      response = await fetch(publicTranscriptUrl, requestOptions);
      if (!response.ok)
        throw new Error(`Public transcript request failed (${response.status})`);
    }
    const transcript = (await response.text()).slice(0, 2_000_000);
    return transcript.trim()
      ? { status: "ready" as const, transcript, title: lesson.title }
      : { status: "unavailable" as const, transcript: "", title: lesson.title };
  } catch (error) {
    console.warn(
      "[Content] Transcript unavailable for lesson",
      lessonId,
      error instanceof Error ? error.message : error
    );
    return {
      status: "unavailable" as const,
      transcript: "",
      title: lesson.title,
    };
  }
}

function sendSnapshotPart(part: "catalog" | "media" | "assetIndex") {
  return async (_req: Request, res: Response) => {
    const { getCompactDirectoryContent } = await import("./workspaceContent");
    const content =
      part === "catalog"
        ? await getCompactDirectoryContent()
        : part === "media"
          ? await getOriginalLecturesContent()
          : (await readJsonFile("asset-index.json")).value;
    res.set("Cache-Control", "no-store").json(content);
  };
}

export function registerContentRoutes(app: Express) {
  registerMedicalReadingRoutes(app);
  app.get("/api/content/catalog", sendSnapshotPart("catalog"));
  app.get("/api/content/media", sendSnapshotPart("media"));
  app.get("/api/content/asset-index", sendSnapshotPart("assetIndex"));
  app.get("/api/content/snapshot", async (_req, res) => {
    res.set("Cache-Control", "no-store").json(await getPublicContentSnapshot());
  });
}
