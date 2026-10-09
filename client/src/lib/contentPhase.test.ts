import { describe, expect, it } from "vitest";
import { contentPhase } from "./contentPhase";

describe("content loading boundary", () => {
  it("never renders route absence while the initial request is pending", () => {
    expect(contentPhase(false, true, false)).toBe("loading");
  });
  it("shows actionable failure rather than not-found after a network error", () => {
    expect(contentPhase(false, false, true)).toBe("error");
  });
  it("keeps an already-loaded course available during background refresh", () => {
    expect(contentPhase(true, true, false)).toBe("ready");
    expect(contentPhase(true, false, true)).toBe("ready");
  });
  it("allows actual missing-course lookup only after a completed empty result", () => {
    expect(contentPhase(false, false, false)).toBe("empty");
  });
});
