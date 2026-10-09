import { useEffect, useState } from "react";
import type {
  MedicalReadingChapter,
  MedicalReadingResponse,
  MedicalReadingDevelopment,
} from "@shared/medicalReadings";
import {
  validateMedicalReading,
  validateMedicalReadingDevelopment,
} from "@shared/medicalReadings";
import { SourceLink } from "./StudioPrimitives";

export function MedicalReadingDevelopmentNotice({
  development,
}: {
  development: MedicalReadingDevelopment;
}) {
  const labels = {
    source_review_pending:
      "Chapter drafted and saved; fresh source review is still pending. Unreviewed draft teaching is not published.",
    source_unavailable:
      "Chapter development is blocked because sufficiently retrievable supporting evidence was not established in this pass.",
    source_checked:
      "The new chapter passed automated source checks and is available as study text below. It is not a completed video or full-course coverage.",
  };
  return (
    <p className="gap-copy">
      {development.episodeId} · {labels[development.status]} All written
      chapters add zero counted video minutes; human clinician review has not
      been performed.
    </p>
  );
}

export function MedicalReadingContent({
  chapters,
}: {
  chapters: MedicalReadingChapter[];
}) {
  return (
    <div className="medical-reading-chapters">
      <p className="medical-practice-caveat">
        Source-prepared study chapters — not videos or video transcripts. These
        readings add zero counted video minutes. Automated source checks do not
        replace human clinician review, clinical training or board eligibility.
      </p>
      {chapters.map(chapter => (
        <details className="practice-question" key={chapter.episodeId}>
          <summary>
            <strong>{chapter.title}</strong>
            <span className="muted-copy"> · Read chapter</span>
          </summary>
          <p className="practice-domain">
            {chapter.episodeId} · Source-reviewed reading · Human clinician
            review not performed
          </p>
          <p>{chapter.description}</p>
          <p className="gap-copy">{chapter.educationalLimits}</p>
          {chapter.sections.map((section, index) => (
            <section key={`${index}-${section.title}`}>
              <h3>{section.title}</h3>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {section.narration}
              </p>
            </section>
          ))}
          <h3>Reviewed sources</h3>
          <div className="inline-actions">
            {chapter.reviewedSources.map((source, index) => (
              <SourceLink key={source.url} href={source.url}>
                Source {index + 1}
              </SourceLink>
            ))}
          </div>
          <h3>Remaining scope</h3>
          <ul>
            {chapter.coverageGaps.map((gap, index) => (
              <li key={index}>{gap}</li>
            ))}
          </ul>
          <p className="muted-copy">{chapter.sourceLimitations}</p>
          <p className="muted-copy">
            Source check:{" "}
            {new Date(chapter.reviewedAt).toLocaleDateString("en-US")}. This
            does not establish current guideline completeness or human clinical
            validation.
          </p>
          <details>
            <summary>Review identity</summary>
            <p style={{ overflowWrap: "anywhere" }}>
              Script SHA-256: {chapter.sourceScriptSha256}
              <br />
              Evidence selection SHA-256: {chapter.evidenceSelectionSha256}
            </p>
          </details>
          <a
            className="button button-quiet"
            href={`/api/content/medical-chapters/${encodeURIComponent(chapter.courseId)}/${encodeURIComponent(chapter.episodeId)}.md`}
            download
          >
            Download chapter text
          </a>
        </details>
      ))}
    </div>
  );
}

export function MedicalReadingPanel({ courseId }: { courseId: string }) {
  const [content, setContent] = useState<MedicalReadingResponse>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setContent(undefined);
    setError(false);
    fetch(`/api/content/medical-chapters/${encodeURIComponent(courseId)}`, {
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error("Reading lookup failed");
        const data = (await response.json()) as MedicalReadingResponse;
        if (
          data.courseId !== courseId ||
          !Array.isArray(data.chapters) ||
          !data.chapters.every(chapter =>
            validateMedicalReading(chapter, courseId)
          ) ||
          (data.development !== undefined &&
            !validateMedicalReadingDevelopment(data.development, courseId))
        )
          throw new Error("Reading assignment mismatch");
        if (!controller.signal.aborted) setContent(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [courseId, retry]);
  if (error)
    return (
      <div>
        <p role="alert">
          Medical chapters could not load. This is a content-load error, not
          evidence that the course is absent.
        </p>
        <button
          className="button button-quiet"
          onClick={() => setRetry(value => value + 1)}
        >
          Retry chapter lookup
        </button>
      </div>
    );
  if (!content)
    return <p role="status">Loading source-audited chapters for {courseId}…</p>;
  return (
    <>
      {content.development && (
        <MedicalReadingDevelopmentNotice development={content.development} />
      )}
      {content.withheldCount > 0 && (
        <p className="gap-copy">
          {content.withheldCount} reading entries are withheld because exact
          content/source identity validation failed.
        </p>
      )}
      {content.chapters.length ? (
        <MedicalReadingContent chapters={content.chapters} />
      ) : (
        <p className="muted-copy">
          No source-audited reading chapters have been published for this record
          yet. New manuscripts remain staged until their source checks pass;
          they are not ready videos.
        </p>
      )}
    </>
  );
}
