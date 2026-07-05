<!-- source-of-truth: src/config/rules.ts, src/data/starterDecks.ts, src/data/opponents.ts, src/data/cards/greek.ts, src/data/cards/tk-wei.ts, src/data/cards/tk-wu.ts, src/data/cards/tk-shu.ts, src/data/cards/tk-jin.ts, src/data/cards/tk-other.ts, src/data/cards/beastkin.ts, src/data/cards/instants.ts, src/data/cards/sorceries.ts, src/data/cards/enchantments.ts, src/data/cards/duals.ts, src/meta/deckFace.ts, src/meta/SaveManager.ts, src/meta/DeckStorage.ts, src/ui/CommanderPortrait.ts, src/scenes/DuelScene.ts, src/ai/personality.ts · last-verified: 2026-07-05 · design/plan doc — re-verify when the referenced code changes -->

# Commander Mode — a Darling-Blades EDH format

A single-player "Commander" mode: the player picks a **legendary creature as their
commander**, plays a purpose-built themed deck led by that legend, and duels a
roster of 8 rival commander decks. This adapts MTG Commander/EDH to Darling
Blades' 210-card pool, its LIFO stack, and its headless deterministic engine —
choosing format numbers that fit *this* pool rather than importing paper Magic's
100-singleton/40-life shape wholesale. This plan defines the format, ships 8
distinct themed decks as pure data, wires a mode entry through the existing
duel/gauntlet plumbing, and handles the `SaveData` schema bump.

## Why a raw EDH port does not fit

Paper Commander is **100-card singleton, 40 life, a command zone, commander tax,
and color-identity deckbuilding**. Three of those collide with this codebase:

1. **Pool size.** The collectible pool is 210 cards across 5 colors + 3 faction
   groups (roadmap.md: "C 103 / R 65 / SR 13 / SSR 11 / UR 8 booster-eligible").
   A 100-card *singleton* deck in a single color identity would drain most of a
   color's playable creatures and every relevant spell — there simply are not 99
   distinct on-color nonland cards for, say, mono-U. A 60-card frame keeps the
   existing `RULES.deckSize` and leaves real deckbuilding choices.
2. **The command zone + commander tax** assume a zone the engine does not model.
   `src/engine/` has hand / library / battlefield / graveyard / stack; there is
   **no command zone**, no "cast from outside the game," and no per-cast cost
   escalation. Adding one touches the pure engine (an iron invariant surface),
   its determinism, save/serialization, and the AI's `PlayerView`. That is a
   large, risky change for a single-player mode.
3. **40 life + Commander damage** presume multiplayer politics. In 1v1 at 20
   life the format already plays like "high-power Constructed with a guaranteed
   marquee legend," which is exactly the fantasy we want.

**Decision (proposed): "Commander-lite."** Keep the engine untouched. Commander
Mode is a *deckbuilding format + a curated opponent roster + a UI mode*, layered
entirely in `src/data` / `src/meta` / `src/scenes`, exactly like the Avatar
Gauntlet is today. The commander is the deck's chosen legend, rendered in the
already-built `CommanderPortrait` — no new engine concept required.

## The format, concretely

A Commander Mode deck is validated by a **new pure function**
`validateCommanderDeck` (beside `validateDeck` in `src/meta/DeckStorage.ts`),
enforcing:

| Rule | Value | Rationale |
| --- | --- | --- |
| Deck size | **60** (`RULES.deckSize`) | Reuse the engine + existing validators unchanged. |
| Commander | **1 named legendary creature**, present as a real card in the 60 | It is drawn/cast like any card (no command zone); the legend rule already protects duplicates. |
| Singleton (non-basic, non-commander) | **max 1 copy** | The EDH texture — highlander variety — without needing 100 slots. Tighter than `RULES.maxCopies` (4). |
| Basics | unlimited | As today (`validateDeck` already exempts basics; see `isBasic`). |
| Color identity | deck cards' `colors` ⊆ commander's `colors` (+ colorless) | Keyed to the WUBRG pie already on every `CardDef`. |
| Life | **20** (`RULES.startingLife`) | Engine constant; unchanged. |

