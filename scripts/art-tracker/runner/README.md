# Art run kit

Tools used for the Core Set II art pass: generation through the Codex CLI's built-in image tool, crops, re-rolls, and a live review tracker page.

## Setup

Nothing personal is hard-coded. Set these before running:

- `ART_DIR` (required): the art output folder, with `raw/`, `out/`, `logs/` and `prompts-revised/`. Keep it outside the repo and never under `public/`.
- `ART_WORK` (optional): scratch state such as lane lists, prompts, `meta2.json`, `tracker-local.json` and patches. Defaults to `$ART_DIR/work`.
- `ART_PY` (optional, `lane3.sh` only): the Python with Pillow and the smartcrop dependencies. Defaults to `python`.
- `ART_DIR_NATIVE` (optional, `lane3.sh` only): `ART_DIR` as the Codex CLI sees it, for example a Windows path when the script runs under Git Bash.

The Codex CLI must already be signed in (`codex login status`). No credentials are stored here.

## Files

- `lane3.sh <lane> <list> [promptdir]`: one strictly serial generation lane. List lines are `id:mode:fig` (mode `character` or `subject`; fig 1 adds `--focal-frac 0.1`). It halts every lane on any auth error (a `HALT` file in `logs/`), stops after 3 consecutive failures, keeps raws in `raw/`, and writes the 640x800 WebP to `out/` via `scripts/smartcrop.py` and `convert-art-webp`. Run at most 3 lanes, on disjoint card groups.
- Prompts are built by `gen-card-art.ts --show-prompt` / `gen-spell-art.ts --show-prompt`, with the trailing "640×800 portrait." swapped for "tall 2:3 vertical portrait canvas, 1024×1536." (Codex's image tool otherwise returns 4:5).
- `sync.py diff` / `sync.py assets`, `ordered.py`, `merge.py`: build the tracker patch (status, head y, notes) and map uploaded asset ids back to cards. Run `ordered.py` and `merge.py` from `ART_WORK`.
- `apply_crops.py <crops dir> [--full]`: re-cuts saved crop boxes (fractions of the raw) from the raw. Only with `--full` (a complete crops listing) does a missing crop count as a Reset and restore smartcrop.
- `prep_reroll.py <reviews dir>`: builds the re-roll queue (Regen reviews with revised prompts from `prompts-revised/`, output-filter blocks, heads above y 179 that a crop can't fix).
- `config.py`: shared paths for the Python tools.
- `post.ts`: WebP encode through `scripts/convert-art-webp.ts`.
- `frame-bake/harness.ts`: bakes the game's real card textures (CardFrameFactory, ManaSymbols) in headless Chromium for the tracker's frame view.
- The review tracker page itself is `../page.html`; build and publish it as `../README.md` describes.

## Lessons

- Zoom-in crops fix most high heads: the crop top stays at the raw's top, so a smaller window lowers the head.
- Item cards whose subject isn't the face should not be face-zoomed.
- Output-filter blocks usually pass with a modesty clause.
- Spell and item prompts end with "crisp cel-shaded gacha anime spell illustration", so match on "crisp cel-shaded gacha anime" when inserting text before the style tail.
- Exact counts (nine tails) are unreliable from text alone; a reference image helps, and editing a near-miss image can work better than re-rolling.
