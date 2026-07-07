<!-- source-of-truth: tests/, scripts/, scripts/gen-card-art.ts, src/data/catalog.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/data/art-manifest.json, src/meta/SaveManager.ts, src/ai/HardAI.ts, src/ai/MediumAI.ts, src/ai/determinize.ts, src/audio/, src/audio/music.ts, src/audio/musicPatterns.ts, src/ui/CardThumbCache.ts, src/ui/SceneBackdrop.ts, src/platform/, tests/ai/winrate.test.ts, docs/art-bible/, docs/mobile-lan-plan.md, docs/scene-art.md, src/meta/DeckStorage.ts, src/meta/profileStats.ts, src/ui/deckStats.ts, src/ui/SearchInput.ts · last-verified: 2026-07-07 · review monthly -->

# Roadmap

_Dated 2026-07-04. Review monthly._

## Status snapshot

- **The game is named _Darling Blades_** (renamed from "WaifuTCG" 2026-07-03).
  The rename swept all display text/docs/package name (`darling-blades`)/launch
  configs; the save key moved to `darlingblades.save.v1` with a one-time read
  of the legacy `waifutcg.save.v1` key so existing saves survive. The on-disk
  repo folder is still `WaifuTCG` (deliberately not renamed — path stability).
- **Playable end-to-end.** Menu → starter pick → **Avatar Gauntlet** (8 themed
  opponents on a ladder) or Practice duels → rewards → shop → pack opening →
  collection → deck builder, all wired, with procedural SFX + ambient music.
- **Feature- and art-complete for desktop + phone-over-LAN (Tier 1).** **Every
  one of the 210 pool cards now has a real illustration** — 147 creatures +
  15 lands + 43 spells — plus 5 tokens, 210 half-res variants, and 11
  scene/menu backdrops, all on disk and in `src/data/art-manifest.json`,
  rendering in-game (lands are landscapes via `gen-land-art`, spells are
  effect scenes via `gen-spell-art`; see art-pipeline.md). What remains is
  human polish: a real-device pass (gesture feel, iOS audio) and a
  by-ear/by-eye pass (music `MOODS`, holo FX, a few small labels).
- **491 tests green** (+3 skipped balance-tool assertions) across 48 files
  (engine, combat, keywords, mana, RNG, determinism, stack/effects, catalog
  integrity, meta + gauntlet/save-migrations + variants/drop-distribution +
  collection filters + deck-face picker + gauntlet-run-seed + shard/per-variant
  playset, audio recipes + music patterns, platform gestures + render-scale +
  anim policy, engine auto-pass, icon paths, hand-fan + combat-sequence layout/
  timing math, AI smoke + win-rate + personality lockstep/divergence +
  avatar/starter legality; and the QOL pass — unplayable-reason, card-search
  filter, keyword-reminder coverage, undo snapshot/restore round-trip, combat
  forecast (`previewCombat`), deck-stats aggregation, profile win-rate,
  deck-storage ops). The whole suite runs in ~25–30 s.
- **210 cards** in the pool (`CARD_DB`), across the five colors and three
  factions, bucketed into **five rarity tiers** (C 103 / R 65 / SR 13 /
  SSR 11 / UR 8 booster-eligible).
- **5 starter precons** (`src/data/starterDecks.ts`) covering all five colors,
  each color in exactly two lists.
- **Audio complete in structure**: a procedural WebAudio SFX layer
  (`src/audio/`, 14 recipes) wired into every scene with persisted volume +
  SFX toggle, plus **generative ambient music** (`src/audio/musicPatterns.ts`
  + `src/audio/music.ts`, four moods, a persisted toggle) — all driven from
  the `SettingsScene`. `SaveData` is **v9** (v6→v7 confirm-destructive, v7→v8
  keyword-reminders, v8→v9 shop restructure — see Recently shipped). By-ear
  tuning remains open (see Planned).

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
    `confirmDestructive` + `keywordReminders` (the full 5-row panel needs a
    2-column relayout to fit them), F13 per-row remove-all, and F9's separate
    inspect-overlay glossary legend.
