import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { loadMedicalReadings, medicalReadingMarkdown } from "./medicalReadings";
import {
  validateMedicalReading,
  validateMedicalReadingDevelopment,
  isPublicReadingSource,
  type MedicalReadingChapter,
} from "../shared/medicalReadings";

const fixture: MedicalReadingChapter = {
  episodeId: "MED-058-EXPLAIN-301",
  courseId: "MED-058",
  title: "Source-backed conceptual chapter",
  educationalLimits: "Independent self-study, not clinical training.",
  coverageGaps: ["Partial teaching only; no clinical review."],
  sourceUrls: ["https://www.fda.gov/medical-devices/example"],
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
    {
      url: "https://www.fda.gov/medical-devices/example",
      textSha256: "d".repeat(64),
    },
  ],
  sourceLimitations:
    "Automated source comparison does not establish human clinical validation.",
  sections: [
    {
      title: "Concept",
      narration:
        "Explain the bounded source-backed concept without a clinical action claim.",
    },
  ],
};
const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))
  );
});

async function saved(
  value: unknown = fixture,
  modifyIndex?: (entry: Record<string, unknown>) => void
) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "medical-reading-test-")
  );
  temps.push(root);
  await fs.mkdir(path.join(root, "reading-chapters"));
  const bytes = Buffer.from(JSON.stringify(value));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const file = `reading-chapters/MED-058-EXPLAIN-301.${hash}.json`;
  await fs.writeFile(path.join(root, file), bytes);
  const entry: Record<string, unknown> = {
    courseId: "MED-058",
    episodeId: fixture.episodeId,
    file,
    payloadSha256: createHash("sha256").update(bytes).digest("hex"),
    sourceScriptSha256: fixture.sourceScriptSha256,
    evidenceSelectionSha256: fixture.evidenceSelectionSha256,
  };
  modifyIndex?.(entry);
  await fs.writeFile(
    path.join(root, "reading-index.json"),
    JSON.stringify({
      schema: "board-studio-medical-readings-v1",
      entries: [entry],
    })
  );
  return root;
}

