# Darling Blades — Claude session guide

Single-player MTG-style (8th/9th/10th-edition feel) collectible card game.
Phaser 3 (pinned, never v4) + TypeScript + Vite + Vitest. **Under git** (`main`);
the main session owns commits — parallel sub-agents don't run git.

## Before doing anything

Read [docs/claude-playbook.md](docs/claude-playbook.md) — the orchestration
playbook: how to think through steps (orient → baseline → decompose →
delegate → review → adversarially verify → measure honestly → sync docs),
how to write agent prompts as contracts, the verification ladder, the
preview-probe recipe for the hidden-tab dev server, and the known-traps
registry. Sessions on this repo follow that loop.

"What's next" is defined by [docs/roadmap.md](docs/roadmap.md)'s Planned
section — the docs are the spec. Locked design decisions (documented in the
session memory and docs) are never relitigated.

## Requests are intent, not spec

The user's requests describe what they're reaching for, not a complete or
infallible spec (their words, 2026-07-13: "I am human and fallible — don't
take my requests as 100% complete as written"). On every request: infer the
adjacent changes it implies, and say so — fold the cheap, reversible ones in
directly (naming them in the delivery), and put the expensive or
taste-sensitive ones to the user as short suggest-or-confirm items rather
than deciding silently or ignoring them. If a request contains a gap or
contradicts something established, surface that instead of executing it
faithfully. During iterative visual work especially, treat each delivery as
a checkpoint: end with the inferred next steps, so "almost there" always
arrives with a concrete proposal for what "there" looks like.

## Git & deploys

Public repo (`vantaloomin/darling-blades`); **`main` auto-deploys** to GitHub
Pages on every green push, so treat `main` as production. The main session owns
all git; sub-agents never run it. Branch non-trivial work, run the ladder
locally before pushing, and land risky changes via a PR (CI gates it). Full
branch / commit / PR / merge flow: [docs/git-workflow.md](docs/git-workflow.md).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` | dev server (:5173) / typecheck + production build |
| `npm run forge` | the Forge card designer's dev server (:5176, page at `/forge/`); `npm run build` builds it into `dist/forge/` (web only). See [docs/forge.md](docs/forge.md) |
| `npx vitest run` | full suite (~16 min at 5,644 tests on 4 workers, measured 2026-10-08; win-rate gates included; run on an idle machine, not during sweeps) |
| `npm run lint` | ESLint over src, tests, scripts (enforces layer purity) |
| `npm run check-docs` / `check-art-bible` / `gen-docs-tables -- --check` | doc anti-rot checkers (must be green, zero warnings) |
| `npx tsx scripts/balance-matrix.ts --avatars --seeds 40` | balance matrices (call tsx directly — PowerShell eats `--` via npm run) |
| `npm run sweep-dash` | live metagame-sweep dashboard (:5185; pairs with craft.ts --status-file) |
| `npm run signals-dash` | local viewer for the anonymous play-stats daily totals (:5186; reads the `signals-data` branch's `rollups/`, set `SIGNALS_ROLLUP_DIR`) |
| `.\scripts\run-sweep.ps1` | launch the metagame sweep as a Windows Scheduled Task so it outlives the shell (`-Status`, `-Resume`, `-Stop`) |
| `npm run app:build` / `npm run app:dev` | Tauri desktop app — NSIS installer / dev window (needs Rust + MSVC; see [docs/desktop-build.md](docs/desktop-build.md)) |
| `npx tsx scripts/showcase-match.ts` / `node scripts/showcase-capture.mjs` | trailer footage: pick a seeded AI-vs-AI showcase duel, then film it frame by frame from the dev server (`?showcase=<name>`); trailers are cut in `trailer/` with HyperFrames. See [docs/trailers.md](docs/trailers.md) |

## Iron invariants

- `src/engine|ai|data|meta|config|power` never import Phaser or browser APIs;
  tests never import Phaser. The engine is headless and seeded-deterministic.
- AI reads only the redacted `PlayerView` — never hidden state.
- Save schema changes bump `SaveData.version` with a real `migrate()` +
  test; the storage key `darlingblades.save.v1` is a slot name, not a version
  (the legacy `waifutcg.save.v1` key is still read once for save migration).
- Test gate floors only ratchet upward, with fresh measured numbers. One
  owner-approved exception (2026-10-08, [plan-2.0.md](docs/plan-2.0.md) P8):
  when 2.0 raises starting life, every gate floor is reset once from fresh
  200-seed readings at the new total, each one that drops listed in the PR;
  then they ratchet up again.
- Never `setInteractive` a scaled Container; more traps in the playbook §11.

## Where things live

Balance baseline lives date-stamped in `src/data/opponents.ts`. Negative
AI-experiment results live in `src/ai/determinize.ts`.

**Design reference workbenches (`balance/`, `balance/cards.sqlite`,
`mtg-cache/`, `deck-cache/`) are local-only, gitignored, and absent from a
fresh clone.** Check before relying on them. How to use them (commands,
schemas, rebuild flags) is in the `card-workbench` skill
([.claude/skills/card-workbench/SKILL.md](.claude/skills/card-workbench/SKILL.md)).
These hold even when the skill is not loaded:

- None of this is ever committed, and corpus rows are never copied into
  `src/data/` — read the MTG corpus to calibrate costs, never to paste text from.
- After any card-data edit, rebuild our corpus
  (`npx tsx scripts/blades-db.ts build`); after any new keyword or mechanic,
  run `terms --check`.
- The mtgtop8 crawler is polite by construction (identifying UA, 1500ms floor,
  disk cache, bounded `--events`, stops on 403/429); keep it that way.
