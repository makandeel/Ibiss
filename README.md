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

## Simple update flow (mobile-friendly)

You said you only want one thing: **prepare the latest branch, then merge from GitHub UI**.

Run one command from the project folder:

```bash
./scripts/prepare-update-for-merge.sh https://github.com/USERNAME/REPO.git
```

What this single command does:
1. Cleans any stuck git state (merge/rebase conflicts left open).
2. Fetches latest branches.
3. Uses `work` branch if it exists, otherwise the newest `origin/codex/*` branch.
4. Merges latest `main` into that branch with safe conflict strategy.
5. Pushes the branch back to GitHub.

After that, go to GitHub and press **Merge** on the PR.


## Vercel warnings vs errors

If you see yellow lines like:
- `npm warn deprecated glob@...`
- `Some chunks are larger than 500 kB`

These are **warnings**, not build failures. Deployment still succeeds.

If the page looks unstyled (plain text/buttons), make sure Tailwind/PostCSS config files are committed:
- `tailwind.config.js`
- `postcss.config.js`
