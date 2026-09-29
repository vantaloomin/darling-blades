<!-- source-of-truth: docs/plan-road-to-2.0.md, docs/plan-multiplayer.md, docs/plan-player-replays.md, docs/plan-save-cards.md, src/meta/DeckCode.ts, src/meta/Replay.ts, src/meta/SaveImage.ts, src/meta/DeckStorage.ts, src/ai/tiers.ts, src/ai/personality.ts, src/engine/view.ts, src/scenes/DuelScene.ts, src/scenes/PracticePickerScene.ts, src/meta/Economy.ts · last-verified: 2026-09-29 · proposal: post-2.0, not scheduled, nothing built -->

# Async PvP: challenge codes piloted by the Hard AI

**Status: Proposal, 2026-09-29; post-2.0; nothing built.** Added to the
roadmap at the owner's request; placement 2.1 or later, not scheduled.

## Goal

The owner's words (2026-09-29): "Async PvP - share deck-codes and a Hard AI
will pilot the deck for you to versus, that way people can still have a
semblance of PvP without making any P2P connections."

A player builds a deck and shares it as a code. Another player pastes the
code and plays against that deck, with the Hard AI at the wheel. It is the
feel of playing a friend's deck, without a second human online.

## How it fits the standing rulings

- **Multiplayer is cancelled, and the game is single-player by design**
  (owner, 2026-08-24; [plan-road-to-2.0.md](plan-road-to-2.0.md), "Multiplayer
  is cancelled"; [plan-multiplayer.md](plan-multiplayer.md) is kept only as a
  design record). This proposal does not reopen that ruling: the opponent is
  a local AI playing a shared list, so every game is still one player
  against the computer.
- **No network, no server, no accounts, no P2P.** A code is a string the
  players move themselves (chat, forum, a PNG). Nothing is uploaded, and
  nothing waits on the other player. Cloud accounts stay 2.1 and are not a
  prerequisite.
- **The AI still reads only `PlayerView`** (`src/engine/view.ts`). The
  shared deck is the AI's own deck, so knowing its list is ordinary; the
  AI never sees the importer's hand or library.

## What already exists (checked in the code, 2026-09-29)

- **Deck codes.** `src/meta/DeckCode.ts` writes `DBD3-` codes since 1.9
  (lane I, I3): a header naming the format (none, Standard `warchest`,
  or `darlings`), the Darling, the Warchest reserve, then the card list as
  24-bit card hashes. It still reads `DBD2-` and `DBD1-`. A card this build
  does not know fails the decode with `unknown-card`. The Deck Builder
  imports codes today.
- **The Hard AI.** `src/ai/tiers.ts` maps the Tower's top two tiers to the
  Hard brain (tier 6: Hard with no noise). Practice already offers a plain
  training duel at a chosen difficulty (`src/scenes/PracticePickerScene.ts`),
  and the balance harness plays Hard on arbitrary decks.
- **An opponent deck from outside the avatar roster.** `DuelSceneData` has
  `oppDeckOverride` and `landReserveOverride`; the tutorial and Limited use
  the deck override today. The reserve override is read on the tutorial's
  and Limited's paths only (`DuelScene.ts`, the `landReserves` build), never
  for a plain Standard duel, so a challenge needs its own branch in duel
  setup, not a new engine feature.
- **Ownership is not checked on an opponent's deck.** `validateDeck`
  (`src/meta/DeckStorage.ts`) checks owned counts for the player's own
  decks; the override path skips it, as Limited's opponents already do.
- **Replays.** `src/meta/Replay.ts` keeps the last ten games
  (`REPLAY_CAP = 10`; the tutorial is not recorded) as local,
  deterministic logs (decks, seed, actions). A shareable replay code
  (`DBR1`, [plan-player-replays.md](plan-player-replays.md)) is specified
  but **not built** (the road-to-2.0 table: "Spec'd, no code").
- **Save cards.** `src/meta/SaveImage.ts` carries a save code in a PNG
  `tEXt` chunk under the keyword `darlingblades-save`. The same carrier,
  under its own keyword, could hold a challenge code as a "challenge card"
  image; the save decoder itself would not read it.
