import type { Express, Request, Response } from "express";
import { isStableManusStoragePath } from "../shared/publicMedia.mjs";

export const DEFAULT_PUBLIC_ASSET_ORIGIN =
  "https://boardstudio-svjffwzx.manus.space";

/**
 * The asset origin is operator configuration, never a request value. Invalid
 * values fall back to the known HTTPS public snapshot rather than becoming an
 * open redirect or proxy target.
 */
export function getPublicAssetOrigin(
  env: NodeJS.ProcessEnv = process.env
): string {
  const candidate =
    env.BOARD_STUDIO_PUBLIC_ASSET_ORIGIN?.trim() ||
    DEFAULT_PUBLIC_ASSET_ORIGIN;
  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("invalid public asset origin");
    }
    return parsed.origin;
  } catch {
    return DEFAULT_PUBLIC_ASSET_ORIGIN;
  }
}

/** Returns a read-only URL selected from a trusted manifest storage path. */
export function getPublicAssetUrl(
  storagePath: unknown,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (!isStableManusStoragePath(storagePath)) return null;
  return new URL(storagePath, getPublicAssetOrigin(env)).toString();
}

function redirectPublicAsset(req: Request, res: Response) {
  // req.path deliberately excludes request query parameters and fragments, so
  // caller-supplied tokens or secrets can never reach the public origin.
  const target = getPublicAssetUrl(req.path);
  if (!target) {
    res.status(404).json({ error: "Public asset not found" });
    return;
  }
  res.set("Cache-Control", "public, max-age=300");
  res.redirect(307, target);
}

/**
 * Vercel-only read redirect for public snapshot media. Express automatically
 * services HEAD through this GET route; no upload, signing, or proxy route is
 * registered here.
 */
export function registerPublicAssetRedirect(app: Express) {
  app.get("/manus-storage/*", redirectPublicAsset);
}
