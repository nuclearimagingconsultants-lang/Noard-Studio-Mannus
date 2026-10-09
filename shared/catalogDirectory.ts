import type {
  CatalogData,
  CourseRecord,
  DocumentRecord,
  DownloadRecord,
  MedicalOfficialProgramme,
  MedicalSchool,
  ProgramRecord,
  UnitMapRecord,
} from "./catalog";
import {
  getMedicalMetadata,
  isMedicalCourse,
  isMedicalCourseReady,
  summarizeMedicalHours,
  validateMedicalCourse,
} from "./medical";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function copyStringArray(value: string[] | undefined): string[] | undefined {
  return value ? [...value] : undefined;
}

function selectProgram(program: ProgramRecord): ProgramRecord {
  return {
    id: program.id,
    name: program.name,
    fullName: program.fullName,
    description: program.description,
    outlineUrl: program.outlineUrl,
    courseCount: program.courseCount,
    verifiedExternalHours: program.verifiedExternalHours,
    prerequisites: program.prerequisites,
    schedule: program.schedule,
    capstone: program.capstone,
    accessNotes: program.accessNotes,
    limitations: program.limitations,
    guideUrl: program.guideUrl,
    credentialType: program.credentialType,
  };
}

function selectUnitMap(
  units: UnitMapRecord[] | undefined
): UnitMapRecord[] | undefined {
  return units?.map(unit => ({
    number: unit.number,
    text: unit.text,
    coverage: unit.coverage,
    lectureIds: copyStringArray(unit.lectureIds),
    viewingSequence: copyStringArray(unit.viewingSequence),
  }));
}

function selectOfficialProgrammes(
  value: MedicalOfficialProgramme[] | undefined
): MedicalOfficialProgramme[] | undefined {
  return value?.map(programme => {
    if (!isRecord(programme)) return {} as MedicalOfficialProgramme;
    return {
      institution: programme.institution,
      name: programme.name,
    };
  });
}

/**
 * Selects only the compact external-lecture fields used to construct public
 * programme queues. It deliberately excludes curriculum evidence, transcripts,
 * question banks, and other workspace-only source detail.
 */
function selectLectures(course: CourseRecord) {
  return course.lectures?.map(lecture => ({
    id: lecture.id,
    title: lecture.title,
    url: lecture.url,
    provider: lecture.provider,
    durationSeconds: lecture.durationSeconds,
    sourceUrl: lecture.sourceUrl,
    accessVerified: lecture.accessVerified,
  }));
}

function selectCourse(course: CourseRecord): CourseRecord {
  const medicalCourse = isMedicalCourse(course);
  const directoryCourse: CourseRecord = {
    id: course.id,
    programId: course.programId,
    title: course.title,
    term: course.term,
    level: course.level,
    studyHours: course.studyHours,
    coverageStatus: course.coverageStatus,
    syllabusUrl: course.syllabusUrl,
    // Base-programme directory routes construct their Play All queues here.
    // Medical Play All loads an untouched scope=program workspace instead, so
    // retaining its many lecture and unit records in this response is wasteful.
    ...(medicalCourse
      ? {}
      : {
          lectures: selectLectures(course),
          unitMap: selectUnitMap(course.unitMap),
        }),
  };

  if (!medicalCourse) return directoryCourse;

  const metadata = getMedicalMetadata(course);
  const validationIssues = validateMedicalCourse(course);
  const medicalHours = summarizeMedicalHours(course);
  return {
    ...directoryCourse,
    family: metadata.family,
    trackType: metadata.trackType,
    boardNames: copyStringArray(metadata.boardNames),
    boardStatus: metadata.boardStatus,
    boardEligibilityNotice: metadata.boardEligibilityNotice,
    targetVideoHours: metadata.targetVideoHours,
    verifiedExternalHours: metadata.verifiedExternalHours,
    verifiedGeneratedHours: metadata.verifiedGeneratedHours,
    verifiedTotalHours: metadata.verifiedTotalHours,
    verifiedSpecialtyHours: metadata.verifiedSpecialtyHours,
    verifiedFoundationHours: metadata.verifiedFoundationHours,
    hoursGap: metadata.hoursGap,
    clinicalTrainingNotReplaced: metadata.clinicalTrainingNotReplaced,
    humanClinicalReviewStatus: metadata.humanClinicalReviewStatus,
    officialProgrammes: selectOfficialProgrammes(metadata.officialProgrammes),
    // This outcome is computed from the untouched full record. Omitting the
    // detailed arrays below must not turn an incomplete course into a ready one.
    directoryMedicalValidation: {
      source: "full-catalog",
      issues: [...validationIssues],
      isReady: isMedicalCourseReady(course),
      unknownDurationCount: medicalHours.unknownDurationCount,
    },
  };
}

function selectDocument(document: DocumentRecord): DocumentRecord {
  return {
    id: document.id,
    title: document.title,
    author: document.author,
    sourceUrl: document.sourceUrl,
    licenseNote: document.licenseNote,
    programIds: copyStringArray(document.programIds),
    storageUrl: document.storageUrl,
  };
}

function selectDownload(download: DownloadRecord): DownloadRecord {
  return {
    id: download.id,
    title: download.title,
    kind: download.kind,
    url: download.url,
  };
}

function selectMedicalSchool(
  school: MedicalSchool | undefined
): MedicalSchool | undefined {
  if (!school) return undefined;
  return {
    label: school.label,
    status: school.status,
    state: school.state,
    catalogueStatus: school.catalogueStatus,
    minimumTargetVideoHoursPerSpecialty:
      school.minimumTargetVideoHoursPerSpecialty,
    noAffiliationNotice: school.noAffiliationNotice,
    clinicalTrainingNotice: school.clinicalTrainingNotice,
    patientDataNotice: school.patientDataNotice,
    mediaReadinessNotice: school.mediaReadinessNotice,
    humanClinicalReviewStatus: school.humanClinicalReviewStatus,
    researchGaps: copyStringArray(school.researchGaps),
  };
}

/**
 * Produces the public directory projection without mutating its full canonical
 * input. Full curriculum data remains available to targeted workspace/snapshot
 * readers; this result contains only fields rendered by directory, library,
 * study-board, dashboard, and programme routes.
 */
export function selectCatalogDirectory(full: CatalogData): CatalogData {
  return {
    programs: full.programs.map(selectProgram),
    courses: full.courses.map(selectCourse),
    documents: full.documents.map(selectDocument),
    downloads: full.downloads.map(selectDownload),
    stats: full.stats ? { ...full.stats } : undefined,
    credentialNotice: full.credentialNotice,
    medicalSchool: selectMedicalSchool(full.medicalSchool),
  };
}

/** Full details remain on the selected course; queue peers need only transport fields. */
export function selectCourseForProgramQueue(
  course: CourseRecord
): CourseRecord {
  return {
    ...selectCourse(course),
    pdfIds: copyStringArray(course.pdfIds),
    lectures: selectLectures(course),
    unitMap: selectUnitMap(course.unitMap),
  };
}
