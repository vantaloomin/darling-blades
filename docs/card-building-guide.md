<!-- source-of-truth: src/engine/types.ts, src/data/glossary.ts, balance/power-scores.json, docs/keyword-map.md · last-verified: 2026-08-28 · design doc — how to cost and combine cards; re-verify when a keyword, mechanic, or the power formula changes -->

# Card Building Guide

How to cost a card, and what every existing keyword and mechanic does to the
cards around it. Written after a Starborne review shipped two over-powered
commons that the power formula scored as fine.

Numbers here are measured from `balance/power-scores.json` (333 scored cards)
and `balance/cards.sqlite` (1,079 collectible), both rebuilt with
`npx tsx scripts/card-reference.ts` and `npx tsx scripts/blades-db.ts build`.
Both are gitignored, so the figures are restated here rather than only living in
a script.

## 1. The math

**Budget** is mana value times a rarity multiplier:

| Rarity | Multiplier | Budget at mv3 | Budget at mv5 |
| --- | --- | --- | --- |
| Common | 1.00 | 3.00 | 5.00 |
| Rare | 1.06 | 3.18 | 5.30 |
| Super Rare | 1.15 | 3.45 | 5.75 |
| Super Special Rare | 1.25 | 3.75 | 6.25 |
| Ultra Rare | 1.40 | 4.20 | 7.00 |

**Power** is the sum of the card's parts. A creature body is `(attack + defense) / 2`.
Keywords add a flat value:

| Keyword | Value | | Keyword | Value |
| --- | --- | --- | --- | --- |
| Twin Blades | +1.25 | | Sentinel | +0.40 |
| Skyborne | +0.75 | | Blood Oath | +0.40 |
| Deathblade | +0.75 | | Overrun | +0.35 |
| Untouchable | +0.60 | | Warcry | +0.35 |
| First Blade | +0.50 | | Warding Gaze | +0.20 |
| | | | **Bulwark** | **-0.75** |

Bulwark is the only negative: it cannot attack, so it is a drawback the formula
pays you for.

Useful reference values: one mark is about **+0.70** (Nurture pays 1.4 for two),
`arrives: draw 1` is **+1.24**, a spell that draws is **+1.65**, an anthem of
+1/+1 is **+2.00**, and `spell: counter` is **+2.70**.

**Delta** is power minus budget. Measured bands across the scored pool:

| Rarity | Median | p90 | Max observed |
| --- | --- | --- | --- |
| Common | +0.00 | +0.55 | +1.30 |
| Rare | -0.08 | +0.73 | +1.16 |
| Super Rare | -0.20 | +0.69 | +1.04 |
| Super Special Rare | -0.03 | +0.29 | +2.45 |
| Ultra Rare | -0.18 | +0.40 | +0.88 |

**Aim for a delta near zero.** Past p90 you are asking for the card to be the
best card at its cost, which is a decision, not an accident.

## 2. What "breaking bounds" actually means

A marquee card is allowed to be stronger than its cost suggests, and **the
allowance is already in the budget, not in the delta.** A UR at mv5 gets 7.00
points where a common gets 5.00. That 40% is the licence.

**So a UR that ALSO runs a high delta is double-dipping.** The measured data
bears this out: URs are currently the most conservative tier in the game
(median -0.18, max +0.88), and no UR appears in the pool's ten biggest deltas.
The single largest outlier is an SSR, Kitsune Matriarch Yohime at +2.45, whose
parts are a 3/4 body, two arrival tokens, and a +1/+1 anthem.

Two consequences worth stating plainly:

- **If a UR feels underwhelming, spend the multiplier, not the delta.** Give it
  a bigger body or a second ability inside its 1.4x budget.
- **If you deliberately push a marquee card past its budget, say so in a
  comment on the card.** An unexplained +2 delta reads as an error to the next
  person, and the pool currently contains exactly one.

The floor matters as much: `Lava Axe` sits at **-3.35** and is a deliberate
common. Cards may be under budget on purpose; write down why.

