import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TeachingStudioPanel,
  TEACHING_STUDIO_SANDBOX,
  TEACHING_STUDIO_URL,
  teachingStudioLiveUrl,
} from "../components/studio/TeachingStudioPanel";
import { resizedStudioSize, MIN_STUDIO_HEIGHT, MIN_STUDIO_WIDTH } from "../components/studio/useStudioResize";

const render = (active: boolean) =>
  renderToStaticMarkup(createElement(TeachingStudioPanel, { active, onClose() {} }));
const workspace = readFileSync("client/src/pages/CourseWorkspace.tsx", "utf8");

describe("user-owned inline Teaching Studio", () => {
  it("makes no iframe or external request before deliberate first opening", () => {
    expect(render(false)).toBe("");
  });
  it("embeds only the exact authorized HTTPS site, never a page redirect", () => {
    const html = render(true);
    expect(TEACHING_STUDIO_URL).toBe("https://teaching-studios.vercel.app/studio/NucMed-Board-Studio.html");
    expect(html).toContain(`<iframe`);
    expect(html).toContain(`src="${TEACHING_STUDIO_URL}?__boardstudio_refresh=`);
    expect(html).toContain('title="NucMed Teaching Studio — embedded application"');
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).not.toContain("window.location");
  });
  it("refreshes the separate live site without republishing Board Studio or transferring course data", () => {
    const first = new URL(teachingStudioLiveUrl("first opening"));
    const next = new URL(teachingStudioLiveUrl("explicit reload"));
    expect(first.origin + first.pathname).toBe(TEACHING_STUDIO_URL);
    expect(next.origin + next.pathname).toBe(TEACHING_STUDIO_URL);
    expect(first.href).not.toBe(next.href);
    expect([...next.searchParams.keys()]).toEqual(["__boardstudio_refresh"]);
    expect(render(true)).toContain("no Board Studio update needed");
    expect(render(true)).toContain("not interrupted automatically");
  });
  it("allows normal app interaction but denies top-level navigation and credentials access", () => {
    const tokens = TEACHING_STUDIO_SANDBOX.split(" ");
    expect(tokens).toContain("allow-scripts");
    expect(tokens).toContain("allow-same-origin");
    expect(tokens).toContain("allow-forms");
    expect(tokens).toContain("allow-downloads");
    expect(tokens.some(t => t.startsWith("allow-top-navigation"))).toBe(false);
    expect(render(true)).toContain('referrerPolicy="no-referrer"');
    expect(render(true)).not.toContain("allow-storage-access-by-user-activation");
  });
  it("offers inline reload, height expansion, collapse and only an optional safe separate-tab link", () => {
    const html = render(true);
    for (const text of ["Reload", "Expand window", "Collapse", "separate tab", "nothing redirects automatically"])
      expect(html).toContain(text);
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).toContain("progress stays separate");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Successfully connected");
  });
  it("has no application maximum while rejecting nonfinite sizes and retaining useful minimums", () => {
    const start = { width: 1200, height: 780 };
    expect(resizedStudioSize(start, 1_000_000, 1_000_000)).toEqual({ width: start.width + 1_000_000, height: start.height + 1_000_000 });
    expect(resizedStudioSize(start, -10000, -10000)).toEqual({ width: MIN_STUDIO_WIDTH, height: MIN_STUDIO_HEIGHT });
    expect(resizedStudioSize(start, Infinity, NaN)).toEqual(start);
  });
  it("offers a keyboard-described drag handle and scrollable canvas without recreating the frame for sizing", () => {
    const html = render(true);
    expect(html).toContain('aria-label="Resize Teaching Studio window"');
    expect(html).toContain('aria-describedby="teaching-studio-resize-help"');
    expect(html).toContain('class="teaching-studio-viewport"');
    expect(html).toContain('class="teaching-studio-canvas"');
    expect(html).toContain("Shift makes bigger steps");
    expect(html).toContain("taller windows move the content below down");
  });
  it("retains exactly one existing note editor and selects its medical/base layout without a new note store", () => {
    expect(workspace.match(/<textarea/g)).toHaveLength(1);
    expect(workspace).toContain("const studyMargin = (");
    expect(workspace).toContain("{medicalCourse && studyMargin}");
    expect(workspace).toContain("{!medicalCourse && studyMargin}");
    expect(workspace).toContain("noteRef.current = nextNote");
    expect(workspace).toContain("onBlur={() => void saveCurrentNote()}");
    expect(workspace).toContain("course-workspace--wide");
  });
  it("places the medical-only Teaching Studio directly after Self-practice without removing original tabs", () => {
    expect(workspace).toMatch(/medicalCourse\s*\?\s*\["chapters" as const, "references" as const, "practice" as const, "teaching" as const\]/);
    expect(workspace).toContain('aria-expanded={item === "teaching" ? panel === item : undefined}');
    expect(workspace).toContain("priorDetailPanel.current = panel");
    for (const marker of ["<MediaPlayer", "<SourceReader", "<MedicalReadingPanel", "<MedicalPracticePanel", "<MedicalSourceReferencePanel", "Private course note", 'panel === "assessment"', 'panel === "transcript"'])
      expect(workspace).toContain(marker);
  });
});
