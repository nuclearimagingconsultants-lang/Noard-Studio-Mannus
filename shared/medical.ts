import type {
  CourseRecord,
  MedicalDirectoryValidation,
  MedicalCourseMetadata,
  MedicalPracticeQuestion,
  OriginalLesson,
} from "./catalog";

const MEDICAL_KEYS = [
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
  "practiceQuestions",
] as const;

type MedicalKey = (typeof MEDICAL_KEYS)[number];
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function getDirectoryMedicalValidation(
  course: CourseRecord
): MedicalDirectoryValidation | undefined {
  const value = course.directoryMedicalValidation;
  if (!isRecord(value) || value.source !== "full-catalog") return undefined;
  if (
    !Array.isArray(value.issues) ||
    !value.issues.every(isNonEmptyString) ||
    typeof value.isReady !== "boolean" ||
    !isNonNegativeNumber(value.unknownDurationCount) ||
    !Number.isInteger(value.unknownDurationCount)
  ) {
    return undefined;
  }
  return value as MedicalDirectoryValidation;
}

function readOptionalNumber(value: unknown): number | undefined {
  return isNonNegativeNumber(value) ? value : undefined;
}

const AUTOMATED_MEDICAL_SOURCE_REVIEW = "automated_source_review_passed";
const PERFORMED_AUTOMATED_SOURCE_CHECK = "passed_automated_source_check";
const SHA256 = /^[a-f0-9]{64}$/;
const REQUIRED_DELIVERY_ASSETS = ["mp4", "vtt", "transcript"] as const;

function hasExactSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256.test(value);
}

function hasExactDeliveryAssetHashes(
  value: unknown
): value is Record<(typeof REQUIRED_DELIVERY_ASSETS)[number], string> {
  return (
    isRecord(value) &&
    REQUIRED_DELIVERY_ASSETS.every(key => hasExactSha256(value[key]))
  );
}

/**
 * Old corrected pilots retain their documented canonical source-review status.
 * The new producer's alias is accepted only when its exact source-script,
 * render, evidence, and matching local/uploaded delivery hashes are present.
 * This gate deliberately says nothing about human clinical review.
 */
export function hasQualifyingAutomatedMedicalReview(
  lesson: Pick<
    OriginalLesson,
    | "medicalSourceReviewStatus"
    | "scriptSha256"
    | "visualSha256"
    | "evidenceSelectionSha256"
    | "renderContentSha256"
    | "localAssetSha256"
    | "uploadedAssetSha256"
  >
): boolean {
  if (lesson.medicalSourceReviewStatus === AUTOMATED_MEDICAL_SOURCE_REVIEW) {
    return true;
  }
  if (lesson.medicalSourceReviewStatus !== PERFORMED_AUTOMATED_SOURCE_CHECK) {
    return false;
  }
  const localAssetSha256 = lesson.localAssetSha256;
  const uploadedAssetSha256 = lesson.uploadedAssetSha256;
  if (
    !hasExactSha256(lesson.scriptSha256) ||
    !hasExactSha256(lesson.visualSha256) ||
    !hasExactSha256(lesson.evidenceSelectionSha256) ||
    !hasExactSha256(lesson.renderContentSha256) ||
    !hasExactDeliveryAssetHashes(localAssetSha256) ||
    !hasExactDeliveryAssetHashes(uploadedAssetSha256)
  ) {
    return false;
  }
  return REQUIRED_DELIVERY_ASSETS.every(
    key => localAssetSha256[key] === uploadedAssetSha256[key]
  );
}

/**
 * Medical source packets may use either the documented top-level course fields or
 * a `medical` object. Top-level values take precedence; malformed values are kept
 * visible to validation rather than coerced into a completed-looking record.
 */
export function getMedicalMetadata(
  course: CourseRecord
): MedicalCourseMetadata {
  const nested = isRecord(course.medical) ? course.medical : {};
  const direct = Object.fromEntries(
    MEDICAL_KEYS.flatMap(key => {
      const value = course[key as keyof CourseRecord];
      return value === undefined ? [] : [[key, value]];
    })
  );
  return { ...nested, ...direct } as MedicalCourseMetadata;
}

export function isMedicalCourse(course: CourseRecord): boolean {
  return (
    course.programId === "med" ||
    isRecord(course.medical) ||
    isNonEmptyString(course.family) ||
    isNonEmptyString(course.trackType)
  );
}

export type MedicalHours = {
  targetHours?: number;
  /** Backward-compatible alias for the derived verified total. */
  verifiedHours?: number;
  verifiedExternalHours?: number;
  verifiedGeneratedHours?: number;
  verifiedTotalHours?: number;
  verifiedSpecialtyHours?: number;
  verifiedFoundationHours?: number;
  calculatedGapHours?: number;
  declaredGapHours?: number;
  unknownDurationCount: number;
};

