import { describe, expect, it } from "vitest";
import { courseCoverageGaps } from "./coverageGaps";

const base = { id: "MED-GAPS", programId: "med", title: "Medical gap fixture" };

describe("visible declared course coverage gaps", () => {
  it("keeps object-form medical topic and clinical gaps visible without turning a duration into a topic", () => {
    const gaps = courseCoverageGaps({
      ...base,
      remainingGaps: {
        hoursToTarget: 23,
        topicGaps: [
          "Pediatric cases are incomplete",
          "Supervised procedures are not supplied",
        ],
        clinicalSkills:
          "Accredited supervised training is outside these videos",
      },
      unitMap: [{ number: 1, uncoveredTopics: [] }],
    });
    expect(gaps).toContain("Pediatric cases are incomplete");
    expect(gaps).toContain(
      "clinical skills: Accredited supervised training is outside these videos"
    );
    expect(gaps.some((text: string) => text.includes("23"))).toBe(false);
  });

  it("preserves legacy array/string gaps, supplied unit gaps and deduplicated medical topics", () => {
    const course = {
      ...base,
      remainingGaps: ["Topic A"],
      medical: { topicGaps: ["Topic A", "Topic B"] },
      unitMap: [{ uncoveredTopics: ["Topic B", "Topic C"] }],
    };
    expect(courseCoverageGaps(course)).toEqual([
      "Topic A",
      "Topic B",
      "Topic C",
    ]);
    expect(
      courseCoverageGaps({ ...base, remainingGaps: "Still missing" })
    ).toEqual(["Still missing"]);
  });

  it("does not fabricate gaps or interpret an empty map as complete", () => {
    expect(
      courseCoverageGaps({ ...base, unitMap: [{ uncoveredTopics: [] }] })
    ).toEqual([]);
  });
});
