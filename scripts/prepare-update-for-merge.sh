#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <github_repo_url>"
  echo "Example: $0 https://github.com/USERNAME/REPO.git"
  exit 1
fi

REPO_URL="$1"
BASE_BRANCH="main"
TARGET_BRANCH="work"

# Keep things simple for non-technical users:
# - clean any interrupted git state
# - update branch
# - merge latest main into it (so PR is mergeable)
# - push and stop (user merges on GitHub UI)

git merge --abort >/dev/null 2>&1 || true
git rebase --abort >/dev/null 2>&1 || true
git cherry-pick --abort >/dev/null 2>&1 || true
git am --abort >/dev/null 2>&1 || true

git reset --hard >/dev/null 2>&1 || true

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

echo "Fetching latest changes..."
git fetch --all --prune

if git show-ref --verify --quiet "refs/remotes/origin/$TARGET_BRANCH"; then
  git checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"
else
  latest_codex_branch="$(git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/remotes/origin/codex/ | head -n 1 || true)"
  if [[ -z "$latest_codex_branch" ]]; then
    echo "Error: neither origin/$TARGET_BRANCH nor any origin/codex/* branch was found."
    exit 1
  fi
  TARGET_BRANCH="${latest_codex_branch#origin/}"
  git checkout -B "$TARGET_BRANCH" "origin/$TARGET_BRANCH"
fi

if ! git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH"; then
  echo "Error: origin/$BASE_BRANCH not found."
  exit 1
fi

echo "Updating branch with latest origin/$BASE_BRANCH..."
git merge "origin/$BASE_BRANCH" -X ours --no-edit || {
  echo "Merge needs manual resolution."
  exit 1
}

echo "Pushing ready-to-merge branch: $TARGET_BRANCH"
git push -u origin "$TARGET_BRANCH"

echo "Done. Now open GitHub and press Merge on the PR."