/**
 * Uses the verified external total when supplied. The specialty/foundation
 * breakdown is a fallback only when that total is absent, so it cannot
 * double-count shared outside recordings. The content layer supplies
 * verifiedGeneratedHours only after it measures and validates the current
 * medical-original manifest; clip plans and declared raw generated totals are
 * deliberately never used here.
 */
export function summarizeMedicalHours(course: CourseRecord): MedicalHours {
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
  const hasBreakdown =
    verifiedSpecialtyHours !== undefined ||
    verifiedFoundationHours !== undefined;
  const verifiedExternalHours =
    declaredExternalHours ??
    (hasBreakdown
      ? (verifiedSpecialtyHours ?? 0) + (verifiedFoundationHours ?? 0)
      : undefined);
  const verifiedGeneratedHours = readOptionalNumber(
    metadata.verifiedGeneratedHours
  );
  // verifiedTotalHours is intentionally recomputed from components. This avoids
  // treating a raw curriculum's declared generated/combined total as evidence.
  const hasMeasuredComponents =
    verifiedExternalHours !== undefined || verifiedGeneratedHours !== undefined;
  const verifiedTotalHours = hasMeasuredComponents
    ? (verifiedExternalHours ?? 0) + (verifiedGeneratedHours ?? 0)
    : undefined;
  const targetHours = readOptionalNumber(metadata.targetVideoHours);
  return {
    targetHours,
    verifiedHours: verifiedTotalHours,
    verifiedExternalHours,
    verifiedGeneratedHours,
    verifiedTotalHours,
    verifiedSpecialtyHours,
    verifiedFoundationHours,
    calculatedGapHours:
      targetHours !== undefined && verifiedTotalHours !== undefined
        ? Math.max(0, targetHours - verifiedTotalHours)
        : undefined,
    declaredGapHours: readOptionalNumber(metadata.hoursGap),
    unknownDurationCount:
      directoryValidation?.unknownDurationCount ??
      (Array.isArray(metadata.unknownDurationItems)
        ? metadata.unknownDurationItems.length
        : 0),
  };
}

function optionIds(question: MedicalPracticeQuestion): string[] {
  return Array.isArray(question.options)
    ? question.options
        .map(option => (isRecord(option) ? option.id : undefined))
        .filter(isNonEmptyString)
    : [];
}

export function validatePracticeQuestion(question: unknown): string[] {
  if (!isRecord(question)) return ["Question must be an object."];
  const issues: string[] = [];
  if (!isNonEmptyString(question.id)) issues.push("Question ID is missing.");
  if (!isNonEmptyString(question.stem))
    issues.push("Question stem is missing.");
  if (!Array.isArray(question.options) || question.options.length < 2) {
    issues.push("Question requires at least two answer choices.");
  }
  const ids = optionIds(question as MedicalPracticeQuestion);
  if (
    ids.length !==
    (Array.isArray(question.options) ? question.options.length : 0)
  ) {
    issues.push("Every answer choice needs a non-empty ID.");
  }
  if (new Set(ids).size !== ids.length) {
    issues.push("Answer choice IDs must be unique.");
  }
  if (
    !isNonEmptyString(question.correctOptionId) ||
    !ids.includes(question.correctOptionId)
  ) {
    issues.push("The correct option must identify one listed choice.");
  }
  if (!isNonEmptyString(question.rationale))
    issues.push("A source-cited rationale is missing.");
  if (
    !Array.isArray(question.sourceUrls) ||
    question.sourceUrls.length === 0 ||
    !question.sourceUrls.every(isNonEmptyString)
  ) {
    issues.push("At least one source URL is required for the rationale.");
  }
  if (!isNonEmptyString(question.domain))
    issues.push("Sampled domain is missing.");
  if (typeof question.fictionalCase !== "boolean") {
    issues.push("Question must state whether its case is fictional.");
  }
  return issues;
}

export type PracticeScore = {
  validQuestionCount: number;
  attemptedCount: number;
  correctCount: number;
  invalidQuestionIds: string[];
};

/** Scores only structurally valid, original practice items; it is not a board predictor. */
export function scorePracticeQuestions(
  questions: unknown,
  answers: Record<string, string | undefined>
): PracticeScore {
  const questionList = Array.isArray(questions) ? questions : [];
  const invalidQuestionIds: string[] = [];
  let validQuestionCount = 0;
  let attemptedCount = 0;
  let correctCount = 0;
  for (const candidate of questionList) {
    const issues = validatePracticeQuestion(candidate);
    if (!isRecord(candidate) || issues.length) {
      if (isRecord(candidate) && isNonEmptyString(candidate.id)) {
        invalidQuestionIds.push(candidate.id);
      }
      continue;
    }
    validQuestionCount += 1;
    const questionId = candidate.id;
    if (!isNonEmptyString(questionId)) {
      invalidQuestionIds.push("unknown-question");
      validQuestionCount -= 1;
      continue;
    }
    const answer = answers[questionId];
    if (!answer) continue;
    attemptedCount += 1;
    if (answer === candidate.correctOptionId) correctCount += 1;
  }
  return {
    validQuestionCount,
    attemptedCount,
    correctCount,
    invalidQuestionIds,
  };
}

