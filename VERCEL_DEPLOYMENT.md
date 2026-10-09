# Vercel deployment — public Board Studio snapshot

This guide applies only to this separate public snapshot. It must **not** be
connected to, redeploy, or modify the original Manus project or its hosted
website.

## Before import

1. Import the reviewed public source repository:
   [nuclearimagingconsultants-lang/Noard-Studio-Mannus](https://github.com/nuclearimagingconsultants-lang/Noard-Studio-Mannus).
2. Review the tree for secrets and private material before pushing. Do not add
   Manus credentials, private database exports, learner rows, PDF/MP4 binaries,
   internal audit state, or Git history from another project.
3. Vercel account/project creation and deployment are intentionally outside
   this repository preparation.

## Exact Vercel import settings

| Setting | Value |
| --- | --- |
| Framework Preset | `Vite` |
| Root Directory | `.` |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build:vercel` |
| Output Directory | `dist/public` |
| Node/package manager | Use the checked-in `packageManager`: `pnpm@10.18.0` |

These values are checked into [vercel.json](./vercel.json). It uses one bundled
Express function at `api/index.mjs`, includes `data/**` in that function, routes
`/api/*` and `/manus-storage/*` to it, and serves the Vite output from Vercel's
CDN. The SPA fallback excludes API, media, Vite assets, and common static file
extensions so a missing API or asset is not turned into `index.html`.

`pnpm build:vercel` regenerates `api/index.mjs` from `server/vercelApp.ts` and
Vite output. The generated bundle is committed because runtime-only TypeScript
aliases/ESM resolution are not assumed on the serverless platform. Regenerate
and commit it whenever server code changes.

## Environment variables

**None are required for anonymous study.** Guest progress and notes remain in
browser local storage and the UI hides Sign in to sync if no OAuth configuration
is present.

| Variable | Optional purpose |
| --- | --- |
| `BOARD_STUDIO_PUBLIC_ASSET_ORIGIN` | HTTPS-only origin for the existing public media/PDF snapshot. Defaults to `https://boardstudio-svjffwzx.manus.space`. It is fixed operator configuration, not a client-controlled proxy target. |
| `MANUS_PROJECT_ID`, `MANUS_OAUTH_PORTAL_URL`, related session/API variables | Only for a separately authorized, lawful OAuth/session integration you control. Do **not** copy values from the original Manus project. |
| `DATABASE_URL` | Only for your own authenticated progress/notes database. The static curriculum/media snapshot works without it. |

Start from the blank [.env.example](./.env.example), not an existing deployment
configuration. Never put actual credentials in Git or browser-visible config.

## Media and transcript behavior

The repository contains public manifest paths, not the original MP4/PDF files.
For `GET`/`HEAD` `/manus-storage/*`, the function validates the stable manifest
path and sends a 307 redirect to the fixed HTTPS asset origin. Query strings,
authorization headers, and credentials are not forwarded. There is no upload or
arbitrary external URL proxy.

Native video and `<track>` captions follow that redirect. Browser video/caption
playback requires the final existing asset origin to allow the needed public
fetch/CORS behavior; test an actual ready clip and captions after deployment.
When private Manus storage signing is unavailable, transcript retrieval makes a
bounded 12-second, read-only attempt against the fixed origin using only the
matching trusted manifest path. It never accepts a transcript URL from a
request.

The data snapshot does **not** update automatically. A later update must be a
new reviewed export with lawful content and an updated regenerated API bundle.

## Truthful scope and rights

The compact snapshot supports 384 course workspaces (333 medical programme or
variant records) and reports 219 ready originals (147 base, 72 medical). That
is the frozen bundled-snapshot count, not a claim about later hosted-production
additions or completed courses. Medical content remains incomplete and
human clinician review has not been performed. Automated checks are not
clinician review; self-study is not institutional affiliation, credit,
credential, clinical training, eligibility, certification, or a boards-pass
guarantee.

Third-party sources remain subject to their own licenses. This public repository
does not relicense them or grant a right to rehost PDFs, media, clinical images,
or other protected material. See [STUDIO_GUIDE.md](./STUDIO_GUIDE.md) and
[TODO.md](./TODO.md) for the retained availability and credential boundaries.
