<!-- source-of-truth: src/engine/types.ts, src/ui/rulesText.ts, docs/rules.md · last-verified: 2026-07-23 · reference/mapping doc — shipped rows track the code; "Planned" rows record decided names for not-yet-built mechanics, not code · re-verify shipped rows when the referenced code changes -->

# MTG keyword map — Darling Blades terms (shipped + future)

The single reference for every Magic **evergreen** keyword and how it maps to
Darling Blades. Scope is evergreen only (the terms that appear in nearly every
Magic set); source list:
[en.wikipedia.org/wiki/List_of_Magic:_The_Gathering_keywords](https://en.wikipedia.org/wiki/List_of_Magic:_The_Gathering_keywords).

**Tap is deliberately out of scope** — it (and mana, the W/U/B/R/G colors, and
the `creature`/`enchantment`/`artifact`/`land` types) is generic gaming
vocabulary we kept unchanged when we de-MTG'd the rest (see
[plan-de-mtg-rethemes.md](plan-de-mtg-rethemes.md) scope table).

## How this game speaks

The de-MTG re-theme is a **full engine-id rename that already shipped**
(Tier-3, PR #14/#16, 2026-07-07). Unlike Hearthstone's display-only Taunt/Charge,
our engine's `Keyword` union *is* the Darling Blades vocabulary — the code says
`skyborne`, not `flying`. So a "mapping" here is historical (what the Magic term
was) plus the live id.

Read each row's **Status** as:

- **Shipped** — a value in the `Keyword` union (`src/engine/types.ts`) or an
  `EffectOp` (same file); the engine and reminder text speak the themed term.
  Reminders below are quoted from `KEYWORD_REMINDER` in `src/ui/rulesText.ts`.
- **Planned** — *not in the engine yet.* The name is **decided** — a themed label,
  or a kept Magic term where that word is generic enough (Equip, Fight, Sacrifice).
  **Adding one is a new engine feature, not a rename:** it touches
  `combat/legality.ts`, `combat/damage.ts`, `sba.ts`, the AI value heuristics, and
  the win-rate-floor tests — never a text swap. Do not ship the label without the
  mechanic behind it.
- **Kept** — generic vocab we intentionally did not re-theme.

Voice guide (for naming future keywords): one or two words from the
honor / blade / myth register (Three Kingdoms honor, Greek myth, Beastkin
instinct), non-colliding with existing labels, reading as *battlefield doctrine*
rather than mechanics.

## Evergreen keyword abilities

| Magic keyword | Darling Blades | Engine id | Status | Rule (reminder text) |
| --- | --- | --- | --- | --- |
| Flying | **Skyborne** | `skyborne` | Shipped | Can only be blocked by creatures with Skyborne or Warding Gaze. |
| Reach | **Warding Gaze** | `wardingGaze` | Shipped | Can block creatures with Skyborne. |
| First strike | **First Blade** | `firstBlade` | Shipped | Deals combat damage before creatures without First Blade. |
| Double strike | **Twin Blades** | `twinBlades` | Shipped | Deals combat damage both before and alongside other creatures. |
| Haste | **Warcry** | `warcry` | Shipped | Can attack and tap the turn it arrives. |
| Trample | **Overrun** | `overrun` | Shipped | Excess combat damage past its blockers is dealt to the player. |
| Vigilance | **Sentinel** | `sentinel` | Shipped | Attacking does not cause it to tap. |
| Defender | **Bulwark** | `bulwark` | Shipped | Cannot attack. |
| Deathtouch | **Deathblade** | `deathblade` | Shipped | Any amount of damage it deals to a creature is lethal. |
| Lifelink | **Blood Oath** | `bloodoath` | Shipped | Damage it deals also gains you that much life. |
| Hexproof | **Untouchable** | `untouchable` | Shipped | Cannot be targeted by spells or abilities your opponents control. *(one-sided — your own spells still reach it)* |
| Enchant | *(the aura system)* | — | Kept | Not a named keyword: represented by the `enchantment` card type + `scope:'attached'` statics ("Enchanted creature gets …"). "Enchantment" is kept generic vocab. |
| Equip | **Equip** *(kept)* | — | Planned | "Equip" kept as-is (generic enough). Needs an equipment / artifact-attach subsystem first — none exists today. |
| Flash | **Sudden** | — | Planned | "Play any time you could play a Charm." (Charm = our instant; today only whole card *types* are instant-speed, not a per-card keyword.) |
| Indestructible | **Unbreakable** | — | Planned | "Can't be destroyed by damage or by 'destroy' effects." |
| Menace | **Dreaded** | `dreaded` | Shipped | Cannot be blocked except by two or more creatures. *(1.3, with Gothic Monsters)* |
| Protection | **Aegis** | — | Planned | Quality-scoped (can't be blocked/targeted/damaged/enchanted by a quality) — the heaviest feature here. |
| Prowess | **Momentum** | — | Planned | "Whenever you cast a noncreature spell, this gets +1/+1 until end of turn." |

**Shipped: 12 of 18.** Enchant is present as a system (auras), not a keyword.
Missing as keyword abilities: Equip, Flash, Indestructible, Protection,
Prowess.

## Evergreen keyword actions

Magic's evergreen keyword *actions* are verbs an effect performs. We render them
as effect text, not as a named keyword a player collects — so the mapping is to
an `EffectOp` (`src/engine/types.ts`) or an engine mechanism.

| Magic action | Darling Blades | Engine op / mechanism | Status | Notes |
| --- | --- | --- | --- | --- |
| Scry | **Foresee** | `foresee` | Shipped | "Foresee N" — look at top N, bottom any subset. Themed Tier-3 (#66); a named Mechanic in the Glossary. |
| Mill | *(grind)* | `grind` | Shipped | "Put the top N cards of your deck into your graveyard." Internal op id `grind`; oracle text says the effect, never the word "mill". |
| Exile | **Sever** | `sever` / `severGrave` / `severTop` | Shipped | Creature→severed, top-N grave→severed, top-N deck→severed. Themed Tier-3 (#66) — the zone is `severed` ("severed cards never return"); a named Mechanic in the Glossary. |
| Counter (a spell) | *(cancel)* | `cancel` | Shipped | "Cancel target spell." |
| +1/+1 counter | **Mark** | `addCounters` | Shipped | "Put N +1/+1 marks on target creature." Player copy only (rulesText, glossary, rules.md); the engine op id and state field are unchanged. A named Mechanic in the Glossary. |
| Sacrifice | Sacrifice *(kept)* | — | Planned | "Sacrifice" kept as-is (generic enough). "Put a permanent you control into its owner's graveyard." No op exists yet. |
| Fight | Fight *(kept)* | — | Planned | "Fight" kept as-is (generic enough). "Each creature deals damage equal to its Attack to the other." No op exists yet. |
| Attach | *(aura attach)* | `scope:'attached'` statics | Kept | Internal — auras attach to a creature; not a player-facing keyword. |
| Tap / Untap | Tap / Untap | (core action) | **Kept — out of scope** | Generic action vocab, intentionally not re-themed (per user + de-MTG scope table). Listed here only for completeness. |

## Planned keywords — implementation notes

Names are **decided**; the mechanics are not built yet. Kept here so each ships in
a consistent voice with Magic-accurate semantics. The **How this game speaks**
rule applies: each is a new engine feature gated by the win-rate floors, never a
text swap.

| Name | For (Magic) | Reminder (draft) | Engine work it implies |
| --- | --- | --- | --- |
| **Equip** | Equip | "{cost}: attach to a creature you control. Equip only during your main phase." | An Equipment subsystem (artifact-attach, re-attach, falls off on death). Large. |
| **Sudden** | Flash | "You may play this any time you could play a Charm." | A per-card instant-speed flag on non-Charm cards + cast-timing legality. |
| **Unbreakable** | Indestructible | "Can't be destroyed by damage or by 'destroy' effects." | SBA + `destroy`/`massDestroy` op guards; AI value/removal heuristics. |
| **Aegis** | Protection | "Can't be blocked, targeted, damaged, or enchanted by [quality]." | Quality-parameterized guard across targeting, combat, damage, auras. Heaviest. |
| **Momentum** | Prowess | "Whenever you cast a noncreature spell, this gets +1/+1 until end of turn." | A cast-trigger + until-end-of-turn buff plumbing; AI sequencing value. |
| **Fight** | Fight | "Each creature deals damage equal to its Attack to the other." | A `fight` `EffectOp` reusing the damage pipeline; targeting for two creatures. |
| **Sacrifice** | Sacrifice | "Put a permanent you control into its owner's graveyard." | A `sacrifice` `EffectOp` (as cost and as effect); death triggers already exist. |
| **Skim** | Cycling | "{cost}, discard this card: draw a card." | **Planned (1.4, Dark Tales — name locked 2026-07-23):** a hand-side activated discard-to-draw — a non-cast action from hand, mana payment outside a cast, AI smoothing valuation at every difficulty. Like Empower, kept in this table although Cycling is not evergreen. |
| **Retell** | Flashback | "Retell {cost}: you may cast this from your graveyard, then sever it." | **Planned (1.4, Dark Tales — name locked 2026-07-23):** cast-from-graveyard legality + an alternative-cost path + a post-resolve sever into the existing one-way `severed` zone; AI valuation of graveyard spells. Not evergreen; recorded like Empower. |
| **Empower** | Kicker | "You may pay an additional {cost} as you cast this. If you do, [the empowered effect]." | **SHIPPED (1.3, engine + duel-UI chooser):** `CardDef.empower {cost, ops}`, empowered flag on the cast action, combined-cost pricing in `validateAction`/the mana solver, trigger-safe riders in `resolve.ts`, AI pricing at every difficulty, and a cast-time chooser shown only when the extra cost is payable (user decision 2026-07-17). Kept in this table because Kicker is not evergreen; listed as shipped for the record. |

## Naming rules (collision guard)

- **Skyborne / Warding Gaze** pair by name (flier + the sentinel that watches the
  sky). **Warded** is therefore banned as a label — it shadows Warding Gaze — so
  Protection took **Aegis**, not Warded.
- **Sentinel** (vigilance) and **Bulwark** (defender) are both defensive and are
  kept lexically distinct on purpose — players confuse similarly-named defensive
  keywords.
- The **blade** motif (First Blade, Twin Blades, Deathblade) is intentional — the
  world is *Darling Blades* — but each stays otherwise unambiguous.
- **Untouchable is one-sided** — the reminder must say *your opponents* can't
  target it; never shorten to "can't be targeted" (`rules.md` Keywords table).
- New themed labels were collision-checked against the shipped set: **Aegis**,
  **Sudden**, **Unbreakable**, **Dreaded**, **Momentum**, and **Empower**
  don't shadow any existing label. (Equip, Fight, and Sacrifice keep their
  generic Magic names.)
- **Empower** (Kicker, decided 2026-07-17) was chosen over Tribute/Invoke:
  it describes the mechanic rather than the set, and unlike Surge, Escalate,
  Overload, or Entwine it is not a Magic keyword (the distinctiveness rule
  that retired "saga").
- **Skim** (Cycling) and **Retell** (Flashback), decided 2026-07-23 for Dark
  Tales: both replace Magic-distinctive keywords under the same rule.
  Rejected for collision: Encore, Echo, and Rebound are all real Magic
  keywords; Skim/Retell shadow nothing in the shipped label set.

## Cross-references

- **Shipped semantics of record:** [rules.md](rules.md) → *Keywords* table (the
  exact implemented behavior of the 11).
- **How the labels/reminders are generated:** `KEYWORD_NAMES` / `KEYWORD_REMINDER`
  in `src/ui/rulesText.ts`; authoring note in [adding-cards.md](adding-cards.md).
- **Why the engine ids are themed (the rename that shipped):**
  [plan-de-mtg-rethemes.md](plan-de-mtg-rethemes.md); the superseded display-only
  proposal is [plan-keyword-rethemes.md](plan-keyword-rethemes.md).
