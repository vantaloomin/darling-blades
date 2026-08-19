<!-- source-of-truth: docs/art-bible/index.md, docs/art-bible/sands-of-the-duat-drafts.md, docs/spell-art.md, docs/plan-duat-creative.md, docs/plan-1.6-large-set.md, scripts/gen-card-art.ts, scripts/gen-spell-art.ts, scripts/check-art-bible.ts, scripts/gen-art-halfres.ts, src/scenes/ShopScene.ts · last-verified: 2026-08-19 · program doc — the Sands of the Duat art production plan; re-verify when the pipeline scripts or the card-data waves change -->

# Sands of the Duat — art production plan

How the ~250-piece Duat art run executes, mechanically, the moment the
card-data waves mint real `sd-` ids. Everything upstream is DONE: the binding
gold/lapis register (art-bible/index.md §4a), the draft entry batch
(art-bible/sands-of-the-duat-drafts.md: 13 legends, 5 duals, the pack face),
and all six owner taste rulings (2026-08-18: heart-red kept, lapis-row badge
vetoed, daylight ~1/3, Anuket added, mythic geography, Kesi lineage a rumor).
The ONLY gate left is card data. This doc is the runbook.

## 0. The one dependency, stated precisely

Art binds to card ids. `check-art-bible` enforces that a bible file's entries
match its set's creature ids exactly (count, membership, source-file order),
and `gen-spell-art` hard-fails on roster drift by design. So no entry can be
authored, and no image generated, for a card that does not exist in
`src/data/cards/`. **Each card-data wave therefore un-gates its own art batch,
and art production interleaves with the data waves rather than waiting for
the whole 245.**

## 1. Scope and deliverables (at the ratified 245-card frame)

| Deliverable | Count (approx) | Pipeline | Prompt source |
| --- | --- | --- | --- |
| Creature illustrations | ~145 (60% creature share) | `gen-card-art` (character smart-crop) | NEW `docs/art-bible/sands-of-the-duat.md`, 13-field entries |
| Non-creature spell/artifact illustrations | ~95 | `gen-spell-art` (environment crop) | NEW "Sands of the Duat" section in `docs/spell-art.md` + `EXPECTED_IDS` extension |
| Dual-land illustrations | 5 | `gen-spell-art` environment path (no faces) | The five landscape briefs, promoted from the drafts file |
| Booster pack face | 1 | `gen-scene-art` + a `PackArtOpts` config in ShopScene (`pack-art-duat`) | The Sealed Door brief in the drafts file |
| Set icon | 1 | Procedural: one new `SET_ICON_PATHS` SVG path (code, not generation) | Design note: a cartouche outline or scale-beam glyph; blank interior per the NO-TEXT rule |
| Half-res mobile variants | 1 per card image | `gen-art-halfres` (derived, gitignored) | automatic |

Tokens (`tok-duat-scarab`, `tok-bastet-kit`) get entries in the creature bible
per the constructs-and-tokens precedent.

## 2. Doc and script plumbing (one-time, first wave)

1. **NEW `docs/art-bible/sands-of-the-duat.md`** seeded from the drafts file:
   each draft entry's placeholder `sd-` id is replaced by the real card id,
   Card facts filled from real data (cost, colors, P/T, keywords, rarity),
   and the file registered in BOTH `check-art-bible.ts` `FILE_MAP` and
   `gen-card-art.ts` `FACTIONS`. From that moment the checker enforces the
   set like every shipped set. The drafts file then carries a
   superseded-by pointer and stops growing.
2. **`docs/spell-art.md`** gains a "Sands of the Duat (N)" section per wave
   and `gen-spell-art.ts` `EXPECTED_IDS` grows in lockstep (the roster
   cross-check is the drift guard; the sprinkle wave exercised this exact
   seam at +7).
3. **Entry authoring at set scale is agent work**: generate entries the way
   the shipped sets did, with a `gen-duat-artbible.ts` script following the
   `gen-darktales-artbible.ts` pattern (card facts computed from data,
   creative prose merged from the register + per-archetype templates), then
   a review pass. Hand-authoring 245 entries is the fallback, not the plan.
4. **Register rules ride every prompt**: the §4a accents, the resin-brown
   value floor, one named practical key + lapis rim, the blank-cartouche
   positive AND negative phrases, the per-mechanic composition rule (Rite
   shows the payment; Nine Lives the second landing with the canonical life
   mark; Preserve the copy in natron white), and the full Bastet species
   tells on every Bastet card. The vetoed lapis-row rarity badge must NOT
   appear as a rarity rule in any entry; collar rows are free.

### Prompt-authoring rules (learned from the Wave A review, 2026-08-19)

Wave B prompts inherit these four clauses. Carry every clause that applies to
the subject and scene into the generation-ready Prompt line; the wording is
deliberately explicit because the generator composes for the full frame, not
just the card window.

1. **Species tells are an early MUST clause.** Every Bastet prompt opens its
   species block with: `MUST show: slit vertical pupils, two upright tufted
   ears, exactly ONE unforked tail with its base VISIBLE emerging at the
   tailbone center of the lower back`. Pose the tail visibly, curling beside
   the leg or behind the calf, never occluded. The kit token's early species
   phrasing is the successful precedent.
2. **Vertical placement is explicit.** The card window is y167-633 of the
   640x800 frame, while the generator composes for the full frame. Every
   load-bearing object, including mechanic evidence, life marks, landing
   traces, offering objects, scale, feather, and heart, must say: `at
   mid-height in the center of the frame, fully visible in the upper two
   thirds, never near the bottom edge`. Every figure must say: `face in the
   upper third with generous empty air above the head`.
