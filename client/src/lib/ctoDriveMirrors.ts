import type { QueueItem } from "./queue";

export type CTODriveMirror = {
  fileId: string;
  nativeUrl: string;
  previewUrl: string;
  openUrl: string;
};

// Only the 14 exact video copies approved for link-viewer access on 9 October 2026.
// No private folder/document identifiers, producer data or credentials belong here.
const APPROVED_CTO_VIDEOS: Record<
  string,
  { fileId: string; nativeUrl: string }
> = {
  "orientation-CTO-01": {
    fileId: "1Of4KbXUZL6wRqOaeLQbDGGDul6JUj6YC",
    nativeUrl: "/manus-storage/orientation-CTO-01_eaeb3a45.mp4",
  },
  "orientation-CTO-02": {
    fileId: "1XUkZQaH9B4LRwodizk0RLeFztHEuHpaZ",
    nativeUrl: "/manus-storage/orientation-CTO-02_a1b6b094.mp4",
  },
  "orientation-CTO-03": {
    fileId: "10j4U60tMbo4iT5BSuZefL6n9QaHq0ZVB",
    nativeUrl: "/manus-storage/orientation-CTO-03_8b0bca30.mp4",
  },
  "orientation-CTO-04": {
    fileId: "1SFy7w-4MA7jDYrcQ16_nsL_g-h8tDSPX",
    nativeUrl: "/manus-storage/orientation-CTO-04_da489429.mp4",
  },
  "orientation-CTO-05": {
    fileId: "1Ev61zPlJCJzB2iZQ29RlwLoEP6YRDqi0",
    nativeUrl: "/manus-storage/orientation-CTO-05_8506a638.mp4",
  },
  "orientation-CTO-06": {
    fileId: "1GBw-IK-CJFcPXvZ9ATWNDWNip5Zt47IO",
    nativeUrl: "/manus-storage/orientation-CTO-06_1ebb0849.mp4",
  },
  "orientation-CTO-07": {
    fileId: "1cJArgTyss_RzLkR8_F9XpudT_w8kMa28",
    nativeUrl: "/manus-storage/orientation-CTO-07_02e5b910.mp4",
  },
  "orientation-CTO-08": {
    fileId: "1vG6nLwx1sxEr4QZ8kTvNuIAwjStiy0HX",
    nativeUrl: "/manus-storage/orientation-CTO-08_0e2df562.mp4",
  },
  "orientation-CTO-09": {
    fileId: "1M4aObIuEYCTdVvXYWf7e3l9u1YrMy4Qv",
    nativeUrl: "/manus-storage/orientation-CTO-09_2e02be4e.mp4",
  },
  "pdf-0c0d1f064488-G002": {
    fileId: "1phcaq1QnY9wGOSGWdWPR4VVRZ5xzh00h",
    nativeUrl: "/manus-storage/pdf-0c0d1f064488-G002_a9ec6eb0.mp4",
  },
  "pdf-0c0d1f064488-G003": {
    fileId: "186gZ1MyYg0cfEKZd2m5J7ip0c16isbbC",
    nativeUrl: "/manus-storage/pdf-0c0d1f064488-G003_e7a11ba6.mp4",
  },
  "pdf-0c0d1f064488-G004": {
    fileId: "1L-5pJ0NxBIPI4a_4NVX0UKSh-WpzXFO7",
    nativeUrl: "/manus-storage/pdf-0c0d1f064488-G004_b0240b30.mp4",
  },
  "pdf-0c0d1f064488-L001": {
    fileId: "1IJeyy_Oik7SlW_PJPG4k0FMMLyaWa9XJ",
    nativeUrl: "/manus-storage/pdf-0c0d1f064488-L001_23f9953c.mp4",
  },
  "pdf-0c0d1f064488-L002": {
    fileId: "1rr0bAmTT_L49tmZara0ejeCzwqDjDnKN",
    nativeUrl: "/manus-storage/pdf-0c0d1f064488-L002_ce1fd327.mp4",
  },
};

export function getCTODriveMirror(
  item?: QueueItem
): CTODriveMirror | undefined {
  if (
    !item ||
    item.source !== "original" ||
    !item.isReady ||
    !/^CTO-0[1-9]$/.test(item.courseId)
  )
    return;
  if (!Object.hasOwn(APPROVED_CTO_VIDEOS, item.lessonId)) return;
  const mirror = APPROVED_CTO_VIDEOS[item.lessonId];
  // Each orientation belongs to its named course; all five roadmapping copies belong to CTO-01.
  const approvedCourseId = item.lessonId.startsWith("orientation-")
    ? item.lessonId.slice("orientation-".length)
    : "CTO-01";
  if (item.courseId !== approvedCourseId) return;
  // Match exact native asset identity; a revised lesson must not silently reuse an old mirror.
  if (item.url !== mirror.nativeUrl) return;
  return {
    ...mirror,
    previewUrl: `https://drive.google.com/file/d/${mirror.fileId}/preview`,
    openUrl: `https://drive.google.com/file/d/${mirror.fileId}/view`,
  };
}
