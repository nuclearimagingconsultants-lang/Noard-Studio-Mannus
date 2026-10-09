import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isPublicMediaManifest,
  isPublishableReadyOriginal,
  isSafePublicString,
  isStableManusStoragePath,
  projectPublicMediaManifest,
} from "./publicMedia.mjs";

const blockedText =
  /(?:\/home\/|\/tmp\/|\/var\/|file:|\b(?:secret|password|passphrase|api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|private[\s_-]?key|authorization|bearer)\b)/i;

function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(allStrings);
  return [];
}

describe("public media projection", () => {
  it("uses an explicit allowlist and removes internal paths, unknown output, and unsafe public strings", () => {
    const projected = projectPublicMediaManifest({
      lessons: [
        {
          id: "MED-EXPLAIN-001",
          title: "Public title",
          description: "Public description",
          status: "ready",
          programIds: ["med"],
          courseIds: ["MED-001"],
          durationSeconds: 120.25,
          sourcePages: [1, 2, 2],
          pageCues: [{ start: 0, end: 120.25, page: 1 }],
          videoUrl: "/manus-storage/media/lesson.mp4",
          captionUrl: "/manus-storage/media/lesson.vtt",
          transcriptUrl: "/manus-storage/media/lesson.md",
          transcript: "Public transcript text.",
          sourceUrls: ["https://example.test/source"],
          medicalSourceUrls: ["https://example.test/medical-source"],
          medicalSourceReviewStatus: "passed_automated_source_check",
          humanClinicalReviewStatus: "not performed",
          scriptSha256: "a".repeat(64),
          visualSha256: "b".repeat(64),
          evidenceSelectionSha256: "c".repeat(64),
          renderContentSha256: "d".repeat(64),
          localAssetSha256: {
            mp4: "e".repeat(64),
            vtt: "f".repeat(64),
            transcript: "0".repeat(64),
            wav: "/home/ubuntu/private.wav",
          },
          uploadedAssetSha256: {
            mp4: "e".repeat(64),
            vtt: "f".repeat(64),
            transcript: "0".repeat(64),
          },
          localAssets: { mp4: "/home/ubuntu/private.mp4" },
          reviewManifestPath: "/tmp/review.json",
          sourceAuditPath: "file:///var/audit.json",
          scriptOutput: "api key: should not appear",
          arbitraryProducerField: "must be dropped",
        },
        {
          id: "unsafe-text",
          title: "See /home/ubuntu/private.txt",
          description: "password should never cross this boundary",
          status: "planned",
          unknownNestedOutput: { path: "/var/private" },
        },
      ],
      sourceCoverage: [
        {
          sourceId: "source-a",
          title: "Public PDF source",
          pageCount: 12,
          substantivePages: 10,
          taughtPages: 3,
          plannedLessons: 2,
          readyLessons: 1,
          coverageStatus: "partial",
          scopeNote: "Recorded source scope only.",
          gaps: ["Remaining pages"],
          programIds: ["med"],
          pageLedger: [
            {
              start_page: 1,
              end_page: 3,
              classification: "taught",
              lesson_ids: ["MED-EXPLAIN-001"],
              reason: "Mapped to source pages.",
              privatePath: "/home/ubuntu/ledger.json",
            },
          ],
          auditOutput: "/tmp/audit.json",
        },
      ],
      productionState: {
        status: "rendering",
        completed: 1,
        total: 2,
        baseProgrammes: { status: "ready" },
        medicalSchool: { status: "rendering", message: "/tmp/internal" },
        localPath: "/home/ubuntu/producer",
        token: "should be removed",
      },
      notes: ["private producer notes"],
      unknownRootOutput: "/var/private",
    });

    expect(projected).toEqual({
      lessons: [
        expect.objectContaining({
          id: "MED-EXPLAIN-001",
          sourcePages: [1, 2],
          pageCues: [{ start: 0, end: 120.25, page: 1 }],
          localAssetSha256: {
            mp4: "e".repeat(64),
            vtt: "f".repeat(64),
            transcript: "0".repeat(64),
          },
        }),
        { id: "unsafe-text", status: "planned" },
      ],
      sourceCoverage: [
        expect.objectContaining({
          sourceId: "source-a",
          pageLedger: [
            {
              start_page: 1,
              end_page: 3,
              classification: "taught",
              lesson_ids: ["MED-EXPLAIN-001"],
              reason: "Mapped to source pages.",
            },
          ],
        }),
      ],
      productionState: {
        status: "rendering",
        completed: 1,
        total: 2,
        baseProgrammes: { status: "ready" },
        medicalSchool: { status: "rendering" },
      },
    });
    expect(allStrings(projected).some(text => blockedText.test(text))).toBe(
      false
    );
    expect(isPublicMediaManifest(projected)).toBe(true);
    expect(
      isPublicMediaManifest({
        ...projected,
        localAssets: { mp4: "/home/ubuntu/private.mp4" },
      })
    ).toBe(false);
  });

  it("requires a complete stable video, VTT, transcript, ready status, and measured positive duration", () => {
    const ready = {
      id: "ready",
      status: "ready",
      durationSeconds: 1,
      videoUrl: "/manus-storage/lesson.mp4",
      captionUrl: "/manus-storage/lesson.vtt",
      transcriptUrl: "/manus-storage/lesson.md",
    };
    expect(isPublishableReadyOriginal(ready)).toBe(true);
    expect(isPublishableReadyOriginal({ ...ready, durationSeconds: 0 })).toBe(
      false
    );
    expect(
      isPublishableReadyOriginal({
        ...ready,
        videoUrl: "https://example.test/lesson.mp4",
      })
    ).toBe(false);
    expect(
      isPublishableReadyOriginal({
        ...ready,
        captionUrl: "/manus-storage/lesson.vtt?temporary=1",
      })
    ).toBe(false);
    expect(
      isPublishableReadyOriginal({ ...ready, transcriptUrl: undefined })
    ).toBe(false);
    expect(isStableManusStoragePath("/manus-storage/lesson.mp4")).toBe(true);
    expect(isStableManusStoragePath("/manus-storage/../private.mp4")).toBe(
      false
    );
    expect(isSafePublicString("file:///tmp/private.txt")).toBe(false);
    expect(isSafePublicString("a public explanation")).toBe(true);
  });

  it("retains all currently ready base and medical clips as publishable while removing producer-only fields", () => {
    const cases = [
      "../data/original-lectures.json",
      "../data/medical/original-lectures.json",
    ] as const;
    for (const relativePath of cases) {
      const source = JSON.parse(
        readFileSync(new URL(relativePath, import.meta.url), "utf8")
      ) as { lessons: Array<{ id: string; status?: string }> };
      const readyIds = source.lessons
        .filter(lesson => lesson.status === "ready")
        .map(lesson => lesson.id)
        .sort();
      expect(readyIds.length).toBeGreaterThan(0);
      const projected = projectPublicMediaManifest(source);
      expect(projected.lessons).toHaveLength(source.lessons.length);
      expect(
        projected.lessons
          .filter(isPublishableReadyOriginal)
          .map(lesson => lesson.id)
          .sort()
      ).toEqual(readyIds);
      expect(isPublicMediaManifest(projected)).toBe(true);
      expect(allStrings(projected).some(text => blockedText.test(text))).toBe(
        false
      );
    }
  });
});
