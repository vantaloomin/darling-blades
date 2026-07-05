<!-- source-of-truth: package.json, eslint.config.js, .github/workflows/deploy.yml · last-verified: 2026-07-05 · process doc — re-verify when the workflow itself changes -->

# Claude Orchestration Playbook

How to "think through" an implementation session on this repo the way the
Fable 5 sessions that built it did. Written so any model (Opus 4.8 included)
can follow the same loop mechanically. The loop is:

> **orient → baseline → decompose → delegate → review → verify →
> adversarially re-review → measure honestly → sync docs & memory**

None of these steps are optional, and the order matters: every expensive
mistake this project has avoided was caught by a step that would have been
tempting to skip.

## 1. Orient before acting

- Read, in order: the session memory files (`MEMORY.md` index →
  `darlingblades-progress`, `darlingblades-design-decisions`), then
  [roadmap.md](roadmap.md), then whichever doc owns the area you're touching
  ([architecture.md](architecture.md), [rules.md](rules.md),
  [adding-cards.md](adding-cards.md), [ai.md](ai.md),
  [art-pipeline.md](art-pipeline.md)).
- **The docs are the spec.** "What's next" means the roadmap's Planned
  section, not your own invention. Cite the doc; don't work from recall.
- **Locked design decisions are never relitigated** (MTG-style ruleset,
  simplified LIFO stack, WUBRG + faction tribes, 60/4/20, rarity + booster
  economics, procedural placeholder art, pure headless engine). If a task
  seems to require changing one, stop and surface it instead.

## 2. Establish the baseline

Before any edit: `npx tsc --noEmit` and `npm run lint` (seconds), and — if
the tree wasn't verified green this session — `npx vitest run` (~20–25s, the
win-rate suite is no longer long-running). Never start work from an unknown
state; if the baseline is red, fixing or reporting that comes first.

## 3. Decompose into agent-sized workstreams

- **The repo is under git now, but parallel agents still must not edit the
  same file concurrently** — a mid-flight collision between two live agents is
  confusing to untangle even with version control, and the main session (not
  the sub-agents) owns commits. Decomposition therefore stays by *file set*,
  not by topic: every agent gets an explicit allowed-file list and an explicit
  do-not-touch list naming what the *other* concurrent agents own.
- The full branch / commit / PR / merge flow — and the rule that **`main`
  auto-deploys to GitHub Pages on every green push** — lives in
  [git-workflow.md](git-workflow.md); the short version: the main session owns
  git, branch non-trivial work, keep `main` green.
- Workstreams that share a file go in different waves. Launch a blocked
  workstream *early* the moment its file conflicts finish — don't wait for
  the whole wave.
- Each workstream must end runnable/testable on its own (its own
  verification commands pass), never "done pending someone else's part".
- Track waves with the task tools (TaskCreate/TaskUpdate, blockedBy edges);
  mark tasks complete only after the main session has reviewed the landing.

## 4. Write agent prompts like contracts

Every delegated prompt contains, in this order:

1. **Framing**: what repo, what stack, "the main session owns git — don't run
   git commands (commit/branch/reset) yourself", what other agents are
   concurrently editing (by file area).
2. **Allowed files** (NEW vs EDIT) and forbidden files. "If you conclude a
   forbidden file must change, STOP and report why instead of editing it."
3. **READ FIRST list**: the docs and source files that define the area.
   Agents that skip orientation ship plausible-but-wrong code.
4. **Iron invariants** (see §5) that apply to this task, stated in the
   prompt — never assumed.
5. **Requirements** — concrete, with design latitude marked explicitly
   ("design is yours, but…") and hard caps stated as hard caps.
6. **Verification commands the agent must run itself**, including what NOT
   to run (e.g. heavy AI suites while another agent hogs CPU).
7. **"Your final message is a report"**: files changed, decisions, measured
   results with the actual numbers, what remains unverified. Honesty rules:
   never claim an unmeasured number; a documented failure or a justified
   no-change conclusion is a valid outcome.

## 5. Iron invariants (quote these into prompts)

