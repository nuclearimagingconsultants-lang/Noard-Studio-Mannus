import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  MedicalReadingContent,
  MedicalReadingDevelopmentNotice,
} from "../components/studio/MedicalReadingPanel";
import {
  selectedPublicTextSourceLimitation,
  type MedicalReadingChapter,
} from "@shared/medicalReadings";

const chapter: MedicalReadingChapter = {
  episodeId: "MED-058-EXPLAIN-301",
  courseId: "MED-058",
  title: "Reviewed chapter",
  educationalLimits: "Independent study, not clinical training.",
  coverageGaps: ["Advanced management remains outside this chapter."],
  sourceUrls: ["https://www.fda.gov/example"],
  status: "source_prepared_not_rendered",
  videoProduced: false,
  measuredVideoSeconds: null,
  countedLectureMinutes: 0,
  humanClinicalReviewStatus: "not performed",
  sourceReviewStatus: "passed_automated_source_check",
  sourceScriptSha256: "a".repeat(64),
  visualSha256: "b".repeat(64),
  evidenceSelectionSha256: "c".repeat(64),
  reviewedAt: "2026-10-09T12:00:00Z",
  reviewedSources: [
    { url: "https://www.fda.gov/example", textSha256: "d".repeat(64) },
  ],
  sourceLimitations: "Automated comparison only.",
  sections: [
    {
      title: "Teach",
      narration: "<script>not executable</script>\nActual reviewed narration.",
    },
  ],
};

describe("medical chapter reading display", () => {
  it("shows actual reviewed narration, partial scope, source links and no-clinician-review limits", () => {
    const html = renderToStaticMarkup(
      createElement(MedicalReadingContent, { chapters: [chapter] })
    );
    expect(html).toContain("Actual reviewed narration");
    expect(html).toContain("zero counted video minutes");
    expect(html).toContain("Human clinician review not performed");
    expect(html).toContain("Advanced management remains outside");
    expect(html).toContain("https://www.fda.gov/example");
    expect(html).toContain(
      "/api/content/medical-chapters/MED-058/MED-058-EXPLAIN-301.md"
    );
  });
  it("labels retained selected public text without presenting it as a whole work", () => {
    const selectedPublicText: MedicalReadingChapter = {
      ...chapter,
      sourceLimitations: `${chapter.sourceLimitations} ${selectedPublicTextSourceLimitation}`,
      reviewedSources: [
        {
          url: "https://www.fda.gov/example",
          sourceKind: "selected_public_text",
          selectedRecordSha256: "e".repeat(64),
          selectedTextSha256: ["f".repeat(64)],
          excerptSha256: "1".repeat(64),
          excerptManifestSha256: "2".repeat(64),
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(MedicalReadingContent, { chapters: [selectedPublicText] })
    );
    expect(html).toContain("Selected public-text excerpt 1");
    expect(html).toContain(selectedPublicTextSourceLimitation);
    expect(html).toContain("https://www.fda.gov/example");
  });
  it("renders source prose as literal text, not executable publisher HTML", () => {
    const html = renderToStaticMarkup(
      createElement(MedicalReadingContent, { chapters: [chapter] })
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("medical draft progress notices", () => {
  it("keeps draft and blocked status distinct from approved teaching and videos", () => {
    for (const status of [
      "source_review_pending",
      "source_unavailable",
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(MedicalReadingDevelopmentNotice, {
          development: {
            courseId: "MED-058",
            episodeId: "MED-058-EXPLAIN-301",
            status,
          },
        })
      );
      expect(html).toContain("zero counted video minutes");
      expect(html).toContain("human clinician review has not been performed");
      expect(html).not.toContain("Read chapter");
      expect(html).not.toContain("Download chapter text");
    }
  });
});
