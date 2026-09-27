#!/usr/bin/env bash
#
# Remove a worktree folder once its branch has been merged.
#
#   npm run worktree:remove -- admin-dashboard
#
# This deletes the extra FOLDER, not the branch. Your commits are safe.

set -euo pipefail

BRANCH="${1:-}"
if [ -z "$BRANCH" ]; then
  echo "Usage: npm run worktree:remove -- <branch-name>"
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
TARGET="$(dirname "$REPO_ROOT")/${REPO_NAME}-${BRANCH}"

if [ ! -e "$TARGET" ]; then
  echo "No folder at $TARGET — nothing to remove."
  exit 0
fi

git worktree remove "$TARGET"
echo "Removed $TARGET. The branch '${BRANCH}' and all its commits are untouched."