function validMedicalLectures(course: CourseRecord): boolean {
  return (course.lectures ?? []).every(
    lecture =>
      isNonEmptyString(lecture.url) &&
      isNonEmptyString(lecture.sourceUrl) &&
      isNonNegativeNumber(lecture.durationSeconds) &&
      lecture.durationSeconds > 0 &&
      lecture.accessVerified === true
  );
}

/**
 * A course cannot be called ready merely because it has a 36-hour target or clip
 * plan. It must have a valid schema, measured/accessible evidence for every listed
 * outside lecture, no unknown-duration item, and a verified combined total meeting
 * the target. A server-normalized qualifying original total may supply the evidence
 * when no outside lecture is listed.
 */
export function isMedicalCourseReady(course: CourseRecord): boolean {
  const directoryValidation = getDirectoryMedicalValidation(course);
  if (isMedicalCourse(course) && directoryValidation) {
    return directoryValidation.isReady;
  }
  const hours = summarizeMedicalHours(course);
  const hasMeasuredHourEvidence = Boolean(
    course.lectures?.length || (hours.verifiedGeneratedHours ?? 0) > 0
  );
  return Boolean(
    validateMedicalCourse(course).length === 0 &&
      hours.targetHours !== undefined &&
      hours.verifiedTotalHours !== undefined &&
      hours.verifiedTotalHours >= hours.targetHours &&
      hours.unknownDurationCount === 0 &&
      hasMeasuredHourEvidence &&
      validMedicalLectures(course)
  );
}

export function validateMedicalCourse(course: CourseRecord): string[] {
  if (!isMedicalCourse(course)) return [];
  const directoryValidation = getDirectoryMedicalValidation(course);
  if (directoryValidation) return [...directoryValidation.issues];
  const metadata = getMedicalMetadata(course);
  const issues: string[] = [];
  for (const field of [
    "family",
    "trackType",
    "boardEligibilityNotice",
  ] as const) {
    if (!isNonEmptyString(metadata[field])) issues.push(`${field} is missing.`);
  }
  if (
    !isNonEmptyString(metadata.boardStatus) &&
    !(
      isRecord(metadata.boardStatus) &&
      Object.values(metadata.boardStatus).some(isNonEmptyString)
    )
  ) {
    issues.push(
      "boardStatus needs a readable text or structured source record."
    );
  }
  if (
    !Array.isArray(metadata.boardNames) ||
    !metadata.boardNames.length ||
    !metadata.boardNames.every(isNonEmptyString)
  ) {
    issues.push(
      "boardNames must contain at least one board label or an explicit non-board label."
    );
  }
  if (
    !isNonNegativeNumber(metadata.targetVideoHours) ||
    metadata.targetVideoHours < 36
  ) {
    issues.push("targetVideoHours must be a finite number of at least 36.");
  }
  for (const field of [
    "verifiedExternalHours",
    "verifiedGeneratedHours",
    "verifiedTotalHours",
    "verifiedSpecialtyHours",
    "verifiedFoundationHours",
    "hoursGap",
  ] as const) {
    if (
      metadata[field] !== undefined &&
      !isNonNegativeNumber(metadata[field])
    ) {
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
    metadata.officialProgrammes.forEach((programme, index) => {
      if (!isRecord(programme)) {
        issues.push(`officialProgrammes[${index}] must be an object.`);
        return;
      }
      for (const field of [
        "institution",
        "name",
        "url",
        "publicCurriculumNotes",
      ] as const) {
        if (!isNonEmptyString(programme[field])) {
          issues.push(`officialProgrammes[${index}].${field} is missing.`);
        }
      }
    });
  }
  for (const field of [
    "sourceCaveats",
    "sourceReferences",
    "originalClipPlan",
    "practiceQuestions",
  ] as const) {
    if (!Array.isArray(metadata[field]))
      issues.push(`${field} must be an array.`);
  }
  if (Array.isArray(metadata.practiceQuestions)) {
    metadata.practiceQuestions.forEach((question, index) => {
      for (const issue of validatePracticeQuestion(question)) {
        issues.push(`practiceQuestions[${index}]: ${issue}`);
      }
    });
  }
  const hours = summarizeMedicalHours(course);
  if (
    metadata.verifiedTotalHours !== undefined &&
    hours.verifiedTotalHours !== undefined &&
    Math.abs(metadata.verifiedTotalHours - hours.verifiedTotalHours) > 0.01
  ) {
    issues.push(
      "verifiedTotalHours must equal verified outside plus qualifying original hours."
    );
  }
  if (
    hours.declaredGapHours !== undefined &&
    hours.calculatedGapHours !== undefined &&
    Math.abs(hours.declaredGapHours - hours.calculatedGapHours) > 0.01
  ) {
    issues.push(
      "hoursGap does not match targetVideoHours minus verified hours."
    );
  }
  return issues;
}
