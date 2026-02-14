# Ibiss

Vite + React dashboard project, configured for deployment on **Vercel**.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy on Vercel

This repository uses `vercel.json` with:
- Build command: `npm run build`
- Output directory: `dist`
- SPA rewrite: all routes -> `index.html`

## Why GitHub looked "empty"

Your recent work was committed on local branch `work`, while GitHub UI is showing branch `main`.
So on GitHub you only saw old files (`README.md` + zip), not the new app files.

## Fix it in one command (recommended)

```bash
./scripts/sync-main-with-work.sh https://github.com/USERNAME/REPO.git
```

What this does automatically:
1. Configures `origin`.
2. Pushes `work` branch.
3. Makes `main` match `work`.
4. Pushes `main` so GitHub shows the full project immediately.

## Alternative: push only work

```bash
./scripts/publish-to-github.sh https://github.com/USERNAME/REPO.git work
```

Then on GitHub choose branch `work` from the branch dropdown.
