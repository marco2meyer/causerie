#!/usr/bin/env bash
# Publish a snapshot of the development branch to the public repository.
#
# The public repo is this tree minus the private extensions listed in .publicexclude, kept
# as a squashed history on the local branch `public` (remote `public`, branch `main`
# there). This replaces the by-hand sequence — checkout public, `git checkout main -- .`,
# unstage the workflow file, commit, push, move the workflow aside, checkout main — and adds
# the two things hands forget: removing the private paths, and proving the result still
# type-checks, tests and builds without them before anything is committed.
#
#   scripts/publish-public.sh "<commit message>"
#
# Safe to abort at any point: it refuses a dirty tree, everything up to the commit happens
# in the index of the public branch, and an EXIT trap resets that branch and returns to the
# branch you started on. Idempotent: publishing twice with nothing new pushes nothing new.
#
# Knobs, all optional:
#   PUBLISH_DEV_BRANCH     what to snapshot                     (default: main)
#   PUBLISH_PUBLIC_BRANCH  the local branch holding snapshots   (default: public)
#   PUBLISH_PUBLIC_REMOTE  where it goes                        (default: public)
#   PUBLISH_WITH_CI=1      keep .github/workflows/ci.yml. Off by default because the GitHub
#                          token used here lacks the `workflow` scope and the push would be
#                          rejected; `gh auth refresh -h github.com -s workflow` fixes that.
#   PUBLISH_CHECK_ARGS     extra flags for check-public-bundle.mjs, e.g. --skip-tests
set -euo pipefail

msg="${1:-}"
if [ -z "$msg" ]; then
  echo "usage: scripts/publish-public.sh \"<commit message>\"" >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"

dev="${PUBLISH_DEV_BRANCH:-main}"
pub="${PUBLISH_PUBLIC_BRANCH:-public}"
remote="${PUBLISH_PUBLIC_REMOTE:-public}"
manifest=".publicexclude"
ci=".github/workflows/ci.yml"

die() { echo "✗ $*" >&2; exit 1; }

# ── preconditions ─────────────────────────────────────────────────────────────
[ -f "$manifest" ] || die "$manifest is missing"
[ -f scripts/check-public-bundle.mjs ] || die "scripts/check-public-bundle.mjs is missing"
git rev-parse --verify -q "refs/heads/$dev" >/dev/null || die "no local branch '$dev'"
git rev-parse --verify -q "refs/heads/$pub" >/dev/null || die "no local branch '$pub'"
git remote get-url "$remote" >/dev/null 2>&1 || die "no remote '$remote'"
if [ -n "$(git status --porcelain)" ]; then
  git status --short >&2
  die "working tree is not clean — commit or stash first"
fi

start="$(git rev-parse --abbrev-ref HEAD)"
[ "$start" != "HEAD" ] || die "detached HEAD; check out '$dev' first"

# ── always come back ──────────────────────────────────────────────────────────
# Whatever happens after the checkout below, the public branch is put back to its last
# commit (dropping any half-built snapshot) and the starting branch is checked out again.
# `git clean` without -x leaves ignored files (node_modules, dist, .env.local) alone.
back_home() {
  local rc=$?
  local now
  now="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  if [ "$now" != "$start" ]; then
    git reset -q --hard
    git clean -fdq
    git checkout -q "$start" || echo "✗ could not return to '$start'; you are on '$now'" >&2
  fi
  [ $rc -eq 0 ] || echo "✗ publish aborted (exit $rc); back on '$start', nothing pushed" >&2
}
trap back_home EXIT

# ── build the snapshot in the public branch's index ───────────────────────────
echo "· checking out '$pub'"
git checkout -q "$pub"

# Replace the whole tracked tree with the dev branch's, so files deleted on '$dev' since the
# last snapshot disappear too instead of lingering in the public repo.
git rm -r -q --cached . >/dev/null
git checkout -q "$dev" -- .
git clean -fdq

# Nothing gets committed until the tree WITHOUT the private paths proves itself. The check
# builds its own trimmed copy, so it runs now, while the full tree (and the private list of
# strings it greps for) is still on disk.
echo "· checking the public copy"
# shellcheck disable=SC2086
node scripts/check-public-bundle.mjs ${PUBLISH_CHECK_ARGS:-}

# Drop the private paths. `git rm --cached` takes the pathspec (globs included, quoted);
# the working tree copy goes with an unquoted shell glob.
shopt -s nullglob
while IFS= read -r line; do
  entry="${line%%#*}"
  entry="$(echo "$entry" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's#/*$##')"
  [ -n "$entry" ] || continue
  git rm -r -q --cached --ignore-unmatch -- "$entry" >/dev/null
  # shellcheck disable=SC2086  # the glob is the point
  rm -rf -- $entry
done < "$manifest"
shopt -u nullglob

if [ "${PUBLISH_WITH_CI:-0}" != "1" ]; then
  git rm -q --cached --ignore-unmatch -- "$ci" >/dev/null
  rm -f -- "$ci"
fi

# Untracked leftovers here would be files the manifest missed; there must be none.
if [ -n "$(git status --porcelain | grep -v '^[MADR] ' || true)" ]; then
  git status --short >&2
  die "unexpected untracked or unstaged files in the snapshot"
fi

if git diff --cached --quiet; then
  echo "· nothing new since the last snapshot; pushing the existing '$pub'"
else
  git commit -q -m "$msg"
  echo "· committed $(git rev-parse --short HEAD) on '$pub'"
fi

echo "· pushing '$pub' → $remote/main"
git push -q "$remote" "$pub:main"

git checkout -q "$start"
echo "✓ published; back on '$start'"
