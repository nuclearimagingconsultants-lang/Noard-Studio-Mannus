/**
 * Strict, reusable projection for producer manifests that are safe to persist in
 * the public feed and return to clients. This module intentionally has no
 * filesystem or database dependencies so the trusted Node CLI and browser app
 * can use identical readiness rules.
 *
 * @typedef {import("./catalog.ts").OriginalLesson} OriginalLesson
 * @typedef {import("./catalog.ts").OriginalLecturesData} OriginalLecturesData
 * @typedef {Pick<OriginalLesson,
 *   "id" | "title" | "description" | "sourceId" | "programIds" | "courseIds" |
 *   "status" | "sourcePages" | "pageCues" | "coverageStatus" | "sourceKind" |
 *   "isInstructional" | "videoUrl" | "captionUrl" | "transcriptUrl" |
 *   "transcript" | "durationSeconds" | "sourceUrls" | "medicalSourceUrls" |
 *   "medicalSourceReviewStatus" | "humanClinicalReviewStatus" | "scriptSha256" |
 *   "visualSha256" | "evidenceSelectionSha256" | "renderContentSha256" |
 *   "localAssetSha256" | "uploadedAssetSha256">} PublicOriginalLesson
 * @typedef {Pick<OriginalLecturesData, "sourceCoverage" | "productionState"> & {lessons: PublicOriginalLesson[]}} PublicMediaManifest
 */

const INTERNAL_OR_SECRET =
  /(?:\/home\/|\/tmp\/|\/var\/|file:|\b(?:secret|password|passphrase|api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|private[\s_-]?key|authorization|bearer)\b)/i;
const SHA256 = /^[a-f0-9]{64}$/;
const STABLE_STORAGE_PREFIX = "/manus-storage/";
const VIDEO_EXTENSION = /\.(?:mp4|webm|ogg|ogv|m4v)$/i;
const VTT_EXTENSION = /\.vtt$/i;
const TRANSCRIPT_EXTENSION = /\.(?:md|markdown|txt|text)$/i;
const PRODUCTION_STATE_KEYS = new Set([
  "status",
  "phase",
  "message",
  "reason",
  "updatedAt",
  "lastUpdated",
  "startedAt",
  "completedAt",
  "version",
  "ready",
  "planned",
  "blocked",
  "total",
  "completed",
  "baseProgrammes",
  "medicalSchool",
]);

/** @param {unknown} value */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * A safe public string must not disclose an operating-system location, a local
 * file URL, or a value that names a credential/secret. Values are dropped rather
 * than redacted so a path cannot be reconstructed from public output.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
export function isSafePublicString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !INTERNAL_OR_SECRET.test(value)
  );
}

/** @param {unknown} value */
function publicString(value) {
  return isSafePublicString(value) ? value : undefined;
}

/** @param {unknown} value */
function publicStringArray(value) {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(isSafePublicString);
  return strings.length ? [...new Set(strings)] : [];
}

/** @param {unknown} value */
function publicSourceUrlArray(value) {
  if (!Array.isArray(value)) return undefined;
  const urls = value.flatMap(candidate => {
    if (!isSafePublicString(candidate)) return [];
    try {
      const url = new URL(candidate);
      if (
        (url.protocol !== "https:" && url.protocol !== "http:") ||
        !url.hostname ||
        url.username ||
        url.password
      ) {
        return [];
      }
      return [candidate];
    } catch {
      return [];
    }
  });
  return urls.length ? [...new Set(urls)] : [];
}

/** @param {unknown} value */
function publicInteger(value) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : undefined;
}

/** @param {unknown} value */
function publicPositiveInteger(value) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
    ? value
    : undefined;
}

/** @param {unknown} value */
function publicFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Checks a storage address without resolving it against any host. Only a stable
 * relative Manus object path is accepted; external, query-bearing, fragment,
 * traversal, encoded-separator, and local addresses are rejected.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
