import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import type { CourseRecord, MedicalPracticeQuestion } from "@shared/catalog";
import {
  getMedicalMetadata,
  isMedicalCourseReady,
  scorePracticeQuestions,
  summarizeMedicalHours,
  validateMedicalCourse,
  validatePracticeQuestion,
} from "@shared/medical";
import { FlexibleContent, SourceLink } from "./StudioPrimitives";

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : [];
}

function formatHours(value: number | undefined) {
  return value === undefined
    ? "Unknown"
    : `${value.toFixed(value % 1 ? 1 : 0)} h`;
}

export function MedicalCourseOverview({ course }: { course: CourseRecord }) {
  const metadata = getMedicalMetadata(course);
  const hours = summarizeMedicalHours(course);
  const issues = validateMedicalCourse(course);
  const ready = isMedicalCourseReady(course);
  const officialProgrammes = metadata.officialProgrammes ?? [];
  return (
    <section
      className="medical-course-overview"
      aria-label="Medical specialty scope and evidence"
    >
      <div className="medical-overview-heading">
        <div>
          <p className="eyebrow">Specialty scope & evidence</p>
          <h2>
            {metadata.family || "Specialty family pending"} <span>·</span>{" "}
            {metadata.trackType || "Track type pending"}
          </h2>
        </div>
        <strong className={ready ? "is-ready" : "is-pending"}>
          {ready ? "Hour evidence ready" : "Evidence incomplete"}
        </strong>
      </div>
      <dl className="medical-scope-grid">
        <div>
          <dt>Certifying boards</dt>
          <dd>
            {stringList(metadata.boardNames).join(" · ") || "Not supplied"}
          </dd>
        </div>
        <div>
          <dt>Board scope</dt>
          <dd>
            <FlexibleContent
              value={metadata.boardStatus}
              empty="Not supplied"
            />
          </dd>
        </div>
        <div>
          <dt>Video target</dt>
          <dd>{formatHours(hours.targetHours)}</dd>
        </div>
        <div>
          <dt>Verified outside runtime</dt>
          <dd>{formatHours(hours.verifiedExternalHours)}</dd>
        </div>
        <div>
          <dt>Verified generated-original runtime</dt>
          <dd>{formatHours(hours.verifiedGeneratedHours)}</dd>
        </div>
        <div>
          <dt>Verified combined runtime</dt>
          <dd>{formatHours(hours.verifiedTotalHours)}</dd>
        </div>
        <div>
          <dt>Specialty / foundation</dt>
          <dd>
            {formatHours(hours.verifiedSpecialtyHours)} /{" "}
            {formatHours(hours.verifiedFoundationHours)}
          </dd>
        </div>
        <div>
          <dt>Remaining measured gap</dt>
          <dd>{formatHours(hours.calculatedGapHours)}</dd>
        </div>
      </dl>
      <div className="medical-overview-notes">
        <p>
          <Clock3 size={15} aria-hidden="true" /> Generated-original runtime is
          counted only from ready, durable, instructional clips with measured
          duration, source evidence, and automated source-review acceptance.
          Planned clips and {hours.unknownDurationCount} unknown-duration item
          {hours.unknownDurationCount === 1 ? "" : "s"} are excluded.
        </p>
        <p>
          <ShieldAlert size={15} aria-hidden="true" />{" "}
          {metadata.boardEligibilityNotice ||
            "Independent study does not establish board eligibility, residency/fellowship completion, licensure, or clinical competence."}
        </p>
        <p>
          <AlertTriangle size={15} aria-hidden="true" /> These measurements do
          not establish clinical competence, board readiness, completion, or
          eligibility. Clinical training is not replaced; human clinical review
          status: {metadata.humanClinicalReviewStatus || "not supplied"}.
        </p>
      </div>
      {officialProgrammes.length > 0 && (
        <div className="medical-official-programmes">
          <h3>Official programme scope</h3>
          {officialProgrammes.map((programme, index) => (
            <article key={`${programme.url}-${index}`}>
              <div>
                <strong>{programme.institution}</strong>
                <span>{programme.name}</span>
                <p>{programme.publicCurriculumNotes}</p>
              </div>
              <SourceLink href={programme.url}>
                <ExternalLink size={13} aria-hidden="true" />
                Official page
              </SourceLink>
            </article>
          ))}
        </div>
      )}
      {issues.length > 0 && (
        <div className="medical-validation-gaps">
          <strong>
            <AlertTriangle size={14} aria-hidden="true" /> Evidence/schema gaps
          </strong>
          <ul>
            {issues.map(issue => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="medical-caveats">
        <h3>Source caveats</h3>
        <p className="muted-copy">
          These retained notes describe source-access checks when the curriculum
          was assembled. Earlier statements about missing videos are not live
          availability totals; use the measured runtime above and the ready
          lesson queue for current availability. Access restrictions and clinical
          limitations still apply.
        </p>
        <FlexibleContent
          value={metadata.sourceCaveats}
          empty="No source caveats have been supplied."
        />
      </div>
    </section>
  );
}

export function MedicalPracticePanel({ course }: { course: CourseRecord }) {
  const metadata = getMedicalMetadata(course);
  const questions = Array.isArray(metadata.practiceQuestions)
    ? metadata.practiceQuestions
    : [];
  const [answers, setAnswers] = useState<Record<string, string | undefined>>(
    {}
  );
  const [showScore, setShowScore] = useState(false);
  const validQuestions = useMemo(
    () =>
      questions.filter(
        question => validatePracticeQuestion(question).length === 0
      ),
    [questions]
  ) as MedicalPracticeQuestion[];
  const invalidCount = questions.length - validQuestions.length;
  const score = scorePracticeQuestions(validQuestions, answers);

  if (!questions.length) {
    return (
      <p className="muted-copy">
        No original practice questions have been supplied for this specialty.
        Scores are never inferred from media or course completion.
      </p>
    );
  }
  return (
    <div className="medical-practice">
      <p className="medical-practice-caveat">
        Original self-practice only. These items sample only the listed domains;
        they are not protected board questions and do not predict passing any
        examination.
      </p>
      {invalidCount > 0 && (
        <p className="gap-copy">
          {invalidCount} supplied question{invalidCount === 1 ? " is" : "s are"}{" "}
          withheld because choice/rationale/source validation is incomplete.
        </p>
      )}
      {validQuestions.map((question, index) => {
        const selected = answers[question.id];
        const answered = Boolean(selected);
        const correct = selected === question.correctOptionId;
        return (
          <fieldset className="practice-question" key={question.id}>
            <legend>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {question.stem}
            </legend>
            <p className="practice-domain">
              Sampled domain: {question.domain}
              {question.fictionalCase ? " · fictional case" : ""}
            </p>
            <div className="practice-options">
              {question.options.map(option => (
                <label
                  key={option.id}
                  className={
                    showScore && selected === option.id
                      ? correct
                        ? "is-correct"
                        : "is-incorrect"
                      : ""
                  }
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={selected === option.id}
                    onChange={() => {
                      setAnswers(current => ({
                        ...current,
                        [question.id]: option.id,
                      }));
                      setShowScore(false);
                    }}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
            {showScore && answered && (
              <div className="practice-rationale">
                <strong>{correct ? "Correct" : "Review the rationale"}</strong>
                <p>{question.rationale}</p>
                <div className="inline-actions">
                  {question.sourceUrls.map(url => (
                    <SourceLink href={url} key={url}>
                      Rationale source
                    </SourceLink>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
        );
      })}
      <div className="practice-score-row">
        <button
          className="button button-crimson"
          onClick={() => setShowScore(true)}
          disabled={!score.attemptedCount}
        >
          Score selected answers
        </button>
        {showScore && (
          <p>
            <CheckCircle2 size={15} aria-hidden="true" />
            {score.correctCount}/{score.attemptedCount} correct among selected
            answers. Unattempted items are not scored.
          </p>
        )}
      </div>
    </div>
  );
}
