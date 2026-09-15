<!-- source-of-truth: src/ai/EasyAI.ts, src/ai/MediumAI.ts, src/ai/HardAI.ts, src/ai/value.ts, src/ai/combatPlans.ts, src/ai/tithePolicy.ts, src/ai/hauntlinkPolicy.ts, src/ai/determinize.ts, src/meta/draftPicker.ts, tests/ai/winrate.test.ts, docs/ai.md · last-verified: 2026-09-15 · audit and proposal; re-verify when the owner rules on D1-D5 or a phase lands -->

# AI brain audit and modernization plan (2026-09-15)

Status: AUDIT COMPLETE, PLAN AUTHORIZED 2026-09-15 (D1 all five phases, D2 proof first, D3 style over strength; D4 and D5 approved as recommended in section 8). The owner asked
whether the tower and draft AIs can play every card as intended after 1.8's
mechanics landed. This is the answer, with a plan the owner rules on.

Method: three read-only passes over the working tree at the 1.8 train tip
(release/1.8 past #373): the engine's full decision vocabulary
(`src/engine`), what each brain does with it (`src/ai`, `src/meta/draftPicker.ts`),
and what the tests and `docs/ai.md` prove versus claim. Card exposure counts
come from a census of the 1,487 non-token cards in `CARD_DB`. Nothing was run
that plays games; every rate quoted is one the repo already records.

## 1. The short answer

The AI can legally play every card. No mechanic crashes a brain, no waiting
state falls through to an illegal action, and every 1.8 decision (loot,
edicts, deferred trigger targets, multi-Duty, Whispers, Tithe, Rite) has a
shared policy and tests behind it.

The AI does not play every card as intended. The gaps are not mostly in the
new mechanics; the largest one is older than 1.8 and every set has widened
it: Medium's casting ladder recognises a fixed set of spell shapes (kill
removal, counters, pumps, draw, reach burn) and treats every other spell body
as blank. Hard cannot decline Medium's choice because passing is not a
search candidate. The 1.8-specific gaps are real but narrower: the Tithe
policy only ever sells damaged bodies, no brain acts in the Hauntlink window,
and the draft picker knows no mechanic newer than a keyword.

## 2. What the engine can ask a player (the checklist)

The full inventory is in the audit notes; the shape that matters:

- 19 action kinds (`src/engine/actions.ts:49-96`), 13 waiting states
  (`types.ts:720-754`), 5 pending-decision kinds (`types.ts:786-831`).
- 13 keywords, 14 card mechanics (Empower 39 cards, Skim 96, Retell 46,
  Whispers 40, Tithe 31, Rite 19, Nine Lives 30, Preserve 27, Duty 55,
  Hauntlink 16, Quest 9, Awakening 7), 21 trigger kinds, 39 effect ops,
  11 target kinds with 7 qualifiers.
- No trigger is optional; Quest advance, Awakening, Nine Lives and Propagate
  are mandatory and target-free.
- Enumeration quirks a brain must compose around: the Foresee menu offers
  only the empty pick (`actions.ts:718`); Tithe and Rite offer one canonical
  fodder set (`actions.ts:267`, `:180-188`); hand cards are deduped by id in
  the menu (`actions.ts:732-736`); Whispers and Tithe casts are appended
  after the main switch (`actions.ts:297`); the Hauntlink window allows only
  link or pass (`actions.ts:859-863`).

## 3. Coverage by brain

Handled means a deliberate policy exists and is tested. Partial means a
policy exists but a documented condition makes it fire rarely or wrongly.
Missing means the brain has no rule and falls to a default.

