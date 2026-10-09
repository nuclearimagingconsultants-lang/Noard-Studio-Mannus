import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CourseRecord } from "../../../shared/catalog";
import { validateMedicalCourse } from "../../../shared/medical";
import {
  MedicalCourseOverview,
  MedicalPracticePanel,
} from "../components/studio/MedicalCourseDetails";

const directory = resolve(process.cwd(), "data/medical");
const index = JSON.parse(
  readFileSync(resolve(directory, "catalog-index.json"), "utf8")
) as { courseParts: string[] };
const courses = index.courseParts.flatMap(
  name =>
    JSON.parse(readFileSync(resolve(directory, name), "utf8")) as CourseRecord[]
);

describe("real imported medical rendering", () => {
  it("renders MED-001's structured board record rather than crashing", () => {
    const course = courses.find(item => item.id === "MED-001")!;
    const html = renderToStaticMarkup(
      createElement(MedicalCourseOverview, { course })
    );
    expect(html).toContain("Board scope");
    expect(html).toContain("primary Board");
    expect(
      validateMedicalCourse(course).filter(issue =>
        issue.startsWith("boardStatus")
      )
    ).toEqual([]);
  });
  it("renders every retained specialty overview without an invalid React child", () => {
    for (const course of courses) {
      expect(
        () =>
          renderToStaticMarkup(
            createElement(MedicalCourseOverview, { course })
          ),
        course.id
      ).not.toThrow();
    }
  });
  it("renders every retained specialty's structurally valid practice questions", () => {
    for (const course of courses) {
      expect(
        () =>
          renderToStaticMarkup(createElement(MedicalPracticePanel, { course })),
        course.id
      ).not.toThrow();
    }
  });
});
