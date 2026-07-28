<!-- source-of-truth: docs/plan-1.5.md, docs/expansions/yokai-nights.md, docs/expansions/drafts/yokai-nights-overplan.md, docs/rules.md, docs/keyword-map.md, src/engine/types.ts, src/engine/actions.ts, src/engine/Game.ts, src/engine/resolve.ts, src/engine/sba.ts, src/engine/statics.ts, src/engine/view.ts, src/engine/events.ts, src/meta/Replay.ts, src/data/opponents.ts · last-verified: 2026-07-28 · concretion doc - proposed for user approval; no engine or card data is implemented -->

# 1.5 Pillar 0 concretion - Hauntlink and Cyberpunk Yokai Nights

Status: **PROPOSED FOR USER APPROVAL.** This document and
[expansions/yokai-nights.md](expansions/yokai-nights.md) are the docs-only
Pillar 0 package. No engine, card-data, meta, UI, or save work is authorized by
this package. The numbered defaults in section 7 remain proposals until the
user approves them.

The program plan locks the mechanic shape. This dossier does not redesign it:
`Hauntlink {cost}` is an alternate way to cast a noncreature Artifact or
Enchantment. The caster pays the Hauntlink cost, chooses one creature they
control, and the permanent enters linked to that creature. Its printed Linked
rider applies to that host. Each link has exactly one host, never moves or
reattaches, and goes to its owner's graveyard when the host leaves play. A
normal-cost cast enters as a standalone permanent.

The implementation must preserve these invariants:

- The engine is headless and seeded-deterministic.
- `src/engine`, `src/ai`, `src/data`, `src/meta`, and `src/config` never import
  Phaser or browser APIs.
- Every AI difficulty reads only the redacted `PlayerView`.
- Multicolor nonland cards are named legends only. The concretized set instead
  demotes every surviving multicolor candidate to one color.
- Test gate floors only ratchet upward, with fresh measured evidence.

## 1. Player-facing contract

### Exact template

Every Hauntlink card uses these two lines in this order:

> **Hauntlink {cost}** (You may cast this for its Hauntlink cost. If you do,
> choose a creature you control. This enters linked to it.)
>
> **Linked:** The linked creature gets [printed rider].

The table may place ordinary `Arrives`, `At dawn`, or static text before those
lines for compactness. Text outside the Linked line functions in both modes.
The Linked rider functions only while the permanent has a live host.

The v1 data shape is intentionally narrow:

```ts
hauntlink?: { cost: ManaCost }
```

Each Hauntlink definition carries exactly one existing
`when: 'static'` ability with `scope: 'attached'`. That static is the Linked
rider. The rules-text generator recognizes a Hauntlink definition and prints
that attached static as `Linked:` rather than as Aura text. Ordinary abilities
remain ordinary abilities, so no mode-specific trigger vocabulary is added.

### Casting speed and stack behavior

- Hauntlink does not change timing. Artifacts and Enchantments remain
  own-main-phase casts, in either main phase, while the caster is the active
  player. No Yokai Nights card gives Hauntlink Charm timing.
- Hauntlink is an alternative cost, not an additional cost. The player chooses
  normal or Hauntlink mode before paying mana and placing the spell on the
  stack.
- A Hauntlink cast has exactly one target: a creature the caster controls. The
  existing `yourCreature` target kind is sufficient. The caster's own
  Untouchable creature remains legal under the shipped one-sided rule.
- The cast opens the ordinary single opponent response window. It can be
  cancelled like any other spell. A cancelled Hauntlink cast goes to its
  owner's graveyard.
- The chosen mode is locked on the stack. It cannot change to a normal cast,
  choose a second host, or refund mana after responses.
- If the host is no longer a creature controlled by the caster at resolution,
  the sole target is illegal. The spell fizzles, enters no battlefield mode,
  and goes to its owner's graveyard. There is no standalone fallback. This is
  proposed default S1.

### Battlefield relationship