**Color identity check.** Every `CardDef` already carries `colors: Color[]`
(`W`/`U`/`B`/`R`/`G`). The commander's `colors` define the identity; a card is
legal iff every color in its `colors` is in the commander's set (colorless cards
and basics always legal, dual taplands have `colors: []` so they are always
legal — see `src/data/cards/duals.ts`). This is a pure array-subset test, no new
data on cards. Note the existing catalog rule "multicolor nonland ⇒ legendary,"
which is why every 2-color legend below is a legal 2-color commander.

**"Commander tax" substitute (optional, deck-data only).** Rather than an engine
cost-escalation mechanic, each commander deck simply *builds around* its legend
being castable and impactful — ramp, protection, and recursion (`so-raise-dead`,
`so-rampant-growth`) picked in-list. No engine change. If we later want a
mechanical nod, the cleanest engine-pure option is a **starting bonus** (e.g.
the commander begins in hand), togglable in the launch data — but the default
plan is "plays like a legendary you happened to draw."

Nothing in this format requires the engine (`src/engine|ai|data|meta|config`
purity boundary is respected): every rule above is either an existing
`RULES`/`ECONOMY` constant or a new pure validator over `CardDef.colors` /
`supertypes`. The engine stays headless and seeded-deterministic.

## Where the decks live: `src/data/commanderDecks.ts`

A new module beside `starterDecks.ts` and `opponents.ts`, reusing the shared
`expand([id, count])` helper already exported from `starterDecks.ts`:

```ts
// src/data/commanderDecks.ts
import { expand, type DeckList } from './starterDecks';

export interface CommanderDeck extends DeckList {
  commanderId: string;   // a legendary creature id present in `cards`
  colors: Color[];       // color identity (mirrors the commander's colors)
  theme: string;         // e.g. "Wei Aggro-Command"
  blurb: string;         // flavor for the deck-select card
}

export const COMMANDER_DECKS: readonly CommanderDeck[] = [ /* the 8 below */ ];

export function commanderDeckById(id: string): CommanderDeck { /* find-or-throw, mirrors avatarById */ }
```

Because these are `DeckList`-shaped (`id`, `name`, `cards: string[]`), they feed
straight into `new Game({ decks: [...] })` (DuelScene.ts:277) and into
`faceCardFor` for the portrait. A companion **opponent roster** — the 8 decks as
`Avatar`-shaped entries (adding `difficulty`, `personality`, `portraitCardId`)
so the exact `DuelScene` gauntlet plumbing drives them — lives in the same file
or in `opponents.ts` under a new `COMMANDER_AVATARS` export.

The pool is generous enough that each deck below reaches 60 with ~24 lands +
~20–28 singleton nonland spells/creatures + basics padding. Where a color runs
thin on distinct playables, the deck leans on colorless staples
(`ar-terracotta-soldier`, `ar-bronze-colossus`, `ar-imperial-jade-seal`,
`ar-siege-juggernaut`) which are identity-legal everywhere.

## The 8 themed commander decks

All commander ids, signature-card ids, and colors below were read directly from
the card files. Each is distinct in color identity and playstyle.

### 1. Cao Cao — Wei Aggro-Command (W/B)
- **Commander:** `tk-wei-caocao` (Cao Cao, Ambitious Hegemon; 4/4, +1/+0 Wei lord, discards on combat damage).
- **Colors:** W/B. **Theme:** Wei tribal swarm with a hand-attack engine.
- **Signature cards:** `tk-wei-zhangliao`, `tk-wei-dianwei`, `tk-wei-xuhuang`, `tk-wei-caoren`, `tk-wei-xunyu` (second Wei lord, +1/+1), `tk-wei-jiaxu` (ETB discard), `en-banner-of-the-hegemon` (Wei anthem), `ld-shadowed-court` (W/B dual).
- **How it wins:** curve out disciplined Wei bodies, stack two lords + the banner so the team outsizes blockers, and grind the opponent's hand to zero via Cao Cao + `tk-wei-jiaxu` while beating down.

