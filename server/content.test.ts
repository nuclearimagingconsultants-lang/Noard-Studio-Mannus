import { describe, expect, it } from "vitest";
import {
  getInlineLessonTranscript,
  mergeCatalogContent,
  mergeOriginalLecturesContent,
  normalizeMedicalGeneratedHours,
  resolveManusStorageKey,
} from "./content";

describe("resolveManusStorageKey", () => {
  it("accepts a stable manifest storage path and preserves its object key", () => {
    expect(
      resolveManusStorageKey("/manus-storage/transcripts/lesson-one.md")
    ).toBe("transcripts/lesson-one.md");
  });

  it("rejects absolute, query-bearing, and traversal-like addresses", () => {
    expect(
      resolveManusStorageKey("https://example.test/transcript.md")
    ).toBeNull();
    expect(
      resolveManusStorageKey(
        "/manus-storage/lesson.md?redirect=https://example.test"
      )
    ).toBeNull();
    expect(resolveManusStorageKey("/manus-storage/../private.md")).toBeNull();
  });
});

describe("isolated medical overlays", () => {
  it("merges catalog collections by stable IDs and recomputes actual counts", () => {
    const catalog = mergeCatalogContent(
      {
        programs: [{ id: "ai", name: "AI" }],
        courses: [
          {
            id: "AI-01",
            programId: "ai",
            title: "Base title",
            unitMap: [{ number: 1 }, { number: 2 }],
            lectures: [{ id: "lecture-1", title: "First" }],
          },
        ],
        documents: [
          {
            id: "pdf-one",
            title: "Copy one",
            storageUrl: "/manus-storage/shared.pdf",
            pages: 5,
          },
          {
            id: "pdf-copy",
            title: "Copy two",
            storageUrl: "/manus-storage/shared.pdf",
            pages: 5,
          },
        ],
        downloads: [],
      },
      {
        programs: [{ id: "med", name: "Harvard:John Med" }],
        courses: [
          { id: "AI-01", programId: "ai", title: "Overlay title" },
          {
            id: "MED-01",
            programId: "med",
            title: "Future specialty",
            units: ["One"],
          },
        ],
        documents: [
          {
            id: "pdf-three",
            title: "Another",
            sourceUrl: "https://example.test/a.pdf",
            pages: 3,
          },
        ],
        downloads: [],
        medicalSchool: { label: "Harvard:John Med — independent study" },
      }
    );
    expect(
      catalog.programs.map((program: { id: string }) => program.id)
    ).toEqual(["ai", "med"]);
    expect(catalog.courses.map((course: { id: string }) => course.id)).toEqual([
      "AI-01",
      "MED-01",
    ]);
    expect(catalog.courses[0]?.title).toBe("Overlay title");
    expect(catalog.stats).toMatchObject({
      programs: 2,
      courses: 2,
      units: 3,
      referencePdfCopies: 3,
      uniqueReferencePdfs: 2,
      uniquePdfPages: 8,
      lectureEntries: 1,
    });
  });

  it("merges original lessons and source coverage by their manifest IDs", () => {
    const media = mergeOriginalLecturesContent(
      {
        lessons: [{ id: "shared", title: "Base", status: "planned" }],
        sourceCoverage: [{ sourceId: "source-a", title: "Base source" }],
        productionState: "blocked_model_service",
        notes: ["base note"],
      },
      {
        lessons: [
          { id: "shared", title: "Overlaid", status: "ready" },
          { id: "medical-only", title: "Medical", status: "planned" },
        ],
        sourceCoverage: [{ sourceId: "source-a", coverageStatus: "partial" }],
        productionState: { status: "research_in_progress" },
        notes: ["base note", "medical note"],
      }
    );
    expect(media.lessons.map((lesson: { id: string }) => lesson.id)).toEqual([
      "shared",
      "medical-only",
    ]);
    expect(media.lessons[0]).toMatchObject({
      title: "Overlaid",
      status: "ready",
    });
    expect(media.sourceCoverage).toEqual([
      { sourceId: "source-a", title: "Base source", coverageStatus: "partial" },
    ]);
    expect(media.notes).toEqual(["base note", "medical note"]);
    expect(media.productionState).toEqual({
      baseProgrammes: "blocked_model_service",
      medicalSchool: { status: "research_in_progress" },
    });
  });

  it("counts only qualifying, deduplicated ready medical originals and overwrites raw generated totals", () => {
    const catalog = mergeCatalogContent(
      { programs: [], courses: [], documents: [], downloads: [] },
      {
        programs: [{ id: "med", name: "Med" }],
        courses: [
          {
            id: "MED-COUNT",
            programId: "med",
            title: "Measured medical course",
            targetVideoHours: 36,
            verifiedExternalHours: 2,
            // These raw declarations are deliberately not evidence.
            verifiedGeneratedHours: 999,
            verifiedTotalHours: 999,
            hoursGap: 0,
          },
        ],
        documents: [],
        downloads: [],
      }
    );
    const qualifying = {
      status: "ready",
      courseIds: ["MED-COUNT"],
      videoUrl: "/manus-storage/medical/lesson-one.mp4",
      captionUrl: "/manus-storage/medical/lesson-one.vtt",
      transcriptUrl: "/manus-storage/medical/lesson-one.md",
      durationSeconds: 72_000,
      isInstructional: true,
      sourceUrls: ["https://example.test/clinical-source"],
      medicalSourceReviewStatus: "automated_source_review_passed",
      humanClinicalReviewStatus: "not performed",
    };
    const normalized = normalizeMedicalGeneratedHours(catalog, {
      lessons: [
        { id: "lesson-one", title: "Qualifying 20 hours", ...qualifying },
        // Duplicate durable URL and duplicate ID each count only once per course.
        { id: "same-video", title: "Same URL", ...qualifying },
        {
          id: "lesson-one",
          title: "Same ID",
          ...qualifying,
          videoUrl: "/manus-storage/medical/another-url.mp4",
        },
        {
          id: "lesson-two",
          title: "Qualifying 16 hours",
          ...qualifying,
          videoUrl: "/manus-storage/medical/lesson-two.webm",
          durationSeconds: 57_600,
        },
        {
          id: "planned",
          title: "Planned runtime cannot count",
          ...qualifying,
          status: "planned",
          durationSeconds: 144_000,
        },
        {
          id: "orientation",
          title: "Orientation cannot count",
          ...qualifying,
          sourceKind: "orientation",
          durationSeconds: 144_000,
        },
        {
          id: "missing-review",
          title: "Missing source review cannot count",
          ...qualifying,
          medicalSourceReviewStatus: "pending",
          durationSeconds: 144_000,
        },
        {
          id: "missing-source",
          title: "Missing source evidence cannot count",
          ...qualifying,
          sourceUrls: [],
          durationSeconds: 144_000,
        },
        {
          id: "unmeasured",
          title: "Unmeasured duration cannot count",
          ...qualifying,
          durationSeconds: 0,
        },
        {
          id: "other-programme",
          title: "Other programme film cannot count",
          ...qualifying,
          courseIds: ["OTHER-COURSE"],
          durationSeconds: 144_000,
        },
      ],
    });
    const course = normalized.courses[0];
    expect(course).toMatchObject({
      verifiedGeneratedHours: 36,
      verifiedTotalHours: 38,
      hoursGap: 0,
    });
  });

  it("keeps corrected-pilot review semantics but requires every exact new-series hash gate", () => {
    const catalog = mergeCatalogContent(
      { programs: [], courses: [], documents: [], downloads: [] },
      {
        programs: [{ id: "med", name: "Med" }],
        courses: [
          {
            id: "MED-HASH",
            programId: "med",
            title: "Hash-gated course",
            targetVideoHours: 36,
          },
        ],
        documents: [],
        downloads: [],
      }
    );
    const sha = "a".repeat(64);
    const assets = {
      mp4: sha,
      vtt: "b".repeat(64),
      transcript: "c".repeat(64),
    };
    const required = {
      id: "MED-HASH-EXPLAIN-001",
      title: "Source-qualified episode",
      status: "ready",
      courseIds: ["MED-HASH"],
      videoUrl: "/manus-storage/medical/hash-gated.mp4",
      captionUrl: "/manus-storage/medical/hash-gated.vtt",
      transcriptUrl: "/manus-storage/medical/hash-gated.md",
      durationSeconds: 36_000,
      isInstructional: true,
      sourceUrls: ["https://example.test/source"],
      humanClinicalReviewStatus: "not performed",
      scriptSha256: sha,
      visualSha256: "d".repeat(64),
      evidenceSelectionSha256: "e".repeat(64),
      renderContentSha256: "f".repeat(64),
      localAssetSha256: assets,
      uploadedAssetSha256: assets,
    };
    const normalized = normalizeMedicalGeneratedHours(catalog, {
      lessons: [
        {
          ...required,
          id: "new-series-valid",
          medicalSourceReviewStatus: "passed_automated_source_check",
        },
        {
          ...required,
          id: "new-series-missing-evidence",
          medicalSourceReviewStatus: "passed_automated_source_check",
          evidenceSelectionSha256: "not-a-hash",
        },
        {
          ...required,
          id: "new-series-upload-mismatch",
          medicalSourceReviewStatus: "passed_automated_source_check",
          uploadedAssetSha256: { ...assets, mp4: "1".repeat(64) },
        },
        {
          ...required,
          id: "legacy-corrected-pilot",
          medicalSourceReviewStatus: "automated_source_review_passed",
          scriptSha256: undefined,
          visualSha256: undefined,
          evidenceSelectionSha256: undefined,
          renderContentSha256: undefined,
          localAssetSha256: undefined,
          uploadedAssetSha256: undefined,
          videoUrl: "/manus-storage/medical/corrected-pilot.mp4",
        },
      ],
    });
    expect(normalized.courses[0]).toMatchObject({
      verifiedGeneratedHours: 20,
      verifiedTotalHours: 20,
    });
  });

  it("includes a newly selected manifest ID in the transcript lookup path", () => {
    const liveMedia = mergeOriginalLecturesContent(
      { lessons: [], sourceCoverage: [] },
      {
        lessons: [
          {
            id: "MED-LIVE-NEW",
            title: "Newly generated lesson",
            transcript: "The newly live transcript remains available.",
          },
        ],
        sourceCoverage: [],
      }
    );
    expect(getInlineLessonTranscript("MED-LIVE-NEW", liveMedia)).toEqual({
      status: "ready",
      title: "Newly generated lesson",
      transcript: "The newly live transcript remains available.",
    });
  });
});
