# Noard-Studio-Mannus

**Board Studio — public independent-study snapshot**

Board Studio is an independent self-study interface for the included AI/CS/CSE, MBA, Finance, CTO, and medical curriculum records. This repository is a separate public snapshot at source checkpoint `036163943404b0207d8ef7e5fcaa7f1b10388381`; it does not alter or deploy the original Manus project. The owner's initial repository commit and repository title are retained.

## Snapshot scope

The compact index/parts support **384 course workspaces**, including **333 medical programme/variant records**. The bundled manifests report **219 ready originals**: **147 base** and **72 medical**. These are the frozen bundled snapshot counts, not later hosted-production additions, completed courses, or complete programmes.

> **Medical content is incomplete and human clinician review has not been performed.** Automated source checks are not clinician or academic peer review. This project is not affiliated with its named source institutions, does not award credit or credentials, is not clinical training, and cannot establish licensure, board eligibility, certification, or a board-pass outcome.

Detailed availability, source, credential, and remaining-work boundaries are kept in [STUDIO_GUIDE.md](./STUDIO_GUIDE.md) and [TODO.md](./TODO.md).

## Local development

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm dev
```

Guest study is usable with **no environment variables**. Guest notes and progress are stored only in the browser/device. The Sign in to sync control is hidden unless lawful OAuth configuration is supplied.

```bash
pnpm build:vercel
```

This creates `dist/public/` for CDN delivery and regenerates the committed `api/index.mjs` serverless Express bundle. Do not edit that bundle by hand.

## Vercel deployment

Import [this public repository](https://github.com/nuclearimagingconsultants-lang/Noard-Studio-Mannus) into Vercel, using these checked-in settings:

- Framework: **Vite**
- Root directory: `.`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build:vercel`
- Output directory: `dist/public`

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for the API, media, authentication and post-deployment checks. This repository preparation does **not** deploy a Vercel project.

## Media and content updates

No MP4 or PDF binaries are committed. The manifests point to stable `/manus-storage/` paths. In a public Vercel deployment, GET/HEAD media requests redirect to `https://boardstudio-svjffwzx.manus.space` by default, or to the operator-set `BOARD_STUDIO_PUBLIC_ASSET_ORIGIN`. The redirect preserves no caller query string, authorization header, or credential. Caption tracks and native media still require the final media origin to permit browser playback and CORS as applicable; verify playback after deployment.

The snapshot does **not** update automatically when the original project changes. Refresh only through a reviewed, lawful new snapshot; do not copy Manus credentials, database rows, internal production state, PDFs, or media files into this public repository.

## Auth, database, and rights

Auth/database sync is optional and requires your own lawful configuration. Never share or reuse Manus credentials. Copy [.env.example](./.env.example) only as a blank guide; guest study needs none of those values. Third-party resources remain owned/licensed by their respective rightsholders and are not relicensed by this repository. Links and availability do not grant a right to rehost protected content.

Public-export design notes are in [plan.md](./plan.md).