- A linked card is still its printed Artifact or Enchantment permanent. It can
  be inspected, targeted, destroyed, severed, recalled, and counted by effects
  that inspect its printed types.
- The runtime reuses `Permanent.attachedTo` as the single host pointer and the
  host's `attachments` array as the inverse public index. A Hauntlink card with
  `attachedTo` set is linked. The same card with no pointer is standalone.
- Multiple different links may share one host, but each link has only one host.
  There is no reattach action. This is proposed default S2.
- A linked permanent is exempt from the four-slot noncreature permanent cap,
  matching the existing Aura board-shape rule. Its normal mode consumes one
  slot. This is proposed default S3.
- Leaving play and returning creates a new permanent identity. A recalled host
  may be cast again, but the old link has already gone to the graveyard and
  does not follow it.

## 2. Zone changes, marks, and mass effects

The host-departure rule is a state-based cleanup, not a response and not a new
stack item. It runs in the existing stable SBA loop after each mutation batch.
The link is put into its owner's graveyard even when the host was recalled or
severed.

| Change | Host result | Link result |
| --- | --- | --- |
| Host is destroyed or dies to damage | Graveyard, or it evaporates if it is a token | Owner's graveyard during the same SBA cycle |
| Host is recalled | Owner's hand, or it evaporates if it is a token | Owner's graveyard |
| Host is severed | Owner's severed pile | Owner's graveyard |
| Link is destroyed | Host stays | Owner's graveyard |
| Link is recalled | Host stays | Owner's hand |
| Link is severed | Host stays | Owner's severed pile |
| A creature sweep removes the host | Host follows the sweep | Link goes to its owner's graveyard during cleanup |
| An Enchantment sweep removes an Enchantment link | Host stays, then its effective stats are recomputed | Link follows the sweep |

Direct removal of the link follows the printed permanent type. In particular,
`destroyArtifactOrSeverEnchantment` destroys an Artifact link and severs an
Enchantment link. If a future permanent has both types, the shipped
artifact-first branch remains authoritative.

Marks belong to the permanent that received them. Removing a link never removes
marks, damage, temporary modifiers, or other attachments from its host. Marks
on a host remain after the Linked rider ends. The v1 carrier restriction keeps
links noncreature, so links themselves do not receive creature marks in this
set.

The existing static layer already recomputes `scope: 'attached'` on read. If a
defense-granting link leaves, the host's defense drops immediately and the next
SBA pass may destroy it for lethal damage or defense zero. If a host and one or
more links are condemned in the same pass, each permanent moves once in
battlefield order. There is no duplicate graveyard entry.

Hauntlink does not share Aura casting rules. V1 Hauntlink definitions are
noncreature, non-Aura Artifacts or Enchantments, cannot carry X, and do not
combine with Empower on one card. No 1.5 Hauntlink card also carries Skim or
Retell. This is proposed default S4. Auras and Hauntlinks may coexist on one
host because both use the same public relationship and cleanup loop.

Ordinary non-Linked abilities work in both casting modes. This makes
standalone mode a durability choice rather than a separate rules body and
avoids conditional arrival plumbing. This is proposed default S5.

## 3. Engine and presentation touchpoints

### Casting, resolution, and cleanup

