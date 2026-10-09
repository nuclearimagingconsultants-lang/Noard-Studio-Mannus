var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/publicMedia.mjs
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isSafePublicString(value) {
  return typeof value === "string" && value.trim().length > 0 && !INTERNAL_OR_SECRET.test(value);
}
function publicString(value) {
  return isSafePublicString(value) ? value : void 0;
}
function publicStringArray(value) {
  if (!Array.isArray(value)) return void 0;
  const strings = value.filter(isSafePublicString);
  return strings.length ? [...new Set(strings)] : [];
}
function publicSourceUrlArray(value) {
  if (!Array.isArray(value)) return void 0;
  const urls = value.flatMap((candidate) => {
    if (!isSafePublicString(candidate)) return [];
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" && url.protocol !== "http:" || !url.hostname || url.username || url.password) {
        return [];
      }
      return [candidate];
    } catch {
      return [];
    }
  });
  return urls.length ? [...new Set(urls)] : [];
}
function publicInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function publicPositiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function publicFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
}
function isStableManusStoragePath(value) {
  if (!isSafePublicString(value) || !value.startsWith(STABLE_STORAGE_PREFIX)) {
    return false;
  }
  const suffix = value.slice(STABLE_STORAGE_PREFIX.length);
  if (!suffix || /[?#\\]/.test(value) || /(?:^|\/)\.?(?:\.)(?:\/|$)/.test(suffix) || /%(?:2f|5c|3f|23|2e)/i.test(suffix)) {
    return false;
  }
  return true;
}
function isPublishableReadyOriginal(lesson) {
  if (!isRecord(lesson)) return false;
  return Boolean(
    lesson.status === "ready" && typeof lesson.durationSeconds === "number" && Number.isFinite(lesson.durationSeconds) && lesson.durationSeconds > 0 && isStableManusStoragePath(lesson.videoUrl) && VIDEO_EXTENSION.test(lesson.videoUrl) && isStableManusStoragePath(lesson.captionUrl) && VTT_EXTENSION.test(lesson.captionUrl) && isStableManusStoragePath(lesson.transcriptUrl) && TRANSCRIPT_EXTENSION.test(lesson.transcriptUrl)
  );
}
function projectPageCues(value) {
  if (!Array.isArray(value)) return void 0;
  const cues = value.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const start = publicFiniteNumber(candidate.start);
    const end = publicFiniteNumber(candidate.end);
    const page = publicPositiveInteger(candidate.page);
    if (start === void 0 || end === void 0 || page === void 0 || end < start)
      return [];
    return [{ start, end, page }];
  });
  return cues.length ? cues : [];
}
function projectPageList(value) {
  if (!Array.isArray(value)) return void 0;
  const pages = value.filter(publicPositiveInteger);
  return pages.length ? [...new Set(pages)] : [];
}
function projectAssetHashes(value) {
  if (!isRecord(value)) return void 0;
  const projected = {};
  for (const key of ["mp4", "vtt", "transcript"]) {
    if (typeof value[key] === "string" && SHA256.test(value[key])) {
      projected[key] = value[key];
    }
  }
  return Object.keys(projected).length ? projected : void 0;
}
function projectSourceCoverage(value) {
  if (!Array.isArray(value)) return void 0;
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const projected = {};
    for (const key of ["sourceId", "title", "coverageStatus", "scopeNote"]) {
      const text2 = publicString(entry[key]);
      if (text2 !== void 0) projected[key] = text2;
    }
    for (const key of [
      "pageCount",
      "substantivePages",
      "taughtPages",
      "plannedLessons",
      "readyLessons"
    ]) {
      const number = publicInteger(entry[key]);
      if (number !== void 0) projected[key] = number;
    }
    const programIds = publicStringArray(entry.programIds);
    if (programIds !== void 0) projected.programIds = programIds;
    const gaps = publicStringArray(entry.gaps);
    if (gaps !== void 0) projected.gaps = gaps;
    if (Array.isArray(entry.pageLedger)) {
      projected.pageLedger = entry.pageLedger.flatMap((page) => {
        if (!isRecord(page)) return [];
        const item = {};
        for (const key of ["start_page", "end_page"]) {
          const number = publicPositiveInteger(page[key]);
          if (number !== void 0) item[key] = number;
        }
        const classification = publicString(page.classification);
        if (classification !== void 0) item.classification = classification;
        const reason = publicString(page.reason);
        if (reason !== void 0) item.reason = reason;
        const lessonIds = publicStringArray(page.lesson_ids);
        if (lessonIds !== void 0) item.lesson_ids = lessonIds;
        return Object.keys(item).length ? [item] : [];
      });
    }
    return [projected];
  });
}
function projectProductionState(value, depth = 0) {
  if (depth > 4) return void 0;
  if (isSafePublicString(value)) return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const projected2 = value.map((item) => projectProductionState(item, depth + 1)).filter((item) => item !== void 0);
    return projected2.length ? projected2 : [];
  }
  if (!isRecord(value)) return void 0;
  const projected = {};
  for (const key of PRODUCTION_STATE_KEYS) {
    const nested = projectProductionState(value[key], depth + 1);
    if (nested !== void 0) projected[key] = nested;
  }
  return Object.keys(projected).length ? projected : void 0;
}
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
    "transcript"
  ]) {
    const text2 = publicString(value[key]);
    if (text2 !== void 0) projected[key] = text2;
  }
  if (!projected.id) return null;
  for (const key of ["programIds", "courseIds"]) {
    const ids = publicStringArray(value[key]);
    if (ids !== void 0) projected[key] = ids;
  }
  const sourcePages = projectPageList(value.sourcePages);
  if (sourcePages !== void 0) projected.sourcePages = sourcePages;
  const pageCues = projectPageCues(value.pageCues);
  if (pageCues !== void 0) projected.pageCues = pageCues;
  if (typeof value.isInstructional === "boolean") {
    projected.isInstructional = value.isInstructional;
  }
  const durationSeconds = publicFiniteNumber(value.durationSeconds);
  if (durationSeconds !== void 0) projected.durationSeconds = durationSeconds;
  for (const key of ["videoUrl", "captionUrl", "transcriptUrl"]) {
    const url = value[key];
    if (isStableManusStoragePath(url)) projected[key] = url;
  }
  for (const key of ["sourceUrls", "medicalSourceUrls"]) {
    const urls = publicSourceUrlArray(value[key]);
    if (urls !== void 0) projected[key] = urls;
  }
  for (const key of [
    "scriptSha256",
    "visualSha256",
    "evidenceSelectionSha256",
    "renderContentSha256"
  ]) {
    if (typeof value[key] === "string" && SHA256.test(value[key])) {
      projected[key] = value[key];
    }
  }
  for (const key of ["localAssetSha256", "uploadedAssetSha256"]) {
    const hashes = projectAssetHashes(value[key]);
    if (hashes !== void 0) projected[key] = hashes;
  }
  return projected;
}
function projectPublicMediaManifest(value) {
  const input = isRecord(value) ? value : {};
  const projected = {
    lessons: Array.isArray(input.lessons) ? input.lessons.flatMap((lesson) => {
      const publicLesson = projectLesson(lesson);
      return publicLesson ? [publicLesson] : [];
    }) : []
  };
  const sourceCoverage = projectSourceCoverage(input.sourceCoverage);
  if (sourceCoverage !== void 0) projected.sourceCoverage = sourceCoverage;
  const productionState = projectProductionState(input.productionState);
  if (productionState !== void 0) projected.productionState = productionState;
  return projected;
}
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function isPublicMediaManifest(value) {
  if (!isRecord(value) || !Array.isArray(value.lessons)) return false;
  return stableJson(value) === stableJson(projectPublicMediaManifest(value));
}
var INTERNAL_OR_SECRET, SHA256, STABLE_STORAGE_PREFIX, VIDEO_EXTENSION, VTT_EXTENSION, TRANSCRIPT_EXTENSION, PRODUCTION_STATE_KEYS;
var init_publicMedia = __esm({
  "shared/publicMedia.mjs"() {
    "use strict";
    INTERNAL_OR_SECRET = /(?:\/home\/|\/tmp\/|\/var\/|file:|\b(?:secret|password|passphrase|api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|private[\s_-]?key|authorization|bearer)\b)/i;
    SHA256 = /^[a-f0-9]{64}$/;
    STABLE_STORAGE_PREFIX = "/manus-storage/";
    VIDEO_EXTENSION = /\.(?:mp4|webm|ogg|ogv|m4v)$/i;
    VTT_EXTENSION = /\.vtt$/i;
    TRANSCRIPT_EXTENSION = /\.(?:md|markdown|txt|text)$/i;
    PRODUCTION_STATE_KEYS = /* @__PURE__ */ new Set([
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
      "medicalSchool"
    ]);
  }
});

