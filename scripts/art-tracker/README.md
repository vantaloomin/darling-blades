# Art-run tracker

A live review page for a set's art run. An image generator on the owner's PC writes progress into the page's shared database. The owner reviews every card in the real card frame, drags a crop, and marks each card Approved, Regen, Crop changed or Other. The runner on the PC then applies the crops and re-rolls the Regen cards.

It was built for Core Set II (2026-10, 250 cards). That run's page is https://claude.ai/artifact/R1W16TQEouSPjpXjKgEJMX.

## Files

| File | What it is |
| --- | --- |
| `page.html` | The page. It has nothing set-specific: it reads `tracker.json` and the database. |
| `entry.ts`, `rulesTextShim.ts`, `vite.config.ts` | The card preview bundle (`dbcard.js`). It is Phaser plus the game's own `CardView`, `CardFrameFactory`, `ManaSymbols` and `HoloEffects`, exposed as `window.DBCard`. |
| `build.ts` | Builds `dist/index.html`, `dist/dbcard.js` and `dist/tracker.json` for one set. |
| `sets/<set>.json` | A set's settings: `title`, `eyebrow`, `idPrefix`, and optionally `draftsFile`. |

## Start a tracker for a new set

1. Add `sets/<set>.json`:
   ```json
   { "title": "Core Set III Art Run", "eyebrow": "Darling Blades · Core Set III · image run", "idPrefix": "cs3-" }
   ```
2. If the cards aren't in `src/data` yet, add `"draftsFile": "<set>-drafts.json"`. That file maps each card id to `[cost, "supertype · type · Subtypes", "A/D", printed rules text, rarity, "W/U"]`, for example `["{2}{W}", "creature · Human Soldier", "2/2", "Sentinel.", "c", "W"]`. A card already in `CARD_DB` always renders from its real definition, so no drafts are needed once the set is in the game data.
3. Run `npm run art-tracker:build -- <set>`, or `npx tsx scripts/art-tracker/build.ts <set>` from PowerShell.
4. Publish `dist/index.html` as a new Artifact. Use `dist/dbcard.js` and `dist/tracker.json` as supporting files with those same names. Give it the capabilities `{"assets": {}, "db": {"rules": [{"path": "", "read": "view", "write": "admin"}]}}`. The owner is admin, so their review marks and crops save; viewers can only read.
5. Give the runner on the PC the Artifact's URL. Rebuild and republish to the same URL after any card-frame change in `src/ui`.

## Database contract

The runner on the PC writes `run/state`. The page writes `crops/<id>` and `reviews/<id>`.

**`run/state`** (written by the runner):
- Top level: `phase`, `note`, `updatedAt` (ISO), `running`, `halted`, and `lanes.<name> = {current, done, total, group}`.
- `cards.<id>` fields:
  - `n`: the card name.
  - `o`: run order.
  - `s`: section label. The section filter is built from these, in run order.
  - `st`: one of `queued | gen | done | flag | fail`.
  - `t` and `f`: thumbnail and the full 640×800 deliverable. These are asset URLs the runner uploads.
  - `r`, `rw`, `rh`: a preview of the raw image and the raw's pixel size.
  - `crop`: the automatic crop box.
  - `h`: head y on the 640×800 image. The guide line is y 179.
  - `note`, `lane`.
  - `cropApplied`: the `savedAt` of the crop that was cut.
  - `regenDone`: the `savedAt` of the Regen review that was re-rolled.
  - `promptEdit`: a one-line summary of the prompt change.

**`crops/<id>`** (written by the page): `{x, y, w, h, savedAt}`.
- The values are fractions of the raw, and the box is always 4:5 in raw pixels.
- Deleting the document (the Reset button) means "go back to the automatic crop".
- The runner re-cuts the 640×800 image from the raw and sets `cropApplied`.

**`reviews/<id>`** (written by the page): `{status: approved | regen | crop | other, note, savedAt}`.
- A Regen card shows "queued" until `regenDone` equals its `savedAt`.

## Rules for the runner

- **A Regen changes the prompt.** Revise the prompt from the owner's note; never re-run the same prompt (owner ruling 2026-10-09). Keep each revised prompt and its diff beside the images, and fold them back into the set's art bible after the run.
- **Filter blocks.** If a card is blocked by the image safety filter, re-roll it with the character unmistakably adult (adult face and proportions) and with toned-down framing. Never work around the filter while keeping a youthful read.
- **Show, don't send.** Every candidate the owner has to judge goes into the tracker, or onto a published page linked in the project thread. A file left on the PC is not delivered.
- **Nothing goes into `public/`** until the owner approves the set. Approved art moves into the repo in its own PR.

## What the Core Set II run taught

- **Most high heads are a crop fix, not a re-roll.** With the crop box anchored at the top of the raw, zooming in pushes the head down the card. On a 1024-wide raw, any box at least 63% of the width still downsamples to 640, so the zoom costs no sharpness. 28 of 31 flagged heads were fixed this way; only heads too high to fix without upscaling needed a re-roll.
- **Check that a prompt edit actually matched.** One headroom edit silently missed the spell and item prompts, because they end with a different phrase. Verify the revised prompt differs before re-rolling.
- **Exact counts (nine tails, five pearls) are unreliable from a fresh draw**, even with a reference image. Generate several candidates, count them zoomed in, and edit the closest one rather than re-rolling. If that also fails, composite by hand.
