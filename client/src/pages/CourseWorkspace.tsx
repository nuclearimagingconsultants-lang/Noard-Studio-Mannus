import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ListVideo,
  Play,
  SkipForward,
  StickyNote,
} from "lucide-react";
import type { QueueFilter, QueueItem } from "@/lib/queue";
import {
  buildCourseQueue,
  buildProgramQueue,
  formatDuration,
} from "@/lib/queue";
import {
  chooseQueueItem,
  courseSourceDocuments,
  isOriginalLessonRelevantToCourse,
  originalLessonLabel,
  parseLearningLaunch,
} from "@/lib/learningFlow";
import { isMedicalCourse } from "@shared/medical";
import type { ContentSnapshot } from "@shared/catalog";
import type { StudyStatus } from "@/lib/studyStorage";
import type { StudioViewProps } from "@/lib/studioTypes";
import { trpc } from "@/lib/trpc";
import {
  MedicalCourseOverview,
  MedicalPracticePanel,
} from "@/components/studio/MedicalCourseDetails";
import { MediaPlayer } from "@/components/studio/MediaPlayer";
import { MedicalReadingPanel } from "@/components/studio/MedicalReadingPanel";
import { SourceReader } from "@/components/studio/SourceReader";
import {
  CourseBadge,
  EmptyState,
  FlexibleContent,
  SectionHeading,
  SourceLink,
  StatusChip,
} from "@/components/studio/StudioPrimitives";
import { courseCoverageGaps } from "@/lib/coverageGaps";

type Props = StudioViewProps & { courseId: string };
type DetailPanel =
  | "objectives"
  | "units"
  | "reading"
  | "chapters"
  | "assessment"
  | "practice"
  | "transcript";

/**
 * A programme workspace transports compact peers so its queue remains complete.
 * When one peer becomes active, layer its full course/source response on top of
 * that snapshot instead of replacing the queue with a one-course response.
 */
function mergeWorkspaceDetail(
  queueSnapshot: ContentSnapshot,
  detail: ContentSnapshot | undefined,
  expectedCourseId: string | undefined
): ContentSnapshot {
  const fullCourse = detail?.catalog.courses.find(
    course => course.id === expectedCourseId
  );
  if (!detail || !fullCourse) return queueSnapshot;

  const mergeByKey = <T,>(
    base: T[],
    overlay: T[],
    key: (item: T) => string
  ): T[] => {
    const positions = new Map<string, number>();
    const merged = [...base];
    base.forEach((item, index) => positions.set(key(item), index));
    overlay.forEach(item => {
      const itemKey = key(item);
      const position = positions.get(itemKey);
      if (position === undefined) {
        positions.set(itemKey, merged.length);
        merged.push(item);
      } else {
        merged[position] = item;
      }
    });
    return merged;
  };

  return {
    ...queueSnapshot,
    catalog: {
      ...queueSnapshot.catalog,
      // Preserve every programme peer and its queue transport fields.
      courses: queueSnapshot.catalog.courses.map(course =>
        course.id === fullCourse.id ? fullCourse : course
      ),
      // The route course's sources stay available while adding the active peer's.
      documents: mergeByKey(
        queueSnapshot.catalog.documents,
        detail.catalog.documents,
        document => document.id
      ),
    },
    media: {
      ...queueSnapshot.media,
      // Programme originals remain in the queue; fuller active-peer records win.
      lessons: mergeByKey(
        queueSnapshot.media.lessons,
        detail.media.lessons,
        lesson => lesson.id
      ),
      sourceCoverage: mergeByKey(
        queueSnapshot.media.sourceCoverage ?? [],
        detail.media.sourceCoverage ?? [],
        entry => entry.sourceId ?? JSON.stringify(entry)
      ),
    },
    updatedAt: detail.updatedAt || queueSnapshot.updatedAt,
  };
}

