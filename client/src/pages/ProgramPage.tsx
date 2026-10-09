import { useMemo } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BookOpenCheck,
  Clock3,
  ExternalLink,
  GraduationCap,
  Play,
  PlayCircle,
} from "lucide-react";
import type { OriginalLesson } from "@shared/catalog";
import { buildProgramQueue, type QueueFilter } from "@/lib/queue";
import { originalLessonLabel } from "@/lib/learningFlow";
import type { StudioViewProps } from "@/lib/studioTypes";
import {
  CourseBadge,
  EmptyState,
  FlexibleContent,
  Metric,
  SectionHeading,
  SourceLink,
  StatusChip,
} from "@/components/studio/StudioPrimitives";

type Props = StudioViewProps & { programId: string };

function sourceLabel(
  filter: QueueFilter,
  total: number,
  originals: OriginalLesson[],
  university: number
) {
  const original = originals.length;
  const originalKinds = [...new Set(originals.map(originalLessonLabel))];
  const originalLabel = `${original} ready original ${original === 1 ? "file" : "files"}${originalKinds.length ? ` — ${originalKinds.join("; ")}` : ""}`;
  if (filter === "original") return originalLabel;
  if (filter === "university")
    return `${university} available university recording${university === 1 ? "" : "s"}`;
  if (original && university)
    return `${total} ready queue items — ${original} original ${original === 1 ? "file" : "files"} + ${university} university ${university === 1 ? "recording" : "recordings"}`;
  return original
    ? originalLabel
    : `${university} available university recording${university === 1 ? "" : "s"}`;
}

