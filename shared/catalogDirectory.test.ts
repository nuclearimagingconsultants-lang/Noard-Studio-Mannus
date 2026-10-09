import { describe, expect, it } from "vitest";
import { buildProgramQueue } from "../client/src/lib/queue";
import type { CatalogData, CourseRecord } from "./catalog";
import { selectCatalogDirectory } from "./catalogDirectory";
import {
  isMedicalCourseReady,
  summarizeMedicalHours,
  validateMedicalCourse,
} from "./medical";

const sourceQuestion = {
  id: "directory-question",
  stem: "A fictional prompt asks the learner to identify the supplied concept.",
  options: [
    { id: "a", text: "Option A" },
    { id: "b", text: "Option B" },
  ],
  correctOptionId: "b",
  rationale: "Option B follows the cited source definition.",
  sourceUrls: ["https://example.test/source"],
  domain: "foundations",
  fictionalCase: true,
};

function readyMedicalCourse(id = "MED-DIRECTORY-READY"): CourseRecord {
  return {
    id,
    programId: "med",
    title: "Directory medical course",
    objectives: [{ large: "This full curriculum field must not travel to the directory." }],
    family: "Imaging",
    trackType: "fellowship",
    boardNames: ["Example board"],
    boardStatus: "Scope only; verify official requirements independently.",
    boardEligibilityNotice: "Independent study does not establish eligibility.",
    targetVideoHours: 36,
    verifiedExternalHours: 36,
    verifiedSpecialtyHours: 30,
    verifiedFoundationHours: 6,
    hoursGap: 0,
    unknownDurationItems: [],
    clinicalTrainingNotReplaced: true,
    humanClinicalReviewStatus: "not performed",
    officialProgrammes: [
      {
        institution: "Example institution",
        name: "Example public programme",
        url: "https://example.test/programme",
        publicCurriculumNotes: "Full-record evidence that is unnecessary in a directory row.",
      },
    ],
    sourceCaveats: ["Full source caveat excluded from directory response."],
    sourceReferences: ["https://example.test/reference"],
    originalClipPlan: [{ plannedMinutes: 30 }],
    practiceQuestions: [sourceQuestion],
    lectures: [
      {
        id: "med-lecture-1",
        title: "Measured source lecture",
        url: "https://example.test/watch",
        sourceUrl: "https://example.test/source-page",
        durationSeconds: 129600,
        accessVerified: true,
        coverageNote: "Full-only source detail.",
      },
    ],
    unitMap: [
      {
        number: 1,
        text: "Image acquisition",
        coverage: "Review the supplied modalities.",
        lectureIds: ["med-lecture-1"],
        viewingSequence: ["med-lecture-1"],
        coveredTopics: ["Full-only topic map"],
      },
    ],
  };
}

function baseQueueCourse(): CourseRecord {
  return {
    id: "AI-DIRECTORY-QUEUE",
    programId: "ai",
    title: "Base programme queue course",
    lectures: [
      {
        id: "base-lecture-1",
        title: "Queue-ready outside recording",
        url: "https://example.test/base-watch",
        sourceUrl: "https://example.test/base-source",
        durationSeconds: 600,
        accessVerified: true,
        coverageNote: "Workspace-only lecture explanation.",
      },
    ],
    unitMap: [
      {
        number: 1,
        text: "Queue unit",
        coverage: "Queue coverage",
        lectureIds: ["base-lecture-1"],
        viewingSequence: ["base-lecture-1"],
        coveredTopics: ["Workspace-only detail"],
      },
    ],
  };
}

function fixture(): CatalogData {
  const incomplete = readyMedicalCourse("MED-DIRECTORY-INCOMPLETE");
  incomplete.boardEligibilityNotice = undefined;
  incomplete.unknownDurationItems = [{ id: "unknown-1" }, { id: "unknown-2" }];

  return {
    programs: [
      {
        id: "med",
        name: "Harvard:John Med",
        fullName: "Harvard:John Med — independent study",
        description: "A compact programme description.",
        guideUrl: "/manus-storage/med-guide.pdf",
        courseCount: 2,
        verifiedExternalHours: 72,
        prerequisites: ["Independent preparation"],
        schedule: "Flexible",
        capstone: "Personal synthesis",
        accessNotes: "Public sources vary.",
        limitations: "No credential is awarded.",
        credentialType: "Independent study",
        plannedStudyHours: 999,
      },
    ],
    courses: [baseQueueCourse(), readyMedicalCourse(), incomplete],
    documents: [
      {
        id: "document-1",
        title: "Reading packet",
        author: "Example author",
        relativePath: "private/full-packet.pdf",
        aliases: ["full-packet"],
        pages: 999,
        sourceUrl: "https://example.test/packet.pdf",
        licenseNote: "Read at the source.",
        programIds: ["med"],
        courseIds: ["MED-DIRECTORY-READY"],
        storageUrl: "/manus-storage/packet.pdf",
      },
    ],
    downloads: [
      {
        id: "archive",
        title: "Available library archive",
        kind: "Archive",
        url: "/manus-storage/archive.zip",
      },
    ],
    stats: { programs: 1, courses: 2, units: 2, lectureEntries: 2 },
    productionOrder: ["med"],
    credentialNotice: "Independent study only.",
    medicalSchool: {
      label: "Harvard:John Med — independent study",
      status: "research_in_progress",
      catalogueStatus: "Directory data is refreshed from source records.",
      minimumTargetVideoHoursPerSpecialty: 36,
      noAffiliationNotice: "No affiliation is implied.",
      clinicalTrainingNotice: "Study does not replace clinical training.",
      patientDataNotice: "Do not submit patient data.",
      mediaReadinessNotice: "Only measured ready media count.",
      humanClinicalReviewStatus: "not performed",
      researchGaps: ["Public-directory gaps remain explicit."],
    },
  };
}

