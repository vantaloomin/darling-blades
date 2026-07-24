<!-- source-of-truth: docs/plan-1.4.md, docs/expansions/dark-tales.md, src/engine/types.ts, src/engine/actions.ts, src/engine/mana.ts, src/engine/resolve.ts, src/engine/effects/EffectInterpreter.ts, src/ai/value.ts, src/ai/determinize.ts, src/meta/Replay.ts, src/ui/rulesText.ts, src/data/opponents.ts, src/ai/tiers.ts, src/config/rules.ts · last-verified: 2026-07-23 · concretion doc — EXECUTED; historical record of the approved semantics, kept for the R4/S-flag contracts the code honors -->

# 1.4 Pillar 0 concretion — Skim & Retell + Dark Tales integration

Status: **BUILT AND MERGED 2026-07-23** — engine (PR #108, adversarial
review + fix round), card data (PR #110, 638-card pool, spec audit
124/124), duel UI + glossary recut (PR #112, live-probed), dark-tales
land style wiring (PR #111, manifest-gated). Remaining from §6:
bosses at rungs 17-18, the art PR (staged and user-audited on
claude/1-4-art-staging), and the single end-of-set re-baseline.
Originally: **APPROVED by the user 2026-07-23** (all six §5 defaults, the
dual-mode Sleeping Curse with the R4 ops-override, the Storybook dawn
engine, the four-token slate, and the 34 demotions; the concretized
card table in expansions/dark-tales.md is the set spec of record).
Names locked 2026-07-23
(plan-1.4.md): Cycling = **Skim**, Flashback = **Retell**. Engine seam
research done 2026-07-23 against the 1.3.0 tree (all file refs below
verified then). Per plan-1.4.md, semantics default to MTG-accurate
behavior; every deviation or genuinely open choice is in §5.

Neither mechanic is a combat keyword. The `Keyword` union
(src/engine/types.ts:6-18) stays untouched; both follow the
Empower/Quest pattern: an optional `CardDef` block + a
`MECHANIC_DEFINITIONS` entry + glossary row.

## 1. Skim (cycling)

Player-facing shape: **"Skim {cost}"** — reminder draft: "{cost},
discard this card: draw a card." Sorcery/charm/creature/artifact/land?
— any card type may carry it (MTG cycling appears on all types).

Semantics (MTG-accurate defaults):

- **Timing: instant speed** — usable whenever the owner could act in
  `main`, `respond`, or `endStepWindow` menus (MTG cycling activates at
  instant speed). Enumerator branches in all three legality windows.
- **Resolution: immediate, no stack item** — a deliberate simplification
  (§5 flag S1). The engine's simplified LIFO stack carries only casts;
  Skim behaves like an intrinsic action (playLand precedent): pay cost,
  hand → graveyard, draw 1, emit events. Not cancellable.
- Skimming is NOT casting: no `spellCast` event, cast-triggered effects
  (none exist today) would not see it; the discarded card lands in the
  graveyard normally (feeding Retell — the set's intended engine).

Engine map (new surface — no precedent pays mana outside a cast):

- New `Action` kind `skim { handIndex, manaPlan? }`
  (src/engine/actions.ts:15-37); enumerate beside casts in `main`
  (213-229) and the charm windows (283-297); validate pricing via
  `canPay`/`solveMana` (mana.ts:47-97); apply in `Game.apply` reusing
  the tap-plan payment core (Game.ts:342-346) then discard + draw.
- `CardDef.skim?: { cost: ManaCost }` following the `empower?` pattern
  (types.ts:146).
- `reasonUncastable` (actions.ts:488-522) and `hasCastableInstant`
  (525-534) gain Skim awareness (UI dimming + window auto-pass).
- New `GameEvent` (e.g. `skimmed`) for history/UI narration.

## 2. Retell (flashback)

Player-facing shape: **"Retell {cost}"** on Rituals and Charms only —
reminder draft: "You may cast this from your graveyard for {cost}.
Then sever it."

Semantics (MTG-accurate defaults):

- **Alternative cost, not additive**: a Retell cast pays `retell.cost`
  INSTEAD of the printed cost. First alternative-cost mechanic in the
  engine — `castCost` (actions.ts:109-113) gains a third mode, threaded
  through pushCastActions / castBlockers / validateAction /
  validateManaPlan / Game.apply (§seam list in the dossier).
- **Source: graveyard**, so the cast action carries a grave index
  instead of a hand index; normal timing rules for the card's type
  still apply (Ritual = own main, Charm = instant windows).
- **Exit is ALWAYS severed**: on resolution (resolve.ts:78 path), on
  fizzle (resolve.ts:38-43), and — the sharpest found seam — on being
  cancelled: the `cancel` op currently re-buries the StackItem's card
  in the graveyard (EffectInterpreter.ts:193); a Retell'd StackItem
  must route to `severed` in all three exits (MTG-accurate; otherwise
  Retell spells loop through counterspells).
- `StackItem` gains `retell?: true` mirroring `empowered?`
  (types.ts:205-213). Retell + Empower on one cast: legal in principle
  (alternative cost replaces base; Empower rider still additive) but
  **no 1.4 card combines them** — the concretion table keeps them
  disjoint, and v1 may reject the combination outright (§5 flag R2).
- **X-cost cards cannot carry Retell** in v1 (mirrors the existing
  `canEmpower` X exclusion, actions.ts:105-107).
- **Dual-mode Retell (R4, user-directed 2026-07-23)**: the retell block
  is `retell?: { cost: ManaCost; ops?: EffectOp[] }` — when `ops` is
  present, a Retell cast resolves THOSE ops instead of the card's
  printed body (targeting comes from the ops actually being resolved,
  so an ops-override Retell whose ops are trigger-safe needs no
  targets). One 1.4 card uses it: The Sleeping Curse (first cast
  massDestroy allCreatures; Retell resolves preventCombat — the
  retelling is a fading echo of the curse). Sever-on-exit rules (R1)
  apply identically to override casts.

## 3. AI plan (all difficulties, honesty invariant holds)

- **Pricing**: a `skimValue`/`retellValue` beside `empowerValue`
  (src/ai/value.ts:215-242). Easy: fold into its cast-size sort.
  Medium: a smoothing gate in its main-phase chain (269-380) — Skim
  when no castable line beats drawing (land-light/flooded heuristics);
  Retell'd casts enter the existing lethal/removal/develop chains
  priced as virtual card advantage. Hard: candidates via Medium,
  valued through determinized sims as today.
- **Determinize note (accepted v1 blind spot, documented negative
  space)**: graveyards are exact in sims, so Retell lookahead is sound;
  opponent HAND stand-ins carry no skim block, so Hard under-models
  opponent smoothing (src/ai/determinize.ts:47-125). Accepted for v1;
  revisit only if measurement shows it matters.
- NoisyAI wraps new action kinds automatically (NoisyAI.ts:18-27).
- Win-rate floors re-measured after mechanics + card data; floors only
  ratchet up.

## 4. Set integration (the rest of Pillar 0)

- `CardDef.set` union gains `'dark-tales'` (types.ts:153) — type-level
  edit, plus booster SKU, set icon, achievements, precon per plan-1.4.
- **Two 16-entry ladders grow to 18, not one** (plan wording said
  "floors"; both systems extend): gauntlet AVATARS + `avatarForRung`
  (opponents.ts:823-828, docstring hardcodes "1..16") + the
  `gauntletRungGold` 16-tuple (rules.ts:70) get rungs 17-18
  (Glass-Coffin Queen, Abyssal Songstress); `FLOOR_TIERS`
  (src/ai/tiers.ts:53-60) gets floors 17-18 (tier values decided by
  the re-baseline measurement); RUNG_BANDS + FLOOR_BANDS
  (scripts/balance-matrix.ts) gain rows; opponents/tiers tests bump
  counts. One measured re-baseline at the end, 80+ seeds.
- **REPLAY_LOG_VERSION 1 → 2** (src/meta/Replay.ts:20): new action
  kinds are observable-behavior change; old logs fail closed per the
  documented discipline. No SaveData bump for the mechanics themselves
  (rung is an unbounded number; nothing persistent is added) — the
  v23 question stays open only for set-scope needs (e.g. a dark-tales
  land style), decided when card data lands.
- **UI**: Skim affordance on hand cards + a chooser when both cast and
  Skim are legal (Empower-chooser template, DuelScene.ts:3599-3601);
  graveyard zone modal gains Retell casting (the grave-side
  onHandClick); history narration rows for skimmed/retold; rulesText
  `MECHANIC_DEFINITIONS` gains both keys (closed union edit,
  rulesText.ts:45-55) + oracle-text generators; Glossary mechanics
  section gains both — and should gain the MISSING Empower row found
  during research (GlossaryScene.ts:54-63 lists only 4 mechanics;
  pre-existing inconsistency, fix rides along).
- **Tests**: mirror the Dreaded/Empower pattern
  (tests/engine/gothicMonsters.test.ts fixtures + AI valuation tests +
  determinism + a replay golden including both new action kinds).

## 5. Flagged decisions (user) — defaults applied unless vetoed

- **S1 — Skim resolves instantly, off-stack** (not respondable). MTG
  cycling is a stack ability; our simplified LIFO stack carries casts
  only, and no existing non-cast action stacks. Deviation chosen for
  v1 simplicity; the alternative (stackable Skim) touches the response
  system for marginal gameplay value.
- **S2 — Skim timing is full instant speed** (MTG-accurate). The
  cheaper alternative (own-main only) was rejected as it guts
  draw-go's use of the mechanic; veto if you want it simpler.
- **R1 — Countered/fizzled Retell casts sever** (MTG-accurate),
  requiring the cancel/fizzle exit-routing change above.
- **R2 — Retell and Empower never co-occur on a 1.4 card**, and v1
  may hard-reject the combination; lifting that is future work.
- **R3 — X-cost cards cannot carry Retell v1** (Empower parity).
- **A1 — the determinize Skim blind spot is accepted v1** and
  documented in determinize.ts's negative-results register.

## 6. Sequencing

1. This doc + the rewritten card table approved by the user.
2. Engine build (Codex hand-off): Skim, then Retell (shared cost
   plumbing lands with Retell), headless + tested + AI-aware; ladder
   green.
3. Card data + booster + precon + achievements + UI affordances.
4. Bosses 17-18, art acceptance, economy + tower re-baseline (once),
   doc sync.
