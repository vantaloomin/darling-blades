<!-- source-of-truth: package.json, eslint.config.js, .github/workflows/deploy.yml · last-verified: 2026-07-23 · process doc — re-verify when the workflow itself changes -->

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
5. **Requirements** — lead with the *outcome*: name the behavior you want
   changed, not a keystroke-by-keystroke recipe; the agent picks the *how*
   within the constraints above. Mark design latitude explicitly ("design is
   yours, but…") and state hard caps as hard caps.
6. **Verification commands the agent must run itself**, including what NOT
   to run (e.g. heavy AI suites while another agent hogs CPU).
7. **"Your final message is a report"**: files changed, decisions, measured
   results with the actual numbers, what remains unverified. Honesty rules:
   never claim an unmeasured number; a documented failure or a justified
   no-change conclusion is a valid outcome.

**Codex handoffs (`/codex:rescue`) obey the same contract, sharpened by
OpenAI's own prompting guidance for Codex**
([learn.chatgpt.com/docs/prompting](https://learn.chatgpt.com/docs/prompting)) —
the executor half of the [[orchestration-workflow]] split:

- **Lead with the desired behavior, not the steps.** State the result you
  want and let Codex choose the approach inside the constraints (§5) — don't
  pre-write the diff in prose.
- **Point at the code, not just the concept** — name the files/functions, and
  for a bug give numbered repro steps with *expected vs. actual* behavior.
- **Preserve the constraints that matter** — call out the 1–2 boundaries that
  count (API shape, an invariant, "keep the fix minimal"), not every
  micro-rule; over-fencing is as costly as under-fencing.
- **Any prompt that authors player-facing text quotes the copy rules** from
  design-system.md §Content voice — above all: **no em-dashes in
  player-facing copy** (use period / semicolon / colon / comma / parentheses;
  `·` in stat lines). Codex and Claude both default to em-dash-heavy prose;
  the rule must be in the contract, not assumed.
- **Say how the change gets verified** and have Codex run those checks itself
  (the ladder rungs in §8 that apply), then report the real numbers.
- **Plan before editing on risky or large tasks** — ask for the approach
  first (Codex `/plan`), review it, then let it patch.
- **Refine by steering, not re-specifying** — the next message adjusts the
  live result ("keep the tests, move the guard up") rather than restating the
  whole contract.
- **Launch anything longer than ~8 minutes detached** (`task --background`),
  and monitor for the dead-pid zombie state — see the Codex timeout trap in
  §11 for the full recipe and recovery drill.

**Codex stream dashboard (standard setup for every session running Codex
tasks).** `npm run codex-dash` serves `http://localhost:5179/` (the
`codex-dash` launch.json entry opens it in the preview pane): a live board of
every Codex job across every workspace/worktree, read directly from the
runtime's per-workspace state
(`~/.claude/plugins/data/codex-inline/state/<ws>-<hash>/` — registry
`state.json` + `jobs/*.log`; the registry is per-workspace-root, which is why
`status` run from the wrong cwd shows an empty list). The board shows
status/phase/model/log-tail per stream, flags a 15-minutes-silent running task
as a possible wedge, and a narrator loop turns every meaningful transition
(discovery, status change, stall) into a timestamped plain-language feed entry
by calling headless Claude (`claude -p … --model claude-sonnet-5`); set
`CODEX_DASH_NO_AI=1` to fall back to mechanical feed lines, and
`CODEX_DASH_PORT`/`CODEX_DASH_STATE_ROOT`/`CODEX_DASH_MODEL` to override
defaults. Read-only over Codex state; its cache lives in
`scripts/codex-dash/.cache/` (gitignored). Standing practice: start it at the
top of any session that launches Codex work and point the user at it instead
of ad-hoc status relays.

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
  `t += 16.7` per frame — and keep ONE persistent monotonic clock
  (`window.__t += 16.7` per step) across every call. Mixing a setInterval
  pump with per-call `performance.now()` bases feeds the loop a
  non-monotonic time and stalls tweens indefinitely (measured 2026-07-13).
  Phaser's TimeStep delta-smoothing also caps effective advance around
  ~6ms/step, so budget ~3× the frames you'd expect for a tween to finish.
- Synthetic keyboard events need `keyCode` defined by hand — Phaser's
  KeyboardPlugin keys off `event.keyCode`, which the KeyboardEvent
  constructor ignores: `const e = new KeyboardEvent('keydown', { key:
  'ArrowRight', code: 'ArrowRight' }); Object.defineProperty(e, 'keyCode',
  { get: () => 39 }); window.dispatchEvent(e);` — and dispatch a matching
  keyup, or the next keydown is treated as a repeat.
- Interact by emitting events on objects (`obj.emit('pointerup')`), not by
  synthetic mouse coordinates.
- Verify via state, not pixels: scene keys, texture sizes/keys, children
  counts, localStorage blobs, exposed debug counters (`Sfx.playCount`).
- **Never leave the user's save mutated.** Snapshot/restore around tests;
  don't Save flows that persist test state; reload when done. Keep the
  snapshot OUTSIDE the page (shell variable or scratchpad file) — `window`
  vars die on reload — and remember the pagehide save-flush rewrites
  localStorage during navigation. A later-registered `pagehide` listener does
  NOT reliably win that write race (measured 2026-07-12: the game's flush won
  in two consecutive trials). What works: write the restored blob, then stub
  `Storage.prototype.setItem` on the OLD page to drop writes to the save key,
  then reload — the new page gets a fresh prototype, so saving resumes.
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
- End of each session: `git status` (catch a stray uncommitted draft before
  it's forgotten — commit it, stash it, or flag it explicitly for next time)
  and, if a PR was merged this session, delete the local branch yourself
  (see git-workflow.md's Merging section — `--delete-branch` doesn't always
  clean up the local copy).

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
- **Codex "silent deaths" can be tool-timeout murder, not model crashes**
  (root-caused 2026-07-13): running `codex-companion.mjs task` ATTACHED —
  which the `/codex:rescue` forwarder does when its single call doesn't
  return fast — gets the node process killed at the 10-minute Bash tool
  timeout, mid-run, leaving a zombie "running" registry entry with a dead
  pid. Launch long tasks DETACHED instead:
  `node <plugin>/codex-companion.mjs task --background --write --fresh
  --model <m> --effort <e> "$(cat prompt.txt)"` from the repo root (the
  CLI spawns detached+unref, immune to tool timeouts). Diagnose deaths via
  `status --json` pid + tasklist and log-file mtime (>10 min silent =
  dead); a `--resume` of a dead thread fails in ~5 s — relaunch fresh,
  folding the dead run's exploration conclusions into the new prompt.
  Salvage check first: `git status` — a run killed pre-edit needs no
  recovery. Watchdog caveat: a dead-pid signal RACES the registry's
  completion write — on pid-gone, wait ~8 s and re-check `status` before
  declaring death (a job that finished normally briefly shows
  running+dead-pid; measured false alarm 2026-07-13).
- **The Bash tool's 10-minute timeout kills BACKGROUND tasks too** — a
  `run_in_background` command over ~10 min dies mid-run exactly like a
  foreground one (a 30-min sim run was killed this way 2026-07-15). Long
  jobs launch fully detached (`nohup bash -c '…; echo $? > done.marker' &
  disown`) with a marker file, watched via Monitor. Corollary: never trust
  `cmd | tail` inside a `&&` chain as a gate — the pipe's exit status masks
  the command's failure (a red lint reached a public PR this way); gate on
  explicit exit codes (`cmd; RC=$?`).
- **Concurrent codex-companion `task --background` launches race the
  registry** (measured 2026-07-15: two launches ~16 s apart; the second
  task's registry entry was clobbered — last-writer-wins state.json). The
  task still runs and logs fine; only `status`/`result` go blind. Monitor
  concurrent tasks via their per-job LOG files (terminal marker line
  "Final output"; salvage the report with `awk '/Final output/{f=1} f'`),
  and stagger launches by a minute-plus when you can.
- **The Browser pane can't open `file://` URLs or authed claude.ai pages**
  (private Artifacts 404 without the user's session). Render-check local
  HTML by serving it from a throwaway localhost server (never :5173) and
  navigating to that.
- **Phaser `Text.updateText` silently resets a Text's hit area to its glyph
  bounds on ANY `setText`/`setColor`** — inflated/custom hit areas on Text
  objects must be set via `setInteractive` with a hit area Phaser marks as
  `customHitArea` (see `inflateHitArea` in `src/platform/gestures.ts`), and
  Texts whose content changes must re-inflate after updates.
