import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Express } from "express";
import {
  medicalCourseIdPattern,
  medicalChapterIdPattern,
  validateMedicalReading,
  validateMedicalReadingDevelopment,
  type MedicalReadingResponse,
  type MedicalReadingChapter,
} from "../shared/medicalReadings";

const root = path.resolve(import.meta.dirname, "..", "data", "medical");
const MAX_BYTES = 256_000;
type IndexEntry = {
  courseId: string;
  episodeId: string;
  file: string;
  payloadSha256: string;
  sourceScriptSha256: string;
  evidenceSelectionSha256: string;
};

export async function loadMedicalReadings(
  courseId: string,
  dataRoot = root
): Promise<MedicalReadingResponse> {
  if (!medicalCourseIdPattern.test(courseId))
    throw new Error("Invalid medical course identifier");
  let index: { schema: string; entries: IndexEntry[] };
  try {
    const file = path.join(dataRoot, "reading-index.json");
    if ((await fs.stat(file)).size > MAX_BYTES)
      throw new Error("Reading index exceeds limit");
    index = JSON.parse(await fs.readFile(file, "utf8"));
    if (
      index.schema !== "board-studio-medical-readings-v1" ||
      !Array.isArray(index.entries)
    )
      throw new Error("Invalid reading index");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { courseId, chapters: [], withheldCount: 0 };
    throw error;
  }
  const chapters: MedicalReadingChapter[] = [];
  const seen = new Set<string>();
  let withheldCount = 0;
  for (const entry of index.entries.filter(
    item => item?.courseId === courseId
  )) {
    try {
      if (
        !medicalChapterIdPattern.test(entry.episodeId) ||
        !entry.episodeId.startsWith(`${courseId}-EXPLAIN-`) ||
        !/^[a-f0-9]{64}$/.test(entry.payloadSha256) ||
        entry.file !==
          `reading-chapters/${entry.episodeId}.${entry.payloadSha256}.json` ||
        seen.has(entry.episodeId)
      )
        throw new Error("Invalid reading assignment");
      const file = path.join(dataRoot, entry.file);
      if ((await fs.stat(file)).size > MAX_BYTES)
        throw new Error("Reading exceeds limit");
      const bytes = await fs.readFile(file);
      if (
        createHash("sha256").update(bytes).digest("hex") !== entry.payloadSha256
      )
        throw new Error("Reading payload identity changed");
      const chapter: unknown = JSON.parse(bytes.toString("utf8"));
      if (
        !validateMedicalReading(chapter, courseId) ||
        chapter.episodeId !== entry.episodeId ||
        chapter.sourceScriptSha256 !== entry.sourceScriptSha256 ||
        chapter.evidenceSelectionSha256 !== entry.evidenceSelectionSha256
      )
        throw new Error("Reading lacks exact source-review identity");
      seen.add(entry.episodeId);
      chapters.push(chapter);
    } catch {
      withheldCount += 1;
    }
  }
  let development: MedicalReadingResponse["development"];
  try {
    const file = path.join(dataRoot, "reading-development.json");
    if ((await fs.stat(file)).size <= MAX_BYTES) {
      const value = JSON.parse(await fs.readFile(file, "utf8"));
      if (
        value.schema === "board-studio-medical-reading-development-v1" &&
        Array.isArray(value.entries)
      ) {
        const matches = value.entries.filter(
          (row: Record<string, unknown>) => row?.courseId === courseId
        );
        if (
          matches.length === 1 &&
          validateMedicalReadingDevelopment(matches[0], courseId)
        ) {
          const candidate = matches[0];
          if (
            candidate.status !== "source_checked" ||
            chapters.some(chapter => chapter.episodeId === candidate.episodeId)
          ) {
            development = candidate;
          }
        }
      }
    }
  } catch {
    // Development metadata is informational, never a teaching or media gate.
  }
  return {
    courseId,
    chapters,
    withheldCount,
    ...(development ? { development } : {}),
  };
}

export function medicalReadingMarkdown(chapter: MedicalReadingChapter) {
  return [
    `# ${chapter.title}`,
    "",
    `Course: ${chapter.courseId} · Chapter: ${chapter.episodeId}`,
    "",
    "> Source-prepared study text, not a video transcript. Zero counted video minutes. Human clinician review has not been performed.",
    "",
    chapter.educationalLimits,
    "",
    ...chapter.sections.flatMap(section => [
      `## ${section.title}`,
      "",
      section.narration,
      "",
    ]),
    "## Reviewed sources",
    "",
    ...chapter.reviewedSources.map(
      source => `- ${source.url} — text SHA-256: ${source.textSha256}`
    ),
    "",
    "## Remaining scope",
    "",
    ...chapter.coverageGaps.map(gap => `- ${gap}`),
    "",
    chapter.sourceLimitations,
    "",
    `Reviewed script SHA-256: ${chapter.sourceScriptSha256}`,
    "",
  ].join("\n");
}

export function registerMedicalReadingRoutes(app: Express) {
  app.get("/api/content/medical-chapters/:courseId", async (req, res) => {
    if (!medicalCourseIdPattern.test(req.params.courseId))
      return void res
        .status(400)
        .json({ error: "Invalid medical course identifier" });
    try {
      res
        .set("Cache-Control", "no-store")
        .json(await loadMedicalReadings(req.params.courseId));
    } catch {
      res
        .status(503)
        .json({ error: "Reading catalogue temporarily unavailable" });
    }
  });
  app.get(
    "/api/content/medical-chapters/:courseId/:episodeId.md",
    async (req, res) => {
      if (
        !medicalCourseIdPattern.test(req.params.courseId) ||
        !medicalChapterIdPattern.test(req.params.episodeId)
      )
        return void res
          .status(400)
          .json({ error: "Invalid reading identifier" });
      try {
        const content = await loadMedicalReadings(req.params.courseId);
        const chapter = content.chapters.find(
          item => item.episodeId === req.params.episodeId
        );
        if (!chapter)
          return void res
            .status(404)
            .json({ error: "Source-audited reading not available" });
        res
          .set("Cache-Control", "no-store")
          .set(
            "Content-Disposition",
            `attachment; filename="${chapter.episodeId}.md"`
          )
          .type("text/markdown")
          .send(medicalReadingMarkdown(chapter));
      } catch {
        res.status(503).json({ error: "Reading temporarily unavailable" });
      }
    }
  );
}
