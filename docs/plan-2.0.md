<!-- source-of-truth: docs/plan-road-to-2.0.md, docs/plan-core-set-2.md, docs/plan-story-mode.md, docs/plan-mobile-overhaul.md, docs/plan-art-streaming.md, docs/plan-accessibility-i18n.md, docs/plan-1.9.md, docs/roadmap.md, docs/expansions/drafts/core-set-2-overplan.md, src/config/rules.ts, src/meta/SaveManager.ts, src/meta/Replay.ts, src/ai/tiers.ts · last-verified: 2026-10-08 · program doc, DRAFT: the 2.0 train; nothing below is ruled except the rulings it quotes; re-verify when the owner rules a decision or 1.9.x ships -->

# Darling Blades 2.0: program plan (draft)

**Status 2026-10-08: DRAFT for the owner.** Written while 1.9.0 is being cut
(PR #550 on `release/1.9`). Only the rulings quoted with a date are ruled.
Every lane, wave and recommendation below is this draft's proposal and waits
on the owner, collected under [Decisions for the owner](#decisions-for-the-owner).
Each wave starts on the owner's word, as in 1.9.

The release spine is [plan-road-to-2.0.md](plan-road-to-2.0.md). Its 2.0 row,
as agreed 2026-08-24, as ruled 2026-09-25, and as this draft proposes after
the owner's 2026-10-08 priority order:

| | Set | Mechanics | Engine feature | Non-card headline |
| --- | --- | --- | --- | --- |
| Spine (2026-08-24) | **Core Set II** (Three Kingdoms / Greek / Beastkin), Large 250+ | The Mandate | Shared game state | Story Mode |
| After D4 (2026-09-25) | unchanged | unchanged | unchanged | Story Mode + Mobile; **the itch.io launch** (D4 ruled Mobile and itch only) |
| **Proposed (2026-10-08)** | **Core Set II**, Large, with Oath | The Mandate | Shared game state | **Mobile**, **starting life above 20**, **Story Mode Act 1 + endless**. itch.io follows 2.0 once it is stable on the site |

## The owner's priority order (2026-10-08)

Given in the "2.0 features ranked" project thread, after an advisor ranking
(the ranking and its reasoning: the project file `plans/2.0-features-ranked.md`).

| # | Priority | Lane |
| ---: | --- | --- |
| 1 | **Core Set II**, Oath included ("I lumped Oath into the Core Set 2") | A |
| 2 | **Mobile overhaul** | C |
| 3 | **The Mandate and shared game state** | B |
| 4 | **Starting life above 20** | D |
| 5 | **Story Mode, Act 1 + endless** | E |
| 6 | **itch.io** | F |
| 7 | **Story Mode, full** | G |
| 8 | **Difficulty retune** | H |

**Why itch sits sixth (owner, 2026-10-08):** "I'd rather make sure that 2.0
goes smoothly to my existing players that use the website (or local) as-is,
before branching out to Itch." This revises D4's framing that 2.0 *is* the
itch.io launch. This draft reads it as: 2.0 ships on bladedarlings.com and the
desktop build first, and the itch.io launch follows once 2.0 is stable there
(proposed as a 2.0.x, decision **P2**).

**Naming (P6, ruled 2026-10-08):** the hook this plan calls Oath ships as **Sworn**.

**Closed the same day:** card frame geometry (1.8's D8, "deferred to 2.0").
1.9's flavor removal already grew the art window from 192 px to 216 px (image
rows 21-79% to 17-83%, [plan-1.9.md](plan-1.9.md) D18), so a new card shape
would add little. Core Set II's art is cropped to today's frame.

**Priority is not build order.** Three of the eight feed each other, and the
waves below order the work by dependency:

- **The Mandate (3) comes before Core Set II's cards are costed (1).** The
  set is designed around it; its rates come from a lab on the engine.
- **The life number (4) comes before Core Set II is costed (1).** First Dawn
  was costed at 20. Costing 250 new cards at 20 and then moving life would
  cost the set twice. The number is picked in wave 1; the change itself lands
  with the set's one re-measure.
- **The difficulty retune (8) comes after the life change (4).** Every floor
  and the tier dial move when life moves, so retuning first would be undone.

**What happens when 2.0 runs long (P1, RULED 2026-10-08):** "We cut, Core
Set 2 (and all required mechanics), Mandate, Mobile, and Fixes are hard
requirements. Everything else can be discussed." The **2.0 minimum** (the 1.9
D17 pattern) is Core Set II with Oath and its other mechanics, the Mandate
engine, mobile, and bug fixes. Starting life, Story Mode (Act 1 and full),
itch.io and the retune are negotiable, decided with the owner if 2.0 runs
long rather than cut in a fixed order.

## Where 2.0 starts from

- **1.9.0** is staged on `release/1.9` (#550, 2026-10-08); the release PR into
  `main` merges on the owner's word, then the tag.
- **Pool:** 1,648 collectible cards across eleven sets, a 28-rung tower, the
  Warchest and Darlings formats.
- **Save:** `CURRENT_SAVE_VERSION` is 36 (`src/meta/SaveManager.ts`); 1.9's
  one bump. **Replay:** `REPLAY_LOG_VERSION` is 16 (`src/meta/Replay.ts`).
- **Rules:** `RULES.startingLife` is 20 (`src/config/rules.ts`); every scorer
  rate, floor and boss tune is measured there.
- **Art:** card art streams from range-read packs on Pages (1.9 lane D,
  [plan-art-streaming.md](plan-art-streaming.md)); this is what the itch.io
  target needs. Gate 7 is checked at the 1.9 cut.
- **Accessibility:** text size (to 130%) and high contrast shipped in 1.9 on a
  shared layout resolver, built so the mobile pass reuses it
  ([plan-accessibility-i18n.md](plan-accessibility-i18n.md)). English only (D3).
- **Mobile today:** Tier 1 only. The game plays by touch on a phone over the
  local network, desktop composition at 1280x720. The 2.0 duel layout is
  decided (Version C, 2026-09-25); nothing is built.
- **Balance:** floors ratcheted at the end of 1.9's wave 4 (#536). The top
  tier (T6) reads about 66% against its .585 band (72 in 1.7), accepted for
  1.9 (Q4).

## Carried in: the 1.9.1 patch

These are ruled or proposed for 1.9.x, not 2.0. They are listed because they
change the ground 2.0 measures on. **RULED (P3, 2026-10-08): the 1.9.1 patch ships before 2.0's wave 2.** It is
under way on `release/1.9.1` (cut from v1.9.0), in its own thread, and also
carries the art-pack compression fix behind the 1.9.0 hotfix. So Core Set II's
costing and the end-of-train measurement start from a pool that already has
these fixes. The life study (D1) starts on 1.9.0 without waiting (P15).

- **The older-set near-duplicates** (D8 of 1.9, 41 cards ruled 2026-09-28,
  [d8-near-duplicate-review.md](d8-near-duplicate-review.md)), with the boss
  floors re-gated on the full ladder; Wreck-Runner's fix (D8 B1) rides it.
- **The keyword backfill** of the ten shipped sets (approved 2026-09-29).
- **The full four-round metagame sweep**, resumed from round 0's sweep
  directory. Warband's 92.2% against the prefab field is read here.
- **The AI gaps logged in 1.9** (Ember-Flick and Foresee in Medium, the Duty
  in main phase two, Festival Rocket): fixed in 1.9.x or carried to 2.0's
  AI freeze, not left open past it.

## Lanes

Lanes run in parallel in separate worktrees, by file set, as in 1.9. Letters
follow the priority order where they can.

### Lane A: Core Set II (priority 1)

**What the spine and rulings fix:** a Large set (250+) returning to the Three
Kingdoms, Greek and Beastkin rosters (on the spine since 2026-08-24), the
anniversary set. A Large set carries every keyword and every named mechanic
(owner, 2026-09-29, [plan-1.9.md](plan-1.9.md)). It supplies Story Mode's
three starter pools and its new Beastkin legend (Story Mode R8c).

**Process (the 1.9 D16 order, proposed):** brief, design-first overplan,
concretion audit, then the engine spec for the Mandate and Oath, the engine
and lab rates, the rescore, the owner's cut, the art bible, the art run,
transcription. The cards decide what the engine builds.

1. **A refreshed set plan.** [plan-core-set-2.md](plan-core-set-2.md) was
   last verified 2026-07-26 and leans on things that have since moved:
   multiplayer (cancelled), the Tutor (after 2.0), localization (English
   only), the mod whitelist (2.1), and an Oath text written before Darlings'
   command zone. Its engine and AI sections stand. The refresh happens in
   wave 1 and is short.
2. **The overplan is retired and the set authored fresh (proposed, P4).**
   [core-set-2-overplan.md](expansions/drafts/core-set-2-overplan.md) is the
   July pool: sized for 120 cards, no Beastkin, predating the Warchest, the
   1.8.5 scorer and the keyword rule. Drowned Deep (2026-09-07) and First
   Dawn (2026-09-25) retired theirs for the same reasons. It stays as a
   candidate pool the new overplan may draw on.
3. **The coverage ledger** (plan-core-set-2's roster step 1): a
   machine-readable snapshot of the three existing rosters (colours, curve,
   types, interaction, legends, Darlings identities, art coverage), so new
   cards fill measured gaps rather than repeat nostalgia. Run the duplicate
   comparator against the whole pool as each batch lands.
4. **The identity brief** (an Opus agent, as First Dawn): set key (`core-set-2`
   recommended), roster split, the new Beastkin legend (colour pair, tribe,
   name; recommended blue-inclusive with an anthem), the three Story starter
   pools, the rung bosses if the tower grows, and the colour pairs for any
   new sweep personas.
5. **Size and shape.** Large means 250+ on the spine. Duat shipped 245 and
   Drowned Deep 252. The count is the owner's at the cut, from the ledger, not
   a marketing number.
6. **Oath** rides the set as a design hook (owner, 2026-10-08). Recommended
   semantic: active while you control any legendary creature (one public
   predicate, no new state, works in Warchest and Darlings). It is cut only
   if the set does not need it.
7. **Art** is the long pole, as in every set: 250+ images, review rounds set
   the pace. Cropped to today's frame at the 216 px window.
8. **Products:** boosters, the shop deck, precons and rivals as the brief
   proposes; pricing follows the release-order tier rule in
   `src/meta/boosterSkus.ts` (the newest three are premium, so appending the
   set moves Starborne to the 450g back catalogue).
9. **The new-set checklist** every set carries, named here so none is
   missed: the art bible entries and `check-art-bible`; the art packs rebuilt
   with the new set's pack and index ([plan-art-streaming.md](plan-art-streaming.md)
   section 5; the itch file-count gate depends on it); the Forge (its set
   union and labels, and a `power-scores.json` rescore); the blades-db
   rebuild and `terms --check` for the new mechanics; glossary, rules and
   tutorial text for the Mandate and Oath; the duplicate comparator over the
   whole pool.

### Lane B: The Mandate and shared game state (priority 3)

**The engine feature for 2.0.** One public, contested marker:
`GameState.mandateHolder: PlayerId | null`, starting unclaimed. Its holder
draws a card at dawn; a combat-damage batch to the holder passes it to the
attacker; `claimMandate` claims it by effect. The full engine, AI and test
spec is in [plan-core-set-2.md](plan-core-set-2.md) and stands.

- **B1, the spec** (`plan-core-set-2-engine.md`, after the overplan, as First
  Dawn's engine spec did): the timing rulings (dawn draw before permanent dawn
  triggers, recommended), the claim point in first-strike and normal batches,
  the event, the view field, its part of the train's one replay bump (P16),
  Oath's predicate.
- **B2, the engine** on synthetic fixtures before any collectible card:
  golden event tests for every ordering case the set plan lists (initial
  state, effect claim, dawn order, turn-one skip, deck-out, first strike,
  several attackers, Fog, zero damage, already-holder no-op, lethal damage,
  clone, replay, redacted views).
- **B3, the AI reads:** every brain sees the public holder; Medium gains a
  claim and retention bonus and recognises face attacks that steal it; Hard
  values the extra card in search without reading hidden order. Proven on
  the matrices against the standing floors; none raised.
- **B4, the UI:** the Mandate marker beside its holder, the claim animation
  and history line, glossary and rules text. It must fit Version C's
  command column (lane C), not only the desktop Duel.
- **B5, the lab rates** for the scorer: claim, hold and payoff rates measured
  on the overplan's shapes, entered before the rescore.

**Naming (P5):** the July overplan calls the marker "the Crown" in places.
One name, the Mandate, is recommended for every surface.

### Lane C: Mobile overhaul (priority 2)

**What is ruled:** phone play is landscape; the Duel is Version C, "Command
column (hand-first)": portraits, life, mana and piles in a narrow left
column, the battlefield in the centre as two rows of medallions, the hand as
named rows with cost pips on the right ([plan-mobile-overhaul.md](plan-mobile-overhaul.md)).

1. **The plan rewrite** when 2.0 opens, as the mobile plan itself says. Its
   body was written for 1.8: it still lists Story and Limited scenes that do
   not exist yet or changed, Tutor and multiplayer dependencies, and a 1.8
   recommendation set. The research session's mocks of every scene on
   Version C are not in the repo; the rewrite either brings them in or
   re-mocks.
2. **Decisions it needs first:** the support matrix (named phones and
   browsers, oldest supported), the phone card face (art-first (a) is the
   research session's recommendation, [plan-1.9.md](plan-1.9.md) "Mobile
   (2.0)"), landscape only (recommended), no PWA or store package in 2.0
   (recommended), automatic layout only (recommended, no save bump).
3. **Waves** (the plan's own four, kept): profiles and primitives on 1.9's
   layout resolver with a device baseline; navigation and list scenes; the
   Duel and its overlays (the high-risk wave: targeting, stack responses,
   Foresee, Overcharge, the Mandate marker); then Pack Opening, Limited,
   Story and release hardening on real devices.
4. **Shipping on the site first** suits this lane: phone players on
   bladedarlings.com are the soak before itch.io.

Gameplay is unchanged: touch and desktop inputs must produce identical
action logs. The AI gates run only after the Duel's input refactor.

### Lane D: Starting life above 20 (priority 4)

**Owner direction (2026-09-29):** raise starting life by 5 to 10 at 2.0, so
games reach the top of the curve ("If we are never getting to even playing
10 lands, a lot of our most expensive cards are never being played"). The
data and the touch list are in [plan-road-to-2.0.md](plan-road-to-2.0.md#starting-life-a-20-direction).

- **D1, the study** (runs first, right after 1.9.0, "after 1.9 ships", owner
  2026-09-29): the board-cap study's 20 / 25 / 30 arm across a broad deck
  field. It reports game length, how games end, each archetype's win-rate
  shift, lands in play at the end, cast frequency by cost, and Hard AI time
  per game. Heavy-job rules apply (one at a time, at most 4 workers); it runs
  on GitHub Actions like the sweep, or on the owner's PC in light mode.
- **D2, the owner picks the number** from the study (wave 1 sitting).
- **D3, the change**, before Core Set II's rescore: `RULES.startingLife`, the
  scorer's life-related terms re-derived, rules, glossary and tutorial copy
  that says 20.
- **D4, the re-measure** is the train's one end-of-wave measurement (lane I),
  shared with Core Set II. Floors are re-baselined there, see P8.
- **Replays** recorded under 20 must replay under 20. Today nothing carries
  the total: `Game.ts` reads `RULES.startingLife` directly and neither
  `GameConfig` nor the replay log has a life field, so an old log would
  diverge. D3 adds `startingLife` to `GameConfig` and the log, as a new
  rules revision (5; logs v11 through v16 all map to revision 4,
  `src/meta/Replay.ts`).
- **One replay bump for the train (proposed, P16).** The Mandate (B1), the
  life field (D3) and Story's `mode: 'story'` (lane E) each want a
  `REPLAY_LOG_VERSION` change. They share one bump, 16 to 17, landed by
  whichever arrives first and extended by the others before the cut.

### Lane E: Story Mode, Act 1 + endless (priority 5)

**What is ruled (2026-09-29, ten rulings):** a roguelite run with a story
spine; three characters on an unlock chain (Guan Yu, then Persephone, then a
new Core Set II Beastkin legend), each unlocked by a win or three counted runs
with the previous character; an opening boon; one card kept per act cleared;
permanent buys with run gold. Voice is TBD. The spec is
[plan-story-mode.md](plan-story-mode.md).

**Scope for 2.0 (owner, 2026-10-08):** Act 1 plus an endless run. This is the
scope lever the Story Mode plan recorded. Proposed reading (P9):

- **Act 1:** the full run shell (character select, boon, map, fight, elite,
  event, shop, rest, the act boss), its scenes, the Act 1 keep, permanent
  buys. All three characters and the unlock chain ship, since the chain is
  ruled and needs only one act to work.
- **Endless:** after Act 1, or from the menu once Act 1 is cleared, the run
  continues on generated maps with scaling bosses until a loss. A daily seed
  shared by every player is the cheap variant (the Gauntlet's date seed
  precedent). No keep beyond Act 1's, so it adds no collection income.
- **Run counting** applies to both (R9: three fights counts a run).

**Waves** (the plan's own, scoped): one headless run with Guan Yu on current
cards and the save field (v37, the train's one bump, P10), with save
portability in the same wave: the save code's `hasCompleteSaveShape` check
and the import preview learn the `story` field, so save codes and save
cards carry it (lane F's itch export prompt depends on this); the run shell
behind a flag, on lane C's layouts and 1.9's text scale; Act 1 content and
the three starter pools once Core Set II's roster locks; the story matrix
and progression runs; release QA.

**Copy is approved text, not placeholders.** The README promises nothing is
placeholder. The premise (open) and Act 1's scenes go to the owner as a
script before wave 3.

### Lane F: itch.io (priority 6)

**RULED (P2, 2026-10-08): the launch itself is a 2.0.x**, once 2.0 is stable on the
site. The known work (researched 2026-09-25, roadmap "2.0 is the itch.io
launch"; [plan-art-streaming.md](plan-art-streaming.md) section 8):

- **Build target (new code):** an itch target that drops the loose art
  folders and the Forge, with a new file-count gate (1,000 files, 500 MB) in
  CI; a new itch case in `scripts/cspForTarget.ts` (today it only adds the
  Tauri IPC sources) so `connect-src` allows itch's injected beacon;
  never tick itch's SharedArrayBuffer option (it moves the game to a new
  origin).
- **The play-stats Worker** accepts itch's origin; it is redeployed with the
  owner's Cloudflare token.
- **Saves:** every itch game shares one origin and a small, easily cleared
  storage, and saves do not carry over from bladedarlings.com. The save code
  and save card export get a first-run prompt on the itch build.
- **Windows:** the portable app folder through itch's `butler`, which the
  itch app updates, rather than the installer.
- **The store page:** the AI-content tag (Graphics at least), the content
  rating (itch hides adult content from browse), screenshots, a trailer,
  copy, and a way for players to report bugs.
- **Before the launch:** the lawyer pass on the terms and privacy policy
  ([docs/legal/README.md](legal/README.md) says "ideally before 2.1"; an
  advertised launch with play stats on by default is when it matters).

**The doc fan-out (done 2026-10-08, with P2).** Dated notes now point here from
the roadmap's Planned section, the spine row, feature table and Load risk note
in [plan-road-to-2.0.md](plan-road-to-2.0.md), 1.9's D4, the Story Mode plan's
Goal and the art streaming plan's section 8. The mobile plan's header is being
rewritten in its own PR (#553), which carries the change.

**In 2.0 itself (cheap, behind a flag):** the itch build target and its gate
in CI, so the target is proven every release instead of the week of the
launch. The launch plan doc is written in 2.0.

### Lane G: Story Mode, full (priority 7)

Acts 2 and 3, their bosses, scenes and keeps, on the shell lane E ships.
**Proposed: 2.0.x**, unless 2.0's waves finish with room. Since keeps are
per act, each act added is an economy change and goes through
progression-sim.

### Lane H: Difficulty retune (priority 8)

**What it is:** the top tier (T6, the floor-tier dial in `src/ai/tiers.ts`)
reads about 66% against a .585 band, down from 72% in 1.7. The 1.9 wave-4
read showed list tunes move it about +1; only the tier dial moves it by
points, and it is AI ([plan-1.9-wave4-tunes.md](plan-1.9-wave4-tunes.md),
4.1). The 2026-09-21 note proposed measuring it against a human, not only the
Medium proxy in the player's seat.

**Proposed:** after the life change, in wave 4, as the one deliberate change
to the frozen AI: the tier dial moves, then lane I's measurement reads it.
Or in a 2.0.x. A human calibration needs play data: the play
stats' game-length and outcome bands (no player duel reports had arrived as
of 2026-09-29) or the owner's own runs.

### Lane I: measurement and release mechanics

- **One end-of-train measurement** after Core Set II, the Mandate AI reads
  and the life change: the matrices, the boss tunes for the new pool, the
  Darlings summit, Story's matrix.
- **The floor rule under a life change (P8).** Test gate floors only
  ratchet up (an iron invariant in `CLAUDE.md`), but a life change moves
  every number for a reason that is not drift. Proposed: one owner-approved
  re-baseline at the new life total, every gate floor set from fresh
  200-seed readings by the 1.9 rule (mean - 6.5, rounded down), each that
  comes down listed in the PR; from there floors ratchet up again. Ruling
  it means amending the invariant's wording in `CLAUDE.md` and the playbook
  to name the exception. The harness bands (`RUNG_BANDS`, `FLOOR_BANDS`)
  are not gate floors and could already come down (1.9 Q6).
- **The metagame sweep**, last before the cut, on GitHub Actions (1.9 D9
  precedent), with Core Set II's colour pairs as personas if the brief adds
  them.
- **Release notes, the cut, the deploy** as in 1.9: the release PR into
  `main` only on the owner's word, the tag, the Worker redeploy if `worker/`
  changed.

## Sequencing (proposed)

Waves are dependency-ordered; each starts on the owner's word.

| Wave | Critical path | Alongside | Owner sitting |
| ---: | --- | --- | --- |
| **0** | 1.9.0 ships; 1.9.x ships (P3); `release/2.0` cut from `main` | D1, the life study, starts as soon as 1.9.0 is on `main` | none |
| **1** | Core Set II's refreshed plan, ledger and identity brief | Mobile plan rewrite and support matrix; Story save field and headless run; the itch build target behind a flag | **one sitting**: the brief, the life number, the mobile decisions, Story's premise direction |
| **2** | The design-first overplan, its concretion audit, the Mandate and Oath engine spec, **a second sitting** to rule it; then B2 and the lab rates; D3 (the life change) | Mobile wave 1 (primitives); Story run shell; B3 AI reads and any carried 1.9 AI gaps, proven against the standing floors; **the AI freezes at the end of the wave** | the engine spec and the overplan |
| **3** | The rescore on the new life total, the owner's cut, the art bible, the art run, transcription | Mobile waves 2-3 (lists, then the Duel with the Mandate marker); Story Act 1 content once the starter pools lock | the cut, then art review rounds |
| **4** | Rung or precon content, the tunes, **the one measurement**, the re-baseline (P8), the new gates | Mobile wave 4 on real devices; Story matrix and progression; lane H if in scope | the measured tables |
| **5** | QC, the sweep last, release notes, the 2.0.0 cut on the site | The itch launch plan finalised; lawyer pass | the cut |
| **2.0.x** | The itch.io launch (F); Story Acts 2-3 (G); the difficulty retune if it slipped (H) | | |

**Shared files, in order** (parallel agents never share a file):

- `src/engine/types.ts` and `src/engine/Game.ts`: the Mandate (B2) first,
  then the life change (D3) if it needs a rules-context field.
- `src/scenes/DuelScene.ts`: mobile's Duel wave and the Mandate's UI (B4)
  touch the same scene; B4 lands first on the desktop Duel, then mobile's
  Duel wave composes it into Version C.
- `src/ai/*`: the Mandate reads (B3), then any 1.9 AI gaps carried in, then
  lane H's tier dial last, each proven on the matrices in turn.
- `src/data/opponents.ts`, `tests/ai/winrate.test.ts`,
  `scripts/balance-matrix.ts`: one agent at a time in wave 4's order.
- `src/meta/SaveManager.ts`: Story's v37 bump is the train's one save change
  (P10); anything else that needs a field rides it.

**For scale:** 1.8 (252 cards, an engine feature and telemetry) ran
2026-09-07 to 09-24; 1.9 (166 cards, accessibility, art streaming and
measurement) 2026-09-28 (wave 0) to 10-08. 2.0 is a Large set plus mobile, Story Act 1
and the life change, so it is at least 1.8 plus two lanes. As in 1.9, the
owner's review turnaround sets most of the calendar.

## Decisions for the owner

Each has a recommendation. None is ruled.

| # | Decision | Recommendation |
| --- | --- | --- |
| **P1** | What the priority order means when 2.0 runs long | **RULED 2026-10-08:** "We cut, Core Set 2 (and all required mechanics), Mandate, Mobile, and Fixes are hard requirements. Everything else can be discussed." The hard minimum is Core Set II with its mechanics (Oath included), the Mandate engine, mobile and fixes. Starting life, Story Mode (Act 1 and full), itch.io and the retune are all negotiable if 2.0 runs long, decided with the owner at the time rather than by a fixed order |
| **P2** | When itch.io launches | **RULED 2026-10-08: as recommended.** A 2.0.x, once 2.0 is stable on the site. The itch build target and its CI gate land in 2.0 behind a flag |
| **P3** | 1.9.x before 2.0 | **RULED 2026-10-08: keep the 1.9.1 patch.** The owner first picked folding it into 2.0, then confirmed keeping it once told the patch was already under way (`release/1.9.1`, cut from v1.9.0; the near-duplicate slate in #556). It ships before 2.0's wave 2, so Core Set II is costed on the fixed pool |
| **P4** | Core Set II's July overplan | **RULED 2026-10-08: retire it.** Author fresh, as Drowned Deep and First Dawn did; keep it as a candidate pool |
| **P5** | The marker's name | **RULED 2026-10-08: "the Mandate" everywhere; drop "the Crown".** Rename the two RoTK achievement titles that use the word ("Mandate In Foil", "Rainbow Mandate" in `src/meta/Achievements.ts`; titles only, ids unchanged, so no save impact), working titles "Three Lords in Foil" and "Rainbow Lords". The Shadow Mandate starter deck keeps its name. Lands with lane B's UI and glossary work. Settles the Mandate half of brief Q7 |
| **P6** | Oath's semantic | **RULED 2026-10-08: active while you control any legendary creature, and the mechanic is named "Sworn", not "Oath"** (avoids Blood Oath, the Grail Oath, Peach Garden Oath and Liu Bei, Benevolent Oathkeeper). "Oath" in this plan and the set plan is the working name for Sworn. Settles brief Q6 and Q7 |
| **P7** | Set key and size | **RULED 2026-10-08: as recommended.** `core-set-2`; the size from the coverage ledger at the cut, 250+ per the spine |
| **P8** | Floors under the life change | **RULED 2026-10-08: one-time reset.** One re-baseline at the new life total, then ratchet up as before. The exception is recorded in `CLAUDE.md` and the playbook |
| **P9** | What "Act 1 + endless" contains | Act 1 complete with all three characters and the unlock chain; endless as generated maps with scaling bosses, plus a daily seed; no keeps in endless |
| **P10** | Save changes | One bump, v37, for Story; nothing else adds a field unless it rides it |
| **P11** | Mobile scope | **RULED 2026-10-08: as recommended.** Landscape only, automatic layout, browser only (no PWA or store package), art-first phone card face (a). Settles the mobile plan's M1-M4 |
| **P12** | Story voice (R7, TBD) | None at 2.0 |
| **P13** | The new Beastkin legend | **RULED 2026-10-08: a Jade Rabbit (moon rabbit, Chang'e's myth), U/W**, leading a Beastkin anthem. The owner turned down sky, bat, spider and serpent species and asked for something in the vein of the feline and canine Beastkin. Name in the brief; Yohime as the fallback if Core Set II slips. Settles the brief's question 9 |
| **P14** | The difficulty retune | After the life change, measured against a human (play stats or the owner's runs); 2.0.x if it slips |
| **P15** | The life study's pool | Start it on 1.9.0 without waiting for 1.9.x; its readings are re-taken in the end-of-train measurement |
| **P16** | Replay versions | One `REPLAY_LOG_VERSION` bump (16 to 17) shared by the Mandate, the life field and Story |
| **P17** | If the life study is late | Wait for it; moving the change to 2.1 is the fallback only if waiting would hold Core Set II's costing |
| **P18** | Does itch wait for full Story Mode? | No: launch with Act 1 + endless, the priority order (itch 6, full Story 7). The store page sells Story Mode as growing, with Acts 2-3 as the next update |

Still open from earlier plans and carried here: the permanent-buy price and
limits (Story), Story's premise, Core Set II's product scope, Darlings
packaging, roster emphasis (Three Kingdoms leading the Mandate, or an equal
return), and whether Core Set II reprints or revises Guan Yu and Persephone,
which Story's first two characters depend on (the set plan's open decisions).

## Not in 2.0

| Item | Where | Note |
| --- | --- | --- |
| Card frame geometry | **Closed** (owner, 2026-10-08) | The 216 px window covers it |
| The itch.io launch | 2.0.x (P2) | Its build target is in 2.0 |
| Story Mode Acts 2-3 | 2.0.x unless room | Lane G |
| AI suggested decks, replay coaching | After 2.0 (ruled 2026-09-25) | |
| Editable Limited Warchest | After 2.0 (ruled 2026-09-25) | |
| Cloud saves and accounts | 2.1 | Ruled 2026-08-28 |
| UGC and mods | 2.1 on the spine | Scheduled for 2.0 in July 2026, moved by the spine |
| Brass Court | 2.1 | |
| Async PvP, animated art | After 2.0, not scheduled | Proposals |
| Localization | Never in 2.0 | English only (D3) |
| Multiplayer | Cancelled | 2026-08-24 |

## Non-goals

- No relitigating the spine: Core Set II is the 2.0 Large, Brass Court stays
  2.1, multiplayer is cancelled.
- No floors lowered except the one re-baseline P8 proposes, if ruled.
- No portrait gameplay, no app-store package.
- No localization scaffold.
- No cloud or account code.
- No AI voice unless the owner rules otherwise (P12).

## Risks

- **2.0 breaks the Large-release rule by design** (D4: a Large set carries
  little else). Mobile and Story Act 1 ride beside a 250-card set. The cut
  order (P1) is the relief valve; full Story Mode already sits outside.
- **The life change touches everything measured.** If the study is late,
  the choice is to wait for it or to cost the set at 20 and move the change
  to 2.1 (P17). The owner aimed it at 2.0 with Core Set II; moving it is the
  owner's call, not this plan's.
- **The Duel is touched by three lanes** (mobile, the Mandate UI, Story's
  launch context). The shared-file order above is the guard.
- **Story Mode waits on the set** for its starter pools and third character.
  Waves 1-2 build on current cards so the shell is not blocked.
- **Art volume:** 250+ card images, the Story scenes' backgrounds and
  portraits, and the Beastkin legend. Review rounds, not generation, set the
  pace.
