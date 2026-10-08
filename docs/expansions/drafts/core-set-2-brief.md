<!-- source-of-truth: docs/plan-core-set-2.md, docs/expansions/drafts/core-set-2-ledger.md, docs/expansions/drafts/first-dawn-brief.md, docs/plan-story-mode.md, docs/plan-road-to-2.0.md, docs/plan-1.9.md, docs/keyword-map.md, docs/plan-darlings.md, src/data/axes.ts, src/data/opponents.ts, src/data/glossary.ts, src/engine/types.ts, src/engine/sba.ts · last-verified: 2026-10-08 · set identity brief, DRAFT for the owner's 2.0 wave-1 sitting; nothing here is a card, and nothing is ruled except the rulings it quotes -->

# Core Set II: set identity brief (draft)

Lane A, wave 1 of the 2.0 train (the 2.0 program plan, `docs/plan-2.0.md`,
draft PR #551). This brief fixes what the set *is*, so that the overplan of
about 320 candidates can be written against it. **It is a draft for the
owner's wave-1 sitting.** Owner approval is the gate; no card rows are
written before it. The questions are in section 13, each with a
recommendation.

**Fixed by the spine and the rulings, not up for revision here:** Core Set II
is 2.0's Large set (250+, on the spine since 2026-08-24), the anniversary
return to the Three Kingdoms, Greek and Beastkin rosters. It carries **the
Mandate** (the engine feature) and **Sworn**, the hook first called Oath (the owner, 2026-10-08: "I lumped
Oath into the Core Set 2"; renamed Sworn the same day, P6). A Large set carries all 13 keywords and every
named mechanic (the owner, 2026-09-29). It supplies Story Mode's three
starter pools and its new Beastkin legend (Story Mode R8c, 2026-09-29). No
flavor text (1.9, R13); art is cropped to today's frame at the 216 px window
(frame geometry closed, 2026-10-08). The cards come before the engine spec
(1.9's D16 order). **Core Set II and every mechanic it requires are a hard
requirement for 2.0** (the owner, 2026-10-08, P1): the set is never what
slips.

**Ruled 2026-10-08 in the 2.0 decision walk:** P4 (the July overplan is
retired and the set authored fresh; the July file stays a candidate pool),
P5 (it is "the Mandate" everywhere and "Crown" is dropped), P6 (the hook is
active while you control any legendary creature, and is named **Sworn**
rather than Oath), P7 (set key `core-set-2`; the count is locked at the cut,
250+), and P13 (the new Beastkin legend is a Jade Rabbit, U/W, section 8).
**The set carries every keyword and named mechanic, even if that takes it
past 250** (the owner, 2026-10-08): the cut never drops the last card
carrying one (sections 4 and 9). **Later the same day** (the owner, on
the overplan's questions): the set aims for 250 and may flex to about 275
if the pitched cards are strong; the roster split is Three Kingdoms 85,
Greek 80, Beastkin 65, neutral 20; the top end is about 54 cards at 5+
with about 6 at 7+; and the six **Sworn Champions** are approved, legendary
in every way except the visual crown (sections 3, 4, 6 and 11). The
overplan thread owns the detailed counts. **Also ruled that evening:** the
fallen-Mandate world (section 1) and the hook leads (Three Kingdoms the
Mandate, Greek Sworn, Beastkin steals it) are approved as recommended, and
the set prints **no legendary Meng Huo, Zhurong or Hestia**, since those
characters already exist; their three legend slots go to new characters
(section 7).

Also ruled: one replay bump for the 2.0 train, 16 to 17, shared by the
Mandate, the life field and Story (P16); one save bump, v37 for Story (P10);
the difficulty retune after the life change, in wave 4 (P14); and **the
rescore always waits for the new starting life number, with no 20-life
fallback (P17)**, which puts the life study on this set's critical path.

**Still waiting:** the starting life number itself, picked from the life
study. Nothing in this brief is costed, so nothing here moves when it lands;
section 11 says what the set does with a higher total. The questions in
section 13 are the brief's own.

**Terms used below.** The *overplan* is the long list of candidate cards
(about 320) that the owner cuts down to the set (250). *C, R, SR, SSR, UR*
are the rarities, common to ultra rare. *NEEDS MATH* marks a card whose cost
waits on a measured rate. *VOCAB* marks a card that needs a rules construct
the engine does not have yet. *The Warchest* is the 10 lands beside every
deck. A *converter-owned* deck is a rung list the deck converter regenerates
whenever the card pool changes.

## 1. The world

**The Mandate has fallen.** In the Three Kingdoms the Mandate of Heaven is
the right to rule, granted by heaven and lost by those who fail it. In this
set it has come loose: the sign of it is a thing that can be held, carried
into battle, and taken by whoever strikes its keeper. Every realm reaches for
it.

- **The Three Kingdoms** fight for it as they always have: Wei's discipline,
  Wu's fire and river, Shu's sworn brotherhood, Jin's patient usurpers in the
  shadows. The Mandate is theirs by history; Jin is the dynasty that finally
  took it.
- **Olympus** claims the right to grant it. The gods swear their oaths on the
  Styx, the one oath even Zeus cannot break, and their sworn champions
  carry their favour onto the field.
- **The Beastkin** of the wilds care nothing for thrones. They follow the
  strongest, raid the holder, and run with whoever leads the pack.

**Tone**: the homecoming. The base set's look (lacquer and marble, crimson
and gold, banners, river-fleets, temples on cliffs) returned to with a larger
cast and a sharper eye: elegant, glamorous, adult. Grand rather than grim.
The cast is the house cast: adult women throughout, the Three Kingdoms
officers as the base set drew them, the Olympians as goddesses.

**This premise is also on offer to Story Mode** (its premise is open): three
heroes from three realms, each reaching for the fallen Mandate, is a spine
that Act 1 and an endless run can carry. That is the owner's call, not this
brief's (section 13, question 12).

## 2. What the coverage ledger says

The ledger ([core-set-2-ledger.md](core-set-2-ledger.md), generated by
`npx tsx scripts/core-set-2-ledger.ts`, per-card rows in
`core-set-2-ledger.json`) measures the three rosters against the whole live
pool of 1,648 collectible cards. What it finds, and what each finding asks of
the set:

1. **The rosters are creatures only.** All 158 roster cards (Three Kingdoms
   101, Greek 25, Beastkin 32) are creatures. The base set's 67 other cards
   (charms, rituals, enchantments, artifacts, lands) carry no roster subtype,
   though several are Three Kingdoms by name (Peach Garden Oath, Empty Fort
   Stratagem, the Imperial Jade Seal). **Ask:**
   Core Set II's spells belong to a roster by name and art: a Wei stratagem, a
   Styx oath, a Beastkin hunting call.
2. **The base set has little interaction.** 12 removal cards in 213 (6%,
   against 10% across the pool), none of them green, two counters, two
   bounce. **Ask:** answers at common in every colour, green's through Hunt
   (section 7).
3. **Greek is the thinnest roster**: 25 cards, one of them red, four blue.
   Persephone's colours (B/G) hold ten Greek cards. **Ask:** Greek grows the
   most, and its red and blue first.
4. **Beastkin is green**: 13 of 32 (41%), with three blue. Beyond its two
   legendary lords (Yohime, U/G, and Wolfqueen Lupa, R/G, who lead Kitsune
   and Wolves), the tribe has two Beastkin payoffs, both green rares: Beastkin
   Packmother and the base enchantment Call of the Wilds.
   **Ask:** blue and the new legend's second colour get Beastkin bodies, and
   the tribe gets payoffs outside green.
5. **Three Kingdoms is light in green** (10 of 101). **Ask:** Shu's
   farmlands and the Nanman of the south carry green.
6. **The curve stops early.** 17 of 158 roster cards cost 5 or more (11%,
   against 18% across the pool). **Ask:** the set prints a real top end, which
   the life change wants as well (section 11).
7. **Rarity is bottom-heavy at SR.** 7 SR against 11 SSR and 9 UR. **Ask:**
   the histogram's SR band fills (section 4).
8. **Legends.** 29 Darling-eligible legends in the rosters (Three Kingdoms 17,
   Greek 10, Beastkin 2), and **95 named characters printed without the
   legendary supertype**, about 90 of them with no legendary version at all
   (Sun Ce, Gan Ning, Taishi Ci, Lu Xun, Zhang Liao,
   Xiahou Dun, Hermes, Apollo, Hecate, Demeter and others). Three tower
   bosses play a stand-in Darling because their own card is not legendary:
   R1 Meng Huo, R2 Hestia, R5 Zhurong. Among the rosters, **black-red has no
   legend**. Across the pool the thinnest Darling identities are B/G (4), U/R
   (7) and U/G (8). **Ask:** section 7.
9. **Keywords and mechanics.** The rosters carry 12 of 13 keywords (no
   Dreaded; Rage once). The roster creatures carry 5 of the 18 named
   mechanics (Foresee, Mark, Propagate, Provoked, Nine Lives, each one to four
   times) and none of the other 13. Five of those appear once each on base
   spells (Sever, Quest, Empower, Skim, Retell); the other eight postdate the
   base set. **Ask:** the cameo map in section 9.
10. **Unused cards.** 21 roster cards sit in no authored deck (starter, theme,
    rung or Darlings precon). This is information for the duplicate
    comparator, not a target.

## 3. Roster split

**The set is the three rosters plus a small neutral slice.** Ruled at 250
(the owner, 2026-10-08, revised from this brief's 95 / 85 / 55 / 15 toward
an even split; the detail is in the overplan's card counts):

| Roster | Cards | After the set | Why |
| --- | ---: | ---: | --- |
| **Three Kingdoms** (Wei, Wu, Shu, Jin, and the Nanman and other unaligned officers) | 85 | 186 | leads the Mandate; the largest existing roster grows by the least share |
| **Greek** (Olympians, their oracles, heroes and sworn champions) | 80 | 105 | the thinnest roster grows the most; leads Sworn |
| **Beastkin** | 65 | 97 | the tribe, a lord and payoff in every colour, the new legend's colours |
| **Neutral** (colourless artifacts, the set's few multi-roster spells) | 20 | | no lands (the reserve takes only basics and duals; First Dawn printed none) |

**Faction subtypes stay as they are.** Wei, Shu, Wu and Jin are Axes today
(`src/data/axes.ts`); Olympian and God are Axes; Beastkin is an Axis. The
set uses those, adds no new Axis unless the overplan finds three rows that
need one, and keeps species subtypes inert (Wolf and Kitsune aside, as today).
Non-officer Three Kingdoms cards may carry no faction subtype, as the base set's
Nanman do.

**Greek mortals need a subtype.** 22 of Greek's 25 cards are Gods. Growing
Greek to 105 means oracles, heroes and priestesses, and they need a shared
subtype (Hero or Oracle, beside Human) so the Axis rules, the ledger and
Sworn-adjacent payoffs can see them. *Recommended*: decided at the overplan,
with no new Axis unless three rows pay it off.

**Emphasis (an open decision in the set plan):** Three Kingdoms leads the
Mandate, Greek leads Sworn, Beastkin leads neither and steals the Mandate
(section 5). Each roster still prints some of both.

## 4. Size and rarity

**Ruled: aim for 250, flexing up to about 275 if the pitched cards are
strong** (the owner, 2026-10-08). **Overplanned to about 320** (Drowned Deep's
precedent, 250 overplanned to 320; Duat shipped 245, Drowned Deep 252). The
spine says 250+; the ledger does not argue for more, because the gaps it
names fit in 250. The count stays the owner's at the cut (P7), with one
floor: **every keyword and named mechanic survives the cut, even if that
takes the set past 250** (the owner, 2026-10-08). The overplan carries at
least two candidates for each, so the cut has a choice and the floor rarely
forces extra cards.

| | C | R | SR | SSR | UR | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **At 250** (Drowned Deep's shares) | 123 | 75 | 23 | 17 | 12 | 250 |
| **Overplan** (about 1.28x) | 157 | 96 | 30 | 22 | 15 | 320 |

**Colour split at 250** (overplan targets, not the cut): W 44, U 44, B 42,
R 42, G 42, multicolour 24, colourless 12. Blue and white run one ahead
because Greek blue and Beastkin blue are the two largest colour gaps the
ledger names.

## 5. The colour pie

Each colour has a job with each hook, and a colour that prints a hook's
payoffs also prints the means to turn it on (the Starborne lesson,
2026-08-25).

**White** is Wei's ordered ranks, Shu's sworn guard, and Athena's and
Hestia's temples. It **claims** the Mandate by right (arrival bodies that
claim it) and **keeps** it with Sentinel walls and life. It is a **primary**
Sworn colour: sworn guards and officers that grow tougher or gain life while
a legend leads them.

**Blue** is Wu's river-fleets, Jin's court strategists, Poseidon's and
Hermes' Olympians, and the oracles. It is the **primary Mandate payoff**
colour: draws and Foresee while you hold it, and claims through intrigue.
Its Sworn cards are few: oracles sworn to a god.

**Black** is Jin's usurpers, Wei's executioners, and Hades' and Hecate's
underworld. It is the **primary claimer by force of law**: removal and
edicts that also claim the Mandate, and drains while you hold it. Its Sworn cards
are **secondary**: oaths sworn on the Styx, with a price.

**Red** is Wu's fire at Red Cliffs, Lu Bu's riders, Ares and Hephaestus,
and the Nanman war-beasts. It is the **primary stealer**: Warcry, Dreaded and Skyborne
attackers that take the Mandate in combat, and payoffs that fire when you
claim it. It is a **primary** Sworn colour: brothers in arms (Guan Yu and
Zhang Fei of the Peach Garden) whose Sworn cards fire on the attack.

**Green** is Shu's farmlands, the Nanman south, Demeter and Artemis, and
most Beastkin. It steals the Mandate with big Overrun bodies. It is a
**primary** Sworn colour: Liu Bei's oath, and a herd sworn to its leader
(a team pump while a legend leads, at R or above).

- **The Peach Garden oath is the flavour anchor for Sworn**: Liu Bei (W/G),
  Guan Yu (W/R), Zhang Fei (R/G). Sworn's primary colours are theirs: white,
  red, green. Black is the Styx.
- **The Mandate's primary colours are the court's**: blue and black (Jin took
  the Mandate; Sima Yi is U/B), with white claiming by right and red stealing
  by force.
- **Multicolour under ten percent, at R or above** (24 cards). Signposted
  pairs: W/B and U/B (Mandate control: Wei and Jin), U/R (Wu fire), W/U (the
  Jade Rabbit's Beastkin, section 8), R/W and R/G (sworn brothers, Sworn aggro), B/G
  (Persephone, Styx oaths and the underworld garden), G/W (Liu Bei), B/R (the
  usurper, the roster pair with no legend, section 7).

## 6. The Mandate and Sworn: budget and working assumptions

### What counts

- **A Mandate claimer** puts the Mandate in your hands by effect ("Claim the
  Mandate"). **A stealer** is an attacker built to connect (evasion, Warcry,
  Dreaded, Overrun). **A payoff** reads holding it ("if you hold the Mandate",
  "while you hold the Mandate") or claiming it ("whenever you claim the
  Mandate").
- **A Sworn payoff** prints "Sworn: [effect]". **A Sworn enabler** is a
  legendary creature. A Darlings deck always has one in its command zone; a
  Standard deck has to draw one.

### Budget at 250 (overplan targets, not the cut)

| Hook | Cards | Notes |
| --- | ---: | --- |
| **Mandate claimers** | 20 | W 5, B 5, U 4, R 2, G 2, multicolour 2; at least one at C in every colour |
| **Mandate payoffs** | 16 | U 5, B 4, W 3, R 2, multicolour 2; at least six at C |
| **Mandate stealers** | no separate budget | every set prints evasive attackers anyway; the minimum below makes sure red and green have them at C |
| **Sworn payoffs** | 22 | W 6, R 5, G 5, B 3, multicolour 3; at most eight at C, every one of them still an honest card without its Sworn |
| **New legendary creatures** | 34 | section 7; at least two at R or below in each colour, and six cheap "sworn champions" at C in white, red and green |

**Why 20 claimers.** The Mandate starts unclaimed, and only a card can
claim it. With too few claimers, many Standard games never see it claimed
and the payoffs are blank text. Twenty, with one at common in every colour,
puts a claimer in most 40-card decks that want one. (The other fix, a rules
change where the first combat damage to a player claims an unclaimed
Mandate, is question 6a in section 13.)

**Why common legends.** A 40-card Standard deck with only rare legends holds
three or four enablers, and a Limited deck often none, so Sworn would read as
free upside for Darlings alone. Six cheap legendary commons (sworn
champions, mana value 2 to 3) give Standard and Limited a real enabler rate.
**Ruled (the owner, 2026-10-08): Sworn Champions are legendary in every way**
(the supertype, the legend rule, Sworn, legend payoffs) **except the visual
crown**: their frame does not show the legendary crown, so they read as
commons. That is a small render flag on the card, not a new supertype.
The lab reports Sworn's active rate by turn in each format, and Sworn is
costed at Standard's rate.

**Minimums the cut must hold** (a cut constraint, as for First Dawn): every
colour prints at least one Mandate claimer at C; red and green
each print at least three stealers at C; every colour that prints a Sworn
payoff prints at least two legendary creatures at R or below.

### The Mandate (the set plan's engine section stands)

- **M1. The rules are the set plan's**: starts unclaimed; its holder draws a
  card at their dawn; combat damage to the holder passes it to the attacking
  player, once per damage batch; "Claim the Mandate" gives it to the card's
  controller. One public field, no hidden state.
- **M2. Dawn draw before permanent dawn triggers** (recommended in the set
  plan, for a deterministic order with no resume state).
- **M3. Hunt damage does not claim it.** A Hunt is not combat (the 1.9
  ruling), and only combat damage to the player claims.
- **M4. No card makes the Mandate leave play or be destroyed.** It only
  changes hands. Keeping it is the defensive game, taking it the aggressive
  one.
- **M5. Snowball watch.** The holder draws a card each turn and is usually
  the player who just connected. The lab measures how long a holder keeps
  it, and the overplan leans payoffs toward "whenever you claim the Mandate"
  over "while you hold it", which rewards taking it back.

### Sworn (P6, ruled 2026-10-08)

- **O1. "Sworn is active while you control a legendary creature."** One public
  predicate (`swornActive`, the set plan), the same in Standard, Darlings,
  Limited and Story.
- **O2. In Darlings, Sworn turns on when the Darling is cast** from the
  command zone. The set plan's text, written for an 80-card deck with the
  Darling inside it (2026-07-31), predates the command zone (respec
  2026-08-01) and is replaced in the refresh.
- **O3. Sworn is a condition word, not a keyword.** It prefixes a triggered or
  static ability, like Quest's chapters, and adds no keyword to the 13.
- **O4. The legend rule already holds** (`src/engine/sba.ts`): two copies of
  one legend do not stack Sworn enablers.
- **O5. No Sworn card is dead without a legend.** Every Sworn card at C and R
  is a fair body or spell without its Sworn clause; the clause is the upside. This is
  the Standard and Limited guard.

### Vocabulary (the First Dawn rule, kept)

Write every row in the engine's existing vocabulary plus the Mandate and
Sworn constructs. A clause that needs anything else is marked **VOCAB**. A new
construct reaches the engine spec only when at least three rows in the cut
need it, or the owner rules a single card worth it.

| Construct | Expected rows | Recommendation |
| --- | ---: | --- |
| `claimMandate` op | ~14 | ruled with the Mandate |
| Condition "you hold the Mandate" (abilities and statics) | ~14 | admit with the Mandate |
| Trigger "whenever you claim the Mandate" | 3-5 | admit if three survive |
| Condition `swornActive` (abilities and statics) | ~22 | ruled with Sworn (P6) |
| Condition "an opponent holds the Mandate" | 2-4 | admit if three survive; else reword to "if you don't hold the Mandate" |

**Kept out:** a second Mandate, a Mandate that can be destroyed, a hidden
Sworn choice, Sworn naming a specific legend or faction (the July overplan's
"legendary Officer" form), and any Sworn that counts legends.

## 7. Legends

**Proposed: 34 new legendary creatures** across the rosters (Three Kingdoms
15, Greek 13, Beastkin 6, the legend in section 8 among Beastkin's six).
They are Sworn's enablers in Standard and the new Darling identities. Six of
them are the cheap common sworn champions of section 6.

- **Legendary versions of named officers and gods the base set printed
  without the supertype.** The ledger lists 95. About 90 of them have no
  legendary version at all (Dian Wei, Xu Chu and Thanatos already do, under
  other titles). A new legendary card with a new title (the Zhao Yun
  precedent: two Zhao Yun cards ship today) gives each famous name a Darling
  without touching the old card. The overplan picks from Sun Ce, Sun
  Shangxiang, Gan Ning, Taishi Ci, Lu Xun, Zhang Liao, Xiahou Dun, Ma Chao,
  Pang Tong, Guo Jia, Zhenji, Hermes, Apollo, Hecate, Demeter, Artemis and
  others.
- **Ruled: no legendary Meng Huo, Zhurong or Hestia** (the owner,
  2026-10-08, reversing this brief's proposal): the characters already
  exist, so the set does not print a second version. Their three legend
  slots go to new characters the overplan proposes, and rungs 1, 2 and 5
  keep their stand-in Darlings.
- **Black-red gets a roster legend**, the one pair the rosters lack. Dong
  Zhuo and Lu Bu are mono-colour today; a B/R usurper (Lu Bu turning on Dong
  Zhuo, or a new Jin schemer) fits the Mandate's stealer side.
- **The thinnest Darling identities in the pool** get one or two each: B/G
  (4 today), U/R (7), U/G (8).
- **Guan Yu and Persephone are not reprinted.** Story Mode's first two
  characters stay the shipped cards; the set prints their starter pools'
  support (section 10). A new version of either is a later choice, not this
  set's.

## 8. The new Beastkin legend (P13)

**What is ruled.** Story Mode R8c (2026-09-29): a new Core Set II Beastkin
legend replaces Yohime as Story Mode's third character, blue and with an
anthem. **P13 (2026-10-08): she is a Jade Rabbit, the moon rabbit of
Chang'e's myth, in white-blue, leading a Beastkin anthem.** The owner turned
down sky, bat, spider and serpent species (and the harpy this brief first
proposed) and asked for something in the vein of the feline and canine
Beastkin. Her deck plays card draw, evasion and tricks. Yohime stays the
fallback if Core Set II slips.

- **Colours: W/U.** With Guan Yu (W/R) and Persephone (B/G) the three Story
  characters cover all five colours. White is shared with Guan Yu, but the
  decks play apart: Guan Yu fights on the ground, Persephone grinds, and the
  Jade Rabbit draws, slips past blockers and wins with tricks.
- **Tribe: Beastkin itself, not Kitsune.** Kitsune is Yokai Nights' Axis (21
  of its 25 Kitsune are Yokai Nights cards, with white lords), so her anthem
  leads the whole Beastkin roster this set returns to. Rabbits already fit
  it: the base set's Lop-Ear Vanguard is a white rabbit Beastkin.
- **The moon rabbit fits the homecoming.** She comes from Chinese myth, the
  companion of Chang'e on the moon, pounding the elixir of immortality with
  her pestle. That ties the Beastkin roster to the Three Kingdoms' world.
- **Shape**: a legend that leads from the command zone, with an anthem on
  other Beastkin and one piece of texture (the tribal pass: 19 of 23 shipped
  lords are flat anthems). Draft shapes for the overplan, all in today's
  vocabulary: "Your other Beastkin get +1/+1"; a draw hook, "whenever another
  Beastkin you control arrives, draw a card" once each turn; or a trick hook,
  "whenever you cast a Charm, Foresee 1". Her own evasion is the leap to the
  moon: Skyborne. The costing picks; NEEDS MATH. An evasive anthem legend
  cast from the command zone is a Limited bomb unless she costs about 5 to 6
  mana, as Yohime does (6).
- **Working name: Yutu, Jade Rabbit of the Moon Palace** (Yutu, "jade
  rabbit", is the myth's own name for her; it is also the name of China's
  lunar rovers, which the name check notes). Alternates: Jade Hare of the
  Moon Palace, Tsukiusagi.
- **The cast around her** is the moon court and the feline and canine
  Beastkin the owner named as the model: rabbits and hares, the
  moon-palace cats, fox and wolf retainers in white and blue. No sky, bat,
  spider or serpent species lead her pool.
- **Fallback (open since R8c, kept by P13):** Yohime as she is, if Core Set II
  slips.

**What the tribe needs for her starter pool:** at least fourteen new W or U
Beastkin in the cut, most at C and R (today the pool has five white and
three blue), among them two Beastkin payoffs outside green (one white or
blue at R, one at SR or above), plus her own card. Section 10 counts the
same fourteen.

## 9. Keywords and mechanics: the cameo map

A Large set carries all 13 keywords and all 18 named mechanics (the owner,
2026-09-29). The hooks lead; the rest come back as cameos, each where it
fits a roster. Overplan targets, one to three cards each unless noted:

| Mechanic | Where it fits | Cards |
| --- | --- | ---: |
| **Dreaded** (absent from the rosters) | Lu Bu's riders, Nanman beasts; the Mandate's stealers | 4-6 |
| **Rage** (once in the rosters) | berserk Beastkin, Ares' cult | 2-3 |
| **Sever** | Hades' judgment, Jin's executions | 3-5 |
| **Foresee** | the Delphic oracles, Zhuge Liang's star-reading | 8-12 |
| **Mark** and **Propagate** | veteran officers, Shu's growing brotherhood | 4-6 |
| **Hunt** | Artemis and her hunters; green's removal (section 2, finding 2) | 4-6 |
| **Provoked** | Beastkin and Ares' warriors | 3-4 |
| **Quest** | the Twelve Labours; a long campaign | 1-2 |
| **Champion Awakening** | a hero's apotheosis among the gods | 1-2 |
| **Empower** | a general's extra muster | 2-3 |
| **Skim** | court scholars | 2-3 |
| **Retell** | a stratagem told again (the Empty Fort) | 2-3 |
| **Whispers** | oracles' half-heard prophecies | 1-2 |
| **Hauntlink** | divine relics a hero carries (Hermes' sandals, the Aegis) | 1-2 |
| **Rite** | the hecatomb, a sacrifice to the gods | 1-2 |
| **Tithe** | Styx bargains | 1-2 |
| **Nine Lives** | the Nekomata and cat Beastkin | 1-2 |
| **Preserve** | the shades of the underworld | 1-2 |
| **Duty** | strategists' orders, war drums, temple braziers; every colour | 10-14 |

**All 31 are a hard floor** (the owner, 2026-10-08: "ALL the keywords
and mechanics across this set, even if it means that we expand beyond 250"). The cut
never removes the last card carrying a keyword or mechanic; if keeping one
means going over 250, the set goes over. "Keywords" means the 13 the game ships
(confirmed by the owner, 2026-10-08); keywords named in
`docs/keyword-map.md` but not built (Sudden, Unbreakable, Equip) are not
part of the floor. **Every keyword appears at C or R
at least once**, so a player meets it in packs, and the per-set data check
(every new set carries all 13 keywords, 1.9) passes on day one. The cut
sheet adds a coverage column so the floor is checked as cards are cut, not
after.

## 10. Story Mode's three starter pools

Each pool is a character's starting cards and its reward pool, designed with
the set (plan-story-mode.md, "Dependencies on Core Set II"). Proposed needs,
which the overplan meets and the cut protects:

| Character | Colours | Roster | Has today in its colours | The set adds at least |
| --- | --- | --- | --- | --- |
| **Guan Yu, Saint of War** (UR card, open at the start) | W/R | Three Kingdoms | about 38 Three Kingdoms cards | 15: Shu's sworn brothers, Sworn on the ground, the Mandate taken by force |
| **Persephone, Queen of Two Courts** (SSR, unlocks second) | B/G | Greek | 10 Greek cards | 20: the underworld and Demeter's fields, Styx oaths, Preserve and Hunt cameos |
| **Yutu, the Jade Rabbit** (unlocks third) | W/U (section 8) | Beastkin | 8 Beastkin cards | 14: the tribe in white and blue, its two payoffs, draw, evasion and tricks |

Pool counts are cut constraints, protected like First Dawn's source
minimums. Act 1's rewards draw on the same pools.

## 11. With starting life above 20

The owner aimed the life change at 2.0 with this set ("If we are never
getting to even playing 10 lands, a lot of our most expensive cards are never
being played", 2026-09-29). The number is picked in the same wave-1 sitting,
and **no row is costed until it is picked**: the owner ruled that the
rescore always waits for the new number, with no fallback to 20 (P17), so
the life study sits on this set's critical path. What the brief does about it now:

- **A real top end**: ruled at about 54 cards at mana value 5 or more in the
  250 (22%, in line with Duat and Drowned Deep; this brief first proposed
  40), with at least four per colour, so the longer games the change buys
  have something to cast (the owner, 2026-10-08).
- **Concentrate that top end at mana value 5 and 6.** The life study
  (`plans/2.0/life-study-d1.md`, recommending 25 life, the owner's pick
  pending) found spells costing 7 or more are almost never cast at any
  total, about 0.3 a game even at 30 life, because Standard caps a player
  at 10 lands. Longer games alone will not get them played; their costs
  will. So the set prints few cards at 7 or more, only at rare and above,
  each costed to be castable by the turns games actually reach (question 16).
- **The Mandate gets stronger as games get longer.** Each turn held is a
  card. The lab measures its rates at the new total, never at 20.
- **Sworn's legends** at mana value 4 to 6 are the natural Darlings for longer
  games.

## 12. Products, rungs and personas

Proposals for the cut, not commitments; product scope is an open decision in
the set plan.

- **Boosters** as every set; pricing follows `src/meta/boosterSkus.ts`'s
  release-order rule (appending the set moves Starborne to the back
  catalogue).
- **One theme deck** (the eleventh), **W/U Beastkin** under the Jade
  Rabbit, two colours, honest bodies, no multi-turn engine to assemble (what
  sank the two folding decks in 1.8). It doubles as her Story pool's proving
  list.
- **One rung, 29 (the tower grows by one).** The last two sets each added
  a summit pair (Drowned Deep 25-26, First Dawn 27-28). This set adds one:
  **R29, the Usurper (B/R)**, who takes the Mandate by force with Dreaded and
  Warcry stealers and keeps it with black's removal, led by the new B/R
  legend. A second rung, a W/U Throne of Olympus that holds the Mandate and
  wins the long game, is left out: slow control is the shape the AI pilots
  worst (the 1.9 summit Darlings reading put rungs 23-26 at 10-28%). R29 gets
  a converter-owned Darlings deck and its own gate test, sized when it is
  built (about 77 seconds a rung was measured on rungs 14-22; summit rungs
  run slower). Its boss doubles as a Story Mode act boss if the Story plan
  wants one.
- **Two sweep personas**: **U/R** (the Mandate stealer; U/R has the fewest
  Darlings of the blue pairs, 7) and **B/G** (Persephone's colours, Sworn and
  Hunt). No persona is fixed to either today: seven personas have fixed
  pairs (R/W, W/U, W/G, R/B, R/G, U/B, B/W) and midrange picks its best two.
  The Jade Rabbit's W/U is the draw-go persona's pair already.
- **Darlings**: no new Darlings precon at 2.0. Suggested Decks, which would
  show off the new legends, come after 2.0 (ruled 2026-09-25).

## 13. Questions for the owner

Each leads with the recommendation.

1. **Ruled: the world is the fallen Mandate** (section 1), every realm
   reaching for a Mandate of Heaven that can be held and taken.
2. **Ruled: Three Kingdoms 85, Greek 80, Beastkin 65 and 20 neutral**
   (section 3).
3. **Ruled: Three Kingdoms leads the Mandate, Greek leads Sworn, and
   Beastkin steals the Mandate.**
4. **Cut to 250 from about 320 candidates**, with 123 commons, 75 rares, 23
   SR, 17 SSR and 12 UR (section 4). Ruled: aim for 250, flex to about 275
   for strong cards, and every keyword and named mechanic stays.
5. **Sworn's colours: white, red and green primary (the Peach Garden),
   black secondary (the Styx)**; the Mandate's blue and black primary
   (section 5).
6. **Ruled (P6): Sworn is active while you control any legendary
   creature.**

   6a. **Keep the Mandate's rule as written (only a card claims it when no
   one holds it), with 20 claimers.** The alternative: the first combat
   damage to a player claims an unclaimed Mandate, so it is always in play
   from the first hit, still one public field.
7. **Ruled (P5, P6): the names are "the Mandate" and "Sworn".** Sworn
   replaced Oath, which Blood Oath, the Grail Oath, Peach Garden Oath and
   Liu Bei, Benevolent Oathkeeper already use. "Crown" is dropped. The two
   achievements titled "Mandate In Foil" and "Rainbow Mandate" are renamed
   in another lane (ids unchanged); the Shadow Mandate starter deck keeps
   its name.
8. **Print 34 new legends**, including a B/R legend and six common sworn
   champions (sections 6 and 7). Ruled: no legendary Meng Huo, Zhurong or
   Hestia; new characters take those slots.
   The Sworn Champions are ruled (no visual crown); the count of 34 is open.
9. **Ruled (P13): the Jade Rabbit, W/U.** Still open: her name. The
   recommendation is **Yutu, Jade Rabbit of the Moon Palace** (section 8).
10. **Do not reprint Guan Yu or Persephone** (section 7).
11. **Ruled: all 13 keywords and 18 mechanics are in the set.** Still open:
    where each lands; the recommendation is the cameo map (section 9).
12. **Offer the fallen Mandate to Story Mode as its premise.** The owner's
    call in the same sitting as Story's premise direction.
13. **Grow the tower by one rung, R29, the Usurper (B/R)** (section 12).
    The alternatives are a second rung (a W/U throne) or no new rung in
    2.0, since mobile and Story ride beside the set.
14. **Add two sweep personas, U/R and B/G** (section 12).
15. **Add one theme deck, W/U Beastkin under the Jade Rabbit** (section 12).
16. **Ruled: about six cards at 7 or more, rare and above, with most of
    the 54-card top end at 5 and 6** (section 11; the owner approved the
    cost-scaling guidance, 2026-10-08).

**FYI, no ruling needed now:** every name is a working name until the cut;
the art register (section 14) is an outline for the art bible, written after
the cut; the costing waits for the life number and the Mandate lab.

## 14. Art direction, in outline

For the art bible after the cut; the global rules hold.

- **The homecoming look**: the base set's palette and costume language
  (lacquer red, imperial gold, jade, river blue for the Three Kingdoms;
  marble white, laurel green, Aegean blue, bronze for Olympus; the wilds'
  greens and ambers for Beastkin), lit warmer and composed for the 216 px
  window (image rows 17.3% to 82.7%; every head top at or below about y 179
  of the 640 x 800 file).
- **The Mandate's sign** is a single recurring object (a jade seal on a
  silk cord is the working idea; the Imperial Jade Seal already ships as a
  base artifact, so the art bible chooses between echoing it and a new
  object). It must read with no text: no characters, no inscriptions.
- **Sworn has no reserved art tell**, as Provoked has none.
- **Costume and banned motifs**: no real-world regalia used as costume
  beyond the base set's established Three Kingdoms and Greek register; no
  real-person likeness; no text, seals with characters, or inscriptions; no
  gore.
- **Beastkin**: the Jade Rabbit and her court follow the Beastkin
  monster-girl idiom of the feline and canine cards (ears, tail, at most
  three stated species tells), the moon palace in white jade and pale blue;
  the
  gods read divine by light and scale of setting, never by shrinking the
  woman.

The next deliverable after the owner's approval is the overplan of about
320 candidates: every row overlap-checked against the whole pool, VOCAB rows
marked, the Mandate and Sworn rows flagged NEEDS MATH, with protect-first and
cut-priority columns, and the story-pool, legend and cameo minimums
checked.
