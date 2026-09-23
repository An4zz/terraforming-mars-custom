#!/usr/bin/env bash
# Merges the latest upstream terraforming-mars `main` into the current branch.
#
# Usage: scripts/sync-upstream.sh [upstream-branch]
#
# Conflicts are expected only in the hook files listed in docs/custom/README.md.
set -euo pipefail

UPSTREAM_URL="https://github.com/terraforming-mars/terraforming-mars.git"
UPSTREAM_BRANCH="${1:-main}"

if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "Adding upstream remote ${UPSTREAM_URL}"
  git remote add upstream "${UPSTREAM_URL}"
fi

git fetch upstream "${UPSTREAM_BRANCH}"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Merging upstream/${UPSTREAM_BRANCH} into ${CURRENT_BRANCH}"

if git merge --no-edit "upstream/${UPSTREAM_BRANCH}"; then
  echo "Merged cleanly. Run: npm ci && npm run lint && npm run build && npm test"
else
  echo
  echo "Merge has conflicts in:"
  git diff --name-only --diff-filter=U
  echo
  echo "Resolve them (see docs/custom/README.md for the hook files), then: git add -A && git commit"
  exit 1
fi
