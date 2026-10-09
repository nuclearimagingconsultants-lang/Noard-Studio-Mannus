import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileWarning,
  Film,
  Layers3,
  ListChecks,
  TimerReset,
} from "lucide-react";
import type {
  FlexibleField,
  OriginalLesson,
  SourceCoverageEntry,
  SourcePageLedgerEntry,
} from "@shared/catalog";
import {
  canonicalExternalUrl,
  formatDuration,
} from "@/lib/queue";
import {
  isPublishableReadyOriginal,
  projectPublicMediaManifest,
} from "@shared/publicMedia.mjs";
import type { StudioViewProps } from "@/lib/studioTypes";
import {
  EmptyState,
  FlexibleContent,
  Metric,
  SectionHeading,
  SourceLink,
  TimeLabel,
} from "@/components/studio/StudioPrimitives";
import { courseCoverageGaps } from "@/lib/coverageGaps";

function totalSeconds(lessons: Array<{ durationSeconds?: number }>) {
  return lessons.reduce(
    (sum, item) =>
      sum +
      (typeof item.durationSeconds === "number" ? item.durationSeconds : 0),
    0
  );
}
function statusLabel(lesson: OriginalLesson) {
  return isPublishableReadyOriginal(lesson)
    ? "ready"
    : lesson.status === "blocked"
      ? "blocked"
      : "planned";
}
function sourceText(value: unknown): FlexibleField {
  return typeof value === "string" ||
    Array.isArray(value) ||
    (value && typeof value === "object")
    ? (value as FlexibleField)
    : undefined;
}

function pageRange(entry: SourcePageLedgerEntry) {
  if (typeof entry.start_page !== "number") return "Pages not specified";
  return entry.end_page && entry.end_page !== entry.start_page
    ? `Pages ${entry.start_page}–${entry.end_page}`
    : `Page ${entry.start_page}`;
}