3. **Distant architecture has a glyph guard.** Alongside the existing
   positive blank-cartouche phrase and NO-TEXT negatives, every prompt adds:
   `all distant walls, pylons, columns and background architecture perfectly
   smooth blank stone with plain flat geometric banding only, no carved relief
   anywhere`. QA treats any distant architectural glyph leak as a FAIL.
4. **Value insurance is mandatory for dark scenes.** Every tomb/night prompt
   adds: `a generous pool of warm light claiming a large part of the frame,
   rich readable detail in every shadow, no near-black areas anywhere`.
   Tomb interiors and night crossings must retain readable shadow detail while
   preserving the resin-brown floor.

Round-2/3 additions (learned when the first fixes did NOT land, 2026-08-19):

5. **Never write "<color> pupils" when you mean irises.** `amber pupils` /
   `lapis pupils` reads to the model as round colored pupils and silently
   overrides the slit instruction; three of the round-2 failures were this
   exact word bug. Write `<color> irises with narrow cat-slit vertical
   pupils, never round pupils`, and lead the species block with it.
6. **Anchor the tail at waist height, not by the legs.** `curling beside the
   leg or behind the calf` posed every tail below the card window (calves
   live below y633). The working phrase: `her long tail curls UP and around
   beside her waist with its full arc clearly visible at waist height at
   mid-frame, never hanging low near the ground`.
7. **Do not seed light effects you do not want.** `one low sun glint on the
   water` birthed a centered starburst twice; a `sun disc as practical key`
   became a crystalline orb. For visible suns write `one small flat
   pale-gold circle high in a hazy sky, matte and rayless like a coin`; for
   glints, move the practical key onto a physical object instead. Pair with
   the full negative set: `no lens flare, no starburst, no radial rays, no
   glowing orb, no light burst`.
8. **Count figures absolutely.** `two identical silhouettes` still allowed a
   third bystander; write `EXACTLY TWO figures in the entire image and not
   one person more`.

## 3. Batch order (interleaved with the card-data waves)

1. **Wave A — the 19 already-briefed pieces** the moment their ids lock:
   13 legends, 5 duals, the pack face. These are the marquee pulls and the
   shop surface; they also shake out the register in practice before the
   volume batches.
2. **Wave B — the Bastet tribe** (~38 cards): the aggressive spine, and the
   batch with the strictest QA (species tells, one tail, one tip).
3. **Wave C — the mechanic families** (Rite engine, Nine Lives, Preserve,
   Retell/Empower/twinBlades quota cards): composition-rule-heavy; batch by
   mechanic so the shared composition language stays coherent.
4. **Wave D — the commons fill + artifacts + glue**, largest and most
   parallel-friendly.
5. **Dark Tales companion wave (~60)** follows its own card data through the
   same two parsers (DARK's original art shipped via one-off in-session
   drivers; the companion wave uses the durable path).

## 4. Running the lanes (mechanics, measured on the sprinkle run 2026-08-18)

- **Environment**: the pipeline REQUIRES the repo-local venv —
  `PYTHON="<repo>/.venv-art/Scripts/python.exe"` on every generator
  invocation. The global miniconda env has a torch/torchvision conflict that
  breaks `dghs-imgutils`, and the venv deliberately runs CPU `onnxruntime`
  (the GPU flavor dies wanting cuDNN). Spell/environment crops use no onnx;
  character crops run face detect on CPU in ~1-2s.
- **Lanes**: at most 2 concurrent generation lanes (the imagegen CLI's OAuth
  refresh is not concurrency-safe at token expiry; 4 lanes killed a
  credential once). Natural split: creature lane + spell lane.
- **Throughput**: ~35s per image measured. ~250 images ≈ 2.5h dual-lane.
  Use `--limit N` for session-sized batches; runs are idempotent (existing
  WebPs skip) and a failed post-process NEVER wastes the paid call (raw
  originals are kept and reused).
- **Launch detached** (`nohup … ; echo $? > marker`) with a Monitor on the
  marker + the failure signatures (`consecutive-failure abort`, `credential`,
  `is required`); the Bash tool's 10-minute timeout kills attached runs.
- **After each batch**: the generators re-run `gen-art-manifest` themselves;
  run `gen-art-halfres` before any on-device pass; neither output is
  committed (both gitignored) — only `public/assets/art/cards/*.webp` lands
  in git.

## 5. QA ladder (per batch, in order)

1. `npm run check-art-bible` — entries match data, 13 fields, facts agree.
2. **Model review pass**: an Opus review agent per lane, each image judged
   against its entry's prompt + the §4a hard rules, hunting text-like marks
   (automatic FAIL), species-tell violations, anatomy, face placement
   (y 320-330, eye-line 300-360, top-third headroom), and card-scale
   readability at 119x86. Established on the sprinkle wave 2026-08-19.
3. **Regeneration**: FAILs re-run with `--force --only <ids>`; framing-only
   issues re-crop from the kept raws via `recrop-art.ts` at zero cost.
4. **Owner eyes** on each batch in the binder (dev server or `play:lan`);
   the register's taste calls (heart-red discipline, daylight rhythm) are
   ultimately human judgments.
5. Special zoom QA per §4a: every wall panel, cartouche, stela, papyrus,
   and seal must be a blank gold/lapis panel — no generated Egyptian-looking
   marks as decoration.

## 6. What this plan deliberately excludes

- **No generation against placeholder ids.** The drafts file's `sd-` names
  are not card ids; painting them would orphan files (`<card-id>.webp` is
  the binding contract).
- **No new card back or playmat here** — set-themed cosmetics ride the
  cosmetics catalog (SaveData v32) as their own item, priced for Courts.
- **No art-side rarity signaling** (owner ruling: the lapis-row badge is
  vetoed).
- **No Duat duel backdrop**: sets do not add scene backdrops; the playmat
  system now owns battlefield dressing.
