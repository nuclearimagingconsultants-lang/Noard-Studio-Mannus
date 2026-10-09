import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type {
  OriginalLecturesData,
  CourseRecord,
  DocumentRecord,
} from "../shared/catalog";
import { createWorkspaceContentLoader } from "./workspaceContent";
import { getCatalogContent } from "./content";
import { isMedicalCourseReady, summarizeMedicalHours } from "../shared/medical";

const ROOT = path.resolve(import.meta.dirname, "..");
const emptyMedia = (): OriginalLecturesData => ({
  lessons: [],
  sourceCoverage: [],
  productionState: [],
  notes: [],
});

async function actualCourseIds(): Promise<string[]> {
  const [baseRaw, indexRaw] = await Promise.all([
    readFile(path.join(ROOT, "data/catalog.json"), "utf8"),
    readFile(path.join(ROOT, "data/medical/catalog-index.json"), "utf8"),
  ]);
  const base = JSON.parse(baseRaw) as { courses: Array<{ id: string }> };
  const index = JSON.parse(indexRaw) as {
    coursePartById: Record<string, string>;
  };
  return [
    ...base.courses.map(course => course.id),
    ...Object.keys(index.coursePartById),
  ];
}

describe("index-assisted workspace content", () => {
  it("preserves full-source readiness and unknown-duration counts in the compact directory", async () => {
    const loader = createWorkspaceContentLoader();
    const [directory, full] = await Promise.all([
      loader.getDirectoryContent(),
      getCatalogContent(),
    ]);
    const count = (c: typeof directory) => ({
      ready: c.courses.filter(
        (x: CourseRecord) => x.programId === "med" && isMedicalCourseReady(x)
      ).length,
      unknown: c.courses.reduce(
        (t: number, x: CourseRecord) =>
          t + summarizeMedicalHours(x).unknownDurationCount,
        0
      ),
    });
    expect(count(directory)).toEqual(count(full));
    expect(count(directory).ready).toBeGreaterThan(0);
    expect(count(directory).unknown).toBeGreaterThan(0);
    expect(
      loader
        .getDiagnostics()
        .parsedFiles.filter(x => x.startsWith("medical/catalog-parts/"))
    ).toHaveLength(0);
  });

  it("builds the directory from bounded queue parts without reading medical course parts", async () => {
    const loader = createWorkspaceContentLoader({
      getOriginalLectures: async () => emptyMedia(),
      getMedicalOriginalLectures: async () => emptyMedia(),
    });
    const directory = await loader.getDirectoryContent();
    const diagnostics = loader.getDiagnostics();

    const full = await getCatalogContent();
    expect(directory.courses).toHaveLength(full.courses.length);
    expect(
      directory.courses.filter(
        (course: CourseRecord) => course.programId === "med"
      )
    ).toHaveLength(
      full.courses.filter((course: CourseRecord) => course.programId === "med")
        .length
    );
    expect(directory.stats).toMatchObject({
      programs: 5,
      courses: full.stats?.courses,
      units: full.stats?.units,
      lectureEntries: full.stats?.lectureEntries,
    });
    expect(diagnostics.parsedFiles).toContain("catalog.json");
    expect(diagnostics.parsedFiles).toContain("medical/catalog-index.json");
    expect(
      diagnostics.parsedFiles.filter(file =>
        file.startsWith("medical/queue-parts/")
      )
    ).toHaveLength(28);
    expect(
      diagnostics.parsedFiles.filter(file =>
        file.startsWith("medical/catalog-parts/")
      )
    ).toHaveLength(0);
    expect(diagnostics.parsedFiles).not.toContain("medical/catalog.json");
  });

  it("on a cold normal request reads only the mapped part and uses medical-only hour evidence", async () => {
    const loader = createWorkspaceContentLoader({
      getOriginalLectures: async () => ({
        ...emptyMedia(),
        lessons: [
          {
            id: "MED-001-CAPTIONED",
            title: "Captioned source lesson",
            courseIds: ["MED-001"],
            sourceId: "med-syllabus-MED-001",
            status: "ready",
            videoUrl: "/manus-storage/medical/med-001.mp4",
            captionUrl: "/manus-storage/medical/med-001.vtt",
            transcriptUrl: "/manus-storage/medical/med-001.md",
            durationSeconds: 60,
          },
          {
            // This qualifies structurally but only exists in the base/merged feed.
            // It must never inflate a medical course's generated-hour evidence.
            id: "BASE-SPOOF-MED-001",
            title: "Base feed cannot count as medical evidence",
            courseIds: ["MED-001"],
            status: "ready",
            videoUrl: "/manus-storage/base/spoof.mp4",
            durationSeconds: 72_000,
            isInstructional: true,
            sourceUrls: ["https://example.test/source"],
            medicalSourceReviewStatus: "automated_source_review_passed",
            humanClinicalReviewStatus: "not performed",
          },
        ],
      }),
      getMedicalOriginalLectures: async () => emptyMedia(),
    });
    const workspace = await loader.getCourseWorkspace("MED-001", "course");
    const diagnostics = loader.getDiagnostics();

    expect(workspace.catalog.courses).toHaveLength(1);
    expect(workspace.catalog.courses[0]).toMatchObject({ id: "MED-001" });
    expect(
      workspace.catalog.courses[0]?.practiceQuestions?.length
    ).toBeGreaterThan(0);
    expect(workspace.catalog.courses[0]?.verifiedGeneratedHours).toBe(0);
    expect(workspace.catalog.stats).toMatchObject({
      courses: (await getCatalogContent()).stats?.courses,
      units: (await getCatalogContent()).stats?.units,
    });
    expect(
      workspace.catalog.documents.some(
        (document: DocumentRecord) => document.id === "med-syllabus-MED-001"
      )
    ).toBe(true);
    expect(workspace.media.lessons[0]).toMatchObject({
      id: "MED-001-CAPTIONED",
      captionUrl: "/manus-storage/medical/med-001.vtt",
      transcriptUrl: "/manus-storage/medical/med-001.md",
    });
    expect(diagnostics.parsedFiles).toContain("catalog.json");
    expect(diagnostics.parsedFiles).toContain("medical/catalog-index.json");
    expect(diagnostics.parsedFiles).toContain(
      "medical/catalog-parts/part-001.json"
    );
    expect(
      diagnostics.parsedFiles.filter(file =>
        file.startsWith("medical/catalog-parts/")
      )
    ).toEqual(["medical/catalog-parts/part-001.json"]);
    expect(diagnostics.parsedFiles).not.toContain("medical/catalog.json");
  });

  it("keeps programme queue peers compact while a separately loaded peer keeps full detail", async () => {
    const loader = createWorkspaceContentLoader({
      getOriginalLectures: async () => ({
        ...emptyMedia(),
        lessons: [
          {
            id: "MED-002-CAPTIONED",
            title: "Peer original lesson",
            courseIds: ["MED-002"],
            status: "ready",
            videoUrl: "/manus-storage/medical/med-002.mp4",
            captionUrl: "/manus-storage/medical/med-002.vtt",
            transcriptUrl: "/manus-storage/medical/med-002.md",
            durationSeconds: 60,
          },
        ],
      }),
      getMedicalOriginalLectures: async () => emptyMedia(),
    });
    const programme = await loader.getCourseWorkspace("MED-001", "program");
    const compactPeer = programme.catalog.courses.find(
      (course: CourseRecord) => course.id === "MED-002"
    );
    const peerDetail = await loader.getCourseWorkspace("MED-002", "course");

    expect(programme.catalog.courses).toHaveLength(
      (await getCatalogContent()).courses.filter(
        (course: CourseRecord) => course.programId === "med"
      ).length
    );
    expect(
      programme.catalog.courses[0]?.practiceQuestions?.length
    ).toBeGreaterThan(0);
    expect(compactPeer?.lectures?.length).toBeGreaterThan(0);
    expect(compactPeer?.practiceQuestions).toBeUndefined();
    expect(programme.media.lessons).toContainEqual(
      expect.objectContaining({
        id: "MED-002-CAPTIONED",
        captionUrl: "/manus-storage/medical/med-002.vtt",
      })
    );
    expect(peerDetail.catalog.courses).toHaveLength(1);
    expect(peerDetail.catalog.courses[0]?.id).toBe("MED-002");
    expect(
      peerDetail.catalog.courses[0]?.practiceQuestions?.length
    ).toBeGreaterThan(0);
  });

  it("resolves every actual generated and base course ID through the targeted path", async () => {
    const loader = createWorkspaceContentLoader({
      getOriginalLectures: async () => emptyMedia(),
      getMedicalOriginalLectures: async () => emptyMedia(),
    });
    const courseIds = await actualCourseIds();
    expect(courseIds.length).toBeGreaterThanOrEqual(383);
    expect(new Set(courseIds).size).toBe(courseIds.length);
    expect(courseIds).toContain("MED-X117");
    for (const courseId of courseIds) {
      const workspace = await loader.getCourseWorkspace(courseId, "course");
      expect(
        workspace.catalog.courses.map((course: CourseRecord) => course.id)
      ).toEqual([courseId]);
    }
    expect(loader.getDiagnostics().parsedFiles).not.toContain(
      "medical/catalog.json"
    );
  }, 30_000);
});
