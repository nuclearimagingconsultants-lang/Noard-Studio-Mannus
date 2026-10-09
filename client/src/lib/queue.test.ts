import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CourseRecord, OriginalLecturesData } from "../../../shared/catalog";
import {
  buildCourseQueue,
  buildProgramQueue,
  canonicalExternalUrl,
  parseVimeoUrl,
  parseYouTubeUrl,
  vimeoEmbedUrl,
} from "./queue";

const course: CourseRecord = {
  id: "AI-01",
  programId: "ai",
  title: "Queue test",
  lectures: [
    { id: "l-1", title: "First", url: "https://www.youtube.com/watch?v=abc123&utm_source=test", durationSeconds: 61, provider: "University" },
    { id: "l-2", title: "Duplicate", url: "https://youtu.be/abc123", durationSeconds: 61, provider: "University" },
    { id: "l-3", title: "Second", url: "https://youtu.be/xyz987?list=PL_test", durationSeconds: 75, provider: "University" },
  ],
  unitMap: [{ number: 1, lectureIds: ["l-1", "l-2"] }, { number: 2, lectureIds: ["l-3"] }],
};

const media: OriginalLecturesData = {
  lessons: [
    { id: "o-ready", title: "Ready native", courseIds: ["AI-01"], status: "ready", videoUrl: "/manus-storage/lesson.mp4", captionUrl: "/manus-storage/lesson.vtt", transcriptUrl: "/manus-storage/lesson.md", durationSeconds: 100 },
    { id: "o-no-duration", title: "Unmeasured", courseIds: ["AI-01"], status: "ready", videoUrl: "/manus-storage/unmeasured.mp4" },
    { id: "o-html", title: "HTML link", courseIds: ["AI-01"], status: "ready", videoUrl: "https://example.com/page", durationSeconds: 90 },
  ],
};