export function isStableManusStoragePath(value) {
  if (!isSafePublicString(value) || !value.startsWith(STABLE_STORAGE_PREFIX)) {
    return false;
  }
  const suffix = value.slice(STABLE_STORAGE_PREFIX.length);
  if (
    !suffix ||
    /[?#\\]/.test(value) ||
    /(?:^|\/)\.?(?:\.)(?:\/|$)/.test(suffix) ||
    /%(?:2f|5c|3f|23|2e)/i.test(suffix)
  ) {
    return false;
  }
  return true;
}

/**
 * Generic original-video readiness for UI playback. It is deliberately not a
 * medical-hour qualification rule: medical hour counting must still apply the
 * existing source-review and exact hash gates in the medical/content layer.
 *
 * @param {unknown} lesson
 * @returns {boolean}
 */
export function isPublishableReadyOriginal(lesson) {
  if (!isRecord(lesson)) return false;
  return Boolean(
    lesson.status === "ready" &&
      typeof lesson.durationSeconds === "number" &&
      Number.isFinite(lesson.durationSeconds) &&
      lesson.durationSeconds > 0 &&
      isStableManusStoragePath(lesson.videoUrl) &&
      VIDEO_EXTENSION.test(lesson.videoUrl) &&
      isStableManusStoragePath(lesson.captionUrl) &&
      VTT_EXTENSION.test(lesson.captionUrl) &&
      isStableManusStoragePath(lesson.transcriptUrl) &&
      TRANSCRIPT_EXTENSION.test(lesson.transcriptUrl)
  );
}

/** @param {unknown} value */
function projectPageCues(value) {
  if (!Array.isArray(value)) return undefined;
  const cues = value.flatMap(candidate => {
    if (!isRecord(candidate)) return [];
    const start = publicFiniteNumber(candidate.start);
    const end = publicFiniteNumber(candidate.end);
    const page = publicPositiveInteger(candidate.page);
    if (start === undefined || end === undefined || page === undefined || end < start)
      return [];
    return [{ start, end, page }];
  });
  return cues.length ? cues : [];
}

/** @param {unknown} value */
function projectPageList(value) {
  if (!Array.isArray(value)) return undefined;
  const pages = value.filter(publicPositiveInteger);
  return pages.length ? [...new Set(pages)] : [];
}

/** @param {unknown} value */
function projectAssetHashes(value) {
  if (!isRecord(value)) return undefined;
  const projected = {};
  for (const key of ["mp4", "vtt", "transcript"]) {
    if (typeof value[key] === "string" && SHA256.test(value[key])) {
      projected[key] = value[key];
    }
  }
  return Object.keys(projected).length ? projected : undefined;
}

/** @param {unknown} value */
function projectSourceCoverage(value) {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap(entry => {
    if (!isRecord(entry)) return [];
    const projected = {};
    for (const key of ["sourceId", "title", "coverageStatus", "scopeNote"]) {
      const text = publicString(entry[key]);
      if (text !== undefined) projected[key] = text;
    }
    for (const key of [
      "pageCount",
      "substantivePages",
      "taughtPages",
      "plannedLessons",
      "readyLessons",
    ]) {
      const number = publicInteger(entry[key]);
      if (number !== undefined) projected[key] = number;
    }
    const programIds = publicStringArray(entry.programIds);
    if (programIds !== undefined) projected.programIds = programIds;
    const gaps = publicStringArray(entry.gaps);
    if (gaps !== undefined) projected.gaps = gaps;
    if (Array.isArray(entry.pageLedger)) {
      projected.pageLedger = entry.pageLedger.flatMap(page => {
        if (!isRecord(page)) return [];
        const item = {};
        for (const key of ["start_page", "end_page"]) {
          const number = publicPositiveInteger(page[key]);
          if (number !== undefined) item[key] = number;
        }
        const classification = publicString(page.classification);
        if (classification !== undefined) item.classification = classification;
        const reason = publicString(page.reason);
        if (reason !== undefined) item.reason = reason;
        const lessonIds = publicStringArray(page.lesson_ids);
        if (lessonIds !== undefined) item.lesson_ids = lessonIds;
        return Object.keys(item).length ? [item] : [];
      });
    }
    return [projected];
  });
}

/** @param {unknown} value @param {number} [depth] */
function projectProductionState(value, depth = 0) {
  if (depth > 4) return undefined;
  if (isSafePublicString(value)) return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const projected = value
      .map(item => projectProductionState(item, depth + 1))
      .filter(item => item !== undefined);
    return projected.length ? projected : [];
  }
  if (!isRecord(value)) return undefined;
  const projected = {};
  for (const key of PRODUCTION_STATE_KEYS) {
    const nested = projectProductionState(value[key], depth + 1);
    if (nested !== undefined) projected[key] = nested;
  }
  return Object.keys(projected).length ? projected : undefined;
}

