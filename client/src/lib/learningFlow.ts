import type {
  CourseRecord,
  DocumentRecord,
  OriginalLesson,
} from "@shared/catalog";
import { hasQualifyingAutomatedMedicalReview } from "@shared/medical";
import type { QueueFilter, QueueItem } from "@/lib/queue";
import type { StoredProgress } from "@/lib/studyStorage";

export type LearningLaunch = {
  scope: "course" | "program";
  filter: QueueFilter;
  autoplay: boolean;
};

/** Parses only the supported, user-facing player launch controls. */
export function parseLearningLaunch(search: string): LearningLaunch {
  const params = new URLSearchParams(search);
  const source = params.get("source");
  const filter: QueueFilter =
    source === "original" || source === "university" || source === "all"
      ? source
      : "all";
  return {
    scope: params.get("scope") === "program" ? "program" : "course",
    filter,
    autoplay:
      params.get("scope") === "program" && params.get("autoplay") === "1",
  };
}

/** Explicit course assignments win; program membership is only a fallback for unassigned lessons. */
export function isOriginalLessonRelevantToCourse(
  lesson: OriginalLesson,
  course: CourseRecord
): boolean {
  return lesson.courseIds?.length
    ? lesson.courseIds.includes(course.id)
    : Boolean(lesson.programIds?.includes(course.programId));
}

function readableManifestValue(value: string | undefined) {
  return value?.replaceAll("_", " ").replaceAll("-", " ").trim();
}

/** Labels manifest scope honestly instead of treating every ready original file as a lecture. */
export function originalLessonLabel(
  lesson:
    | Partial<
        Pick<
          OriginalLesson,
          | "coverageStatus"
          | "sourceKind"
          | "isInstructional"
          | "medicalSourceReviewStatus"
          | "scriptSha256"
          | "visualSha256"
          | "evidenceSelectionSha256"
          | "renderContentSha256"
          | "localAssetSha256"
          | "uploadedAssetSha256"
        >
      >
    | undefined
) {
  const coverage = readableManifestValue(lesson?.coverageStatus);
  const sourceKind = readableManifestValue(lesson?.sourceKind);
  if (sourceKind?.startsWith("medical")) {
    return lesson && hasQualifyingAutomatedMedicalReview(lesson)
      ? "Original medical explanation · automated source check passed · not clinician-reviewed"
      : "Original medical explanation · source audit not passed · not clinician-reviewed";
  }
  if (coverage === "orientation only" || sourceKind === "course orientation") {
    return "Original course orientation · orientation only";
  }
  if (coverage === "reference only") {
    return "Original source reference · reference only";
  }
  if (lesson?.isInstructional === false) {
    return coverage
      ? `Original source guide · ${coverage}`
      : "Original source guide · non-instructional";
  }
  return coverage
    ? `Original source-based lesson · ${coverage}`
    : "Original source-based lesson";
}

/**
 * Keeps explicitly scoped documents with their courses. A program-level document remains available
 * only when it has no explicit course assignments, and every course exposes its own syllabus.
 */
export function courseSourceDocuments(
  documents: DocumentRecord[],
  course: CourseRecord,
  activeSourceId?: string
): DocumentRecord[] {
  const syllabus: DocumentRecord | undefined = course.syllabusUrl
    ? {
        id: `syllabus-${course.id}`,
        title: `${course.title} — course syllabus`,
        storageUrl: course.syllabusUrl,
        courseIds: [course.id],
      }
    : undefined;
  const matched = documents.filter(document => {
    // An active original lesson's exact source takes precedence over legacy catalogue mappings.
    if (activeSourceId && document.id === activeSourceId) return true;
    if (course.pdfIds?.includes(document.id)) return true;
    if (document.courseIds?.length)
      return document.courseIds.includes(course.id);
    return Boolean(document.programIds?.includes(course.programId));
  });
  const unique = new Map<string, DocumentRecord>();
  for (const document of [...(syllabus ? [syllabus] : []), ...matched])
    unique.set(document.id, document);
  return [...unique.values()];
}

/** Retains an eligible selected item; otherwise restores the newest unfinished eligible lesson. */
export function chooseQueueItem(
  queue: QueueItem[],
  selectedId: string | undefined,
  progress: StoredProgress[]
): QueueItem | undefined {
  const selected = queue.find(item => item.queueId === selectedId);
  if (selected) return selected;

  const newestUnfinished = [...progress]
    .filter(
      entry =>
        entry.status !== "complete" &&
        (entry.status === "in_progress" || entry.positionSeconds > 0)
    )
    .sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    );
  for (const entry of newestUnfinished) {
    const resumed = queue.find(
      item =>
        item.courseId === entry.courseId && item.lessonId === entry.lessonId
    );
    if (resumed) return resumed;
  }
  return queue[0];
}
