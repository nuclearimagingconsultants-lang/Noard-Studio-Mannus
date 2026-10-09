import { ArrowRight, Check, CircleDot, MoveRight, RotateCcw } from "lucide-react";
import { Link } from "wouter";
import type { StudyStatus } from "@/lib/studyStorage";
import type { StudioViewProps } from "@/lib/studioTypes";
import { CourseBadge, EmptyState, SectionHeading, StatusChip } from "@/components/studio/StudioPrimitives";

type Column = { status: StudyStatus; title: string; description: string; icon: typeof CircleDot };
const columns: Column[] = [
  { status: "not_started", title: "Backlog", description: "Course materials ready to choose", icon: CircleDot },
  { status: "in_progress", title: "In progress", description: "Active study work", icon: MoveRight },
  { status: "complete", title: "Complete", description: "Marked by you", icon: Check },
];

function nextAction(status: StudyStatus) {
  if (status === "not_started") return { label: "Start", target: "in_progress" as StudyStatus, icon: MoveRight };
  if (status === "in_progress") return { label: "Complete", target: "complete" as StudyStatus, icon: Check };
  return { label: "Reopen", target: "in_progress" as StudyStatus, icon: RotateCcw };
}

export default function BoardPage({ snapshot, study }: StudioViewProps) {
  const courses = snapshot.catalog.courses;
  if (!courses.length) return <EmptyState title="Study board is waiting for courses">When catalog courses are present, you can move them between backlog, active study, and complete. No status is assigned automatically.</EmptyState>;
  return <div className="page-stack board-page"><header className="page-intro"><div><p className="eyebrow">Private study workflow</p><h1>Move the work<br /><em>when it moves you.</em></h1></div><p className="board-sync-copy">{study.auth.isAuthenticated ? "Your status changes are stored privately with your account." : "Guest board changes are saved only in this browser. Sign in to use your private account record."}</p></header><SectionHeading index="01" eyebrow="Course status" title="Your study board" />
    <div className="course-board">{columns.map(column => { const Icon = column.icon; const current = courses.filter(course => study.getCourseStatus(course.id) === column.status); return <section className={`board-column ${column.status}`} key={column.status}><header><div><Icon size={17} aria-hidden="true" /><h2>{column.title}</h2></div><span>{current.length}</span><p>{column.description}</p></header><div className="board-stack">{current.length ? current.map(course => { const action = nextAction(column.status); const ActionIcon = action.icon; return <article className="board-card" key={course.id}><div><CourseBadge>{course.id}</CourseBadge><StatusChip status={column.status} /></div><h3>{course.title}</h3><p>{course.studyHours ? `${course.studyHours} planned study hours` : course.coverageStatus || "Open source materials to begin."}</p><div className="board-card-actions"><Link href={`/course/${encodeURIComponent(course.id)}`} className="text-action">Open <ArrowRight size={14} /></Link><button onClick={() => study.saveProgress({ courseId: course.id, lessonId: "__course__", status: action.target, positionSeconds: 0 })}><ActionIcon size={14} aria-hidden="true" /> {action.label}</button></div></article>}) : <div className="board-zero">Nothing here yet.</div>}</div></section>; })}</div></div>;
}
