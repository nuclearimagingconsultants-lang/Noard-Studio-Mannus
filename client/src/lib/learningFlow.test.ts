import { describe, expect, it } from "vitest";
import type {
  CourseRecord,
  DocumentRecord,
  OriginalLesson,
} from "../../../shared/catalog";
import type { QueueItem } from "./queue";
import {
  chooseQueueItem,
  courseSourceDocuments,
  isOriginalLessonRelevantToCourse,
  originalLessonLabel,
  parseLearningLaunch,
} from "./learningFlow";

const course: CourseRecord = {
  id: "AI-01",
  programId: "ai",
  title: "Foundations",
  pdfIds: ["assigned"],
};
const queue: QueueItem[] = [
  {
    queueId: "original:one",
    lessonId: "one",
    courseId: "AI-01",
    title: "One",
    url: "/one.mp4",
    source: "original",
    isReady: true,
  },
  {
    queueId: "external:two",
    lessonId: "two",
    courseId: "AI-02",
    title: "Two",
    url: "https://youtube.com/watch?v=two",
    source: "university",
    isReady: true,
  },
];

describe("connected learning flow helpers", () => {
  it("only recognizes explicit programme actions as autoplay launches", () => {
    expect(
      parseLearningLaunch("?scope=program&source=original&autoplay=1")
    ).toEqual({ scope: "program", filter: "original", autoplay: true });
    expect(
      parseLearningLaunch("?scope=course&source=university&autoplay=1")
    ).toEqual({ scope: "course", filter: "university", autoplay: false });
    expect(parseLearningLaunch("?scope=program&source=unavailable")).toEqual({
      scope: "program",
      filter: "all",
      autoplay: false,
    });
  });

  it("keeps an eligible selected lesson when a refreshed queue gains new items", () => {
    expect(chooseQueueItem(queue, "external:two", [])?.queueId).toBe(
      "external:two"
    );
  });

  it("restores the newest unfinished eligible lesson before defaulting to the first queue item", () => {
    expect(
      chooseQueueItem(queue, undefined, [
        {
          courseId: "AI-01",
          lessonId: "one",
          status: "in_progress",
          positionSeconds: 44,
          updatedAt: "2026-10-06T10:00:00.000Z",
        },
        {
          courseId: "AI-02",
          lessonId: "two",
          status: "in_progress",
          positionSeconds: 11,
          updatedAt: "2026-10-07T10:00:00.000Z",
        },
      ])?.queueId
    ).toBe("external:two");
  });

  it("uses program relevance only for lessons without explicit course assignments", () => {
    const explicitlyElsewhere: OriginalLesson = {
      id: "other",
      title: "Other",
      programIds: ["ai"],
      courseIds: ["AI-02"],
    };
    const programOnly: OriginalLesson = {
      id: "fallback",
      title: "Fallback",
      programIds: ["ai"],
    };
    expect(isOriginalLessonRelevantToCourse(explicitlyElsewhere, course)).toBe(
      false
    );
    expect(isOriginalLessonRelevantToCourse(programOnly, course)).toBe(true);
  });

  it("includes the course syllabus and does not leak explicitly assigned programme PDFs", () => {
    const documents: DocumentRecord[] = [
      {
        id: "assigned",
        title: "Assigned",
        courseIds: ["AI-01"],
        storageUrl: "/assigned.pdf",
      },
      {
        id: "other-course",
        title: "Other",
        programIds: ["ai"],
        courseIds: ["AI-02"],
        storageUrl: "/other.pdf",
      },
      {
        id: "program-only",
        title: "Program reference",
        programIds: ["ai"],
        storageUrl: "/reference.pdf",
      },
    ];
    const withSyllabus = { ...course, syllabusUrl: "/syllabus.pdf" };
    expect(
      courseSourceDocuments(documents, withSyllabus).map(
        document => document.id
      )
    ).toEqual(["syllabus-AI-01", "assigned", "program-only"]);
  });

  it("adds only the active original source despite legacy document mappings", () => {
    const documents: DocumentRecord[] = [
      { id: "assigned", title: "Assigned", courseIds: ["AI-01"] },
      { id: "active-source", title: "Active source", courseIds: ["AI-02"] },
      { id: "other-course", title: "Other", courseIds: ["AI-02"] },
    ];
    expect(
      courseSourceDocuments(documents, course, "active-source").map(
        document => document.id
      )
    ).toEqual(["assigned", "active-source"]);
  });

  it("does not describe orientations and references as substantive lessons", () => {
    expect(
      originalLessonLabel({ coverageStatus: "orientation_only" })
    ).toContain("orientation");
    expect(originalLessonLabel({ coverageStatus: "reference_only" })).toContain(
      "reference"
    );
  });

  it("keeps medical audit and clinician-review boundaries visible in lesson labels", () => {
    expect(
      originalLessonLabel({
        sourceKind: "medical_instruction",
        medicalSourceReviewStatus: "unreviewed_no_automated_source_audit",
      })
    ).toContain("source audit not passed");
    const checked = originalLessonLabel({
      sourceKind: "medical_instruction",
      medicalSourceReviewStatus: "automated_source_review_passed",
    });
    expect(checked).toContain("automated source check passed");
    expect(checked).toContain("not clinician-reviewed");

    const assets = {
      mp4: "a".repeat(64),
      vtt: "b".repeat(64),
      transcript: "c".repeat(64),
    };
    expect(
      originalLessonLabel({
        sourceKind: "medical_instruction",
        medicalSourceReviewStatus: "passed_automated_source_check",
        scriptSha256: "d".repeat(64),
        visualSha256: "e".repeat(64),
        evidenceSelectionSha256: "f".repeat(64),
        renderContentSha256: "1".repeat(64),
        localAssetSha256: assets,
        uploadedAssetSha256: assets,
      })
    ).toContain("automated source check passed");
    expect(
      originalLessonLabel({
        sourceKind: "medical_instruction",
        medicalSourceReviewStatus: "passed_automated_source_check",
      })
    ).toContain("source audit not passed");
  });
});
