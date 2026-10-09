import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  CatalogData,
  ContentSnapshot,
  CourseRecord,
  OriginalLecturesData,
} from "@shared/catalog";
import {
  selectCatalogDirectory,
  selectCourseForProgramQueue,
} from "@shared/catalogDirectory";
import type { WorkspaceScope } from "@shared/courseWorkspace";
import {
  getMedicalOriginalLecturesContent,
  getOriginalLecturesContent,
  mergeCatalogContent,
  normalizeCatalog,
  normalizeMedicalGeneratedHours,
} from "./content";

const DATA_DIR = path.resolve(import.meta.dirname, "..", "data");

type JsonObject = Record<string, unknown>;
type CachedJson = {
  mtimeMs: number;
  size: number;
  value: unknown;
  version: string;
};
type JsonFile = { value: unknown; version: string };

type MedicalWorkspaceIndex = {
  catalog: CatalogData;
  coursePartById: Map<string, string>;
  queueParts: string[];
};

type CompactDirectory = {
  version: string;
  catalog: CatalogData;
  coursePartById: Map<string, string>;
};

export type WorkspaceLoaderDiagnostics = {
  /** Disk JSON parses performed since this loader instance was created/reset. */
  parsedFiles: string[];
  /** Absolute path for the intentionally never-read aggregate medical source. */
  aggregateMedicalCatalogPath: string;
};

