<!-- source-of-truth: .github/workflows/deploy.yml, package.json · last-verified: 2026-07-05 · process doc — re-verify when the CI workflow or branch model changes -->

# Git workflow

The repo is public on GitHub — `vantaloomin/darling-blades` — and **`main`
auto-deploys**: every push to `main` runs CI (the full verification ladder) and,
if it passes, publishes the web build to GitHub Pages
(https://vantaloomin.github.io/darling-blades/). Treat `main` as production.

## Who runs git

The **main session owns every git operation** — branch, commit, merge, push, PR.
Parallel sub-agents never run git; they edit files under the file-set discipline
([claude-playbook.md](claude-playbook.md) §3) and hand results back for the main
session to land. Two agents committing (or editing one file) concurrently is how
working trees and history get corrupted — the file-set split plus a single git
owner is what prevents it. Git now exists to *recover* from mistakes; it is not
licence to parallelise commits.

## Branch for anything non-trivial

- Cut a short-lived, single-purpose branch off `main`:
  `git switch -c <type>/<slug>` — e.g. `feat/commander-mode`,
  `fix/collection-tap-band`, `ci/node-cache`, `docs/rules-resync`.
- `<type>` mirrors the commit prefixes below (`feat` / `fix` / `refactor` /
  `perf` / `ci` / `docs` / `test` / `chore`).
- If `main` moves under you, rebase rather than merge it back in:
  `git fetch origin && git rebase origin/main`.
- A genuinely trivial one-liner MAY go straight to `main` — but only after the
  local ladder is green. When in doubt, branch.

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

Full ladder + preview probes: [claude-playbook.md](claude-playbook.md) §8.
**Never push a red tree to `main`** — it fails the public CI run and blocks the
Pages deploy (the live site simply keeps its last good build).

## Pull requests

- For non-trivial or risky work, open a PR into `main` so CI vets it *before* it
  can deploy: `gh pr create --fill` (install once with
  `winget install --id GitHub.CLI`, then `gh auth login`), or via the GitHub web UI.
- `.github/workflows/deploy.yml` runs the `verify` job on every PR to `main`; the
  `deploy` job is `main`-push-only. **Merge only when `verify` is green.**
- Solo-project bar: green CI plus a real self-review of the diff. PRs earn their
  keep when you want CI to gate a change before it reaches the deploy branch, or a
  reviewable record — not ceremony for its own sake.

## Merging

- Keep history mostly linear. **Squash-merge** a feature branch into one tidy
  `main` commit, or fast-forward a small, already-clean branch. Avoid noisy merge
  commits.
- Delete the branch after merge (`git branch -d <name>`; let the PR delete the
  remote copy).
- The merge lands on `main`, so it deploys — the pre-merge green `verify` is the
  deploy gate.

## What a push to `main` does

`push → verify (tsc · lint · vitest · build · doc checks) → if green, deploy →
GitHub Pages`. A failed `verify` skips `deploy` (live site unchanged) but leaves a
red run — fix forward promptly. Pages was enabled once by hand
(Settings → Pages → Source: GitHub Actions) and stays on; the workflow token can
deploy to it but can't create it.

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
