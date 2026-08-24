<!-- source-of-truth: docs/plan-1.6-rulings-2026-08-19.md, src/data/cards/, src/data/opponents.ts, src/data/permanentClass.ts, src/engine/types.ts, tests/data/inertPermanents.test.ts · last-verified: 2026-08-22 · adjudicated change slate; the audit and workbench it cites (balance/card-health-audit.md, docs/plan-card-health-pass.md, scripts/blades-db.ts) are local-only and deliberately absent from this header -->

# 1.6 card-health triage — the adjudicated slate

**Status 2026-08-22: ADJUDICATED, awaiting transcription.** This closes the
"unread 1.6 dup-audit report adjudication" debt from the small-debts batch,
under the owner ruling of 2026-08-19 (`plan-1.6-rulings-2026-08-19.md` §2.6:
"everything in the audit lands in 1.6") and the taste calls of 2026-08-22
recorded below.

Three Fable authoring lanes triaged the current pool (1,079 collectible,
workbench built 2026-08-22T01:15Z) against fresh detector output. Their full
working tables, with per-row precedent commands and collision checks, are the
lane files in the session scratchpad; this doc is the adjudicated union that
the Codex transcription contract applies.

## What the detectors said, and what was real

| Detector | Raw | Real after blind-spot filtering |
| --- | ---: | ---: |
| `dupes` | 141 pairs (30 IDENTICAL at the time of export, 33 adjudicated) | 30 IDENTICAL adjudicated; 17 cross-set same-rarity reprints acquitted |
| `dominated` | 774 pairs (572 at identical cost) | 539 real; 227 false (Duat mechanics), 8 false (Bulwark polarity) |
| `inert` | 36 ETB-only of 105 non-creature permanents (34%) | 25 of 105 (24%); 11 were false positives |

**Three detector defects were found by the lanes and are fixed as part of this
wave** (they change what the numbers mean, so they land with the cards):

1. **`classifyPermanent` ignores `hauntlink` and `entersGraveyard`**
   (`scripts/blades-db.ts`). Nine Yokai Hauntlink carriers and the two Duat
   Canopic relics were filed as inert. Duat reads 20% against the ruled 15%
   ceiling with the bug and **10% without it**, so the ceiling test would have
   failed on a classifier bug rather than on card design.
2. **`effectPayload` ignores `rite`, `nineLives`, `preserve`, `hauntlink`**
   (`scripts/blades-db.ts`). 227 of 774 dominance pairs (29%) are false:
   Sun-Rope Hauler "dominates" 38 cards while paying Rite 1; the two Duat
   Skirmishers are "dominated" 65 times while carrying Nine Lives.
3. **`deck_count` reads only the retired classic lists** (`collectDecks`). It
   never reads `reserveDeck`, `darlingsDeck`, `DARLINGS_PRECONS`, or
   `duatArchetypeDecks.ts`, so "deck_count 0" never meant deck-free. **Every
   deck-membership claim in this slate was re-read by grep over the data
   files**, not from the workbench. Every "deck_count 0, nil blast radius"
   claim in the 2026-07-29 audit should be re-read with this in mind.

## The one data bug (highest priority, no card text changes)

**Nine of the thirteen Yokai Hauntlink riders ship without their keyword.**
The spec-row parser (`src/data/cards/yokai-nights.ts`, the `Linked:` clause)
strips the `+X/+Y` prefix and then replaces `/ and /g`, but the remainder
reads `and Warcry` with no leading space, so the replace never fires and
`parseKeywords` returns nothing. Verified by the main session against
`CARD_DB`:

| Card | Spec row says | Ships as |
| --- | --- | --- |
| Ember Mask | +1/+0 and Warcry | `{p:1,t:0}` |
| Thorn-Spirit Mask | +1/+1 and Warding Gaze | `{p:1,t:1}` |
| Parasite Mask | +1/+0 and Deathblade | `{p:1,t:0}` |
| Ghostwire Charm | +0/+2 and Sentinel | `{p:0,t:2}` |
| Bastion Lantern | +1/+1 and Sentinel | `{p:1,t:1}` |
| Ember-Link Chain | +1/+0 and Warcry | `{p:1,t:0}` |
| Cold-Boot Mask | +2/+0 and Deathblade | `{p:2,t:0}` |
| Sanctum of Many Masks | +2/+2 and Sentinel | `{p:2,t:2}` |
| Burning Mask of the Void | +2/+0 and Overrun | `{p:2,t:0}` |

The four that parse correctly are written `+2/+0, Skyborne, and Untouchable`
or are keyword-only. Fix the parser, add a spec-parity test asserting every
`hauntlink.linked.grantKeywords` matches the keywords named in its row, and
re-baseline: the Yokai theme decks, every avatar Darlings deck carrying a
mask, and any win-rate floor covering a Yokai list have been measuring cards
that do not match their printed text.

## Owner taste calls (2026-08-22, locked)

