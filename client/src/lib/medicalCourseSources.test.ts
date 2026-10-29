import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CourseRecord } from "@shared/catalog";
import {
  MEDICAL_COURSE_SOURCE_DATA_FILE,
  citationTitleMatches,
  medicalCourseResearchSources,
  medicalReferencesForUnit,
  parseMedicalCourseSourceData,
  withMedicalResearchSources,
} from "@shared/medicalCourseSources";
import { MedicalCourseResearchContent, MedicalUnitSourceLinks } from "../components/studio/MedicalSourceReferencePanel";

const raw = JSON.parse(readFileSync(resolve("data", MEDICAL_COURSE_SOURCE_DATA_FILE), "utf8"));
const data = parseMedicalCourseSourceData(raw);
const old = JSON.parse(readFileSync(resolve("client/public/medical-source-references.5c80242c04f4ecd5.json"), "utf8"));
const clone = () => structuredClone(raw);
const source = () => medicalCourseResearchSources("MED-209", data)!;

describe("course-record bibliography data", () => {
  it("adds six citations to the two empty records and retains all371earlier assignments exactly", () => {
    expect(data.sourceIndex.referenceCount).toBe(377);
    expect(Object.values(data.sourceIndex.courses).filter(c => c.references.length)).toHaveLength(131);
    for (const [id, prior] of Object.entries(old.courses) as [string, { references: unknown[] }][]) {
      if (prior.references.length) expect(data.sourceIndex.courses[id].references).toEqual(prior.references);
    }
    expect(data.sourceIndex.courses["MED-209"].references).toHaveLength(3);
    expect(data.sourceIndex.courses["MED-X061"].references).toHaveLength(3);
    expect(Object.keys(data.pubmedMetadata)).toHaveLength(354);
  });
  it("recognizes exact article titles within full citations but does not guess abbreviated or unrelated identities", () => {
    expect(citationTitleMatches("Author A. Wound Healing: Part I. Basic Science. Journal. 2016.", "Wound Healing: Part I. Basic Science.")).toBe(true);
    expect(citationTitleMatches("Cardiac disease", "Unrelated lung disease study")).toBe(false);
    expect(citationTitleMatches("Diagnosis and treatment of cardiac amyloidosis", "Diagnosis and treatment of cardiac amyloidosis: a position statement.")).toBe(false);
  });
  it("rejects positive time, approval, clinical-review changes, abstract bodies and forged source URLs", () => {
    for (const [key, value] of [["countedLectureMinutes", 1], ["approvedReading", true], ["topicsComplete", true], ["humanClinicalReviewStatus", "performed"]]) {
      const changed = clone(); changed[key as string] = value;
      expect(() => parseMedicalCourseSourceData(changed)).toThrow();
    }
    const abstract = clone(); abstract.pubmedMetadata["27556781"].abstract = "Not allowed";
    expect(() => parseMedicalCourseSourceData(abstract)).toThrow();
    const url = clone(); url.pubmedMetadata["27556781"].sourceUrl = "https://evil.test/27556781/";
    expect(() => parseMedicalCourseSourceData(url)).toThrow();
  });
  it("adds only one isolated field and never edits curriculum, legacy sources or hours", () => {
    const course: CourseRecord = { id: "MED-209", programId: "med", title: "Plastic Surgery", lectures: [], sourceReferences: ["retained"], hoursGap: 19, verifiedTotalHours: 17, coverageStatus: "incomplete" };
    const result = withMedicalResearchSources(course, data);
    const { researchSources, ...rest } = result;
    expect(rest).toEqual(course);
    expect(researchSources?.references).toHaveLength(3);
    expect(researchSources?.countedLectureMinutes).toBe(0);
    const base = { ...course, id: "AI-001", programId: "ai" };
    expect(withMedicalResearchSources(base, data)).toBe(base);
    const absent = { ...course, id: "MED-001" };
    expect(withMedicalResearchSources(absent, data)).toBe(absent);
  });
  it("fails visibly without source guesses when data is missing", () => {
    const result = withMedicalResearchSources({ id: "MED-209", programId: "med", title: "Plastic Surgery" }, undefined);
    expect(result.researchSources?.status).toBe("unavailable");
    expect(result.researchSources?.references).toEqual([]);
    const html = renderToStaticMarkup(createElement(MedicalCourseResearchContent, { sources: result.researchSources! }));
    expect(html).toContain("source data is unavailable");
    expect(html).toContain("not approved chapters");
  });
  it("selects only suggested exact units, and withholds unresolved citation identity links", () => {
    expect(medicalReferencesForUnit(source(), 1)).toHaveLength(1);
    expect(medicalReferencesForUnit(source(), 99)).toHaveLength(0);
    expect(medicalReferencesForUnit(source(), "invalid")).toHaveLength(0);
    const changed = source(); changed.references[0].citationIdentity = "title_differs";
    expect(medicalReferencesForUnit(changed, 1)).toHaveLength(0);
    expect(medicalReferencesForUnit(changed, 2)).toHaveLength(1);
  });
  it("renders real citation details and zero-time boundaries, not article bodies or approved chapters", () => {
    const html = renderToStaticMarkup(createElement(MedicalCourseResearchContent, { sources: source() }));
    expect(html).toContain("PMID: 27556781");
    expect(html).toContain("DOI:");
    expect(html).toContain("not full-text or clinical review");
    expect(html).toContain("Original proposed citation");
    expect(html).toContain("zero counted lecture");
    expect(html).not.toContain("Download chapter");
    const unit = renderToStaticMarkup(createElement(MedicalUnitSourceLinks, { sources: source(), unitNumber: 1 }));
    expect(unit).toContain("not validated coverage");
    expect(unit).toContain("27556781");
    expect(unit).not.toContain("38051821");
  });
  it("renders a title mismatch explicitly while preserving the proposed citation as literal text", () => {
    const changed = source(); changed.references[0].citationIdentity = "title_differs";
    changed.references[0].reference.title = "<script>not executable</script>";
    const html = renderToStaticMarkup(createElement(MedicalCourseResearchContent, { sources: changed }));
    expect(html).toContain("Citation title needs review");
    expect(html).toContain("unit links are withheld");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
