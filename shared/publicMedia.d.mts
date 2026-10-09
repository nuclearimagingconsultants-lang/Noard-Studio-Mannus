import type { OriginalLesson, OriginalLecturesData } from "./catalog.ts";

/** Fields that may cross the public media boundary; all other producer fields are removed. */
export type PublicOriginalLesson = Pick<
  OriginalLesson,
  | "id"
  | "title"
  | "description"
  | "sourceId"
  | "programIds"
  | "courseIds"
  | "status"
  | "sourcePages"
  | "pageCues"
  | "coverageStatus"
  | "sourceKind"
  | "isInstructional"
  | "videoUrl"
  | "captionUrl"
  | "transcriptUrl"
  | "transcript"
  | "durationSeconds"
  | "sourceUrls"
  | "medicalSourceUrls"
  | "medicalSourceReviewStatus"
  | "humanClinicalReviewStatus"
  | "scriptSha256"
  | "visualSha256"
  | "evidenceSelectionSha256"
  | "renderContentSha256"
  | "localAssetSha256"
  | "uploadedAssetSha256"
>;

export type PublicMediaManifest = Pick<
  OriginalLecturesData,
  "sourceCoverage" | "productionState"
> & {
  lessons: PublicOriginalLesson[];
};

/** True only when text has no local path, file URL, or secret/credential indicator. */
export function isSafePublicString(value: unknown): value is string;

/** True only for a query-free, traversal-free relative /manus-storage/ object path. */
export function isStableManusStoragePath(value: unknown): value is string;

/**
 * Playback readiness only. Medical counted-hour qualification remains governed
 * by the existing medical exact-review/hash gate in server/content.ts.
 */
export function isPublishableReadyOriginal(
  lesson: unknown
): boolean;

/** Strict allowlist projection for public API/feed values. */
export function projectPublicMediaManifest(value: unknown): PublicMediaManifest;

/** True only if a value already equals the strict public projection. */
export function isPublicMediaManifest(value: unknown): value is PublicMediaManifest;