describe("selectCatalogDirectory", () => {
  it("returns a pure directory projection with library, board, and queue fields", () => {
    const full = fixture();
    const before = JSON.stringify(full);

    const directory = selectCatalogDirectory(full);
    const course = directory.courses.find(
      item => item.id === "MED-DIRECTORY-READY"
    )!;
    const baseCourse = directory.courses.find(
      item => item.id === "AI-DIRECTORY-QUEUE"
    )!;

    expect(JSON.stringify(full)).toBe(before);
    expect(directory).not.toBe(full);
    expect(directory.productionOrder).toBeUndefined();
    expect(directory.programs[0]).toMatchObject({
      id: "med",
      guideUrl: "/manus-storage/med-guide.pdf",
      prerequisites: ["Independent preparation"],
      limitations: "No credential is awarded.",
    });
    expect(directory.programs[0]).not.toHaveProperty("plannedStudyHours");
    expect(course).toMatchObject({
      id: "MED-DIRECTORY-READY",
      syllabusUrl: undefined,
    });
    expect(course).not.toHaveProperty("lectures");
    expect(course).not.toHaveProperty("unitMap");
    expect(baseCourse).toMatchObject({
      id: "AI-DIRECTORY-QUEUE",
      lectures: [
        {
          id: "base-lecture-1",
          url: "https://example.test/base-watch",
          sourceUrl: "https://example.test/base-source",
          durationSeconds: 600,
          accessVerified: true,
        },
      ],
      unitMap: [
        {
          number: 1,
          lectureIds: ["base-lecture-1"],
          viewingSequence: ["base-lecture-1"],
        },
      ],
    });
    expect(course).not.toHaveProperty("objectives");
    expect(course).not.toHaveProperty("practiceQuestions");
    expect(course).not.toHaveProperty("sourceReferences");
    expect(baseCourse.lectures?.[0]).not.toHaveProperty("coverageNote");
    expect(baseCourse.unitMap?.[0]).not.toHaveProperty("coveredTopics");
    expect(
      buildProgramQueue(
        directory,
        { lessons: [], sourceCoverage: [] },
        "ai",
        "university"
      )
    ).toMatchObject([
      {
        courseId: "AI-DIRECTORY-QUEUE",
        lessonId: "base-lecture-1",
        url: "https://example.test/base-watch",
        sourceUrl: "https://example.test/base-source",
        durationSeconds: 600,
        unitLabel: "Unit 1",
      },
    ]);
    expect(directory.documents[0]).toMatchObject({
      id: "document-1",
      storageUrl: "/manus-storage/packet.pdf",
      programIds: ["med"],
    });
    expect(directory.documents[0]).not.toHaveProperty("relativePath");
    expect(directory.documents[0]).not.toHaveProperty("courseIds");
  });

  it("preserves genuine full-record medical validation and unknown-duration outcomes", () => {
    const directory = selectCatalogDirectory(fixture());
    const ready = directory.courses.find(
      course => course.id === "MED-DIRECTORY-READY"
    )!;
    const incomplete = directory.courses.find(
      course => course.id === "MED-DIRECTORY-INCOMPLETE"
    )!;

    expect(validateMedicalCourse(ready)).toEqual([]);
    expect(isMedicalCourseReady(ready)).toBe(true);
    expect(ready.directoryMedicalValidation).toEqual({
      source: "full-catalog",
      issues: [],
      isReady: true,
      unknownDurationCount: 0,
    });

    expect(validateMedicalCourse(incomplete)).toContain(
      "boardEligibilityNotice is missing."
    );
    expect(isMedicalCourseReady(incomplete)).toBe(false);
    expect(summarizeMedicalHours(incomplete).unknownDurationCount).toBe(2);
    expect(incomplete).not.toHaveProperty("unknownDurationItems");
    expect(incomplete.directoryMedicalValidation).toMatchObject({
      isReady: false,
      unknownDurationCount: 2,
    });
  });
});
