<!-- source-of-truth: docs/plan-1.6-large-set.md, src/data/cards/*.ts, src/engine/types.ts, scripts/blades-db.ts, mtg-cache/cards.sqlite · last-verified: 2026-08-17 · design/plan doc — mechanical skeleton, nothing here is implemented -->

# Sands of the Duat — mechanical skeleton and costing bands

Mechanics-only design pass for the 1.6 large set. Slot ids are placeholders;
the creative layer (names, flavor, art refs) is owned by a parallel agent and
binds to these ids. Every cost claim below cites the query and the sample size
behind it, per the playbook's "quote real numbers" rule. All corpus reads
calibrate — no oracle text or card text is copied from the MTG corpus anywhere
in this document, and the specs are written purely in our EffectOp vocabulary.

Verification state of the vocabulary: every op named in §3 exists in
`src/engine/types.ts` (`EffectOp` union, line 62) **except** the three new
mechanics, which do not exist yet and are written here exactly as the
concretion draft defines them (see §3.0). Engine build order remains
Rite → Nine Lives → Preserve, each with tests and an AI heuristic before any
card data names them.

---

## 1. The frame

### 1.1 What shipped sets actually look like (derived 2026-08-17)

From `balance/cards.sqlite` (built 2026-08-16 from `CARD_DB`, includes Yokai
Nights):

```
npx tsx scripts/blades-db.ts query "SELECT set_code, rarity, COUNT(*) n FROM cards
  WHERE collectible=1 AND set_code IN ('NEON','DARK','NOCT') GROUP BY set_code, rarity"
```

| Set | total | c | r | sr | ssr | ur |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Yokai Nights (NEON, 1.5) | 120 | 60 | 36 | 11 | 8 | 5 |
| Dark Tales (DARK, 1.4) | 120 | 60 | 36 | 11 | 8 | 5 |
| Nocturne Manor (NOCT, 1.3) | 82 | 41 | 25 | 7 | 5 | 4 |

The two most recent sets are **byte-identical** on rarity: 60/36/11/8/5, i.e.
50% / 30% / 9.2% / 6.7% / 4.2%. That is the template; NOCT is the same shape at
81-card scale. The concretion draft's instruction ("mirror the shipped
distribution at 2x") is therefore unambiguous.

Color (same query keyed on colors; NEON n=120, DARK n=120):

- **NEON model**: flat mono spread (W 23 / U 24 / B 22 / R 23 / G 23), zero
  multicolor, zero colorless — its 10 artifacts all carry a color — plus 5
  common dual lands.
- **DARK model**: skewed mono (U 25 / B 19 / W 14 / G 13 / R 10), 16
  multicolor, 9 colorless, 14 lands (a 12-common land cycle + 2 rare lands).

Type mix: NEON is creature-forward (78/120 = 65% creatures); DARK is
spell-forward (45/120 = 37.5% creatures, 21 artifacts, 32 Charms+Rituals).

Tribal density precedent (primary-subtype count per set): NEON's headline
tribe, Kitsune, is **21 creatures of 120** plus **3 `typal-kitsune` payoff
statics**, spread across all five colors but concentrated in two (query:
`typal-*` tags per set; NEON Kitsune colors: R 5, W 4, U 4, B 3, G 3, spanning
c through ur). Oni is the second tribe at 17. That is the shape a headline
tribe takes here: roughly 17% of the set's cards, five-color presence, two-color
center of mass, faces at every rarity.

### 1.2 The Sands of the Duat frame at 245

245 = the 120-card template at 2x (240 = 120c/72r/22sr/16ssr/10ur) plus 5
slots (+2c, +2r, +1sr) so the dual cycle rides inside the common count the way
NEON's did. Color model: the set needs what NEON did not have — multicolor
god-tier legends (the Rite payoffs) and a real artifact family (relics,
canopics, funerary gear feeding Rite fodder and Preserve value) — so the frame
blends the NEON flat-mono spine with a DARK-scale multi/colorless allocation.

| | c | r | sr | ssr | ur | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| W | 21 | 12 | 4 | 2 | 1 | 40 |
| U | 21 | 12 | 4 | 2 | 1 | 40 |
| B | 21 | 12 | 4 | 2 | 1 | 40 |
| R | 21 | 12 | 4 | 2 | 1 | 40 |
| G | 21 | 12 | 4 | 2 | 1 | 40 |
| Multicolor | 0 | 8 | 2 | 5 | 4 | 19 |
| Artifact / colorless | 12 | 6 | 1 | 1 | 1 | 21 |
| Dual lands | 5 | 0 | 0 | 0 | 0 | 5 |
| **Total** | **122** | **74** | **23** | **16** | **10** | **245** |

Shares: 49.8% / 30.2% / 9.4% / 6.5% / 4.1% — within half a point of the
template on every tier.

- **Duals**: one 5-card draftable cycle at common, the #213 class (arrives
  tapped, taps for either color, dies for good), pairs chosen by archetype in
  §3.7. Mirrors NEON exactly (5 common duals inside the count).
- **Artifacts**: 21 (DARK shipped 22; NEON 10). The Duat wants the DARK-scale
  count: fodder-generating relics for the Rite engine and grave-value trinkets
  for Preserve. Watch the `inert` detector — DARK's artifact wave is where the
  39% ETB-only finding came from.
- **Creature share**: target ~60% (≈145 of the 240 non-land cards) — between
  NEON's 65% and DARK's 37.5%, leaning NEON because all three new mechanics
  live on bodies.
- **Bastet tribal density**: scale the Kitsune precedent (21/120 + 3 payoffs)
  to 2x with the "aggressive spine" mandate: **34 Bastet creatures + 3 typal
  payoff statics + 1 tribal support card**. Per color: **W 12, R 12, G 4, B 4,
  U 2** — the W/R center of mass the aggro spine needs, with the five-color
  presence tribal governance expects. Bastet enters as a new tribal Axis
  before any of this is authored (concretion gate item 4).

---

## 2. Precedent bands

Method note: the era discipline (playbook §5) cannot be applied literally to
the three new mechanics, because their MTG analog families are all post-2010
(undying 2011, emerge 2016, embalm/eternalize 2017; the sacrifice-additional-
cost creature template is 2018+ — a pre-2015 era-filtered query on that
phrasing returns **zero creature rows**). So each band below measures the
**premium** the analog family paid over its own era's baseline, then
transplants that premium onto our measured curve, with an explicit direction
note for where the Warchest format bends the number. Our own common creature
curve (blades-db, collectible commons, n per row 10-80):

| mv | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| avg atk/def | 0.9/1.6 | 1.7/1.9 | 2.1/2.6 | 2.9/3.5 | 3.9/4.2 | 5.3/5.0 |

### 2.1 Rite N — sacrifice N creatures as an additional cost

Precedent pulled (mtg-db, `funny=0`):

- Sacrifice-a-creature additional-cost **creatures** (n=7, all 2018+): the
  family clusters at roughly **+2 to +3 mana of body value** over the printed
  cost — e.g. a 2-mana common carrying a 5/4 body, a 4-mana rare carrying a
  6/6, a 5-mana common carrying a 7/6.
- Emerge (n=15): effective printed costs of 7-10 buying 3/4 to 7/7 bodies,
  with the sacrifice discounting by the fodder's full mana value — confirms
  the exchange rate "one sacrificed body ≈ its mana value in stats, plus the
  card".
- Sacrifice **two or three** creatures as an additional cost: n=2, both
  noncreature spells. **Rite 2 and Rite 3 have essentially no MTG creature
  precedent** — the real analog is Yugioh tribute summoning, which the corpus
  cannot price. Rite 2+ is extrapolation and must be flagged for the balance
  pass (§4).

**Costing band (our vocabulary).** A Rite 1 body is worth its printed cost
**plus ~2 mana** on the common curve; each additional Rite unit adds **~1.5
mana** of value, not 2, because the setup requirement compounds. So:

- Rite 1 at printed mv 4 → stats of a ~6-mv body (≈5/5 at common).
- Rite 2 at printed mv 5 → stats/riders of a ~8.5-mv body (≈7/6 at rare).
- Rite 3 at printed mv 7 → the ~11-mv ur god (≈10/8 plus a rider).

**Where the Warchest bends the MTG number, and which way:** downward.
A 40-card deck and a 5-card opening hand make every sacrificed *card* a larger
fraction of total resources than in Magic, so precedent (already the power-
creep era) overpays these bodies — hence +2 rather than +3 at Rite 1. The
guaranteed Warchest land drop also removes the "cheat a big body out early"
appeal that justifies modern pushed rates: our decks reach 5-6 mana reliably
anyway. Corollary: the Rite engine must run on **token fodder** (scarabs,
attendants that replace themselves), never on real-card fodder, or the
archetype pays double.

**Engine-vocabulary constraint discovered while speccing:** `TriggerWhen` has
`dies` = *this creature* dies, and no "whenever another creature dies"
observer trigger. Aristocrat-style payoff enchantments are outside the current
vocabulary. The archetype's payoff therefore lives **on the fodder itself**
(dies-triggers on the sacrificed bodies) and on the Rite bodies' arrival
triggers. This is AI-friendly (value is automatic) and is reflected in §3.1.

### 2.2 Nine Lives — dies without a life mark, returns once with a life mark

Precedent pulled: undying creatures (mtg-db, n=22 across mv 1-7, 2011-2024).
At common/uncommon mv 2, undying bodies run 1/1 to 2/1 against that era's
common baseline of ~1.6/1.8 (playbook §5, 2010-2017 row) — i.e. the mechanic
is paid for with **about one total stat point, or ~1 mana**, at small sizes.
At 4+ mana the family shifts to rare with bigger tempo swings (5/4 at mv 4)
but those carry heavy color pips and set-mechanic context; the low-rarity
signal is the clean one.

**Costing band.** On a common or rare body, Nine Lives costs **one total stat
point off our curve** (equivalently ~+1 mana). A {1}{B} common that would be
2/2 vanilla is 2/1 with Nine Lives. Dies-trigger riders on a Nine Lives body
are costed at **double face value** — they fire on both deaths.

**Where the Warchest bends the MTG number:** upward (charge the full tax,
never discount). Three reasons: (1) 40-card decks and 5-card hands make card
economy scarcer, so a creature that is two creatures is worth relatively more
than in Magic; (2) the AI pilots it perfectly — it is free value with zero
planning, so there is no "played below paper rate" discount of the Midnight
Storybook kind; (3) against our AI's greedy attack heuristics, a body that
must be killed twice blanks two attack steps, not one.

**Mark-system note.** "Life mark" rides the existing marks system
(`plusOneCounters` + the `addCounters` op), exactly as the concretion draft's
"dies-triggers + marks exist" costing assumed: the return adds one mark, and
the mechanic checks for zero marks. This imports the known undying
interaction: any *other* mark placed on the body switches Nine Lives off.
That is precedented and acceptable, but it is a real anti-synergy with
mark-support cards (e.g. Empower riders that add marks) and is on the §4
measure list.

### 2.3 Preserve {cost} — sever from your graveyard, pay, token copy

Precedent pulled: embalm (n=15) and eternalize (n=13), costs extracted from
oracle text via SQL substring against printed cost.

- Embalm premium over printed cost: **+0 to +3, median +2** (a 2-mv common at
  +2, a 4-mv common at +3, mid-size rares at +1 to +2). One 6-mv rare pays
  **less** than printed (a −3 discount) — a deliberate top-rarity splash, not
  the band.
- Eternalize (the token comes back bigger): **+2 to +4**, concentrated at
  rare. Treat as the price of an *upgraded* return, reserved for sr+ if ever
  used.

**Costing band.** Preserve cost = **printed cost + 2 generic** at common
(keeping the color pip), **+1 to +2 at rare and above**, and **never below
printed cost except at ur**, where a single showcase discount (the 6-mv +(−1)
shape) is allowed and flagged. The token copy is the full body; a card whose
value is concentrated in an arrival trigger effectively doubles that trigger,
so ETB-heavy Preserve cards price the trigger twice, like Nine Lives
dies-riders.

**Where the Warchest bends the MTG number:** stay at the top of the band.
A 40-card deck fills the graveyard proportionally ~50% faster than a 60-card
one, so grave value is more consistent here; the guaranteed land drop makes
the late 5-7 mana activation reliably payable, where in Magic it sometimes
rots. Two of our rules push the other way and roughly cancel: Sever is
one-way (no re-buy, ever) and the activation is sorcery-speed main-phase
only. Net: **+2 is the floor at common, not the ceiling.**

### 2.4 Returning three (our own corpus is primary precedent)

- **Retell** (n=12 shipped, all DARK, c through ssr): the house band is
  **Retell cost = printed cost + 1 generic** at c/r ({1}{U} → {2}{U},
  {3}{B} → {4}{B}), stretching to **+2** on the one ssr 5-drop. Duat Retell
  cards (6-8 planned, c/r per the quota) copy this band unchanged — the
  40-card-deck consistency argument was already priced into DARK and the
  measured win rates own it now.
- **Empower** (n=21 shipped, CORE/NOCT): riders are **{1}+pip on 2-mv
  commons, {2}+pip everywhere else** (19 of 21), buying roughly the rider
  cost + 1 in effect value because it rides an already-cast spell. Duat's 5-6
  Empower cards keep the {2}+pip shape; Empower-into-marks specs must respect
  the Nine Lives anti-synergy note above.
- **twinBlades** (n=8 shipped, all RAGN, r through ur — note: **zero at
  common** so far; Duat's common sprinkle is new ground): shipped carriers
  keep attack ≤ printed mv − 1 (a {2}{W} 2/2, {3}{R} 3/2, {4}{R} 4/4), i.e.
  the keyword is priced as ~+1.5-2 mana on attack-relevant bodies. For the
  common sprinkle, hold attack to **2 or less** — twinBlades doubles attack,
  so a common 2/1 carrier already swings for an effective 4.

---

## 3. The mechanical skeleton — 45 exemplar slots

### 3.0 New-mechanic data shapes (as the concretion draft defines them)

These fields do **not** exist in `src/engine/types.ts` yet. They are written
here in the style of the shipped `EmpowerDef`/`RetellDef` riders and land
engine-first before any card below is authored.

```ts
// CardDef additions (draft):
rite?: { n: number };          // additional cast cost: sacrifice n creatures
nineLives?: true;              // dies with no marks -> return with one mark, once
preserve?: { cost: ManaCost }; // sever from grave + pay -> token copy; main phase
```

Player-facing reminder text (drafted here so the creative agent inherits it;
no em-dashes):

- **Rite N** "As an additional cost to cast this, sacrifice N creatures."
- **Nine Lives** "When this dies with no marks on it, return it to the
  battlefield with a mark on it."
- **Preserve {cost}** "Pay {cost} and Sever this card from your graveyard:
  create a token copy of it. Use only during your main phase."

New tokens required (tokens.ts additions, non-collectible):

- `tok-duat-scarab` — Creature, subtypes [Scarab], B, 1/1. The Rite fodder
  unit.
- `tok-bastet-kit` — Creature, subtypes [Bastet, Kit], W, 1/1. Counts for the
  Bastet Axis (the Bloomling/Fae lesson: set tokens must feed their own
  tribal statics).

Spec format: `SLOT-ID · cost · type line · stats · rarity`, then mechanics.
All op names verified against the `EffectOp` union; triggers never target
(v1 rule), and every trigger op below is trigger-safe.

### 3.1 Rite sacrifice engine (8 slots, B/R center)

The engine's three rungs: fodder that replaces itself, mid-rarity Rite 1
bodies at the band, god-tier Rite 2-3 at the top. Payoffs live on the fodder's
own dies-triggers (see §2.1 engine constraint).

| Slot | Cost | Type | Stats | Rar | Mechanics |
| --- | --- | --- | --- | --- | --- |
| RITE-C-01 | {1}{B} | Creature — Jackal Attendant | 1/1 | c | `arrives: [{op:'createToken', token:'tok-duat-scarab', count:1}]` (two bodies for two mana; the premier Rite feed) |
| RITE-C-02 | {1}{B} | Creature — Scarab Keeper | 1/2 | c | `dies: [{op:'createToken', token:'tok-duat-scarab', count:1}]` (fodder that replaces itself when fed) |
| RITE-C-03 | {3}{B} | Creature — Jackal Guardian | 5/5 | c | `rite: {n:1}` (the band demonstrator: printed 4 + 2 ⇒ 6-mv stats, just under the 5.3/5.0 common 6-mv line) |
| RITE-R-04 | {2}{R} | Creature — Sunfire Herald | 4/3 | r | `rite: {n:1}`, keywords `[warcry]` (printed 3 + 2 ⇒ 5-mv body; warcry makes the sacrifice tempo-neutral) |
| RITE-R-05 | {4}{B} | Creature — Tomb Colossus | 7/6 | r | `rite: {n:2}` (printed 5 + 3.5 ⇒ ~8.5-mv stats; the no-precedent extrapolation rung, watch it) |
| RITE-SR-06 | {3}{B}{B} | Creature — Gatekeeper Judge | 6/6 | sr | `rite: {n:2}`, keywords `[dreaded]`, `arrives: [{op:'severGrave', n:2, who:'opponent'}]` (judgment rider; grave hate the Preserve mirror match wants) |
| RITE-SSR-07 | {4}{B}{B} | Legendary Creature — God | 8/7 | ssr | `rite: {n:2}`, keywords `[bloodoath]`, `attacks: [{op:'loseLife', n:2, who:'opponent'}]` |
| RITE-UR-08 | {5}{B}{R} | Legendary Creature — God | 10/8 | ur | `rite: {n:3}`, keywords `[dreaded, warcry]`, `arrives: [{op:'damage', n:3, to:'opponent'}]` (the tribute apex; §4's first measurement target) |

### 3.2 Nine Lives attrition aggro (6 slots, W/B/R/G, Bastet-adjacent)

Band applied: one stat point off the curve at c/r; dies-riders priced twice.

| Slot | Cost | Type | Stats | Rar | Mechanics |
| --- | --- | --- | --- | --- | --- |
| NINE-C-01 | {W} | Creature — Bastet Kit | 1/1 | c | `nineLives: true` (1-drop that trades twice; counts for Bastet) |
| NINE-C-02 | {1}{B} | Creature — Tomb Prowler | 2/1 | c | `nineLives: true` (curve says 1.7/1.9; pays the defense point) |
| NINE-C-03 | {2}{R} | Creature — Alley Pouncer | 2/1 | c | `nineLives: true`, keywords `[warcry]` (3-mv curve is 2.1/2.6; warcry + the mechanic eat the difference) |
| NINE-R-04 | {2}{B} | Creature — Duskmane Skirmisher | 3/2 | r | `nineLives: true`, `dies: [{op:'loseLife', n:1, who:'opponent'}]` (fires on both deaths; priced as a 2-point drain) |
| NINE-R-05 | {3}{G} | Creature — Sacred Lioness | 4/3 | r | `nineLives: true` (4-mv common curve 2.9/3.5, rare headroom pays the tax) |
| NINE-SR-06 | {2}{W}{B} | Creature — Twilight Priestess | 3/3 | sr | `nineLives: true`, keywords `[bloodoath]` (the attrition-mirror face) |

### 3.3 Preserve grave value (7 slots, W/U/B center, one G splash)

Band applied: Preserve = printed + 2 generic at c, +1 at r/sr, one flagged ur
discount. Self-`grind` is the enabler; arrival riders price twice.

| Slot | Cost | Type | Stats | Rar | Mechanics |
| --- | --- | --- | --- | --- | --- |
| PRES-C-01 | {1}{U} | Creature — River Scribe | 2/1 | c | `preserve: {cost:{3}{U}}`, `arrives: [{op:'foresee', n:1}]` |
| PRES-C-02 | {2}{W} | Creature — Temple Attendant | 2/3 | c | `preserve: {cost:{4}{W}}`, `arrives: [{op:'gainLife', n:2}]` |
| PRES-C-03 | {3}{B} | Creature — Embalmers' Porter | 3/3 | c | `preserve: {cost:{5}{B}}`, `arrives: [{op:'grind', n:2, who:'self'}]` (body + enabler in one card) |
| PRES-R-04 | {2}{B} | Creature — Canopic Warden | 2/2 | r | `preserve: {cost:{3}{B}}`, `arrives: [{op:'grind', n:3, who:'self'}]` (rare gets the +1 band) |
| PRES-R-05 | {3}{U} | Creature — Ibis Watcher | 3/2 | r | `preserve: {cost:{4}{U}}`, keywords `[skyborne]` (evasion priced in attack per the Skyborne table) |
| PRES-SR-06 | {4}{W}{W} | Creature — Sun-Barge Captain | 4/5 | sr | `preserve: {cost:{5}{W}}`, keywords `[sentinel]`, `arrives: [{op:'gainLife', n:3}]` |
| PRES-UR-07 | {5}{G} | Creature — Flood Colossus | 7/7 | ur | `preserve: {cost:{4}{G}}`, keywords `[overrun]` (the deliberate below-printed discount, precedented at exactly one top-rarity analog; §4 flag) |

### 3.4 Retell bridge (3 of the 6-8 quota slots; the rest come with the full set)

House band: printed + 1 generic. These three seed the Dark Tales pool bridge.

| Slot | Cost | Type | Rar | Mechanics |
| --- | --- | --- | --- | --- |
| RET-C-01 | {1}{W} | Charm | c | `spell, targets:[{what:'creature'}], ops:[{op:'boost', p:2, t:2, scope:'target'}]`; `retell: {cost:{2}{W}}` |
| RET-C-02 | {1}{B} | Ritual | c | `spell, ops:[{op:'grind', n:2, who:'self'}, {op:'loseLife', n:1, who:'opponent'}]`; `retell: {cost:{2}{B}}` (feeds Preserve, then casts again from where it lands) |
| RET-R-03 | {2}{R} | Ritual | r | `spell, targets:[{what:'creature'}], ops:[{op:'damage', n:3, to:'target'}]`; `retell: {cost:{3}{R}}` |

### 3.5 Empower ramp (5 slots, G/W; extraLandDrop class only, never land-fetch)

Shipped extraLandDrop class (n=10): {1}{G} Ritual at 2-mv, 3-mv creatures and
Rituals at c/r. Duat adds a 2-mv creature rung and a double-drop rung — both
adjacent to, not on top of, shipped shapes (dominance check in §4).

| Slot | Cost | Type | Stats | Rar | Mechanics |
| --- | --- | --- | --- | --- | --- |
| EMP-C-01 | {2}{G} | Creature — Oasis Tender | 1/2 | c | `arrives: [{op:'extraLandDrop', n:1}]` (cheapest body-ramp rung yet; verify no dominance against the shipped 3-mv class before authoring) |
| EMP-C-02 | {3}{G} | Ritual | — | c | `spell, ops:[{op:'extraLandDrop', n:2}]` (the new double-drop rung; the Reserves pile makes it reliably live) |
| EMP-R-03 | {3}{G} | Creature — Nile-Bloom Shaman | 2/4 | r | keywords `[wardingGaze]`; `empower: {cost:{2}{G}, ops:[{op:'addCounters', n:2, to:'self'}]}` (mark-based Empower; deliberately NOT combined with Nine Lives anywhere, see §2.2) |
| EMP-SR-04 | {4}{G}{G} | Creature — First-Flood Behemoth | 6/6 | sr | keywords `[overrun]`; `empower: {cost:{3}{G}, ops:[{op:'boost', p:2, t:2, scope:'allYours'}]}` (the ramp payoff) |
| EMP-SSR-05 | {5}{W} | Legendary Creature — Sun Regent | 5/5 | ssr | keywords `[skyborne, sentinel]`; `empower: {cost:{3}{W}, ops:[{op:'createToken', token:'tok-bastet-kit', count:2}, {op:'gainLife', n:3}]}` (crosses into Bastet go-wide) |

### 3.6 Bastet tribal (8 slots, W/R spine; twinBlades sprinkle lives here)

Governance: `filter.subtype` names only the Bastet Axis. Common twinBlades
carriers hold attack ≤ 2 (§2.4).

| Slot | Cost | Type | Stats | Rar | Mechanics |
| --- | --- | --- | --- | --- | --- |
| BAST-C-01 | {1}{W} | Creature — Bastet Warrior | 2/1 | c | keywords `[sentinel]` (curve-fair aggro glue) |
| BAST-C-02 | {1}{R} | Creature — Bastet Raider | 2/1 | c | keywords `[warcry]` |
| BAST-C-03 | {2}{W} | Creature — Bastet Duelist | 2/1 | c | keywords `[twinBlades]` (first-ever common carrier; effective 4 attack, so the body stays 2/1) |
| BAST-C-04 | {2}{G} | Creature — Dune Stalker | 3/2 | c | (vanilla; the G tribal presence) |
| BAST-R-05 | {2}{W} | Creature — Standard-Bearer | 2/2 | r | `static: {scope:'filter', filter:{subtype:'Bastet', other:true}, p:1, t:0}` (the lord; +1/+0 keeps the twinBlades multiplication in check) |
| BAST-R-06 | {3}{R} | Creature — Blade-Dancer | 3/2 | r | keywords `[twinBlades]` (mirrors the shipped RAGN r-rarity shape exactly) |
| BAST-SR-07 | {3}{W}{R} | Creature — War-Priestess | 3/3 | sr | keywords `[twinBlades]`; `static: {scope:'filter', filter:{subtype:'Bastet', other:true}, p:1, t:1}` (lord + carrier; §4 stacking flag) |
| BAST-UR-08 | {3}{R}{W} | Legendary Creature — Bastet Queen | 5/4 | ur | keywords `[twinBlades, warcry]`, `nineLives: true` (the set's face card and its only twinBlades + Nine Lives crossover; balance-watch by design) |

### 3.7 Removal glue (3 slots) and the dual cycle (5 slots)

Glue, costed against our shipped removal (spot removal avg mv 2.78 n=9;
sweepers avg mv 4.67 n=6):

| Slot | Cost | Type | Rar | Mechanics |
| --- | --- | --- | --- | --- |
| GLUE-C-01 | {1}{B} | Charm | c | `spell, targets:[{what:'creature'}], ops:[{op:'boost', p:-2, t:-2, scope:'target'}]` (the Withering-family instant; answers Nine Lives cleanly since a shrink-kill still leaves the return, but a 0-toughness death is still a death — see §4) |
| GLUE-C-02 | {3}{W} | Charm | c | `spell, targets:[{what:'creature'}], ops:[{op:'sever', to:'target'}]` (Sever removal IS the anti-Preserve, anti-Nine-Lives answer; the set that brings recursion must ship its counter at common) |
| GLUE-R-03 | {5}{B} | Ritual | r | `spell, ops:[{op:'massDestroy', filter:'allCreatures'}]` (priced above the shipped sr sweepers on purpose; a rare-tier board reset in the set's own colors) |

Dual cycle — the #213 class. Each is:
`Land · c · entersTapped: true · manaAbility: [X, Y]` plus the class's
die-for-good rider. **OWNER-RATIFIED 2026-08-17: the five ENEMY pairs**
(the shipped duals plus the Yokai ally cycle cover the ally five, so this
completes the ten-pair grid). The original archetype-aligned draft (B in
three of five) is superseded; archetypes re-mapped below. The Rite engine
(B/R center) is the one archetype without a matching enemy dual — it
leans mono-B with token fodder, and its splash rides the shipped ally
duals instead. Noted, not a problem to fix here.

| Slot | Colors | Archetype served |
| --- | --- | --- |
| DUAL-01 | R/W | Bastet tribal |
| DUAL-02 | W/B | Preserve grave value |
| DUAL-03 | U/R | Retell bridge / spells tempo |
| DUAL-04 | B/G | Nine Lives attrition |
| DUAL-05 | G/U | Empower flood ramp |

Slot count: 8 + 6 + 7 + 3 + 5 + 8 + 3 + 5 = **45**.

---

## 4. Risks and stops

**Where precedent stops applying.**

1. **Rite 2 and Rite 3 have no MTG creature precedent** (n=2, both
   noncreature). Everything above Rite 1 is extrapolated at ~1.5 mana per
   additional body. RITE-R-05, RITE-SSR-07, and RITE-UR-08 carry the whole
   extrapolation.
2. **The sacrifice-cost family is entirely 2018+**, the most power-crept era
   in the corpus. The band already shaves it; if the matrix still shows Rite
   bodies over-performing, cut stats before cutting the Rite number — the
   mechanic's feel dies if Rite 1 buys less than +2.
3. **Undying/embalm value assumed human piloting on both sides.** Our AI
   never bluffs around a Nine Lives body and never holds removal for the
   token copy; both mechanics are worth more against our AI than the corpus
   implies, which is why both bands charge full price. The corpus cannot
   check this — only the matrix can.
4. **Aristocrat payoffs are outside the engine vocabulary** (no
   observer-dies trigger). If the Rite engine underperforms, the fix is more
   dies-value fodder, not a new trigger kind — adding an observer trigger is
   an engine decision above this document's pay grade.

**Least-confident specs, in order.**

- **RITE-UR-08** (Rite 3): pure extrapolation, and the AI's "never sacrifice
  its best body" floor may simply refuse to cast it from real boards.
- **PRES-UR-07** (below-printed Preserve): precedented by exactly one analog;
  if the grave fills as fast as §2.3 argues, a cheap 7/7 re-buy could be the
  set's problem card.
- **BAST-SR-07 / BAST-R-05 stacking**: twinBlades is multiplicative with
  anthems (each +1/+0 is +2 damage on a carrier); two lords plus BAST-C-03 is
  the go-wide-go-tall hybrid the 1.4 sweep found under-answered.
- **NINE-C-03**: warcry + Nine Lives at common is two aggro mechanics on one
  2-drop; the paper stats look weak and the play pattern may not be.
- **EMP-C-01/C-02**: new rungs adjacent to five shipped extraLandDrop cards;
  run `blades-db dupes`/`dominated` against them before authoring (the
  polarity table also needs rows for any new numeric slot, per the
  keeping-in-sync rules).

**What the balance pass must measure first.**

1. **Rite cast rate by AI tier** — how often Rite 1/2/3 bodies actually get
   cast from real games (the Midnight Storybook 6.7% cautionary number is the
   bar). If Rite 2+ rots in hand, the fodder density in §3.1 is too thin,
   not the costs.
2. **Nine Lives × marks anti-synergy** — win-rate delta of Nine Lives decks
   with and without mark-support cards in pool; decide whether the overlap is
   a cost worth keeping before any Empower-marks card is authored next to it.
3. **Preserve grind density** — the self-mill package must be measured as a
   package (grind without payoff was the 1.4 lesson); track Preserve
   activations per game, not just win rate.
4. **The 28-deck layer**: one authored list per §3 archetype (Rite engine,
   Nine Lives attrition, Preserve value, Empower ramp, Bastet tribal), each
   40 spells + 10-land Warchest, before the matrix runs — archetype
   membership stays measured, not inferred.
5. **twinBlades anthem stacking** in the Bastet list specifically, with the
   GLUE answers in the opposing pools.

After the engine ops land and before card data: add the three mechanics to
`keyword-map.md` (Rite ≈ tribute family, Nine Lives ≈ undying, Preserve ≈
embalm), add `TERMS` rows so precedent matching keeps working, run
`terms --check`, and rebuild `balance/cards.sqlite`.