/** @param {unknown} value */
function projectLesson(value) {
  if (!isRecord(value)) return null;
  const projected = {};
  for (const key of [
    "id",
    "title",
    "description",
    "sourceId",
    "status",
    "coverageStatus",
    "sourceKind",
    "medicalSourceReviewStatus",
    "humanClinicalReviewStatus",
    "transcript",
  ]) {
    const text = publicString(value[key]);
    if (text !== undefined) projected[key] = text;
  }
  if (!projected.id) return null;
  for (const key of ["programIds", "courseIds"]) {
    const ids = publicStringArray(value[key]);
    if (ids !== undefined) projected[key] = ids;
  }
  const sourcePages = projectPageList(value.sourcePages);
  if (sourcePages !== undefined) projected.sourcePages = sourcePages;
  const pageCues = projectPageCues(value.pageCues);
  if (pageCues !== undefined) projected.pageCues = pageCues;
  if (typeof value.isInstructional === "boolean") {
    projected.isInstructional = value.isInstructional;
  }
  const durationSeconds = publicFiniteNumber(value.durationSeconds);
  if (durationSeconds !== undefined) projected.durationSeconds = durationSeconds;
  for (const key of ["videoUrl", "captionUrl", "transcriptUrl"]) {
    const url = value[key];
    if (isStableManusStoragePath(url)) projected[key] = url;
  }
  for (const key of ["sourceUrls", "medicalSourceUrls"]) {
    const urls = publicSourceUrlArray(value[key]);
    if (urls !== undefined) projected[key] = urls;
  }
  for (const key of [
    "scriptSha256",
    "visualSha256",
    "evidenceSelectionSha256",
    "renderContentSha256",
  ]) {
    if (typeof value[key] === "string" && SHA256.test(value[key])) {
      projected[key] = value[key];
    }
  }
  for (const key of ["localAssetSha256", "uploadedAssetSha256"]) {
    const hashes = projectAssetHashes(value[key]);
    if (hashes !== undefined) projected[key] = hashes;
  }
  return projected;
}

/**
 * Projects producer input through the complete public allowlist. It never
 * mutates its input and deliberately omits notes, local assets, script/audit
 * outputs, unrecognized fields, and unsafe values.
 *
 * @param {unknown} value
 * @returns {PublicMediaManifest}
 */
export function projectPublicMediaManifest(value) {
  const input = isRecord(value) ? value : {};
  const projected = {
    lessons: Array.isArray(input.lessons)
      ? input.lessons.flatMap(lesson => {
          const publicLesson = projectLesson(lesson);
          return publicLesson ? [publicLesson] : [];
        })
      : [],
  };
  const sourceCoverage = projectSourceCoverage(input.sourceCoverage);
  if (sourceCoverage !== undefined) projected.sourceCoverage = sourceCoverage;
  const productionState = projectProductionState(input.productionState);
  if (productionState !== undefined) projected.productionState = productionState;
  return projected;
}

/** @param {unknown} value */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Returns true only for a manifest already equal to the strict public
 * projection. Public-feed readers use this after raw byte/hash validation so a
 * legacy row containing private data cannot become a trusted live response.
 *
 * @param {unknown} value
 * @returns {value is PublicMediaManifest}
 */
export function isPublicMediaManifest(value) {
  if (!isRecord(value) || !Array.isArray(value.lessons)) return false;
  return stableJson(value) === stableJson(projectPublicMediaManifest(value));
}
