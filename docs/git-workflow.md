<!-- source-of-truth: .github/workflows/deploy.yml, .github/workflows/release.yml, package.json · last-verified: 2026-08-04 · process doc — re-verify when the CI workflow or branch model changes -->

# Git workflow

The repo is public on GitHub — `vantaloomin/darling-blades` — and **`main`
auto-deploys**: every push to `main` runs CI (the full verification ladder) and,
if it passes, publishes the web build to GitHub Pages
(https://vantaloomin.github.io/darling-blades/). Treat `main` as production — and
it is **branch-protected**, so nothing reaches it by direct push; every change
lands through a PR whose `verify` check has passed.

## Who runs git

The **main session owns every git operation** — branch, commit, merge, push, PR.
Parallel sub-agents never run git; they edit files under the file-set discipline
([claude-playbook.md](claude-playbook.md) §3) and hand results back for the main
session to land. Two agents committing (or editing one file) concurrently is how
working trees and history get corrupted — the file-set split plus a single git
owner is what prevents it. Git now exists to *recover* from mistakes; it is not
licence to parallelise commits.

## Branch for everything

`main` is branch-protected with a required `verify` status check, so a direct
push is rejected outright (`git push origin main` →
`GH013: Required status check "verify" is expected`). **Every change — even a
one-line typo fix — starts on a branch and lands via PR.** There is no
straight-to-`main` path.

- Cut a short-lived, single-purpose branch off whichever base the work belongs
  to — `main`, or the active `release/**` train:
  `git switch -c <type>/<slug>` — e.g. `feat/commander-mode`,
  `fix/collection-tap-band`, `ci/node-cache`, `docs/rules-resync`.
- `<type>` mirrors the commit prefixes below (`feat` / `fix` / `refactor` /
  `perf` / `ci` / `docs` / `test` / `chore`).
- Whatever you branched from is what the PR must target. Confirm with
  `git merge-base --is-ancestor origin/<base> HEAD` before opening the PR.
- If the base moves under you, rebase rather than merge it back in:
  `git fetch origin && git rebase origin/<base>`.

## Commits

- **Conventional-commit subject:** `type(scope): imperative summary`, present
  tense, no trailing period, ~72 chars — e.g.
  `fix(collection): stop hero/shard overlay chips sharing a tap band`.
- One logical change per commit; don't fold a refactor into a behaviour change.
- The body explains *why* (not what), with the measured numbers where the change
  claims a result — the repo's honesty rule ([claude-playbook.md](claude-playbook.md) §9).
- AI-assisted commits keep the `Co-Authored-By:` trailer the harness appends.
- Never `git add -f` a gitignored/generated path (`dist/`, `art-manifest.json`,
  `public/assets/art/cards-half/`, `src-tauri/target/`, `*.log`).

## Run the ladder locally before you push

CI's `verify` job runs these exact gates; catch failures in ~30 s locally, not
minutes later on a public red run:

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npx vitest run`
4. `npm run build` (also regenerates `art-manifest.json`, which `tsc` and CI need)
5. `npm run check-docs` · `npm run check-art-bible` · `npx tsx scripts/gen-docs-tables.ts --check`

Full ladder + preview probes: [claude-playbook.md](claude-playbook.md) §8. A red
tree can't reach `main` anyway — `verify` fails on the PR and blocks the merge —
but catching it locally saves the slow public round-trip (the live site simply
keeps its last good build until a green squash lands).

## Pull requests

`main` is governed by the **"Simple Protect" ruleset** (blocked deletion, no
force-push, required status checks), so the PR is the practical way in. The
GitHub CLI is the standard tool (install once with
`winget install --id GitHub.cli`, then `gh auth login`; the web UI is the
fallback):

1. **`gh pr create --fill`** — open the PR into `main`, or into a `release/**`
   branch when the work belongs to a release train. **Check the base**: a branch
   cut from `release/x` must target `release/x`, or the PR diff will include
   every commit that release branch has over `main`.
2. **`gh pr checks <n> --watch`** — block until the required `verify` check goes
   green. `.github/workflows/deploy.yml` runs `verify` on pull requests to
   **`main` and `release/**`**; the `deploy` job is `main`-push-only, so nothing
   ships until a merge lands on `main`.
3. **`gh pr merge <n> --squash --delete-branch`** — merge once `verify` is green.

A draft PR cannot be merged. `gh pr ready <n>` first, or step 3 fails.

**Auto-merge is not enabled on this repo** — `gh pr merge --auto` fails with
`Auto merge is not allowed for this repository`, so you can't queue the merge
ahead of CI. Step 3 is a manual action you take *after* watching `verify` pass.

Solo-project bar: green CI plus a real self-review of the diff before you merge —
the PR is both the CI gate and the reviewable record.

## Merging

- **Squash-merge every PR** with `gh pr merge <n> --squash --delete-branch` —
  one tidy commit per landed change, keeping history linear and free of noisy
  merge commits. This is a *convention*, not something the platform enforces:
  the repo allows squash, merge, and rebase, and the ruleset only blocks
  deletion and force-pushes. Nothing stops a web-UI "Create a merge commit", so
  prefer the CLI, which does what this doc says.
- **Release branches are not protected at all.** The ruleset targets
  `~DEFAULT_BRANCH` only, so `release/**` has no required checks and no
  push restrictions — `verify` still runs on PRs into them, but nothing blocks
  a direct push or a red merge. Treat the discipline as self-imposed there.
  (History bears this out: PRs #126-#130 landed on `release/1.4` as merge
  commits rather than squashes.)
- `--delete-branch` removes the merged branch (remote, and the local copy when
  you're not sitting on it). Clean up a leftover local branch with
  `git branch -d <name>`.
- **`--delete-branch` only deletes the local copy if you're currently on some
  *other* branch than the merged one — if you'd switched away mid-session and
  come back, it can silently leave an orphaned local branch.** Right after any
  squash-merge, run `git branch -d <name>` yourself rather than trusting the
  flag; don't wait for a cleanup pass to accumulate. Periodically (or any time
  branches feel stale), run `git fetch --prune && git branch --merged <base>` to
  spot local branches already merged upstream (`<base>` being whatever the
  branch targeted — `main` or a `release/**`), and check `git log <branch>
  --oneline` against that base for branches that look ahead but were actually
  squash-merged (their content will already be on the base even though they show
  as unmerged) before force-deleting with `-D`.
- A squash onto `main` deploys — the pre-merge green `verify` is the deploy
  gate. A squash onto a `release/**` branch does **not** deploy; nothing ships
  until that release branch itself lands on `main`.

## What landing on `main` does

A squash-merge pushes to `main`, which fires the pipeline:
`push → verify (tsc · lint · vitest · build · doc checks) → if green, deploy →
GitHub Pages`. A failed `verify` skips `deploy` (live site unchanged) but leaves a
red run — fix forward promptly. Pages was enabled once by hand
(Settings → Pages → Source: GitHub Actions) and stays on; the workflow token can
deploy to it but can't create it.

## Desktop release tags

From 1.5.5 onward, pushing a `v*` tag runs the separate
`.github/workflows/release.yml` workflow. It builds the Windows NSIS installer
and creates or updates the matching GitHub Release with that installer
attached. The local `npm run app:build` command remains the manual path; this
tag workflow does not change the `main`-push Pages deployment.

## Invariants that intersect git

- **Save compatibility:** the same commit that changes the save schema bumps
  `SaveData.version` with a real `migrate()` + a migration test
  ([claude-playbook.md](claude-playbook.md) §5). Never land one without the other.
- **Gates only ratchet up:** never lower a test floor in a commit to make CI pass
  — raise it with fresh measured numbers, or fix the regression.
- **Docs & memory are part of "done":** the change that alters behaviour also
  updates the affected doc's `last-verified` and the session memory
  ([claude-playbook.md](claude-playbook.md) §10). This doc's own source of truth
  is `.github/workflows/deploy.yml` — re-verify it when the CI/branch model moves.