| Decision or mechanic | Easy | Medium | Hard | Draft picker |
| --- | --- | --- | --- | --- |
| Empower | handled, cost never priced | handled, cost never priced | handled (simulated) | missing |
| Retell | handled | handled | handled (searched) | missing |
| Whispers, deadline | partial (flat deadline term) | partial (+freebie rule) | handled (searched) | missing |
| Tithe | partial (damaged bodies only) | partial (same) | partial (same policy) | missing |
| Rite fodder | handled | handled | handled | missing |
| Skim | only with no cast available | only with no cast available | searched (capped) | missing |
| Preserve | handled | handled | searched | missing |
| Duty, single and multi | handled, activates before develop | handled, same | searched, top 1 only | missing |
| Hauntlink link (rev 4) | host by raw value, never moves | same | same, not searched | missing |
| Hauntlink window | always pass | always pass | always pass | n/a |
| Marks, Propagate | valued, no board adjust | board-aware | board-aware | missing |
| Quest, Awakening, Nine Lives | valued only (automatic) | valued only | valued only | Quest scores as a bare enchantment |
| Loot discard, edict, deferred targets | shared policies, tested | same | same, settled before search | n/a |
| Foresee | bottom-only policy (content untested) | same | same | n/a |
| Hand-size discard | random | by value | by value | n/a |
| Lethal check | none | damage-to-target only | simulated | n/a |
| Wraths (massDestroy) | invisible | cast blind by mana value | cannot veto | counts as removal |
| Fog, tap, debuff, mark, face-damage Charms | 15 percent random | never cast | only inside the response search cap | tap and mark Charms score as vanilla |
| Combat: twinBlades, sentinel | not modelled | not modelled | corrected only past the sim margin | keyword count only |
| Combat: firstBlade | ignored in blocks | modelled | engine-exact | keyword count only |
| Pass or hold a cast | n/a | rule ladder | not a candidate | n/a |

## 4. The gaps, ranked by exposure and severity

1. **Spell bodies are blank to the cast ladder.** `cardValue` adds nothing
   for a spell's body (`src/ai/value.ts:796-813`), so Medium's develop step
   casts 148 Rituals purely by mana value and never casts 41 Charms whose
   bodies match no response rule (`MediumAI.ts:427-450`, `:629-636`). Inside
   that bucket: nine wraths (`removalKind` ignores `massDestroy` on
   creatures, `value.ts:703-707`) are cast into the AI's own winning board;
   eight fogs are never cast; 28 face-damage and drain spells are never
   lethal-checked (`MediumAI.ts:338-348` reads only damage-to-target); debuff,
   tap and mark Charms have no rule. Easy sees the same cards only through its
   15 percent random response. Severity: plays badly to self-destructively;
   this is the widest gap in the game.
2. **Hard cannot pass.** `searchMain` has no `passStep` candidate
   (`HardAI.ts:250-253`, marked future work), so Hard upgrades Medium's cast
   or repeats it, never declines a blind wrath or holds a body for the second
   main. Amplifies gap 1 at the top of the tower.
3. **Tithe sells only damaged bodies.** The gate is mana saved greater than
   body value, where saving is at most half the Defense and value is Defense
   minus damage (`tithePolicy.ts:78`, `value.ts:1165`), so an undamaged body
   never qualifies; the policy tests fix damage on every fodder fixture. The
   31 Tithe cards play as full-price fatties, and the summit boss built on
   Tithe (rung 26) will play its signature at a fraction of its design.
4. **Hauntlink under rules revision 4.** Hosts are chosen by raw body value,
   not rider fit (`hauntlinkPolicy.ts:16-21`; the rider scorer is reachable
   only on the retired cast-attached path), links never move, and every brain
   passes the Hauntlink window (`EasyAI.ts:346`, `MediumAI.ts:458-459`,
   `HardAI.ts:578-586`). 16 carriers, 13 of them the Yokai Nights spine.
5. **Combat keyword modelling.** `combatant()` has no twinBlades or sentinel
   field (`combatPlans.ts:24-45`, `:112-115`): double strike is scored as one
   hit and vigilant attackers are taxed as if they tapped, in every Medium
   attack and block and in Hard's baseline. 105 cards.
