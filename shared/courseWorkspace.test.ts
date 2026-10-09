import { describe, expect, it } from "vitest";
import type { ContentSnapshot } from "./catalog";
import { selectCourseWorkspace } from "./courseWorkspace";

const source: ContentSnapshot = {
  catalog: {
    programs: [
      { id: "med", name: "Med" },
      { id: "ai", name: "AI" },
    ],
    courses: [
      {
        id: "MED-001",
        programId: "med",
        title: "Nuclear Medicine",
        pdfIds: ["pdf-a"],
        lectures: [
          {
            id: "outside",
            title: "Lecture",
            url: "https://example.test/video",
          },
        ],
      },
      { id: "MED-002", programId: "med", title: "Other specialty" },
      { id: "AI-001", programId: "ai", title: "Algorithms" },
    ],
    documents: [
      { id: "pdf-a", title: "Source" },
      { id: "syllabus-MED-001", title: "Syllabus" },
      { id: "other", title: "Unrelated", courseIds: ["AI-001"] },
    ],
    downloads: [],
    medicalSchool: { humanClinicalReviewStatus: "not performed" },
  },
  media: {
    lessons: [
      {
        id: "original",
        title: "Real clip",
        courseIds: ["MED-001"],
        sourceId: "pdf-a",
        captionUrl: "/manus-storage/clip.vtt",
        videoUrl: "/manus-storage/clip.mp4",
        status: "ready",
      },
      { id: "other-med", title: "Other clip", courseIds: ["MED-002"] },
      {
        id: "other-ai",
        title: "AI clip",
        courseIds: ["AI-001"],
        programIds: ["med"],
      },
    ],
    sourceCoverage: [
      { sourceId: "pdf-a", coverageStatus: "partial" },
      { sourceId: "unrelated" },
    ],
  },
  assetIndex: { large: "not needed" },
  updatedAt: "2026-10-07",
};

describe("targeted course workspace", () => {
  it("retains the exact course, existing outside lecture, original, caption and source PDFs", () => {
    const result = selectCourseWorkspace(source, "MED-001");
    expect(result.catalog.courses).toEqual([source.catalog.courses[0]]);
    expect(result.catalog.documents.map(document => document.id)).toEqual([
      "pdf-a",
      "syllabus-MED-001",
    ]);
    expect(result.media.lessons).toEqual([source.media.lessons[0]]);
    expect(result.media.sourceCoverage).toEqual([
      source.media.sourceCoverage![0],
    ]);
    expect(result.catalog.medicalSchool?.humanClinicalReviewStatus).toBe(
      "not performed"
    );
    expect(result.assetIndex).toBeNull();
    expect(source.catalog.courses).toHaveLength(3);
  });
  it("retains every requested programme course and only their relevant originals", () => {
    const result = selectCourseWorkspace(source, "MED-001", "program");
    expect(result.catalog.courses.map(course => course.id)).toEqual([
      "MED-001",
      "MED-002",
    ]);
    expect(result.media.lessons.map(lesson => lesson.id)).toEqual([
      "original",
      "other-med",
    ]);
  });
  it("keeps full selected detail and queue peers while omitting peers' large question banks", () => {
    const modified: ContentSnapshot = {
      ...source,
      catalog: {
        ...source.catalog,
        courses: source.catalog.courses.map(course => ({
          ...course,
          practiceQuestions: [
            {
              id: "full-detail",
              stem: "A fictional source-reading exercise",
              sourceUrls: ["https://example.test/source"],
              domain: "Study workflow",
              fictionalCase: true,
              options: [],
              correctOptionId: "A",
              rationale: "Full original source material",
            },
          ],
          lectures: course.lectures ?? [
            {
              id: "peer-lecture",
              title: "Peer lecture",
              url: "https://example.test/peer-video",
            },
          ],
        })),
      },
    };
    const result = selectCourseWorkspace(modified, "MED-001", "program");
    expect(result.catalog.courses[0].practiceQuestions).toEqual(
      modified.catalog.courses[0].practiceQuestions
    );
    expect(result.catalog.courses[1].practiceQuestions).toBeUndefined();
    expect(result.catalog.courses[1].lectures?.[0].id).toBe("peer-lecture");
    expect(modified.catalog.courses[1].practiceQuestions).toHaveLength(1);
  });
  it("does not manufacture a missing course and retains navigation programmes", () => {
    const result = selectCourseWorkspace(source, "NOT-A-COURSE");
    expect(result.catalog.courses).toEqual([]);
    expect(result.catalog.programs).toEqual(source.catalog.programs);
    expect(result.media.lessons).toEqual([]);
  });
});
