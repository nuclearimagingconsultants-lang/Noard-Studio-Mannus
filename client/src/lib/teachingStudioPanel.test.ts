import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TeachingStudioPanel,
  TEACHING_STUDIO_SANDBOX,
  TEACHING_STUDIO_URL,
} from "../components/studio/TeachingStudioPanel";

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
    expect(html).toContain(`src="${TEACHING_STUDIO_URL}"`);
    expect(html).toContain('title="NucMed Teaching Studio — embedded application"');
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).not.toContain("window.location");
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
  it("places the medical-only Teaching Studio directly after Self-practice without removing original tabs", () => {
    expect(workspace).toMatch(/medicalCourse\s*\?\s*\["chapters" as const, "references" as const, "practice" as const, "teaching" as const\]/);
    expect(workspace).toContain('aria-expanded={item === "teaching" ? panel === item : undefined}');
    expect(workspace).toContain("priorDetailPanel.current = panel");
    for (const marker of ["<MediaPlayer", "<SourceReader", "<MedicalReadingPanel", "<MedicalPracticePanel", "<MedicalSourceReferencePanel", "Private course note", 'panel === "assessment"', 'panel === "transcript"'])
      expect(workspace).toContain(marker);
  });
});
