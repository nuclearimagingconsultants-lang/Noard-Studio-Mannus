import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { QueueItem } from "./queue";
import { getCTODriveMirror } from "./ctoDriveMirrors";
import { MediaPlayer } from "../components/studio/MediaPlayer";
import {
  CTODrivePlaybackNotice,
  CTODrivePreview,
} from "../components/studio/CTODrivePreview";

const item: QueueItem = {
  queueId: "original:orientation-CTO-01",
  lessonId: "orientation-CTO-01",
  courseId: "CTO-01",
  title: "Technology strategy",
  url: "/manus-storage/orientation-CTO-01_eaeb3a45.mp4",
  captionUrl: "/manus-storage/captions.vtt",
  source: "original",
  isReady: true,
};

describe("approved CTO Drive mirrors", () => {
  it("matches exactly the fourteen ready CTO-exclusive native assets without changing canonical records", () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL("../../../data/original-lectures.json", import.meta.url),
        "utf8"
      )
    );
    const exclusive = manifest.lessons.filter(
      (row: any) =>
        row.status === "ready" &&
        row.programIds?.length === 1 &&
        row.programIds[0] === "cto"
    );
    expect(exclusive).toHaveLength(14);
    const mirrors = exclusive.map((row: any) =>
      getCTODriveMirror({
        ...item,
        courseId: row.courseIds[0],
        lessonId: row.id,
        queueId: `original:${row.id}`,
        url: row.videoUrl,
      })
    );
    expect(mirrors.every(Boolean)).toBe(true);
    expect(new Set(mirrors.map((mirror: any) => mirror.fileId)).size).toBe(14);
    expect(
      mirrors.every((mirror: any) =>
        /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/preview$/.test(
          mirror.previewUrl
        )
      )
    ).toBe(true);
  });

  it("rejects another program, an external/planned clip, inherited key or revised native identity", () => {
    for (const changed of [
      { courseId: "AI-01" },
      { courseId: "MED-001" },
      { courseId: "MBA-01" },
      { courseId: "CTO-02" },
      { source: "university" as const },
      { isReady: false },
      { lessonId: "constructor" },
      { lessonId: "pdf-shared-L001" },
      { url: "/manus-storage/orientation-CTO-01_revised.mp4" },
      {
        url: "https://evil.test/manus-storage/orientation-CTO-01_eaeb3a45.mp4",
      },
    ])
      expect(getCTODriveMirror({ ...item, ...changed })).toBeUndefined();
    expect(getCTODriveMirror()).toBeUndefined();
  });

  it("defaults to native captioned playback and exposes Drive only as an explicit choice", () => {
    const handlers = {
      onEnded: vi.fn(),
      onPosition: vi.fn(),
      onSkip: vi.fn(),
      onStart: vi.fn(),
    };
    const markup = renderToStaticMarkup(
      <MediaPlayer
        item={item}
        queueActive={false}
        restoredPosition={0}
        {...handlers}
      />
    );
    expect(markup).toContain("Google Drive preview");
    expect(markup).toContain("Studio playback");
    expect(markup).toContain("<video");
    expect(markup).toContain('kind="captions"');
    expect(markup).not.toContain("<iframe");
    Object.values(handlers).forEach(handler =>
      expect(handler).not.toHaveBeenCalled()
    );
  });

  it("does not offer Drive for medical or AI native playback", () => {
    const markup = renderToStaticMarkup(
      <MediaPlayer
        item={{ ...item, courseId: "MED-001" }}
        queueActive={false}
        restoredPosition={0}
        onEnded={() => {}}
        onPosition={() => {}}
        onSkip={() => {}}
        onStart={() => {}}
      />
    );
    expect(markup).not.toContain("Google Drive preview");
    expect(markup).toContain("<video");
  });

  it("renders an exact public Drive preview without fake playback callbacks or completion claims", () => {
    const mirror = getCTODriveMirror(item)!;
    const markup = renderToStaticMarkup(
      <>
        <CTODrivePreview mirror={mirror} title={item.title} />
        <CTODrivePlaybackNotice />
      </>
    );
    expect(markup).toContain(mirror.previewUrl);
    expect(markup).toContain("Use Next manually");
    expect(markup).toContain("does not report playback position or completion");
    expect(markup).toContain("synchronized English captions");
    expect(markup).not.toContain("Queue started");
    const source = readFileSync(
      new URL("../components/studio/CTODrivePreview.tsx", import.meta.url),
      "utf8"
    );
    expect(source).not.toMatch(/on(?:Load|Ended|PlaybackTime|Start)=/);
  });
});