export default function ProgramPage({ snapshot, study, programId }: Props) {
  const program = snapshot.catalog.programs.find(item => item.id === programId);
  const courses = snapshot.catalog.courses.filter(
    course => course.programId === programId
  );
  const queues = useMemo(
    () => ({
      all: buildProgramQueue(
        snapshot.catalog,
        snapshot.media,
        programId,
        "all"
      ),
      original: buildProgramQueue(
        snapshot.catalog,
        snapshot.media,
        programId,
        "original"
      ),
      university: buildProgramQueue(
        snapshot.catalog,
        snapshot.media,
        programId,
        "university"
      ),
    }),
    [programId, snapshot.catalog, snapshot.media]
  );
  const originalReadyLessons = useMemo(
    () =>
      queues.original.flatMap(item => {
        const lesson = snapshot.media.lessons.find(
          candidate => candidate.id === item.lessonId
        );
        return lesson ? [lesson] : [];
      }),
    [queues.original, snapshot.media.lessons]
  );
  if (!program)
    return (
      <EmptyState title="Program not found">
        This route only opens programs supplied by the current catalog. Return
        to the studio and choose an available program.
      </EmptyState>
    );

  const completed = courses.filter(
    course => study.getCourseStatus(course.id) === "complete"
  ).length;
  const actionHref = (filter: QueueFilter, queue = queues[filter]) => {
    const startCourseId = queue[0]?.courseId ?? courses[0]?.id;
    return startCourseId
      ? `/course/${encodeURIComponent(startCourseId)}?scope=program&source=${filter}&autoplay=1`
      : "";
  };

  return (
    <div className="page-stack program-page">
      <header className="program-header">
        <div>
          <p className="eyebrow">Program workspace</p>
          <h1>{program.fullName || program.name}</h1>
          <p className="program-description">
            {program.description ||
              "The catalog has not included a program description yet."}
          </p>
          <div className="header-actions">
            <SourceLink href={program.outlineUrl || program.guideUrl}>
              <ExternalLink size={14} aria-hidden="true" /> Program guide
            </SourceLink>
            <Link
              href={`/board?program=${encodeURIComponent(program.id)}`}
              className="button button-quiet"
            >
              <PlayCircle size={15} aria-hidden="true" /> Open study board
            </Link>
          </div>
          {queues.all.length ? (
            <div
              className="program-play-actions"
              aria-label="Programme Play all choices"
            >
              <div>
                <span className="eyebrow">Programme Play all</span>
                <p>
                  Only verified ready original files and listed university
                  sources are included. Planned source work stays outside this
                  queue.
                </p>
              </div>
              <div className="program-play-buttons">
                {queues.original.length > 0 && (
                  <Link
                    href={actionHref("original", queues.original)}
                    className="button button-crimson"
                  >
                    <Play size={15} aria-hidden="true" /> Play ready originals{" "}
                    <small>
                      {sourceLabel(
                        "original",
                        queues.original.length,
                        originalReadyLessons,
                        0
                      )}
                    </small>
                  </Link>
                )}
                {queues.original.length > 0 && queues.university.length > 0 && (
                  <Link
                    href={actionHref("all", queues.all)}
                    className="button button-quiet"
                  >
                    <Play size={15} aria-hidden="true" /> Play ready queue{" "}
                    <small>
                      {sourceLabel(
                        "all",
                        queues.all.length,
                        originalReadyLessons,
                        queues.university.length
                      )}
                    </small>
                  </Link>
                )}
                {queues.university.length > 0 && (
                  <Link
                    href={actionHref("university", queues.university)}
                    className="button button-quiet"
                  >
                    <Play size={15} aria-hidden="true" /> Play university{" "}
                    <small>
                      {sourceLabel(
                        "university",
                        queues.university.length,
                        [],
                        queues.university.length
                      )}
                    </small>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <p className="muted-copy">
              No verified playable recordings are currently available for this
              programme. Planned original work is tracked in Coverage.
            </p>
          )}
        </div>
        <div className="program-metrics">
          <Metric
            label="Courses"
            value={program.courseCount ?? courses.length}
          />
          <Metric
            label="Verified outside runtime"
            value={
              program.verifiedExternalHours
                ? `${program.verifiedExternalHours}h`
                : "Not listed"
            }
            note="Ready original-file time is reported separately."
          />
          <Metric
            label="Course progress"
            value={`${completed}/${courses.length}`}
          />
        </div>
      </header>
      <section className="program-briefs">
        <article>
          <h2>
            <GraduationCap size={18} aria-hidden="true" /> Study expectations
          </h2>
          <FlexibleContent
            value={program.prerequisites}
            empty="Prerequisites have not been supplied in the catalog."
          />
        </article>
        <article>
          <h2>
            <Clock3 size={18} aria-hidden="true" /> Schedule & capstone
          </h2>
          <FlexibleContent
            value={program.schedule ?? program.capstone}
            empty="No schedule or capstone specification is available yet."
          />
        </article>
        <article>
          <h2>
            <BookOpenCheck size={18} aria-hidden="true" /> Access & boundaries
          </h2>
          <FlexibleContent
            value={program.limitations ?? program.accessNotes}
            empty="Access and credential boundaries are not yet listed."
          />
        </article>
      </section>
      <section>
        <SectionHeading
          index="01"
          eyebrow="Course sequence"
          title={`${courses.length} catalogued courses`}
        />
        <div className="course-ledger">
          {courses.length ? (
            courses.map((course, index) => (
              <Link
                key={course.id}
                href={`/course/${encodeURIComponent(course.id)}`}
                className="course-ledger-row"
              >
                <span className="course-order">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="course-ledger-copy">
                  <CourseBadge>{course.id}</CourseBadge>
                  <h2>{course.title}</h2>
                  <p>
                    {typeof course.term === "string"
                      ? course.term
                      : course.level && typeof course.level === "string"
                        ? course.level
                        : course.coverageStatus || "Open course workspace"}
                  </p>
                </div>
                <div className="course-ledger-meta">
                  <span>
                    {course.studyHours
                      ? `${course.studyHours} planned hours`
                      : "Hours not listed"}
                  </span>
                  <StatusChip status={study.getCourseStatus(course.id)} />
                  <ArrowRight size={17} aria-hidden="true" />
                </div>
              </Link>
            ))
          ) : (
            <p className="muted-copy">
              Courses for this program will appear when their catalog rows
              arrive.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