- **UX-polish pass — three waves (PRs #7 / #8 / #9).** Follow-on presentation +
  shop work on top of the QOL pass. **Wave A (#7):** mulligan cap hard-lock fix,
  owned-cards default filter, dev-gated card showcase, on-screen version label.
  **Wave C (#8):** card-face mirror layout, playmat battlefield-tile redesign,
  dropdown filters. **Wave B — shop restructure (#9):** Boosters / Decks tabs,
  a drop-rate % drawer, a buyable deck store with preview, and a unique generated
  Valkyrie hero portrait — the **v8 → v9** `SaveData` bump.

## Recently shipped (2026-07-05)

- **1st expansion: "Ragnarök" (69 collectible cards — set `ragnarok`, prefix
  `rg-` — plus 3 tokens, which stay in the `base` set).** A Norse headline faction (Valkyries, Norns, Jotun, Draugr, the
  death-goddess Hel) with a graveyard soul, plus "deepening" cards that give the
  existing worlds their own returning dead (Shu/Wei double-strike duelists, a Greek
  underworld shade). Three new mechanics: the **`twinBlades`** keyword (two edits
  in `combat/damage.ts` — every interaction falls out of the existing two-step
  damage), and the **`mill`** + **`reanimate`** EffectOps birthing a true
  graveyard/reanimator archetype the base set lacked. All pure data in
  `src/data/cards/ragnarok.ts`, tagged by a new `CardDef.set` field stamped in
  `catalog.buildDb` (existing 200 default to `'base'`; no `SaveData` bump —
  `collection`/`decks` are id-keyed). Ships with: a **set filter** in the binder, a
  **Ragnarök booster** SKU (set-scoped `packPool`/`openPack`; the shop shows two
  packs), a buyable **precon** ("Valhalla's Muster", B/G reanimator, via
  `Economy.buyThemeDeck` + the previously-unused `preconPrice`), and **two new
  gauntlet bosses at rungs 9-10** — Hel (U/B mill-reanimator, 71%) and Brunhild
  (R/W Valkyrie double-strike, 88% — the summit wall), with `gauntletRungGold`
  extended to 10 rungs and GauntletScene de-hardcoded off `8`. Balance measured
  2026-07-05 (40 seeds, no flags); win-rate gates untouched (they run on
  `TEST_DB`). Art-bible entries generated by `scripts/gen-ragnarok-artbible.ts`
  (Card-facts computed from the data → checker-clean); Ragnarök card art first
  shipped as procedural placeholders on 2026-07-05, then real illustrations via
  the `gen-card-art --faction ragnarok` run — all 69 `rg-` PNGs now on disk
  (2026-07-06). Added
  engine specs (doublestrike/mill/reanimate) + meta coverage (set filter, ragnarok
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
  creatures that are **summoning-sick** (entered this turn, no haste — the engine's
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
  and pack-art bakes (crimps + wordmark re-stamped over the real art).
  QA'd against the §2 luminance caps; `scene-collection` and
  `scene-showcase` were rerolled once for safe-zone hotspots, and two dims
  were raised from their starting points (mainmenu 0.35→0.50, collection
  0.60→0.70 — rationale inline in the §3 table and scene comments). Still
  wants a human by-eye pass in the running game (duel 10px labels, card-back
  gold brightness next to face-up cards, pack wordmark over the nebula).
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
  instant this game** (public graveyard — honest info only). This resolved
  the "Medium only ~57% over Easy on real starters" anomaly: the difficulty
  round-robin on Crimson/Wild now reads **Medium over Easy 68%/68%** (60
  seeds/cell; the residual vs the 82.5% TEST_DB gate is structural — Crimson
  Muster has zero instants, so Medium's interaction edges have nothing to act
  on). Knock-on fixes: Wild Communion (the only zero-instant starter) lost
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
  (`src/audio/recipes.ts`, 14 cues), a gesture-gated `AudioManager` (autoplay
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
  8 themed opponents with personality knobs (`src/ai/personality.ts`,
  `src/data/opponents.ts`), ladder rewards, `GauntletScene`, and **`SaveData`
  v2** with a real v1→v2 migration (since bumped to v3 by the music toggle —
  see above).

## Planned
- **Design plans authored 2026-07-05 (awaiting build go/no-go).** Four
  senior-level design docs are ready to implement, each grounded in the current
  code and respecting the iron invariants:
  - [Commander mode + 8 themed decks](plan-commander-mode.md) — a
    Darling-Blades EDH-lite format (singleton, one legendary commander) layered
    into `src/data`/`src/meta`/`src/scenes` with no engine change.
  - [MOD / UGC packs](plan-mod-ugc.md) — data-only custom cards (art/name/stats)
    with a validator that enforces **no new mechanics** (whitelist against the
    engine's `Keyword`/effect-op unions), namespaced ids, browser + Tauri loaders.
  - [MTG-keyword rethemes](plan-keyword-rethemes.md) — a display-only rename of
    the 10 evergreen keywords to a Darling-Blades voice, confined to
    `rulesText.ts` (engine ids, saves, AI, determinism all untouched).
  - [Road to 1.0 — five features](plan-road-to-1.0.md) — tutorial, daily quests,
    sealed/draft, deterministic replays + share codes, achievements — sequenced,
    with a definition of 1.0.
- **Quality-of-life pass (15 features).** ✅ **Shipped 2026-07-06** — see Recently
  shipped and [docs/plan-qol.md](plan-qol.md). Only the deferred follow-ups remain:
  in-Settings toggles for `confirmDestructive` + `keywordReminders` (needs a 2-column
  Settings relayout), F13 per-row remove-all, and F9's separate inspect glossary.
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
  across the 14 recipes, pack-opening cascade + tier-escalation choreography,
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
    Crimson Muster runs zero instants, so Medium's interaction edges have
    nothing to act on there. No further action planned.