### 2. Sun Quan — Wu Tempo-Burn (U/R)
- **Commander:** `tk-wu-sunquan` (Sun Quan, Emerald-Eyed Sovereign; ETB draw, +0/+1 Wu lord).
- **Colors:** U/R. **Theme:** Wu tribal tempo with reach burn.
- **Signature cards:** `tk-wu-zhouyu` (ETB 2 to face), `tk-wu-sunce`, `tk-wu-ganning` (attack pings), `tk-wu-luxun` (attack-anthem), `tk-wu-lumeng` (Wu lord), `in-fire-attack`, `in-char`, `ld-red-cliffs-anchorage` (U/R dual).
- **How it wins:** apply early pressure with haste admirals, protect the tempo lead with cheap burn/bounce, and close with direct damage (`tk-wu-zhouyu`, `so-lava-axe`) when the board stalls.

### 3. Zhuge Liang — Mono-U Sleeping Dragon Control (U)
- **Commander:** `tk-shu-zhugeliang` (Sleeping Dragon; 2/4, ETB draw 2).
- **Colors:** mono-U. **Theme:** card-advantage control that never trades on tempo.
- **Signature cards:** `gk-poseidon` (5/5 ETB draw), `tk-shu-zhugeliang`'s support `tk-shu-pangtong`/`tk-wei-guojia` (ETB draw), `in-read-the-ruse` + `in-dream-fracture` (counters), `in-undertow` (bounce), `so-strategic-planning` (draw 3), `ar-imperial-jade-seal` (fixing/ramp).
- **How it wins:** counter the opponent's threats, out-draw them with a stack of ETB-draw bodies, and win late with `gk-poseidon`, `tk-jin-zhonghui`, or `ar-bronze-colossus`.

### 4. Zeus — Mono-R Thunder Storm/Burn (R)
- **Commander:** `gk-zeus` (Thunder Empress; 5/5 flyer, ETB 3 to face).
- **Colors:** mono-R. **Theme:** the fastest face-damage deck; every card points at life total.
- **Signature cards:** `tk-other-zhurong`, `tk-wu-huanggai` (dies: 2 to face), `in-char`, `in-fire-attack`, `in-comet-blast` (X burn), `so-lava-axe`, `so-flame-lash`, `so-warcry`.
- **How it wins:** race with hasty red creatures, then convert every remaining card into reach — Zeus's ETB 3 + `in-comet-blast` for X are the finishers. Pure aggro-burn, the polar opposite of deck 3.

### 5. Gaia — G/W Go-Wide Stompz (G/W)
- **Commander:** `gk-gaia` (World-Mother; 6/6 trample, grows each upkeep).
- **Colors:** G/W. **Theme:** ramp into a wide, anthem-buffed green-white board.
- **Signature cards:** `gk-demeter` + `bk-deerkin-grovekeeper` (`rampBasic`), `so-rampant-growth`, `so-muster-militia` / `so-parade-of-heroes` (tokens), `gk-apollo` / `en-olympus-ascendant` (Olympian anthems), `so-stampede-season` / `in-stand-as-one` (team pumps), `ld-peach-garden-orchard` (G/W dual).
- **How it wins:** ramp a turn ahead, flood the board with tokens and beasts, then alpha-strike with a team pump — or just cast Gaia and let a growing 6/6 trampler close.

### 6. Sima Yi — U/B Attrition Control (U/B)
- **Commander:** `tk-jin-simayi` (Patient Shadow; on combat damage: draw + opponent discards).
- **Colors:** U/B. **Theme:** Jin removal-and-hand-disruption grind.
- **Signature cards:** `tk-jin-wangyuanji` (deathtouch, ETB draw), `tk-jin-zhangchunhua` (deathtouch drain), `bk-spiderkin-weaver` (deathtouch wall), `in-doom-bolt`, `in-reapers-due`, `so-night-extortion`, `so-dirge-of-loss`, `ld-moonlit-marsh` (U/B dual).
- **How it wins:** wall the ground behind deathtouch, strip the hand, one-for-one every threat, and inevitably win on cards once the opponent is empty. Sima Yi + `tk-jin-wangyuanji` are the engines.

