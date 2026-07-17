<!-- source-of-truth: tests/, scripts/, scripts/gen-card-art.ts, src/data/catalog.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/data/draftPersonas.ts, src/data/art-manifest.json, src/meta/SaveManager.ts, src/meta/Economy.ts, src/meta/Quests.ts, src/meta/Achievements.ts, src/meta/Limited.ts, src/meta/draftPicker.ts, src/meta/DeckCode.ts, src/meta/collectionFilter.ts, src/meta/deckColorIdentity.ts, src/scenes/AchievementsScene.ts, src/scenes/MainMenuScene.ts, src/scenes/LimitedDraftScene.ts, src/ai/HardAI.ts, src/ai/MediumAI.ts, src/ai/determinize.ts, src/audio/, src/audio/music.ts, src/audio/musicPatterns.ts, src/ui/CardThumbCache.ts, src/ui/SceneBackdrop.ts, src/ui/KeywordGlossaryPanel.ts, src/platform/, tests/ai/winrate.test.ts, tests/meta/quests.test.ts, tests/meta/achievements.test.ts, tests/meta/deckColorIdentity.test.ts, tests/meta/deckCode.test.ts, docs/art-bible/, docs/mobile-lan-plan.md, docs/scene-art.md, docs/design-system.md, docs/plan-design-system-alignment.md, src/meta/DeckStorage.ts, tests/meta/limited.test.ts, tests/meta/draftPersonas.test.ts, src/meta/profileStats.ts, src/ui/deckStats.ts, src/ui/SearchInput.ts · last-verified: 2026-07-16 · review monthly -->

# Roadmap

_Dated 2026-07-04. Review monthly._

## Status snapshot

- **The game is named _Darling Blades_** (renamed from "WaifuTCG" 2026-07-03).
  The rename swept all display text/docs/package name (`darling-blades`)/launch
  configs; the save key moved to `darlingblades.save.v1` with a one-time read
  of the legacy `waifutcg.save.v1` key so existing saves survive. The on-disk
  repo folder is now `DarlingBlades` (renamed from `WaifuTCG`).
- **Playable end-to-end.** First launch offers an optional **tutorial**; a new
  player then claims a free starter deck in the shop and plays the **Avatar
  Gauntlet** (14 themed opponents on a ladder) or Practice duels → rewards → shop →
  pack opening → collection → deck builder, all wired, with procedural SFX +
  ambient music.
- **Feature- and art-complete for desktop + phone-over-LAN (Tier 1).** **Every
  one of the 210 pool cards now has a real illustration** — 147 creatures +
  15 lands + 43 spells — plus 5 tokens, 210 half-res variants, and 11
  scene/menu backdrops, all on disk and in `src/data/art-manifest.json`,
  rendering in-game (lands are landscapes via `gen-land-art`, spells are
  effect scenes via `gen-spell-art`; see art-pipeline.md). What remains is
  human polish: a real-device pass (gesture feel, iOS audio) and a
  by-ear/by-eye pass (music `MOODS`, holo FX, a few small labels).
- **825 tests green** (+3 skipped balance-tool assertions; count refreshed with the 1.2.0 release cut 2026-07-17) across 85 files
  (engine, combat, keywords, mana, RNG, determinism, stack/effects, catalog
  integrity, meta + gauntlet/save-migrations + variants/drop-distribution +
  collection filters + achievements + deck-face picker + gauntlet-run-seed +
  shard/per-variant playset, audio recipes + music patterns, platform gestures +
  render-scale + anim policy, engine auto-pass, icon paths, hand-fan +
  combat-sequence layout/timing math, AI smoke + win-rate + personality
  lockstep/divergence + avatar/starter legality; and the QOL pass —
  unplayable-reason, card-search filter, keyword-reminder coverage, undo
  snapshot/restore round-trip, combat forecast (`previewCombat`),
  deck-stats aggregation, profile win-rate, deck-storage ops); plus the
  onboarding tutorial (scripted-line determinism, the pure coach-mark guide,
  v9→v10 migration) and achievement/collection-goal coverage
  (v10→v11 achievement migration, v11→v12 tower clear-style migration,
  v12→v13 daily quest/streak migration,
  unlock/claim idempotency, completion tallies, themed archetype and expansion
  goals, deck-color identity). The whole suite runs in ~25–30 s.
- **210 cards** in the base pool (`CARD_DB`), across the five colors and three
  factions, bucketed into **five rarity tiers** (C 103 / R 65 / SR 13 /
  SSR 11 / UR 8 booster-eligible) — plus the **69-card Ragnarök**,
  **80-card Celtic Fae**, and **80-card Arthurian Court** expansions in
  their own set-scoped boosters (429 collectible cards total).
- **5 starter precons** (`src/data/starterDecks.ts`) covering all five colors,
  each color in exactly two lists.
- **Audio complete in structure**: a procedural WebAudio SFX layer
  (`src/audio/`, 15 recipes) wired into every scene with persisted volume +
  SFX toggle, plus **generative ambient music** (`src/audio/musicPatterns.ts`
  + `src/audio/music.ts`, four moods, a persisted toggle) — all driven from
  the `SettingsScene`. `SaveData` is **v21** (v7→v8 keyword-reminders, v8→v9 shop
  restructure, v9→v10 tutorial-done, v10→v11 achievements, v11→v12 gauntlet
  clear-style counters, v12→v13 daily quests/streaks, v13→v14 Limited,
  v14→v15 per-deck hero images, v15→v16 draft personas, v16→v17 persona
  familiarity, v17→v18 Premium Draft, v18→v19 premium weekly allowance,
  v19→v20 deterministic replays, v20→v21 Full Art three-segment variant
  keys — see Recently shipped and the Full Art entry under Planned). By-ear
  tuning remains open (see Planned).

## Recently shipped (2026-07-17 · the 1.2 close-out)

- **PR #85 merged** (squash `dc50189`) — the 2026-07-16/17 playtest batch:
  all 8 playtest items (coin flip with the play/draw choice, history
  foresee/sever detail + [bracketed] tappable names, Esc menu, failure
  screen rework with count-aware recap grid and plain end-reason copy,
  foresee/firstBlade verifications pinned by tests), the `--prefabs`
  balance harness + measured Glimmer/Grave tuning (29.8→46.5 /
  63.9→54.3 Hard aggregate at 500 seeds/cell), the cleanup-step deferred-
  decision engine crash fix, the shop rework (two-column deck grid with
  color pips, claim-aware default tab, per-pack odds modal replacing the
  drawer), the **Full Art axis** (0.25% booster-only roll, ×25 shards,
  SaveData v21 — Premium Draft excludes it, see the Planned entry's gate
  numbers), and docs/plan-1.3.md (the locked 1.3 decisions).
- **1.2.0 release cut**: version bump + tag `v1.2.0`, README rewritten
  (condensed 1.1 notes, full 1.2 "The Grail Oath" notes, 429-card /
  14-rung / 825-test / Full-Art numbers swept).

## Recently shipped (2026-07-16 · the 1.2 build)

- **The whole 1.2 release built in one orchestrated session** (plan file
  session-handoff-begin-1-2-glimmering-meteor; user decisions locked
  up front: full Quest/Awakening engine build, rungs 13–14 now, replays
  full-but-phased, one-Practice-row picker). The four 1.2 features:
  1. **Practice opponent picker** — the Play submenu's three difficulty
     rows collapsed into one Practice entry opening
     `PracticePickerScene`: all 14 tower avatars with the gauntlet's
     card presentation (difficulty inherits from the avatar; no tower
     state touched) plus plain Easy/Medium/Hard training rows.
  2. **Deterministic replays** — `src/meta/Replay.ts` records every
     non-tutorial duel (seed + both decklists + every successful submit,
     both seats) into **SaveData v19 → v20** (`replays[]`, newest-first,
     cap 10, real `migrate()` + tests). A card-db content stamp
     hard-refuses drifted logs (engine-code drift instead rides a
     documented `REPLAY_LOG_VERSION` discipline). Golden test: a
     recorded game replays to a byte-identical state AND event stream.
     The viewer: a Replays reel on Profile (Watch / drift notices) and a
     locked-input DuelScene playback mode (play/pause/step/speed/exit,
     'Replay complete' banner, never the rewards flow) — live-verified
     save-byte-identical through a full watch. A probe found and fixed a
     real pre-existing bug: a stale `aiTimer` stranded the next duel
     after abandoning one mid-AI-decision.
  3. **Limited run-history achievements** — four schema-free mastery
     goals over `limited.history`/`bestDraftWins` (first draft, 5 drafts,
     3-0 Clean Sweep, Premium Keeps); unlocks latch so the 20-entry FIFO
     cannot revoke them.
  4. **The Arthurian Court expansion** (below).
- **3rd expansion: "Arthurian Court — The Grail Oath" (80 collectible
  cards — set `arthurian-court`, prefix `ac-`) + the Quest/Champion
  Awakening engine mechanics** (spec: the concretized
  [expansions/arthurian-court.md](expansions/arthurian-court.md); folded
  into 1.2 by user decision 2026-07-16). New engine surface, landed pure
  + tested before card data per the set precedent: **Quests**
  (`CardDef.chapters` — chapter I on arrival, one chapter per controller
  dawn in battlefield order, final chapter leaves via the normal dies
  path; chapter ops are trigger-safe and ride the existing
  pendingDecisions FIFO), **Champion Awakening** (`awakening` stat/keyword
  block + one-way `Permanent.awakened` flip via the trigger-safe `awaken`
  op), and the **`questActive` condition** on abilities, spell bodies, and
  statics (+ `StaticDef` scope `'self'`). An adversarial review pass
  confirmed one real latent engine bug (an all-whiff dawn foresee drain
  stranded the turn), fixed with a red-test-proven regression. W/U/R
  knight tribal with 7 chapter Quests and five awakening carriers; the
  1/1 W Squire token (`tok-squire`); set booster SKU at 525g with a
  sword-in-stone set icon; the **Questing Table** precon; 8 schema-free
  set achievements; Duel UI chapter badges (I/II plates), awakened gold
  rings, and history narration; the Glossary teaches all four game
  mechanics in a recut 2×2 grid. **Art**: all 80 raws were pre-generated
  in the vault and audited card-by-card by vision sub-agents against the
  art-bible rules (76/80 first-pass; zero text violations), then two
  user-review rounds drove 21 content regens + the Squire token and a
  crop-side rescue: `smartcrop.py` gained a zoom fallback
  (hidden-face count 20 → 0 on the wide pre-preamble raws) plus per-card
  `--band-frac`/`--focal-frac` review flags; two cards were renamed from
  review (**The Sword in the Stone**, **Rallying Horn**). The art bible
  (294 entries incl. the token) retrospectively describes the approved
  art. **Balance, measured honestly**: rungs 13–14 (Morgan of the Thorn
  Crown, Artoria) first measured 59% with a ladder inversion; six
  50-seed deck iterations (walls measured WORSE three times — the CF
  tuning law re-confirmed; base-set interaction splash was the real
  lever) plus two user-approved card-buff rounds moved the tower rows to
  66%, bands calibrated fresh at R13 ≥ 60 / R14 ≥ 62 with the residual
  ~10pp gap vs R11/12 documented in `opponents.ts` (W/U Quest tribal has
  no in-color removal; R10 Brunhild has been the tower's power peak
  since Celtic Fae). Full clear now 2,770g; all economy gates green; the
  post-AC 10×8×60 baseline is date-stamped beside `ECONOMY` (every
  persona −5–11pp completion, the expected effect of a 23% larger pool;
  Hardcore-Optimizer window drift flagged as an open design question).
  **Copy rule (user, 2026-07-16): the word "saga" is retired everywhere**
  (MTG-distinctive) — the Ragnarök 'Saga Binder' achievement is now
  **'Edda Binder'**. 798 tests + 3 skipped green; live probes throughout
  (a real Quest awakened a Camelot Banneret in play).

