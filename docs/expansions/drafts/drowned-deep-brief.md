<!-- source-of-truth: docs/plan-1.8.md, docs/plan-drowned-deep-engine.md, docs/plan-tap-abilities.md, docs/plan-expansion-slate.md, docs/design-health.md, docs/art-bible/index.md, src/data/axes.ts, src/data/cards/*.ts · last-verified: 2026-09-11 · set identity brief — the owner-approval gate before the Drowned Deep overplan is authored; nothing here is a card -->

# The Drowned Deep: set identity brief

The first step of the fresh authoring pass ruled 2026-09-07 (the earlier
overplan was retired). This brief fixes what the set *is* so that the
320-candidate overplan can be written against it: the world, the colour pie,
what each mechanic is for and who carries it, the mechanic budget, the
enabler density, the subtypes, the answers the sweep demands, the AI-risk
shapes to keep out, and the art register in outline. **Owner approval of
this brief is the gate; no card rows are written before it.** Open
questions are at the end.

Fixed by the spine and the rulings, not up for revision here: the name, the
cosmic-horror concept, Large at 250 cards overplanned to 320, Whispers as the
fresh-graveyard cast, Dread as the Defense-discount sacrifice on Horrors, and
Duty (the tap ability) as the engine feature the set must print.

## 1. The world

**Our own Nor'eastern fishing town, built on the spires of something older,
and a black tide that rises one step a generation.** Owner ruling
2026-09-11: the set has its own town, in the New England coastal mould the
genre was born in, and it is ours, not a borrowed place. Working name
**Dunmarrow** (alternates if the owner prefers: Kettleport, Brinehollow):
granite headlands and a harbour that freezes at the edges, clapboard houses
gone silver with salt, widow's walks, a lighthouse that has not been dark
in three hundred years, wharves and lobster traps and drying nets, a salt
marsh behind the town, fog that comes in with the tide and does not always
leave with it. Bronze bells, tide-gates, salt lamps, mourning silk over wet
stone, glass that has been underwater and come back changed. Below the
harbour floor the older architecture continues down further than any diver
has returned from, and from it comes the Deep.

**The Deep is not a monster. It is a chorus.** It speaks in the voices of the
drowned, and what it offers is real: knowledge, power, the return of what was
lost, at a price the coast has been paying for a thousand years. Whispers are
the Deep's voice reaching a card that has slipped out of your hand or your
deck into the dark; the whispered thing comes back cheaper and stranger.
Horrors are what the Deep sends up: made of the drowned, beautiful, wrong,
wearing faces the coast remembers. Dread is the coast feeding them, one body
at a time, because a Horror on your side of the seawall is the only thing
that stops the one on the other side.

Against the Deep stands the **Lantern Watch**: the wardens, bell-ringers,
salt-witches and tide-priestesses who keep the lamps lit and the gates shut,
one duty at a time. Duty, the tap ability, is theirs: a lamp must be tended,
a bell rung, a gate held, and each of those is a permanent tapping to do its
work.

**Tone**: elegant dread, never gore. Mourning, ritual, the sea at night,
phosphorescence, the wrongness of a familiar face. The cast is the house
cast: adult women throughout, the wardens as fierce and tired professionals,
the Deep's daughters as lovely and unmistakably not human. The regional look
is the anchor (oilskins, wool, sea boots, a captain's coat, a lantern on a
pole), not a period: like every set it stays era-agnostic fantasy, and it
must not read as the retired draft's Victorian promenade.

## 2. The colour pie

Each colour has a job with each mechanic, and the jobs do not overlap.

| Colour | Its part of the coast | Whispers | Dread and Horrors | Duty |
| --- | --- | --- | --- | --- |
| **Blue** | the sea's memory: tide-priestesses, Mermaids, drowned scholars | **primary for Charms** (bounce, cancel, draw) and the main self-mill engine that fuels them | secondary: a few Horrors of the deep water | scryers and tide-readers: tap to Foresee, tap to loot (the set's discard outlet, see section 4) |
| **Black** | the bargain: salt-witches, the Deep's daughters, the drowned | **primary for Rituals** (removal, drain) and opponent discard; self-mill as the Deep taking its due | **primary**: most Horrors, most Dread, the token fodder that feeds them | tap to drain, tap to raise |
| **Green** | the coral growth: kelp gardens, reef-wardens, the coast's living wall | creatures at the fair-body rate (the Arrogant Wurm class) | secondary: reef Horrors; **the Defense-heavy bodies and tokens that are Dread's fodder** | tap to Mark, tap to grow |
| **White** | the Lantern Watch: wardens, bell-ringers, lamp-keepers | few; a Whispers protection Charm or two | none | **the showcase**: Duty artifacts and enchantments (lamps, bells, gates), tap to gain life, tap to tap, the wardens' vigilance |
| **Red** | drowned fire and storm: wreckers, storm-callers, the coast's anger | **the burn Charms** (the Fiery Temper class, instant-speed madness feel) | none | Rage bodies with a Duty, so tapping to dodge the attack is a real choice; tap to damage |

Rules the pie enforces at authoring:

- Dread prints in black first, blue and green second, never white or red.
  That is what keeps "Horror" legible as a colour identity.
- Whispers prints in all five, but the instant-speed feel (Charms in
  windows) lives in blue and red; black Whispers are Rituals; green and
  black Whispers creatures are printed at the fair-body rate with Whispers
  as upside, per the costing.
- Duty prints in all five and on all three carrier types, but the
  artifacts and enchantments that show the engine feature off are white and
  blue. Every colour gets at least two Duty creatures so the AI policy's
  creature branch is exercised across the pie.
- Multicolour stays below ten percent of the overplan and at R or above,
  the shipped-set convention; the two-colour pairs the set cares about are
  U/B (the precon), B/G (the Horror garden) and W/U (the Watch).

## 3. The mechanic budget, at 250

| Mechanic | Cards | Share | Notes |
| --- | --- | --- | --- |
| **Whispers** | 22 | 9% | 8 Charms (U 4, R 3, W 1), 6 Rituals (B 4, U 2), 8 creatures (G 4, B 3, U 1). About half also carry Skim (their own enabler); the rest rely on the mill and discard density below |
| **Dread** (Horrors) | 14 | 6% | B 9, U 3, G 2; every Horror carries Dread, no Horror without it in this set |
| **Duty** | 30 | 12% | 12 artifacts and enchantments (W 5, U 3, B 2, G 1, colourless 1), 18 creatures across all five colours; the 27 utility-tapland conversions ruled under D3 are a separate batch and not counted here |
| **Enablers for Whispers** | 36 | 14% | the density rule (at least 1.5 outlets per Whispers card, at least 4 repeatable choice-discard outlets at common): 14 self-mill effects (arrivals and Dawns, U/B), 6 Duty looters ("tap: draw a card, then discard a card", U 3, B 2, R 1; the Merfolk Looter shape the engine can now print), 16 Skim carriers not counting the Whispers cards' own |
| Evergreen sprinkle | as needed | | all thirteen keywords present; Retell (echoes fit the Deep) and Empower sprinkled; Preserve and Hauntlink absent |
| **Rite** (owner, Q2) | 6 to 8 | 3% | **white and red only**, never on a Horror: the Lantern Watch gives of itself (Rite, mandatory, N creatures) while the Deep bargains (Dread, optional, any number). No card carries both; the pie reads the split |
| Vanilla and near-vanilla commons | at most 30% of commons | | Starborne cut vanilla commons from 59% to 35%; hold that line |

Everything above is a target for the overplan, not a count of the cut; the
cut list decides, with enabler density as a cut constraint the way it was
for Starborne.

## 4. The engine-feature showcase, and the outlet it unlocks

Duty is the 1.8 engine feature and this is the set that ships it, so the
set must print it visibly and in every shape the spec allows: tap alone,
tap plus mana, target-free, targeted, on a creature, on an artifact, on an
enchantment. The white and blue artifacts are the showcase (a lamp that taps
to gain life, a bell that taps to tap a creature, a tide-glass that taps to
Foresee), and the creature carriers show the trade-off the AI policy was
built around (a warden who can attack or keep watch).

One shape matters beyond the showcase: **the Duty looter** ("tap: draw a
card, then discard a card of your choice"). It is a repeatable
choice-discard outlet, the thing this engine has never had, and under the
fresh-graveyard Whispers a chosen discard tags the card with no window. That
is what turns Whispers from a Skim-only trick into a real discard payoff,
and it is the MTG madness deck's engine (Merfolk Looter, priced in the
corpus at one point on a two-mana 1/1). Six of them across blue, black and
red, at least two at common (owner-approved 2026-09-11, Q4).

## 5. Subtypes

- **Horror**: new, zero cards today. It is the set's identity subtype and
  every Dread carrier has it. **Owner ruling 2026-09-11: Horror is an Axis**
  (a static may filter on it), with exactly one Horror lord at Rare, a
  creature whose static buffs the tribe with texture (a keyword grant or a
  conditional, not a fourth flat anthem, per the tribal-pass finding that
  nineteen of twenty-three lords are anthems). Recorded in
  `plan-tribal-pass.md` and `src/data/axes.ts` when the set lands.
- **Deep One** is the species of the Deep's daughters, used as a flavour
  subtype beside Horror. Owner ruling 2026-09-11 after a status check: the
  Deep Ones' source text (*The Shadow over Innsmouth*, 1936) is US public
  domain by non-renewal and "Dagon" (1919) is public domain everywhere;
  Chaosium's game trademarks cover its own product names, not the species.
  Two lines hold: **our own coast** (no Innsmouth, no R'lyeh, no borrowed
  place names, so the set is not fan fiction of a place), and **names from
  Lovecraft's own texts only**, never later authors' additions, which are
  still copyrighted. Father Dagon and Mother Hydra are the natural picks for
  the two Horror URs.
- **Warden** (23 shipped cards) is the Lantern Watch's type and gets white
  Duty carriers; **Spirit** (14) is the drowned; **Mermaid** (an Axis, 6
  cards) is blue's tide-priestess line and finally gets support;
  **Witch** (7) is black's salt-witch line; **Human** as ever.
- Flavour subtypes may print freely and are inert ("Drowned", "Bell-Ringer").
  No payoff for a non-Axis type, the tribal pass rule.

## 6. What the field demands

The 1.7 sweep read control and midrange leading and go-wide trailing, with
Celtic Fae, Starborne and Ragnarok conceding 92 to 95 percent to the
personas. A mill-and-whisper control set pushes further the way the field
already leans, so the set must carry its own counterweight:

- **Go-wide is a real line in this set**, not an afterthought: green and
  white token-makers whose bodies are also Dread fodder, so a wide board
  either attacks or feeds a Horror. The B/G "Horror garden" pair is the
  aggressive deck.
- **Answers to go-wide** stay as the shipped rules require: sweepers are
  Rituals (one white, one black with a cost), one Charm-speed combat
  prevention, and permanent answers at common in white and green.
- **Anti-mill tension is intended.** Every mill and discard the opponent
  aims at you can hand you a Whispers cast; the set prints no "mill the
  opponent" cards precisely because of this (the pool has three, all
  legacy), and the AI's 18 opponent-discard cards become a live risk for
  the AI, which the seeded matrix measures.

## 7. AI-risk shapes to keep out or mark stretch

The Broodmother lesson from 1.7: the AI never assembles thresholds it
cannot plan toward. Keep out, or mark stretch and cut first:

- "Whenever you cast a Whispers card" and "whenever a card leaves your
  graveyard" triggers (multi-card sequencing the AI does not plan).
- Mill-count thresholds ("if seven or more cards are in your graveyard").
- Dread payoffs that need a specific number of bodies sacrificed at once.
- Duty abilities whose value depends on holding the source untapped across
  the opponent's turn (the AI's Afternoon rule taps them).

Greedy-friendly shapes to prefer: Whispers on cards whose value is obvious
when cast (removal, bodies, draw); Dread on Horrors whose printed cost is
honest without fodder; Duty effects with immediate board impact.

## 8. Rarity, tokens, precon, bosses

- **Rarity at 250**, Starborne's locked shares scaled: **124 C / 75 R / 23 SR
  / 16 SSR / 12 UR**. Overplan at 320: about 160 / 96 / 30 / 20 / 14.
  Chosen here, locked at the cut.
- **Tokens**, each with at least two minters in the cut (the 1.7 minterless
  lesson): a black 1/1 Spirit "the Drowned" (from mill and Deep effects), a
  black 2/2 Horror "Deep-Spawn" (Dread fodder that is itself a Horror), a
  white 1/1 Spirit with Skyborne "Lantern Wisp" (the Watch's lights).
- **Precon**: U/B, the tide-and-whisper control deck; name authored with the
  rows. Board-first at common, the whisper line as the value engine, one or
  two Horrors as the finish.
- **Gauntlet bosses**, rungs 25 and 26: a U/B Whispers control boss and a
  B/G Dread Horror boss; the summit gate shape decided before the rungs
  land (the CI budget note in plan-1.8).

## 9. Art register, in outline (for art-bible section 4c)

- **A reserved hue for the Deep's voice** (owner-approved 2026-09-11), the
  Starborne cyan rule applied again: **drowned gold**, a cold phosphorescent
  green-gold (highlight about `#d6e07c`, deep `#7f8a2a`), appears only
  where the Deep speaks: on Whispers cards as the light in the water and on
  Horrors as the light behind the eyes, always against black water so the
  read is black-and-gold. It is deliberately green-shifted away from the
  global multicolour frame gold and the mono-white accent, so a gold-framed
  or white card cannot carry it by accident. Never on lamps, never on
  ambience. The Watch's light is warm lamp amber and is never confused with
  it; bells are bronze, never gold.
- Palette: black water, salt white, granite grey, bell bronze, mourning
  violet, lamp amber, drowned gold (reserved), wet-stone grey as the value
  floor. No true black.
- Composition by mechanic family: Whispers shows the card's own subject
  half-submerged, lit from below by the reserved gold, the water still;
  Dread shows the bodies given going down into the dark as the Horror rises,
  no viscera; Duty shows the act of tending (a hand on the bell rope, the
  lamp being lit), the permanent mid-work.
- Species tells for the Deep's daughters, three and no more: an inner light
  behind the eyes in the reserved gold, hair that moves as if underwater
  even in air, and one drowned detail (a tide-line on the skin, a bell
  chain, weed woven into silk). Wardens have none of the three.
- NO-TEXT as always; the sea variant: no charts, no ship names, no lettered
  bells.

## 10. Rules the rows are written against

All post-dating the retired draft: the reserve accepts only basics and
duals, so the set prints **no lands** (Starborne printed six utility
taplands after the ruling by mistake; not again); no non-creature permanent
may be a one-time effect; `extraLandDrop` carries the mv-2 floor;
marks are creature-scoped; printed plus Empower stays at nine or under; one
printing per set per shape, stricter for tempo; the rarity histogram locked
at the cut; every token minted; every row costed by the power formula at
authoring and run through the overlap comparator against the live pool
before it is written down.

## 11. Owner answers (2026-09-11)

1. **Horror as an Axis: approved**, one lord at Rare (section 5).
2. **Rite: kept, in the non-Dread colours** (white, a little red), never on
   a Horror (section 3).
3. **The reserved hue: approved as recommended.** The owner wanted
   black-gold overtones; a true gold collides with the global multicolour
   frame palette, the mono-white accent, Duat's tomb gold and three other
   sets' gilt, so the hue is the green-shifted phosphor drowned gold of
   section 9 against black water, which keeps the black-and-gold read.
4. **Six Duty looters: approved** (section 4).
5. **World: Deep One names are in** (section 5), and **the town is our own
   Nor'eastern fishing town** (section 1, working name Dunmarrow).

With approval, the next deliverable is the 320-candidate overplan in the
Yokai Nights concretion-doc shape, every row costed and overlap-checked,
with protect-first and cut-priority columns.
