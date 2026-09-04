<!-- source-of-truth: .github/workflows/deploy.yml, .github/workflows/release.yml, package.json, package-lock.json · last-verified: 2026-09-04 · proposal — re-verify when a workflow, the Node pin, or a toolchain major changes -->

# Proposal: run Darling Blades on Node 24

**Status: proposal, 2026-09-04. Nothing here is implemented.** Written after
the v1.7.1 release run (33904550154) warned that three of our actions still
target Node 20 and were being forced onto Node 24 by the runner.

## Why now, in one paragraph

GitHub runners began defaulting JavaScript actions to Node 24 on 2026-06-16
and remove Node 20 from the runner on **2026-09-23**. Node 20 itself reached
end-of-life in April 2026. Our two workflows pin the toolchain to Node 22,
which entered maintenance on 2025-10-21 and ends 2027-04-30; Node 24 has been
Active LTS since 2025-10-28, moves to maintenance on 2026-10-20, and is
supported to 2028-04-30. Every toolchain package we run already accepts
Node 24, so the upgrade is a pin change plus a handful of action majors, and
doing it now lands it under the 1.8 train rather than under a deadline.

## What runs where today

| Surface | Today | Node 24 state |
| --- | --- | --- |
| `deploy.yml` verify + Pages build (ubuntu) | `setup-node` `node-version: 22` | pin change |
| `release.yml` installer build (windows) | `setup-node` `node-version: 22` | pin change |
| `actions/checkout@v4` (both workflows) | node20 | `v5` runs on node24 (so do v6 and v7) |
| `actions/setup-node@v4` (both) | node20 | `v5` runs on node24; needs runner 2.327.1+, which GitHub-hosted runners have |
| `softprops/action-gh-release@v2` (release, two steps) | node20 (`v2.6.2` is the last v2) | `v3` moved the runtime to node24 |
| `actions/configure-pages@v5` | node20 | no node24 tag yet; forced-run is what it does today and it works |
| `actions/upload-pages-artifact@v3` | composite, delegates to `upload-artifact` | leave; the composite picks its own pinned upload-artifact |
| `actions/deploy-pages@v4` | node24 on its main branch | leave |
| Developer machines | Node 22.14, npm 11.5 | install Node 24 LTS |
| `package.json` | no `engines` field, no `.nvmrc` | add both so the pin is declared, not tribal |

Nothing else in the repo names a Node version. `run-sweep.ps1` finds
`node.exe` by process name and `serve-lan.ts` only mentions the firewall
prompt; neither cares which Node answers.

## The toolchain already allows it

Measured from `node_modules` on 2026-09-04:

| Package | Version | `engines.node` |
| --- | --- | --- |
| vite | 8.1.2 | `^20.19.0 \|\| >=22.12.0` |
| vitest | 4.1.9 | `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0` |
| eslint | 10.6.0 | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| tsx | 4.22.4 | `>=18.0.0` |
| typescript | 6.0.3 | `>=14.17` |
| @tauri-apps/cli | 2.11.4 | `>= 10` |

`@types/node` is already at `^26`, so no type churn. The only native
dependency is esbuild (through Vite and tsx), which ships Node 24 prebuilds;
nothing is compiled with node-gyp. The Tauri side is Rust and does not see
Node at all beyond running Vite.

## Proposed change, one PR

Title it as a player would never read it, because it never reaches the
release page: `chore(ci): build and test on Node 24`.

1. **Pin the toolchain.** `node-version: 24` in both workflows. Add
   `"engines": { "node": ">=24" }` to `package.json` and a `.nvmrc` reading
   `24`, so `npm ci` warns on an old machine and version managers pick it up.
2. **Bump the three flagged actions to their node24 majors.**
   `actions/checkout@v5`, `actions/setup-node@v5`,
   `softprops/action-gh-release@v3` (both release steps). The smallest major
   that runs on node24 is deliberate: v5 of checkout and setup-node changed
   only the runtime, and staying there keeps the diff reviewable. Leave the
   Pages actions alone; they are forced onto node24 today and work.
3. **State the prerequisite where developers read it.** Neither the README's
   setup section nor `docs/desktop-build.md` names a Node version today (both
   go straight to `npm install`). Add one line to each: Node 24 LTS, with the
   `.nvmrc` as the machine-readable copy.
4. **Verify before merging**, in this order, because each step is cheaper
   than the next and finds a different failure:
   - locally on Node 24 (`winget install OpenJS.NodeJS.LTS` or nvm-windows):
     `npm ci`, `npx vitest run` (full suite, idle machine), `npm run build`,
     `npm run lint`, and `npm run app:build` (the Rust bundle runs Vite under
     the new Node);
   - on the PR: `verify` green is the Node 24 toolchain proving itself on
     Linux, since the PR's own workflow file is what runs;
   - after merge: the next `v*` tag exercises `release.yml` on Windows under
     Node 24 with `action-gh-release@v3`. `release.yml` never runs on a PR, so
     schedule this before a cut rather than discovering it at one. The
     natural slot is the first 1.8 pre-release tag, or a `v1.7.2` if one is
     needed anyway.

## What could break, and what we would see

- **Node 24 enables type stripping by default** (`node file.ts` runs without a
  loader). We do not rely on it; every script goes through `tsx`, which keeps
  its own loader. No change expected, but a script that accidentally starts
  working under bare `node` is not a reason to drop `tsx`.
- **`require(esm)` is on by default** from 22.12 onward, so it is already
  our behaviour on Node 22.14; nothing new on 24.
- **Deprecation noise.** Node 24 emits runtime deprecation warnings for
  `url.parse` and a few legacy `fs` signatures. A grep of `scripts/` and
  `src/` before the PR tells us whether any land in our own code; third-party
  warnings are theirs.
- **`action-gh-release@v3`** is a runtime bump with the same inputs we use
  (`files`, `body_path`, the tag). If its release notes list an input rename
  by the time the PR is written, the diff is one key.
- **`setup-node@v5` needs runner 2.327.1+.** GitHub-hosted runners are past
  it; this matters only if a self-hosted runner ever appears.
- **The win-rate gates.** They are seeded and deterministic, so a Node bump
  cannot legitimately move them; if one moves, that is a bug in something
  underneath (an RNG or sort stability change), not a tuning event. Treat a
  changed gate as a stop-the-line finding.

## Not in scope

No application code changes. No Vite, Vitest, ESLint, or Tauri majors ride
along; each of those is its own decision with its own diff. The Pages
actions stay on their current majors until they publish node24 tags.

## Decisions for the owner

1. **Smallest node24 majors or latest majors** for checkout and setup-node.
   This proposal says smallest (v5). Latest (v7) folds in a year of other
   changes we have not needed.
2. **`engines` as a warning or `engine-strict`.** A warning matches how the
   repo treats other prerequisites; strict would block `npm ci` on Node 22
   machines, which is a stronger stance than we take anywhere else.
3. **Timing.** Before 2026-09-23 removes Node 20 from the runner, or as the
   first chore of the 1.8 train. Both work; the deadline only changes how
   loud the warnings get, since the runner already forces node24.
