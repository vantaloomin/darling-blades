# Darling Blades — Codex session guide

Single-player MTG-style (8th/9th/10th-edition feel) collectible card game.
Phaser 3 (pinned, never v4) + TypeScript + Vite + Vitest. **Under git** (`main`);
the main session owns commits — parallel sub-agents don't run git.

## Before doing anything

Read [docs/Codex-playbook.md](docs/Codex-playbook.md) — the orchestration
playbook: how to think through steps (orient → baseline → decompose →
delegate → review → adversarially verify → measure honestly → sync docs),
how to write agent prompts as contracts, the verification ladder, the
preview-probe recipe for the hidden-tab dev server, and the known-traps
registry. Sessions on this repo follow that loop.

"What's next" is defined by [docs/roadmap.md](docs/roadmap.md)'s Planned
section — the docs are the spec. Locked design decisions (documented in the
session memory and docs) are never relitigated.

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
| `npx vitest run` | full suite (~20–25s; win-rate gates included) |
| `npm run lint` | ESLint over src, tests, scripts (enforces layer purity) |
| `npm run check-docs` / `check-art-bible` / `gen-docs-tables -- --check` | doc anti-rot checkers (must be green, zero warnings) |
| `npx tsx scripts/balance-matrix.ts --avatars --seeds 40` | balance matrices (call tsx directly — PowerShell eats `--` via npm run) |
| `npm run app:build` / `npm run app:dev` | Tauri desktop app — NSIS installer / dev window (needs Rust + MSVC; see [docs/desktop-build.md](docs/desktop-build.md)) |

## Iron invariants

- `src/engine|ai|data|meta|config` never import Phaser or browser APIs;
  tests never import Phaser. The engine is headless and seeded-deterministic.
- AI reads only the redacted `PlayerView` — never hidden state.
- Save schema changes bump `SaveData.version` with a real `migrate()` +
  test; the storage key `darlingblades.save.v1` is a slot name, not a version
  (the legacy `waifutcg.save.v1` key is still read once for save migration).
- Test gate floors only ratchet upward, with fresh measured numbers.
- Never `setInteractive` a scaled Container; more traps in the playbook §11.

## Where things live

`docs/` is the doc set (architecture, rules, adding-cards, ai, art-pipeline,
roadmap, art-bible/, Codex-playbook, git-workflow). Balance baseline lives date-stamped in
`src/data/opponents.ts`. Negative AI-experiment results live in
`src/ai/determinize.ts`. Session memory (cross-session state) is in the
Codex memory directory, indexed by `MEMORY.md`.