| File | Required handoff |
| --- | --- |
| `src/engine/types.ts` | Add `HauntlinkDef`, `CardDef.hauntlink`, and `StackItem.hauntlinked`. Generalize the comments on `attachedTo` and `attachments`; no second host pointer is needed. |
| `src/engine/actions.ts` | Add `hauntlinked?: true` to the `castSpell` action and follow the Retell alternative-cost seam through cast enumeration, cost choice, validation, mana-plan validation, and uncastable reasons. Enumerate one fully specified Hauntlink action per legal friendly host. Reject normal and Hauntlink flags together with Empower, X, Aura, or creature carriers. Make the four-slot cap mode-aware. |
| `src/engine/Game.ts` | Remove the card from hand, pay `hauntlink.cost`, preserve the selected host in `targets[0]`, place `hauntlinked: true` on the stack item, and emit the public cast mode. No new random call is permitted. |
| `src/engine/resolve.ts` | Use `yourCreature` as the cast target only in Hauntlink mode. Recheck it on resolution, use the ordinary fizzle path when illegal, and enter the permanent with `attachedTo` only after a successful Hauntlink resolution. Normal mode enters with no host. |
| `src/engine/battlefield.ts` | Keep the existing forward and inverse attachment bookkeeping. Generalize comments and add assertions or tests that the host exists when a successful link enters. |
| `src/engine/statics.ts` | No new static layer is required. The printed Linked rider is the existing `scope: 'attached'` static and applies only while `src.attachedTo === host.iid`. |
| `src/engine/sba.ts` | The current orphan-attached-permanent pass already has the correct algorithm. Generalize the Aura-only comment, preserve batch ordering, and test destroyed, recalled, severed, token, and simultaneous-host cases. |
| `src/engine/effects/EffectInterpreter.ts` | Cancellation needs no Hauntlink-specific exit route because the card began in hand. Existing destroy, recall, sever, type-removal, and mass-effect paths must be covered by link cleanup tests. |
| `src/engine/effects/targeting.ts` | Reuse `yourCreature`; add no target kind. Resolution legality must still require current control by the caster. |

### Public view and narration

The link relationship is public. `PlayerView.battlefield` already clones every
permanent, and `PlayerView.stack` already exposes public stack targets. No hand
identity, library order, or Foresee choice becomes visible, so
`src/engine/view.ts` needs tests but no redaction rule change.

`src/engine/events.ts` should make the mode explicit on `spellCast` and add two
public events:

```ts
{ e: 'hauntlinkFormed'; linkIid; hostIid; cardId; controller }
{ e: 'hauntlinkBroken'; linkIid; hostIid; cardId; owner }
```

The formed event fires after successful entry. The broken event fires only for
the host-departure cleanup, before the ordinary graveyard movement event. A link
removed directly uses the existing destroyed, recalled, or severed narration.
The duel history can therefore say `Hauntlinked [card] to [host]` and
`[card]'s Hauntlink broke` without reconstructing old state. All payload fields
are public and deterministic.

`src/ui/rulesText.ts` owns the exact template in section 1. `DuelScene` needs a
Normal or Hauntlink chooser when both modes are legal, then the existing target
picker restricted to friendly creatures. A linked-card lane or host-side stack
must keep every link inspectable and must not use an interactive scaled
Container. The Glossary gains one Hauntlink row when the engine ships.

### Replay and save compatibility

`REPLAY_LOG_VERSION` must move from 2 to 3. The recorded `castSpell` action gains
an observable mode flag and host target, and the engine's resolution behavior
changes. Old logs must fail closed under the existing replay discipline. The
card database stamp also changes when Yokai Nights card definitions land, but
that is not a substitute for the version bump.

No `SaveData` change is needed. Hauntlink state exists only inside a live game
or replay action stream; collection, deck, booster, and achievement progress
continue to use card ids and existing variant records. All eight proposed
achievements below are recomputable from existing collection data. The v22 to
v23 migration remains owned by Pillars 2 and 3, exactly as the program plan
states.

## 4. AI plan for all difficulties

Every legal Hauntlink action is fully specified by mode and public host iid.
That keeps the mechanic inside the existing action, target, value, and rollout
paths. No brain chooses a host after resolution, reads hidden state, or uses an
unseeded tie-break.

`src/ai/value.ts` should add two deterministic helpers:

- `linkedRiderValue` measures the marginal attached static on a proposed host.
  It values only new attack, defense, and nonduplicate keywords.
- `hauntlinkCastValue` compares normal and linked modes using the actual mode
  cost, ordinary permanent value, the rider's marginal value, immediate combat
  relevance, and a public concentration-risk discount. A damaged host near
  lethal is risky; a healthy Untouchable host is persistent. No opponent hand
  assumption is allowed.