// shared/catalog.ts
var emptyCatalog, emptyOriginalLectures;
var init_catalog = __esm({
  "shared/catalog.ts"() {
    "use strict";
    emptyCatalog = () => ({
      programs: [],
      courses: [],
      documents: [],
      downloads: [],
      stats: {},
      productionOrder: [],
      credentialNotice: ""
    });
    emptyOriginalLectures = () => ({
      lessons: [],
      sourceCoverage: [],
      productionState: [],
      notes: []
    });
  }
});

// shared/medical.ts
function isRecord2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function getDirectoryMedicalValidation(course) {
  const value = course.directoryMedicalValidation;
  if (!isRecord2(value) || value.source !== "full-catalog") return void 0;
  if (!Array.isArray(value.issues) || !value.issues.every(isNonEmptyString) || typeof value.isReady !== "boolean" || !isNonNegativeNumber(value.unknownDurationCount) || !Number.isInteger(value.unknownDurationCount)) {
    return void 0;
  }
  return value;
}
function readOptionalNumber(value) {
  return isNonNegativeNumber(value) ? value : void 0;
}
function hasExactSha256(value) {
  return typeof value === "string" && SHA2562.test(value);
}
function hasExactDeliveryAssetHashes(value) {
  return isRecord2(value) && REQUIRED_DELIVERY_ASSETS.every((key) => hasExactSha256(value[key]));
}
function hasQualifyingAutomatedMedicalReview(lesson) {
  if (lesson.medicalSourceReviewStatus === AUTOMATED_MEDICAL_SOURCE_REVIEW) {
    return true;
  }
  if (lesson.medicalSourceReviewStatus !== PERFORMED_AUTOMATED_SOURCE_CHECK) {
    return false;
  }
  const localAssetSha256 = lesson.localAssetSha256;
  const uploadedAssetSha256 = lesson.uploadedAssetSha256;
  if (!hasExactSha256(lesson.scriptSha256) || !hasExactSha256(lesson.visualSha256) || !hasExactSha256(lesson.evidenceSelectionSha256) || !hasExactSha256(lesson.renderContentSha256) || !hasExactDeliveryAssetHashes(localAssetSha256) || !hasExactDeliveryAssetHashes(uploadedAssetSha256)) {
    return false;
  }
  return REQUIRED_DELIVERY_ASSETS.every(
    (key) => localAssetSha256[key] === uploadedAssetSha256[key]
  );
}
function getMedicalMetadata(course) {
  const nested = isRecord2(course.medical) ? course.medical : {};
  const direct = Object.fromEntries(
    MEDICAL_KEYS.flatMap((key) => {
      const value = course[key];
      return value === void 0 ? [] : [[key, value]];
    })
  );
  return { ...nested, ...direct };
}
function isMedicalCourse(course) {
  return course.programId === "med" || isRecord2(course.medical) || isNonEmptyString(course.family) || isNonEmptyString(course.trackType);
}
function summarizeMedicalHours(course) {
  const metadata = getMedicalMetadata(course);
  const directoryValidation = getDirectoryMedicalValidation(course);
  const declaredExternalHours = readOptionalNumber(
    metadata.verifiedExternalHours
  );
  const verifiedSpecialtyHours = readOptionalNumber(
    metadata.verifiedSpecialtyHours
  );
  const verifiedFoundationHours = readOptionalNumber(
    metadata.verifiedFoundationHours
  );
  const hasBreakdown = verifiedSpecialtyHours !== void 0 || verifiedFoundationHours !== void 0;
  const verifiedExternalHours = declaredExternalHours ?? (hasBreakdown ? (verifiedSpecialtyHours ?? 0) + (verifiedFoundationHours ?? 0) : void 0);
  const verifiedGeneratedHours = readOptionalNumber(
    metadata.verifiedGeneratedHours
  );
  const hasMeasuredComponents = verifiedExternalHours !== void 0 || verifiedGeneratedHours !== void 0;
  const verifiedTotalHours = hasMeasuredComponents ? (verifiedExternalHours ?? 0) + (verifiedGeneratedHours ?? 0) : void 0;
  const targetHours = readOptionalNumber(metadata.targetVideoHours);
  return {
    targetHours,
    verifiedHours: verifiedTotalHours,
    verifiedExternalHours,
    verifiedGeneratedHours,
    verifiedTotalHours,
    verifiedSpecialtyHours,
    verifiedFoundationHours,
    calculatedGapHours: targetHours !== void 0 && verifiedTotalHours !== void 0 ? Math.max(0, targetHours - verifiedTotalHours) : void 0,
    declaredGapHours: readOptionalNumber(metadata.hoursGap),
    unknownDurationCount: directoryValidation?.unknownDurationCount ?? (Array.isArray(metadata.unknownDurationItems) ? metadata.unknownDurationItems.length : 0)
  };
}
function optionIds(question) {
  return Array.isArray(question.options) ? question.options.map((option) => isRecord2(option) ? option.id : void 0).filter(isNonEmptyString) : [];
}
function validatePracticeQuestion(question) {
  if (!isRecord2(question)) return ["Question must be an object."];
  const issues = [];
  if (!isNonEmptyString(question.id)) issues.push("Question ID is missing.");
  if (!isNonEmptyString(question.stem))
    issues.push("Question stem is missing.");
  if (!Array.isArray(question.options) || question.options.length < 2) {
    issues.push("Question requires at least two answer choices.");
  }
  const ids = optionIds(question);
  if (ids.length !== (Array.isArray(question.options) ? question.options.length : 0)) {
    issues.push("Every answer choice needs a non-empty ID.");
  }
  if (new Set(ids).size !== ids.length) {
    issues.push("Answer choice IDs must be unique.");
  }
  if (!isNonEmptyString(question.correctOptionId) || !ids.includes(question.correctOptionId)) {
    issues.push("The correct option must identify one listed choice.");
  }
  if (!isNonEmptyString(question.rationale))
    issues.push("A source-cited rationale is missing.");
  if (!Array.isArray(question.sourceUrls) || question.sourceUrls.length === 0 || !question.sourceUrls.every(isNonEmptyString)) {
    issues.push("At least one source URL is required for the rationale.");
  }
  if (!isNonEmptyString(question.domain))
    issues.push("Sampled domain is missing.");
  if (typeof question.fictionalCase !== "boolean") {
    issues.push("Question must state whether its case is fictional.");
  }
  return issues;
}
function validMedicalLectures(course) {
  return (course.lectures ?? []).every(
    (lecture) => isNonEmptyString(lecture.url) && isNonEmptyString(lecture.sourceUrl) && isNonNegativeNumber(lecture.durationSeconds) && lecture.durationSeconds > 0 && lecture.accessVerified === true
  );
}
function isMedicalCourseReady(course) {
  const directoryValidation = getDirectoryMedicalValidation(course);
  if (isMedicalCourse(course) && directoryValidation) {
    return directoryValidation.isReady;
  }
  const hours = summarizeMedicalHours(course);
  const hasMeasuredHourEvidence = Boolean(
    course.lectures?.length || (hours.verifiedGeneratedHours ?? 0) > 0
  );
  return Boolean(
    validateMedicalCourse(course).length === 0 && hours.targetHours !== void 0 && hours.verifiedTotalHours !== void 0 && hours.verifiedTotalHours >= hours.targetHours && hours.unknownDurationCount === 0 && hasMeasuredHourEvidence && validMedicalLectures(course)
  );
}
function validateMedicalCourse(course) {
  if (!isMedicalCourse(course)) return [];
  const directoryValidation = getDirectoryMedicalValidation(course);
  if (directoryValidation) return [...directoryValidation.issues];
  const metadata = getMedicalMetadata(course);
  const issues = [];
  for (const field of [
    "family",
    "trackType",
    "boardEligibilityNotice"
  ]) {
    if (!isNonEmptyString(metadata[field])) issues.push(`${field} is missing.`);
  }
  if (!isNonEmptyString(metadata.boardStatus) && !(isRecord2(metadata.boardStatus) && Object.values(metadata.boardStatus).some(isNonEmptyString))) {
    issues.push(
      "boardStatus needs a readable text or structured source record."
    );
  }
  if (!Array.isArray(metadata.boardNames) || !metadata.boardNames.length || !metadata.boardNames.every(isNonEmptyString)) {
    issues.push(
      "boardNames must contain at least one board label or an explicit non-board label."
    );
  }
  if (!isNonNegativeNumber(metadata.targetVideoHours) || metadata.targetVideoHours < 36) {
    issues.push("targetVideoHours must be a finite number of at least 36.");
  }
  for (const field of [
    "verifiedExternalHours",
    "verifiedGeneratedHours",
    "verifiedTotalHours",
    "verifiedSpecialtyHours",
    "verifiedFoundationHours",
    "hoursGap"
  ]) {
    if (metadata[field] !== void 0 && !isNonNegativeNumber(metadata[field])) {
      issues.push(
        `${field} must be a finite non-negative number when supplied.`
      );
    }
  }
  if (!Array.isArray(metadata.unknownDurationItems)) {
    issues.push(
      "unknownDurationItems must be an array, including an empty array when none are known."
    );
  }
  if (metadata.clinicalTrainingNotReplaced !== true) {
    issues.push("clinicalTrainingNotReplaced must be true.");
  }
  if (metadata.humanClinicalReviewStatus !== "not performed") {
    issues.push(
      "humanClinicalReviewStatus must be 'not performed' unless a separately evidenced review status is introduced."
    );
  }
  if (!Array.isArray(metadata.officialProgrammes)) {
    issues.push("officialProgrammes must be an array.");
  } else {
    metadata.officialProgrammes.forEach((programme, index2) => {
      if (!isRecord2(programme)) {
        issues.push(`officialProgrammes[${index2}] must be an object.`);
        return;
      }
      for (const field of [
        "institution",
        "name",
        "url",
        "publicCurriculumNotes"
      ]) {
        if (!isNonEmptyString(programme[field])) {
          issues.push(`officialProgrammes[${index2}].${field} is missing.`);
        }
      }
    });
  }
  for (const field of [
    "sourceCaveats",
    "sourceReferences",
    "originalClipPlan",
    "practiceQuestions"
  ]) {
    if (!Array.isArray(metadata[field]))
      issues.push(`${field} must be an array.`);
  }
  if (Array.isArray(metadata.practiceQuestions)) {
    metadata.practiceQuestions.forEach((question, index2) => {
      for (const issue of validatePracticeQuestion(question)) {
        issues.push(`practiceQuestions[${index2}]: ${issue}`);
      }
    });
  }
  const hours = summarizeMedicalHours(course);
  if (metadata.verifiedTotalHours !== void 0 && hours.verifiedTotalHours !== void 0 && Math.abs(metadata.verifiedTotalHours - hours.verifiedTotalHours) > 0.01) {
    issues.push(
      "verifiedTotalHours must equal verified outside plus qualifying original hours."
    );
  }
  if (hours.declaredGapHours !== void 0 && hours.calculatedGapHours !== void 0 && Math.abs(hours.declaredGapHours - hours.calculatedGapHours) > 0.01) {
    issues.push(
      "hoursGap does not match targetVideoHours minus verified hours."
    );
  }
  return issues;
}
var MEDICAL_KEYS, AUTOMATED_MEDICAL_SOURCE_REVIEW, PERFORMED_AUTOMATED_SOURCE_CHECK, SHA2562, REQUIRED_DELIVERY_ASSETS;
var init_medical = __esm({
  "shared/medical.ts"() {
    "use strict";
    MEDICAL_KEYS = [
      "family",
      "trackType",
      "boardNames",
      "boardStatus",
      "boardEligibilityNotice",
      "targetVideoHours",
      "verifiedExternalHours",
      "verifiedGeneratedHours",
      "verifiedTotalHours",
      "verifiedSpecialtyHours",
      "verifiedFoundationHours",
      "hoursGap",
      "unknownDurationItems",
      "clinicalTrainingNotReplaced",
      "humanClinicalReviewStatus",
      "officialProgrammes",
      "sourceCaveats",
      "sourceReferences",
      "originalClipPlan",
      "practiceQuestions"
    ];
    AUTOMATED_MEDICAL_SOURCE_REVIEW = "automated_source_review_passed";
    PERFORMED_AUTOMATED_SOURCE_CHECK = "passed_automated_source_check";
    SHA2562 = /^[a-f0-9]{64}$/;
    REQUIRED_DELIVERY_ASSETS = ["mp4", "vtt", "transcript"];
  }
});

