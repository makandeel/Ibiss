#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <github_repo_url> [base_branch] [feature_branch]"
  echo "Example: $0 https://github.com/USERNAME/REPO.git main work"
  exit 1
fi

REPO_URL="$1"
BASE_BRANCH="${2:-main}"
FEATURE_BRANCH="${3:-work}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: this script must be run inside a git repository."
  exit 1
fi

# 1) Clean interrupted git operations that block pull/checkout.
(git merge --abort >/dev/null 2>&1 || true)
(git rebase --abort >/dev/null 2>&1 || true)
(git cherry-pick --abort >/dev/null 2>&1 || true)
(git am --abort >/dev/null 2>&1 || true)

git reset --hard >/dev/null 2>&1 || true

# 2) Ensure origin points to the requested repo.
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

# 3) Fetch everything.
echo "Fetching latest refs from origin..."
git fetch --all --prune

# 4) If work does not exist remotely, auto-pick newest origin/codex/* branch.
if ! git show-ref --verify --quiet "refs/remotes/origin/$FEATURE_BRANCH"; then
  latest_codex_branch="$(git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/remotes/origin/codex/ | head -n 1 || true)"
  if [[ -n "$latest_codex_branch" ]]; then
    FEATURE_BRANCH="${latest_codex_branch#origin/}"
    echo "Info: origin/work not found; using newest feature branch: $FEATURE_BRANCH"
  else
    echo "Error: origin/$FEATURE_BRANCH not found and no origin/codex/* branches found."
    echo "Available remote branches:"
    git branch -r
    exit 1
  fi
fi

# 5) Checkout local feature branch tracking selected remote feature.
if git show-ref --verify --quiet "refs/heads/$FEATURE_BRANCH"; then
  git checkout "$FEATURE_BRANCH"
else
  git checkout -b "$FEATURE_BRANCH" "origin/$FEATURE_BRANCH"
fi

# 6) Make feature branch mergeable with main.
if ! git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH"; then
  echo "Error: origin/$BASE_BRANCH not found."
  echo "Available remote branches:"
  git branch -r
  exit 1
fi

echo "Merging origin/$BASE_BRANCH into $FEATURE_BRANCH using -X ours..."
git merge "origin/$BASE_BRANCH" -X ours --no-edit || {
  echo "Auto-merge did not complete. Please resolve conflicts manually."
  exit 1
}

echo "Pushing $FEATURE_BRANCH..."
git push -u origin "$FEATURE_BRANCH"

echo "Done. Open PR ($FEATURE_BRANCH -> $BASE_BRANCH) and press Merge."
