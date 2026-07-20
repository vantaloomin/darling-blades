<!-- source-of-truth: docs/plan-1.3.md, docs/land-art.md, src/art/ArtResolver.ts, src/ui/CardView.ts, src/scenes/DeckBuilderScene.ts, src/meta/SaveManager.ts · last-verified: 2026-07-20 · concretion of Pillar 2 — design proposal awaiting user answers to the flagged items; build follows the approved spec -->

# 1.3 Pillar 2 concretion - deck-builder land-style selector

Concretizes plan-1.3.md Pillar 2 against the real code (2026-07-20).
Locked upstream: the 30 vaulted basic-land variants ship as a selector in
the deck builder when adding basic lands; cosmetic only - no catalog
entries, no booster presence, not collectible; per-deck storage on
`SavedDeck.landStyle` (SHIPPED in the v22 bump, Pillar 1; `null` =
default art); supersedes the roadmap A/B question (B-lite chosen).

## 1. Style roster

The vault (`WaifuTCG-Art-Pilots/raws/lands-variants/`, 30 deliverables +
raws) covers the 5 basics x 3 themes x 2 versions:

| `landStyle` value | Theme source | Player-facing label (proposed) |
| --- | --- | --- |
| `null` | current live land art | Classic |
| `base` | base-set meadow/road/keep scenes | Heartlands |
| `ragnarok` | Norse coasts, barrows, auroras | Mythic North |
| `celtic-fae` | stone rings, hollow hills, mists | Fae Wilds |

One curated file per (basic, theme) ships - 15 of the 30 vaulted
variants. Curation is a HUMAN-EYES pass (flag 2): stage all 30 to the
cardproof gallery, the user picks v1 or v2 per cell (or delegates to
taste-review defaults).

## 2. Asset staging and resolution

- Chosen 15 copy from the vault into `public/assets/art/cards/` named
  `land-<basic>--<style>.png` (double hyphen keeps the namespace clear of
  real card ids; `gen-art-manifest` lists whatever exists, and
  `gen-art-halfres` derives the lite tier the same as any card art).
- `ArtResolver.getArt(cardId)` grows an optional `landStyle` argument:
  when set and `${artKey}--${style}` is in the manifest, return that
  texture; otherwise fall back to the plain key. Zero-404 guarantee
  preserved (manifest-gated), procedural placeholder path untouched.
- `CardView` bake passes the style through for basic-land ids only
  (`isBasic`); every other card ignores it.

## 3. Who renders styled lands

- Deck builder: the basics rows and any card preview render the ACTIVE
  deck's style live, so the selector previews itself.
- Duel: the HUMAN side's basics bake with the active `SavedDeck`'s
  style. Opponent decks (avatars, prefab AI, Limited bots) always render
  default art (flag 3) - avatar decks are not SavedDecks and have no
  style.
- Collection, showcase, pack reveals: default art (lands are not
  collectible variants; the style exists only inside a deck context).
- Replays: cosmetic and not recorded in the log; playback renders the
  replay's decks with default land art. Accepted residual, one line in
  docs/architecture.md's replay notes.

## 4. UI: one selector per deck (proposed - flag 1)

One style control for the whole deck, not per basic type: a compact
"Land style" row above the basics steppers in the deck builder's right
column (label + left/right cycler through Classic / Heartlands / Mythic
North / Fae Wilds, current choice shown as a 44x32 art swatch of the
deck's most-counted basic). Writes `SavedDeck.landStyle` immediately;
the basics rows re-bake on change so the choice is self-previewing.
Per-basic-type granularity (a style per land row) stays available as a
future extension of the same storage shape (comma-keyed map) but is NOT
proposed now: five cyclers crowd the audited touch-target layout that
just got its isolation pass, for marginal expressive gain.

## 5. Tests

Headless: resolver fallback logic (styled key present / absent /
non-basic ignores style), DeckStorage round-trip of landStyle through
save/copy (exists since v22), and a manifest-integrity check that every
`--<style>` file maps to a real basic + roster style. UI verification
via the preview probe: builder cycler writes the save, duel bakes the
styled texture for the human side only.

## 6. Flagged for the user before the build

1. **Granularity: one style per deck** (proposed) - or per basic type?
2. **Curation**: user picks v1/v2 per (basic, theme) from a staged
   cardproof gallery (recommended - 15 taste calls, one sitting), or
   accept taste-review defaults sight unseen?
3. **Opponent lands stay default** (proposed) - or should avatar decks
   adopt thematic styles (e.g. Ragnarok bosses on Mythic North) as a
   free flavor rider?
4. **Player-facing style labels**: Classic / Heartlands / Mythic North /
   Fae Wilds (proposed) - or plain set names (Base / Ragnarok / Celtic
   Fae)?