- **Purity**: `src/engine`, `src/ai`, `src/data`, `src/meta`, `src/config`
  never import Phaser or browser APIs; tests never import Phaser (ESLint
  enforces, but agents must know *why*: headless engine + determinism).
- **AI honesty**: AI code consumes only the redacted `PlayerView`
  (`src/engine/view.ts`). Never hidden state, at any difficulty.
- **Determinism**: engine + AI are seeded — same inputs, same game. UI may
  use `Date.now`/`Math.random`; the layers below may not.
- **Save compatibility**: storage key `darlingblades.save.v1` is a slot name,
  not a schema version (the legacy `waifutcg.save.v1` key is still read once for
  save migration — see `src/meta/SaveManager.ts`). Schema changes bump
  `SaveData.version` with a real `migrate()` + a migration test; old blobs must
  keep loading.
- **Gates only ratchet up**: test floors (win rates, balance bands) may be
  raised with fresh measurements, never lowered to make a change pass.

## 6. The think-through checklist (before any nontrivial step)

Ask, in writing if the step is risky:

1. **What does the spec say?** Find the doc/constant and cite it. If docs
   and code disagree, that's a finding to fix, not an ambiguity to guess at.
2. **Which invariant is nearest to this change?** (§5). Name it; state why
   the change respects it.
3. **What's the cheapest measurement that would falsify my assumption?**
   Run that *first* (a 40-seed matrix before a 200-seed suite; a `--dry-run`
   before a batch; a hit-test probe before a UI rewrite).
4. **Does the evidence support this specific action** — or does it merely
   pattern-match a known failure? (A signal that looks like a known bug can
   have a different cause.)
5. **What upstream change invalidates cached numbers?** Any AI/deck change
   stales the balance baseline; any schema change stales migration tests;
   any doc claim stales `check-docs`. Re-measure downstream, always.

Prefer **instrument-then-hypothesize over guess-then-tune**: the Hard-AI
win came from shadow-instrumentation (count where the new brain's choices
diverge from a reference and correlate with outcomes), after which five
plausible "obvious improvements" were measured as losses and rejected.
**Document negative results** where the next person will look (module
comments, e.g. `src/ai/determinize.ts`) — they are as load-bearing as the
code.

## 7. Review everything that lands, then attack it

- The main session spot-reads each agent's key files on landing (not the
  whole diff — the load-bearing parts: new modules, invariant-adjacent
  edits, test assertions).
- After a wave, run an **adversarial review**: independent reviewers per
  dimension (one per workstream + one for cross-cutting seams — the seams
  are where nobody owns the whole), each finding then attacked by ~3
  independent refuters told to *disprove* it, majority verdict.
- Treat "plausible" as unproven in both directions: real-looking findings
  get refuted, and boring-looking code hides majors. The payoff here: a
  review of "finished, all-green" work found a hard-freeze bug and a
  silently dead search feature worth +15 win-rate points.
- Fix confirmed findings promptly, then re-run the full ladder (§8) —
  fixes are changes and get no special trust.

## 8. Verification ladder

Run in this order; each rung is cheaper than debugging the next one:

1. `npx tsc --noEmit`
2. `npm run lint`
3. Targeted vitest (`npx vitest run tests/<area>`)
4. Full suite: `npx vitest run`
5. `npm run build`
6. Doc checkers: `npm run check-docs`, `npm run check-art-bible`,
   `npm run gen-docs-tables -- --check`
7. Runtime probes in the preview browser (below)
8. Balance re-measure when AI/decks moved:
   `npx tsx scripts/balance-matrix.ts --avatars --seeds 40`

Rungs 1–6 also run in CI on every push and PR to `main`
(`.github/workflows/deploy.yml`), and a green push to `main` deploys the web
build to GitHub Pages — so a red rung fails a public run and blocks the live
deploy, not just your local loop. Branch/PR flow: [git-workflow.md](git-workflow.md).

**Preview-probe recipe** (the tab is hidden: RAF stalls, canvas may be 0×0,
WebGL never appears in screenshots):

- Drive the loop manually: `window.__game.loop.step(t)` in a loop with
  `t += 16.7` per frame.
- Interact by emitting events on objects (`obj.emit('pointerup')`), not by
  synthetic mouse coordinates.
