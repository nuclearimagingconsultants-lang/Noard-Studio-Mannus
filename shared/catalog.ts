export type FlexibleField =
  | string
  | unknown[]
  | Record<string, unknown>
  | null
  | undefined;

export type ProgramRecord = {
  id: string;
  name: string;
  fullName?: string;
  description?: string;
  outlineUrl?: string;
  courseCount?: number;
  verifiedExternalHours?: number;
  plannedStudyHours?: number;
  prerequisites?: FlexibleField;
  schedule?: FlexibleField;
  capstone?: FlexibleField;
  accessNotes?: FlexibleField;
  limitations?: FlexibleField;
  guideUrl?: string;
  credentialType?: string;
};

export type LectureRecord = {
  id: string;
  localId?: string;
  title: string;
  url?: string;
  provider?: string;
  durationSeconds?: number;
  kind?: string;
  sourceUrl?: string;
  accessVerified?: boolean;
  coverageNote?: string;
  origin?: "external" | string;
};

export type UnitMapRecord = {
  number?: number | string;
  text?: string;
  coverage?: string;
  lectureIds?: string[];
  viewingSequence?: string[];
  coveredTopics?: string[];
  uncoveredTopics?: string[];
  [key: string]: unknown;
};

export type MedicalOfficialProgramme = {
  institution: string;
  name: string;
  /** Present in complete curriculum records; omitted from the directory projection. */
  url?: string;
  /** Present in complete curriculum records; omitted from the directory projection. */
  publicCurriculumNotes?: string;
  [key: string]: unknown;
};

export type MedicalPracticeOption = {
  id: string;
  text: string;
  [key: string]: unknown;
};

export type MedicalPracticeQuestion = {
  id: string;
  stem: string;
  options: MedicalPracticeOption[];
  correctOptionId: string;
  rationale: string;
  sourceUrls: string[];
  domain: string;
  fictionalCase: boolean;
  [key: string]: unknown;
};

/**
 * Future medical research may use the documented top-level course fields or this
 * nested object. The content validator reports malformed values rather than
 * silently treating incomplete evidence as ready.
 */
export type MedicalCourseMetadata = {
  family?: string;
  trackType?: string;
  boardNames?: string[];
  boardStatus?: FlexibleField;
  boardEligibilityNotice?: string;
  targetVideoHours?: number;
  verifiedExternalHours?: number;
  /** Server-derived hours from qualifying ready medical original lessons only. */
  verifiedGeneratedHours?: number;
  /** Server-derived sum of verified outside and qualifying original hours. */
  verifiedTotalHours?: number;
  verifiedSpecialtyHours?: number;
  verifiedFoundationHours?: number;
  hoursGap?: number;
  unknownDurationItems?: unknown[];
  clinicalTrainingNotReplaced?: boolean;
  humanClinicalReviewStatus?: string;
  officialProgrammes?: MedicalOfficialProgramme[];
  sourceCaveats?: unknown[];
  sourceReferences?: unknown[];
  originalClipPlan?: unknown[];
  practiceQuestions?: MedicalPracticeQuestion[];
  [key: string]: unknown;
};

export type MedicalSchool = {
  label?: string;
  status?: string;
  state?: string;
  catalogueStatus?: string;
  minimumTargetVideoHoursPerSpecialty?: number;
  noAffiliationNotice?: string;
  clinicalTrainingNotice?: string;
  patientDataNotice?: string;
  mediaReadinessNotice?: string;
  humanClinicalReviewStatus?: string;
  researchGaps?: string[];
  [key: string]: unknown;
};

/**
 * A read-only result calculated against a complete medical CourseRecord before
 * the directory removes curriculum-only fields. It is not source curriculum
 * input and must never be used to repair or infer missing medical evidence.
 */
export type MedicalDirectoryValidation = {
  source: "full-catalog";
  issues: string[];
  isReady: boolean;
  unknownDurationCount: number;
  lectureEvidenceValid?: boolean;
  hasExternalLectureEvidence?: boolean;
};