describe("medical reading-only source gates", () => {
  it("loads exactly reviewed reading content and contributes zero video minutes", async () => {
    const value = await loadMedicalReadings("MED-058", await saved());
    expect(value.chapters).toEqual([fixture]);
    expect(value.withheldCount).toBe(0);
    expect(value.chapters[0].countedLectureMinutes).toBe(0);
    expect(medicalReadingMarkdown(fixture)).toContain(
      "Human clinician review has not been performed"
    );
  });
  it("withholds a changed payload instead of serving unaudited words", async () => {
    const root = await saved();
    const index = JSON.parse(
      await fs.readFile(path.join(root, "reading-index.json"), "utf8")
    );
    await fs.appendFile(path.join(root, index.entries[0].file), " ");
    expect(await loadMedicalReadings("MED-058", root)).toMatchObject({
      chapters: [],
      withheldCount: 1,
    });
  });
  it("does not expose another course's chapters or accept traversal identifiers", async () => {
    const root = await saved();
    expect((await loadMedicalReadings("MED-059", root)).chapters).toEqual([]);
    await expect(loadMedicalReadings("../MED-058", root)).rejects.toThrow(
      "Invalid medical course"
    );
    expect(
      (
        await loadMedicalReadings(
          "MED-058",
          await saved(fixture, entry => {
            entry.file = "../private.json";
          })
        )
      ).withheldCount
    ).toBe(1);
  });
  it("withholds drafts, source mismatches and fake video/clinical-review declarations", async () => {
    for (const change of [
      { sourceReviewStatus: "pending" },
      { countedLectureMinutes: 12 },
      { videoProduced: true },
      { humanClinicalReviewStatus: "reviewed" },
      { sourceScriptSha256: "e".repeat(64) },
    ]) {
      expect(
        (
          await loadMedicalReadings(
            "MED-058",
            await saved({ ...fixture, ...change })
          )
        ).chapters
      ).toEqual([]);
    }
  });
  it("rejects upstream narration, local locations and credentialed or unsafe sources", () => {
    for (const change of [
      { originalNarration: "Rejected text" },
      { description: "/home/ubuntu/private.txt" },
      { sourceUrls: ["file:///private.txt"] },
      { sourceUrls: ["https://user:password@example.org/source"] },
      { sourceUrls: ["http://127.0.0.1/source"] },
    ]) {
      expect(validateMedicalReading({ ...fixture, ...change }, "MED-058")).toBe(
        false
      );
    }
  });
  it("blocks RFC1918, IPv6 private/link-local and mapped-loopback source destinations", () => {
    for (const url of [
      "http://172.16.0.1/source",
      "http://172.31.255.254/source",
      "http://[fd00::1]/source",
      "http://[fc00::1]/source",
      "http://[fe80::1]/source",
      "http://[::ffff:127.0.0.1]/source",
      "http://service.internal/source",
    ]) {
      expect(isPublicReadingSource(url)).toBe(false);
    }
    expect(isPublicReadingSource("https://www.asge.org/home/education")).toBe(
      true
    );
  });
  it("blocks non-Ubuntu and Windows research paths even after a source URL/newline", () => {
    for (const text of [
      "/tmp/secret/x",
      "/var/private/x",
      "D:\\research\\x",
      "E:/BoardStudio/private.json",
      "https://example.org/source\n/tmp/secret/x",
    ]) {
      expect(
        validateMedicalReading({ ...fixture, description: text }, "MED-058")
      ).toBe(false);
    }
    expect(
      validateMedicalReading(
        {
          ...fixture,
          description:
            "See https://www.asge.org/home/education for public resources.",
        },
        "MED-058"
      )
    ).toBe(true);
  });
});

describe("medical chapter development is not teaching completion", () => {
  it("reports pending work without publishing draft content or video hours", async () => {
    const root = await saved();
    await fs.writeFile(
      path.join(root, "reading-development.json"),
      JSON.stringify({
        schema: "board-studio-medical-reading-development-v1",
        entries: [
          {
            courseId: "MED-059",
            episodeId: "MED-059-EXPLAIN-301",
            status: "source_review_pending",
          },
        ],
      })
    );
    expect(await loadMedicalReadings("MED-059", root)).toEqual({
      courseId: "MED-059",
      chapters: [],
      withheldCount: 0,
      development: {
        courseId: "MED-059",
        episodeId: "MED-059-EXPLAIN-301",
        status: "source_review_pending",
      },
    });
  });
  it("cannot say source_checked when its approved payload was withheld", async () => {
    const root = await saved({ ...fixture, sourceReviewStatus: "pending" });
    await fs.writeFile(
      path.join(root, "reading-development.json"),
      JSON.stringify({
        schema: "board-studio-medical-reading-development-v1",
        entries: [
          {
            courseId: "MED-058",
            episodeId: fixture.episodeId,
            status: "source_checked",
          },
        ],
      })
    );
    const value = await loadMedicalReadings("MED-058", root);
    expect(value.chapters).toEqual([]);
    expect(value.development).toBeUndefined();
  });
  it("rejects private fields, cross-course IDs and video-ready status declarations", () => {
    const row = {
      courseId: "MED-058",
      episodeId: fixture.episodeId,
      status: "source_review_pending",
    };
    expect(validateMedicalReadingDevelopment(row, "MED-058")).toBe(true);
    for (const change of [
      { scriptPath: "/tmp/private" },
      { narration: "unreviewed" },
      { status: "ready" },
      { episodeId: "MED-059-EXPLAIN-301" },
    ]) {
      expect(
        validateMedicalReadingDevelopment({ ...row, ...change }, "MED-058")
      ).toBe(false);
    }
  });
});
