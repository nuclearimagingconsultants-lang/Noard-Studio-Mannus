import type {
  CatalogData,
  CourseRecord,
  LectureRecord,
  OriginalLecturesData,
} from "@shared/catalog";
import { isMedicalCourse } from "@shared/medical";
import { isPublishableReadyOriginal } from "@shared/publicMedia.mjs";

export type QueueFilter = "all" | "original" | "university";
export type QueueSource = "original" | "university";
export type QueueItem = {
  queueId: string;
  lessonId: string;
  courseId: string;
  title: string;
  url: string;
  sourceUrl?: string;
  source: QueueSource;
  provider?: string;
  durationSeconds?: number;
  unitLabel?: string;
  isReady: boolean;
  sourceId?: string;
  sourcePages?: number[];
  captionUrl?: string;
  transcriptUrl?: string;
  coverageStatus?: string;
  sourceKind?: string;
  isInstructional?: boolean;
};

const NATIVE_EXTENSIONS = /\.(mp4|webm|ogg|ogv|m4v)(?:$|[?#])/i;
export function isNativeMediaUrl(url?: string): boolean {
  return Boolean(url && NATIVE_EXTENSIONS.test(url));
}

export function parseYouTubeUrl(url?: string): {
  videoId?: string;
  playlistId?: string;
} {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const playlistId = parsed.searchParams.get("list") ?? undefined;
    if (host === "youtu.be")
      return {
        videoId: parsed.pathname.split("/").filter(Boolean)[0],
        playlistId,
      };
    if (
      [
        "youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
      ].includes(host)
    ) {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const candidate =
        parsed.searchParams.get("v") ??
        (["embed", "shorts", "live"].includes(pathParts[0] ?? "")
          ? pathParts[1]
          : undefined);
      return { videoId: candidate ?? undefined, playlistId };
    }
  } catch {
    /* A source link remains a fallback, not fabricated playback. */
  }
  return {};
}

export function youTubeEmbedUrl(url: string): string | null {
  const { videoId, playlistId } = parseYouTubeUrl(url);
  if (!videoId && !playlistId) return null;
  const params = new URLSearchParams({ enablejsapi: "1", rel: "0" });
  if (typeof window !== "undefined")
    params.set("origin", window.location.origin);
  if (playlistId) params.set("list", playlistId);
  return videoId
    ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params}`
    : `https://www.youtube.com/embed/videoseries?${params}`;
}

const VIMEO_HOSTS = new Set([
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
]);
type VimeoEmbedUrl = `https://player.vimeo.com/video/${string}`;

export function parseVimeoUrl(url?: string): {
  videoId?: string;
  hash?: string;
} {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return {};
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (!VIMEO_HOSTS.has(host)) return {};
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const candidate =
      host === "player.vimeo.com"
        ? pathParts[0] === "video" && /^\d+$/.test(pathParts[1] ?? "")
          ? pathParts[1]
          : undefined
        : [...pathParts].reverse().find(part => /^\d+$/.test(part));
    if (!candidate) return {};
    const hash = parsed.searchParams.get("h") || undefined;
    return { videoId: candidate, hash };
  } catch {
    /* An untrusted or malformed link remains an honest source fallback. */
  }
  return {};
}

export function vimeoEmbedUrl(url?: string): VimeoEmbedUrl | null {
  const { videoId, hash } = parseVimeoUrl(url);
  if (!videoId) return null;
  const params = new URLSearchParams();
  if (hash) params.set("h", hash);
  const query = params.toString();
  return `https://player.vimeo.com/video/${encodeURIComponent(videoId)}${query ? `?${query}` : ""}` as VimeoEmbedUrl;
}