export type CourseRecord = {
  id: string;
  programId: string;
  title: string;
  term?: FlexibleField;
  level?: FlexibleField;
  prerequisites?: FlexibleField;
  objectives?: FlexibleField;
  units?: FlexibleField;
  assignment?: FlexibleField;
  assessment?: FlexibleField;
  studyHours?: number;
  mapping?: FlexibleField;
  primaryVideo?: string;
  primarySeries?: FlexibleField;
  lectures?: LectureRecord[];
  unitMap?: UnitMapRecord[];
  coverageStatus?: string;
  remainingGaps?: FlexibleField;
  pdfIds?: string[];
  readings?: FlexibleField;
  syllabusUrl?: string;
  /** Medical fields are direct so research JSON stays readable and portable. */
  family?: string;
  trackType?: string;
  boardNames?: string[];
  boardStatus?: FlexibleField;
  boardEligibilityNotice?: string;
  targetVideoHours?: number;
  verifiedExternalHours?: number;
  /** Derived by the content layer; raw curriculum declarations are overwritten. */
  verifiedGeneratedHours?: number;
  /** Derived by the content layer from verified outside and original time. */
  verifiedTotalHours?: number;
  verifiedSpecialtyHours?: number;
  verifiedFoundationHours?: number;
  hoursGap?: number;
  unknownDurationItems?: unknown[];
  clinicalTrainingNotReplaced?: boolean;
  humanClinicalReviewStatus?: string;
  officialProgrammes?: MedicalOfficialProgramme[];
  sourceCaveats?: unknown[];
  sourceReferences?: unknown[];
  originalClipPlan?: unknown[];
  practiceQuestions?: MedicalPracticeQuestion[];
  /** Genuine full-record validation outcome retained by selectCatalogDirectory. */
  directoryMedicalValidation?: MedicalDirectoryValidation;
  /** Optional nested equivalent accepted for research packet compatibility. */
  medical?: MedicalCourseMetadata;
};

export type DocumentRecord = {
  id: string;
  title: string;
  author?: string;
  relativePath?: string;
  aliases?: string[];
  pages?: number;
  sourceUrl?: string;
  licenseNote?: string;
  programIds?: string[];
  courseIds?: string[];
  storageUrl?: string;
};

export type DownloadRecord = {
  id: string;
  title: string;
  kind?: string;
  url?: string;
};

export type CatalogStats = {
  programs?: number;
  courses?: number;
  units?: number;
  referencePdfCopies?: number;
  uniqueReferencePdfs?: number;
  uniquePdfPages?: number;
  lectureEntries?: number;
};

export type CatalogData = {
  programs: ProgramRecord[];
  courses: CourseRecord[];
  documents: DocumentRecord[];
  downloads: DownloadRecord[];
  stats?: CatalogStats;
  productionOrder?: string[];
  credentialNotice?: string;
  medicalSchool?: MedicalSchool;
};

export type OriginalLesson = {
  id: string;
  title: string;
  sourceId?: string;
  programIds?: string[];
  courseIds?: string[];
  videoUrl?: string;
  transcriptUrl?: string;
  captionUrl?: string;
  durationSeconds?: number;
  status?: "ready" | "planned" | "blocked" | string;
  sourcePages?: FlexibleField;
  /** Measured source-PDF display windows from a rendered original video. */
  pageCues?: SourcePageCue[];
  coverageStatus?: string;
  sourceKind?: string;
  isInstructional?: boolean;
  /** Source records supporting an original medical lesson. */
  sourceUrls?: string[];
  /** Medical-specific source records, accepted alongside sourceUrls. */
  medicalSourceUrls?: string[];
  /** Per-lesson automated source-review gate for counted medical originals. */
  medicalSourceReviewStatus?: string;
  /** Counted medical originals remain explicitly unreviewed by a human clinician. */
  humanClinicalReviewStatus?: string;
  /** Exact producer-side source/render/evidence identities for new medical series records. */
  scriptSha256?: string;
  visualSha256?: string;
  evidenceSelectionSha256?: string;
  renderContentSha256?: string;
  /** Exact local/uploaded hashes for MP4, VTT, and transcript assets. */
  localAssetSha256?: Partial<Record<"mp4" | "vtt" | "transcript", string>>;
  uploadedAssetSha256?: Partial<Record<"mp4" | "vtt" | "transcript", string>>;
  description?: string;
  transcript?: string;
};

export type SourcePageCue = {
  start: number;
  end: number;
  page: number;
};

export type SourcePageLedgerEntry = {
  start_page?: number;
  end_page?: number;
  classification?: string;
  lesson_ids?: string[];
  reason?: string;
};

export type SourceCoverageEntry = {
  sourceId?: string;
  title?: string;
  pageCount?: number;
  substantivePages?: number;
  taughtPages?: number;
  plannedLessons?: number;
  readyLessons?: number;
  coverageStatus?: string;
  scopeNote?: string;
  gaps?: string[];
  pageLedger?: SourcePageLedgerEntry[];
  programIds?: string[];
};

export type OriginalLecturesData = {
  lessons: OriginalLesson[];
  sourceCoverage?: SourceCoverageEntry[];
  productionState?: FlexibleField;
  notes?: FlexibleField;
};

export type ContentSnapshot = {
  catalog: CatalogData;
  media: OriginalLecturesData;
  assetIndex: unknown | null;
  updatedAt: string;
};

export const emptyCatalog = (): CatalogData => ({
  programs: [],
  courses: [],
  documents: [],
  downloads: [],
  stats: {},
  productionOrder: [],
  credentialNotice: "",
});

export const emptyOriginalLectures = (): OriginalLecturesData => ({
  lessons: [],
  sourceCoverage: [],
  productionState: [],
  notes: [],
});
