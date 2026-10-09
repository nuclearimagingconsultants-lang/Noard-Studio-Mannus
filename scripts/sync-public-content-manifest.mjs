#!/usr/bin/env node
/**
 * Internal, operator-invoked public-manifest synchronizer.
 *
 * This script deliberately has no HTTP surface and accepts no arbitrary file path.
 * It writes exactly one fixed producer-owned public manifest row after the additive
 * schema migration has been applied. It must be run from the BoardStudio project
 * with DATABASE_URL provided by the managed runtime.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import mysql from "mysql2/promise";
import {
  isPublicMediaManifest,
  projectPublicMediaManifest,
} from "../shared/publicMedia.mjs";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const TIMEOUT_MS = 15_000;
const MANIFESTS = Object.freeze({
  base: "data/original-lectures.json",
  medical: "data/medical/original-lectures.json",
});
const SHA256 = /^[a-f0-9]{64}$/;

function usage(message) {
  if (message) console.error(`sync-public-content-manifest: ${message}`);
  console.error(
    "Usage: node scripts/sync-public-content-manifest.mjs --kind base|medical"
  );
  process.exitCode = 64;
}

function parseKind(argv) {
  if (
    argv.length !== 2 ||
    argv[0] !== "--kind" ||
    !Object.hasOwn(MANIFESTS, argv[1])
  ) {
    usage("requires exactly one fixed manifest kind");
    return null;
  }
  return argv[1];
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertPublicManifest(kind, bytes) {
  if (bytes.length === 0) throw new Error(`${kind} manifest is empty`);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(
      `${kind} manifest is not valid UTF-8 JSON: ${error.message}`
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${kind} manifest must be a JSON object`);
  }
  if (!Array.isArray(value.lessons)) {
    throw new Error(`${kind} manifest must contain a lessons array`);
  }
  const serialized = Buffer.from(bytes.toString("utf8"), "utf8");
  if (!serialized.equals(bytes)) {
    throw new Error(
      `${kind} manifest is not lossless UTF-8 and cannot be safely stored as public JSON`
    );
  }
  return value;
}

async function withTimeout(label, task) {
  let timer;
  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${TIMEOUT_MS}ms`)),
          TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function main() {
  const kind = parseKind(process.argv.slice(2));
  if (!kind) return;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error(
      "DATABASE_URL is unavailable; no live-publication sync was attempted"
    );

  const relativePath = MANIFESTS[kind];
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  const bytes = await withTimeout("reading local manifest", () =>
    readFile(absolutePath)
  );
  const sourceManifest = assertPublicManifest(kind, bytes);
  // Never hash or store producer internals: persistence starts at the strict
  // public projection, and read-back compares those exact projected bytes.
  const publicManifest = projectPublicMediaManifest(sourceManifest);
  if (!isPublicMediaManifest(publicManifest)) {
    throw new Error(`${kind} public manifest projection failed validation`);
  }
  const publicBytes = Buffer.from(JSON.stringify(publicManifest), "utf8");
  const manifestJson = publicBytes.toString("utf8");
  const manifestSha256 = hash(publicBytes);
  if (!SHA256.test(manifestSha256))
    throw new Error("internal SHA-256 validation failed");

  let connection;
  try {
    connection = await withTimeout("opening managed database connection", () =>
      mysql.createConnection({ uri: databaseUrl, connectTimeout: TIMEOUT_MS })
    );
    const sql = `
      INSERT INTO publicContentManifests
        (manifestType, manifestJson, manifestSha256, manifestBytes)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        manifestJson = VALUES(manifestJson),
        manifestSha256 = VALUES(manifestSha256),
        manifestBytes = VALUES(manifestBytes),
        updatedAt = CURRENT_TIMESTAMP
    `;
    await withTimeout("writing public manifest row", () =>
      connection.execute({ sql, timeout: TIMEOUT_MS }, [
        kind,
        manifestJson,
        manifestSha256,
        publicBytes.length,
      ])
    );
    const [rows] = await withTimeout("verifying public manifest row", () =>
      connection.execute(
        {
          sql: "SELECT manifestJson, manifestSha256, manifestBytes FROM publicContentManifests WHERE manifestType = ? LIMIT 1",
          timeout: TIMEOUT_MS,
        },
        [kind]
      )
    );
    const row = rows[0];
    const readBytes = row && Buffer.from(row.manifestJson, "utf8");
    const readSha256 = readBytes && hash(readBytes);
    if (
      !row ||
      row.manifestSha256 !== manifestSha256 ||
      Number(row.manifestBytes) !== publicBytes.length ||
      readSha256 !== manifestSha256 ||
      !readBytes.equals(publicBytes)
    ) {
      throw new Error(
        `read-back verification failed for ${kind}; live row was not accepted`
      );
    }
    console.log(
      JSON.stringify({
        status: "synced",
        kind,
        file: relativePath,
        bytes: publicBytes.length,
        sha256: manifestSha256,
      })
    );
  } finally {
    if (connection) {
      try {
        await withTimeout("closing managed database connection", () =>
          connection.end()
        );
      } catch (error) {
        console.error(
          `sync-public-content-manifest: connection close diagnostic: ${error.message}`
        );
      }
    }
  }
}

main().catch(error => {
  console.error(
    `sync-public-content-manifest: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
