import type { CourseRecord } from "./catalog";
import {
  medicalReferenceCourse,
  parseMedicalSourceReferenceIndex,
  type MedicalSourceReference,
  type MedicalSourceReferenceIndex,
} from "./medicalSourceReferences";

export const MEDICAL_COURSE_SOURCE_DATA_FILE =
  "medical/course-source-data.c01170ce0de90eb1.json";

export type PubMedCitationMetadata = {
  pmid: string;
  title: string;
  journal: string;
  publicationDate: string;
  doi: string;
  sourceUrl: string;
  retrievedDate: string;
  status: "bibliographic_metadata_only";
};

export type MedicalCourseSourceData = {
  schemaVersion: 1;
  status: "bibliographic_data_not_approved_teaching";
  countedLectureMinutes: 0;
  approvedReading: false;
  topicsComplete: false;
  humanClinicalReviewStatus: "not performed";
  sourceIndex: MedicalSourceReferenceIndex;
  pubmedMetadata: Record<string, PubMedCitationMetadata>;
};

export type MedicalResearchReference = {
  reference: MedicalSourceReference;
  citationIdentity: "title_matches" | "title_differs" | "not_checked" | "source_link_only";
  pubmedMetadata?: PubMedCitationMetadata;
};

export type MedicalCourseResearchSources = {
  courseId: string;
  status: "reference_only" | "unavailable";
  indexedDate: string;
  references: MedicalResearchReference[];
  countedLectureMinutes: 0;
  approvedReading: false;
  topicsComplete: false;
  humanClinicalReviewStatus: "not performed";
};

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const keysOnly = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every(key => keys.includes(key));
const safeText = (value: unknown, max: number, empty = false): value is string =>
  typeof value === "string" && value.length <= max && (empty || value.trim().length > 0) &&
  !/\/home\/|\/tmp\/|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);

/** Bibliographic identity only: never a claim of clinical/source/full-text review. */
export function citationTitleMatches(submitted: string, actual: string): boolean {
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
  const proposed = normalize(submitted);
  const canonical = normalize(actual);
  return proposed === canonical || (canonical.length >= 20 && proposed.includes(canonical));
}

export function parseMedicalCourseSourceData(value: unknown): MedicalCourseSourceData {
  const fail = (): never => { throw new Error("Invalid medical bibliography data"); };
  if (!record(value) || !keysOnly(value, [
    "schemaVersion", "status", "countedLectureMinutes", "approvedReading", "topicsComplete",
    "humanClinicalReviewStatus", "sourceIndex", "pubmedMetadata",
  ]) || value.schemaVersion !== 1 || value.status !== "bibliographic_data_not_approved_teaching" ||
      value.countedLectureMinutes !== 0 || value.approvedReading !== false ||
      value.topicsComplete !== false || value.humanClinicalReviewStatus !== "not performed" ||
      !record(value.pubmedMetadata)) return fail();
  parseMedicalSourceReferenceIndex(value.sourceIndex);
  for (const [pmid, row] of Object.entries(value.pubmedMetadata)) {
    if (!/^\d{1,12}$/.test(pmid) || !record(row) || !keysOnly(row, [
      "pmid", "title", "journal", "publicationDate", "doi", "sourceUrl", "retrievedDate", "status",
    ]) || row.pmid !== pmid || !safeText(row.title, 6000) ||
        !safeText(row.journal, 2000, true) || !safeText(row.publicationDate, 150, true) ||
        !safeText(row.doi, 512, true) || (row.doi && !/^10\.\d{4,9}\/\S+$/.test(row.doi)) ||
        row.sourceUrl !== `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` ||
        typeof row.retrievedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.retrievedDate) ||
        row.status !== "bibliographic_metadata_only") return fail();
  }
  return value as unknown as MedicalCourseSourceData;
}

export function medicalCourseResearchSources(
  courseId: string,
  data: MedicalCourseSourceData
): MedicalCourseResearchSources | undefined {
  const course = medicalReferenceCourse(data.sourceIndex, courseId);
  if (!course) return undefined;
  return {
    courseId, status: "reference_only", indexedDate: data.sourceIndex.indexedDate,
    countedLectureMinutes: 0, approvedReading: false, topicsComplete: false,
    humanClinicalReviewStatus: "not performed",
    references: course.references.map(reference => {
      const url = new URL(reference.url);
      if (url.hostname !== "pubmed.ncbi.nlm.nih.gov") {
        return { reference, citationIdentity: "source_link_only" };
      }
      const pmid = url.pathname.replace(/^\/|\/$/g, "");
      const metadata = Object.hasOwn(data.pubmedMetadata, pmid) ? data.pubmedMetadata[pmid] : undefined;
      return {
        reference,
        citationIdentity: metadata
          ? citationTitleMatches(reference.title, metadata.title) ? "title_matches" : "title_differs"
          : "not_checked",
        ...(metadata ? { pubmedMetadata: metadata } : {}),
      };
    }),
  };
}

/** Adds one isolated field to a selected medical course; does not edit curriculum or hours. */
export function withMedicalResearchSources(
  course: CourseRecord,
  data: MedicalCourseSourceData | undefined
): CourseRecord {
  if (course.programId !== "med" || !/^MED-(?:X)?\d{3}$/.test(course.id)) return course;
  const researchSources: MedicalCourseResearchSources | undefined = data
    ? medicalCourseResearchSources(course.id, data)
    : { courseId: course.id, status: "unavailable", indexedDate: "", references: [],
        countedLectureMinutes: 0, approvedReading: false, topicsComplete: false,
        humanClinicalReviewStatus: "not performed" };
  return researchSources ? { ...course, researchSources } : course;
}

export function medicalReferencesForUnit(
  sources: MedicalCourseResearchSources | undefined,
  unitNumber: unknown
): MedicalResearchReference[] {
  const number = typeof unitNumber === "number" ? unitNumber :
    typeof unitNumber === "string" && /^\d+$/.test(unitNumber) ? Number(unitNumber) : NaN;
  if (sources?.status !== "reference_only" || !Number.isInteger(number)) return [];
  return sources.references.filter(row =>
    (row.citationIdentity === "title_matches" || row.citationIdentity === "source_link_only") &&
    row.reference.suggestedUnitNumbers.includes(number));
}
