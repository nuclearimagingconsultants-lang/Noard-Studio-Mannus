import { describe, expect, it } from "vitest";
import { getContentSnapshot, getPublicContentSnapshot } from "./content";
import { selectCourseWorkspace } from "../shared/courseWorkspace";

describe("public snapshot release boundary", () => {
  it("projects the public snapshot but preserves all full targeted workspaces", async () => {
    const full = await getContentSnapshot();
    const publicData = await getPublicContentSnapshot();
    expect(publicData.catalog.courses).toHaveLength(
      full.catalog.courses.length
    );
    expect(Buffer.byteLength(JSON.stringify(publicData))).toBeLessThan(
      8_000_000
    );
    const medical = publicData.catalog.courses.find(
      (c: { id: string }) => c.id === "MED-001"
    );
    expect(medical?.practiceQuestions).toBeUndefined();
    for (const course of full.catalog.courses) {
      const workspace = selectCourseWorkspace(full, course.id, "course");
      expect(workspace.catalog.courses[0]?.id).toBe(course.id);
      expect(workspace.catalog.courses[0]?.practiceQuestions).toEqual(
        course.practiceQuestions
      );
      expect(workspace.catalog.courses[0]?.units).toEqual(course.units);
      expect(workspace.catalog.courses[0]?.readings).toEqual(course.readings);
    }
    expect(publicData.media.lessons).toHaveLength(full.media.lessons.length);
  }, 30_000);
});
