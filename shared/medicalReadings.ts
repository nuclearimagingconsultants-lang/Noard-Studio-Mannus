export type MedicalReadingChapter = {
  episodeId: string;
  courseId: string;
  title: string;
  description?: string;
  educationalLimits: string;
  coverageGaps: string[];
  sourceUrls: string[];
  status: "source_prepared_not_rendered";
  videoProduced: false;
  measuredVideoSeconds: null;
  countedLectureMinutes: 0;
  humanClinicalReviewStatus: "not performed";
  sourceReviewStatus: "passed_automated_source_check";
  sourceScriptSha256: string;
  visualSha256: string;
  evidenceSelectionSha256: string;
  reviewedAt: string;
  reviewedSources: { url: string; textSha256: string }[];
  sourceLimitations: string;
  sections: {
    title: string;
    narration: string;
    teachingLabels?: string[];
    visualPlan?: string;
  }[];
};

export type MedicalReadingResponse = {
  courseId: string;
  chapters: MedicalReadingChapter[];
  withheldCount: number;
  development?: MedicalReadingDevelopment;
};

export type MedicalReadingDevelopment = {
  courseId: string;
  episodeId: string;
  status: "source_review_pending" | "source_unavailable" | "source_checked";
};

export const medicalCourseIdPattern = /^MED-(?:X)?\d{3}$/;
export const medicalChapterIdPattern = /^MED-(?:X)?\d{3}-EXPLAIN-\d{3,5}$/;
const shaPattern = /^[a-f0-9]{64}$/;
const privatePath =
  /file:\/\/|(?:^|[\s("'`=:])\/(?:home|tmp|var|root|etc|proc|sys|dev|mnt|opt)\/|(?:^|[\s("'`=:])[A-Z]:[\\/]|\\\\[a-z0-9._-]+\\/i;

function hasPrivateLocation(value: string): boolean {
  // Source citations can legitimately contain a publisher's /home/ path.
  const text = value.replace(/https?:\/\/[^\s"'<>]+/gi, "");
  return privatePath.test(text);
}

function containsPrivateLocation(value: unknown): boolean {
  if (typeof value === "string") return hasPrivateLocation(value);
  if (Array.isArray(value)) return value.some(containsPrivateLocation);
  if (value && typeof value === "object")
    return Object.values(value).some(containsPrivateLocation);
  return false;
}

export function validateMedicalReadingDevelopment(
  value: unknown,
  courseId: string
): value is MedicalReadingDevelopment {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Object.keys(item).every(key =>
      ["courseId", "episodeId", "status"].includes(key)
    ) &&
    item.courseId === courseId &&
    medicalCourseIdPattern.test(courseId) &&
    typeof item.episodeId === "string" &&
    medicalChapterIdPattern.test(item.episodeId) &&
    item.episodeId.startsWith(`${courseId}-EXPLAIN-`) &&
    ["source_review_pending", "source_unavailable", "source_checked"].includes(
      String(item.status)
    )
  );
}

function isPublicHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || /\.(?:localhost|local|internal)$/.test(host))
    return false;
  if (host.includes(":")) {
    return (
      host !== "::" &&
      host !== "::1" &&
      !/^f[cd]|^fe[89ab]|^::ffff:/i.test(host)
    );
  }
  const address = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!address) return true;
  const [a, b] = address.slice(1).map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isPublicReadingSource(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      isPublicHostname(url.hostname) &&
      !hasPrivateLocation(value)
    );
  } catch {
    return false;
  }
}

export function validateMedicalReading(
  value: unknown,
  courseId: string
): value is MedicalReadingChapter {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !medicalCourseIdPattern.test(courseId)
  )
    return false;
  const item = value as Record<string, unknown>;
  const allowed = new Set([
    "episodeId",
    "courseId",
    "title",
    "description",
    "educationalLimits",
    "coverageGaps",
    "sourceUrls",
    "status",
    "videoProduced",
    "measuredVideoSeconds",
    "countedLectureMinutes",
    "humanClinicalReviewStatus",
    "sourceReviewStatus",
    "sourceScriptSha256",
    "visualSha256",
    "evidenceSelectionSha256",
    "reviewedAt",
    "reviewedSources",
    "sourceLimitations",
    "sections",
  ]);
  if (
    Object.keys(item).some(key => !allowed.has(key)) ||
    containsPrivateLocation(item)
  )
    return false;
  if (
    item.courseId !== courseId ||
    typeof item.episodeId !== "string" ||
    !medicalChapterIdPattern.test(item.episodeId) ||
    !item.episodeId.startsWith(`${courseId}-EXPLAIN-`)
  )
    return false;
  if (
    item.status !== "source_prepared_not_rendered" ||
    item.videoProduced !== false ||
    item.measuredVideoSeconds !== null ||
    item.countedLectureMinutes !== 0 ||
    item.humanClinicalReviewStatus !== "not performed" ||
    item.sourceReviewStatus !== "passed_automated_source_check"
  )
    return false;
  if (
    ![
      item.sourceScriptSha256,
      item.visualSha256,
      item.evidenceSelectionSha256,
    ].every(hash => typeof hash === "string" && shaPattern.test(hash))
  )
    return false;
  if (
    ![item.title, item.educationalLimits, item.sourceLimitations].every(
      text => typeof text === "string" && text.trim().length > 0
    )
  )
    return false;
  if (
    typeof item.reviewedAt !== "string" ||
    !Number.isFinite(Date.parse(item.reviewedAt))
  )
    return false;
  if (
    !Array.isArray(item.coverageGaps) ||
    !item.coverageGaps.length ||
    !item.coverageGaps.every(
      text => typeof text === "string" && text.trim().length > 0
    )
  )
    return false;
  if (
    !Array.isArray(item.sourceUrls) ||
    !item.sourceUrls.length ||
    !item.sourceUrls.every(isPublicReadingSource)
  )
    return false;
  if (
    !Array.isArray(item.reviewedSources) ||
    !item.reviewedSources.length ||
    !item.reviewedSources.every(
      source =>
        source &&
        typeof source === "object" &&
        Object.keys(source).every(key => ["url", "textSha256"].includes(key)) &&
        isPublicReadingSource(source.url) &&
        item.sourceUrls instanceof Array &&
        item.sourceUrls.includes(source.url) &&
        typeof source.textSha256 === "string" &&
        shaPattern.test(source.textSha256)
    )
  )
    return false;
  return (
    Array.isArray(item.sections) &&
    item.sections.length > 0 &&
    item.sections.every(
      section =>
        section &&
        typeof section === "object" &&
        Object.keys(section).every(key =>
          ["title", "narration", "teachingLabels", "visualPlan"].includes(key)
        ) &&
        typeof section.title === "string" &&
        section.title.trim() &&
        typeof section.narration === "string" &&
        section.narration.trim() &&
        (section.teachingLabels === undefined ||
          (Array.isArray(section.teachingLabels) &&
            section.teachingLabels.every(
              (label: unknown) => typeof label === "string"
            ))) &&
        (section.visualPlan === undefined ||
          typeof section.visualPlan === "string")
    )
  );
}
