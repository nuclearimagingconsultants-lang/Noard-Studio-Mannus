import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
import { isPublicMediaManifest } from "../shared/publicMedia.mjs";

export const PUBLIC_MANIFEST_KINDS = ["base", "medical"] as const;
export type PublicManifestKind = (typeof PUBLIC_MANIFEST_KINDS)[number];

type JsonRecord = Record<string, unknown>;
type PublicManifestRow = {
  manifestType: string;
  manifestJson: string;
  manifestSha256: string;
  manifestBytes: number;
};

export type ValidPublicManifest = {
  kind: PublicManifestKind;
  value: JsonRecord;
  sha256: string;
  bytes: number;
};

export type ManifestSource = {
  value: unknown;
  version: string;
  source: "live" | "bundled";
};

const SHA256 = /^[a-f0-9]{64}$/;
const CACHE_TTL_MS = 15_000;
const READ_DEADLINE_MS = 4_000;
let inFlight:
  | Promise<Partial<Record<PublicManifestKind, ValidPublicManifest>>>
  | undefined;
let liveCache:
  | {
      expiresAt: number;
      manifests: Partial<Record<PublicManifestKind, ValidPublicManifest>>;
    }
  | undefined;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPublicManifestKind(value: unknown): value is PublicManifestKind {
  return (
    typeof value === "string" &&
    (PUBLIC_MANIFEST_KINDS as readonly string[]).includes(value)
  );
}

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

/**
 * A row is usable only when its exact UTF-8 payload, byte count, SHA-256, and
 * minimal producer manifest shape all agree. Invalid DB data never replaces a
 * bundled manifest.
 */
export function validatePublicManifestRow(
  candidate: unknown,
  expectedKind?: PublicManifestKind
): ValidPublicManifest | null {
  if (!isRecord(candidate)) return null;
  const kind = candidate.manifestType;
  const manifestJson = candidate.manifestJson;
  const manifestSha256 = candidate.manifestSha256;
  const manifestBytes = candidate.manifestBytes;
  if (
    !isPublicManifestKind(kind) ||
    (expectedKind && kind !== expectedKind) ||
    typeof manifestJson !== "string" ||
    typeof manifestSha256 !== "string" ||
    !SHA256.test(manifestSha256) ||
    typeof manifestBytes !== "number" ||
    !Number.isSafeInteger(manifestBytes) ||
    manifestBytes < 1
  ) {
    return null;
  }
  const bytes = Buffer.from(manifestJson, "utf8");
  if (
    bytes.length !== manifestBytes ||
    sha256Utf8(manifestJson) !== manifestSha256
  ) {
    return null;
  }
  try {
    const value = JSON.parse(manifestJson) as unknown;
    // Hash/byte validation above always applies to the raw SQL payload. A
    // legacy or manually altered row also has to already equal the strict
    // public projection; otherwise it cannot become a trusted live response.
    if (!isPublicMediaManifest(value)) return null;
    return { kind, value, sha256: manifestSha256, bytes: manifestBytes };
  } catch {
    return null;
  }
}

/** Resolves each source independently, so a bad medical row cannot hide base media (or reverse). */
export function resolveManifestSources(
  bundled: Record<PublicManifestKind, { value: unknown; version: string }>,
  liveRows: unknown[]
): Record<PublicManifestKind, ManifestSource> {
  const rows = new Map<PublicManifestKind, ValidPublicManifest>();
  for (const kind of PUBLIC_MANIFEST_KINDS) {
    const row = liveRows
      .map(candidate => validatePublicManifestRow(candidate, kind))
      .find(
        (candidate): candidate is ValidPublicManifest => candidate !== null
      );
    if (row) rows.set(kind, row);
  }
  return Object.fromEntries(
    PUBLIC_MANIFEST_KINDS.map(kind => {
      const row = rows.get(kind);
      return [
        kind,
        row
          ? {
              value: row.value,
              version: `live:${row.sha256}`,
              source: "live" as const,
            }
          : {
              value: bundled[kind].value,
              version: bundled[kind].version,
              source: "bundled" as const,
            },
      ];
    })
  ) as Record<PublicManifestKind, ManifestSource>;
}

