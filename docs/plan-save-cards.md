<!-- source-of-truth: src/meta/SaveCode.ts, src/meta/SaveImage.ts, src/scenes/ProfileScene.ts · last-verified: 2026-08-24 · plan doc — a CANDIDATE for 1.7, not committed scope -->

# Save cards: a PNG that carries your save

**Status: candidate, not scoped.** Proposed 2026-08-24 and added to the Road to
2.0 list. The codec below is BUILT and tested; the UI is not. Nothing imports
`SaveImage.ts` yet, so the feature is inert until a release commits to it.

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

## Not built

The whole UI half:

- Owned-card picker (grid + search) in the export modal.
- Canvas compositing: art, bottom plate, title, date, identity line.
- Download. There is no download helper in the codebase yet.
- File input for import. There is no file-input helper either.
- Wiring `readSaveCode` into the existing import validation path.

## Open question the UI must answer

**A save card is a normal-looking PNG that silently contains an entire save.**
That invisibility is the format's whole appeal and it cuts both ways: a player
could post their favourite art in a thread without realising it carries their
collection, gold and decks. Nothing here is a security hole, since it is their
own data, but the export UI should say plainly that the image contains the save,
so sharing it is a deliberate act rather than a surprise.

## Related

[plan-save-portability.md](plan-save-portability.md) owns the text codec and the
portability story this extends. Cloud saves remain the one Road-to-2.0 item with
neither a plan doc nor code.