## Recently shipped (2026-07-16)

- **The 1.1 Limited economy TUNING pass — the last 1.1 engineering item**
  (user knob decisions 2026-07-16; measured end-to-end per
  [plan-economy-testing.md](plan-economy-testing.md)'s tuning record, which
  carries the full numbers). Instrumentation first: sim-side experiment
  knobs + a `scripts/tuning-sweep.ts` candidate driver (default-off, default
  path byte-identical, adversarially reviewed — two instrument defects fixed
  before any decision was read off it), a 12-candidate screening sweep
  (4 seeds × 60d) and a 9-config finalist sweep (6 seeds × 75d). The three
  shipped changes: **(1) Premium Draft weekly allowance** — 2 entries per
  UTC week (**SaveData v18 → v19**, hub copy "N left this week" / "Weekly
  limit · Resets in N days"; Limited Fan 35 → 18 runs/60d, collection held
  at 97.3%, first premium stays day 3); **(2) premium runs pay no run-end
  gold** (entry buys the 45 kept picks; free-draft payouts untouched) —
  the only measured lever that closes the premium shard-farm (mean 1,127.5g
  → 827.5g vs the 1,000g entry; the `it.fails` pin in exploits.test.ts is
  now a hard EV gate; the run-gold trim measured too weak at 1,007g and was
  dropped); **(3) shard-crafting catch-up** — craft one plain copy of any
  wholly unowned collectible at 6× dupe value (C/R/SR/SSR/UR =
  30/60/300/900/3,000g; Craft chip in the Collection inspect honoring
  `confirmDestructive`; Collection gains the shared gold badge since it now
  spends — supersedes the 2026-07-12 currency-placement pick, flagged to
  the user). Crafting fixes the measured ~90% pack-route asymptote:
  Hardcore Optimizer completes day 68 median (4/6 seeds at 75d),
  Completionist 63.5 (6/6) — inside the locked 50–75-day window for the
  first time. Gates re-measured 2026-07-16 (gauntlet/premium 2.488× vs the
  intact 1.20× floor; the premium≥1.35×-practice GOLD inequality is
  intentionally void — premium's value is cards now); post-tuning canonical
  baseline (10×8×60 daily) date-stamped beside `ECONOMY`; dashboard
  Artifact refreshed. 745+ tests green; live-probed on :5174 (allowance
  states, refused payment, craft arm/confirm, history rendering, zero
  console errors); adversarial review 2 dimensions, zero confirmed
  findings. Visual by-eye pass of the new hub/craft copy flagged for a
  live screen.

## Recently shipped (2026-07-15)

- **Economy instrumentation — phases 2b + 3 of
  [plan-economy-testing.md](plan-economy-testing.md): the locked
  decisions became CI gates, and the exploit probes went live** (two
  concurrent Codex streams on disjoint files + two adversarially-reviewed
  fix rounds). Phase 2b: `tests/meta/economyGates.test.ts` pins the
  Layer-1 EV inequalities (measured: full gauntlet 15.07 g/min ≥ 1.2×
  successful premium 11.41 gross; free draft ≤ 1.0× practice at 0.60×;
  premium total value 639g < the 2,170g full clear) plus coarse
  progression bands at a measured 1.17s CI config; `--check` runs the
  full matrix with fine bands flag-only (coarse bands gate only when
  their calibration cohort/day is present); a date-stamped 10×8×60
  baseline table lives next to `ECONOMY` in rules.ts. Phase 3:
  `scripts/optimizerPolicy.ts` (greedy g/min probe over the EV surface,
  driven through a new exported `dailyPolicy` persona seam — scripted
  personas verified byte-identical) gated at ≤ 1.5× the best honest
  persona (measured 0.585×), plus named exploit regressions
  (concede-farm, free-draft spam at 0.44× practice, retire-scumming,
  and reachable-state shard-loop Monte Carlos: base pack pays 96.9g mean
  vs 450g). **One measured live finding**, pinned honest-red as
  `it.fails`: the premium-draft shard-farm (finished collector nets mean
  1,127.5g vs the 1,000g entry) — a tuning-pass input, alongside the
  measured completion-curve verdict that pack-only routes asymptote near
  90% (catch-up mechanism on the agenda).

- **Economy instrumentation — phases 0–2a of
  [plan-economy-testing.md](plan-economy-testing.md)** (PRs #78/#80; two
  concurrent Codex streams for 0/1, orchestrator-built dashboard for 2a).
  The progression sim now simulates the shipped game (draft-only, the real
  `scorePick` picker with skill profiles, persona-Personality opponents,
  Premium Draft through the real entry/grant APIs, shard income, per-rarity
  acquisition); `src/meta/economyModel.ts` ships the analytic EV surface
  with four hard CI invariants (computed pack dupe-EV 67.5g at full
  completion, verifying the ≈68g claim). The eight Phase-2 design decisions
  are locked in the plan doc (headline: gold ordering Full Gauntlet >>>
  successful Premium Draft >> Practice >= Free Draft > failed Premium).
  The full **10 personas × 8 seeds × 60 days baseline** ran with daily
  snapshots and is live as a filterable data-insights site (private
  Artifact; generator repeatable via `scripts/econ-dashboard/`). Baseline
  headlines: Limited Fan reaches **97% collection on 35 premium drafts
  with 4 boosters ever bought** (first premium: day 3) — premium dominance
  confirmed in play; casuals land 53–57% (on the ≈50% target); the
  Hardcore Optimizer reaches 90% (slightly behind the 50–75-day window);
  harness verdict UNEVEN. Phases 2b + 3 shipped later the same day (see
  the bullet above); only the tuning pass remains (see Planned).

- **Achievements screen — full UX pass** (PR #79; unled gpt-5.6-sol review,
  findings audit-verified, Codex-implemented). Rows center one
  `count · percent` cluster on a single shared rail (the old counter/percent
  diagonal pair is gone) with a stable `+N Gold` reward column in every
  state and three distinct row states; the summary bar became a full-width
  KPI strip with the baked mana beads; header/pager moved onto the
  title-safe tracks (the pager previously breached the frame and overlapped
  the last row's Claim hit band by 2px); pagination re-cut 20/20/8 →
  16/16/16; All/Ready/In Progress/Claimed filters added; Claim All is the
  lone primary; the unreachable 'Unlocked' branch died.
  `sceneHeaderFooter` gained a default-on `showCurrency` flag. Live-probed
  with crafted save states; flagged for eyes: KPI pip optical centering,
  longest-copy ellipses, claimed-state contrast.

- **Deck-preview wave 2 — modal contract, signature cards, paging** (Sol
  consult items 8–10, user-directed bundle; Codex-implemented under a file
  contract, orchestrator-reviewed + live-probed). The preview and inspect
  modals now sit on the shared overlay machinery: one scene-owned
  `OverlayCoordinator` whose leases **ModalGuard the underlying Shop
  controls** (tabs, SKUs, quantity chips, deck rows, Back, the shop odds modal
  surfaces, with state-verified disable and restore while a modal is open; the
  stacked inspect lease guards the preview's own controls), all content
  anchored to the shell's title/content/footer tracks. The odds disclosure is
  now a per-pack modal that closes synchronously before the preview opens.
  Each deck shows **2–3 signature-card thumbnails** with count badges,
  tap-to-inspect (picks hand-authored in the new Phaser-free
  `src/data/deckInfo.ts` — `DECK_INFO` moved there with a purity test
  pinning every featured id into its deck; Burning Tides features Sun Ce).
  The card list adopts an **explicit overflow policy**: stable 9-row column
  pairs through `deckPageCount`/`deckPageSlice` + the shared pager (hidden
  today — every deck fits one page), headers repeat across columns/pages,
  and ←/→ inspect stepping walks the full list regardless of page. Verified:
  tsc/lint/**713 tests** (+2)/build/doc checkers green (independent re-run of
  Codex's ladder); live :5174 probe (guard on/off by state, Esc layering,
  claim-from-preview while the guard lease is live, save byte-exact, zero
  console errors). Still parked from the consult: prev/next deck comparison
  (item 7). Visual by-eye pass of the thumbnails flagged for a live screen.

## Recently shipped (2026-07-14)

- **Shop deck-preview overhaul** (user-directed; design consult by
  gpt-5.6-sol run unled, its items 1–6 shipped). The precon preview modal is
  now a buying aid rather than a name manifest: an **honest decision footer**
  (price · balance · post-purchase balance or exact shortfall; Buy disabled
  when unaffordable and the modal only closes on a successful purchase; the
  free-starter claim states its consequence — "the other starters cost 🪙 350
  once you claim it"), **full card names** (the old `split(',')` chopped
  every subtitle — 32 of 99 rows were wrong; long names shrink-to-fit, never
  truncate) in aligned count/name/mana-value columns on hoverable row bands,
  an authored **"How it plays"** paragraph per deck (`DECK_INFO`, which also
  drives the deck-row blurbs), a **mana curve + composition + color totals**
  block reusing `computeDeckStats` with the real baked mana-bead icons
  (color identity in the header renders as beads too, not letters), a
  **"What you get" grant preview** (`previewDeckGrant` in `src/meta/Economy.ts`,
  a read-only mirror of `grantDeckCards` with a lockstep test — says exactly
  how many new copies a purchase adds given your collection), and **tap-any-
  row card inspect** (full `CardView` layered above the preview; ←/→ steps
  the list, Esc closes top-most only — inspect first, then the preview; the
  footer buttons also moved onto the shell's footer track, fixing a 2px
  overhang). Probed live end-to-end on :5174 (free-claim/unaffordable/
  affordable/owned footers, disabled-Buy inert, buy-from-preview and
  claim-from-preview both land and re-render the rows, keyboard stepping,
  save restored byte-exact, zero console errors). The consult's items 8–10
  (modal contract, signature cards, paging) shipped the next day — see
  Recently shipped 2026-07-15; only item 7 (prev/next deck comparison)
  remains parked.

- **Base facet relabeled "Core Set"** (plan-1.1 Pillar 5.2; placed into 1.1
  by the 2026-07-14 handoff). The `'base'` set facet's display text is now
  **Core Set** in the Collection filter dropdown, the deck-builder pool
  filter, and the Shop booster SKU — so the label can't read as "all cards"
  now that three sets exist. Copy-only per the locked 2026-07-10 decision
  (plan-v1.1-post-launch Feature 4 option 2): the `CardDef.set` id `'base'`,
  pack pools, collection math, achievement definitions, and saves are all
  untouched. Recorded in the same pass: **mixed-set packs are the decided
  Limited set choice** (packs intentionally draw from all three sets;
  single-set drafts shelved unscheduled) and **Limited run-history
  achievement goals are scheduled to 1.2** with the opponent picker.

- **Limited Draft re-implementation — 20 AI draft personas** (still
  menu-hidden). The Bot Draft's seven bot seats are now **named characters**:
  a 20-persona roster (`src/data/draftPersonas.ts` — grounded millennial
  first names, 10f/10m; male portraits use non-character card art per the
  portrait rule) where each persona pairs a **`PickerProfile`** draft style
  (`src/meta/draftPicker.ts` — one parameterized scorer; frozen
  `DEFAULT_PICKER` reproduces the old heuristic bit-for-bit, lockstep-tested
  on the live pick path across 20 full drafts AND per-card over the whole
  `CARD_DB`, which also pins the shared auto-build scoring) with a duel
  **`Personality`** spread. Rare-chaser, swarm drafter, tribal loyalist,
  mono-forcer, chaos drafter (pure-hash noise — determinism holds), curve
  perfectionist, and 14 more. Seats are a seeded shuffle stored in
  `DraftState.personaIds` — **`SaveData` bumped v15 → v16** with migration +
  tests. The personas seated at 1–3 **pilot your three matches**: DuelScene
  wears their name/portrait/Personality (deck = their actual drafted pool;
  difficulty stays the easy→medium→hard ladder), the results screen names
  who's next, and the hub shows "Match 2/3 · vs Kyle".
  `LimitedDraftScene` was **fully rebuilt** on the theme system: an 8-seat
  table strip with portrait discs + tap-for-identity-card popups, the pack as
  real card thumbnails (select / right-click / long-press inspect; **inspect
  hotkeys**: ←/→ browse the pack, Space/Enter selects then — pressed again —
  picks), and a picks panel with live color/curve readouts. Polish rounds the
  same day: the seat row draws **You, 7, 6, … 1** so the engine's pass-left
  hand-off moves visually left (centered "← PASS LEFT ←" label + real arrow
  glyphs between seats, direction flipping per pack) and every within-pack
  pick plays a **pass animation** (pack tokens slide one seat over with an
  edge-wrap twin; skipped at pack boundaries and on non-full animation
  settings); the hub renamed the free entry **"Free Draft"**, hides all
  seed/reroll controls (seeds stay a gauntlet affordance; runs roll hidden
  seeds), regained its **gold badge**, and aligned all CTA rows on one shared
  two-column grid; the **inspect modal's right column became a pick-impact
  panel** (rarity·MV line, pool colors + curve with gold before→after deltas
  for the inspected card, the shared Keyword Guide when relevant, premium
  variant/owned-count lines) instead of duplicating the card face — design
  settled by two independent reviews (Claude + gpt-5.6-sol, consulted unled);
  and all color readouts use the real baked mana bead icons with the word
  "pips" removed from player-facing text. **Persona
  familiarity** (user-directed): identities reveal progressively over
  completed drafts together — 1st meeting name+portrait, 2nd the color
  habits (`colorHint`), 3rd the theme, 4th the full profile — tracked in
  `limited.personaSeen` (**SaveData v16 → v17**, migration + tests;
  counters tick only when a draft's 45 picks finish, so retire-scumming
  teaches nothing). **Premium Draft** (user-directed): a second hub entry at
  **1,000g** (`ECONOMY.premiumDraftEntry`, paid via `spendGold`) whose packs
  roll **frame + holo variants** from the run seed (Full Art excluded until
  its booster axis ships) — variants ride slot-aligned parallel arrays
  through every pass/pick (duplicate-safe via the selected cell index), show
  as frame-tinted plates + holo pips in the grid and real FX in inspect, and
  the player **keeps all 45 picks**: granted into the collection through
  `Collection.addCard` (identical playset/melt rules to pack opening) the
  moment the draft completes, once-guarded by the draft→build status
  transition, at all three completion sites. Auto-added basics are never
  granted; the free draft is bit-identical to before (lockstep-tested) and
  grants nothing. **SaveData v17 → v18** (premium/variant fields + history
  flag) with migration + tests. Both modes advance persona familiarity and
  pay the same run-end gold. Verified: tsc/lint/**673 tests**
  (+28)/build/doc-checkers green; adversarial review (2 dimensions, majority
  of candidates refuted; 2 confirmed findings — portrait mask undercoverage
  and inverted pass chevrons — both fixed and re-probed); a full browser
  probe of draft → auto-build → match 1 → results with zero console errors
  and the save restored byte-clean. Visual by-eye pass (portrait crops,
  45-pick density) still wants human eyes on a live screen.

- **"Play" submenu — and Draft goes public (user-directed 2026-07-14).**
  MainMenu's four game-mode rows (Avatar Gauntlet + Practice ×3) collapsed
  into a single **Play** entry opening a new `PlayScene` submenu: Avatar
  Gauntlet, **Draft**, Practice · Easy/Medium/Hard, Return. Draft routes to
  the Limited hub, making the persona Bot Draft **publicly reachable for the
  first time** (supersedes the PR #54 hide); **Sealed was removed from the
  hub entirely** (follow-up user decision the same day — the hub is retitled
  "Draft"; Sealed's meta core, reveal scene, and tests stay in the codebase,
  just unoffered). The MainMenu subtitle ("Three Kingdoms · Olympus · The
  Wilds") was retired. Gauntlet and
  the Limited hub's back buttons retarget to Play. Probed live end-to-end
  (all six rows navigate; back-paths land on Play; save byte-identical;
  zero console errors). ⚠ Known-open economics: draft runs are free to
  enter and pay `limitedRunGold` [40/100/180/300] on completion — the
  run-reward tuning blocker
  ([plan-v1.1-post-launch.md](plan-v1.1-post-launch.md) Feature 5) is now
  player-facing rather than hidden, accepted by user direction.

## Recently shipped (2026-07-12)

- **Playtest feedback batch** (PR #68): Settings Gameplay column no longer
  overflows its panel (content-driven row pitch) and fresh saves default to
  1440p; "Bloodoath" displays as **Blood Oath**; the concede-replay 20g farm is
  closed (practice losses before 3 full rounds pay 0, with an explainer on the
  results screen); **engine SBA deaths now batch** — all simultaneous deaths
  leave the battlefield before dies triggers fire, fixing the dies-token
  spawner losing tokens at the creature cap; the AI prices its own **net dawn
  self-bleed clock** (convex eval term + scored desperation attacks), closing
  the "stall a full bench while the bot bleeds out" cheese win; createToken
  rules text names the token ("create 2 1/1 Bloomling tokens"); and dual mana
  reads as *either*, not *both* — card faces show `[T] → [W] or [G]` and the
  playmat strips give flexible sources one split-pip bead with its own
  untapped/total count (signatures WUBRG-normalized). Balance re-measured at
  40 seeds: no flags; baseline table refreshed in `src/data/opponents.ts`.
  Follow-up rounds in the same PR: alignment fixes (Gameplay label inset,
  armed-concede overlap, pager centerline), text-heavy card faces re-wrap to
  fill the full text box, the Collection search input hides under the inspect
  overlay, and **MTG-style set symbols** replace the rarity diamond — shape
  names the set (base heart-and-blade, Ragnarök Mjölnir, Celtic Fae
  crescent-veil; `src/art/setIcons.ts`), tint names the tier.

- **2nd expansion: "Celtic Fae — The Silver Veil" (80 collectible cards —
  set `celtic-fae`, prefix `cf-`) + the exile/scry engine mechanics** (PR #64,
  bundling the stacked train #56/#59–#63; spec: [plan-1.1.md](plan-1.1.md)
  Pillar 1). New engine surface: a **one-way public exile zone** (exile /
  exileGrave / exileTop ops, no dies-triggers, unreachable by raise/reclaim)
  and **scry n** as a deferred decision (the `pendingFetch` seam generalized
  to a `pendingDecisions` FIFO; the awaiting's revealed cards are redacted to
  `[]` in the opponent's view; a shared deterministic AI scry policy in
  `src/ai/scry.ts` serves all brains). U/B/G tempo-control set with W fae
  knights and R wild-hunt pressure; 8 multicolor cards, all named legends
  (11 generic concept-multicolors were mono-colored in review to keep the
  multicolor⇒legendary idiom meaningful). Ships with: DuelScene exile piles +
  zone modals + a mandatory scry picker, 80 smart-cropped finals from
  retained raws (zero generation quota; 41/42 head-detected), a 42-entry
  art bible with the headroom demand in every prompt, a 525g set-scoped
  booster with generated pack art (both expansions got real pack fronts;
  crimp bands now translucent for full-bleed faces), the **Glimmer Bargain**
  U/B/G precon, 8 schema-free achievements, and pull-odds "1:N" leading the
  pack-inspect details (runtime-derived from DROPS; god roll ≈ 1:4.94M,
  Monte-Carlo verified over 18M slot rolls). The premium-hero shop toggle
  was retired (superseded by per-deck hero cards). Balance note: no new
  gauntlet rungs yet — the CF-bosses-vs-daily-rotation decision is open
  (plan-1.1 Pillar 5). *Retheme note (2026-07-12): the exile/scry mechanics
  were renamed Tier-3 into the Darling Blades voice — **Sever** (`sever` /
  `severGrave` / `severTop` ops, `severed` zone) and **Foresee** (`foresee`
  op/action, `src/ai/foresee.ts`) — per the
  [plan-de-mtg-rethemes.md](plan-de-mtg-rethemes.md) convention.*
- **Glossary of Terms** (PR #57): a MainMenu learning-corner scene with all
  11 keyword trait icons + reminder text, card-type definitions, mana
  symbols, and rarity gems — data-driven so Exile/Scry rows are one-line
  additions.
- **Dev-only gold cheat** (`__cheat.setGold()`, uncommitted
  `src/dev/cheats.local.ts`): dev-server-only by three layers (gitignored,
  DEV-gated loader, non-eager glob); production absence grep-verified
  against a built dist.

## Recently shipped (2026-07-10)

- **UI/UX refresh — all waves landed** (PRs #41–#53; plan in
  [plan-ui-ux-refresh.md](plan-ui-ux-refresh.md), execution record in
  [plan-ui-refresh-wave2-wave3-impl.md](plan-ui-refresh-wave2-wave3-impl.md)).
  Wave 1/1.5 play-field motion + mirrored play-mat + phase track, Wave 2 larger
  battlefield tiles + shared modal shell, Wave 3A–3D all-scene theme migration
  (DeckBuilder, Shop/MainMenu/PackOpening, Collection/Gauntlet/Achievements/
  Profile, Settings two-column — which closed the last QOL follow-up:
  in-Settings `confirmDestructive` + `keywordReminders` toggles), plus two
  post-wave duel-feedback rounds (#52/#53: End Turn declines combat, icon pile
  columns, zone-contents modals, clickable mana strips, artifact/enchantment
  bands, in-portrait life squares). The by-eye pass over the new theme system
  is still open (flagged "eyes on deploy" in the impl doc).
- **Launch economy retune + progression simulation (PRs #35/#36).** Collection
  boosters are now **9 rolls at 450g** (Ragnarök 525g) — Limited packs stay
  15 cards; daily quests pay 50g; streak payouts reduced; duplicate refunds
  tuned so the expected plain-dupe refund (~68g/pack at full completion) stays
  bounded below pack price. Grounded in a new deterministic
  **progression-sim harness** (`scripts/progression-sim.ts`, 10 personas,
  7/14/30/60-day checkpoints).
- **Limited descoped from the 1.0 launch (user decision 2026-07-10).** PR #54
  removed the Limited entry from MainMenu — the Sealed/Draft scenes, meta core,
  and tests all remain in the codebase, just unreachable. Limited ships in a
  post-1.0 release alongside a future expansion after more testing; the
  blocker list (auto-build balance texture, run-economy tuning, flow polish)
  is recorded in [plan-v1.1-post-launch.md](plan-v1.1-post-launch.md).

## Recently shipped (2026-07-09)

- **Subject-aware "smart crop" for card art.** The generation post-process is no
  longer a blind center crop: `scripts/smartcrop.py` detects the character with
  the MIT-licensed `dghs-imgutils` anime detectors (ONNX/CPU, models cached
  outside the repo) and positions the crop so the face lands at
  `FOCAL_FRAC = 0.40` of the deliverable with the head-top held
  `HEADROOM_FRAC = 0.25` clear of the card window's edge, falling back
  head → face → person → center; environment mode (lands/spells) reproduces the
  old center crop **byte-identically** (proven 15/15 against shipped land PNGs).
  All three `gen-*art.ts` drivers now call it, and a new
  `scripts/recrop-art.ts` batch tool re-cropped the whole pool from the 282
  retained 1024×1536 raws at zero generation quota — staged behind a
  before/after `review.html` (in-game CardView + BoardCardView mocks per row,
  card names from `CARD_DB`, `results.json` + `--sheet-only` for cheap sheet
  iteration) and human-approved before `--apply` touched shipped art.
  Measured over the pool: 212/215 head-detected (98.6%), 1 person, 2 center
  (headless constructs); 77 cards gained explicit headroom, 111 sit at the
  raw's ceiling and keep the accepted crown-clip (the raws lack sky — avg 6.7%
  short; user-directed 2026-07-09: no synthesized padding, no regeneration).
  Fixes the reported Frost Jotun decapitation class of bug (face above the
  window's visible band). Details: [art-pipeline.md](art-pipeline.md).

## Recently shipped (2026-07-08)

- **QOL follow-up polish.** The remaining high-friction items from
  `docs/plan-qol.md` are mostly closed: DeckBuilder now supports Shift+Click to
  fill a pool card to its constructed cap / owned count and Shift+Click a deck
  row to remove all copies; the deck-builder pool now has Collection-style
  search, facets, sorting, and a pull-out filter panel; Duel and Collection
  inspect overlays include a separate keyword glossary panel; and Gauntlet runs
  end on a success/failure recap with Main Menu and Start Over actions. The
  pack-opening flow also now uses click/right-click inspect, star markers for
  new cards/variants, centered pull-details text, suppressed text badges, a
  text-free booster wrapper, and a guard that prevents the best-card spotlight
  zoom from stacking with inspect.

- **Per-deck hero images.** DeckBuilder now adds an empty/filled star control
  beside each non-basic deck-list row. Exactly one card can be starred per
  saved constructed deck, and `DuelScene` uses that card as the player commander
  image for that deck before falling back to the old account default/premium
  behavior. **`SaveData` bumped v14 -> v15** (`SavedDeck.heroCardId`) with
  migration + tests.

- **Deck share codes (Road-to-1.0 Feature 4).** `src/meta/DeckCode.ts` adds a
  pure versioned `DBD2-...` codec for exact decklist export/import, with
  backward-compatible `DBD1-...` import and malformed-code errors surfaced as
  friendly strings. DeckBuilder now exposes styled **Export Code** and
  **Import Code** controls; export requires a legal constructed deck, and import
  decodes then validates through
  `DeckStorage.validateDeck` so unowned cards, illegal counts, tokens, unknown
  ids, and wrong deck sizes are rejected. No schema bump: codes are transient,
  and accepted imports use the existing **Save Deck** action.

- **Sealed / Draft Limited mode (Road-to-1.0 Feature 3).** _(Hidden from
  MainMenu 2026-07-10, PR #54 — descoped to a post-1.0 release; see Recently
  shipped 2026-07-10.)_ MainMenu exposed
  **Limited**, with Sealed and Bot Draft runs. Sealed opens six seeded temporary
  boosters; Draft runs three pick-one-pass packs with seven deterministic bot
  seats. `src/meta/Limited.ts` owns side-effect-free pack rolling, draft state,
  bot pick heuristics, limited auto-builds, and duel payloads. `DeckStorage`
  adds `validateLimitedDeck` for exactly 40 cards from the run pool plus
  unlimited basics, no tokens. `DuelScene` routes Limited result markers through
  `applyLimitedMatchResult`, paying gold only after the third match and never
  adding Limited cards to the collection. **`SaveData` bumped v13 -> v14**
  (`limited: { activeRun, history, bestSealedWins, bestDraftWins }`) with
  migration + tests.

- **Daily quests + win streaks (Road-to-1.0 Feature 2).** MainMenu now includes a
  **Daily Blades** panel with three deterministic daily quests, progress bars,
  explicit claim buttons, and per-quest rerolls capped at three total rerolls
  per day. `src/meta/Quests.ts` is the Phaser-free core: a 25-objective bank,
  deterministic `rollDailyQuestIds(day)`, event-batch progress folds, claim and
  reroll helpers, and `recordDailyWin()` for the streak reward. Duel progress is
  driven from public `GameEvent[]` batches; the streak advances only from the
  result path when the human wins, so losses/games played never count by
  themselves. **`SaveData` bumped v12 → v13** (`daily: { day, quests,
  rerollsUsed, streak }`) with migration + tests. Verified locally:
  tsc/lint/**534 tests**/build/doc-checkers.

- **Achievements + collection goals (Road-to-1.0 Feature 5).** The game now has
  a pure `src/meta/Achievements.ts` catalog/evaluator with five buckets:
  collection, variants, theme, mastery, and economy. The themed set includes
  RoTK leader tiers, the legendary Greek god court, the Beastkin leadership
  council, a larger Ragnarök pass scaled to its 69-card expansion size
  (percentage completion, headline cast, Valkyries, Draugr, and Jotun/Wolf
  goals), and mono-/dual-color Avatar Gauntlet clear goals recorded via the pure
  `deckColorIdentity` helper at final-rung completion. The `AchievementsScene`
  is reachable from MainMenu, paged, shows
  locked/unlocked/claimed status, and supports explicit per-achievement or
  claim-all gold rewards; MainMenu shows a claimable count. `collectionFilter.ts`
  now exposes reusable completion summaries, and Collection displays overall
  pool completion plus special-variant coverage. **`SaveData` bumped v10 → v11**
  (`achievements: { unlocked, claimed }`) and **v11 → v12**
  (`gauntlet.clearStyles`), each with real migrations + tests; the archetype and
  expansion achievement follow-up is schema-free because it derives from existing
  collection/variant data. Verified locally: tsc/lint/**527 tests**/build.

- **Optional first-launch tutorial + onboarding rework (PR #28).** The
  Road-to-1.0 **tutorial (Feature 1)** landed: an optional, skippable, on-rails
  scripted duel against a fail-safe teaching AI (`src/ai/ScriptAI.ts`), driven by
  a hard-constrained coach-mark guide (`src/ui/CoachMark.ts` +
  `src/data/tutorial.ts`'s pure, tested `tutorialCue`) that teaches goal → play a
  land → play a creature → summoning sickness → attack → block → **Ritual**
  (sorcery-speed) → **Charm** (instant-speed, cast at end of turn), locking input
  to the one taught control each step. It reuses the real engine + `DuelScene`
  through new optional `create(data)` overrides (fixed deck/seed/`ScriptAI`) — no
  engine fork. Offered once on first launch ("New to card games?"), replayable
  from a "How to Play" menu entry. The old **first-launch deck picker was removed**
  — new players claim ONE free starter deck in the shop's Decks tab
  (`Economy.claimFreeStarter`), and both playing and skipping grant the same
  `startingGold` onboarding bonus. **`SaveData` bumped v9 → v10** (`tutorialDone`,
  with a real `migrate()` that derives it from the win/loss record so veterans
  skip it, + a migration test). Verified: tsc/lint/**510 tests**/build/doc-checkers,
  plus live preview runs of the whole flow (zero console errors).

## Recently shipped (2026-07-07)

- **De-MTG term re-theme — Tier-3 full engine rename (PR #14, doc sweep PR #16).**
  The game now speaks its own voice in the code, not just the UI: the 11
  evergreen keyword ids renamed (`flying` → `skyborne`, `firstStrike` →
  `firstBlade`, `deathtouch` → `deathblade`, `lifelink` → `bloodoath`, …) and
  the Magic-distinctive card types renamed (`instant` → `charm`, `sorcery` →
  `ritual`), per [plan-de-mtg-rethemes.md](plan-de-mtg-rethemes.md) — which
  supersedes the display-only
  [plan-keyword-rethemes.md](plan-keyword-rethemes.md). Safe by audit: the save
  blob stores only card ids/counts/seeds/settings, so no migration was needed.
  Generic gaming vocabulary (creature, enchantment, artifact, land) was
  deliberately kept. Residual MTG terms survive only in internal comments,
  helper-local field names (e.g. the combat `Hit` struct), and `src/data/cards/`
  file names — no player-facing or engine-id surface.

## Recently shipped (2026-07-06)

- **Quality-of-life pass — all 15 features shipped ([docs/plan-qol.md](plan-qol.md)).**
  The day-to-day friction-reducers a modern-TCG player expects, landed across
  three PR waves off the Ragnarök-integrated `main`. Two `SaveData` bumps, each
  with a real `migrate()` + migration test: **v6 → v7** (`settings.confirmDestructive`,
  Feature 1) and **v7 → v8** (`settings.keywordReminders`, Feature 9).
  - **Wave 1 — quick wins (F1–F4, F6, F7).** F1 concede/shard confirm behind a
    unified two-tap `confirmDestructive` policy; F2 `reasonUncastable`
    (`src/engine/actions.ts`, view-safe) → the dimmed-card skip toast tells you
    *why*; F3 a targeting arrow from a pending cast to the hovered legal target;
    F4 always-visible gold badge on Collection/Deckbuilder/Settings; F6
    Space/Enter = pass/confirm, Esc = cancel hotkeys; F7 desktop deck-list paging
    (fixes the latent `y > 560` row-clipping bug). _(F5 pack-odds display shipped
    with the Ragnarök expansion, not this pass.)_
  - **Wave 2 — flagship medium features (PR #5).** F14 read-only `ProfileScene`
    over `stats`/`gauntlet` (pure `src/meta/profileStats.ts` win-rate math);
    F13 deck statistics (curve/color-pie/type-counts, pure `src/ui/deckStats.ts`)
    + one-click add-a-playset; F11 undo-before-commit (a one-deep `Game.clone()`
    snapshot in `DuelScene.act()`, invalidated the instant priority passes to the
    AI or combat animates — the strongest advertisement for the determinism
    guarantee); F12 combat/lethal forecast via a **pure `previewCombat`** factored
    out of `combat/damage.ts` (golden-tested against `resolveCombatDamage`); F9
    keyword reminder text on card faces + a `keywordReminders` toggle; F10 buy/open
    **N packs at once** (pure `openPacks` + a batch-summary reveal path).
  - **Final wave (PR #6) — F8 + F15.** F8 card-text search
    (name/type/subtype/keyword) — a pure, tested `matchesSearch` clause wired into
    both the collection filter and the deck-builder pool, driven by the codebase's
    **first Phaser `this.add.dom` `<input>` overlay** (`dom: { createContainer: true }`
    in `main.ts` + reusable `src/ui/SearchInput.ts`; positions correctly under the
    render-scale setting and tears down on scene shutdown — sidesteps the
    "never `setInteractive` a scaled Container" trap). F15 multiple saved decks —
    pure `DeckStorage` ops (`deleteDeck`/`copyDeck`/`renameDeck`/`generateDeckId`,
    preserving the `activeDeckId`-always-valid invariant) behind a "☰ Decks" picker
    modal (select / new / copy / rename / two-tap delete); no migration (the
    `decks[]` + `activeDeckId` model already existed). Plus a **`fix(build)`**:
    the dev-module loader switched from an eager to a non-eager (tree-shaken) glob
    so a local `src/dev/*.local.ts` cheat can never bundle into the prod build.
  - Verified: tsc / lint / **491 tests** / build / all doc-checkers green, plus
    live preview probes (search filters both scenes; DOM input positioned under
    render-scale k=1.5 and cleaned up on shutdown; deck picker new/copy/select).
    **Deferred follow-ups (tracked):** the in-Settings toggles for
    `confirmDestructive` + `keywordReminders` remain open because the full
    settings panel needs a wider / 2-column relayout. F13 remove-all and F9's
    separate inspect-overlay glossary legend shipped in the 2026-07-08 QOL
    follow-up.
- **UX-polish pass — three waves (PRs #7 / #8 / #9).** Follow-on presentation +
  shop work on top of the QOL pass. **Wave A (#7):** mulligan cap hard-lock fix,
  owned-cards default filter, dev-gated card showcase, on-screen version label.
  **Wave C (#8):** card-face mirror layout, playmat battlefield-tile redesign,
  dropdown filters. **Wave B — shop restructure (#9):** Boosters / Decks tabs,
  a per-pack drop-rate % modal, a buyable deck store with preview, and a unique generated
  Valkyrie hero portrait — the **v8 → v9** `SaveData` bump.

## Recently shipped (2026-07-05)

- **1st expansion: "Ragnarök" (69 collectible cards — set `ragnarok`, prefix
  `rg-` — plus 3 tokens, which stay in the `base` set).** A Norse headline faction (Valkyries, Norns, Jotun, Draugr, the
  death-goddess Hel) with a graveyard soul, plus "deepening" cards that give the
  existing worlds their own returning dead (Shu/Wei twin blades duelists, a Greek
  underworld shade). Three new mechanics: the **`twinBlades`** keyword (two edits
  in `combat/damage.ts` — every interaction falls out of the existing two-step
  damage), and the **`grind`** + **`raise`** EffectOps birthing a true
  graveyard/reanimator archetype the base set lacked. All pure data in
  `src/data/cards/ragnarok.ts`, tagged by a new `CardDef.set` field stamped in
  `catalog.buildDb` (existing 200 default to `'base'`; no `SaveData` bump —
  `collection`/`decks` are id-keyed). Ships with: a **set filter** in the binder, a
  **Ragnarök booster** SKU (set-scoped `packPool`/`openPack`; the shop shows two
  packs), a buyable **precon** ("Valhalla's Muster", B/G reanimator, via
  `Economy.buyThemeDeck` + the previously-unused `preconPrice`), and **two new
  gauntlet bosses at rungs 9-10** — Hel (U/B grind-reanimator, 71%) and Brunhild
  (R/W Valkyrie twin blades, 88% — the summit wall), with `gauntletRungGold`
  extended to 10 rungs and GauntletScene de-hardcoded off `8`. Balance measured
  2026-07-05 (40 seeds, no flags); win-rate gates untouched (they run on
  `TEST_DB`). The current build now also has a scaled achievement pass for set
  completion, headline legends, and major sub-archetypes. Art-bible entries
  generated by `scripts/gen-ragnarok-artbible.ts`
  (Card-facts computed from the data → checker-clean); Ragnarök card art first
  shipped as procedural placeholders on 2026-07-05, then real illustrations via
  the `gen-card-art --faction ragnarok` run — all 69 `rg-` PNGs now on disk
  (2026-07-06). Added
  engine specs (twinBlades/grind/raise) + meta coverage (set filter, ragnarok
  pool, `buyThemeDeck`, rungs 9-10). See the session memory for the full breakdown.
- **Four player-facing features + four design plans (user-directed).** One
  `SaveData` bump (**v5 → v6**, with a real `migrate()` + tests: adds
  `heroCardId` (null = auto) and stamps any in-progress gauntlet run with a seed).
  1. **Player hero image.** Any collected card can front your in-duel commander
     portrait. New `SaveData.heroCardId` (null → the auto-derived `faceCardFor`
     face, the pre-v6 behavior); DuelScene reads it (falling back if unknown),
     the existing `CommanderPortrait` already takes the card id. Set/cleared via
     a **☆ Set as hero** toggle in the Collection inspect overlay (owned cards).
  2. **Manual shard / sell.** The playset (4) is now **per-variant** — each
     distinct frame|holo counts to 4 of its own. Plain copies still auto-melt
     past 4 *plain*; specials accumulate and the player sells copies past 4 of a
     given variant for **variant-scaled gold** (`shardValue` = `dupeGold[tier] ×
     frameMult × holoMult`; `src/config/rules.ts`) via a two-tap **⛏ Shard**
     button in the Collection overlay. Pure `shardExcess` / `shardableCount` /
     `shardGold` in `src/meta/Collection.ts`, unit-tested.
  3. **Seeded Tower runs.** The Avatar Gauntlet ("the Tower") picks one run seed
     when a run begins; every rung's duel derives a distinct seed from it (pure
     `rungSeed` in `src/meta/gauntletSeed.ts`) — so a run is one reproducible,
     shareable playthrough and two runs diverge. GauntletScene shows the seed
     with **↻ Reroll** / **⌨ Set…** before the run locks it; practice duels stay
     freshly random. The engine RNG was already seeded — only *where the seed
     comes from* changed (no engine/AI/balance touch).
  4. **Sequenced combat.** Combat damage now plays back attacker-by-attacker on
     a stagger instead of all at once (feature: "slower combat, see cards attack
     sequentially"). A pure planner (`src/ui/combatSequence.ts`, `planCombat`,
     unit-tested) orders the engine's atomic `combatDamage` hits per attacker;
     DuelScene lunges + strikes + floats each in turn and **defers** the board
     sync + AI/auto-skip/end-turn follow-ups (through one `afterEvents` seam)
     until the sequence finishes, so the pre-combat board stays up while it
     plays. Engine untouched (still one atomic resolution); gated to
     `animations: 'full'` — reduced/off keep the instant path.
  Verified: tsc/lint/**390 tests**/build/doc-checkers green, plus a live preview
  probe — a real AI attack engaged and cleared the combat sequence with damage
  applied and no freeze (8 turns, no stall); Tower seed bar + reroll; a live
  v5→v6 save migration; and the hero + shard buttons set/shard correctly
  (SSR blue-frame ×2 → 900g). **Four design plans** were also authored for
  upcoming work: [Commander mode + 8 decks](plan-commander-mode.md),
  [MOD/UGC packs](plan-mod-ugc.md), [MTG-keyword rethemes](plan-keyword-rethemes.md),
  and [road to 1.0 — five features](plan-road-to-1.0.md). (Their proposed
  `SaveData` version numbers are illustrative — this session claimed v6, so each
  would land at v7+.)

## Recently shipped (2026-07-04)

- **Hand auto-organize + summoning-sickness affordance (2026-07-05, user-directed).**
  The player's hand is now sorted for readability — **lands first, then ascending
  mana value, then like colors clustered (WUBRG)** — by a new pure, unit-tested
  module (`handDisplayOrder` in `src/ui/handSort.ts`, 15 tests). It returns
  a *display* permutation of hand slots only; the engine's hand array (and the
  `handIndex` every click/cast/pick addresses) is never reordered, so `syncHand`
  carries a visual `pos` alongside the true `handIdx` and the reorder is purely
  cosmetic + determinism-safe. The mulligan/bottom-cards/discard pick overlay
  shares the ordering (its picks still map to true hand indices). Battlefield
  creatures that are **summoning-sick** (entered this turn, no warcry — the engine's
  `isSummoningSick` is the source of truth) now show a moonlight-swirl badge in the
  tile's top-right corner and a slight art fade (`BoardCardView.setSummoningSick`),
  so it's obvious at a glance which creatures can't attack yet. Engine/AI/balance
  untouched (pure UI). Verified: tsc/lint/**370 tests** (+15)/build/all doc-checkers
  green, a live preview probe (hand order matches spec end-to-end; sick A/B tile
  contrast; save byte-identical), and a 5-dimension adversarial review (index-seam,
  pick-overlay seam, sickness lifecycle, purity) that returned **zero findings**.
- **Standalone desktop app via Tauri 2** (user-directed). The game now bundles
  into a native Windows app whose window hosts the OS webview (WebView2) instead
  of a full Chromium — the installer is a small native shell plus the game's own
  assets. **The web frontend is untouched**: `src/` knows nothing about Tauri, the
  desktop app loads the exact `dist/` that `npm run build` produces and
  `npm run play:lan` serves. New `src-tauri/` (stock Tauri-2 Rust shell, no custom
  commands, `core:default` capability only), `npm run app:build` (→ NSIS
  `…_x64-setup.exe`) / `app:dev` (live-reload native window), a dark-titlebar
  1280×720 centered resizable window, and an app icon derived from the card-back
  emblem. `security.csp` stays `null` (fully-offline game). Full guide:
  [desktop-build.md](desktop-build.md). Caveats: the installer is large (~260 MB
  of bundled art) and the app has its own `localStorage` (a browser save doesn't
  carry over). Toolchain (Rust + MSVC + WebView2) is present on the dev machine.
- **Render size is now hard-coded 16:9 resolutions — the "Automatic" option was
  removed** (user-directed). `settings.renderScale` is `1 | 1.5 | 2`
  (1280×720 / 1920×1080 / 2560×1440); the Settings chips read out the explicit
  resolution and no longer offer Auto, and `resolveRenderScale` simply passes
  the choice through (still capped to 1 on the lite tier for the VRAM budget).
  This drops a persisted enum value, so **`SaveData` bumped v4 → v5** with a
  real `migrate()` that coerces any legacy `renderScale: 'auto'` (or
  out-of-range value) to the 1080p default while preserving explicit choices,
  plus migration tests. New saves default to 1080p. **The setting now resizes
  the actual desktop (Tauri) window** to the chosen resolution — clamped to the
  screen work area and re-centered (`desktopWindowSize` + the guarded
  `src/platform/desktopWindow.ts`, which dynamic-imports `@tauri-apps/api`); a
  plain browser can't resize itself, so the factor stays supersampling-only
  there. Needs the `core:window:allow-set-size`/`allow-center` capabilities and
  a rebuilt installer.
- **In-game layout rebuilt to wireframe 1a "Immersive Fan"** (user-picked from
  the six-direction wireframe set). The old full-width bands and gold phase
  seam are gone: a full-width **opponent strip** (avatar disc from
  `portraitCardId`/deck face art, targetable life, hand-back fan ×N, deck/grave
  `PileView` piles, per-color opponent mana pips — public info, and the
  ⏩ Auto-skip chip), two **inset zone plates** (lands at the outer edge,
  creature tiles at the inner edge, Arena-style; skip toast + stack readout
  float in the gap), a left **phase rail** (turn/step pills, whose-turn tag,
  hint + log), and a bottom stage: the **`CommanderPortrait`**
  (`src/ui/CommanderPortrait.ts`) showing your deck's face card — derived by
  the pure, tested `faceCardFor` (`src/meta/deckFace.ts`) — with damage-flinch
  and cast-glow reactions, an **arced hand fan** (pure, tested
  `src/ui/handFan.ts`; hover straightens the card), and a right cluster: ⏭ End
  Turn above the **circular smart button** (input on an `Arc`, so relabeling
  can't hit the Text hit-area trap), your piles, Concede. All engine
  interaction semantics (act loop, auto-skip race guard, End Turn
  stop-at-attackers, burn targeting, right-click inspect) unchanged; touch
  targets keep their 90px floors. Verified: tsc/lint/353 tests/build green,
  10-turn live probe with screenshots (boot, mulligan, fan hover, smart-button
  advance, auto-skip chain, save byte-identical) plus an adversarial review.
  Details: architecture.md ("The duel board").
- **Duel-screen UX pass — six features.** (1) A right-edge **History
  slide-out** (`src/ui/HistoryPanel.ts`): a vertical tab toggles a translucent
  move-log mirroring the duel feed (newest first). (2) The phase auto-skip is
  now a **live in-duel toggle** (⏩ Auto-skip chip, persists `settings.autoSkip`)
  plus a **⏭ End Turn** fast-forward: it auto-passes your empty phases but
  *stops at your attack step whenever you have eligible attackers* (user-chosen
  behavior), resumes after, and clears when the turn flips to the AI. (3)+(4)
  **`BoardCardView` battlefield tiles redesigned** (132×146): a framed art
  window (no more art spilling past the border) with the name below the art and
  the P/T plate below the name (no overlap, all within bounds). (5) **Card
  flavor** on the full card face moved to its own italic, no-quotes, sepia
  `Text` at the bottom of the box (below a hairline), with fit math so rules +
  flavor never overflow onto the P/T plate. (6) **Attack animations**
  (`src/ui/CombatFx.ts`): lunge-on-declare + a themed impact flourish on combat
  damage, keyed to a per-creature **attack archetype** (12 kinds) reviewed
  across all 152 creatures into the pure `src/data/attackFx.ts` (explicit map +
  keyword/subtype/color fallback; 5 coverage tests). FX are `fxPolicy`-gated,
  self-disposing, and pure decoration. Verified in-browser (tiles, flavor,
  history feed, End Turn stop/resume/clear, toggle persistence) and through an
  adversarial review (2 findings — a 3px plate overflow and an unguarded
  history tab — both fixed). Details: architecture.md ("The duel board").
- **Land + spell art — the pool is now 100% illustrated.** The 152 creature/
  token entries left the 15 lands and 43 non-creature spells on procedural
  placeholders; both got their own art programs (`docs/land-art.md` +
  `scripts/gen-land-art.ts` for landscapes; `docs/spell-art.md` +
  `scripts/gen-spell-art.ts` for effect scenes), siblings of the card driver
  with the same hardened machinery but environment-/effect-first preambles.
  All 58 generated serially (detached process, collision-safe alongside the
  concurrent rarity refactor — it reads only the prompt docs, never the
  catalog), bringing the on-disk total to **210 cards + 210 half-res + 11
  scenes** (`gen-art-manifest` confirms). QA of the risk-concentrated sample
  (no-text banners/seals/oaths, canon lands, effect scenes) passed — the
  NO-TEXT guard held on the Hegemon banner, Imperial Jade Seal, and Peach
  Garden Oath. Every card in the game renders real art.
- **Multi-axis rarity system.** The pool re-bucketed onto five tiers —
  `Rarity = 'c'|'r'|'sr'|'ssr'|'ur'` (old commons→C, uncommons→R, the 32
  rares hand-split SR 13 / SSR 11 / UR 8; UR = the marquee legends: Cao Cao,
  Sun Quan, Liu Bei, Guan Yu, Lu Bu, Athena, Zeus, Gaia). Boosters are now
  15 **independent triple-rolls** (`src/meta/PackOpener.ts` over the `DROPS`
  weight tables in `src/config/rules.ts`): tier (C 50 / R 30 / SR 14 / SSR 5 /
  UR 1 %), frame (white 50 / blue 30 / red 15 / gold 3.55 / rainbow 1 /
  black 0.45 %) and holo finish (none 60 / shiny 20 / rainbow 10 /
  pearlescent 8 / fractal 1.55 / void 0.45 %) — god roll UR·black·void
  ≈ 1 in 4.94 M ("1 in 5,000,000" spec). SR+ card picks stay dupe-protected
  in-tier. **`SaveData` is v4**: `collectionVariants` (per-copy frame|holo
  counts, invariant-checked against the aggregate `collection`) + the new
  settings block; stepwise v1→v4 migration with tests. Melt rule: plain
  copies past the playset convert to tier-scaled gold; **special variants
  never melt**. Frames render as ring/wash treatments (rainbow = the mode-0
  border shader), holo finishes as per-finish FX with canvas/lite fallbacks
  (`src/ui/fx/HoloEffects.ts`, new `IridescencePostFX` mode 3 pearlescent);
  the per-card signature holo (and `CardDef.holo`) was **removed** — holo is
  a pull cosmetic now. Pack reveal renders rolled variants with tier-keyed
  escalation; `CardShowcaseScene` became the frame×holo QA showcase. This
  supersedes the old locked C/U/R + 11C/3U/1R booster economy (user-directed
  2026-07-04). Seeded 2000-pack distribution measured within bands
  (`tests/meta/variants.test.ts`).
- **Collection binder redesign.** `CollectionScene` rewritten as a two-page
  open-binder spread (2×(3×2) pockets, animated page turns): nothing overlaps
  a card face (badges/tier labels on the pocket lip below; the old cropped
  bottom row and buried page label are gone), color/type/rarity/owned filter
  chips + sort cycler (rarity/mana/name) over a pure, unit-tested
  `src/meta/collectionFilter.ts`, and an inspect overlay showing the best
  owned variant with a tappable list of every owned variant.
- **Settings menu.** `SettingsScene` (gear on the MainMenu, which replaced
  the old VolumeControl widget): SFX toggle + master volume, music toggle,
  animation level full/reduced/off (intersected into `fxPolicy` +
  `tweens.timeScale` via `src/platform/animPolicy.ts`), **render size**
  720p/1080p/1440p/auto — implemented as a supersampled backing store
  (canvas 1280k×720k + per-scene camera zoom via `applySceneSettings`, Text
  rasterization at k) with all scene layouts migrated to design-space
  constants; capped at 720p on the lite tier — and the auto-skip toggle.
  Settings persist in `SaveData.settings` (v4).
- **Phase auto-skip.** Pure engine predicate `forcedAction`
  (`src/engine/actions.ts`) + a paced DuelScene driver: main phases with
  nothing playable, attack steps with no able attacker, and block steps with
  no legal blocker auto-pass (300 ms hops) with a transient notice; response
  windows/mulligans/discards are never skipped, and the engine state machine
  is untouched (AI decision streams and win-rate baselines stay valid).
  Toggleable in Settings. 22 headless tests (`tests/engine/autopass.test.ts`).
- **Vector icon set.** Hand-authored SVG-path mana symbols (sun/droplet/
  skull/flame/tree/crystal + tap arrow, `src/art/iconPaths.ts`) baked over
  the existing pip beads at 64 px (`src/ui/ManaSymbols.ts`) — no more
  letter-in-a-bead, no webfont dependency; land card faces finally show
  their mana identity ([T] → color pips in the textbox); rarity gems rebaked
  for the five tiers.

## Recently shipped (2026-07-03)

- **Renamed WaifuTCG → Darling Blades** across the whole repo (display text,
  docs, `package.json` name, `.claude/launch.json` config names, `.bat`
  files, LAN banner, art-bible headers). The `localStorage` save key became
  `darlingblades.save.v1`; `SaveManager` reads the legacy `waifutcg.save.v1`
  key once so a pre-rename collection/gold/gauntlet save is preserved (a
  dedicated test covers this). The repo folder stays `WaifuTCG` for path
  stability. The loading label was re-themed "Summoning waifus…" →
  "Unsheathing Blades…" (user-approved); generic "waifu" genre wording in the
  design docs stays. Verified: `npx tsc`, `npm run lint`,
  247 tests, `npm run build`, and all three doc checkers green; a repo grep
  confirms zero stray brand tokens outside the intentional legacy-key code.
- **Art program execution — COMPLETE. All 152/152 card entries on disk**
  with 152 half-res variants and all 11 scene assets, everything in
  `src/data/art-manifest.json`. The remaining 61 generated serially after the
  user re-authenticated the CLI (`codex login`). Run QA: gender drift hit
  `gk-apollo` (male; regenerated female per the bible's genderbent entry);
  `bk-batkin-duskwing` composed inverted a third time even under the perched
  wording — its bible Prompt now states the upright/head-at-top cue
  explicitly ("definitely not hanging upside down"), and the fourth roll
  passed the safe zone; zero text incidents across the full 152. Spot-checks
  of the canonically-female TK-other set and the enthroned poses all passed
  the crop band.
- **Tier-1 mobile / LAN play (phone hits the served game).** Per
  [mobile-lan-plan.md](mobile-lan-plan.md); PvP (Tier 2) is deliberately
  back-burnered. Platform half (`scripts/serve-lan.ts` + `npm run play:lan`):
  a zero-dep static server for `dist/` on the LAN with a terminal QR to join
  from a phone, auto-build-if-stale, best-effort half-res refresh that never
  blocks serving; `index.html` viewport/overscroll/`dvh`/safe-area fixes,
  self-hosted fonts, a pure-CSS portrait rotate overlay; iOS `AudioContext`
  `'interrupted'`-state resume with a `play()` self-heal + `pagehide` save
  flush; an FX-lite quality tier (`src/platform/quality.ts` +
  `FXSupport` `FxPolicy` table) that gates post-FX/particles on mobile GPUs
  while leaving desktop byte-for-byte unchanged; a half-res art pipeline
  (`scripts/gen-art-halfres.ts`, 320×400 into `cards-half/`, ~78 MB vs
  ~311 MB VRAM) picked up by `ArtResolver` on the lite tier. Touch half
  (`src/platform/gestureCore.ts` pure state machine + `gestures.ts` binder):
  tap = activate, long-press ~450 ms = sticky zoom preview with the release
  consumed (never casts), tap-preview / tap-actionless-card = full inspect,
  hover-lift/hover-SFX/wheel/Z all suppressed or replaced on touch, and 90-px
  hit-area inflation across the audited undersized targets (Concede moved out
  of the corner gesture zone). Two adversarial reviews (duel-UX: 9 findings;
  platform: 5 findings incl. a live-verified `GET /%00` LAN-server DoS) — all
  fixed. Desktop mouse path proven unchanged. **246 tests** (+40 this day).
  Still needs a real-device pass (gesture thresholds, iOS audio, FIT feel).
- **Scene / menu backdrop layer — art GENERATED and live (2026-07-03).**
  `src/ui/SceneBackdrop.ts` + `docs/scene-art.md` (the 11-asset stage-art
  contract) + `gen-scene-art.ts`: every scene renders a real
  `scene-<key>.png` under a per-scene dim, else its exact current gradient.
  All **11 assets are on disk** (`public/assets/art/scenes/`, in the
  manifest) and verified rendering in every scene, including the card-back
  and pack-art bakes (crimps re-stamped over the real art).
  QA'd against the §2 luminance caps; `scene-collection` and
  `scene-showcase` were rerolled once for safe-zone hotspots, and two dims
  were raised from their starting points (mainmenu 0.35→0.50, collection
  0.60→0.70 — rationale inline in the §3 table and scene comments). Still
  wants a human by-eye pass in the running game (duel 10px labels, card-back
  gold brightness next to face-up cards, pack wrapper readability).
- **Duel board legibility redesign + card zoom** — shipped through an
  adversarial review that surfaced and fixed **9 findings** (right-button
  input gating, guard/listener lifetimes, occlusion and mid-dwell teardown
  traps). `src/scenes/DuelScene.ts` was restructured into horizontal zone
  bands (opponent HUD strip / opponent lands + creatures / gold phase seam /
  your creatures + lands / hand) with per-player HUD plates, carried by three
  new ui components: `src/ui/BoardCardView.ts` (compact battlefield tiles —
  cover-cropped art, name strip, color-coded effective-P/T badge, ✦ aura
  badges, tap rotation, highlight states; global enchantments/artifacts now
  have board presence for the first time), `src/ui/LandStackView.ts` (per-type land piles
  from cached thumbs with untapped/total badges and tap state), and
  `src/ui/CardZoomPreview.ts` (reusable 400 ms hover-dwell docked preview;
  Z skips the dwell). Right-click gives an instant full inspect modal on any
  card; the hand got clip-proof dynamic spacing/scaling, hover lift, and
  castable-now gold dots from `legalActions`, with WUBRG available-mana pips
  alongside. Details: docs/architecture.md ("The duel board" subsection).
- **Art run: 7 → 91 of 152 on disk, then paused on auth.** The full run
  progressed Shu 22/22, Wei 22/24, Wu 21/23, Beastkin 19/25 on top of the 7
  Greek pilots, then **paused on an imagegen auth failure**: four concurrent
  lanes raced the CLI's OAuth token refresh at expiry and invalidated the
  credential — **concurrency across a token refresh is a documented no-go**;
  the remaining ~61 images resume serially after user re-auth. Tooling
  hardening in `scripts/gen-card-art.ts`: raw-original reuse on rerun (no
  double quota spend; `--force` always regenerates), temp+rename PNG writes,
  a Pillow preflight, a 3-consecutive-failure abort, a win32 fail-fast for
  the PATH fallback, `--show-prompt`, and a **recalibrated composition
  prefix** — top-THIRD headroom plus an explicit "(even for seated or
  enthroned poses)" clause, because the cel style put seated-pose eyes at
  y≈140–175 under the old top-quarter wording. QA lessons: zero CJK-text
  incidents in the 65 Three Kingdoms images; ~1-in-22 gender drift; commons
  over-render backgrounds past the two-value spec. Two art-bible QA fixes:
  `tok-peacock`'s palette corrected to match the shipped Hera blue-green,
  `bk-batkin-duskwing`'s pose reworded from an inverted hang that failed the
  safe zone twice.

## Recently shipped (2026-07-02)

- **Generative ambient music.** `src/audio/musicPatterns.ts` — the pure,
  headless-testable pattern core (a seeded Markov chord walk over diatonic
  triads that always excludes the previous two degrees, nearest-neighbor
  voice leading, sparse chord-tone plucks; unit-tested in
  `tests/audio/musicPatterns.test.ts`) — plus `src/audio/music.ts`
  (`MusicDirector` / the `Music` singleton: a 300 ms scheduler with 2.8 s
  lookahead, per-chord fade nodes, crossfading mood swaps, `Music.duck()`
  under the win/loss stings, and a ~0.3 sub-gain under the SFX master via the
  new `AudioManager.bus` getter). Four moods: menu (C-major calm), duel
  (A-minor tenser), gauntlet (D-dorian mysterious), shop (light — also
  PackOpening/Collection/DeckBuilder). A ♪ toggle on the MainMenu
  `VolumeControl` (widget since replaced by `SettingsScene`, 2026-07-04)
  persists as `SaveData.settings.musicOn` — **`SaveData` was
  bumped to v3** (v5 as of 2026-07-04), with a stepwise `migrate()` (`src/meta/SaveManager.ts`;
  migration tests in `tests/meta/`). By-ear tuning of the `MOODS` table is
  the remaining open item (see Planned).
- **MediumAI trick respect is now evidence-gated** (`MediumAI.trickBuff`;
  `HardAI.openManaBuff` shares the gate for Hard's combat baselines): the
  +2/+2 open-mana trick buff fires only after the opponent has **shown ≥ 1
  charm this game** (public graveyard — honest info only). This resolved
  the "Medium only ~57% over Easy on real starters" anomaly: the difficulty
  round-robin on Crimson/Wild now reads **Medium over Easy 68%/68%** (60
  seeds/cell; the residual vs the 82.5% TEST_DB gate is structural — Crimson
  Muster has zero charms, so Medium's interaction edges have nothing to act
  on). Knock-on fixes: Wild Communion (the only zero-charm starter) lost
  its phantom open-mana respect and its mirror row collapsed — fixed with a
  3-card swap (−2 gk-nike, −1 bk-bunny-vanguard, +3 in-wild-surge); the
  avatar ladder was re-measured (40 seeds/cell, rung avgs
  31/21/31 | 46/59/57 | 72/73 — all bands green). Hard vs Medium moved
  77.5% → **78.0%**. Full measurement history + matrices live in
  `src/data/opponents.ts` (baseline comment) and `src/ai/MediumAI.ts`
  (change-site comment).
- **Art program started — tooling + a 7-card Greek pilot.**
  `scripts/gen-card-art.ts` (`npm run gen-card-art`) parses the art-bible
  Prompt lines, generates at 1024×1536 via the chatgpt-imagegen CLI, and
  center cover-crops to the exact 640×800 deliverable with Pillow —
  idempotent skip-existing, raw-original reuse, temp+rename writes, a Pillow
  preflight, and a 3-consecutive-failure abort. A composition prefix
  ("waist-up, face at exact vertical center, top quarter background-only")
  is injected because unprefixed generations put faces above the card crop's
  visible band. The 7 Greek pilot PNGs are live (see Status snapshot);
  ~93 s/image measured; 145 entries remain — the full-run go/no-go is with
  the user.
- **Hard-AI gate met and exceeded — 78.0% vs Medium** (200-seed suite,
  measured 2026-07-02; the old plan gate was 60%, the CI floor is now **0.70**
  in `tests/ai/winrate.test.ts`). The win came from **search, not opponent
  modeling**: a greedy hill-climb block search (unblock / add / gang-up / move
  from Medium's plan, +1.5 sim-score margin), a score-margin response search,
  and multi-world score aggregation on top of the existing full-turn attack
  lookahead (`src/ai/HardAI.ts`) — plus one critical fix: HardAI's internal
  Medium brains must be built on `simDb(db)`, because raw-db brains threw on
  the `__unknown_*` stand-ins and silently collapsed every lookahead world to
  `-Infinity`. Honest history: 53% → 62.5% (block/response search) → 77.5%
  (simDb fix) → 78.0% (the trick-respect evidence gate above). Richer
  hidden-card opponent models (land/cost-curve priors,
  always-held removal/tricks, multi-world hand sampling) were **measured as
  losses**; the negative results are documented in `src/ai/determinize.ts`.
- **Balance-matrix harness + gauntlet retune.** `scripts/balance-matrix.ts`
  (`npm run balance-matrix`) produces `--avatars` / `--starters` /
  `--difficulty` win-rate matrices with fully deterministic per-cell seeds and
  guidance-band FLAGS; the skipped suite `tests/ai/balance.test.ts` shares the
  same code path. The retuned gauntlet baseline of that pass (40 seeds/cell,
  avatar win% averaged over the 5 starters) was R1 35%, R2 28%, R3 35%,
  R4 55%, R5 57%, R6 52%, R7 69%, R8 73% — all bands green — and has since
  been superseded by the post-trick-gate re-measure above; the current
  date-stamped matrix lives in `src/data/opponents.ts`. The two old soft
  spots are fixed: Sima Yi
  38%→52% avg (passivity moderated, still a plotter) and Meng Huo's worst
  starter cell 65%→48%.
- **Starter-deck expansion: 2 → 5 precons** (`src/data/starterDecks.ts`),
  drawing on the full 210-card pool: Crimson Muster (R/W aggro), Wild
  Communion (G/W creatures), **Burning Tides** (U/R Wu tempo-burn), **Shadow
  Mandate** (U/B Jin control), **Grave Harvest** (B/G deathblade attrition).
  Legality + termination tests in `tests/data/starterDecks.test.ts`; the
  MainMenu starter picker was relaid out for five.
- **Audio layer.** Procedural WebAudio SFX — pure-data recipes
  (`src/audio/recipes.ts`, 15 cues), a gesture-gated `AudioManager` (autoplay
  policy respected, retrigger dedupe, headless no-op), and the `Sfx` singleton
  (`src/audio/sfx.ts`) wired into all scenes (cast/land/attack/hit/death/
  lifeLoss/win/loss/coin/flip/shimmer/rungClear/click/hover). A
  `VolumeControl` widget on the MainMenu (since replaced by `SettingsScene`,
  2026-07-04) drives `SaveData.settings.volume`,
  which is now actually consumed and persisted. Phaser's own sound system is
  off (`audio: { noAudio: true }` in `src/main.ts`).
- **Collection / DeckBuilder thumbnail cache.** `src/ui/CardThumbCache.ts`
  bakes each card once into a global `DynamicTexture` and hands the grids
  single Images (~270 → ~18 live objects per Collection page). Inspect
  overlays still build live `CardView`s with full FX.
- **Docs upkeep scripts.** `scripts/check-docs.ts` (anti-rot mtime warner over
  every doc's `source-of-truth` header; `--strict` exits 1),
  `scripts/check-art-bible.ts` (152-entry coverage / field / Card-facts
  checker) and `scripts/gen-docs-tables.ts` (regenerates the three
  `GENERATED` blocks in rules.md / adding-cards.md / architecture.md;
  `--check` mode for CI). npm scripts: `check-docs`, `check-art-bible`,
  `gen-docs-tables`.
- **Earlier the same day:** `CardView` input-bug fixes (invisible child `Zone`
  hit areas, `ModalGuard` overlays) and the **AI Avatar Gauntlet** itself —
  10 themed opponents with personality knobs (`src/ai/personality.ts`,
  `src/data/opponents.ts`), ladder rewards, `GauntletScene`, and **`SaveData`
  v2** with a real v1→v2 migration (since bumped to v3 by the music toggle —
  see above).

## Planned
- **The 1.1 Limited economy TUNING pass — ✅ SHIPPED 2026-07-16** (see
  Recently shipped; the full measured record lives in
  [plan-economy-testing.md](plan-economy-testing.md)'s tuning-pass note).
  With it, **the 1.1 release ladder's engineering is complete** — what
  remains for the 1.1 cut is release mechanics (version bump + tag, doc
  sweep) plus the standing carry-over validation passes below. The quest
  claim-rate spread (41–89% by deck/style) stays explicitly OUT of the
  pass (quest-pool fairness, its own item).
- **Full Art variant — a 4th booster axis (decided 2026-07-13).** Locked
  user picks: an INDEPENDENT per-slot roll at **0.25%** (rarer than Black
  frame / Void holo at 0.45% each; ~1 pull per 45 packs) that **stacks**
  with the frame and holo axes; shard multiplier **×25** (above the ×15
  Black ceiling; a full-art UR shards for 12,500g). Rendering: the
  existing 640×800 art cover-fits the whole 300×420 frame (no new art
  assets — the deliverable is taller than the frame's aspect), with the
  name/type/rules bands re-rendered as translucent faded plates in their
  usual positions. Implementation requirements: `CardVariant` gains the
  axis (variant-key format change ⇒ `SaveData.version` bump + real
  `migrate()` + test; old keys parse as non-full-art), `variantRank`
  places full art above black frame, the never-auto-melt special rule
  includes it, `DROPS` gains the table (odds drawer derives
  automatically), and the drop math gets a fresh Monte-Carlo
  verification. **Stage 1 (the render mode) SHIPPED 2026-07-13 in PR
  #73**: `CardView.setCard({ fullArt: true })` — no lore line, WCAG-floor
  faded plates, text layered above holo, bottom-anchored content-sized
  rules plate with the type band seated on it, vanilla cards render pure
  art; preview via the Card Showcase FULL ART toggle. Remaining work is
  the axis wiring above (variants/DROPS/save/economy) plus routing
  `variant.fullArt` into the shipped render flag, and a Full Art toggle
  on the card proof sheet for catalog-wide QA. **Stage 2 (the axis)
  SHIPPED 2026-07-17 on the PR #85 branch**: `CardVariant.fullArt` with
  the three-segment variant key (SaveData v20 → v21, real migrate() +
  tests; old two-segment keys parse as non-full-art), the 0.25% DROPS
  table + Monte-Carlo verification, ×25 shard multiplier, rank above
  black frame, never-auto-melt, the flag routed through collection /
  pack reveal / duel previews / showcase / draft inspection, the odds
  modal's FULL ART section, and the cardproof toggle. **Premium Draft
  packs exclude the axis permanently** (pinned by test): including it
  measured the premium shard-farm EV at 1,096.5g per 1,000g entry
  across the 10 fixed gate seeds, re-opening the exploit the 1.1
  economy pass closed; with the exclusion the gate passes at 966.5g
  mean. Full Art is a booster-only pull.
- **"Mark" counter retheme (decided 2026-07-13).** Player-facing copy
  only, same treatment as the Sever/Foresee retheme: "+1/+1 counter"
  becomes "+1/+1 mark" in generated rules text, glossary, rules.md, and
  any log/recap copy; engine op ids (`addCounters`) unchanged;
  [keyword-map.md](keyword-map.md) documents the MTG mapping. The
  counterspell verb collision was already solved ("cancel"). Unblocked
  as of 2026-07-13 (the card-data work it queued behind has landed);
  ready to implement any time.
- **Basic-land art variants — wiring decision pending (user).** Thirty
  themed variants (5 basics × base/Ragnarök/Celtic-Fae × 2, all QA'd)
  sit in the out-of-repo art vault; prompts and staging are recorded in
  [land-art.md §3](land-art.md). The game supports one art file per land
  id, so shipping them needs one of: **(A) per-set basic-land card ids**
  (e.g. `rg-forest`) — real catalog entries sharing rules text, giving
  lands collectible/booster presence but touching catalog, drops, deck-
  builder basics UI, and deck codes; or **(B) an art-variant axis on the
  existing five ids** — cosmetic-only, fits the established variant
  system (or a lighter per-deck "land style" selector), no catalog
  surface. B is the smaller, save-schema-bounded change; A makes lands a
  collectible product. **Decided 2026-07-17: a deck-builder land-style
  selector (B-lite) — cosmetic only, not collectible; scheduled into 1.3
  ([plan-1.3.md](plan-1.3.md) Pillar 2).**
- **Core design-system alignment.** The shipped theme foundation is now
  formalized in [design-system.md](design-system.md); the repository-wide audit
  and dependency-ordered implementation program live in
  [plan-design-system-alignment.md](plan-design-system-alignment.md). No P0
  defect was found. The first required work is shared title-safe/control/modal
  geometry, followed by bounded non-Duel collision fixes and surgical Duel
  alignment waves. Existing gameplay geometry, specialist card/material
  palettes, engine behavior, and current user-owned Deck Builder work remain
  protected by the plan's explicit boundaries.
- **UI/UX refresh (greenlit 2026-07-09, in progress).** User-directed: the UI
  "feels dated and clunky, especially the play field."
  [plan-ui-ux-refresh.md](plan-ui-ux-refresh.md) is the spec, grounded in
  2026-07-09 audits of DuelScene and the cross-scene design system. Locked
  picks: modernize the Immersive Fan in place, refined-current art direction,
  larger battlefield tiles. Four waves: theme token module + factories →
  play-field motion/depth → play-field hierarchy + tile growth → all-scene
  theme migration (which closes the QOL Settings-toggles follow-up below).
  Status: ✅ **ALL WAVES SHIPPED 2026-07-10** (PRs #40–#45, Wave 2
  tiles/modal-shell, Wave 3's four scene-migration batches, plus two
  post-wave duel-feedback rounds — pile icon columns, zone-contents
  modals, clickable mana strips, artifact/enchantment bands, in-portrait
  life squares; execution record in
  [plan-ui-refresh-wave2-wave3-impl.md](plan-ui-refresh-wave2-wave3-impl.md)).
  The Settings toggles closed the last QOL follow-up below.
- **The 1.1 program (scoped 2026-07-10; RE-SCOPED 2026-07-14).**
  [plan-1.1.md](plan-1.1.md) is the spec — see its re-scope note. The release
  ladder now reads: **1.1** = Celtic Fae (✅ shipped) + the public persona
  Draft (✅ shipped 2026-07-14) + the Limited **economy sim/tuning pass**
  (✅ shipped 2026-07-16 — 1.1's engineering is complete);
  **1.2** = practice opponent picker + deterministic replays + Limited
  run-history achievement hooks + the Arthurian Court expansion (folded
  into 1.2 by user decision 2026-07-16) — **✅ 1.2 RELEASED 2026-07-17**
  (engineering shipped 2026-07-16, PR #85 + the v1.2.0 cut closed it
  out 2026-07-17 — see Recently shipped · the 1.2 close-out); the
  standing validation passes remain;
  **1.3** = the **Gothic Monsters: Nocturne Manor** expansion (80 cards,
  Menace + Kicker engine mechanics, rungs 15-16 — concept in
  [expansions/gothic-monsters.md](expansions/gothic-monsters.md), needs
  the AC-style concretion pass; added by user decision 2026-07-17),
  the seeded daily tower rotation (full-shuffle roster with
  floor-scaled AI tiers, plus its balance re-baseline, measured once
  AFTER the set lands), the deck-builder land-style selector, and the
  "Hardcore MTG Fan" balance personas — user decisions 2026-07-17,
  spec in [plan-1.3.md](plan-1.3.md);
  **1.5** = Commander mode, renamed **"Darlings"**;
  **2.0** = MOD/UGC packs. **Sealed is cancelled outright** (2026-07-14) —
  the hub offers only Draft; its dormant code is cleanup-eligible.
  **Placements locked (2026-07-14 handoff):** the base-facet relabel shipped
  in 1.1 as **"Core Set"** (see Recently shipped); **mixed-set packs are the
  decided, shipped Limited set choice** (single-set drafts shelved
  unscheduled); **Limited run-history achievement goals land in 1.2** with
  the practice opponent picker.
- **Limited public release (partially live as of 2026-07-14).**
  **The Bot Draft half is now public**: re-implemented around 20 AI draft
  personas and reachable via the Play submenu (user decision 2026-07-14 —
  see Recently shipped; supersedes the PR #54 hide for draft). **Sealed was
  removed from the hub UI entirely** (user decision later the same day; the
  meta core/reveal scene/tests remain in the codebase, unoffered — restoring
  it is one button plus its polish pass). Remaining blockers, now partially
  player-facing:
  Limited balance/economy (auto-build texture via the balance harness,
  run-reward tuning — draft runs are free to enter and pay
  `limitedRunGold` on completion) and the Sealed polish pass. Blocker
  detail: [plan-v1.1-post-launch.md](plan-v1.1-post-launch.md).
- **Design plans authored 2026-07-05.** Four senior-level design docs, each
  grounded in the current code and respecting the iron invariants —
  **Commander mode and MOD/UGC were greenlit into the 1.1 program
  2026-07-10** (see above); the keyword-retheme and road-to-1.0 plans have
  shipped:
  - [Commander mode + 8 themed decks](plan-commander-mode.md) — a
    Darling-Blades EDH-lite format (singleton, one legendary commander) layered
    into `src/data`/`src/meta`/`src/scenes` with no engine change.
  - [MOD / UGC packs](plan-mod-ugc.md) — data-only custom cards (art/name/stats)
    with a validator that enforces **no new mechanics** (whitelist against the
    engine's `Keyword`/effect-op unions), namespaced ids, browser + Tauri loaders.
  - [MTG-keyword rethemes](plan-keyword-rethemes.md) — ✅ **superseded and
    shipped 2026-07-07**: the display-only proposal was upgraded per user
    direction to the Tier-3 full engine rename in
    [plan-de-mtg-rethemes.md](plan-de-mtg-rethemes.md), which landed as PR #14
    (see Recently shipped 2026-07-07). Its keyword name-table was reused
    verbatim.
  - [Road to 1.0 — five features](plan-road-to-1.0.md) — tutorial (✅ **shipped
    2026-07-08**, PR #28 — see Recently shipped), achievements + collection
    goals, daily quests, Sealed / Bot Draft Limited, and deck share codes
    (✅ **all shipped 2026-07-08**). Deterministic replays are no longer a 1.0
    gate and are deferred to 1.1/1.2.
- **Quality-of-life pass (15 features).** ✅ **Shipped 2026-07-06** — see Recently
  shipped and [docs/plan-qol.md](plan-qol.md). Follow-up status: F13 remove-all,
  F9 inspect glossary, deck-builder filtering/sorting, pack-opening inspect/new
  markers, and Gauntlet recap are now shipped. The remaining QOL follow-up is
  exposing in-Settings toggles for `confirmDestructive` + `keywordReminders`
  (needs a wider Settings relayout).
- **Mobile Tier 2 — LAN PvP (back-burnered).** Tier 1 phone-over-LAN play
  SHIPPED 2026-07-03 (see Recently shipped); the tiered design doc is
  [docs/mobile-lan-plan.md](mobile-lan-plan.md). What remains of the plan:
  Tier 2 host-authoritative LAN PvP over the engine's existing
  seat-checked/redacted-view seam and the Tier 3 stretch items — both
  deliberately deferred — plus the Tier-1 **real-device pass** (gesture
  thresholds, iOS audio, FIT feel).
- **A by-ear / by-eye polish pass.** The ambient-music `MOODS` table
  (`src/audio/musicPatterns.ts`) still needs an iterative-listening pass, and
  the perceptual list grew with the 2026-07-04 features: SFX loudness balance
  across the 15 recipes, pack-opening cascade + tier-escalation choreography,
  the six holo finishes and frame tints by eye (the Showcase scene is the QA
  surface), binder badge legibility over the backdrop art, render-scale at
  k=2 on a real hiDPI display, and auto-skip notice pacing in real play.
  This is the known WebGL-/audio-headless limitation: tests assert
  structure, not how things look and sound in a real browser.
- **Informational balance notes** (measured, in-band, no action planned):
  - The starter mirror matrix (`npm run balance-matrix -- --starters`) shows
    mild rock-paper-scissors texture — Burning Tides and Grave Harvest have
    strong rows (~55% avg on the pre-trick-gate measure; re-measured after
    the Wild Communion swap — current notes in the `src/data/opponents.ts`
    baseline comment). Within the 25/75 informational flags; accepted as
    precon spice.
  - The difficulty round-robin on real starters
    (`npm run balance-matrix -- --difficulty`) — the old "Medium only ~57%
    over Easy" anomaly is **resolved** by the trick-respect evidence gate
    (see Recently shipped): Medium over Easy is now 68%/68% on Crimson/Wild
    (60 seeds/cell; full numbers in the `src/data/opponents.ts` baseline
    comment). The residual gap vs the 82.5% TEST_DB gate is structural —
    Crimson Muster runs zero charms, so Medium's interaction edges have
    nothing to act on there. No further action planned.
