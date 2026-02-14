#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <github_repo_url>"
  echo "Example: $0 https://github.com/USERNAME/REPO.git"
  exit 1
fi

REPO_URL="$1"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: this script must be run inside a git repository."
  exit 1
fi

# Ensure origin exists and points to the requested repo
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

# Push current local work branch first
if [[ "$(git branch --show-current)" != "work" ]]; then
  git checkout work
fi

echo "Pushing work branch..."
git push -u origin work

# Make local main match work, then push main
echo "Syncing main with work..."
if git show-ref --verify --quiet refs/heads/main; then
  git checkout main
else
  git checkout -b main
fi

git reset --hard work

echo "Pushing main branch..."
git push -u origin main --force-with-lease

echo "Done: main now matches work on GitHub."
