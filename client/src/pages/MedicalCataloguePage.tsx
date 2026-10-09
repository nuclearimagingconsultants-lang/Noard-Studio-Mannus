import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Clock3,
  Search,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import type { CourseRecord } from "@shared/catalog";
import {
  getMedicalMetadata,
  isMedicalCourse,
  isMedicalCourseReady,
  summarizeMedicalHours,
  validateMedicalCourse,
} from "@shared/medical";
import type { StudioViewProps } from "@/lib/studioTypes";
import { Metric, SectionHeading } from "@/components/studio/StudioPrimitives";

type Props = StudioViewProps;

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function formatHours(value: number | undefined) {
  return value === undefined ? "Unknown" : `${value.toFixed(value % 1 ? 1 : 0)} h`;
}

function courseSearchText(course: CourseRecord) {
  const metadata = getMedicalMetadata(course);
  const officialProgrammes = Array.isArray(metadata.officialProgrammes)
    ? metadata.officialProgrammes
        .map(programme => `${programme.institution} ${programme.name}`)
        .join(" ")
    : "";
  return [
    course.id,
    course.title,
    metadata.family,
    metadata.trackType,
    ...stringList(metadata.boardNames),
    officialProgrammes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function MedicalCataloguePage({ snapshot }: Props) {
  const { catalog } = snapshot;
  const school = catalog.medicalSchool;
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [trackType, setTrackType] = useState("all");
  const [board, setBoard] = useState("all");
  const courses = useMemo(
    () => catalog.courses.filter(isMedicalCourse),
    [catalog.courses]
  );
  const families = useMemo(
    () =>
      [...new Set(courses.map(course => getMedicalMetadata(course).family).filter((item): item is string => Boolean(item)))].sort(),
    [courses]
  );
  const trackTypes = useMemo(
    () =>
      [...new Set(courses.map(course => getMedicalMetadata(course).trackType).filter((item): item is string => Boolean(item)))].sort(),
    [courses]
  );
  const boards = useMemo(
    () =>
      [...new Set(courses.flatMap(course => stringList(getMedicalMetadata(course).boardNames)))].sort(),
    [courses]
  );
  const visibleCourses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courses.filter(course => {
      const metadata = getMedicalMetadata(course);
      return (
        (!needle || courseSearchText(course).includes(needle)) &&
        (family === "all" || metadata.family === family) &&
        (trackType === "all" || metadata.trackType === trackType) &&
        (board === "all" || stringList(metadata.boardNames).includes(board))
      );
    });
  }, [board, courses, family, query, trackType]);
  const readyCourses = courses.filter(isMedicalCourseReady).length;
  const unknownItems = courses.reduce(
    (total, course) => total + summarizeMedicalHours(course).unknownDurationCount,
    0
  );
  const gaps = stringList(school?.researchGaps);

  return (
    <div className="page-stack medical-catalogue">
      <header className="medical-header">
        <div>
          <p className="eyebrow">Independent specialty catalogue</p>
          <h1>{school?.label || "Harvard:John Med — independent study"}</h1>
          <p className="medical-lede">
            A curriculum-first Board Studio workspace for evidence-backed specialty study.
            It is deliberately separate from institutional enrolment, clinical training,
            and certification claims.
          </p>
          <p className="medical-status">
            <Stethoscope size={16} aria-hidden="true" />
            {school?.catalogueStatus || "Catalogue research is in progress; specialty records will appear only when their evidence packet is supplied."}
          </p>
        </div>
        <div className="medical-metrics">
          <Metric label="Specialty records" value={courses.length} note="Only imported CourseRecords are listed." />
          <Metric label="Hour evidence ready" value={readyCourses} note="Measured hours only; never a board, clinical, or eligibility claim." />
          <Metric label="Unknown durations" value={unknownItems} note="Never counted toward the specialty target." />
        </div>
      </header>

      <section className="medical-boundaries" aria-label="Medical study boundaries">
        <article>
          <ShieldAlert size={18} aria-hidden="true" />
          <div>
            <h2>Independent study, no affiliation</h2>
            <p>{school?.noAffiliationNotice || "No institutional affiliation, enrollment, certification, or endorsement is implied."}</p>
          </div>
        </article>
        <article>
          <BookOpenCheck size={18} aria-hidden="true" />
          <div>
            <h2>Clinical training remains essential</h2>
            <p>{school?.clinicalTrainingNotice || "Study material does not replace supervised clinical training or establish eligibility or licensure."}</p>
          </div>
        </article>
        <article>
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <h2>Cases and visuals</h2>
            <p>{school?.patientDataNotice || "Do not submit patient records. Future cases require lawful de-identification; synthetic visuals are labeled schematics."}</p>
          </div>
        </article>
      </section>

      <section>
        <SectionHeading
          index="MED"
          eyebrow="Search the research ledger"
          title="Specialty catalogue"
          action={<span className="medical-target"><Clock3 size={14} aria-hidden="true" />Minimum target: {school?.minimumTargetVideoHoursPerSpecialty ?? 36} verified video hours per specialty</span>}
        />
        <div className="medical-controls" aria-label="Medical catalogue filters">
          <label className="search-control">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search specialties</span>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search specialty, track, institution, or board" />
          </label>
          <label className="select-control">
            <span>Family</span>
            <select value={family} onChange={event => setFamily(event.target.value)}>
              <option value="all">All families</option>
              {families.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="select-control">
            <span>Type</span>
            <select value={trackType} onChange={event => setTrackType(event.target.value)}>
              <option value="all">Residency, fellowship & supplementary</option>
              {trackTypes.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="select-control">
            <span>Certifying board</span>
            <select value={board} onChange={event => setBoard(event.target.value)}>
              <option value="all">All boards</option>
              {boards.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {courses.length === 0 ? (
          <div className="medical-empty-ledger">
            <span className="course-badge">RESEARCH HOLD</span>
            <h2>No specialty CourseRecords have been imported</h2>
            <p>
              This scaffold intentionally contains zero courses, zero verified media,
              zero original questions, and zero clinical case links. Research owners will
              add specialty overlay rows only after official scope and media evidence are available.
            </p>
            {gaps.length > 0 && <ul>{gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>}
          </div>
        ) : visibleCourses.length ? (
          <div className="medical-course-list">
            {visibleCourses.map(course => {
              const metadata = getMedicalMetadata(course);
              const hours = summarizeMedicalHours(course);
              const issues = validateMedicalCourse(course);
              const isReady = isMedicalCourseReady(course);
              return (
                <article className="medical-course-row" key={course.id}>
                  <div className="medical-course-title">
                    <div className="medical-tags">
                      <span>{metadata.family || "Family pending"}</span>
                      <span>{metadata.trackType || "Track type pending"}</span>
                    </div>
                    <span className="course-badge">{course.id}</span>
                    <h2>{course.title}</h2>
                    <p>{stringList(metadata.boardNames).join(" · ") || "Certifying board scope pending"}</p>
                  </div>
                  <dl className="medical-hours-ledger">
                    <div><dt>Target</dt><dd>{formatHours(hours.targetHours)}</dd></div>
                    <div><dt>Outside</dt><dd>{formatHours(hours.verifiedExternalHours)}</dd></div>
                    <div><dt>Generated original</dt><dd>{formatHours(hours.verifiedGeneratedHours)}</dd></div>
                    <div><dt>Combined</dt><dd>{formatHours(hours.verifiedTotalHours)}</dd></div>
                    <div><dt>Gap</dt><dd>{formatHours(hours.calculatedGapHours)}</dd></div>
                    <div><dt>Unknown</dt><dd>{hours.unknownDurationCount} item{hours.unknownDurationCount === 1 ? "" : "s"}</dd></div>
                  </dl>
                  <div className="medical-course-status">
                    <strong className={isReady ? "is-ready" : "is-pending"}>{isReady ? "Hour evidence ready" : "Evidence incomplete"}</strong>
                    <span>{issues.length ? `${issues.length} validation gap${issues.length === 1 ? "" : "s"}` : "No schema gaps detected"}</span>
                    <Link href={`/course/${encodeURIComponent(course.id)}`} className="text-action">Open specialty workspace <ArrowRight size={14} aria-hidden="true" /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted-copy">No imported specialty matches these filters.</p>
        )}
      </section>

      <p className="medical-evidence-note">
        <Clock3 size={16} aria-hidden="true" />
        {school?.mediaReadinessNotice || "Outside, qualifying generated-original, and combined hours are shown separately. Planned clips and unknown-duration items are never counted."}
        {school?.humanClinicalReviewStatus === "not performed" ? " Automated source review is not human clinician review." : ""}
      </p>
    </div>
  );
}