Difficulty behavior:

- **Easy:** legal enumeration supplies every host. Outside its existing seeded
  noise branch, Easy ranks Hauntlink variants by a coarse rider value plus the
  host's current effective stats, then compares the best link with the normal
  cast. It may overcommit to its largest body by design, but it must not choose
  a duplicate keyword over a strictly useful rider.
- **Medium:** extend `castScore` with the mode-specific cost and host score.
  Prefer Hauntlink when the rider's immediate and persistent value exceeds the
  host-loss discount; prefer standalone when every host is fragile, already has
  the granted keywords, or the independent dawn engine is worth protecting.
  Target choice uses only the public battlefield in `PlayerView`.
- **Hard:** include Hauntlink variants beside Empower and Retell candidates in
  main-phase simulation. Sort by Medium's host score before the existing
  fanout cap so the best hosts are never truncated by battlefield order. The
  determinized engine then prices the real linked static, combat, opposing
  response, host loss, and future board evaluation. `simDb(db)` remains
  mandatory.

The cull removes Ghostlight Network and Yokai Network Empress, the two
multi-turn `(AI-risk)` rows that combined link state with broader payoff
sequencing. The only surviving flagged row is Hauntlink Apex. Its Linked rider
is a single attached static and its dawn draw belongs to the permanent in both
modes. The legal-action ranker can value the host now, and Hard can simulate
the exact public result without planning a move, second host, or hidden-zone
condition.

AI verification for the later engine handoff must include legal-action
enumeration, mode comparison, duplicate-keyword avoidance, fragile-host
avoidance, deterministic ties, all three difficulty choices, PlayerView-only
access, and a seeded replay golden. Balance floors are remeasured only after
the approved cards land and may only ratchet upward.

## 5. Set completion proposals

### Summit pair and tower growth

The current roster ends at rung 18. Adding two bosses makes the tower exactly
20 floors, matching the program plan. Both bosses use Hard AI; tier floors and
win-rate gates remain unset until the single 80-plus-seed end-of-set
measurement.

- **Rung 19: Queen of the Lanterned Roof** (`yn-queen-of-the-lanterned-roof`,
  UR). W/U Kitsune Hauntlink tempo-control. Proposed deck shape: 24 lands, 20
  resilient Kitsune bodies, 8 Hauntlink permanents, and 8 recall, cancel, and
  Foresee cards. Personality starting point: aggression 1.25, holdback 1.0,
  attack threshold -0.2, subtype bias 1.5 for Kitsune, removal bias -0.5.
- **Rung 20: Kitsune Neon Tyrant** (`yn-kitsune-neon-tyrant`, UR). U/R
  Hauntlink pressure. Proposed deck shape: 24 lands, 22 Warcry or Skyborne
  bodies, 6 Hauntlink permanents including Hauntlink Apex, and 8 burn or tempo
  cards. Personality starting point: aggression 1.45, holdback 0.75, attack
  threshold -0.6, subtype bias 1.25 for Kitsune, removal bias 0.25.

This is proposed default B1. Deck lists and personality numbers are calibration
starting points, not balance claims.

### Precon and booster

**Neon Afterimage** is the proposed W/U/B precon. It is a body-first Hauntlink
midrange deck: cheap white and blue hosts, black life pressure and Sever
interaction, common one-color links, Foresee smoothing, and a small top end of
protected Skyborne threats. The list should function without SR or higher
engines and should compare normal versus linked mode often enough to teach the
mechanic. This is proposed default P1.

The Yokai Nights booster is the locked set-scoped 9-card booster at **525g**.
It uses the existing rarity, frame, finish, and high-rarity duplicate-protection
rules. No economy rate is claimed before the post-set rebaseline.

### Set icon

The proposed icon is a split kitsune mask crossed by one hooked signal cable.
The left eye is a solid shrine-flame cutout; the right eye is a square network
node. The silhouette stays asymmetric and legible as a tiny one-color stamp,
with no text, tiny whiskers, or loose neon details. This is proposed default I1.