- **The Tower's framing.** The gauntlet presents each opponent as a named
  portrait with a deck and a temperament (`src/ai/personality.ts`). A
  challenge can borrow that presentation: the Darling's portrait, the
  challenger's chosen name, the deck's colours.

## Design sketch

1. **Export.** In the Deck Builder, "Share as challenge" on a legal
   Standard or Darlings deck produces a challenge code: the deck's `DBD3-`
   payload plus a short header (a display name the player picks, a
   game-version stamp). A new prefix keeps it apart from plain deck codes,
   so pasting one into the other screen fails with a clear message.
   Optionally, the same code rides a PNG challenge card.
2. **Import.** A "Challenges" screen (Play menu, beside Practice) takes a
   pasted code or a PNG, previews the name, format, Darling and colours
   (not the full list, unless the player asks), and keeps a short local
   list of recent challenges.
3. **Play.** The duel runs with the challenge deck and its Warchest or
   Darling on the AI's side, the Hard brain at tier 6, and the importer's
   own chosen deck in the same format.
4. **Report back.** After the game the player can copy a result line to
   send to the challenger. With `DBR1` built, that can be the full replay
   code instead.

The feature is a code wrapper, one screen, a duel-setup branch and a few
strings. The engine and the AI are unchanged.

## Open questions (recommendation first)

1. **Format legality.** Recommended: Standard (Warchest) and Darlings
   only, checked on import against that format's rules (deck size, copies,
   reserve, Darling), and a code with no format (a plain list) refused.
   Limited decks stay out: their pool has no meaning to another player.
2. **Does the importer need to own the cards?** Recommended: no. It is the
   opponent's deck; Limited's opponents already skip ownership. Importing
   the list into the importer's own collection still goes through the Deck
   Builder's normal ownership check.
3. **Rewards and anti-farming.** Recommended: pay what Practice pays
   against a Hard opponent (`applyMatchResult` in `src/meta/Economy.ts`,
   with its rule that a loss before the minimum turn count pays nothing),
   and nothing more (no packs, no achievement that counts wins). A player
   can mint a weak code to farm, so a challenge must never out-earn
   Practice, which already lets anyone pick an opponent.
4. **AI difficulty.** Recommended: Hard, fixed, as the owner said (tier 6,
   no noise), so a challenge means the same thing to everyone who plays it.
   A selectable level can follow if players ask.
5. **A display name in the code.** Recommended: optional, free text,
   at most 24 characters, letters, digits, spaces and basic punctuation
   only, run through a small blocklist, shown with a "player-made" label.
   The export screen says not to put a real name or contact in it. The game
   has no text filter today, so the blocklist is new work.
6. **Version skew.** Recommended: refuse a code naming a card the
   importer's build lacks (the decode already fails with `unknown-card`),
   with a "needs a newer version of the game" message; when the stamps
   differ but every card resolves, play it with a notice that card rules
   may have changed since the code was made.
7. **A result or "beat my deck" code.** Recommended: a plain result line
   first (challenge name, win or loss, turns), marked as unverified: with
   no server, any result can be faked. The full replay rides `DBR1` once
   that is built.
8. **Where it lives in the UI.** Recommended: a Challenges entry in the
   Play menu beside Practice, and the export button in the Deck Builder.
   Not in the Tower: the Tower's rungs are tuned and gated, and a shared
   deck is neither.
9. **Does the AI need a persona?** Recommended: not at first. The Hard
   brain plays with the default knobs; a persona picked from the deck's
   shape (aggressive for a low curve) is a later, measured addition, since
   every knob changes win rates.

## Placement

Post-2.0, not scheduled: the 2.1+ row in
[plan-road-to-2.0.md](plan-road-to-2.0.md)'s feature placement, and a
Planned entry in [roadmap.md](roadmap.md). A recent-challenges list kept in
the save would need a save version bump; the first cut can keep it in
memory to avoid one. Nothing is built until the owner schedules it.
