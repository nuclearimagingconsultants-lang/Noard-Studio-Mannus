import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadMedicalReadings } from "./medicalReadings";
import { validateMedicalReading } from "../shared/medicalReadings";

const root = path.resolve(import.meta.dirname, "..", "data", "medical");
const exact = {
  "MED-058-EXPLAIN-301":
    "610d19bc81738a27ec171913075040b5d51773e0f3791334c5f5cf6725715e19",
  "MED-063-EXPLAIN-301":
    "4b72645efe949b51d19d6e3d7b93b16f19ffa81f95167ac7007a1b2cde06abdd",
};

async function payload(id: string, hash: string) {
  const bytes = await fs.readFile(
    path.join(root, "reading-chapters", `${id}.${hash}.json`)
  );
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
  return JSON.parse(bytes.toString("utf8"));
}

describe("authoritative additive medical readings", () => {
  it("serves the full authoritative JSON, including all provenance hashes", async () => {
    for (const [id, hash] of Object.entries(exact)) {
      const expected = await payload(id, hash);
      const result = await loadMedicalReadings(expected.courseId);
      expect(result.chapters.find(chapter => chapter.episodeId === id)).toEqual(
        expected
      );
      expect(result.withheldCount).toBe(0);
      expect(expected.reviewedSources[0]).toHaveProperty("rawSha256");
      expect(expected.reviewedSources[0]).toHaveProperty("excerptSha256");
      expect(expected.reviewedSources[0]).toHaveProperty(
        "excerptManifestSha256"
      );
      expect(expected.videoProduced).toBe(false);
      expect(expected.countedLectureMinutes).toBe(0);
      expect(expected.humanClinicalReviewStatus).toBe("not performed");
    }
  });

  it("retains legacy references but rejects malformed or unrelated extra provenance", async () => {
    const chapter = await payload(
      "MED-058-EXPLAIN-301",
      exact["MED-058-EXPLAIN-301"]
    );
    expect(validateMedicalReading(chapter, "MED-058")).toBe(true);
    const legacy = structuredClone(chapter);
    for (const key of ["rawSha256", "excerptSha256", "excerptManifestSha256"]) {
      delete legacy.reviewedSources[0][key];
      const malformed = structuredClone(chapter);
      malformed.reviewedSources[0][key] = "not-a-valid-sha256";
      expect(validateMedicalReading(malformed, "MED-058")).toBe(false);
    }
    expect(validateMedicalReading(legacy, "MED-058")).toBe(true);
    const privateExtra = structuredClone(chapter);
    privateExtra.reviewedSources[0].localPath = "/tmp/private-evidence";
    expect(validateMedicalReading(privateExtra, "MED-058")).toBe(false);
  });

  it("matches every indexed payload and retains twenty-eight readings plus unchanged legacy draft backlog", async () => {
    const index = JSON.parse(
      await fs.readFile(path.join(root, "reading-index.json"), "utf8")
    );
    expect(index.entries).toHaveLength(28);
    expect(new Set(index.entries.map((entry: { episodeId: string }) => entry.episodeId)).size).toBe(28);
    expect(index.entries.filter((entry: { episodeId: string }) => entry.episodeId.endsWith("-EXPLAIN-401"))).toHaveLength(14);
    for (const entry of index.entries) {
      const expected = await payload(entry.episodeId, entry.payloadSha256);
      const result = await loadMedicalReadings(entry.courseId);
      expect(
        result.chapters.find(chapter => chapter.episodeId === entry.episodeId)
      ).toEqual(expected);
    }
    const development = JSON.parse(
      await fs.readFile(path.join(root, "reading-development.json"), "utf8")
    );
    expect(development.entries).toHaveLength(136);
    expect(
      development.entries.filter(
        (item: { status: string }) => item.status === "source_review_pending"
      )
    ).toHaveLength(118);
    expect(
      development.entries.filter(
        (item: { status: string }) => item.status === "source_unavailable"
      )
    ).toHaveLength(8);
    expect(
      development.entries.filter(
        (item: { status: string }) => item.status === "source_checked"
      )
    ).toHaveLength(10);
  });
});