describe("learning queue", () => {
  it("keeps ready original first, preserves lecture order, and de-duplicates canonical outside URLs", () => {
    const queue = buildCourseQueue(course, media);
    expect(queue.map(item => item.queueId)).toEqual(["original:o-ready", "external:AI-01:l-1", "external:AI-01:l-3"]);
    expect(queue[1]?.unitLabel).toBe("Unit 1");
  });

  it("does not claim planned or unmeasured original entries are playable", () => {
    expect(buildCourseQueue(course, media, "original").map(item => item.lessonId)).toEqual(["o-ready"]);
  });

  it("does not put medical recordings in a ready queue without URL, duration, access, and source evidence", () => {
    const medical = {
      id: "MED-01",
      programId: "med",
      title: "Evidence gate",
      family: "Imaging",
      lectures: [
        { id: "missing-evidence", title: "Not ready", url: "https://example.test/not-ready" },
        { id: "ready", title: "Ready", url: "https://example.test/ready", sourceUrl: "https://example.test/source", durationSeconds: 120, accessVerified: true },
      ],
    } satisfies CourseRecord;
    expect(buildCourseQueue(medical, { lessons: [] }, "university").map(item => item.lessonId)).toEqual(["ready"]);
  });

  it("parses watch, short, and playlist URL forms consistently", () => {
    expect(parseYouTubeUrl("https://youtu.be/abc123?list=PL_test")).toEqual({ videoId: "abc123", playlistId: "PL_test" });
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=abc123&list=PL_test")).toEqual({ videoId: "abc123", playlistId: "PL_test" });
    expect(canonicalExternalUrl("https://www.youtube.com/watch?v=abc123&utm_source=test")).toBe("youtube:abc123:");
  });

  it("parses public and player Vimeo URLs, preserves an unlisted hash, and rejects lookalikes", () => {
    expect(parseVimeoUrl("https://vimeo.com/76979871")).toEqual({ videoId: "76979871", hash: undefined });
    expect(parseVimeoUrl("https://player.vimeo.com/video/76979871?h=8272103f6e")).toEqual({ videoId: "76979871", hash: "8272103f6e" });
    expect(vimeoEmbedUrl("https://vimeo.com/76979871?h=8272103f6e&utm_source=test")).toBe("https://player.vimeo.com/video/76979871?h=8272103f6e");
    expect(parseVimeoUrl("https://player.vimeo.com.evil.test/video/76979871")).toEqual({});
    expect(canonicalExternalUrl("https://player.vimeo.com.evil.test/video/76979871")).not.toBe("vimeo:76979871");
  });

  it("de-duplicates Vimeo recording IDs across player and public forms without losing the selected playback hash", () => {
    const vimeoCourse = {
      id: "AI-VIMEO",
      programId: "ai",
      title: "Vimeo queue",
      lectures: [
        { id: "v-1", title: "Unlisted", url: "https://player.vimeo.com/video/76979871?h=8272103f6e", durationSeconds: 60 },
        { id: "v-2", title: "Duplicate", url: "https://vimeo.com/76979871", durationSeconds: 60 },
      ],
    } satisfies CourseRecord;
    const queue = buildCourseQueue(vimeoCourse, { lessons: [] });
    expect(queue).toHaveLength(1);
    expect(queue[0]?.url).toBe("https://player.vimeo.com/video/76979871?h=8272103f6e");
    expect(canonicalExternalUrl("https://vimeo.com/76979871")).toBe(canonicalExternalUrl(queue[0]?.url));
  });

  it("keeps all 73 recovered MED-003 Vimeo recordings playable through their embedded source URLs", () => {
    const index = JSON.parse(
      readFileSync(new URL("../../../data/medical/catalog-index.json", import.meta.url), "utf8")
    ) as { coursePartById: Record<string, string> };
    const part = index.coursePartById["MED-003"];
    expect(part).toMatch(/^catalog-parts\/part-\d{3}\.json$/);
    const courses = JSON.parse(
      readFileSync(new URL(`../../../data/medical/${part}`, import.meta.url), "utf8")
    ) as CourseRecord[];
    const med003 = courses.find(course => course.id === "MED-003");
    expect(med003).toBeDefined();
    if (!med003) throw new Error("MED-003 must remain in the recovered medical catalog");
    const queue = buildCourseQueue(med003, { lessons: [] }, "university");
    expect(queue).toHaveLength(73);
    expect(new Set(queue.map(item => parseVimeoUrl(item.url).videoId)).size).toBe(73);
    expect(queue.every(item => Boolean(parseVimeoUrl(item.url).videoId))).toBe(true);
    expect(queue.every(item => Boolean(parseVimeoUrl(item.url).hash))).toBe(true);
    expect(queue[0]?.sourceUrl).toMatch(/^https:\/\/(radiologyresidentcorelectures\.com|thoracicrad\.org)\//);
  });

  it("does not attach another course's original lesson just because it shares a program", () => {
    const unrelated: OriginalLecturesData = { lessons: [{ id: "other", title: "Another course", programIds: ["ai"], courseIds: ["AI-02"], status: "ready", videoUrl: "/manus-storage/other.mp4", captionUrl: "/manus-storage/other.vtt", transcriptUrl: "/manus-storage/other.md", durationSeconds: 100 }] };
    expect(buildCourseQueue(course, unrelated, "original")).toEqual([]);
  });

  it("de-duplicates a shared original and outside recording across a whole program", () => {
    const second = { ...course, id: "AI-02" };
    const shared: OriginalLecturesData = { lessons: [{ id: "shared", title: "Shared mathematics", programIds: ["ai"], courseIds: ["AI-01", "AI-02"], status: "ready", videoUrl: "/manus-storage/shared.mp4", captionUrl: "/manus-storage/shared.vtt", transcriptUrl: "/manus-storage/shared.md", durationSeconds: 100 }] };
    const catalog = { programs: [], courses: [course, second], documents: [], downloads: [] };
    expect(buildProgramQueue(catalog, shared, "ai").length).toBe(3);
    expect(canonicalExternalUrl("https://youtu.be/xyz987?list=PL_other")).toBe(canonicalExternalUrl("https://youtu.be/xyz987?list=PL_test"));
  });
});
