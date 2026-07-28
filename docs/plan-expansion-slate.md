<!-- source-of-truth: docs/roadmap.md, docs/keyword-map.md, src/engine/types.ts, src/data/cards/*.ts · last-verified: 2026-07-24 · design/plan doc — concepts and mechanic candidates, nothing here is implemented -->

# Expansion Slate + Mechanic Candidates (1.5 → 2.0)

User-curated 2026-07-24 during the 1.4 endgame. This is the durable record of
the expansion-ideation session: which set concepts are in the pipeline, which
mechanics fit each, and which mechanics are **tabled** (good ideas, wrong
time). Each set still gets its own engine-first concretion pass at planning
time — nothing here is a commitment to a rules implementation.

## House rules for every new mechanic

1. **Original names only.** Real MTG/Yugioh keyword names are never used
   (precedent: Encore/Echo/Rebound rejected for the 1.4 flashback retheme;
   the mapping ledger is [keyword-map.md](keyword-map.md)).
2. **Engine-first.** The headless, seeded-deterministic engine build lands
   before any card data (the 1.4 Skim/Retell order).
3. **AI-pilotable.** The 1.4 Pillar 1 lesson, paid for with measurements
   (Midnight Storybook 6.7% pre-rebuild; pure Dark Tales boss lists 0-19%):
   subtle value loops play far below their paper rate in AI hands. Prefer
   mechanics with a greedy heuristic (attack, sacrifice, trigger); treat
   anything requiring multi-turn planning as a cost to be justified.

## The slate

| Slot | Set concept | Status |
| --- | --- | --- |
| 1.5 | **Cyberpunk Yokai Nights** (Expansion 6) | Committed; concept carried from the 1.4 cut, needs concretion |
| 1.6-1.9 | **Egyptian underworld (+ Bastet catgirls)** | Slate — user-liked |
| 1.6-1.9 | **Cosmic Horror** | Slate — user-liked |
| 1.6-1.9 | **Sci-fi alien girls** | Slate |
| 1.6-1.9 | **Prehistoric cavewomen + dinosaurs** | Slate |
| 1.6-1.9 | **Steampunk** | Slate (five concepts, four slots — one falls past 2.0) |
| 2.0 | **Core Set II** — return to the Three Kingdoms / Greek base rosters and flesh them out | Committed (anniversary slot) |

Passed on 2026-07-24: Slavic folklore, Mesoamerican, Hindu epic.

## Mechanic candidates by set

Recommended picks are marked ▶. "Engine" grades the implementation lift
against what already exists; "AI" grades how well the current brains would
pilot it with at most a small heuristic addition.

### Cyberpunk Yokai Nights (1.5)
Mechanics to be chosen at its concretion pass (the concept predates this
slate). Candidates from the pool below that fit the neon-yokai identity:
possession/attachment play (union-style), Whispers-family discard synergy
with the Dark Tales pool, or a mark-based "corruption" skin over Propagate.

### Egyptian underworld (+ Bastet)
- ▶ **Tribute summoning** (Yugioh tribute): sacrifice N creatures as an
  additional deploy cost for god-tier bodies. Engine: cheap (additional-cost
  plumbing shipped with Retell). AI: good — pure affordability check.
- ▶ **Nine Lives** (MTG undying, catgirl skin): dies → returns once with a
  mark. Engine: cheap (dies-triggers + marks exist). AI: excellent (free
  value, no planning).
- **Mummification** (MTG embalm/eternalize): sever from the graveyard to
  create a token copy. Engine: cheap (Retell cost infra → token op). AI:
  moderate (grave awareness exists post-Retell but is the weak muscle).
- TABLED: **Exert-alike** (tap harder, skip an untap) — our tap model is
  simpler than MTG's; medium lift, low payoff.

### Cosmic Horror
- ▶ **Whispers** (MTG madness): a discarded card may be cast for its
  whisper cost as it goes. Engine: moderate. The argument: it
  retro-synergizes with Skim — Dark Tales shipped a discard engine with no
  discard payoff, and this closes that loop across the shared pool.
- **Dread of the Deep** (MTG emerge / tribute-discount): sacrifice a
  creature to discount the horror by its cost. Engine: moderate. AI: good.
- TABLED: **Sanity track** (poison-adjacent corruption counter on the
  player) — a whole new player-level resource: engine + UI + AI valuation
  surface. Revisit only if a set's ENTIRE identity is built on it.
- TABLED: **Transform / double-faced cards** — the card model has no back
  faces; heavy everywhere (data, save, UI, AI). Do not drift into this.

### Sci-fi alien girls
- ▶ **Propagate** (MTG proliferate): add a mark to every marked permanent.
  Engine: trivial (one op over existing marks). AI: good.
- **Broodspawn** (token swarm identity reusing existing token infra).
- TABLED: **Pilot/Crew** (MTG vehicles, Yugioh union) — crew timing is
  exactly the subtle tempo decision the AI fumbles; if ever used, the mechs
  must be dumb-simple. TABLED: **Energy counters** — second resource pool,
  same objection as Sanity.

### Prehistoric cavewomen + dinosaurs
- ▶ **Provoked** (MTG enrage): triggers when this survives damage.
  Engine: trivial (damage events exist). AI: excellent — rewards blocks and
  pings the AI already makes.
- ▶ **Hunt** (MTG fight): your creature and a target deal their attack to
  each other. Engine: trivial (mutual damage op). AI: excellent — removal
  with a body check; also quietly widens the board-answer toolbox the 1.4
  pass found thin.
- **Devour-alike**: sacrifice creatures on arrival for that many marks.
  Engine: cheap. AI: moderate (sacrifice sizing).

### Steampunk
- ▶ **Salvage** (MTG modular): when this artifact creature dies, move its
  marks to another artifact creature. Engine: cheap. AI: excellent
  (automatic).
- ▶ **Contraption thresholds** (MTG metalcraft): statics that switch on at
  3+ artifacts. Engine: trivial (statics exist). AI: good (passive).
- **Union rigs** (Yugioh union / living equipment): creatures that attach
  as auras. Engine: cheap-moderate (aura infra exists). AI: moderate.

### Core Set II (2.0)
- ▶ **The Mandate** (MTG monarch, rethemed as the contested Mandate of
  Heaven): one shared crown; its holder draws each turn; combat damage
  steals it. Engine: moderate (one shared state + triggers). AI: excellent —
  "hit the crown-holder" is the cleanest aggression heuristic available.
  The strongest single recommendation in this document, and the most
  Three-Kingdoms mechanic imaginable.
- **Oaths / formation synergy**: lieutenant-style "if you control your
  commander" hooks that dovetail with the 1.5 Darlings format.

## Tabled ledger (all sets)

Kept for future planning sessions; each was tabled for a reason, not
rejected on merit:

| Mechanic | Provenance | Why tabled |
| --- | --- | --- |
| Exert-alike | MTG exert | Tap model mismatch; low payoff |
| Sanity / corruption track | MTG poison-family | New player-level resource; only worth it as a set's whole identity |
| Transform / DFC | MTG werewolves etc. | No back-face card model; heavy across data/save/UI/AI |
| Pilot/Crew | MTG vehicles, YGO union | AI-hostile tempo decisions |
| Energy counters | MTG Kaladesh | Second resource pool (see Sanity) |
| Devour-alike | MTG devour | Viable, just not a headliner; sacrifice sizing is mid for the AI |
| Mummification | MTG embalm | Viable; second fiddle to Tribute + Nine Lives in the same set |
| Union rigs | YGO union | Viable; needs the steampunk identity to justify |
| Broodspawn | (token archetype) | An archetype, not a mechanic; free whenever wanted |
| Oaths / formation | MTG lieutenant | Wants Darlings shipped first to hook into |