- Verify via state, not pixels: scene keys, texture sizes/keys, children
  counts, localStorage blobs, exposed debug counters (`Sfx.playCount`).
- **Never leave the user's save mutated.** Snapshot/restore around tests;
  don't Save flows that persist test state; reload when done. Keep the
  snapshot OUTSIDE the page (shell variable or scratchpad file) — `window`
  vars die on reload — and remember the pagehide save-flush rewrites
  localStorage during navigation: to make an edited/restored blob survive a
  reload, set it from your own `pagehide` listener (registered after the
  game's, so it wins the write race).
- What genuinely needs eyes/ears (holo FX, SFX taste, art quality) gets
  *flagged for the human*, explicitly, in the final report — not silently
  skipped, not fake-verified.

**On-device mobile probe:** `npm run play:lan` regenerates the half-res
mobile art (`npm run gen-art-halfres`, also runnable standalone — it derives
`public/assets/art/cards-half/` for the `lite` tier), then builds if stale
and serves `dist/` over LAN with a `qrcode-terminal` QR join code. Scene/menu
art (stage backdrops, card-back/pack art) is generated by
`npm run gen-scene-art`.

## 9. Measure honestly

- State the sample (`40 seeds/cell`, `200-seed suite`) with every number.
- Floors leave CI margin below the measured rate (±3.5pp at 200 games).
- Date-stamp baselines next to the data they describe
  (`src/data/opponents.ts` balance table) and refresh them after *any*
  upstream change, noting what moved and why.
- If a target is missed after genuine iteration, ship the honest number,
  the honest floor, and a comment saying what the remaining gap needs.

## 10. Docs and memory are part of "done"

- Every doc carries an anti-rot header
  (`<!-- source-of-truth: <files> · last-verified: YYYY-MM-DD -->`);
  update `last-verified` only after actually re-verifying claims against
  the code.
- End of each iteration: roadmap Planned→shipped moves, README/doc
  touch-ups, doc checkers green with **zero warnings**, session memory
  files updated (what shipped, key numbers, new gotchas).

## 11. Known traps registry

- **Phaser stays pinned to 3.x** — v4 is npm `latest` with a different FX
  API.
- **Never `setInteractive` a scaled `Container`** — Phaser doesn't scale
  container hit areas. Use `CardView.enableInput()` (child Zone) or plain
  `Image`s.
- **Scene-plugin-level input listeners** (`this.input.on('wheel', …)`)
  **bypass ModalGuard** — guard inside the handler.
- **Timers on destroyed objects kill the game loop**: any
  `delayedCall`/tween callback touching a GameObject that a re-render may
  destroy must check `.active` first.
- **AI brains used inside determinized sims must be built with
  `simDb(db)`** — a raw-db brain throws on `__unknown_*` stand-ins and the
  catch silently poisons the search (`-Infinity` worlds).
- **PowerShell eats `--` and comma args through `npm run`** — call
  `npx tsx scripts/<x>.ts …` directly (or use Git Bash).
- **TypeScript 6** needs `"types": ["node", "vite/client"]` in tsconfig.
- **Text glyph widths are font-fallback-dependent on Windows** (e.g.
  `▰▱`) — measure rendered `Text.width`; never hardcode layout after a
  glyph run.
- **DuelScene restarts between gauntlet rungs** — anything subscribed in
  `create()` must not stack across restarts.
- **`DynamicTexture` bakes clip overhangs** — Containers don't clip but
  textures do; bleed the bake (see `CardThumbCache.ts`).
- **The chatgpt-imagegen CLI's OAuth refresh is not concurrency-safe** —
  never run concurrent generation lanes across a token refresh; serialize
  (measured 2026-07-02: 4 parallel lanes raced the refresh at expiry and
  killed the credential).
- **Phaser `Text.updateText` silently resets a Text's hit area to its glyph
  bounds on ANY `setText`/`setColor`** — inflated/custom hit areas on Text
  objects must be set via `setInteractive` with a hit area Phaser marks as
  `customHitArea` (see `inflateHitArea` in `src/platform/gestures.ts`), and
  Texts whose content changes must re-inflate after updates.
