#!/usr/bin/env bash
#
# Give a second AI tool its own folder and its own branch, so two agents
# can never edit the same files at the same time.
#
#   npm run worktree -- admin-dashboard
#
# Creates ../Loane-code-admin-dashboard as a separate working folder on a
# branch of that name, sharing the same git history. Point the other tool
# at that folder and the two cannot collide.

set -euo pipefail

BRANCH="${1:-}"
if [ -z "$BRANCH" ]; then
  echo "Usage: npm run worktree -- <branch-name>"
  echo "Example: npm run worktree -- listings"
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
TARGET="$(dirname "$REPO_ROOT")/${REPO_NAME}-${BRANCH}"

if [ -e "$TARGET" ]; then
  echo "A folder already exists at:"
  echo "  $TARGET"
  echo "Open that one, or pick a different branch name."
  exit 1
fi

# Branch off whatever main currently is, so the new folder starts from
# known-good code rather than from someone's half-finished work.
git fetch origin main --quiet 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "Reusing the existing branch '${BRANCH}'."
  git worktree add "$TARGET" "$BRANCH"
else
  echo "Creating branch '${BRANCH}' from main."
  git worktree add -b "$BRANCH" "$TARGET" main
fi

echo ""
echo "Done. A separate folder is ready:"
echo "  $TARGET"
echo ""
echo "Next:"
echo "  1. cd \"$TARGET\""
echo "  2. npm install          (each folder needs its own node_modules)"
echo "  3. Open THAT folder in the other AI tool"
echo ""
echo "When the work is merged, clean it up with:"
echo "  npm run worktree:remove -- ${BRANCH}"