## 3. Where the formula lies to you

**The formula is additive. It has no term for one part multiplying another.**
Every trap below scores as "fine" and is not.

- **Twin Blades multiplies damage.** A +1/+1 mark on a double-striker is worth
  about two damage, not one. Starborne priced `sb-lance-of-two-suns` as a common
  that arrived as a 3/2 Twin Blades for mv3, six damage, when **every shipped
  mv3 Twin Blades body deals four and three of the four are rare**. Its sibling
  `sb-splitlight-corsair` reached ten damage at mv5, which is the UR tier.
  Neither tripped the formula.
- **Overrun multiplies pump.** Excess damage carries to the player, so +X/+X on
  an Overrun body converts directly into reach the formula does not count.
- **Blood Oath multiplies twice over.** Damage becomes life, so pump is doubled
  in value, and **Blood Oath plus Twin Blades quadruples it**.
- **Anthems multiply token swarms.** The pool's biggest delta is exactly this
  shape: tokens plus an anthem on the same card.

**The rule that came out of the Starborne pass:** a mark may be self-targeted
only on a body that does not multiply combat damage. Twin Blades, Overrun, Blood
Oath, and any future double-hit keyword must mark someone else.

**When a card combines two parts that scale with each other, stop trusting the
score and compare against shipped cards at the same mana value instead.** Sort
by the thing that actually matters, usually damage per attack, and see which
rarity tier your card lands in.

## 4. The twelve keywords

Counts are collectible cards; "sets" is how many of the eight shipped sets use it.

| Keyword | Cards | Sets | Colour home | Watch for |
| --- | --- | --- | --- | --- |
| **Skyborne** | 94 | 8 | U 43, B 18, W 12 | The most common evasion. A deck with no Skyborne and no Warding Gaze **cannot block a flier at all**; the five starter reserve columns field 21 Skyborne against only 9 Warding Gaze. |
| **Warding Gaze** | 45 | 8 | G 37 | Green's answer to the above, and almost only green's. Moving it elsewhere quietly changes which colours can defend themselves. |
| **First Blade** | 45 | 7 | R 15, W 15 | **Beats Deathblade**: it kills first, so the deathtouch never lands. A cheap First Blade body invalidates an expensive Deathblade one. |
| **Twin Blades** | 20 | 5 | R 7, W 5 | Highest keyword value at +1.25, and it **multiplies every pump effect**. See section 3. |
| **Warcry** | 74 | 8 | R 57 | Haste. Overwhelmingly red; it reads as off-colour anywhere else. |
| **Overrun** | 44 | 8 | G 25, R 10 | Multiplies pump into direct reach. Deceptively strong on a big body. |
| **Sentinel** | 79 | 8 | W 43 | Attacking does not tap. Pairs with anything that rewards a wide untapped board. |
| **Bulwark** | 22 | 7 | U 7, W 7, G 6 | **Cannot attack**, priced at -0.75. Never combine with attack triggers, and remember `Wolfsbane Ward` grants it as a form of removal. Safe home for self-targeting marks, since nothing doubles. |
| **Deathblade** | 40 | 7 | B 33 | Blanks big bodies. The starter columns field **22 Deathblade creatures**, so a set full of expensive fatties will underperform against them. |
| **Blood Oath** | 28 | 8 | W 10 | Lifelink. Multiplies with pump, and squares with Twin Blades. |
| **Untouchable** | 23 | 6 | U 12 | **One-sided**: opponents cannot target it, your own spells still can. A removal-light deck simply loses to it, so it needs sweepers or blockers in the format. |
| **Dreaded** | 28 | 5 | B 12 | Needs two blockers. Strong against go-wide decks that want to trade one for one. |
| **Rage** | 1 | 1 | R 1 | **Attacks every turn if it is able to**, and the only DRAWBACK keyword besides Bulwark. Priced at -0.45, or -0.15 when the card already carries Twin Blades, Warcry, Overrun or First Blade, because a creature built to attack loses almost nothing by being told to (power-formula §4o). Never put it on a card you want back on defence, and never on a body whose value is a blocking statline. Bulwark beats it outright: "cannot attack" wins over "if able". |

