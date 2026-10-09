import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  readBoundedPublicManifestRows,
  resolveManifestSources,
  resolveValidatedManifestSources,
  validatePublicManifestRow,
} from "./publicContentFeed";

function row(kind: "base" | "medical", value: object) {
  const manifestJson = JSON.stringify(value);
  return {
    manifestType: kind,
    manifestJson,
    manifestSha256: createHash("sha256").update(manifestJson).digest("hex"),
    manifestBytes: Buffer.byteLength(manifestJson),
  };
}

describe("public generated-media feed", () => {
  it("selects the actual loader's validated map rather than misreading it as raw SQL rows", () => {
    const bundled = {
      base: { value: { lessons: [] }, version: "base-file" },
      medical: { value: { lessons: [] }, version: "medical-file" },
    };
    const valid = validatePublicManifestRow(
      row("medical", {
        lessons: [{ id: "MED-058-EXPLAIN-006", status: "ready" }],
      }),
      "medical"
    );
    expect(valid).not.toBeNull();
    const selected = resolveValidatedManifestSources(bundled, {
      medical: valid!,
    });
    expect(selected.medical).toMatchObject({
      source: "live",
      value: { lessons: [{ id: "MED-058-EXPLAIN-006", status: "ready" }] },
    });
    expect(selected.base.source).toBe("bundled");
    const bad = validatePublicManifestRow({
      ...row("base", { lessons: [] }),
      manifestBytes: 1,
    });
    expect(bad).toBeNull();
    expect(resolveValidatedManifestSources(bundled, {}).base.source).toBe(
      "bundled"
    );
  });

  it("cancels a hung reader and allows both bundled fallbacks within the deadline", async () => {
    const cancel = vi.fn();
    const rows = await readBoundedPublicManifestRows(
      () => new Promise<unknown[]>(() => {}),
      cancel,
      10
    ).catch(() => []);
    expect(cancel).toHaveBeenCalledTimes(1);
    const bundled = {
      base: { value: { lessons: [{ id: "base-safe" }] }, version: "base-file" },
      medical: {
        value: { lessons: [{ id: "med-safe" }] },
        version: "med-file",
      },
    };
    const result = resolveManifestSources(bundled, rows);
    expect(result.base.source).toBe("bundled");
    expect(result.medical.source).toBe("bundled");
  });

  it("does not cancel a completed read and remains safe if timeout cancellation throws", async () => {
    const cancel = vi.fn();
    expect(
      await readBoundedPublicManifestRows(
        async () => [row("base", { lessons: [] })],
        cancel,
        30
      )
    ).toHaveLength(1);
    expect(cancel).not.toHaveBeenCalled();
    await expect(
      readBoundedPublicManifestRows(
        () => new Promise<unknown[]>(() => {}),
        () => {
          throw new Error("cancel failure");
        },
        10
      )
    ).rejects.toThrow("deadline exceeded");
  });

  it("uses valid versioned live rows and rejects malformed or hash-mismatched rows", () => {
    const valid = row("base", { lessons: [{ id: "new-live-id" }] });
    expect(validatePublicManifestRow(valid, "base")?.value).toEqual({
      lessons: [{ id: "new-live-id" }],
    });
    expect(
      validatePublicManifestRow(
        { ...valid, manifestSha256: "0".repeat(64) },
        "base"
      )
    ).toBeNull();
    expect(
      validatePublicManifestRow({ ...valid, manifestJson: "[]" }, "base")
    ).toBeNull();
  });

  it("rejects a correctly hashed live row when it still contains producer-only paths or unknown output", () => {
    const unsafeButHashed = row("medical", {
      lessons: [
        {
          id: "MED-PRIVATE-ROW",
          title: "Would otherwise be valid",
          localAssets: { mp4: "/home/ubuntu/private/lesson.mp4" },
          sourceAuditPath: "/tmp/source-audit.json",
        },
      ],
    });
    expect(validatePublicManifestRow(unsafeButHashed, "medical")).toBeNull();
  });

  it("keeps base and medical feed rows isolated when one source is invalid or missing", () => {
    const sources = resolveManifestSources(
      {
        base: {
          value: { lessons: [{ id: "bundled-base" }] },
          version: "base-file",
        },
        medical: {
          value: { lessons: [{ id: "bundled-medical" }] },
          version: "medical-file",
        },
      },
      [
        row("base", { lessons: [{ id: "live-base" }] }),
        {
          ...row("medical", { lessons: [{ id: "bad-medical" }] }),
          manifestBytes: 1,
        },
      ]
    );
    expect(sources.base).toMatchObject({
      source: "live",
      value: { lessons: [{ id: "live-base" }] },
    });
    expect(sources.medical).toEqual({
      source: "bundled",
      value: { lessons: [{ id: "bundled-medical" }] },
      version: "medical-file",
    });
  });

  it("carries a newly live lesson ID in the selected base manifest for transcript lookup", () => {
    const sources = resolveManifestSources(
      {
        base: { value: { lessons: [] }, version: "base-file" },
        medical: { value: { lessons: [] }, version: "medical-file" },
      },
      [
        row("base", {
          lessons: [
            {
              id: "BASE-LIVE-NEW",
              title: "Live transcript",
              transcript: "New transcript body",
            },
          ],
        }),
      ]
    );
    const lesson = (
      sources.base.value as {
        lessons: Array<{ id: string; transcript: string }>;
      }
    ).lessons.find(candidate => candidate.id === "BASE-LIVE-NEW");
    expect(lesson?.transcript).toBe("New transcript body");
  });
});