### Eight schema-free achievements

| Name | Existing-data condition |
| --- | --- |
| First Contact | Own 1 Yokai Nights card. |
| Neon Regular | Own 30 unique Yokai Nights cards. |
| Night Market Insider | Own 60 unique Yokai Nights cards. |
| City Possessed | Own all 120 unique Yokai Nights cards. |
| Thirteen Voices | Own all 13 Hauntlink cards in the set. |
| Five Crowns at Dawn | Own all 5 Yokai Nights UR cards. |
| Prismatic Rain | Own 10 unique Yokai Nights cards with a rainbow frame. |
| Perfect Possession | Own a void-finish Hauntlink Apex. |

Each condition derives from existing `collection` and `collectionVariants`
data. No new durable progress field is introduced. This is proposed default
A1.

## 6. Later implementation and verification handoff

After user approval, the implementation sequence is:

1. Engine types, legality, payment, resolution, cleanup, events, view tests,
   three-difficulty AI support, replay version 3, and headless determinism.
2. The approved 120 card definitions and no set-unique tokens.
3. Booster, Neon Afterimage, eight achievements, rules text, Glossary, and duel
   affordances.
4. Rungs 19 and 20, art bible and art run, then the one measured end-of-set
   rebaseline at 80 or more seeds.

The engine handoff must include target-loss fizzle tests, cancel tests, every
host and link zone change, mass effects, multiple links on one host, static
recomputation, noncreature cap behavior in both modes, public-view equality,
three-difficulty host choice, action determinism, replay version refusal, and a
golden replay containing a successful link and a fizzled link.

## 7. Numbered user flags and recommended defaults

**APPROVED 2026-07-28 (user): all recommended defaults locked (S1-S5, B1, P1, I1, A1). D1 RESOLVED same day, rationale corrected 2026-07-28 evening: the pool in fact already carries 23 tapped duals covering all ten pairs (an initial audit probe misread the card shape and reported zero); the user, on corrected facts, kept the approved swap of the set's five mono taplands for the ally-pair tapped dual cycle (W/U, U/B, B/R, R/G, G/W) — applied to the card table.**

- **S1 - Host gone on resolution:** fizzle to the owner's graveyard with no
  standalone fallback. Recommended because the chosen alternative mode and
  target are locked when the spell is cast.
- **S2 - Several links on one host:** allow it. Each link still has exactly one
  host. Recommended because it matches the existing attachment model and avoids
  another capacity rule.
- **S3 - Board cap:** exempt linked mode from the four noncreature-permanent
  slots; normal mode consumes one. Recommended because linked cards occupy the
  host-side attachment shape and the headline mechanic must remain castable on
  developed boards.
- **S4 - V1 carrier limits:** allow only noncreature, non-Aura Artifacts and
  Enchantments; reject X and Empower combinations; ship no Hauntlink plus Skim
  or Retell card. Recommended to keep the engine surface to one host pointer,
  one cost mode, one static rider, and one cleanup rule.
- **S5 - Ordinary text in both modes:** all non-Linked abilities function when
  normal or linked. Recommended because it avoids conditional trigger plumbing
  and makes standalone mode the lower-risk durability choice.
- **B1 - Summit pair:** Queen of the Lanterned Roof at rung 19 and Kitsune Neon
  Tyrant at rung 20. Recommended as a control-to-pressure climb that showcases
  Hauntlink in both fights.
- **P1 - Precon:** Neon Afterimage, W/U/B body-first Hauntlink midrange.
  Recommended because all three colors have common hosts, links, smoothing,
  and interaction without a high-rarity dependency.
- **I1 - Set icon:** split kitsune mask plus hooked signal cable. Recommended
  for tiny-size readability and immediate yokai-network recognition.
- **A1 - Achievement slate:** the eight schema-free collection and variant
  goals in section 5. Recommended because every condition is recomputable and
  preserves the program plan's no-save-bump expectation.
