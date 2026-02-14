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

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

echo "Fetching latest branches from origin..."
git fetch origin "$BASE_BRANCH" "$FEATURE_BRANCH" || git fetch origin

# Ensure local feature branch exists
if git show-ref --verify --quiet "refs/heads/$FEATURE_BRANCH"; then
  git checkout "$FEATURE_BRANCH"
else
  git checkout -b "$FEATURE_BRANCH" "origin/$FEATURE_BRANCH"
fi

# Ensure local base branch exists for merge reference
if ! git show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH"; then
  echo "Error: origin/$BASE_BRANCH not found."
  exit 1
fi

echo "Merging origin/$BASE_BRANCH into $FEATURE_BRANCH with '-X ours'..."
echo "(Conflicting hunks will keep $FEATURE_BRANCH code to make PR mergeable.)"
git merge "origin/$BASE_BRANCH" -X ours --no-edit || {
  echo "Auto-merge could not finish. Resolve conflicts manually, then run:"
  echo "  git add ."
  echo "  git commit"
  echo "  git push origin $FEATURE_BRANCH"
  exit 1
}

echo "Pushing updated $FEATURE_BRANCH..."
git push -u origin "$FEATURE_BRANCH"

echo "Done: PR from $FEATURE_BRANCH to $BASE_BRANCH should now be mergeable."
