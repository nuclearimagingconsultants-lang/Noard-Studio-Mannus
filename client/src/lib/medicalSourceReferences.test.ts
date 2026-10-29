import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  MEDICAL_SOURCE_REFERENCE_ASSET,
  isSafeMedicalReferenceUrl,
  medicalReferenceCourse,
  parseMedicalSourceReferenceIndex,
} from "@shared/medicalSourceReferences";
import { MedicalSourceReferenceContent } from "../components/studio/MedicalSourceReferencePanel";

const actual = JSON.parse(readFileSync(resolve("client/public", MEDICAL_SOURCE_REFERENCE_ASSET.slice(1)), "utf8"));
const index = parseMedicalSourceReferenceIndex(actual);
const clone = () => structuredClone(actual);

describe("bounded citation-only medical source map", () => {
  it("validates all131exact course records and371reference assignments with zero time and no approval", () => {
    expect(index.courseCount).toBe(131);
    expect(index.referenceCount).toBe(371);
    expect(index.countedLectureMinutes).toBe(0);
    expect(index.approvedReading).toBe(false);
    expect(index.topicsComplete).toBe(false);
    expect(index.humanClinicalReviewStatus).toBe("not performed");
    expect(Object.values(index.courses).filter(v => v.references.length)).toHaveLength(129);
  });
  it("selects only the exact course and rejects inherited properties", () => {
    expect(medicalReferenceCourse(index, "MED-058")?.courseId).toBe("MED-058");
    expect(medicalReferenceCourse(index, "toString")).toBeUndefined();
    expect(medicalReferenceCourse(index, "MED-001")).toBeUndefined();
  });
  it("rejects unsafe, credential-bearing and lookalike source URLs", () => {
    for (const value of ["javascript:alert(1)", "http://pubmed.ncbi.nlm.nih.gov/1/", "https://pubmed.ncbi.nlm.nih.gov.evil.test/1/", "https://user:secret@pubmed.ncbi.nlm.nih.gov/1/", "data:text/html,example"]) {
      expect(isSafeMedicalReferenceUrl(value)).toBe(false);
    }
    expect(isSafeMedicalReferenceUrl("https://pubmed.ncbi.nlm.nih.gov/30478242/")).toBe(true);
  });
  it("rejects approval, completed-topic or positive-time promotions", () => {
    for (const [key, value] of [["approvedReading", true], ["topicsComplete", true], ["countedLectureMinutes", 1], ["humanClinicalReviewStatus", "performed"]]) {
      const changed = clone(); changed[key as string] = value;
      expect(() => parseMedicalSourceReferenceIndex(changed)).toThrow();
    }
  });
  it("rejects raw source prose, local paths and unknown reference fields", () => {
    const changed = clone();
    changed.courses["MED-058"].references[0].boundedEvidenceQuote = "Not public teaching";
    expect(() => parseMedicalSourceReferenceIndex(changed)).toThrow();
    const privatePath = clone(); privatePath.courses["MED-058"].references[0].citation = ["", "home", "example", "private"].join("/");
    expect(() => parseMedicalSourceReferenceIndex(privatePath)).toThrow();
  });
  it("rejects mismatched course IDs and counts", () => {
    const changed = clone(); changed.courses["MED-058"].courseId = "MED-001";
    expect(() => parseMedicalSourceReferenceIndex(changed)).toThrow();
    const count = clone(); count.referenceCount += 1;
    expect(() => parseMedicalSourceReferenceIndex(count)).toThrow();
  });
});

describe("reference-only course display", () => {
  it("shows partial references and explicit non-approval/time/clinical limits", () => {
    const html = renderToStaticMarkup(createElement(MedicalSourceReferenceContent, {
      course: medicalReferenceCourse(index, "MED-058"), indexedDate: index.indexedDate,
    }));
    expect(html).toContain("not approved chapters");
    expect(html).toContain("zero counted lecture");
    expect(html).toContain("Human clinician review not performed");
    expect(html).toContain("not validated coverage");
    expect(html).toContain("pubmed.ncbi.nlm.nih.gov");
    expect(html).not.toContain("Download chapter");
  });
  it("distinguishes a mapped record without sources from a record outside the pass", () => {
    const empty = renderToStaticMarkup(createElement(MedicalSourceReferenceContent, {
      course: medicalReferenceCourse(index, "MED-209"), indexedDate: index.indexedDate,
    }));
    expect(empty).toContain("No usable source-reference links");
    const absent = renderToStaticMarkup(createElement(MedicalSourceReferenceContent, { indexedDate: index.indexedDate }));
    expect(absent).toContain("not included");
  });
  it("renders citation/title content as literal text rather than executable HTML", () => {
    const course = structuredClone(index.courses["MED-058"]);
    course.references[0].title = "<script>not executable</script>";
    const html = renderToStaticMarkup(createElement(MedicalSourceReferenceContent, { course, indexedDate: index.indexedDate }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