6. **Duty ordering and mana holding.** Main-two activation precedes develop
   (`MediumAI.ts:422`), so a mana Duty can pre-empt a creature cast; nothing
   holds mana for a Charm; Hard searches one activation. 55 cards, 29 with
   mana costs.
7. **Empower cost is never priced** in Easy and Medium (`EasyAI.ts:125`,
   `MediumAI.ts:228`); an affordable Empower is always paid even when the
   mana would cast a second spell. 39 cards.
8. **The draft picker is mechanic-blind** (`src/meta/draftPicker.ts:128-170`):
   it scores rarity, stats, keyword count and ability ops only. 70 cards
   whose only text is Empower, Retell, Quest or Duty score as vanilla;
   Bulwark and Rage earn the keyword bonus; self-damage riders count as
   removal. The same scorer builds the bot decks and picks their colours.
9. **Easy's hand-size discard is random** (`EasyAI.ts:90`), which is not on
   Easy's documented weakness list.
10. **Quest-gated abilities are priced at full weight** with no Quest in play
    (`abilityConditionMultiplier` has no `questActive` entry). 17 abilities.

## 5. What is proven, and what only claimed

- The 1.8 decision surface is the best-tested part of the AI: Whispers (15
  tests), Tithe (12), Duty (20+), loot, edict, deferred targets, qualifier
  targeting, hidden-information honesty through determinization.
- No brain-level test exists for Quest, Awakening, moveMark, Untouchable,
  Warding Gaze, Deathblade, Warcry, Skyborne, Overrun or firstBlade
  decisions, for Foresee policy content, for classic mulligan bands, for
  London bottoming, or for Medium's lethal-burn, sweeper-counter and
  end-step rules. Those are code-only.
- `tests/ai/balance.test.ts` is skipped in its entirety, so the avatar
  bands, tower-floor bands, starter no-crush rule and difficulty
  round-robin never run in CI. Rungs 1 to 13 have no reserve-native
  termination smoke at all; the 24-avatar smoke plays the retired classic
  deck field. Darlings precons have no AI game. Theme decks run one seed.
- `docs/ai.md` (last verified 2026-09-03) is wrong in four places: Hard's
  main phase "just calls Medium" (it searches Skim, Retell, Whispers,
  Empower, Rite, Tithe, Preserve, Duty and Darling casts); Easy's all-in
  gate counts blocker demand, not creatures; the avatar count is 22 (it is
  24, soon 26); the Yokai summit floors quoted are pre-re-centre. It never
  mentions Duty, loot, edicts, deferred targets or the seven policy modules
  added since 1.6.

## 6. What not to touch

- The determinization priors. Five richer opponent models were measured
  against the 200-game Hard-vs-Medium gate and all lost
  (`src/ai/determinize.ts:16-33`). The inert model stays; the search
  machinery is not the lever.
- The tier dial. The easy and medium brains overlap at their edges; no
  noise value tiles them (`src/ai/tiers.ts:77-97`). Closing the 6-to-7
  step is brain work, which phase A below may deliver as a side effect and
  must be re-measured, not tuned.
- Threshold payoffs. Four- and five-creature thresholds are a design lever
  (`docs/roadmap.md:131-140`), not an AI one.

## 7. The plan (proposed, phased, each phase its own PR and measurement)

Every phase lands behind the existing gates: Medium-vs-Easy at or above
80 percent, Hard-vs-Medium at or above 70 percent, every avatar floor
14 to 26 held, zero draws, and the persona-lockstep and NoisyAI
byte-identity tests unchanged. A phase that moves a gate down does not
merge. Floors only ratchet up, from fresh numbers.

**Phase A, the cast ladder learns to read spells (gaps 1, 2, 10).**
Give spells a body value built from the op valuator the triggers already
use, so develop orders Rituals by what they do; classify creature
`massDestroy` as removal under the existing asymmetry gate; extend the
lethal check to face damage and drain; add response and main rules for fog,
tap, debuff, mark and bounce-to-save Charms; teach Hard a `passStep` and a
hold-for-main-two candidate; price Quest-gated abilities by whether a Quest
is out. Measurement: the two brain gates, the 24-rung matrix, and a new
per-shape probe (does Medium cast the fog when lethal is on the table, the
wrath when behind, and hold the wrath when ahead).

