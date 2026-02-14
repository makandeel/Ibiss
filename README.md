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


## If Pull Request says "Branch has merge conflicts"

If GitHub shows **"Pull Request is not mergeable"**, run this helper from your project folder:

```bash
./scripts/fix-pr-merge-conflicts.sh https://github.com/USERNAME/REPO.git main work
```

What it does:
1. Fetches latest `main` and `work` from GitHub.
2. Checks out local `work`.
3. Merges `origin/main` into `work` with strategy `-X ours` (keeps your `work` version on conflicting lines).
4. Pushes updated `work` so the PR can be merged from GitHub UI.

### Mobile quick steps (Termux)

Run each command one-by-one:

```bash
cd ~/Ibiss
git checkout work
git pull origin work
ls scripts
chmod +x scripts/fix-pr-merge-conflicts.sh
./scripts/fix-pr-merge-conflicts.sh https://github.com/USERNAME/REPO.git main work
```

Then open the PR and press **Merge**.

### If `fix-pr-merge-conflicts.sh` is missing

If `ls scripts` shows only `publish-to-github.sh` and `sync-main-with-work.sh`, that means your phone still has an older branch state.

Run:

```bash
cd ~/Ibiss
git fetch origin
git checkout work
git pull origin work
ls scripts
```

After that you should see `fix-pr-merge-conflicts.sh` and you can continue with the merge-fix command above.