export default function CourseWorkspace({ snapshot, study, courseId }: Props) {
  const search = useSearch();
  const launch = useMemo(() => parseLearningLaunch(search), [search]);
  const baseCourse = snapshot.catalog.courses.find(
    item => item.id === courseId
  );
  const [filter, setFilter] = useState<QueueFilter>(launch.filter);
  const [selectedId, setSelectedId] = useState<string>();
  const [queueActive, setQueueActive] = useState(false);
  const [panel, setPanel] = useState<DetailPanel>("objectives");
  const [note, setNote] = useState("");
  const noteRef = useRef("");
  const noteCourseIdRef = useRef<string | undefined>(undefined);
  const noteDirtyRef = useRef(false);
  const lastPlaybackSecondsRef = useRef(0);
  const [followVideoPage, setFollowVideoPage] = useState(true);
  const [followedPage, setFollowedPage] = useState<number>();
  const launchKey = `${courseId}:${launch.scope}:${launch.filter}:${launch.autoplay}`;

  useEffect(() => {
    setFilter(launch.filter);
    setSelectedId(undefined);
    // Only the programme page's explicit action arms autoplay. Opening an ordinary course never does.
    setQueueActive(launch.autoplay);
  }, [launchKey]);

  const queue = useMemo(() => {
    if (!baseCourse) return [];
    return launch.scope === "program"
      ? buildProgramQueue(
          snapshot.catalog,
          snapshot.media,
          baseCourse.programId,
          filter
        )
      : buildCourseQueue(baseCourse, snapshot.media, filter);
  }, [baseCourse, filter, launch.scope, snapshot.catalog, snapshot.media]);
  const queueKey = queue.map(item => item.queueId).join("|");

  useEffect(() => {
    if (!study.progressReady) return;
    setSelectedId(
      current => chooseQueueItem(queue, current, study.progress)?.queueId
    );
  }, [queueKey, study.progress, study.progressReady]);

  // Do not let an empty protected query select and commit the first lesson before auth settles.
  const selected = study.progressReady
    ? chooseQueueItem(queue, selectedId, study.progress)
    : undefined;
  const peerCourseId =
    launch.scope === "program"
      ? (selected?.courseId ?? baseCourse?.id)
      : undefined;
  const peerDetailQuery = trpc.content.workspace.useQuery(
    { courseId: peerCourseId ?? "__not_a_programme_peer__", scope: "course" },
    {
      // The route course is already full. Fetch only a compact programme peer
      // after it is selected, without replacing the global programme queue.
      enabled: Boolean(peerCourseId && peerCourseId !== courseId),
      staleTime: 60_000,
      retry: 1,
    }
  );
  const workspaceSnapshot = useMemo(
    () => mergeWorkspaceDetail(snapshot, peerDetailQuery.data, peerCourseId),
    [peerCourseId, peerDetailQuery.data, snapshot]
  );
  const activeCourse =
    workspaceSnapshot.catalog.courses.find(
      item => item.id === selected?.courseId
    ) ?? baseCourse;
  const originalLesson = workspaceSnapshot.media.lessons.find(
    lesson =>
      lesson.id === selected?.lessonId && selected?.source === "original"
  );
  const transcriptQuery = trpc.content.transcript.useQuery(
    { lessonId: originalLesson?.id ?? "__not_selected__" },
    {
      enabled: Boolean(originalLesson?.id),
      staleTime: 60_000,
      retry: false,
    }
  );
  const documents = useMemo(
    () =>
      activeCourse
        ? courseSourceDocuments(
            workspaceSnapshot.catalog.documents,
            activeCourse,
            originalLesson?.sourceId
          )
        : [],
    [
      activeCourse,
      originalLesson?.sourceId,
      workspaceSnapshot.catalog.documents,
    ]
  );
  const pendingOriginal = useMemo(
    () =>
      activeCourse
        ? workspaceSnapshot.media.lessons.filter(
            lesson =>
              isOriginalLessonRelevantToCourse(lesson, activeCourse) &&
              lesson.status !== "ready"
          )
        : [],
    [activeCourse, workspaceSnapshot.media.lessons]
  );
  const selectedProgress = study.progress.find(
    item =>
      item.courseId === selected?.courseId &&
      item.lessonId === selected?.lessonId
  );

  useEffect(() => {
    if (!activeCourse) return;
    const savedNote = study.getNote(activeCourse.id);
    if (noteCourseIdRef.current !== activeCourse.id) {
      noteCourseIdRef.current = activeCourse.id;
      noteDirtyRef.current = false;
      noteRef.current = savedNote;
      setNote(savedNote);
    } else if (!noteDirtyRef.current) {
      noteRef.current = savedNote;
      setNote(savedNote);
    }
  }, [activeCourse?.id, study.notes]);
  useEffect(() => {
    if (!originalLesson && panel === "transcript") setPanel("objectives");
    if (
      panel === "chapters" &&
      (!activeCourse || !isMedicalCourse(activeCourse))
    )
      setPanel("objectives");
  }, [activeCourse?.id, originalLesson, panel]);

  const pageCues = useMemo(
    () =>
      (originalLesson?.pageCues ?? []).filter(
        cue =>
          Number.isFinite(cue.start) &&
          Number.isFinite(cue.end) &&
          cue.end > cue.start &&
          Number.isInteger(cue.page) &&
          cue.page > 0
      ),
    [originalLesson?.pageCues]
  );
  const sourceInitialId =
    selected?.source === "original"
      ? selected.sourceId
      : (activeCourse?.pdfIds?.[0] ??
        `syllabus-${activeCourse?.id ?? courseId}`);
  const sourceInitialPage =
    selected?.source === "original" ? selected.sourcePages?.[0] : 1;
  const sourceKey = `${activeCourse?.id ?? courseId}:${selected?.source === "original" ? selected.queueId : "course-source"}`;

  useEffect(() => {
    // A queue/source selection is intentional context change, so restore the default-on cue mode.
    lastPlaybackSecondsRef.current = 0;
    setFollowVideoPage(true);
    setFollowedPage(undefined);
  }, [sourceKey]);

  const cueAt = useCallback(
    (seconds: number) =>
      pageCues.find(
        cue =>
          seconds >= cue.start &&
          (seconds < cue.end || cue === pageCues[pageCues.length - 1])
      ),
    [pageCues]
  );
  const onPlaybackTime = useCallback(
    (seconds: number) => {
      lastPlaybackSecondsRef.current = seconds;
      if (!followVideoPage) return;
      const cue = cueAt(seconds);
      if (cue)
        setFollowedPage(current => (current === cue.page ? current : cue.page));
    },
    [cueAt, followVideoPage]
  );
  const changePageFollow = useCallback(
    (following: boolean) => {
      setFollowVideoPage(following);
      if (following)
        setFollowedPage(cueAt(lastPlaybackSecondsRef.current)?.page);
    },
    [cueAt]
  );

  const saveCurrentNote = useCallback(async () => {
    const currentCourseId = noteCourseIdRef.current;
    if (!currentCourseId || !noteDirtyRef.current) return true;
    const content = noteRef.current;
    const saved = await study.saveNote(currentCourseId, content);
    if (
      saved &&
      noteCourseIdRef.current === currentCourseId &&
      noteRef.current === content
    ) {
      noteDirtyRef.current = false;
    }
    return saved;
  }, [study]);
  const selectLesson = useCallback(
    async (item: QueueItem, userStarted = true) => {
      if (
        item.courseId !== noteCourseIdRef.current &&
        !(await saveCurrentNote())
      ) {
        setQueueActive(false);
        return;
      }
      setSelectedId(item.queueId);
      if (userStarted) setQueueActive(true);
    },
    [saveCurrentNote]
  );
  const saveLesson = useCallback(
    (status: StudyStatus, positionSeconds = 0) => {
      if (selected)
        study.saveProgress({
          courseId: selected.courseId,
          lessonId: selected.lessonId,
          status,
          positionSeconds,
        });
    },
    [selected, study]
  );
  const nextLesson = useCallback(async () => {
    if (!selected) return;
    const index = queue.findIndex(item => item.queueId === selected.queueId);
    const next = queue[index + 1];
    if (next) {
      await selectLesson(next, true);
    } else {
      setQueueActive(false);
    }
  }, [queue, selectLesson, selected]);
  const finishAndAdvance = useCallback(async () => {
    saveLesson("complete", selectedProgress?.positionSeconds ?? 0);
    await nextLesson();
  }, [nextLesson, saveLesson, selectedProgress?.positionSeconds]);
  const changeFilter = useCallback(
    (nextFilter: QueueFilter) => {
      if (nextFilter === filter) return;
      setFilter(nextFilter);
      // Filter changes are a deliberate learner action, not permission to start another source.
      setQueueActive(false);
    },
    [filter]
  );

  if (!baseCourse || !activeCourse)
    return (
      <EmptyState title="Course not found">
        Courses are opened only from IDs in the active catalog. Return to a
        program or the study board to choose a listed course.
      </EmptyState>
    );

  const program = workspaceSnapshot.catalog.programs.find(
    item => item.id === baseCourse.programId
  );
  const courseState = study.getCourseStatus(activeCourse.id);
  const medicalCourse = isMedicalCourse(activeCourse);
  const panels: DetailPanel[] = [
    "objectives",
    "units",
    "reading",
    "assessment",
    ...(medicalCourse ? ["chapters" as const, "practice" as const] : []),
    ...(originalLesson ? ["transcript" as const] : []),
  ];
  return (
    <div className="course-workspace">
      <header className="course-header">
        <div>
          <Link
            href={
              baseCourse.programId === "med"
                ? "/med"
                : `/program/${encodeURIComponent(baseCourse.programId)}`
            }
            className="back-link"
          >
            {program?.name || baseCourse.programId}
            <ChevronRight size={14} aria-hidden="true" />
            {launch.scope === "program"
              ? "Programme queue"
              : "Course workspace"}
          </Link>
          <CourseBadge>{activeCourse.id}</CourseBadge>
          <h1>{activeCourse.title}</h1>
          <p>
            {activeCourse.coverageStatus ||
              "Study the available source material, video queue, and practical work in one place."}
          </p>
        </div>
        <div className="course-actions">
          <StatusChip status={courseState} />
          <button
            className="button button-quiet"
            onClick={() =>
              study.saveProgress({
                courseId: activeCourse.id,
                lessonId: "__course__",
                status: courseState === "complete" ? "in_progress" : "complete",
                positionSeconds: 0,
              })
            }
          >
            <CheckCircle2 size={15} aria-hidden="true" />
            {courseState === "complete" ? "Reopen course" : "Mark complete"}
          </button>
        </div>
      </header>
      {medicalCourse && <MedicalCourseOverview course={activeCourse} />}
      <section className="learning-grid">
        <div className="player-column">
          <MediaPlayer
            item={selected}
            originalLabel={originalLessonLabel(originalLesson)}
            queueActive={queueActive}
            restoredPosition={selectedProgress?.positionSeconds ?? 0}
            onStart={() => {
              setQueueActive(true);
              saveLesson("in_progress", selectedProgress?.positionSeconds ?? 0);
            }}
            onPosition={seconds => saveLesson("in_progress", seconds)}
            onPlaybackTime={onPlaybackTime}
            onEnded={() => void finishAndAdvance()}
            onSkip={() => void nextLesson()}
          />
          <div className="queue-controls">
            <div>
              <span className="eyebrow">
                {launch.scope === "program"
                  ? "Programme lesson queue"
                  : "Lesson queue"}
              </span>
              <strong>
                {queue.length} ready queue{" "}
                {queue.length === 1 ? "item" : "items"}
              </strong>
            </div>
            <div className="filter-group" aria-label="Lesson source filter">
              <button
                className={filter === "all" ? "is-selected" : ""}
                onClick={() => changeFilter("all")}
              >
                All
              </button>
              <button
                className={filter === "original" ? "is-selected" : ""}
                onClick={() => changeFilter("original")}
              >
                Original
              </button>
              <button
                className={filter === "university" ? "is-selected" : ""}
                onClick={() => changeFilter("university")}
              >
                University
              </button>
            </div>
            <button
              className="button button-crimson"
              disabled={!queue.length}
              onClick={() => {
                const first = queue[0];
                if (first) void selectLesson(first, true);
              }}
            >
              <Play size={15} aria-hidden="true" /> Play ready queue
            </button>
          </div>
          <div className="lesson-queue">
            {queue.length ? (
              queue.map((item, index) => (
                <button
                  key={item.queueId}
                  className={`lesson-item ${selected?.queueId === item.queueId ? "is-current" : ""}`}
                  onClick={() => selectLesson(item)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {launch.scope === "program" ? `${item.courseId} · ` : ""}
                      {item.source === "original"
                        ? originalLessonLabel(
                            workspaceSnapshot.media.lessons.find(
                              lesson => lesson.id === item.lessonId
                            )
                          )
                        : item.provider || "Outside university recording"}{" "}
                      · {formatDuration(item.durationSeconds)}
                    </small>
                  </div>
                  {selected?.queueId === item.queueId && (
                    <ListVideo size={16} aria-hidden="true" />
                  )}
                </button>
              ))
            ) : (
              <p className="queue-empty">
                No verified playable recordings match this filter. Planned and
                blocked original work remains visible below and in Coverage.
              </p>
            )}
          </div>
          {pendingOriginal.length > 0 && (
            <div className="planned-strip">
              <span>Original source work</span>
              {pendingOriginal.map(lesson => (
                <small key={lesson.id}>
                  {lesson.title} — {lesson.status}
                </small>
              ))}
            </div>
          )}
        </div>
        <aside className="course-side">
          <section className="source-panel">
            <SectionHeading
              index="PDF"
              eyebrow="Read alongside"
              title="Source reader"
            />
            <SourceReader
              documents={documents}
              initialId={sourceInitialId}
              initialPage={sourceInitialPage}
              sourceKey={sourceKey}
              followPage={
                pageCues.length && followVideoPage ? followedPage : undefined
              }
              canFollow={Boolean(pageCues.length)}
              following={Boolean(pageCues.length && followVideoPage)}
              onFollowChange={pageCues.length ? changePageFollow : undefined}
            />
          </section>
        </aside>
      </section>
      <section className="details-grid">
        <div className="detail-panel">
          <div
            className="detail-tabs"
            role="tablist"
            aria-label="Course details"
          >
            {panels.map(item => (
              <button
                key={item}
                role="tab"
                aria-selected={panel === item}
                className={panel === item ? "is-active" : ""}
                onClick={() => setPanel(item)}
              >
                {item === "assessment"
                  ? "Assignment & rubric"
                  : item === "practice"
                    ? "Self-practice"
                    : item}
              </button>
            ))}
          </div>
          <div className="detail-content">
            {panel === "objectives" && (
              <>
                <h2>
                  <BookOpen size={18} aria-hidden="true" /> Objectives
                </h2>
                <FlexibleContent value={activeCourse.objectives} />
              </>
            )}
            {panel === "units" && (
              <>
                <h2>
                  <ListVideo size={18} aria-hidden="true" /> Unit viewing map
                </h2>
                {courseCoverageGaps(activeCourse).length > 0 && (
                  <div className="gap-copy">
                    <h3>Declared course gaps and training limits</h3>
                    <ul>
                      {courseCoverageGaps(activeCourse).map(gap => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                    <p>
                      Course-wide gaps are not assigned to individual units
                      unless the source provides that mapping.
                    </p>
                  </div>
                )}
                {activeCourse.unitMap?.length ? (
                  <ol className="viewing-map">
                    {activeCourse.unitMap.map((unit, index) => (
                      <li key={`${String(unit.number)}-${index}`}>
                        <span>{unit.number ?? index + 1}</span>
                        <div>
                          <strong>{unit.text || "Untitled unit"}</strong>
                          <p>{unit.coverage || "No coverage note supplied."}</p>
                          {unit.coveredTopics?.length ? (
                            <small>
                              {medicalCourse
                                ? "Mapped, not validated complete"
                                : "Covered"}
                              : {unit.coveredTopics.join(" · ")}
                            </small>
                          ) : null}
                          {unit.uncoveredTopics?.length ? (
                            <small className="gap-copy">
                              Still outside this map:{" "}
                              {unit.uncoveredTopics.join(" · ")}
                            </small>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <FlexibleContent
                    value={activeCourse.units}
                    empty="No unit viewing map is available yet."
                  />
                )}
              </>
            )}
            {panel === "reading" && (
              <>
                <h2>
                  <FileText size={18} aria-hidden="true" /> Readings
                </h2>
                <FlexibleContent value={activeCourse.readings} />
                <div className="inline-actions">
                  <SourceLink href={activeCourse.syllabusUrl}>
                    Open syllabus
                  </SourceLink>
                  {documents.map(document => (
                    <SourceLink
                      key={document.id}
                      href={document.storageUrl || document.sourceUrl}
                    >
                      {document.title}
                    </SourceLink>
                  ))}
                </div>
              </>
            )}
            {panel === "chapters" && medicalCourse && (
              <>
                <h2>
                  <BookOpen size={18} aria-hidden="true" /> Source-prepared
                  chapters
                </h2>
                <MedicalReadingPanel
                  key={activeCourse.id}
                  courseId={activeCourse.id}
                />
              </>
            )}
            {panel === "assessment" && (
              <>
                <h2>
                  <ClipboardCheck size={18} aria-hidden="true" /> Assignment
                </h2>
                <FlexibleContent
                  value={activeCourse.assignment}
                  empty="No assignment brief has been supplied."
                />
                <h3>Assessment / rubric</h3>
                <FlexibleContent
                  value={activeCourse.assessment}
                  empty="No assessment rubric has been supplied."
                />
              </>
            )}
            {panel === "practice" && medicalCourse && (
              <>
                <h2>
                  <ClipboardCheck size={18} aria-hidden="true" /> Original
                  self-practice
                </h2>
                <MedicalPracticePanel course={activeCourse} />
              </>
            )}
            {panel === "transcript" && (
              <>
                <h2>
                  <ListVideo size={18} aria-hidden="true" /> Original lesson
                  transcript
                </h2>
                {transcriptQuery.isLoading ? (
                  <p className="muted-copy">
                    Loading transcript from the lesson manifest…
                  </p>
                ) : transcriptQuery.data?.status === "ready" ? (
                  <pre className="transcript-copy">
                    {transcriptQuery.data.transcript}
                  </pre>
                ) : (
                  <>
                    <p className="muted-copy">
                      No readable transcript is available for this original
                      lesson.
                    </p>
                    <SourceLink href={originalLesson?.transcriptUrl}>
                      Open transcript source
                    </SourceLink>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <aside className="note-panel">
          <div>
            <span className="eyebrow">
              <StickyNote size={13} aria-hidden="true" /> Private note
            </span>
            <h2>Study margin</h2>
            <p>
              {study.auth.isAuthenticated
                ? "Saved privately to your signed-in account."
                : "Guest note — saved only on this device. Sign in to start account sync."}
            </p>
          </div>
          <textarea
            aria-label="Private course note"
            value={note}
            placeholder="Questions, connections, formulas, next actions…"
            onChange={event => {
              const nextNote = event.target.value;
              noteDirtyRef.current = true;
              noteRef.current = nextNote;
              setNote(nextNote);
            }}
            onBlur={() => void saveCurrentNote()}
          />
          <div>
            <button
              className="button button-quiet"
              onClick={() => void saveCurrentNote()}
              disabled={study.isSaving}
            >
              <StickyNote size={15} aria-hidden="true" />{" "}
              {study.isSaving ? "Saving…" : "Save private note"}
            </button>
            {selected && (
              <button
                className="icon-action"
                onClick={() => {
                  saveLesson(
                    "complete",
                    selectedProgress?.positionSeconds ?? 0
                  );
                  void nextLesson();
                }}
              >
                <SkipForward size={15} aria-hidden="true" /> Complete & next
              </button>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