/** The loader validated exact raw UTF-8 bytes/hash before returning this map. */
export function resolveValidatedManifestSources(
  bundled: Record<PublicManifestKind, { value: unknown; version: string }>,
  validated: Partial<Record<PublicManifestKind, ValidPublicManifest>>
): Record<PublicManifestKind, ManifestSource> {
  return Object.fromEntries(
    PUBLIC_MANIFEST_KINDS.map(kind => {
      const row = validated[kind];
      return [
        kind,
        row && row.kind === kind
          ? {
              value: row.value,
              version: `live:${row.sha256}`,
              source: "live" as const,
            }
          : {
              value: bundled[kind].value,
              version: bundled[kind].version,
              source: "bundled" as const,
            },
      ];
    })
  ) as Record<PublicManifestKind, ManifestSource>;
}

/** A stalled read is cancelled before the caller falls back to bundled content. */
export async function readBoundedPublicManifestRows(
  read: () => Promise<unknown[]>,
  cancel: () => void,
  deadlineMs = READ_DEADLINE_MS
): Promise<unknown[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          try {
            cancel();
          } catch {
            /* Fallback must still resolve if cancellation throws. */
          }
          reject(new Error("Public manifest read deadline exceeded"));
        }, deadlineMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** A dedicated cancellable read connection never destroys learner database work. */
async function readPublicRows(databaseUrl: string): Promise<unknown[]> {
  let connection: mysql.Connection | undefined;
  let cancelled = false;
  try {
    return await readBoundedPublicManifestRows(
      async () => {
        connection = await mysql.createConnection({
          uri: databaseUrl,
          connectTimeout: 2_000,
        });
        if (cancelled) {
          connection.destroy();
          throw new Error("Public manifest connection exceeded deadline");
        }
        const [rows] = await connection.query<mysql.RowDataPacket[]>({
          sql: "SELECT manifestType, manifestJson, manifestSha256, manifestBytes FROM publicContentManifests",
          timeout: 2_000,
        });
        return rows;
      },
      () => {
        cancelled = true;
        connection?.destroy();
      }
    );
  } finally {
    connection?.destroy();
  }
}

async function loadLivePublicManifests(): Promise<
  Partial<Record<PublicManifestKind, ValidPublicManifest>>
> {
  let manifests: Partial<Record<PublicManifestKind, ValidPublicManifest>> = {};
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn(
        "[Content] Public manifest feed unavailable; using bundled manifests."
      );
    } else {
      const rows = await readPublicRows(databaseUrl);
      for (const kind of PUBLIC_MANIFEST_KINDS) {
        const valid = rows
          .map(row => validatePublicManifestRow(row, kind))
          .find((row): row is ValidPublicManifest => row !== null);
        if (valid) manifests[kind] = valid;
        else if (rows.some(row => isRecord(row) && row.manifestType === kind)) {
          console.warn(
            `[Content] Ignoring invalid live ${kind} manifest row; using bundled fallback.`
          );
        }
      }
    }
  } catch (error) {
    console.warn(
      "[Content] Public manifest feed read failed; using bundled manifests:",
      error instanceof Error ? error.name : "unknown read failure"
    );
  }
  liveCache = { expiresAt: Date.now() + CACHE_TTL_MS, manifests };
  return manifests;
}

/** Queries only public rows; concurrent requests share a single bounded read. */
export async function getLivePublicManifests(): Promise<
  Partial<Record<PublicManifestKind, ValidPublicManifest>>
> {
  if (liveCache && liveCache.expiresAt > Date.now()) return liveCache.manifests;
  if (!inFlight)
    inFlight = loadLivePublicManifests().finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

/** Test-only cache reset; production refreshes the public feed after a short TTL. */
export function resetLivePublicManifestCacheForTest() {
  liveCache = undefined;
}