**Phase B, the 1.8 and 1.7 mechanics play as designed (gaps 3, 4, 6, 7).**
Tithe: price the discount as tempo (mana saved this turn against the body
sold, with small bodies and tokens sellable when the cast is the better
board), measured on the Lanterns Below precon and rung 26. Hauntlink: host
by rider fit, allow a move when the fit improves, act in the Hauntlink
window (the link-before-damage and link-over-trigger lines the window
exists for). Duty: develop before mana Duties in main two, hold a Charm's
mana when a trick is in hand. Empower: subtract the rider's mana at the
same rate the second-spell alternative earns it. Measurement: rungs 19 to
26 (the Yokai and Drowned Deep bosses are the exposure), plus the precon.

**Phase C, combat keywords (gap 5).** Model twinBlades and sentinel in the
shared combatant, and first strike in Easy's block math. Measurement: the
two brain gates and every rung, since combat touches all of them.

**Phase D, the draft picker (gap 8).** Score Empower, Retell, Whispers,
Tithe, Rite, Skim, Preserve, Duty, marks and Quest as what they are; stop
rewarding Bulwark and Rage as upside; stop counting self-damage as
removal. Personas keep their style knobs on top. Measurement: the
lockstep specs move (they pin the old scorer), so this phase re-baselines
them deliberately, and a new probe checks that the bot's drafted decks
carry their set's mechanic at the pool's rate.

**Phase E, proof and docs.** A reserve-native termination smoke for every
rung 1 to 26 and every Darlings precon (one seed each, under the CI
budget); theme decks at three seeds; brain tests for the code-only claims
in section 5; retire the classic `deck` smoke; rewrite `docs/ai.md` to the
current brains and policy modules. This phase can run first or last; it
costs nothing to gameplay and makes every other phase measurable.

Order recommended: E (the measuring stick), A, B, C, D. A and B are the
player-visible ones. D is the only one whose tests must be re-baselined.

## 8. Owner decisions (RULED 2026-09-15)

- D1 scope: all five phases. RULED.
- D2 order: proof first (E, then A, B, C, D). RULED.
- D3 draft picker: style over strength stays the rule; phase D may make the
  bots know the mechanics but must not turn a Rare-Chaser into a strong
  drafter. RULED.
- D4 CI budget: RULED (approved 2026-09-15): the
  new smokes live in one file with the summit gates' 900 s ceiling, one
  seed per rung and per precon (26 + 9 games, a few minutes on CI), and the
  balance suite stays skipped as the manual tool it is.
- D5 Tithe fodder: RULED (approved 2026-09-15): yes, bounded. The policy may value a body
  below its printed worth only when it is fodder-class (a token, a body of
  Defense 2 or less, or a summoning-sick body that cannot attack this turn),
  never the best body and never a planned attacker (the existing
  protections), and only when the discount is at least two mana or turns an
  uncastable spell castable this turn. That is the Emerge precedent: feed
  the small body, keep the board.

The original decision list follows for the record.

### The questions as asked

- D1. Scope: A only, A+B, or the full A to E.
- D2. Order: E first (build the proof, then change the brains) or A first.
- D3. The draft picker: is pick strength allowed to change, or must the
  bots' current draft quality stay fixed (style over strength is the
  standing rule)?
- D4. CI budget for the new smokes: 26 rung games plus 9 precon games at
  one seed is a few minutes; the skipped balance suite stays skipped.
- D5. Whether the Tithe rework may lower a fresh body's value in the
  policy's eyes (it is a design statement about how cheap fodder should be).

Nothing here is built until the owner rules. Contracts for each phase are
written on approval, in the standing shape (Codex builds, Fable reviews,
gates measured, floors ratchet up only).