// server/publicContentFeed.ts
import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
function isRecord3(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isPublicManifestKind(value) {
  return typeof value === "string" && PUBLIC_MANIFEST_KINDS.includes(value);
}
function sha256Utf8(value) {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}
function validatePublicManifestRow(candidate, expectedKind) {
  if (!isRecord3(candidate)) return null;
  const kind = candidate.manifestType;
  const manifestJson = candidate.manifestJson;
  const manifestSha256 = candidate.manifestSha256;
  const manifestBytes = candidate.manifestBytes;
  if (!isPublicManifestKind(kind) || expectedKind && kind !== expectedKind || typeof manifestJson !== "string" || typeof manifestSha256 !== "string" || !SHA2563.test(manifestSha256) || typeof manifestBytes !== "number" || !Number.isSafeInteger(manifestBytes) || manifestBytes < 1) {
    return null;
  }
  const bytes = Buffer.from(manifestJson, "utf8");
  if (bytes.length !== manifestBytes || sha256Utf8(manifestJson) !== manifestSha256) {
    return null;
  }
  try {
    const value = JSON.parse(manifestJson);
    if (!isPublicMediaManifest(value)) return null;
    return { kind, value, sha256: manifestSha256, bytes: manifestBytes };
  } catch {
    return null;
  }
}
function resolveValidatedManifestSources(bundled, validated) {
  return Object.fromEntries(
    PUBLIC_MANIFEST_KINDS.map((kind) => {
      const row = validated[kind];
      return [
        kind,
        row && row.kind === kind ? {
          value: row.value,
          version: `live:${row.sha256}`,
          source: "live"
        } : {
          value: bundled[kind].value,
          version: bundled[kind].version,
          source: "bundled"
        }
      ];
    })
  );
}
async function readBoundedPublicManifestRows(read, cancel, deadlineMs = READ_DEADLINE_MS) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          try {
            cancel();
          } catch {
          }
          reject(new Error("Public manifest read deadline exceeded"));
        }, deadlineMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function readPublicRows(databaseUrl) {
  let connection;
  let cancelled = false;
  try {
    return await readBoundedPublicManifestRows(
      async () => {
        connection = await mysql.createConnection({
          uri: databaseUrl,
          connectTimeout: 2e3
        });
        if (cancelled) {
          connection.destroy();
          throw new Error("Public manifest connection exceeded deadline");
        }
        const [rows] = await connection.query({
          sql: "SELECT manifestType, manifestJson, manifestSha256, manifestBytes FROM publicContentManifests",
          timeout: 2e3
        });
        return rows;
      },
      () => {
        cancelled = true;
        connection?.destroy();
      }
    );
  } finally {
    connection?.destroy();
  }
}
async function loadLivePublicManifests() {
  let manifests = {};
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn(
        "[Content] Public manifest feed unavailable; using bundled manifests."
      );
    } else {
      const rows = await readPublicRows(databaseUrl);
      for (const kind of PUBLIC_MANIFEST_KINDS) {
        const valid = rows.map((row) => validatePublicManifestRow(row, kind)).find((row) => row !== null);
        if (valid) manifests[kind] = valid;
        else if (rows.some((row) => isRecord3(row) && row.manifestType === kind)) {
          console.warn(
            `[Content] Ignoring invalid live ${kind} manifest row; using bundled fallback.`
          );
        }
      }
    }
  } catch (error) {
    console.warn(
      "[Content] Public manifest feed read failed; using bundled manifests:",
      error instanceof Error ? error.name : "unknown read failure"
    );
  }
  liveCache = { expiresAt: Date.now() + CACHE_TTL_MS, manifests };
  return manifests;
}
async function getLivePublicManifests() {
  if (liveCache && liveCache.expiresAt > Date.now()) return liveCache.manifests;
  if (!inFlight)
    inFlight = loadLivePublicManifests().finally(() => {
      inFlight = void 0;
    });
  return inFlight;
}
var PUBLIC_MANIFEST_KINDS, SHA2563, CACHE_TTL_MS, READ_DEADLINE_MS, inFlight, liveCache;
var init_publicContentFeed = __esm({
  "server/publicContentFeed.ts"() {
    "use strict";
    init_publicMedia();
    PUBLIC_MANIFEST_KINDS = ["base", "medical"];
    SHA2563 = /^[a-f0-9]{64}$/;
    CACHE_TTL_MS = 15e3;
    READ_DEADLINE_MS = 4e3;
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      get appId() {
        return process.env.MANUS_PROJECT_ID ?? "";
      },
      get cookieSecret() {
        return process.env.MANUS_JWT_SECRET ?? "";
      },
      get databaseUrl() {
        return process.env.DATABASE_URL ?? "";
      },
      get oAuthServerUrl() {
        return process.env.MANUS_OAUTH_API_URL ?? "";
      },
      // Preserve the legacy hint when supplied; otherwise roles remain application data.
      get ownerOpenId() {
        return process.env.OWNER_OPEN_ID ?? "";
      },
      get isProduction() {
        return process.env.NODE_ENV === "production";
      },
      get forgeApiUrl() {
        return process.env.MANUS_API_URL ?? "";
      },
      get forgeApiKey() {
        return process.env.MANUS_API_KEY ?? "";
      }
    };
  }
});

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set MANUS_API_URL and MANUS_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
async function storageGetSignedUrl(relKey) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = normalizeKey(relKey);
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = await resp.json();
  if (!url) throw new Error("Storage did not return a download URL");
  return url;
}
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_env();
  }
});

