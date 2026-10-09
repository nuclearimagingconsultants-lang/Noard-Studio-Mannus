# Board Studio public snapshot portability notes

This repository is a **separate public export** of Board Studio source and its
compact curriculum/media manifests. It is not connected to the original Manus
project, its canonical repository, its database, or its deployment. The source
checkpoint supplied for this snapshot is `409d75cc370c4e9bf8699716f151f18f0c46b56b`.

## What is included

- React/Vite client and Express/tRPC API source.
- Compact directory data for **384 course workspaces** (including **333 medical
  programme/variant records**), plus curriculum and public media manifests.
- Public stable `/manus-storage/` references rather than MP4/PDF binaries.
- Existing guest local progress and notes; these work without an environment or
  database.

## What is intentionally not included

- The original project, Git history, hosting, credentials, database rows,
  learner progress/notes, internal research/audit logs, rendered media, PDFs,
  production scratch files, and release evidence.
- The former `production-state/` and `release-checks/` directories. Their
  producer code depends on private source/review state, local tooling, and/or
  credentials and is not suitable for this Vercel guest deployment. It has not
  been copied into `tools/`.

## Portability contract

`pnpm build:vercel` creates the Vite CDN output and commits a bundled
`api/index.mjs` Express function. It includes `data/**` in the function so the
server can reconstruct the compact catalogue. The public function provides
read-only API routes, a fixed-origin redirect for trusted manifest assets, and
a bounded transcript fallback. It does not start Vite, listen on a port, proxy
arbitrary URLs, accept media uploads, or expose a public content writer.

See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for the exact import setup.
See [STUDIO_GUIDE.md](./STUDIO_GUIDE.md) and [TODO.md](./TODO.md) for the
truthful availability, medical-review, credential, and unfinished-work limits.