export function canonicalExternalUrl(url?: string): string {
  if (!url) return "";
  const { videoId: vimeoVideoId } = parseVimeoUrl(url);
  if (vimeoVideoId) return `vimeo:${vimeoVideoId}`;
  try {
    const parsed = new URL(url);
    const { videoId, playlistId } = parseYouTubeUrl(url);
    // One recording is still one recording when linked through different playlists.
    if (videoId) return `youtube:${videoId}:`;
    if (playlistId) return `youtube:playlist:${playlistId}`;
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "feature")
        parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function supportsExternalEmbed(url?: string): boolean {
  return Boolean(
    isNativeMediaUrl(url) ||
      (url && youTubeEmbedUrl(url)) ||
      parseVimeoUrl(url).videoId
  );
}

function externalPlaybackUrls(lecture: LectureRecord): {
  url?: string;
  sourceUrl?: string;
} {
  const candidates = [lecture.url, lecture.sourceUrl].filter(
    (url): url is string => Boolean(url)
  );
  const url = candidates.find(supportsExternalEmbed) ?? candidates[0];
  return {
    url,
    // A course page is the useful fallback when the playable source is an embed URL.
    sourceUrl:
      url && url !== lecture.url ? lecture.url || lecture.sourceUrl : lecture.sourceUrl,
  };
}

function externalLectureQueue(course: CourseRecord): QueueItem[] {
  const lectureIdsByUnit = new Map<string, string>();
  const preferredLectureIds: string[] = [];
  (course.unitMap ?? []).forEach(unit => {
    const label =
      typeof unit.number === "number" || typeof unit.number === "string"
        ? `Unit ${unit.number}`
        : undefined;
    (unit.lectureIds ?? []).forEach(lectureId =>
      lectureIdsByUnit.set(lectureId, label ?? "")
    );
    (unit.viewingSequence?.length
      ? unit.viewingSequence
      : (unit.lectureIds ?? [])
    ).forEach(lectureId => {
      // Some legacy viewing sequences are explanatory prose; only valid IDs enter a queue.
      if (
        typeof lectureId === "string" &&
        !preferredLectureIds.includes(lectureId)
      )
        preferredLectureIds.push(lectureId);
    });
  });
  const lecturesById = new Map(
    (course.lectures ?? []).map(lecture => [lecture.id, lecture])
  );
  const ordered = [
    ...preferredLectureIds
      .map(id => lecturesById.get(id))
      .filter((lecture): lecture is NonNullable<typeof lecture> =>
        Boolean(lecture)
      ),
    ...(course.lectures ?? []).filter(
      lecture => !preferredLectureIds.includes(lecture.id)
    ),
  ];
  const seen = new Set<string>();
  return ordered.flatMap(lecture => {
    const { url, sourceUrl } = externalPlaybackUrls(lecture);
    const key = canonicalExternalUrl(url);
    const hasMedicalEvidence =
      !isMedicalCourse(course) ||
      Boolean(
        lecture.url &&
          lecture.sourceUrl &&
          lecture.accessVerified === true &&
          typeof lecture.durationSeconds === "number" &&
          Number.isFinite(lecture.durationSeconds) &&
          lecture.durationSeconds > 0
      );
    if (!url || !key || !hasMedicalEvidence || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        queueId: `external:${course.id}:${lecture.id}`,
        lessonId: lecture.id,
        courseId: course.id,
        title: lecture.title || "Outside recording",
        url,
        sourceUrl,
        source: "university" as const,
        provider: lecture.provider,
        durationSeconds: lecture.durationSeconds,
        unitLabel: lectureIdsByUnit.get(lecture.id),
        isReady: true,
      },
    ];
  });
}

function originalLessonQueue(
  course: CourseRecord,
  media: OriginalLecturesData
): QueueItem[] {
  return media.lessons.flatMap(lesson => {
    const hasCourseAssignment = Boolean(lesson.courseIds?.length);
    const relevant = hasCourseAssignment
      ? lesson.courseIds!.includes(course.id)
      : (lesson.programIds ?? []).includes(course.programId);
    const playable = isPublishableReadyOriginal(lesson);
    if (!relevant || !playable) return [];
    return [
      {
        queueId: `original:${lesson.id}`,
        lessonId: lesson.id,
        courseId: course.id,
        title: lesson.title || "Original source video",
        url: lesson.videoUrl!,
        source: "original" as const,
        durationSeconds: lesson.durationSeconds,
        isReady: true,
        sourceId: lesson.sourceId,
        sourcePages: Array.isArray(lesson.sourcePages)
          ? lesson.sourcePages.filter(
              (page): page is number => typeof page === "number"
            )
          : undefined,
        captionUrl: lesson.captionUrl,
        transcriptUrl: lesson.transcriptUrl,
        coverageStatus: lesson.coverageStatus,
        sourceKind: lesson.sourceKind,
        isInstructional: lesson.isInstructional,
      },
    ];
  });
}

export function buildCourseQueue(
  course: CourseRecord,
  media: OriginalLecturesData,
  filter: QueueFilter = "all"
): QueueItem[] {
  const queue = [
    ...originalLessonQueue(course, media),
    ...externalLectureQueue(course),
  ];
  return filter === "all"
    ? queue
    : queue.filter(item => item.source === filter);
}

export function buildProgramQueue(
  catalog: CatalogData,
  media: OriginalLecturesData,
  programId: string,
  filter: QueueFilter = "all"
): QueueItem[] {
  const seen = new Set<string>();
  return catalog.courses
    .filter(course => course.programId === programId)
    .flatMap(course => buildCourseQueue(course, media, filter))
    .filter(item => {
      const key =
        item.source === "original"
          ? item.queueId
          : canonicalExternalUrl(item.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds < 1) return "Duration unavailable";
  const wholeMinutes = Math.round(seconds / 60);
  const hours = Math.floor(wholeMinutes / 60);
  const minutes = wholeMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}