### 7. Guan Yu — R/W Saint of War Aggro (R/W)
- **Commander:** `tk-shu-guanyu` (Saint of War; 5/4 first strike + vigilance).
- **Colors:** R/W. **Theme:** aggressive R/W "boros" beatdown with combat tricks.
- **Signature cards:** `gk-ares` (4/3 haste), `gk-zeus` (identity-legal R/W bomb), `gk-nike` / `gk-hoplite` (cheap W beaters), `tk-wei-xiahoudun` (first strike), `in-shieldwall` / `in-stand-as-one` (combat tricks), `so-warcry`, `ld-beacon-ridge` (R/W dual).
- **How it wins:** curve of efficient attackers under Guan Yu (a near-unkillable attacker with first strike + vigilance), pushed through with tricks and `so-warcry` haste. Distinct from Zeus's burn — this wins in combat, not off the top.

### 8. Persephone — B/G Underworld Deathtouch Midrange (B/G)
- **Commander:** `gk-persephone` (Queen of Two Courts; 3/3 deathtouch, dies → 2 blooms).
- **Colors:** B/G. **Theme:** Golgari-style deathtouch attrition + recursion, but midrange rather than pure control (contrast deck 6's U/B).
- **Signature cards:** `gk-hades` (5/4 deathtouch, ETB drain), `gk-thanatos`, `bk-lamia-nightblade`, `bk-spiderkin-weaver` (deathtouch package), `so-raise-dead` (recursion), `in-grave-chill` / `in-doom-bolt` (removal), `gk-demeter`/`so-rampant-growth` (ramp), `ld-asphodel-meadow` (B/G dual).
- **How it wins:** trade deathtouch bodies up the curve, recur the best ones, and grind out with Hades/Persephone value. Beats decks 1/5/7 in the mud that decks 2/4 try to race.

**Distinctness matrix:** W/B aggro (1), U/R tempo (2), mono-U control (3),
mono-R burn (4), G/W go-wide (5), U/B control (6), R/W combat-aggro (7), B/G
midrange (8). Eight color identities, four archetype families (aggro / burn /
control / midrange) with no two identical in both axes.

**Two marquee UR legends deliberately not used as commanders** — `tk-shu-liubei`
(W/G) and `bk-... ` etc. — are candidates for a v2 expansion, or become
signature cards inside the on-color decks above (e.g. Liu Bei fits deck 5's
G/W). This is called out under Open questions.

## SaveData / schema impact

Commander Mode needs to remember which decks the player has and which commander
each names. Two options:

- **Option A (minimal, preferred).** Store commander decks in the existing
  `save.decks` array (they are already `{id,name,cards}`), and add **one new
  optional field** `commanderId?: string` to that deck record plus an
  `activeCommanderDeckId: string | null` alongside `activeDeckId`. This is an
  additive schema change → **bump `SaveData.version` 5 → 6** with a real
  `migrate()` step (v5 → v6 spreads `activeCommanderDeckId: null`; existing deck
  records without `commanderId` are left as-is — Constructed decks) and a
  migration test in `tests/meta/`. Per the iron invariant, the version bump ships
  with the migration + test.
- **Option B.** A dedicated `commander: { decks: CommanderDeck[]; activeId: string | null; progress: {...} }` sub-object mirroring `GauntletState`. Cleaner separation, but a bigger blob and more migration surface. Recommended only if Commander Mode grows its own progression (a "commander ladder").

Either way the migration is trivial and forward-only, matching the existing
stepwise chain in `SaveManager.migrate` (v1→…→v5). `freshSave` gains the new
field(s). If Commander Mode ships a progression/ladder (like the gauntlet's
`GauntletState`), add a `commanderProgress` block and reward hooks in
`src/meta/Economy.ts` (mirroring `applyGauntletResult`).

## UI touchpoints

1. **MainMenu entry.** A new "Commander" button beside the Gauntlet/Practice
   entries in `MainMenuScene`, gated the same way (starter chosen). It opens a
   new `CommanderScene` (deck-select + opponent-select), or reuses the
   deck-builder in a "commander" mode.
2. **Deck select / build.** The deck builder (`DeckBuilderScene`) grows a
   "Commander" toggle that swaps in `validateCommanderDeck` (singleton + color
   identity) and adds a **"set as commander"** action on any owned legendary
   creature in the list. The color-identity filter reuses the existing
   `src/meta/collectionFilter.ts` machinery.
3. **The portrait already exists.** `CommanderPortrait` (`src/ui/CommanderPortrait.ts`)
   is deliberately generic ("receives a cardId + label and knows nothing about
   decks or avatars"). In Commander Mode, pass the **chosen `commanderId`**
   instead of `faceCardFor(deck)` — that is the entire portrait wiring. The
   opponent strip uses the rival deck's `commanderId` as its `portraitCardId`,
   exactly as gauntlet avatars do (DuelScene.ts:276).
4. **Duel launch.** No new DuelScene shape needed. Launch with the existing
   `{ opponentId, difficulty }` data contract (DuelScene `create`,
   line 209) pointed at a `COMMANDER_AVATARS` entry, and set
   `save.activeDeckId` (or a new `activeCommanderDeckId` the scene reads) to the
   player's commander deck before `scene.start('Duel', …)`. DuelScene already
   reads `save.decks.find(d => d.id === save.activeDeckId)` (line 264).

## AI implications

**The existing AI can pilot these decks unchanged.** `buildAI(difficulty, db,
seed, personality)` (`src/ai/personality.ts:92`) constructs an `EasyAI` /
`MediumAI` / `HardAI` that reads **only the redacted `PlayerView`** and the
`CardDb` — it holds no assumptions about copy counts or deck composition. A
singleton highlander list is just a 60-card decklist to it; nothing in the brains
keys off "4-of." So each commander deck gets a `difficulty` + `personality`
(reusing `makePersonality`, e.g. `subtypeBias`/`preferredSubtypes` for the
tribal decks, `burnFaceLife` for Zeus, `holdback`/`counterFloor` for Zhuge
Liang) exactly as the 8 gauntlet avatars do in `opponents.ts`.

**Caveat worth measuring:** singleton decks are higher-variance and lower on
redundancy than the 4-of gauntlet decks, so the AI's mulligan and curve
heuristics may perform a few points worse. That is a **balance-measurement**
question, not a code question — see the test strategy.

## Test strategy

This repo gates on vitest + win-rate floors + doc checkers; the plan adds no new
gate types, only new fixtures:

1. **Legality tests** (`tests/data/commanderDecks.test.ts`, mirroring
   `tests/data/starterDecks.test.ts`): every `COMMANDER_DECKS` entry is exactly
   60 cards, is singleton-legal, has its `commanderId` present + legendary + 
   creature, and passes `validateCommanderDeck` color identity. Also a
   **termination** smoke (a headless self-play game with each deck ends within
   `RULES.turnLimit`), matching the starter suite's approach.
2. **Migration test** (`tests/meta/…`): a v5 blob migrates to v6 with the new
   field defaulted, existing decks preserved — same shape as the existing
   v1→v5 migration tests.
3. **Balance matrix.** Extend `scripts/balance-matrix.ts` with a `--commanders`
   mode (a peer of `--avatars`/`--starters`) producing a deterministic
   commander-vs-commander (and commander-vs-starter) win-rate matrix. Publish a
   **date-stamped baseline** in `commanderDecks.ts` (the `opponents.ts` idiom)
   and add guidance bands. Because these gate floors "only ratchet upward with
   fresh measured numbers" (iron invariant), the first baseline is measured, not
   assumed — expect an iteration pass to flatten any deck that dominates (Zeus
   mono-burn and Sima Yi attrition are the likely outliers, mirroring the
   gauntlet's known polarized rows).
4. **Doc checker.** This doc carries the `source-of-truth` anti-rot header;
   `npm run check-docs` must stay green. If Commander Mode adds a rules table,
   it goes under `<!-- BEGIN GENERATED -->` markers per the house style.

## Phased implementation plan

Each milestone ends runnable/testable.

- **M1 — Format + validator (pure, no UI).** Add `validateCommanderDeck` to
  `DeckStorage.ts` and the `CommanderDeck` type + `commanderDeckById` to a stub
  `commanderDecks.ts`. Unit-test the validator (singleton, color identity,
  commander presence). *Testable: vitest only; no engine or UI change.*
- **M2 — The 8 decks as data.** Author `COMMANDER_DECKS` (the 8 above) to 60
  cards each and the `COMMANDER_AVATARS` opponent roster with difficulty +
  personality. Add the legality + termination suite. *Testable: `npx vitest run`.*
- **M3 — SaveData v6.** Bump the schema, write the `migrate()` step +
  `freshSave` field + migration test. *Testable: migration suite green.*
- **M4 — Mode entry + deck select.** `CommanderScene` (or a builder mode) +
  the MainMenu button; wire deck-select → `scene.start('Duel', {opponentId})`
  with the player's commander deck active and the commander id fed to
  `CommanderPortrait`. *Testable: play a full Commander duel end-to-end; a live
  preview probe of the portrait + duel per the playbook.*
- **M5 — Balance pass.** Add `--commanders` to `balance-matrix.ts`, measure,
  record the date-stamped baseline, iterate decks/personalities until bands are
  green, and set the win-rate floor from the measured numbers. *Testable:
  balance matrix + the (skipped) balance suite.*

## Risks / trade-offs

- **"Commander-lite" is not real EDH.** No command zone means the commander can
  be countered, removed, and left dead in the graveyard (no re-cast from
  command). Mitigation: it's single-player and the decks are built with
  protection/recursion; framing in-game copy sets expectations. A full command
  zone remains a possible v2, but it is an *engine* change (breaks the purity/
  determinism/save surface) and is out of scope here.
- **Singleton + a 210 pool strains thin colors.** Mono-color commanders (Zhuge
  Liang U, Zeus R) have the fewest distinct on-color playables; they lean on
  colorless artifacts and basics to hit 60. If a deck can't be made compelling
  at singleton, relax that *one* deck to "≤2 copies of non-commander non-basics"
  — a per-format knob, not a rule change.
- **Balance variance.** Singleton decks are swingier; the AI may pilot them a
  little worse. Accept it as format flavor within the guidance bands, as the
  gauntlet already does for its polarized matchups (opponents.ts baseline).
- **Scope creep into a ladder.** A commander progression/rewards system is
  tempting but is a separate feature; Option-A save schema keeps the door open
  without paying for it now.

## Open questions / decisions for the user

1. **Format numbers:** confirm **60-card / singleton / 20-life / no command
   zone**. If you want a bigger EDH feel, the alternative is a 40-card singleton
   "brawl"-style deck at 20 life — smaller, faster, and even friendlier to the
   thin colors. Which?
2. **Commander tax / command zone:** ship the pure "commander is just a drawn
   legend" model (recommended), or invest in an engine command-zone (bigger, but
   more authentic)? The latter is explicitly an engine change and would need its
   own plan.
3. **Save schema:** Option A (additive field on `save.decks`, v5→v6) vs Option B
   (a dedicated `commander` sub-object). A is smaller; B is cleaner if a ladder
   is coming.
4. **Roster overlap:** should Commander Mode reuse gauntlet personalities/portraits,
   or get its own 8 curated rival personalities? (I assumed new `COMMANDER_AVATARS`.)
5. **The two unused UR legends** (`tk-shu-liubei` W/G, and any others) — hold for
   a v2 expansion, or add a 9th/10th deck now?

### Dependencies on the parallel plans

- **Keyword-rethemes plan:** if that plan renames/adds keywords or changes
  `Keyword` semantics, the "how it wins" combat notes above (first strike,
  deathtouch, trample, vigilance, lifelink) may need re-verifying — the deck
  strategies lean on current keyword behavior in `docs/rules.md`. No structural
  dependency, only flavor/tuning.
- **Road-to-1.0 plan:** Commander Mode is a natural **1.0 content pillar**
  alongside the gauntlet; if that plan sequences features, this slots after the
  balance harness work it already relies on (`scripts/balance-matrix.ts`) and
  should share its win-rate-floor discipline. If road-to-1.0 defines a unified
  "modes" menu, the MainMenu entry (UI touchpoint 1) should conform to it rather
  than adding an ad-hoc button.