### What your card will actually face

Every balance harness measures against the five starter reserve columns, so this
is the field a new card is judged in. Measured 2026-08-25 across their 163
creature slots:

| Keyword | Count | | Keyword | Count |
| --- | --- | --- | --- | --- |
| Deathblade | 22 | | Sentinel | 12 |
| Skyborne | 21 | | Blood Oath | 10 |
| Warcry | 16 | | Warding Gaze | 9 |
| First Blade | 15 | | Overrun | 5 |
| | | | Bulwark | 2 |
| | | | Untouchable | 2 |
| **Twin Blades** | **0** | | **Dreaded** | **0** |

Three things fall out of this:

- **Big bodies are punished.** 22 Deathblade creatures mean an expensive fatty
  trades with a 1/3. A set of costly threats will measure worse than its raw
  numbers suggest, which is exactly what happened to Anubis before her retune.
- **Fliers are barely answered.** 21 Skyborne against 9 Warding Gaze, and a
  creature with neither cannot block a flier at all.
- **Twin Blades and Dreaded are untested here.** The baseline field contains
  none of either, so a card built around them is measured against opponents who
  cannot demonstrate the weakness. Treat their win-rate numbers with suspicion
  and check them against the theme precons too.

## 5. The twelve mechanics

| Mechanic | Cards | Sets | Status | Watch for |
| --- | --- | --- | --- | --- |
| **Foresee** | 174 | 7 | Evergreen | The safest sprinkle in the game and the most used. Nearly free on any card that wants a small upside. |
| **Sever** | 86 | 8 | Evergreen | Permanent removal; severed cards never return. **Anti-synergy with your own Retell and Preserve**, which both need cards in the graveyard. |
| **Skim** | 67 | 4 | Re-usable | Discard this, draw a card. Smooths a clunky hand; a set of expensive cards wants it. |
| **Retell** | 37 | 4 | Re-usable | Cast from the graveyard, then Sever it. Dies to opposing graveyard hate and to your own Sever effects. |
| **Empower** | 34 | 6 | Re-usable | An additional cost for a bonus. **Printed cost plus Empower must not exceed 9**, with a hard ceiling of 10 because the land reserve holds ten. |
| **Nine Lives** | 30 | 2 | Re-usable | **Returns only if it died with NO marks on it.** See the warning below. |
| **Preserve** | 27 | 2 | Re-usable | Pay, then Sever it from the graveyard for a token copy, main phase only. Competes with Retell for the same graveyard. |
| **Quest** | 18 | 1 | Re-usable | Chapter advance at each dawn, then it leaves. Has only appeared in one set so far, which is history rather than a rule. Needs a card whose story wants several turns to tell. |
| **Hauntlink** | 16 | 3 | Re-usable | Links a permanent to one of your creatures at Charm speed. The linked creature dying is a real cost. |
| **Mark** | 13 | 7 | Evergreen, **scarce** | Only 13 collectible cards create marks and **10 of them mark only themselves**. Any payoff that reads marks needs its own enablers shipped alongside it. |
| **Rite** | 11 | 1 | Re-usable | Sacrifice creatures as an additional cost. Only one set so far, which is history rather than a rule. **Needs fodder shipped alongside it**, which is the job Duat did; a set with a token package already has it. |
| **Champion Awakening** | 7 | 3 | Rare | A one-way upgrade granting listed stats and keywords. Smallest population in the game; treat as a marquee tool. |

### Nine Lives against marks: INTENDED FRICTION, ruled 2026-08-26

Nine Lives reads: *"when this dies with no +1/+1 marks on it, it returns to the
battlefield with a +1/+1 mark on it."* **Putting a mark on a Nine Lives creature disables its
return**, verified in `EffectInterpreter.ts`, which bails on
`fallen.plusOneCounters !== 0`. There are 30 Nine Lives cards, 11 of them
commons, across Dark Tales and Sands of the Duat.

