import { createServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_ASSET_ORIGIN,
  getPublicAssetOrigin,
  getPublicAssetUrl,
  registerPublicAssetRedirect,
} from "./publicAssetOrigin";

let closeServer: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeServer?.();
  closeServer = undefined;
});

describe("public asset origin", () => {
  it("uses only a configured HTTPS origin and rejects malformed origins", () => {
    expect(
      getPublicAssetOrigin({
        BOARD_STUDIO_PUBLIC_ASSET_ORIGIN: "https://assets.example",
      })
    ).toBe("https://assets.example");
    expect(
      getPublicAssetOrigin({
        BOARD_STUDIO_PUBLIC_ASSET_ORIGIN: "http://assets.example",
      })
    ).toBe(DEFAULT_PUBLIC_ASSET_ORIGIN);
    expect(
      getPublicAssetOrigin({
        BOARD_STUDIO_PUBLIC_ASSET_ORIGIN: "https://user:pass@assets.example",
      })
    ).toBe(DEFAULT_PUBLIC_ASSET_ORIGIN);
  });

  it("builds a URL only from a stable manifest path", () => {
    expect(
      getPublicAssetUrl("/manus-storage/lesson_123.mp4", {
        BOARD_STUDIO_PUBLIC_ASSET_ORIGIN: "https://assets.example",
      })
    ).toBe("https://assets.example/manus-storage/lesson_123.mp4");
    expect(getPublicAssetUrl("https://evil.example/video.mp4")).toBeNull();
    expect(getPublicAssetUrl("/manus-storage/../secret.mp4")).toBeNull();
  });

  it("redirects GET and HEAD without forwarding caller query parameters", async () => {
    const app = express();
    registerPublicAssetRedirect(app);
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    closeServer = () => new Promise(resolve => server.close(() => resolve()));
    const url = `http://127.0.0.1:${address.port}/manus-storage/clip_123.mp4?token=never-forwarded`;

    const get = await fetch(url, { redirect: "manual" });
    expect(get.status).toBe(307);
    expect(get.headers.get("location")).toBe(
      `${DEFAULT_PUBLIC_ASSET_ORIGIN}/manus-storage/clip_123.mp4`
    );

    const head = await fetch(url, { method: "HEAD", redirect: "manual" });
    expect(head.status).toBe(307);
    expect(head.headers.get("location")).not.toContain("token=");

    const rejected = await fetch(
      `http://127.0.0.1:${address.port}/manus-storage/%2e%2e/secret.mp4`,
      { redirect: "manual" }
    );
    expect(rejected.status).toBe(404);
  });
});
