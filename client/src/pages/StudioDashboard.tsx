import { Link } from "wouter";
import { ArrowRight, BookOpen, ChevronRight, CirclePlay, FileText, RefreshCw } from "lucide-react";
import type { CourseRecord, DocumentRecord, DownloadRecord } from "@shared/catalog";
import type { StudioViewProps } from "@/lib/studioTypes";
import { CourseBadge, EmptyState, Metric, SectionHeading, SourceLink, StatusChip } from "@/components/studio/StudioPrimitives";

function firstCourse(courses: CourseRecord[]) {
  return courses.find(course => course.programId === "ai") ?? courses[0];
}

function isDownload(resource: DocumentRecord | DownloadRecord): resource is DownloadRecord {
  return "url" in resource || "kind" in resource;
}

function resourceMeta(resource: DocumentRecord | DownloadRecord) {
  if (isDownload(resource)) {
    return { label: resource.kind || "Download", href: resource.url };
  }
  return { label: resource.author || "Source document", href: resource.storageUrl || resource.sourceUrl };
}

export default function StudioDashboard({ snapshot, study, contentLoading, contentError }: StudioViewProps) {
  const { catalog } = snapshot;
  const courses = catalog.courses;
  const first = firstCourse(courses);
  const resumedProgress = [...study.progress].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).find(item => item.lessonId !== "__course__" && courses.some(course => course.id === item.courseId));
  const continueCourse = courses.find(course => course.id === resumedProgress?.courseId) ?? first;
  const completed = courses.filter(course => study.getCourseStatus(course.id) === "complete").length;
  const inProgress = courses.filter(course => study.getCourseStatus(course.id) === "in_progress").length;
  const units = courses.flatMap(course => (course.unitMap ?? []).map(unit => ({ course, unit }))).slice(0, 4);
  const topResources = [...catalog.documents.slice(0, 3), ...catalog.downloads.slice(0, 2)];

  if (!courses.length && !contentLoading) return <EmptyState title="Studio materials are not available yet">The catalog file has not been loaded. Board Studio will show incoming programs, source PDFs, and verified lessons after the content preparation process writes them.</EmptyState>;

  return <div className="page-stack dashboard-page">
    <header className="page-intro"><div><p className="eyebrow">Your independent study desk</p><h1>Continue where<br /><em>the work is.</em></h1></div><div className="content-status">{contentLoading ? <><RefreshCw size={14} className="spin" aria-hidden="true" /> Reading catalog…</> : contentError ? "Catalog refresh failed — showing the last available state." : "Materials refresh automatically"}</div></header>
    <section className="continue-panel">
      <div className="continue-copy"><p className="eyebrow">{resumedProgress ? "Continue learning" : "Begin the AI workspace"}</p><CourseBadge>{continueCourse?.id ?? "Catalog"}</CourseBadge><h2>{continueCourse?.title ?? "Preparing your course list"}</h2><p>{resumedProgress ? `Resume from ${Math.floor(resumedProgress.positionSeconds / 60)} minutes into your most recent available lesson, or choose a different course from the board.` : "Start with the first available AI course. Your progress remains at zero until you choose a lesson."}</p>{continueCourse && <Link href={`/course/${encodeURIComponent(continueCourse.id)}`} className="button button-crimson"><CirclePlay size={17} aria-hidden="true" />{resumedProgress ? "Resume workspace" : "Start first AI course"}<ArrowRight size={16} aria-hidden="true" /></Link>}</div>
      <div className="continue-metrics"><Metric label="Courses complete" value={`${completed}/${courses.length}`} note="No course is marked complete by default." /><Metric label="Active courses" value={inProgress} note={study.auth.isAuthenticated ? "Synced to your account" : "Saved on this device"} /><Metric label="Available lessons" value={catalog.stats?.lectureEntries ?? courses.reduce((count, course) => count + (course.lectures?.length ?? 0), 0)} note="Outside recordings are source-linked." /></div>
    </section>
    <section><SectionHeading index="01" eyebrow="Choose a curriculum" title="Programs in this studio" /><div className="program-switchers">{catalog.programs.map(program => <Link key={program.id} href={program.id === "med" ? "/med" : `/program/${encodeURIComponent(program.id)}`} className="program-switcher"><span className="program-switcher-top"><span className="program-dot" aria-hidden="true" /><small>{program.courseCount ?? courses.filter(course => course.programId === program.id).length} courses</small></span><strong>{program.name || program.id}</strong><span>{program.fullName || program.description || "Open curriculum"}</span><ChevronRight size={16} aria-hidden="true" /></Link>)}</div></section>
    <section className="dashboard-lower"><div><SectionHeading index="02" eyebrow="Next in sequence" title="Study units" action={<Link href="/board" className="text-action">Open board <ArrowRight size={14} /></Link>} /><div className="unit-list">{units.length ? units.map(({ course, unit }, index) => <Link key={`${course.id}-${String(unit.number)}-${index}`} href={`/course/${encodeURIComponent(course.id)}`} className="unit-row"><span className="unit-no">{unit.number ?? index + 1}</span><div><CourseBadge>{course.id}</CourseBadge><strong>{unit.text || "Unit title awaiting extraction"}</strong><small>{unit.coverage || "Review available course materials"}</small></div><StatusChip status={study.getCourseStatus(course.id)} /></Link>) : <p className="muted-copy">Units will appear here when the incoming catalog includes a course map.</p>}</div></div><div><SectionHeading index="03" eyebrow="Source desk" title="Resources" action={<Link href="/library" className="text-action">View library <ArrowRight size={14} /></Link>} /><div className="resource-list">{topResources.length ? topResources.map(resource => { const meta = resourceMeta(resource); return <div key={resource.id} className="resource-row"><FileText size={18} aria-hidden="true" /><div><strong>{resource.title}</strong><small>{meta.label}</small></div><SourceLink href={meta.href}>Open</SourceLink></div>; }) : <p className="muted-copy">Source books, guides, and downloadable boards will surface here as their manifest entries arrive.</p>}</div></div></section>
    {catalog.credentialNotice && <p className="credential-notice"><BookOpen size={16} aria-hidden="true" />{catalog.credentialNotice}</p>}
  </div>;
}