**Owner ruling: this is intentional friction and a real decision, not a defect.
Do not design it away.** Marking a Nine Lives creature trades its second life
for a permanent +1/+1, and a player who knows both cards is making a choice
rather than being punished.

Two facts that make the ruling hold, and that a future change could break:

- **The choice is genuinely the player's on 19 of the 24 Starborne generators**,
  which target. (An earlier count said 25; Propagation Choir is a payoff that
  triggers on marks being added, not a generator.) All 13 mark generators in the pre-Starborne pool are
  self-targeting or "target creature you control", so the collision could not
  happen by accident before this set at all.
- **The rule is discoverable in-game**, though only through the glossary. The
  card face prints the bare keyword `Nine Lives.`; the condition lives in
  `MECHANIC_DEFINITIONS`. That is enough for a player to learn it once and play
  around it afterwards, which is what makes it friction rather than a trap.

**What would break the ruling.** A non-optional, board-wide mark effect removes
the decision and makes the interaction silent. Starborne ships three:
`sb-orbital-graft` (common, marks every creature that arrives, always on),
`sb-brood-communion`, and `sb-the-long-crossing`. The latter two are opted into
by casting them. `sb-orbital-graft` is the one to watch, because it is a common
and it is permanent once resolved.

Both mechanics also reach the same Limited pool: `packPool` is called with no
set for Limited, and its own comment confirms "undefined remains the mixed-set
pool", so a draft can contain Orbital Graft alongside the eleven Nine Lives
commons.

**Rule going forward: a non-optional mark effect that hits creatures you did not
choose is a checked interaction.** Prefer "target creature you control" unless
the board-wide version is the point of the card, and if it is, expect it to
switch off Nine Lives for that player.

### Every mechanic is re-usable

**Owner ruling 2026-08-25: nothing on this list is locked to its home set.**
Quest and Rite have each appeared in only one set so far, but that is a record
of what has happened, not a constraint on what may. Both are available to any
future set that has a use for them.

The two carry a prerequisite rather than a restriction:

- **Rite needs sacrifice fodder in the same format.** Duat shipped the fodder
  its Rite cards needed. A set with a token package already satisfies this.
- **Quest needs a card whose story takes several turns.** It is the heaviest
  mechanic here in AI terms, because a greedy evaluator undervalues a payoff
  three dawns away. Seed the win-rate evidence before shipping one as `core`.

Everything else recurs, and the house convention for a new set is visible in
Sands of the Duat, which carried **Skim 4, Retell 8, and Empower 8** alongside
its own new mechanic. A set that ships zero returning mechanics is the outlier,
not the norm.

## 6. Before a card ships

1. **Score it.** Body plus parts against `mv x rarity multiplier`. A delta past
   your rarity's p90 is a decision to defend, not a rounding error.
2. **Check for multiplication.** If two parts scale with each other, ignore the
   score and compare against shipped cards at the same mana value, sorted by
   real output.
3. **Check the colour home.** A keyword outside its usual colour is a design
   statement; make sure it is intended.
4. **Check for a functional duplicate.** Same normalised cost, same stats, same
   rules text as a shipped card means you have reprinted it. A different subtype
   is genuine differentiation in a game with tribal payoffs; a Charm has no
   subtype to hide behind. See [design-health.md](design-health.md).
5. **Check the anti-synergies.** Sever against Retell and Preserve. Marks
   against Nine Lives. First Blade against Deathblade.
6. **Check Empower arithmetic.** Printed plus Empower at most 9.

## Related

- [keyword-map.md](keyword-map.md) is the naming authority and records which
  Magic keyword each term maps to.
- [design-health.md](design-health.md) tracks the pool-wide functional duplicate
  rate.
- [adding-cards.md](adding-cards.md) is the implementation path once a card is
  designed.