| # | Question | Ruling |
| --- | --- | --- |
| 1 | Hauntlink enters Dark Tales? | **Yes, both cards**: `dt-mirror-shard` and `dt-haunted-storybook`. DARK's returning-mechanic count becomes four. |
| 2 | Hauntlink Apex echo | **Recost** to `{5}{U}`, link `{2}{U}`, linked +3/+3 Skyborne Untouchable. |
| 3 | Ragnarök | **Red wrath + new flavor**: "Deal 4 damage to each creature, then your opponent loses 2 life." |
| 4 | Duel result screens (PR #255) | **Keep the ESC shortcut**; results are not mandatory. |
| 5 | Fogbell Chime rider | **Gains Dreaded** (the one evasion keyword no Yokai rider grants). |
| 6 | Wolfsbane Ward rider | **-1/+0 and gains Bulwark**. Not -2/+0: that exact card ships as Gilded Cage `{2}{W}` r. The -1 keeps `MediumAI` targeting an enemy creature, so no AI change is needed. |
| 7 | Hotwire Retort / Barrow-Jarl | **Magma Jet** shape; **Barrow-Jarl to 4/4** (not trimming Underpass Reclaimer). |
| 8 | Lane B scope | **Land all 41 rows.** |

Two lane recommendations the owner did not need to arbitrate, adopted as
recommended: grandfather the five pure-Foresee-1 Skim relics as Skim cyclers
(they are the set's identity and every collision-free alternative dominates a
shipped rare), and keep **Laughing Pooka** untrimmed (its dominance relations
are a workbench pair finding, not a win-rate one; the two Duat commons it
"beats" are deliberately smaller Nine Lives bodies).

## The slate

**~68 card changes plus the parser fix.** The per-row detail — exact `CardDef`
fields, rendered rules line, precedent command, collision check, and full
ripple list — lives in the three lane tables, which the transcription contract
consumes directly:

- **Lane A (duplicates), 20 rows**: the parser fix; Fogbell Chime as Silver
  Veil's Hauntlink carrier; the same-set authoring errors (Natron Vault, the
  Duat flood triple); fourteen rarity lies; the Yokai echo pairs (Apex recost,
  Oni of the Last Exit gains a Kokusho dies trigger); Battle Fervor demoted to
  common.
- **Lane B (dominance and costing), 41 rows**: Wolfsbane Ward; Ragnarök; 23
  surviving rarity lies plus 4 cross-type lies the detector cannot see;
  creature keyword and stat fixes across CORE, NEON, DUAT, RAGN, DARK, GRAL.
- **Lane C (inert permanents), 7 rows**: Mirror Shard and Haunted Storybook
  gain Hauntlink; five relics move from one-shot arrivals to recurring `dawn`
  shapes (Crescent Cookpot, Broken Mirror, Velvet Coffin, Quest Marker, Apple
  of Emain).

### Also landing with the wave

- **The inert-ceiling test.** Lift `classifyPermanent` into
  `src/data/permanentClass.ts` (it is already pure), fix its two blind spots
  there, and have both the workbench and the suite import it.
  `tests/data/inertPermanents.test.ts` asserts Duat's ETB-only share is at or
  under the ruled 0.15 (measured 0.10) and ratchets the pool-wide share down
  from the honest 0.24 as the slate lands. Floors only ratchet in the good
  direction.
- **The Foresee-1 texture rule.** 26 cards have "When this arrives, Foresee 1."
  as their entire text (2.4%); Duat has the most at 7, because the set was
  authored after the audit proposed the rule and the rule was never written
  down. `docs/adding-cards.md` gains it, with the shipped Skim relics named as
  grandfathered.
- **Doc drift found in passing**: `docs/expansions/celtic-fae.md:55` still
  describes Briar-Veil Banishing as an Enchantment that exiles until it
  leaves, while the data is a Ritual that severs. The data wins (the exile
  vocabulary does not exist); the row is rewritten.

## Needs engine vocabulary, deliberately not faked

- **Grave protection** (`sd-natron-vault`'s authored intent): nothing shipped
  can say "cards in your graveyard cannot be severed". The slate ships the
  shipped-vocabulary reading and records the intent for a later set.
- **A spendable non-creature permanent**: `RiteDef` and `PreserveDef` are
  creature-only, so a one-shot artifact's only payoffs today are the two
  bounce commons and holding a slot. No Keep verdict in this slate rests on an
  imagined payoff.
- **AI Aura polarity for keyword-only debuffs**: `MediumAI` decides
  buff-versus-debuff from `static.p < 0` alone, so an Aura reading only "gains
  Bulwark" would be cast on the AI's own creature. Ruling 6 avoids this
  entirely; the note stands for whoever writes the next pure-keyword Aura.

## Measurement this slate owes

The re-measure list is the union of the lane ripple columns: **19 avatar
reserve decks**, the Darlings ladder, **4 theme decks** (including the Yokai
lists the parser bug touches), **5 Darlings precons**, the two Duat archetype
decks, and the hand-built Hel and Morgan exceptions (whose exemptions survive
only while they still out-measure the builders). Per the 1.6 plan, the single
end-of-train balance pass absorbs it; the transcription contract runs
`--avatars-reserve --seeds 40` and `--player-decks --seeds 40` as its own gate
and reports every floor comparison without adjusting a floor.