function SourceCoverageCard({ entry }: { entry: SourceCoverageEntry }) {
  const ledger = entry.pageLedger ?? [];
  const gaps = entry.gaps?.filter(Boolean) ?? [];
  return (
    <article className="source-coverage-card">
      <header>
        <div>
          <Layers3 size={17} aria-hidden="true" />
          <div>
            <strong>
              {entry.title || entry.sourceId || "Untitled source"}
            </strong>
            <small>
              {entry.sourceId
                ? `Source ID: ${entry.sourceId}`
                : "Source ID not supplied"}
              {entry.programIds?.length
                ? ` · Scope: ${entry.programIds.join(", ")}`
                : ""}
            </small>
          </div>
        </div>
        <span className="coverage-status">
          {entry.coverageStatus || "status not supplied"}
        </span>
      </header>
      <dl className="source-coverage-metrics">
        <div>
          <dt>Physical pages</dt>
          <dd>{entry.pageCount ?? "not listed"}</dd>
        </div>
        <div>
          <dt>Substantive pages</dt>
          <dd>{entry.substantivePages ?? "not listed"}</dd>
        </div>
        <div>
          <dt>Taught pages</dt>
          <dd>{entry.taughtPages ?? "not listed"}</dd>
        </div>
        <div>
          <dt>Planned lessons</dt>
          <dd>{entry.plannedLessons ?? "not listed"}</dd>
        </div>
        <div>
          <dt>Ready lessons</dt>
          <dd>{entry.readyLessons ?? "not listed"}</dd>
        </div>
      </dl>
      {entry.scopeNote && (
        <div className="source-scope-note">
          <strong>Source scope</strong>
          <p>{entry.scopeNote}</p>
        </div>
      )}
      {gaps.length > 0 && (
        <div className="source-card-gaps">
          <strong>
            <AlertTriangle size={14} aria-hidden="true" /> Gaps / limits
          </strong>
          <ul>
            {gaps.map((gap, index) => (
              <li key={`${gap}-${index}`}>{gap}</li>
            ))}
          </ul>
        </div>
      )}
      {ledger.length > 0 && (
        <details className="page-ledger">
          <summary>Detailed page ledger ({ledger.length} entries)</summary>
          <ol>
            {ledger.map((page, index) => (
              <li
                key={`${page.start_page ?? "unknown"}-${page.end_page ?? index}-${index}`}
              >
                <strong>{pageRange(page)}</strong>
                <span>
                  {page.classification || "unclassified"}
                  {page.lesson_ids?.length
                    ? ` · lessons: ${page.lesson_ids.join(", ")}`
                    : ""}
                </span>
                {page.reason && <p>{page.reason}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
      <p className="source-card-boundary">
        This page map reports this source’s recorded scope; it does not
        establish every-exercise coverage or full-program coverage.
      </p>
    </article>
  );
}

export default function CoveragePage({ snapshot }: StudioViewProps) {
  const { catalog, media: sourceMedia } = snapshot;
  // The server projects before responding; keeping this client-side boundary
  // also ensures a stale or development snapshot cannot render producer paths.
  const media = useMemo(
    () => projectPublicMediaManifest(sourceMedia),
    [sourceMedia]
  );
  const ready = media.lessons.filter(lesson => statusLabel(lesson) === "ready");
  const planned = media.lessons.filter(
    lesson => statusLabel(lesson) === "planned"
  );
  const blocked = media.lessons.filter(
    lesson => statusLabel(lesson) === "blocked"
  );
  const external = useMemo(() => {
    const seen = new Set<string>();
    return catalog.courses.flatMap(course =>
      (course.lectures ?? []).flatMap(lecture => {
        const url = lecture.url || lecture.sourceUrl;
        const key = canonicalExternalUrl(url);
        if (!key || seen.has(key)) return [];
        seen.add(key);
        return [{ ...lecture, url }];
      })
    );
  }, [catalog.courses]);
  const uncovered = catalog.courses.flatMap(course =>
    courseCoverageGaps(course).map(text => ({ course, text }))
  );
  if (!catalog.programs.length && !media.lessons.length)
    return (
      <EmptyState title="Coverage ledger is awaiting source data">
        The production and catalog manifests are currently empty. This screen
        will distinguish actual ready media from planned source work and outside
        recordings once the incoming records exist.
      </EmptyState>
    );
  return (
    <div className="page-stack coverage-page">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Production & evidence ledger</p>
          <h1>
            Know what is
            <br />
            <em>actually covered.</em>
          </h1>
        </div>
        <p className="library-note">
          Original Board Studio explanations, outside university recordings,
          source-page maps, and credential statements are reported separately. A
          short or planned video is never treated as degree completion.
        </p>
      </header>
      <section className="coverage-metrics">
        <Metric
          label="Ready original videos"
          value={ready.length}
          note={formatDuration(totalSeconds(ready))}
        />
        <Metric
          label="Planned source work"
          value={planned.length}
          note="Not playable; not counted as coverage."
        />
        <Metric
          label="Blocked source work"
          value={blocked.length}
          note="Needs a real asset or access resolution."
        />
        <Metric
          label="Unique outside recordings"
          value={external.length}
          note={formatDuration(totalSeconds(external))}
        />
      </section>
      <section>
        <SectionHeading
          index="01"
          eyebrow="Original media manifest"
          title="Production state"
        />
        <div className="production-columns">
          <MediaColumn
            title="Ready"
            icon={<CheckCircle2 size={17} />}
            lessons={ready}
            tone="ready"
          />
          <MediaColumn
            title="Planned"
            icon={<TimerReset size={17} />}
            lessons={planned}
            tone="planned"
          />
          <MediaColumn
            title="Blocked"
            icon={<FileWarning size={17} />}
            lessons={blocked}
            tone="blocked"
          />
        </div>
        {media.productionState && (
          <div className="production-note">
            <strong>Manifest production note</strong>
            <FlexibleContent value={sourceText(media.productionState)} />
          </div>
        )}
      </section>
      <section className="coverage-ledger">
        <div>
          <SectionHeading
            index="02"
            eyebrow="Source coverage"
            title="Pages, topics & remaining gaps"
          />
          {media.sourceCoverage?.length ? (
            <div className="source-coverage-list">
              {media.sourceCoverage.map((entry, index) => (
                <SourceCoverageCard
                  key={entry.sourceId ?? index}
                  entry={entry}
                />
              ))}
            </div>
          ) : (
            <p className="muted-copy">
              No source-page ledger has been written to the media manifest yet.
              The absence of a ledger does not mean the source is covered.
            </p>
          )}
          {uncovered.length ? (
            <div className="gap-list">
              <h3>
                <AlertTriangle size={16} aria-hidden="true" /> Explicit
                remaining gaps
              </h3>
              {uncovered.map((gap, index) => (
                <p key={`${gap.course.id}-${index}`}>
                  <span>{gap.course.id}</span>
                  {gap.text}
                </p>
              ))}
            </div>
          ) : (
            <p className="muted-copy">
              The current catalog has not listed remaining topic gaps. This is
              not a statement of full source or degree coverage.
            </p>
          )}
        </div>
        <div>
          <SectionHeading
            index="03"
            eyebrow="Outside recordings"
            title="Deduplicated runtime"
          />
          <div className="external-list">
            {external.length ? (
              external.map(lecture => (
                <article key={canonicalExternalUrl(lecture.url)}>
                  <Film size={17} aria-hidden="true" />
                  <div>
                    <strong>{lecture.title}</strong>
                    <small>{lecture.provider || "Outside source"}</small>
                    <TimeLabel seconds={lecture.durationSeconds} />
                  </div>
                  <SourceLink href={lecture.sourceUrl || lecture.url}>
                    <ExternalLink size={14} aria-hidden="true" /> Source
                  </SourceLink>
                </article>
              ))
            ) : (
              <p className="muted-copy">
                No external recording URLs have been supplied in the catalog.
              </p>
            )}
          </div>
        </div>
      </section>
      <section>
        <SectionHeading
          index="04"
          eyebrow="Credential boundaries"
          title="Independent-study context"
        />
        <div className="credential-grid">
          {catalog.programs.map(program => (
            <article key={program.id}>
              <div>
                <ListChecks size={18} aria-hidden="true" />
                <h2>{program.name}</h2>
              </div>
              <p>{program.credentialType || "Independent-study program"}</p>
              <strong>
                {program.verifiedExternalHours
                  ? `${program.verifiedExternalHours} verified external hours`
                  : "Verified external hours not listed"}
              </strong>
              <FlexibleContent
                value={program.limitations ?? program.accessNotes}
                empty="Program-specific limitations are not listed."
              />
            </article>
          ))}
        </div>
        {catalog.credentialNotice && (
          <p className="credential-notice">
            <Clock3 size={16} aria-hidden="true" />
            {catalog.credentialNotice}
          </p>
        )}
      </section>
    </div>
  );
}

function MediaColumn({
  title,
  icon,
  lessons,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  lessons: OriginalLesson[];
  tone: string;
}) {
  return (
    <article className={`media-column ${tone}`}>
      <header>
        <span>{icon}</span>
        <h2>{title}</h2>
        <strong>{lessons.length}</strong>
      </header>
      {lessons.length ? (
        <div>
          {lessons.map(lesson => (
            <div className="media-row" key={lesson.id}>
              <div>
                <strong>{lesson.title}</strong>
                <small>
                  {lesson.coverageStatus || "Coverage status not supplied"}
                </small>
                {lesson.sourcePages ? (
                  <span>
                    Source pages:{" "}
                    {typeof lesson.sourcePages === "string"
                      ? lesson.sourcePages
                      : Array.isArray(lesson.sourcePages)
                        ? lesson.sourcePages.join(", ")
                        : "listed in manifest"}
                  </span>
                ) : null}
              </div>
              {lesson.status === "ready" && lesson.videoUrl ? (
                <SourceLink href={lesson.videoUrl}>Play file</SourceLink>
              ) : (
                <span className="media-status">
                  {lesson.status || "planned"}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>No lessons in this state.</p>
      )}
    </article>
  );
}