// server/publicAssetOrigin.ts
function getPublicAssetOrigin(env = process.env) {
  const candidate = env.BOARD_STUDIO_PUBLIC_ASSET_ORIGIN?.trim() || DEFAULT_PUBLIC_ASSET_ORIGIN;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("invalid public asset origin");
    }
    return parsed.origin;
  } catch {
    return DEFAULT_PUBLIC_ASSET_ORIGIN;
  }
}
function getPublicAssetUrl(storagePath, env = process.env) {
  if (!isStableManusStoragePath(storagePath)) return null;
  return new URL(storagePath, getPublicAssetOrigin(env)).toString();
}
function redirectPublicAsset(req, res) {
  const target = getPublicAssetUrl(req.path);
  if (!target) {
    res.status(404).json({ error: "Public asset not found" });
    return;
  }
  res.set("Cache-Control", "public, max-age=300");
  res.redirect(307, target);
}
function registerPublicAssetRedirect(app2) {
  app2.get("/manus-storage/*", redirectPublicAsset);
}
var DEFAULT_PUBLIC_ASSET_ORIGIN;
var init_publicAssetOrigin = __esm({
  "server/publicAssetOrigin.ts"() {
    "use strict";
    init_publicMedia();
    DEFAULT_PUBLIC_ASSET_ORIGIN = "https://boardstudio-svjffwzx.manus.space";
  }
});

