export const MEDICAL_SOURCE_REFERENCE_ASSET =
  "/medical-source-references.8d2de4d25db32098.json";

export type MedicalSourceReference = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  citation: string;
  suggestedUnitNumbers: number[];
  status: "reference_only";
  countedLectureMinutes: 0;
};

export type MedicalSourceReferenceCourse = {
  courseId: string;
  courseTitle: string;
  references: MedicalSourceReference[];
};

export type MedicalSourceReferenceIndex = {
  schemaVersion: 1;
  indexedDate: string;
  status: "reference_map_not_approved_teaching";
  humanClinicalReviewStatus: "not performed";
  approvedReading: false;
  topicsComplete: false;
  countedLectureMinutes: 0;
  courseCount: number;
  referenceCount: number;
  courses: Record<string, MedicalSourceReferenceCourse>;
};

const sourceHosts = new Set([
  "pubmed.ncbi.nlm.nih.gov",
  "radiopaedia.org",
  "gravitas.acr.org",
  "www.ameriburn.org",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every(key => allowed.includes(key));
}

function isText(value: unknown, maximum = 6000): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    value.length <= maximum && !/\/home\/|\/tmp\//.test(value);
}

export function isSafeMedicalReferenceUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return value.startsWith("https://") && url.protocol === "https:" &&
      !url.username && !url.password && (!url.port || url.port === "443") &&
      sourceHosts.has(url.hostname);
  } catch {
    return false;
  }
}

/** Validate a citation-only public asset. It cannot authorize teaching or time. */
export function parseMedicalSourceReferenceIndex(
  value: unknown
): MedicalSourceReferenceIndex {
  const fail = (): never => {
    throw new Error("Invalid reference-only source map");
  };
  if (!isRecord(value) || !onlyKeys(value, [
    "schemaVersion", "indexedDate", "status", "humanClinicalReviewStatus",
    "approvedReading", "topicsComplete", "countedLectureMinutes",
    "courseCount", "referenceCount", "courses",
  ])) return fail();
  if (value.schemaVersion !== 1 || value.status !== "reference_map_not_approved_teaching" ||
      value.humanClinicalReviewStatus !== "not performed" || value.approvedReading !== false ||
      value.topicsComplete !== false || value.countedLectureMinutes !== 0 ||
      typeof value.indexedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.indexedDate) ||
      !isRecord(value.courses)) return fail();
  const courses = Object.entries(value.courses);
  if (courses.length === 0 || courses.length > 333 || value.courseCount !== courses.length) return fail();
  let referenceCount = 0;
  const ids = new Set<string>();
  for (const [courseId, entry] of courses) {
    if (!/^MED-(?:X)?\d{3}$/.test(courseId) || !isRecord(entry) ||
        !onlyKeys(entry, ["courseId", "courseTitle", "references"]) ||
        entry.courseId !== courseId || !isText(entry.courseTitle, 1000) ||
        !Array.isArray(entry.references) || entry.references.length > 3) return fail();
    const urls = new Set<string>();
    for (const reference of entry.references) {
      if (!isRecord(reference) || !onlyKeys(reference, [
        "id", "title", "url", "publisher", "citation", "suggestedUnitNumbers",
        "status", "countedLectureMinutes",
      ]) || !isText(reference.id, 100) || !reference.id.startsWith(courseId + "-REF-") ||
          ids.has(reference.id) || !isText(reference.title) || !isText(reference.publisher, 200) ||
          typeof reference.citation !== "string" || reference.citation.length > 6000 ||
          /\/home\/|\/tmp\//.test(reference.citation) || !isSafeMedicalReferenceUrl(reference.url) ||
          urls.has(reference.url) || reference.status !== "reference_only" ||
          reference.countedLectureMinutes !== 0 || !Array.isArray(reference.suggestedUnitNumbers) ||
          reference.suggestedUnitNumbers.some(number => !Number.isInteger(number) || number < 1 || number > 100) ||
          new Set(reference.suggestedUnitNumbers).size !== reference.suggestedUnitNumbers.length) return fail();
      ids.add(reference.id);
      urls.add(reference.url);
      referenceCount += 1;
    }
  }
  if (value.referenceCount !== referenceCount) return fail();
  return value as unknown as MedicalSourceReferenceIndex;
}

export function medicalReferenceCourse(
  index: MedicalSourceReferenceIndex,
  courseId: string
): MedicalSourceReferenceCourse | undefined {
  return Object.hasOwn(index.courses, courseId) ? index.courses[courseId] : undefined;
}