export type WorkspaceContentLoaderOptions = {
  /** Test-only override; production uses the repository data directory. */
  dataDir?: string;
  /** Keeps current/live merged manifest selection owned by the content layer. */
  getOriginalLectures?: () => Promise<OriginalLecturesData>;
  /** Medical generated hours must never be measured from the base programme feed. */
  getMedicalOriginalLectures?: () => Promise<OriginalLecturesData>;
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function copyCoursePartMap(value: unknown, parts: Set<string>): Map<string, string> {
  if (!isObject(value)) throw new Error("Medical workspace index has no coursePartById map.");
  const result = new Map<string, string>();
  for (const [courseId, partName] of Object.entries(value)) {
    if (
      !courseId ||
      typeof partName !== "string" ||
      !parts.has(partName) ||
      !/^catalog-parts\/part-\d{3}\.json$/.test(partName)
    ) {
      throw new Error("Medical workspace index has an invalid course-part mapping.");
    }
    if (result.has(courseId)) {
      throw new Error("Medical workspace index contains a duplicate course ID.");
    }
    result.set(courseId, partName);
  }
  return result;
}

function parseMedicalWorkspaceIndex(value: unknown): MedicalWorkspaceIndex {
  if (!isObject(value)) throw new Error("Medical workspace index is not an object.");
  if (value.workspaceIndexVersion !== 1) {
    throw new Error(
      "Medical workspace index is missing version 1 data. Run scripts/split_medical_catalog.py."
    );
  }
  if (!Array.isArray(value.courseParts) || !Array.isArray(value.queueParts)) {
    throw new Error("Medical workspace index is missing compact queue data.");
  }
  const partNames = new Set<string>();
  for (const partName of value.courseParts) {
    if (
      typeof partName !== "string" ||
      !/^catalog-parts\/part-\d{3}\.json$/.test(partName)
    ) {
      throw new Error("Medical workspace index has an invalid course part name.");
    }
    partNames.add(partName);
  }
  const coursePartById = copyCoursePartMap(value.coursePartById, partNames);
  const queueParts: string[] = [];
  const queuePartNames = new Set<string>();
  for (const partName of value.queueParts) {
    if (
      typeof partName !== "string" ||
      !/^queue-parts\/part-\d{3}\.json$/.test(partName) ||
      queuePartNames.has(partName)
    ) {
      throw new Error("Medical workspace index has an invalid compact queue part.");
    }
    queuePartNames.add(partName);
    queueParts.push(partName);
  }
  if (!queueParts.length) {
    throw new Error("Medical workspace index has no compact queue parts.");
  }
  if (typeof value.savedCourseCount !== "number") {
    throw new Error("Medical workspace index has no saved course count.");
  }

  return {
    // Queue courses are intentionally loaded from their bounded generated files,
    // not embedded in this metadata index.
    catalog: normalizeCatalog({ ...value, courses: [] }),
    coursePartById,
    queueParts,
  };
}

function parseMedicalQueueCourses(
  values: JsonFile[],
  index: MedicalWorkspaceIndex,
  savedCourseCount: unknown
): CourseRecord[] {
  const queueCourseIds = new Set<string>();
  const queueCourses: CourseRecord[] = [];
  for (const file of values) {
    if (!Array.isArray(file.value)) {
      throw new Error("Medical workspace queue part is not an array.");
    }
    const courses = normalizeCatalog({ courses: file.value }).courses;
    for (const course of courses) {
      if (!course.id) {
        throw new Error("Medical workspace queue part has a course without an ID.");
      }
      if (!index.coursePartById.has(course.id) || queueCourseIds.has(course.id)) {
        throw new Error("Medical workspace queue does not match its course-part map.");
      }
      queueCourseIds.add(course.id);
      queueCourses.push(course);
    }
  }
  if (
    typeof savedCourseCount !== "number" ||
    savedCourseCount !== queueCourseIds.size ||
    index.coursePartById.size !== queueCourseIds.size
  ) {
    throw new Error("Medical workspace index course count is incomplete.");
  }
  return queueCourses;
}

function isRelevantLesson(
  lesson: OriginalLecturesData["lessons"][number],
  courseIds: Set<string>,
  programIds: Set<string>
): boolean {
  if (lesson.courseIds?.length) {
    return lesson.courseIds.some(courseId => courseIds.has(courseId));
  }
  return Boolean(lesson.programIds?.some(programId => programIds.has(programId)));
}

function selectWorkspaceDocuments(
  catalog: CatalogData,
  selected: CourseRecord,
  selectedLessons: OriginalLecturesData["lessons"]
) {
  const documentIds = new Set([
    ...(selected.pdfIds ?? []),
    ...selectedLessons.flatMap(lesson =>
      lesson.sourceId ? [lesson.sourceId] : []
    ),
    `syllabus-${selected.id}`,
  ]);
  return {
    documentIds,
    documents: catalog.documents.filter(
      document =>
        documentIds.has(document.id) ||
        document.aliases?.some(alias => documentIds.has(alias)) ||
        document.courseIds?.some(courseId => courseId === selected.id) ||
        (!document.courseIds?.length &&
          document.programIds?.some(programId => programId === selected.programId))
    ),
  };
}

/**
 * Builds targeted course workspaces from a compact, cached directory index.
 *
 * The aggregate `data/medical/catalog.json` is intentionally not a fallback:
 * its presence is producer source material, not a valid runtime dependency for
 * a normal `/course/:id` request. If the generated index is stale or invalid,
 * callers receive a transparent error rather than a deceptively partial course.
 */
export function createWorkspaceContentLoader(
  options: WorkspaceContentLoaderOptions = {}
) {
  const dataDir = options.dataDir ?? DATA_DIR;
  const mediaReader = options.getOriginalLectures ?? getOriginalLecturesContent;
  const medicalMediaReader =
    options.getMedicalOriginalLectures ?? getMedicalOriginalLecturesContent;
  const jsonCache = new Map<string, CachedJson>();
  const parsedFiles: string[] = [];
  let compactDirectoryCache: CompactDirectory | undefined;

  async function readJsonFile(relativeName: string): Promise<JsonFile> {
    const filePath = path.join(dataDir, relativeName);
    try {
      const stat = await fs.stat(filePath);
      const cached = jsonCache.get(relativeName);
      const version = `${stat.mtimeMs}:${stat.size}`;
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        return { value: cached.value, version: cached.version };
      }
      const value = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
      jsonCache.set(relativeName, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        value,
        version,
      });
      parsedFiles.push(relativeName);
      return { value, version };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        throw new Error(`Required workspace content file is missing: ${relativeName}`);
      }
      throw error;
    }
  }

  async function getCompactDirectory(): Promise<CompactDirectory> {
    const [baseFile, indexFile] = await Promise.all([
      readJsonFile("catalog.json"),
      readJsonFile("medical/catalog-index.json"),
    ]);
    const version = `${baseFile.version}|${indexFile.version}`;
    const medical = parseMedicalWorkspaceIndex(indexFile.value);
    const queueFiles = await Promise.all(
      medical.queueParts.map(queuePart => readJsonFile(`medical/${queuePart}`))
    );
    const versionWithQueueParts = [
      version,
      ...queueFiles.map(queueFile => queueFile.version),
    ].join("|");
    if (compactDirectoryCache?.version === versionWithQueueParts) {
      return compactDirectoryCache;
    }
    const savedCourseCount = isObject(indexFile.value)
      ? indexFile.value.savedCourseCount
      : undefined;
    const queueCourses = parseMedicalQueueCourses(
      queueFiles,
      medical,
      savedCourseCount
    );
    const catalog = mergeCatalogContent(baseFile.value, {
      ...medical.catalog,
      courses: queueCourses,
    });
    compactDirectoryCache = {
      version: versionWithQueueParts,
      catalog,
      coursePartById: medical.coursePartById,
    };
    return compactDirectoryCache;
  }

  async function getSelectedCourse(
    courseId: string,
    directory: CompactDirectory
  ): Promise<CourseRecord | undefined> {
    const medicalPart = directory.coursePartById.get(courseId);
    if (!medicalPart) {
      // The base catalogue is compact enough to remain cached as one source file.
      // Medical IDs must be present in the generated map and never fall back to it.
      return directory.catalog.courses.find(course => course.id === courseId);
    }

    const partFile = await readJsonFile(`medical/${medicalPart}`);
    if (!Array.isArray(partFile.value)) {
      throw new Error(`Medical workspace part is not an array: ${medicalPart}`);
    }
    const selected = partFile.value.find(
      course => isObject(course) && course.id === courseId
    );
    if (!selected) {
      throw new Error(
        `Medical workspace index mapped ${courseId} to a part that does not contain it.`
      );
    }
    return normalizeCatalog({ courses: [selected] }).courses[0];
  }

  /**
   * Directory routes need only compact course records. The generated index has
   * every course's queue transport fields, so this intentionally never calls
   * getCatalogContent/readMedicalCatalogFile or opens medical course parts.
   */
  async function getDirectoryContent(): Promise<CatalogData> {
    const [directory, medicalMedia] = await Promise.all([
      getCompactDirectory(),
      medicalMediaReader(),
    ]);
    return selectCatalogDirectory(
      normalizeMedicalGeneratedHours(directory.catalog, medicalMedia)
    );
  }

  async function getCourseWorkspace(
    courseId: string,
    scope: WorkspaceScope = "course"
  ): Promise<ContentSnapshot> {
    const directory = await getCompactDirectory();
    const selectedSource = await getSelectedCourse(courseId, directory);
    if (!selectedSource) {
      return {
        catalog: { ...directory.catalog, courses: [], documents: [] },
        media: { lessons: [], sourceCoverage: [] },
        assetIndex: null,
        updatedAt: new Date().toISOString(),
      };
    }

    // Media manifests retain their own live/bundled source-selection policy in
    // content.ts. This loader only narrows the returned records after that trust
    // boundary; it never accepts a client-provided media or document URL.
    const [media, medicalMedia] = await Promise.all([
      mediaReader(),
      medicalMediaReader(),
    ]);
    const selectedNormalized = normalizeMedicalGeneratedHours(
      { ...directory.catalog, courses: [selectedSource] },
      medicalMedia
    ).courses[0]!;
    const queueCourses =
      scope === "program"
        ? directory.catalog.courses
            .filter(course => course.programId === selectedNormalized.programId)
            .map(course =>
              course.id === selectedNormalized.id
                ? selectedNormalized
                : selectCourseForProgramQueue(course)
            )
        : [selectedNormalized];

    const selectedLessonIds = new Set([selectedNormalized.id]);
    const selectedProgramIds = new Set([selectedNormalized.programId]);
    const selectedLessons = media.lessons.filter(lesson =>
      isRelevantLesson(lesson, selectedLessonIds, selectedProgramIds)
    );
    const queueCourseIds = new Set(queueCourses.map(course => course.id));
    const queueProgramIds = new Set(queueCourses.map(course => course.programId));
    const queueLessons = media.lessons.filter(lesson =>
      isRelevantLesson(lesson, queueCourseIds, queueProgramIds)
    );
    const { documentIds, documents } = selectWorkspaceDocuments(
      directory.catalog,
      selectedNormalized,
      selectedLessons
    );

    return {
      catalog: {
        ...directory.catalog,
        courses: queueCourses,
        documents,
      },
      media: {
        ...media,
        lessons: queueLessons,
        sourceCoverage: media.sourceCoverage?.filter(entry =>
          Boolean(entry.sourceId && documentIds.has(entry.sourceId))
        ),
      },
      assetIndex: null,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    getDirectoryContent,
    getCourseWorkspace,
    getDiagnostics(): WorkspaceLoaderDiagnostics {
      return {
        parsedFiles: [...parsedFiles],
        aggregateMedicalCatalogPath: path.join(dataDir, "medical/catalog.json"),
      };
    },
    clearCache() {
      jsonCache.clear();
      compactDirectoryCache = undefined;
      parsedFiles.length = 0;
    },
  };
}

const workspaceContentLoader = createWorkspaceContentLoader();

/** Compact public directory data backed by the generated medical workspace index. */
export const getCompactDirectoryContent = workspaceContentLoader.getDirectoryContent;

/** The router-facing targeted loader for normal course and programme workspaces. */
export const getTargetedCourseWorkspace = workspaceContentLoader.getCourseWorkspace;
