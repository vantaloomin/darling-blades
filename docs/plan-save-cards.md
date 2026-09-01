<!-- source-of-truth: src/meta/SaveCode.ts, src/meta/SaveImage.ts, src/ui/saveCard.ts, src/scenes/ProfileScene.ts · last-verified: 2026-09-01 · plan doc — SHIPPED in 1.7 -->

# Save cards: a PNG that carries your save

**Status: SHIPPED (1.7, 2026-09-01).** Proposed 2026-08-24; the codec landed
first and the UI half followed in the 1.7 cut. The Profile's export modal
offers the save card first (owner-picked art from a searchable owned-card
grid), and the import modal accepts a chosen PNG beside the pasted code.
`src/ui/saveCard.ts` is the browser half: canvas compositing, PNG encode,
download, and file pick.

## The idea

Instead of copying a long text code, export a PNG. The player picks card art
they own, the game composites a titled cover, and the save rides along in the
image's metadata. This is the trick SillyTavern and other character-card tools
use, and the appeal is the same: a save that looks like something worth keeping,
and moves like any other image.

## The property that makes it cheap

**A save card is a new CARRIER, not a new format.** The PNG `tEXt` chunk holds
the identical `DBS1-…` string `SaveCode.ts` already produces, so `decode()` and
every check it performs (magic, codec id, checksum, schema version, decoded byte
cap, truncation messaging) apply unchanged. The image layer never learns what a
save looks like, and a save-schema change needs no work here at all.

It also lifts a real limitation. The text export excludes replays by default
because the code gets unwieldy, and the Profile can still report "this profile
is too large to export as a code". A `tEXt` chunk has no practical size limit; a
400 KB payload round-trips (pinned by test).

## Locked decisions (owner, 2026-08-24)

1. **Bottom plate**, not a top ribbon and not a full card frame: a translucent
   dark plate across the bottom fifth carrying `DARLING BLADES` in the display
   face, the export date, and one identity line (collection percent, best rung).
   The art stays clean, and the file is self-describing when it surfaces in a
   folder months later.
2. **Owned cards only**, chosen from a searchable picker inside the export flow.
   Reuses `collectionFilter`'s search, which already covers name, type, subtype,
   trait and mechanic.
3. **Both formats, PNG offered first.** The text code stays exactly as it is;
   import accepts a pasted code or a chosen PNG.

## Built already

`src/meta/SaveImage.ts` — pure, browser-free, 16 tests in
`tests/meta/saveImage.test.ts`:

- `embedSaveCode(png, code)` inserts a `tEXt` chunk immediately before `IEND`,
  replacing any previous chunk with our keyword so repeated exports over one
  cover do not accumulate stale saves.
- `readSaveCode(png)` returns a named reason rather than throwing, because the
  input is a file a player chose: `not-png`, `truncated`, `no-save-chunk`,
  `bad-chunk`. It refuses a chunk whose declared length overruns the buffer.
- `crc32`, `hasPngSignature`, `isSaveCard`, `saveImageFilename`.

Verified against **Pillow**, an independent decoder, not just our own CRC math:
a real 640x800 card-art cover round-trips, Pillow reads the chunk, every chunk
CRC validates, and **the pixels are byte-identical to the source** — the embed
is metadata-only, with no re-encode.

The `no-save-chunk` message says some editors strip the data on re-save. That
was tested, not assumed: a plain Pillow re-save drops the chunk and the reader
reports exactly that.

## The UI half (shipped 2026-09-01)

- `src/ui/saveCard.ts` — `composeSaveCardCanvas` (cover-crop via the Art
  resolver + the bottom plate per the locked decision), `canvasPngBytes`,
  `downloadPngBytes` (anchor-click), `pickPngFile` (file input). Browser-only
  by design; the identity line is collection percent + best tower rung.
- Export modal: the save-card section leads, opening a searchable owned-card
  picker (`matchesSearch` grid, 24 per page). Tapping a card composites,
  embeds the CURRENT code (so the replays toggle applies to both formats),
  and downloads `darling-blades-save-<date>.png`.
- Import modal: "From save card…" file-picks a PNG, `readSaveCode` extracts
  the code into the same input + preview path the pasted code uses — one
  validation flow, two carriers.
- Fixed in passing: the Profile's 'dismissible' modals closed on any click
  INSIDE the panel (the full-screen dim was the only interactive surface), so
  clicking into the import textarea dismissed the modal; an inert panel
  tap-blocker now catches inside taps in all three modals. The import status
  line also joined its shell container (it used to outlive the modal as a
  stray scene-level line).

## The open question, answered

**A save card is a normal-looking PNG that silently contains an entire save.**
The export modal says it before the picker opens ("The PNG carries this entire
save inside it"), the success status repeats it, and the privacy footer covers
both formats — sharing the image is a deliberate act, not a surprise.

## Related

[plan-save-portability.md](plan-save-portability.md) owns the text codec and the
portability story this extends. Cloud saves remain the one Road-to-2.0 item with
neither a plan doc nor code.
