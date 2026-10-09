import type { ContentSnapshot, OriginalLesson } from "./catalog";
import { selectCourseForProgramQueue } from "./catalogDirectory";

export type WorkspaceScope = "course" | "program";

/** Keep the complete source catalogue intact; reduce only a course response. */
export function selectCourseWorkspace(
  source: ContentSnapshot,
  courseId: string,
  scope: WorkspaceScope = "course"
): ContentSnapshot {
  const selected = source.catalog.courses.find(
    course => course.id === courseId
  );
  const courses = selected
    ? source.catalog.courses.filter(course =>
        scope === "program"
          ? course.programId === selected.programId
          : course.id === courseId
      )
    : [];
  const courseIds = new Set(courses.map(course => course.id));
  const programIds = new Set(courses.map(course => course.programId));
  const relevantLesson = (lesson: OriginalLesson) => {
    if (lesson.courseIds?.length)
      return lesson.courseIds.some(id => courseIds.has(id));
    return Boolean(lesson.programIds?.some(id => programIds.has(id)));
  };
  const lessons = source.media.lessons.filter(relevantLesson);
  const documentIds = new Set([
    ...courses.flatMap(course => course.pdfIds ?? []),
    ...lessons.flatMap(lesson => (lesson.sourceId ? [lesson.sourceId] : [])),
    ...courses.map(course => `syllabus-${course.id}`),
  ]);
  const documents = source.catalog.documents.filter(
    document =>
      documentIds.has(document.id) ||
      document.aliases?.some(alias => documentIds.has(alias)) ||
      document.courseIds?.some(id => courseIds.has(id)) ||
      (!document.courseIds?.length &&
        document.programIds?.some(id => programIds.has(id)))
  );
  return {
    ...source,
    catalog: {
      ...source.catalog,
      courses:
        scope === "program"
          ? courses.map(course =>
              course.id === courseId
                ? course
                : selectCourseForProgramQueue(course)
            )
          : courses,
      documents,
    },
    media: {
      ...source.media,
      lessons,
      sourceCoverage: source.media.sourceCoverage?.filter(entry =>
        Boolean(entry.sourceId && documentIds.has(entry.sourceId))
      ),
    },
    assetIndex: null,
  };
}
