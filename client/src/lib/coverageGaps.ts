import type { CourseRecord } from "@shared/catalog";

function gapStrings(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(gapStrings);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    // Runtime gaps are rendered by the measured course-hour summary, not as topic claims.
    if (["hoursToTarget", "hoursGap", "remainingHours"].includes(key))
      return [];
    if (typeof child === "string" && child.trim()) {
      if (["text", "topic", "title", "reason", "message"].includes(key))
        return [child];
      const label = key
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .toLowerCase();
      return [`${label}: ${child}`];
    }
    return gapStrings(child);
  });
}

/** Declared gaps are never interpreted as a verified coverage assessment. */
export function courseCoverageGaps(course: CourseRecord): string[] {
  const medical =
    course.medical && typeof course.medical === "object"
      ? (course.medical as Record<string, unknown>)
      : undefined;
  return Array.from(
    new Set([
      ...gapStrings(course.remainingGaps),
      ...gapStrings(medical?.topicGaps),
      ...(course.unitMap ?? []).flatMap(unit =>
        gapStrings(unit.uncoveredTopics)
      ),
    ])
  );
}
