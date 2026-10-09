import { describe, expect, it } from "vitest";
import type { CourseRecord } from "./catalog";
import {
  isMedicalCourseReady,
  scorePracticeQuestions,
  summarizeMedicalHours,
  validateMedicalCourse,
} from "./medical";

const sourceQuestion = {
  id: "med-q-1",
  stem: "A fictional study prompt asks the learner to identify the supplied concept.",
  options: [
    { id: "a", text: "Option A" },
    { id: "b", text: "Option B" },
  ],
  correctOptionId: "b",
  rationale: "Option B follows the cited source's stated definition.",
  sourceUrls: ["https://example.test/source"],
  domain: "foundational concept",
  fictionalCase: true,
};

function readyCourse(): CourseRecord {
  return {
    id: "MED-TEST",
    programId: "med",
    title: "Medical test course",
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
        publicCurriculumNotes: "Public curriculum page only.",
      },
    ],
    sourceCaveats: ["Example only."],
    sourceReferences: ["https://example.test/reference"],
    originalClipPlan: [],
    practiceQuestions: [sourceQuestion],
    lectures: [
      {
        id: "med-l-1",
        title: "Measured source lecture",
        url: "https://example.test/lecture",
        sourceUrl: "https://example.test/source-page",
        durationSeconds: 129600,
        accessVerified: true,
      },
    ],
  };
}

describe("medical overlay validation", () => {
  it("keeps target, verified time, and clip planning separate", () => {
    const course = readyCourse();
    course.verifiedExternalHours = 12;
    course.verifiedSpecialtyHours = 36;
    course.originalClipPlan = [{ plannedMinutes: 1440 }];
    const hours = summarizeMedicalHours(course);
    expect(hours.verifiedHours).toBe(12);
    expect(hours.calculatedGapHours).toBe(24);
    expect(isMedicalCourseReady(course)).toBe(false);
  });

  it("aggregates server-derived original runtime with outside runtime and ignores a declared combined total", () => {
    const course = readyCourse();
    course.verifiedExternalHours = 4;
    course.verifiedGeneratedHours = 32;
    course.verifiedTotalHours = 999;
    course.hoursGap = 0;
    const hours = summarizeMedicalHours(course);
    expect(hours).toMatchObject({
      verifiedExternalHours: 4,
      verifiedGeneratedHours: 32,
      verifiedTotalHours: 36,
      verifiedHours: 36,
      calculatedGapHours: 0,
    });
    expect(validateMedicalCourse(course)).toContain(
      "verifiedTotalHours must equal verified outside plus qualifying original hours."
    );
  });

  it("allows 36 measured generated hours to support hour evidence when no outside lecture is supplied", () => {
    const course = readyCourse();
    course.verifiedExternalHours = undefined;
    course.verifiedSpecialtyHours = undefined;
    course.verifiedFoundationHours = undefined;
    course.verifiedGeneratedHours = 36;
    course.verifiedTotalHours = 36;
    course.lectures = [];
    const hours = summarizeMedicalHours(course);
    expect(hours.verifiedTotalHours).toBe(36);
    expect(hours.calculatedGapHours).toBe(0);
    expect(isMedicalCourseReady(course)).toBe(true);
  });

  it("requires every medical lecture to have a URL, duration, access, and source evidence", () => {
    const course = readyCourse();
    expect(validateMedicalCourse(course)).toEqual([]);
    expect(isMedicalCourseReady(course)).toBe(true);
    course.lectures![0]!.accessVerified = false;
    expect(isMedicalCourseReady(course)).toBe(false);
  });

  it("scores only valid original questions and rejects duplicate or unkeyed choices", () => {
    const score = scorePracticeQuestions([sourceQuestion], { "med-q-1": "b" });
    expect(score).toEqual({
      validQuestionCount: 1,
      attemptedCount: 1,
      correctCount: 1,
      invalidQuestionIds: [],
    });
    const malformed = {
      ...sourceQuestion,
      id: "broken",
      options: [
        { id: "a", text: "One" },
        { id: "a", text: "Two" },
      ],
      correctOptionId: "missing",
    };
    expect(scorePracticeQuestions([malformed], { broken: "a" })).toEqual({
      validQuestionCount: 0,
      attemptedCount: 0,
      correctCount: 0,
      invalidQuestionIds: ["broken"],
    });
  });
});