// shared/catalogDirectory.ts
function isRecord4(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function copyStringArray(value) {
  return value ? [...value] : void 0;
}
function selectProgram(program) {
  return {
    id: program.id,
    name: program.name,
    fullName: program.fullName,
    description: program.description,
    outlineUrl: program.outlineUrl,
    courseCount: program.courseCount,
    verifiedExternalHours: program.verifiedExternalHours,
    prerequisites: program.prerequisites,
    schedule: program.schedule,
    capstone: program.capstone,
    accessNotes: program.accessNotes,
    limitations: program.limitations,
    guideUrl: program.guideUrl,
    credentialType: program.credentialType
  };
}
function selectUnitMap(units) {
  return units?.map((unit) => ({
    number: unit.number,
    text: unit.text,
    coverage: unit.coverage,
    lectureIds: copyStringArray(unit.lectureIds),
    viewingSequence: copyStringArray(unit.viewingSequence)
  }));
}
function selectOfficialProgrammes(value) {
  return value?.map((programme) => {
    if (!isRecord4(programme)) return {};
    return {
      institution: programme.institution,
      name: programme.name
    };
  });
}
function selectLectures(course) {
  return course.lectures?.map((lecture) => ({
    id: lecture.id,
    title: lecture.title,
    url: lecture.url,
    provider: lecture.provider,
    durationSeconds: lecture.durationSeconds,
    sourceUrl: lecture.sourceUrl,
    accessVerified: lecture.accessVerified
  }));
}
function selectCourse(course) {
  const medicalCourse = isMedicalCourse(course);
  const directoryCourse = {
    id: course.id,
    programId: course.programId,
    title: course.title,
    term: course.term,
    level: course.level,
    studyHours: course.studyHours,
    coverageStatus: course.coverageStatus,
    syllabusUrl: course.syllabusUrl,
    // Base-programme directory routes construct their Play All queues here.
    // Medical Play All loads an untouched scope=program workspace instead, so
    // retaining its many lecture and unit records in this response is wasteful.
    ...medicalCourse ? {} : {
      lectures: selectLectures(course),
      unitMap: selectUnitMap(course.unitMap)
    }
  };
  if (!medicalCourse) return directoryCourse;
  const metadata = getMedicalMetadata(course);
  const validationIssues = validateMedicalCourse(course);
  const medicalHours = summarizeMedicalHours(course);
  return {
    ...directoryCourse,
    family: metadata.family,
    trackType: metadata.trackType,
    boardNames: copyStringArray(metadata.boardNames),
    boardStatus: metadata.boardStatus,
    boardEligibilityNotice: metadata.boardEligibilityNotice,
    targetVideoHours: metadata.targetVideoHours,
    verifiedExternalHours: metadata.verifiedExternalHours,
    verifiedGeneratedHours: metadata.verifiedGeneratedHours,
    verifiedTotalHours: metadata.verifiedTotalHours,
    verifiedSpecialtyHours: metadata.verifiedSpecialtyHours,
    verifiedFoundationHours: metadata.verifiedFoundationHours,
    hoursGap: metadata.hoursGap,
    clinicalTrainingNotReplaced: metadata.clinicalTrainingNotReplaced,
    humanClinicalReviewStatus: metadata.humanClinicalReviewStatus,
    officialProgrammes: selectOfficialProgrammes(metadata.officialProgrammes),
    // This outcome is computed from the untouched full record. Omitting the
    // detailed arrays below must not turn an incomplete course into a ready one.
    directoryMedicalValidation: {
      source: "full-catalog",
      issues: [...validationIssues],
      isReady: isMedicalCourseReady(course),
      unknownDurationCount: medicalHours.unknownDurationCount
    }
  };
}
function selectDocument(document) {
  return {
    id: document.id,
    title: document.title,
    author: document.author,
    sourceUrl: document.sourceUrl,
    licenseNote: document.licenseNote,
    programIds: copyStringArray(document.programIds),
    storageUrl: document.storageUrl
  };
}
function selectDownload(download) {
  return {
    id: download.id,
    title: download.title,
    kind: download.kind,
    url: download.url
  };
}
function selectMedicalSchool(school) {
  if (!school) return void 0;
  return {
    label: school.label,
    status: school.status,
    state: school.state,
    catalogueStatus: school.catalogueStatus,
    minimumTargetVideoHoursPerSpecialty: school.minimumTargetVideoHoursPerSpecialty,
    noAffiliationNotice: school.noAffiliationNotice,
    clinicalTrainingNotice: school.clinicalTrainingNotice,
    patientDataNotice: school.patientDataNotice,
    mediaReadinessNotice: school.mediaReadinessNotice,
    humanClinicalReviewStatus: school.humanClinicalReviewStatus,
    researchGaps: copyStringArray(school.researchGaps)
  };
}
function selectCatalogDirectory(full) {
  return {
    programs: full.programs.map(selectProgram),
    courses: full.courses.map(selectCourse),
    documents: full.documents.map(selectDocument),
    downloads: full.downloads.map(selectDownload),
    stats: full.stats ? { ...full.stats } : void 0,
    credentialNotice: full.credentialNotice,
    medicalSchool: selectMedicalSchool(full.medicalSchool)
  };
}
function selectCourseForProgramQueue(course) {
  return {
    ...selectCourse(course),
    pdfIds: copyStringArray(course.pdfIds),
    lectures: selectLectures(course),
    unitMap: selectUnitMap(course.unitMap)
  };
}
var init_catalogDirectory = __esm({
  "shared/catalogDirectory.ts"() {
    "use strict";
    init_medical();
  }
});

// server/workspaceContent.ts
var workspaceContent_exports = {};
__export(workspaceContent_exports, {
  createWorkspaceContentLoader: () => createWorkspaceContentLoader,
  getCompactDirectoryContent: () => getCompactDirectoryContent,
  getTargetedCourseWorkspace: () => getTargetedCourseWorkspace
});
import { promises as fs } from "node:fs";
import path from "node:path";
function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function copyCoursePartMap(value, parts) {
  if (!isObject(value)) throw new Error("Medical workspace index has no coursePartById map.");
  const result = /* @__PURE__ */ new Map();
  for (const [courseId, partName] of Object.entries(value)) {
    if (!courseId || typeof partName !== "string" || !parts.has(partName) || !/^catalog-parts\/part-\d{3}\.json$/.test(partName)) {
      throw new Error("Medical workspace index has an invalid course-part mapping.");
    }
    if (result.has(courseId)) {
      throw new Error("Medical workspace index contains a duplicate course ID.");
    }
    result.set(courseId, partName);
  }
  return result;
}
function parseMedicalWorkspaceIndex(value) {
  if (!isObject(value)) throw new Error("Medical workspace index is not an object.");
  if (value.workspaceIndexVersion !== 1) {
    throw new Error(
      "Medical workspace index is missing version 1 data. Run scripts/split_medical_catalog.py."
    );
  }
  if (!Array.isArray(value.courseParts) || !Array.isArray(value.queueParts)) {
    throw new Error("Medical workspace index is missing compact queue data.");
  }
  const partNames = /* @__PURE__ */ new Set();
  for (const partName of value.courseParts) {
    if (typeof partName !== "string" || !/^catalog-parts\/part-\d{3}\.json$/.test(partName)) {
      throw new Error("Medical workspace index has an invalid course part name.");
    }
    partNames.add(partName);
  }
  const coursePartById = copyCoursePartMap(value.coursePartById, partNames);
  const queueParts = [];
  const queuePartNames = /* @__PURE__ */ new Set();
  for (const partName of value.queueParts) {
    if (typeof partName !== "string" || !/^queue-parts\/part-\d{3}\.json$/.test(partName) || queuePartNames.has(partName)) {
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
    queueParts
  };
}
function parseMedicalQueueCourses(values, index2, savedCourseCount) {
  const queueCourseIds = /* @__PURE__ */ new Set();
  const queueCourses = [];
  for (const file of values) {
    if (!Array.isArray(file.value)) {
      throw new Error("Medical workspace queue part is not an array.");
    }
    const courses = normalizeCatalog({ courses: file.value }).courses;
    for (const course of courses) {
      if (!course.id) {
        throw new Error("Medical workspace queue part has a course without an ID.");
      }
      if (!index2.coursePartById.has(course.id) || queueCourseIds.has(course.id)) {
        throw new Error("Medical workspace queue does not match its course-part map.");
      }
      queueCourseIds.add(course.id);
      queueCourses.push(course);
    }
  }
  if (typeof savedCourseCount !== "number" || savedCourseCount !== queueCourseIds.size || index2.coursePartById.size !== queueCourseIds.size) {
    throw new Error("Medical workspace index course count is incomplete.");
  }
  return queueCourses;
}
function isRelevantLesson(lesson, courseIds, programIds) {
  if (lesson.courseIds?.length) {
    return lesson.courseIds.some((courseId) => courseIds.has(courseId));
  }
  return Boolean(lesson.programIds?.some((programId) => programIds.has(programId)));
}
function selectWorkspaceDocuments(catalog, selected, selectedLessons) {
  const documentIds = /* @__PURE__ */ new Set([
    ...selected.pdfIds ?? [],
    ...selectedLessons.flatMap(
      (lesson) => lesson.sourceId ? [lesson.sourceId] : []
    ),
    `syllabus-${selected.id}`
  ]);
  return {
    documentIds,
    documents: catalog.documents.filter(
      (document) => documentIds.has(document.id) || document.aliases?.some((alias) => documentIds.has(alias)) || document.courseIds?.some((courseId) => courseId === selected.id) || !document.courseIds?.length && document.programIds?.some((programId) => programId === selected.programId)
    )
  };
}
function createWorkspaceContentLoader(options = {}) {
  const dataDir = options.dataDir ?? DATA_DIR;
  const mediaReader = options.getOriginalLectures ?? getOriginalLecturesContent;
  const medicalMediaReader = options.getMedicalOriginalLectures ?? getMedicalOriginalLecturesContent;
  const jsonCache2 = /* @__PURE__ */ new Map();
  const parsedFiles = [];
  let compactDirectoryCache;
  async function readJsonFile2(relativeName) {
    const filePath = path.join(dataDir, relativeName);
    try {
      const stat = await fs.stat(filePath);
      const cached = jsonCache2.get(relativeName);
      const version = `${stat.mtimeMs}:${stat.size}`;
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        return { value: cached.value, version: cached.version };
      }
      const value = JSON.parse(await fs.readFile(filePath, "utf8"));
      jsonCache2.set(relativeName, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        value,
        version
      });
      parsedFiles.push(relativeName);
      return { value, version };
    } catch (error) {
      const code = error.code;
      if (code === "ENOENT") {
        throw new Error(`Required workspace content file is missing: ${relativeName}`);
      }
      throw error;
    }
  }
  async function getCompactDirectory() {
    const [baseFile, indexFile] = await Promise.all([
      readJsonFile2("catalog.json"),
      readJsonFile2("medical/catalog-index.json")
    ]);
    const version = `${baseFile.version}|${indexFile.version}`;
    const medical = parseMedicalWorkspaceIndex(indexFile.value);
    const queueFiles = await Promise.all(
      medical.queueParts.map((queuePart) => readJsonFile2(`medical/${queuePart}`))
    );
    const versionWithQueueParts = [
      version,
      ...queueFiles.map((queueFile) => queueFile.version)
    ].join("|");
    if (compactDirectoryCache?.version === versionWithQueueParts) {
      return compactDirectoryCache;
    }
    const savedCourseCount = isObject(indexFile.value) ? indexFile.value.savedCourseCount : void 0;
    const queueCourses = parseMedicalQueueCourses(
      queueFiles,
      medical,
      savedCourseCount
    );
    const catalog = mergeCatalogContent(baseFile.value, {
      ...medical.catalog,
      courses: queueCourses
    });
    compactDirectoryCache = {
      version: versionWithQueueParts,
      catalog,
      coursePartById: medical.coursePartById
    };
    return compactDirectoryCache;
  }
  async function getSelectedCourse(courseId, directory) {
    const medicalPart = directory.coursePartById.get(courseId);
    if (!medicalPart) {
      return directory.catalog.courses.find((course) => course.id === courseId);
    }
    const partFile = await readJsonFile2(`medical/${medicalPart}`);
    if (!Array.isArray(partFile.value)) {
      throw new Error(`Medical workspace part is not an array: ${medicalPart}`);
    }
    const selected = partFile.value.find(
      (course) => isObject(course) && course.id === courseId
    );
    if (!selected) {
      throw new Error(
        `Medical workspace index mapped ${courseId} to a part that does not contain it.`
      );
    }
    return normalizeCatalog({ courses: [selected] }).courses[0];
  }
  async function getDirectoryContent() {
    const [directory, medicalMedia] = await Promise.all([
      getCompactDirectory(),
      medicalMediaReader()
    ]);
    return selectCatalogDirectory(
      normalizeMedicalGeneratedHours(directory.catalog, medicalMedia)
    );
  }
  async function getCourseWorkspace(courseId, scope = "course") {
    const directory = await getCompactDirectory();
    const selectedSource = await getSelectedCourse(courseId, directory);
    if (!selectedSource) {
      return {
        catalog: { ...directory.catalog, courses: [], documents: [] },
        media: { lessons: [], sourceCoverage: [] },
        assetIndex: null,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const [media, medicalMedia] = await Promise.all([
      mediaReader(),
      medicalMediaReader()
    ]);
    const selectedNormalized = normalizeMedicalGeneratedHours(
      { ...directory.catalog, courses: [selectedSource] },
      medicalMedia
    ).courses[0];
    const queueCourses = scope === "program" ? directory.catalog.courses.filter((course) => course.programId === selectedNormalized.programId).map(
      (course) => course.id === selectedNormalized.id ? selectedNormalized : selectCourseForProgramQueue(course)
    ) : [selectedNormalized];
    const selectedLessonIds = /* @__PURE__ */ new Set([selectedNormalized.id]);
    const selectedProgramIds = /* @__PURE__ */ new Set([selectedNormalized.programId]);
    const selectedLessons = media.lessons.filter(
      (lesson) => isRelevantLesson(lesson, selectedLessonIds, selectedProgramIds)
    );
    const queueCourseIds = new Set(queueCourses.map((course) => course.id));
    const queueProgramIds = new Set(queueCourses.map((course) => course.programId));
    const queueLessons = media.lessons.filter(
      (lesson) => isRelevantLesson(lesson, queueCourseIds, queueProgramIds)
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
        documents
      },
      media: {
        ...media,
        lessons: queueLessons,
        sourceCoverage: media.sourceCoverage?.filter(
          (entry) => Boolean(entry.sourceId && documentIds.has(entry.sourceId))
        )
      },
      assetIndex: null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  return {
    getDirectoryContent,
    getCourseWorkspace,
    getDiagnostics() {
      return {
        parsedFiles: [...parsedFiles],
        aggregateMedicalCatalogPath: path.join(dataDir, "medical/catalog.json")
      };
    },
    clearCache() {
      jsonCache2.clear();
      compactDirectoryCache = void 0;
      parsedFiles.length = 0;
    }
  };
}
var DATA_DIR, workspaceContentLoader, getCompactDirectoryContent, getTargetedCourseWorkspace;
var init_workspaceContent = __esm({
  "server/workspaceContent.ts"() {
    "use strict";
    init_catalogDirectory();
    init_content();
    DATA_DIR = path.resolve(import.meta.dirname, "..", "data");
    workspaceContentLoader = createWorkspaceContentLoader();
    getCompactDirectoryContent = workspaceContentLoader.getDirectoryContent;
    getTargetedCourseWorkspace = workspaceContentLoader.getCourseWorkspace;
  }
});

// server/content.ts
import { promises as fs2 } from "node:fs";
import path2 from "node:path";
function isObject2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
async function readJsonFile(fileName) {
  const filePath = path2.join(DATA_DIR2, fileName);
  try {
    const stat = await fs2.stat(filePath);
    const cached = jsonCache.get(fileName);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return { value: cached.value, version: `${stat.mtimeMs}:${stat.size}` };
    }
    const raw = await fs2.readFile(filePath, "utf8");
    const value = JSON.parse(raw);
    jsonCache.set(fileName, { mtimeMs: stat.mtimeMs, size: stat.size, value });
    return { value, version: `${stat.mtimeMs}:${stat.size}` };
  } catch (error) {
    const code = error.code;
    if (code !== "ENOENT") {
      console.warn(
        `[Content] Unable to read ${fileName}:`,
        error instanceof Error ? error.message : error
      );
    }
    return { value: null, version: `missing:${fileName}` };
  }
}
async function readCurrentMediaManifests() {
  const [base, medical, live] = await Promise.all([
    readJsonFile("original-lectures.json"),
    readJsonFile("medical/original-lectures.json"),
    getLivePublicManifests()
  ]);
  const selected = resolveValidatedManifestSources({ base, medical }, live);
  return {
    base: { value: selected.base.value, version: selected.base.version },
    medical: {
      value: selected.medical.value,
      version: selected.medical.version
    }
  };
}
function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function mergeById(base, overlay) {
  const merged = [];
  const indexById = /* @__PURE__ */ new Map();
  for (const record of [...base, ...overlay]) {
    if (!record.id) continue;
    const index2 = indexById.get(record.id);
    if (index2 === void 0) {
      indexById.set(record.id, merged.length);
      merged.push(record);
    } else {
      const definedOverlay = Object.fromEntries(
        Object.entries(record).filter(([, value]) => value !== void 0)
      );
      merged[index2] = { ...merged[index2], ...definedOverlay };
    }
  }
  return merged;
}
function uniqueByValue(items) {
  const values = /* @__PURE__ */ new Set();
  return items.filter((item) => {
    const key = JSON.stringify(item);
    if (values.has(key)) return false;
    values.add(key);
    return true;
  });
}
function recomputeCatalogStats(catalog) {
  const documents = catalog.documents;
  const uniqueDocuments = /* @__PURE__ */ new Map();
  for (const document of documents) {
    const key = document.storageUrl || document.sourceUrl || document.id;
    if (!uniqueDocuments.has(key)) uniqueDocuments.set(key, document);
  }
  const units = catalog.courses.reduce(
    (total, course) => total + (course.unitMap?.length ?? (Array.isArray(course.units) ? course.units.length : 0)),
    0
  );
  return {
    programs: catalog.programs.length,
    courses: catalog.courses.length,
    units,
    referencePdfCopies: documents.length,
    uniqueReferencePdfs: uniqueDocuments.size,
    uniquePdfPages: [...uniqueDocuments.values()].reduce(
      (total, document) => total + (Number.isFinite(document.pages) ? document.pages : 0),
      0
    ),
    lectureEntries: catalog.courses.reduce(
      (total, course) => total + (course.lectures?.length ?? 0),
      0
    )
  };
}
function mergeCatalogContent(baseValue, medicalValue) {
  const base = normalizeCatalog(baseValue);
  const medical = normalizeCatalog(medicalValue);
  const courses = mergeById(base.courses, medical.courses);
  const courseCounts = /* @__PURE__ */ new Map();
  for (const course of courses) {
    courseCounts.set(
      course.programId,
      (courseCounts.get(course.programId) ?? 0) + 1
    );
  }
  const merged = {
    programs: mergeById(base.programs, medical.programs).map((program) => ({
      ...program,
      courseCount: courseCounts.get(program.id) ?? 0
    })),
    courses,
    documents: mergeById(base.documents, medical.documents),
    downloads: mergeById(base.downloads, medical.downloads),
    productionOrder: uniqueByValue([
      ...base.productionOrder ?? [],
      ...medical.productionOrder ?? []
    ]),
    credentialNotice: medical.credentialNotice || base.credentialNotice,
    medicalSchool: medical.medicalSchool ?? base.medicalSchool
  };
  return { ...merged, stats: recomputeCatalogStats(merged) };
}
function mergeOriginalLecturesContent(baseValue, medicalValue) {
  const base = normalizeOriginalLectures(baseValue);
  const medical = normalizeOriginalLectures(medicalValue);
  const sourceCoverage = [...base.sourceCoverage ?? []];
  const coverageIndex = /* @__PURE__ */ new Map();
  sourceCoverage.forEach((entry, index2) => {
    if (entry.sourceId) coverageIndex.set(entry.sourceId, index2);
  });
  for (const entry of medical.sourceCoverage ?? []) {
    const sourceId = entry.sourceId;
    const index2 = sourceId ? coverageIndex.get(sourceId) : void 0;
    if (index2 === void 0) {
      if (sourceId) coverageIndex.set(sourceId, sourceCoverage.length);
      sourceCoverage.push(entry);
    } else {
      sourceCoverage[index2] = { ...sourceCoverage[index2], ...entry };
    }
  }
  return {
    lessons: mergeById(base.lessons, medical.lessons),
    sourceCoverage,
    productionState: {
      baseProgrammes: base.productionState ?? null,
      medicalSchool: medical.productionState ?? null
    },
    notes: uniqueByValue([...asArray(base.notes), ...asArray(medical.notes)])
  };
}
function normalizeCatalog(value) {
  if (!isObject2(value)) return emptyCatalog();
  return {
    programs: asArray(value.programs).filter(isObject2).map((program) => ({
      ...program,
      id: asString(program.id),
      name: asString(program.name)
    })),
    courses: asArray(value.courses).filter(isObject2).map((course) => ({
      ...course,
      id: asString(course.id),
      programId: asString(course.programId),
      title: asString(course.title),
      lectures: Array.isArray(course.lectures) ? course.lectures.filter(isObject2).map((lecture) => ({
        ...lecture,
        id: asString(lecture.id),
        title: asString(lecture.title)
      })) : void 0,
      unitMap: Array.isArray(course.unitMap) ? course.unitMap.filter(isObject2) : void 0
    })),
    documents: asArray(value.documents).filter(isObject2).map((document) => ({
      ...document,
      id: asString(document.id),
      title: asString(document.title)
    })),
    downloads: asArray(value.downloads).filter(isObject2).map((download) => ({
      ...download,
      id: asString(download.id),
      title: asString(download.title)
    })),
    stats: isObject2(value.stats) ? value.stats : {},
    productionOrder: asArray(value.productionOrder).filter(
      (item) => typeof item === "string"
    ),
    credentialNotice: asString(value.credentialNotice),
    medicalSchool: isObject2(value.medicalSchool) ? value.medicalSchool : void 0
  };
}
function normalizeOriginalLectures(value) {
  if (!isObject2(value)) return emptyOriginalLectures();
  return {
    lessons: asArray(value.lessons).filter(isObject2).map((lesson) => ({
      ...lesson,
      id: asString(lesson.id),
      title: asString(lesson.title),
      programIds: asArray(lesson.programIds).filter(
        (item) => typeof item === "string"
      ),
      courseIds: asArray(lesson.courseIds).filter(
        (item) => typeof item === "string"
      )
    })),
    sourceCoverage: asArray(value.sourceCoverage),
    productionState: value.productionState,
    notes: asArray(value.notes)
  };
}
function isFiniteNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function hasMedicalSourceUrls(lesson) {
  return [lesson.sourceUrls, lesson.medicalSourceUrls].some(
    (urls) => Array.isArray(urls) && urls.some((url) => typeof url === "string" && url.trim().length > 0)
  );
}
function isReferenceOnlyMedicalLesson(lesson) {
  return [lesson.sourceKind, lesson.coverageStatus].some(
    (value) => typeof value === "string" && NON_INSTRUCTIONAL_MEDICAL_CONTENT.test(value)
  );
}
function qualifyingMedicalOriginalStorageKey(lesson, courseId) {
  if (!isPublishableReadyOriginal(lesson) || !lesson.courseIds?.includes(courseId) || lesson.isInstructional !== true || !hasQualifyingAutomatedMedicalReview(lesson) || lesson.humanClinicalReviewStatus !== "not performed" || !hasMedicalSourceUrls(lesson) || isReferenceOnlyMedicalLesson(lesson) || !isFiniteNonNegativeNumber(lesson.durationSeconds) || lesson.durationSeconds <= 0) {
    return null;
  }
  const storageKey = resolveManusStorageKey(lesson.videoUrl);
  return storageKey && DURABLE_VIDEO_EXTENSION.test(storageKey) ? storageKey : null;
}
function measuredMedicalGeneratedHours(courseId, lessons) {
  const seenLessonIds = /* @__PURE__ */ new Set();
  const seenStorageKeys = /* @__PURE__ */ new Set();
  let durationSeconds = 0;
  for (const lesson of lessons) {
    const storageKey = qualifyingMedicalOriginalStorageKey(lesson, courseId);
    if (!storageKey) continue;
    const lessonId = lesson.id.trim();
    if (lessonId && seenLessonIds.has(lessonId) || seenStorageKeys.has(storageKey)) {
      continue;
    }
    if (lessonId) seenLessonIds.add(lessonId);
    seenStorageKeys.add(storageKey);
    durationSeconds += lesson.durationSeconds;
  }
  return durationSeconds / 3600;
}
function provenExternalMedicalHours(course) {
  const metadata = getMedicalMetadata(course);
  if (isFiniteNonNegativeNumber(metadata.verifiedExternalHours)) {
    return metadata.verifiedExternalHours;
  }
  const specialtyHours = isFiniteNonNegativeNumber(
    metadata.verifiedSpecialtyHours
  ) ? metadata.verifiedSpecialtyHours : void 0;
  const foundationHours = isFiniteNonNegativeNumber(
    metadata.verifiedFoundationHours
  ) ? metadata.verifiedFoundationHours : void 0;
  return specialtyHours !== void 0 || foundationHours !== void 0 ? (specialtyHours ?? 0) + (foundationHours ?? 0) : 0;
}
function normalizeMedicalGeneratedHours(catalog, medicalMediaValue) {
  const medicalMedia = normalizeOriginalLectures(medicalMediaValue);
  return {
    ...catalog,
    courses: catalog.courses.map((course) => {
      if (!isMedicalCourse(course)) return course;
      const verifiedExternalHours = provenExternalMedicalHours(course);
      const verifiedGeneratedHours = measuredMedicalGeneratedHours(
        course.id,
        medicalMedia.lessons
      );
      const verifiedTotalHours = verifiedExternalHours + verifiedGeneratedHours;
      const targetHours = getMedicalMetadata(course).targetVideoHours;
      const hoursGap = isFiniteNonNegativeNumber(targetHours) ? Math.max(0, targetHours - verifiedTotalHours) : 0;
      return {
        ...course,
        verifiedGeneratedHours,
        verifiedTotalHours,
        // The derived actual gap supersedes a raw curriculum declaration.
        hoursGap,
        ...course.directoryMedicalValidation?.lectureEvidenceValid !== void 0 ? {
          directoryMedicalValidation: {
            ...course.directoryMedicalValidation,
            isReady: course.directoryMedicalValidation.issues.length === 0 && course.directoryMedicalValidation.lectureEvidenceValid && course.directoryMedicalValidation.unknownDurationCount === 0 && (course.directoryMedicalValidation.hasExternalLectureEvidence || verifiedGeneratedHours > 0) && isFiniteNonNegativeNumber(targetHours) && verifiedTotalHours >= targetHours
          }
        } : {}
      };
    })
  };
}
async function getOriginalLecturesContent() {
  const media = await readCurrentMediaManifests();
  return projectPublicMediaManifest(
    mergeOriginalLecturesContent(media.base.value, media.medical.value)
  );
}
async function getMedicalOriginalLecturesContent() {
  const media = await readCurrentMediaManifests();
  return projectPublicMediaManifest(media.medical.value);
}
async function getPublicContentSnapshot() {
  const { getCompactDirectoryContent: getCompactDirectoryContent2 } = await Promise.resolve().then(() => (init_workspaceContent(), workspaceContent_exports));
  const [catalog, media] = await Promise.all([
    getCompactDirectoryContent2(),
    getOriginalLecturesContent()
  ]);
  return {
    catalog,
    media,
    assetIndex: null,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function resolveManusStorageKey(address) {
  if (typeof address !== "string" || !address.startsWith("/manus-storage/"))
    return null;
  try {
    const base = "https://manifest-storage.invalid";
    const parsed = new URL(address, base);
    if (parsed.origin !== base || !parsed.pathname.startsWith("/manus-storage/") || parsed.search || parsed.hash) {
      return null;
    }
    const key = decodeURIComponent(
      parsed.pathname.slice("/manus-storage/".length)
    );
    if (!key || !/^[\x21-\x7e]+$/.test(key) || key.split("/").some((segment) => segment === "." || segment === "..")) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}
function getInlineLessonTranscript(lessonId, media) {
  const lesson = media.lessons.find((item) => item.id === lessonId);
  if (!lesson || typeof lesson.transcript !== "string" || !lesson.transcript.trim()) {
    return null;
  }
  return {
    status: "ready",
    transcript: lesson.transcript,
    title: lesson.title
  };
}
async function getLessonTranscript(lessonId) {
  const media = await getOriginalLecturesContent();
  const inlineTranscript = getInlineLessonTranscript(lessonId, media);
  if (inlineTranscript) return inlineTranscript;
  const lesson = media.lessons.find((item) => item.id === lessonId);
  if (!lesson) return { status: "unavailable", transcript: "" };
  if (!lesson.transcriptUrl)
    return {
      status: "unavailable",
      transcript: "",
      title: lesson.title
    };
  const storageKey = resolveManusStorageKey(lesson.transcriptUrl);
  if (!storageKey) {
    console.warn(
      "[Content] Transcript URL is not a stable storage path for lesson",
      lessonId
    );
    return {
      status: "unavailable",
      transcript: "",
      title: lesson.title
    };
  }
  const publicTranscriptUrl = getPublicAssetUrl(lesson.transcriptUrl);
  try {
    const requestOptions = {
      signal: AbortSignal.timeout(12e3),
      headers: { Accept: "text/markdown, text/plain, text/vtt" }
    };
    let response;
    try {
      const signedUrl = await storageGetSignedUrl(storageKey);
      response = await fetch(signedUrl, requestOptions);
      if (!response.ok)
        throw new Error(`Signed transcript request failed (${response.status})`);
    } catch (signedError) {
      if (!publicTranscriptUrl) throw signedError;
      response = await fetch(publicTranscriptUrl, requestOptions);
      if (!response.ok)
        throw new Error(`Public transcript request failed (${response.status})`);
    }
    const transcript = (await response.text()).slice(0, 2e6);
    return transcript.trim() ? { status: "ready", transcript, title: lesson.title } : { status: "unavailable", transcript: "", title: lesson.title };
  } catch (error) {
    console.warn(
      "[Content] Transcript unavailable for lesson",
      lessonId,
      error instanceof Error ? error.message : error
    );
    return {
      status: "unavailable",
      transcript: "",
      title: lesson.title
    };
  }
}
function sendSnapshotPart(part) {
  return async (_req, res) => {
    const { getCompactDirectoryContent: getCompactDirectoryContent2 } = await Promise.resolve().then(() => (init_workspaceContent(), workspaceContent_exports));
    const content = part === "catalog" ? await getCompactDirectoryContent2() : part === "media" ? await getOriginalLecturesContent() : (await readJsonFile("asset-index.json")).value;
    res.set("Cache-Control", "no-store").json(content);
  };
}
function registerContentRoutes(app2) {
  app2.get("/api/content/catalog", sendSnapshotPart("catalog"));
  app2.get("/api/content/media", sendSnapshotPart("media"));
  app2.get("/api/content/asset-index", sendSnapshotPart("assetIndex"));
  app2.get("/api/content/snapshot", async (_req, res) => {
    res.set("Cache-Control", "no-store").json(await getPublicContentSnapshot());
  });
}
var DATA_DIR2, jsonCache, DURABLE_VIDEO_EXTENSION, NON_INSTRUCTIONAL_MEDICAL_CONTENT;
var init_content = __esm({
  "server/content.ts"() {
    "use strict";
    init_publicMedia();
    init_catalog();
    init_medical();
    init_publicContentFeed();
    init_storage();
    init_publicAssetOrigin();
    DATA_DIR2 = path2.resolve(import.meta.dirname, "..", "data");
    jsonCache = /* @__PURE__ */ new Map();
    DURABLE_VIDEO_EXTENSION = /\.(mp4|webm|ogg|ogv|m4v)$/i;
    NON_INSTRUCTIONAL_MEDICAL_CONTENT = /(?:^|[\s_-])(syllabus|orientation|administrative)(?:$|[\s_-])|reference[\s_-]*only/i;
  }
});

// server/vercelApp.ts
init_content();
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "webdev_app_session";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/routers.ts
init_content();
init_workspaceContent();
import { z as z2 } from "zod";

// server/db.ts
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import {
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var studyProgress = mysqlTable(
  "studyProgress",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: varchar("courseId", { length: 160 }).notNull(),
    lessonId: varchar("lessonId", { length: 200 }).notNull(),
    status: mysqlEnum("status", ["not_started", "in_progress", "complete"]).notNull().default("not_started"),
    positionSeconds: int("positionSeconds").notNull().default(0),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [
    uniqueIndex("studyProgress_user_course_lesson_unique").on(
      table.userId,
      table.courseId,
      table.lessonId
    ),
    index("studyProgress_user_updated_idx").on(table.userId, table.updatedAt)
  ]
);
var studyNotes = mysqlTable(
  "studyNotes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: varchar("courseId", { length: 160 }).notNull(),
    content: text("content").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [
    uniqueIndex("studyNotes_user_course_unique").on(
      table.userId,
      table.courseId
    ),
    index("studyNotes_user_updated_idx").on(table.userId, table.updatedAt)
  ]
);
var publicContentManifests = mysqlTable("publicContentManifests", {
  manifestType: varchar("manifestType", { length: 16 }).primaryKey(),
  manifestJson: longtext("manifestJson").notNull(),
  manifestSha256: varchar("manifestSha256", { length: 64 }).notNull(),
  manifestBytes: int("manifestBytes", { unsigned: true }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// server/db.ts
init_env();
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function listStudyProgress(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(studyProgress).where(eq(studyProgress.userId, userId)).orderBy(desc(studyProgress.updatedAt));
}
async function saveStudyProgress(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const updatedAt = /* @__PURE__ */ new Date();
  await db.insert(studyProgress).values(input).onDuplicateKeyUpdate({
    set: {
      status: input.status,
      positionSeconds: input.positionSeconds,
      updatedAt
    }
  });
  const [saved] = await db.select().from(studyProgress).where(
    and(
      eq(studyProgress.userId, input.userId),
      eq(studyProgress.courseId, input.courseId),
      eq(studyProgress.lessonId, input.lessonId)
    )
  ).limit(1);
  if (!saved) throw new Error("Progress save could not be confirmed");
  return saved;
}
async function listStudyNotes(userId) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(studyNotes).where(eq(studyNotes.userId, userId)).orderBy(desc(studyNotes.updatedAt));
}
async function saveStudyNote(input) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const updatedAt = /* @__PURE__ */ new Date();
  await db.insert(studyNotes).values(input).onDuplicateKeyUpdate({
    set: { content: input.content, updatedAt }
  });
  const [saved] = await db.select().from(studyNotes).where(
    and(
      eq(studyNotes.userId, input.userId),
      eq(studyNotes.courseId, input.courseId)
    )
  ).limit(1);
  if (!saved) throw new Error("Note save could not be confirmed");
  return saved;
}

// server/_core/cookies.ts
function getSessionCookieOptions(_req) {
  return { httpOnly: true, path: "/", sameSite: "none", secure: true };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
var progressInput = z2.object({
  courseId: z2.string().trim().min(1).max(160),
  lessonId: z2.string().trim().min(1).max(200),
  status: z2.enum(["not_started", "in_progress", "complete"]),
  positionSeconds: z2.number().finite().min(0).max(31536e3)
});
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  content: router({
    // Mtime-aware content readers make incoming manifest updates visible without reparsing unchanged files.
    snapshot: publicProcedure.query(() => getPublicContentSnapshot()),
    catalog: publicProcedure.query(() => getCompactDirectoryContent()),
    media: publicProcedure.query(() => getOriginalLecturesContent()),
    workspace: publicProcedure.input(
      z2.object({
        courseId: z2.string().trim().min(1).max(160),
        scope: z2.enum(["course", "program"]).default("course")
      })
    ).query(
      ({ input }) => getTargetedCourseWorkspace(input.courseId, input.scope)
    ),
    transcript: publicProcedure.input(z2.object({ lessonId: z2.string().trim().min(1).max(200) })).query(({ input }) => getLessonTranscript(input.lessonId))
  }),
  study: router({
    progress: router({
      // The scope only separates browser query-cache entries; the server always scopes by ctx.user.id.
      list: protectedProcedure.input(z2.object({ scope: z2.number().int().positive() })).query(({ ctx }) => listStudyProgress(ctx.user.id)),
      upsert: protectedProcedure.input(progressInput).mutation(async ({ ctx, input }) => {
        return saveStudyProgress({
          ...input,
          userId: ctx.user.id,
          positionSeconds: Math.floor(input.positionSeconds)
        });
      })
    }),
    notes: router({
      // The scope only separates browser query-cache entries; the server always scopes by ctx.user.id.
      list: protectedProcedure.input(z2.object({ scope: z2.number().int().positive() })).query(({ ctx }) => listStudyNotes(ctx.user.id)),
      upsert: protectedProcedure.input(
        z2.object({
          courseId: z2.string().trim().min(1).max(160),
          content: z2.string().max(5e4)
        })
      ).mutation(async ({ ctx, input }) => {
        return saveStudyNote({ ...input, userId: ctx.user.id });
      })
    })
  })
});

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
init_env();
var isNonEmptyString3 = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: MANUS_OAUTH_API_URL is not configured! Set MANUS_OAUTH_API_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) throw new Error("MANUS_JWT_SECRET is unavailable");
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString3(openId) || (!isNonEmptyString3(appId) || appId !== ENV.appId) || typeof name !== "string") {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken && req.path.startsWith("/api/scheduled/")) {
      const ticket = cookies.get("app_session_id");
      const identity = await this.verifySession(ticket);
      if (identity?.openId.startsWith(CRON_OPEN_ID_PREFIX)) sessionToken = ticket;
    }
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/publicConfig.ts
function publicPlatformConfig(env = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? ""
  };
}
function isManusLoginConfigured(env = process.env) {
  const { projectId, oauthPortalUrl } = publicPlatformConfig(env);
  if (!projectId.trim() || !oauthPortalUrl.trim()) return false;
  try {
    const parsed = new URL(oauthPortalUrl);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
function publicPlatformScript(env = process.env) {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/vercelApp.ts
init_publicAssetOrigin();
var app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/platform/config.js", (_req, res) => {
  res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
});
registerPublicAssetRedirect(app);
registerContentRoutes(app);
if (isManusLoginConfigured()) registerOAuthRoutes(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
app.use((req, res) => {
  const apiOrMedia = req.path.startsWith("/api/") || req.path.startsWith("/manus-storage/");
  res.status(404).json({ error: apiOrMedia ? "Not found" : "API route not found" });
});
var vercelApp_default = app;
export {
  vercelApp_default as default
};
