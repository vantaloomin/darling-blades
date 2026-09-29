<!-- source-of-truth: src/art/artLoader.ts, src/art/ArtResolver.ts, src/art/artWatch.ts, src/art/artArrivals.ts, src/art/artRetry.ts, src/ui/CardThumbCache.ts, src/ui/artGate.ts, src/art/pagedRequests.ts, src/ui/displayWalk.ts, src/scenes/ArtLoaderScene.ts, scripts/gen-art-manifest.ts, scripts/gen-art-halfres.ts, scripts/serve-lan.ts, .github/workflows/deploy.yml, src-tauri/tauri.conf.json · last-verified: 2026-09-28 · design doc, re-verify when the art loader, the thumbnail cache, the card-face geometry (R13) or the deploy pipeline changes -->

# Card art streaming: load on demand, unload under a budget (1.9 lane D)

**Status 2026-09-28: design, wave 1, for the owner's wave-1 sitting.** Built
in wave 2 ([plan-1.9.md](plan-1.9.md), Sequencing). Lane D is the lane to
defer if 1.9 runs long; section 8 says which part can slip to 2.0 without
making the itch.io build harder.

## Summary

A card's texture loads when something on screen asks for it and is unloaded
when it falls out of a per-tier byte budget. The session-long stream of the
whole manifest goes away. A Phaser-free **art store** replaces the queue in
`src/art/artLoader.ts`: callers take **leases** on the art keys they draw, a
lease pins its textures so nothing a live game object uses is ever destroyed,
requests run at four priorities with cancellation, and an LRU pass evicts
unpinned textures down to the budget. Every view that draws art already
redraws when its art lands (G10, and I9 for portraits in wave 1), so drawing
a stand-in and swapping it becomes the normal case, and each of those views
also holds a lease for what it draws. Bytes come from an **art source**:
loose files for the dev server and the desktop app, and on the web a few
content-hashed `.bin` packs per quality tier (one per set) read by HTTP range
requests, with the offset index bundled into the game's JavaScript. The
same packs serve Pages now and itch.io in 2.0, whose 1,000-file cap they
exist for. Decoding moves from Phaser's loader to `fetch` plus
`createImageBitmap`, which measured twice as fast.

## Where it starts (measured 2026-09-28)

`ArtLoaderScene` streams all 1,537 manifest keys behind the menu in batches of
48, with a front lane that `gateOnArt`/`awaitArt` use to pull a scene's own
cards forward. Nothing is ever unloaded. Collection, the Deck Builder and the
Showcase gate on the whole manifest (`gateOnArt(this, null, ...)`), so they wait
for the entire stream. `CardThumbCache` bakes are permanent and unbounded.

**How it was measured.** A production build of `release/1.9` at 15ffe70
(`npx vite build` into a scratch folder, with the half-resolution set from
the main checkout copied in), served by `vite preview` on 127.0.0.1 (sirv,
which answers range requests). The browser was headless Edge
(`--headless=new`, ANGLE on Direct3D 11, RTX 5090) driven over CDP, with a
fresh profile per run. So each run has a new save and a cold HTTP cache. The
probe waits for `MainMenu`, then calls `scene.start('Collection')` from it
at once. "Collection wait" runs from that call to the first poll where the
Collection has built and no loading line shows. Texture bytes are summed from
Phaser's texture manager (width x height x 4 per `artfile-*` texture, the
same rule as the 3.0 GB figure of 2026-09-21). Process memory is
`PrivateMemorySize64` of Edge's GPU process, read by `Get-Process`
against the process list CDP's `SystemInfo.getProcessInfo` returns, and dedicated
VRAM is the Windows `GPU Process Memory` counter for that process. Desktop
runs used a 1920x1080 window (the game rendered 2560x1440, k=2). Phone-tier
runs used `?quality=lite` with CDP mobile emulation (844x390, DPR 3, touch;
the game rendered 1280x720, k=1). Scripts: the session scratchpad,
`w1-stream/probe.mjs` and `probe2.mjs`.

| Run | Menu up | Collection wait | Card art textures | Edge GPU process (private) |
| --- | ---: | ---: | ---: | ---: |
| Desktop, local (2 runs) | 0.99 s, 1.13 s | **16.1 s, 16.6 s** | 1,537 = **3,002 MiB** | **4,176 MiB** |
| Desktop, 50 Mbps (CDP throttle, 20 ms latency) | 1.69 s | **43.9 s** | 3,002 MiB | 4,150 MiB |
| Phone tier, local | 1.11 s | **5.3 s** | 1,537 = **750 MiB** | 1,190 MiB |
| Phone tier, 20 Mbps and 4x CPU throttle | 5.0 s | **29.8 s** | 750 MiB | 1,178 MiB |

Dedicated VRAM stayed at 281 MiB (desktop) and 96 MiB (phone) because a fresh
save's binder draws almost nothing. ANGLE keeps a texture in the GPU
process's own memory until it is first drawn, which is why the GPU
process's private memory, not VRAM, holds the 3 GB. Thumbnail residency is
not in these numbers: a fresh save owns no cards, so the binder baked no
thumbs. Computed rather than measured: a thumb bakes at 150k x 218k px, so
0.50 MiB at k=2, and a player who pages the whole pool at 1440p adds up to
~767 MiB of permanent thumbs on top.

**The decode pipeline.** The same build, after the session stream had
finished, loaded 192 files per row, each row a different slice of the
manifest, six requests in flight:

| Tier | Phaser loader (today) | `fetch` loose file + `createImageBitmap` | Range read from a pack + `createImageBitmap` |
| --- | ---: | ---: | ---: |
| Full 640x800 | 90 files/s | 202 files/s | 176 files/s (216 at 12 in flight) |
| Half 320x400 | 281 files/s | 305 files/s | 392 files/s |

No long tasks were recorded in any mode. The pack was every full file
concatenated (216.2 MiB, one file, local server), so these rows measure
decode and range handling, not the network. Read the rows with care:
`probe2.mjs` ran after the whole-manifest stream had finished, so the loose
and Phaser rows asked for files the browser had already fetched once
(`vite preview` sends `no-cache`, so each was a revalidation, not a
download), while the pack rows were cold. Phaser's loader ran at its own
parallelism (the default of 32 downloads, 6 on Android), not six. All of it
is one RTX 5090 machine. The ratio is the finding, not the absolute rates.

**The duel's set.** `DuelScene.duelArtIds` takes both decks, both reserve
variants, the 28 token cards (27 art files: `tok-wolf-cub` draws
`tok-wolf`'s), the Darlings and the portraits. Its distinct art keys
number 115-137 across the 26 avatars against the 5 starters (median 125, 130
pairs, computed from the data with `scratchpad/w1-stream/duelset.ts`). That is
225-268 MiB at full resolution and 57-67 MiB at half.

**The art on disk.**

| Set | Keys | Full | Half |
| --- | ---: | ---: | ---: |
| drowned-deep (with 4 tokens) | 256 | 32.8 MiB | 7.8 MiB |
| sands-of-the-duat | 245 | 29.3 MiB | 7.2 MiB |
| base (with 23 tokens) | 241 | 38.0 MiB | 9.2 MiB |
| dark-tales | 180 | 23.4 MiB | 5.3 MiB |
| starborne | 151 | 20.6 MiB | 4.8 MiB |
| yokai-nights | 120 | 14.8 MiB | 3.5 MiB |
| celtic-fae | 84 | 15.1 MiB | 3.6 MiB |
| arthurian-court | 83 | 13.9 MiB | 3.3 MiB |
| gothic-monsters | 83 | 12.1 MiB | 2.8 MiB |
| ragnarok | 71 | 12.1 MiB | 2.8 MiB |
| styled lands and 3 non-card keys | 23 | 4.1 MiB | 1.0 MiB |
| **Total** | **1,537** | **216.2 MiB** | **51.2 MiB** |

First Dawn adds about 165 keys, roughly 21 MiB full and 5 MiB half at the
current median file size (144 KB full, 34 KB half). Today that would be
another ~330 MiB resident at full resolution; under this design it adds
nothing to residency. The main app's `dist/` held 3,114 files (1,537 + 1,537
card files); the real deploy adds the Forge and the legal pages.

## Goals and non-goals

Goals: bounded residency on both tiers; Collection and the Deck Builder open
at once; no surface that shows art waits on cards it does not show; no
stand-in left on screen once its art has arrived; a web build whose card art
fits itch.io's limits; the desktop app keeps working offline with #432's
retry.

Non-goals: compressed GPU texture formats (KTX2/Basis); a persistent
client-side art cache (owner question 5); changing art resolution or the
zoom preview (desktop keeps full resolution, as ruled in 1.8); the Forge's
own loader (section 5).

## 1. The model: the art store

### Keys and tiers

An **art key** is a manifest key (`artKeyFor(cardId)`, styled lands as
`<land>--<style>`). A **tier** is `full` (640x800) or `half` (320x400). The
**primary** tier is `full` on the desktop quality tier and `half` on `lite`,
and keeps today's texture key `artfile-<key>`, so the Forge, the card-proof
harness and every existing check still read it. The desktop tier may also
hold the **half** texture as `arthalf-<key>`. It is used for thumbnail bakes
(owner question 1) and, while a full texture is on its way, as the better
stand-in (below).

### The API (`src/art/artStore.ts`, Phaser-free)

```ts
type ArtPriority = 'now' | 'visible' | 'soon' | 'idle';
type ArtTier = 'primary' | 'half';

interface ArtLease {
  /** Resolves when every key is resident or has failed. Never rejects, never hangs. */
  readonly ready: Promise<void>;
  add(ids: Iterable<string>): void;   // widen the lease (a new binder spread)
  release(): void;                    // unpin; queued requests nobody else holds are dropped
}

artStore.lease(label, ids, { priority, tier }): ArtLease   // pins
artStore.prefetch(ids, { priority, tier }): () => void     // no pin; returns a cancel
artStore.isResident(id, tier): boolean
artStore.stats(): { residentBytes, pinnedBytes, budget, queued, inFlight, evictions, failures }
```

Ids are card ids or art keys; keys not in the manifest (procedural
placeholders) are resident by definition. Three Phaser-side helpers bind
leases to lifetimes:

- `sceneArtLease(scene, ids, priority)` releases on the scene's `SHUTDOWN`.
  **Only `gateOnArt` uses it**, for the set a scene's build draws; its
  callers do not change.
- `awaitArt(owner, ids, handlers)` takes an **owner**, the modal's
  container or view, and releases on that owner's `DESTROY`, not at scene
  shutdown. A scene-lifetime lease there would pin every Shop deck preview,
  atelier modal, `ZoneContentsModal` and Deck Builder picker opened in a
  long session until the scene ends, and since pins may exceed the budget,
  a long Shop visit would pin without bound. The call sites pass the
  container they already build (`ShopScene`, `ProfileScene`).
- `holdArt(owner, key, reapply)`, next to `redrawWhenArtLands` in
  `artWatch.ts`, releases on the game object's `DESTROY` or when the owner
  draws something else. It is what CardView, BoardCardView and the portrait
  helper call. `reapply` is the owner's own draw (`applyArt`, or the
  portrait's resolve-and-fit): see the removal belt in section 3.
- The thumbnail cache's own lease (section 3).
- `saveCard.ts` takes a plain lease and releases it in a `finally`.

The old names (`ensureArt`, `requestArt`, `artMissing`, `isArtLoaded`) stay
as thin wrappers while the scenes migrate, then go.

### Priorities, scheduling and cancellation

| Priority | Used for | Order within the level |
| --- | --- | --- |
| `now` | a gated build (duel, the current pack's reveal, the draft's pick pack, a modal's wait), the zoom preview, the save-card export | first in, first out |
| `visible` | anything drawn with a stand-in right now: every `holdArt` on a missing key asks at this level | newest first, so fast paging serves the page on screen |
| `soon` | the next and previous binder spread, the selected opponent's duel set on the Gauntlet, Practice and Play screens, later packs in a batch | newest first |
| `idle` | the boot warm set (below); on desktop, the full textures of the spread on screen, so a hover zooms at once | first in, first out |

- **A window, not batches.** Six fetches in flight on the web and eight on
  the desktop app's local protocol (6 to 12 gained only 176 to 216 files/s at
  full). A new `now` request waits for one free slot, not for a 48-file
  batch.
- **Uploads are capped per frame.** Decoded bitmaps become textures from the
  scene's update, at most 4 full or 8 half per frame (to be tuned by the
  long-task check in the gates).
- **Cancellation.** A queued request that no lease or prefetch still holds
  is dropped. An in-flight fetch whose key is no longer wanted is aborted
  (`AbortController`) if its body has not arrived. A body that has arrived
  is decoded anyway and lands unpinned, so it can be evicted.
- **The boot warm set** (`idle`, after the menu is up): the tutorial decks
  until the tutorial is done, then the active deck and the next Tower
  opponent's set. It is capped at a quarter of the art budget. It replaces
  the whole-manifest stream, and it is why "Play" still opens in about the
  time it does today.

### The pipeline

source bytes (section 5) -> `Blob` -> `createImageBitmap` (decoded off the
main thread) -> `textures.addImage(key, bitmap)`. Phaser 3.90's
`TextureSource` takes an `ImageBitmap` through its generic
`createTextureFromSource` path (width from `source.width`). Card art has no
alpha, so WebGL ignoring the unpack flags for bitmaps changes nothing; the
prototype PR proves it on screen. The Phaser `LoaderPlugin` is no longer used
for card art. That is where the 2x on full files comes from.

Before adding, the store checks `textures.exists(key)`: an arrival that
raced a second request for the same key is dropped (its bitmap closed).
Phaser refuses a duplicate key with a warning and a null texture, so
without the check the store's books and the texture manager would disagree.

**The decoded copy, and context loss (decided).** Phaser keeps a texture's
source for WebGL context-loss restore: `TextureSource` holds the image, the
`WebGLTextureWrapper` keeps it as `pixels`, and the renderer re-uploads every
wrapper from its `pixels` on restore. An `ImageBitmap`, unlike an
`<img>`'s decode, cannot be discarded by the browser, so keeping it would
make every resident key cost twice: the GL texture plus a live decoded copy.
The policy:

- **Under WebGL, close the bitmap right after upload** and set the
  wrapper's `pixels` to `null`. Residency is then the GL texture alone. A
  wrapper with `null` pixels restores as a blank texture of the right size;
  a closed bitmap left in `pixels` would throw inside the renderer's restore
  pass and abort every restore after it, which is why `pixels` is nulled,
  not left.
- **On `Phaser.Renderer.Events.RESTORE_WEBGL`,** the store evicts every art
  texture and every thumb bake (a `DynamicTexture` is blank after a restore
  anyway), then re-requests the pinned set at `now`. The removal belt
  (section 3) puts every view back on the stand-in and redraws it on
  arrival. A GPU reset costs one reload of the pinned set; it is never fatal.
- **Under the canvas renderer** (`Phaser.AUTO` can fall back to it) the
  bitmap is the drawing source, so it stays open, and there is no GL copy to
  double it.
- **Nothing reads card-art pixels back from a texture.** `saveCard.ts`
  today draws `frame.source.image`, which would be a closed bitmap. It asks
  the store for the file's bytes instead (`artStore.fetchBlob(key)`, the
  same source and cache path) and decodes its own copy for the 640x800
  composite. The two other `getSourceImage()` readers (`ShopScene`'s pack
  base, `CardFrameFactory`'s card back) read scene art, which this lane
  does not touch.

**The retry from #432 carries over.** A fetch that fails at the network
level is re-sent at once up to twice (Phaser's `maxRetries` did the same).
One that still fails goes to a deferred second pass, run when the in-flight
window next drains or after one second, whichever is later. That delay is
the property that fixed the desktop app's `ERR_CONNECTION_REFUSED` bursts.
A key that fails the second pass settles as failed: `ready` resolves and the
stand-in stays. A later lease on it tries again after 30 seconds. Today a
failed file is never asked for again.

## 2. Who asks for what

| Surface | Draws | Asks for | Priority | Pinned by | Tier (desktop / phone) |
| --- | --- | --- | --- | --- | --- |
| Collection binder | 12 thumbs per spread, variant rows | the spread on show; the next and previous spread | `visible`; `soon` | the thumb Images (thumb textures); sources are not pinned once baked | half / half |
| Zoom preview (`CardZoomPreview`, any scene) | a live CardView at 1.3, up to 733x1045 px at 1440p | the hovered card | `now` | the preview's view | full, with half drawn meanwhile / half |
| Deck Builder | the 12-card pool page, the deck pane's thumbs (the Darling portrait, the basics previews, the style sample), the Darling and land-style pickers; the deck-list rows are text and draw no art | the page, the pane's thumbs, the open picker page; the open deck-list page's cards | `visible`; the pages either side `soon`; the deck-list cards prefetched at `soon`, not leased, since the rows draw no art (the row's hover zoom then opens on the half texture) | thumbs | half / half |
| Pack opening | the rolled cards as live CardViews | the first pack, gated, before the flip; later packs in a batch leased at `soon`, each gated at its own reveal | `now` | the scene | full / half |
| Duel | both decks, reserves, tokens, Darlings, portraits (115-137 keys) | the set, gated at `create` as today; prefetched at `soon` as soon as an opponent is chosen on Gauntlet, Practice or Play | `now` | the scene, through restarts between rungs (see Traps) | full / half |
| Limited draft | the pick pack (up to 15 thumbs), the picks | the pack, gated; the picks | `now`; `visible` | scene and thumbs | half thumbs / half |
| Limited Deck Builder | the pool and deck; a 1.35 CardView inspect | the pool, gated as today, then per page | `now` | scene | full for the inspect / half |
| Shop | 19 grid faces, featured thumbs, the deck preview and atelier modals | the faces, gated; each modal's cards through `awaitArt` | `now` | scene; each modal's lease, released when the modal is destroyed | full / half |
| Profile | the owned-card picker (thumbs) | the picker page | `visible` | thumbs | half / half |
| Achievements hall | furnishings as CardViews | the hall set, gated as today | `now` | scene | full / half |
| Gauntlet, Practice picker, Play | 26 avatar portraits; the Play deck faces (thumbs) | portraits gated as today | `now` | scene | full / half |
| Duel HUD portraits, Versus bumper | a portrait each | with the duel set | `now` | the duel lease | full / half |
| Save-card export (`saveCard.ts`) | a 640x800 composite | the file's bytes from the store, decoded into its own bitmap; lease released in `finally` | `now` | the export | full / half |
| Showcase (dev only) | every card, paged | the page | `visible` | thumbs | full / half |

Collection, the Deck Builder and the Showcase stop gating on the whole
manifest: they build on their first frame (as built in S5a, `gateOnPagedArt`
and `PagedArt` in `src/ui/artGate.ts` over `src/art/pagedRequests.ts`). A
page's lease covers the whole page while any of it is missing, and is
released once its art is in and the page has drawn. How a spread shows its
first frame is owner question 3, ruled as recommended: a turn starts at once
and the new spread waits up to `PAGE_ART_HOLD_MS` (150 ms) for its art, then
draws over stand-ins, which fill in. The Deck Builder's pool takes the same
hold on page turns and redraws at once on deck edits; the pickers and the
deck pane draw at once.

## 3. Unload: the budget, eviction and pinning

### Budgets (starting values, `src/art/artBudget.ts`)

| Tier | Card art sources | Thumb bakes | Process memory at budget | Compared with today |
| --- | --- | --- | --- | --- |
| Desktop (`full`) | **640 MiB** (~330 full textures, or the largest duel set plus ~190 more) | **192 MiB** (~380 thumbs at k=2, ~680 at k=1.5) | **~832 MiB** of textures, plus at most ~16 MiB of bitmaps between decode and upload | 3,002 MiB of sources (4,176 MiB GPU-process private measured), and thumbs unbounded |
| Phone (`lite`) | **160 MiB** (~330 half textures) | **48 MiB** (~380 thumbs at k=1) | **~208 MiB** of textures, plus at most ~4 MiB in transit | 750 MiB of sources (1,190 MiB measured), and thumbs unbounded |

Bytes are counted as width x height x 4, the same rule as the "before"
numbers. The process-memory column assumes the closed-bitmap policy in
section 1. Had the bitmaps been kept for context-loss restore, each source
would count twice: ~1,472 MiB on desktop and ~368 MiB on phones at budget.
Whole-pack fallback mode (section 5) can hold up to two more packs (at most
~71 MiB full, ~17 MiB half, the two largest packs) while it is active. Where the texture bytes sit
(ANGLE's GPU-process memory before a first draw, dedicated VRAM after) is
what gate 1 measures. A pinned set larger than the budget is allowed. Pins always win,
and the store logs a warning in dev builds when pins alone exceed the budget.
These are constants, tuned once from the gate tour (owner question 2), and a
`?artBudget=<MiB>` URL override exists for the stress run.

### Eviction

- **When.** After an arrival and after a release, at most once per frame,
  from the loader scene's update, never inside another scene's create or
  render.
- **What.** Unpinned textures, least recently used first (a lease, a
  prefetch or a draw counts as use), down to 85% of the budget.
- **Release grace.** A texture released less than 2 seconds ago is not
  evicted unless residency is over 125% of the budget. It covers moving
  between scenes that share art (Gauntlet to Duel, Deck Builder to Duel and
  back, Collection to Shop and back). `DuelScene`'s restart between rungs
  does not rely on it: eviction runs only from the loader scene's update, so
  the old scene's shutdown and the new scene's create, which happen in the
  same scene-manager step, both finish before an eviction pass can see the
  released keys.
- **The safety scan.** Before removing anything, one pass looks for any
  object still drawing a candidate key. It covers every scene whose
  `sys.isVisible()` is true, walks into Containers and Layers, and includes
  the source objects of `mask.bitmapMask`. A hit means a lease was missed:
  that key is pinned for the rest of the scene's life, and dev builds log an
  error, which the stress gate counts. The display lists hold a few thousand
  objects at most and the pass runs rarely, so the cost is small; the build
  measures it.
- **Removal.** `textures.remove(key)`. The bitmap was already closed at
  upload (section 1), so nothing else is held.

**Why a missed lease matters: it is a hard crash, not a green square.**
`Frame.destroy` sets the frame's `source` to `null`, and the next batch reads
`frame.source.glTexture` while rendering (`Frame.js`, `MultiPipeline.js`).
A `TypeError` in the render step stops the game loop. So there are three
layers, and the stress gate proves all of them:

1. **Leases.** Every object that shows card art holds one, through
   `holdArt`, a gated build's scene lease, a modal's `awaitArt` lease, a
   thumb lease or the duel's lease.
2. **The safety scan** above, before every removal.
3. **The removal belt.** The store listens to the texture manager's
   `Textures.Events.REMOVE`. For an art key, every live `holdArt` owner on
   that key re-runs its `reapply` at once, in the same tick: `applyArt`
   for CardView and BoardCardView, resolve-and-fit for a portrait. Each gets
   the stand-in (or the half texture) and a fresh wait, and redraws when the
   art comes back. This also covers removals the store did not make: the
   context-restore sweep in section 1, and any future code that removes a
   texture. I9's helper leaves exactly this to this lane (section 4).

`ArtResolver.getArt` already answers "absent" with a stand-in and a `pending`
key, so a key loaded again after eviction redraws through the existing
arrival path.

### `CardThumbCache`

- **Thumbs are snapshots and stay valid.** A baked thumb holds the finished
  face, so evicting its source does not invalidate it. This keeps the bakes
  deliberately, as the plan asked. The only invalidation stays the one that
  exists: a provisional bake (drawn over the stand-in) re-bakes in place
  when its art arrives.
- **Thumbs get their own LRU budget.** `makeCardThumb` takes a thumb lease
  for its Image, released on `DESTROY`, and an unpinned thumb is evicted
  like a source (its `DynamicTexture` removed, its provisional record
  dropped). `ensureCardThumb` bakes it again when it is next needed.
- **Bakes read the cheapest adequate source** (owner question 1): the
  primary texture if it is resident, else the half texture, else a request
  for the half texture and a provisional bake. At k=2 a thumb bakes at card
  scale 1.0. As rechecked by S4 after R13's geometry: the standard art
  window is 264x216 px, a cover scale of max(264/320, 216/400) = 0.825 from
  the 320x400 file, a downscale; the full-art window is 282x402 px, a scale
  of max(282/320, 402/400) = 1.005, a 0.5% upscale. So the half file has
  enough pixels for every bake at every render size the game offers (k is at
  most 2).

## 4. Redraw on arrival as the normal case

Every place that draws card art, and what it needs:

| Site | Redraw on arrival | Lease | Change in this lane |
| --- | --- | --- | --- |
| `CardView.applyArt` | yes (G10) | add `holdArt` | holds its key; on desktop draws the resident half texture instead of the flat stand-in while the full one loads |
| `BoardCardView.applyArt` | yes (G10) | add `holdArt` | as CardView |
| `CardThumbCache` bakes | yes, re-bake in place (G10) | thumb lease on each Image | LRU budget, half-tier bakes |
| Portraits: the Gauntlet ladder cells in `DuelScene.ts`, `GauntletScene.ts`, `LimitedDraftScene.ts`, `PracticePickerScene.ts`, `ShopScene.ts`, `CommanderPortrait.ts`, `VersusBumper.ts` | **yes: I9, PR #473 (branch `fix/19-portraits`)** | `holdArt` inside `addPortraitArt` | I9 built the shared helper, `src/ui/portraitArt.ts` `addPortraitArt`, used at 7 sites. As built in S4 it takes the card id, and `src/ui/artRefit.ts` `fitAndHoldArt` holds the image's art through `holdArt` with a resolve callback, so the removal belt calls `getArt` again and re-fits |
| `saveCard.ts` | not a redraw: it composes once | a lease, released in `finally` | reads the file's bytes from the store and decodes its own copy (section 1), instead of reading `frame.source.image`, which is a closed bitmap under this design (and today may be the stand-in) |
| The Forge (`src/forge/scene.ts`) | its own `filecomplete` redraw | none (own page, own loader) | none in 1.9 (section 5) |
| Card-proof harness (dev) | loads everything up front | none | none |
| `ArtAtlas` placeholders | generated at boot, permanent | none | none (0-3 cards today; never evicted) |

**The progressive stand-in (desktop).** `ArtResolver.getArt` answers with the
best resident texture: full, then half, then the flat `art-loading`. It
sets `pending` whenever that is not the full texture, so a zoom preview
opened over a thumb shows the half texture at once and sharpens when the
full one lands, instead of flashing flat.

## 5. Packaging: packs on the web, loose files on the desktop

### Why two sources

- **The web (Pages now, itch.io in 2.0).** itch.io caps an HTML5 game at
  1,000 files, 500 MB in total and 200 MB a file. The card art is 3,074
  files, and a single full-tier pack would be 216 MiB (227 MB), over the
  per-file cap. So the art ships as one pack per set per tier.
- **The desktop app.** Tauri 2.11 serves the embedded `dist/` through its
  own protocol handler, which ignores `Range` and returns the whole asset
  (`tauri-2.11.5/src/protocol/tauri.rs`, read 2026-09-28). With the default
  `compression` feature it also brotli-decompresses the asset on every
  request (`tauri-utils` `EmbeddedAssets::get`). So a per-card range read
  of a 35 MiB pack would decompress and send the whole pack for every card.
  The desktop build keeps loose per-card files and has no file cap (the 2.0
  itch desktop build is a butler-pushed folder). It reads them through the
  same `fetch` and `createImageBitmap` pipeline, with #432's retry.
- **The dev server** reads loose files, so art drops show up at once.

The source is chosen at build time: a `__ART_SOURCE__` define is `'packs'`
for a web production build and `'loose'` for `vite` dev and for Tauri
builds (`TAURI_ENV_PLATFORM` set, the signal `scripts/build-forge.ts`
already reads).

### Layout and naming

- **One pack per set per tier.** Ten sets today plus a `misc` pack (styled
  lands, non-card keys), so 11 files per tier and 22 in all (24 with First
  Dawn). Tokens ride in their set's pack. The largest pack is base
  full at 38 MiB. Per set, not by rarity or size, because a set is the unit
  that changes: an art regeneration invalidates one pack's cache, and a new
  set adds a pack without touching the others.
- **Name:** `assets/art/packs/<tier>-<set>.<sha256 first 10 hex>.bin`, for
  example `full-drowned-deep.3f9a1c2e7b.bin`. `.bin` is not on itch's
  pre-gzip list (`.html .js .css .svg .wasm .wav .glb .pck`), and
  Cloudflare does not compress `application/octet-stream` by default. The
  hash keeps a range read from mixing two builds and makes itch's uneven CDN
  caching safe.
- **Inside a pack**, the webp files are concatenated in art-key order with
  no header and no padding.

### The index

`src/data/art-packs.json`, generated and gitignored like `art-manifest.json`,
and imported into the bundle, so the JavaScript and the pack names always
come from the same build and nothing extra is fetched:

```json
{
  "version": 1,
  "tiers": {
    "full": { "packs": ["full-base.1a2b3c4d5e.bin", "..."], "at": [[0, 0, 185036], "..."] },
    "half": { "packs": ["..."], "at": ["..."] }
  }
}
```

`at[i]` is `[packIndex, offset, length]` for `manifest.cards[i]`, or `null`
when that tier has no file for the key (the half tier can trail the full
set in a local build; the store then loads the full file for that key, as
`artFileUrl` does today). That is about 30 KB of JSON per tier, roughly
25 KB gzipped for both. A tier that was not built at all (a local build
without `cards-half/`) is absent, and the phone tier falls back to full
files.

### The build step

- **`scripts/pack-art.ts`** runs after `gen-art-halfres` and
  `gen-art-manifest`. It reads `public/assets/art/cards*/`, groups keys by
  `CARD_DB[key].set` (tokens with their set, styled lands and non-card keys
  in `misc`), and writes the packs to a gitignored staging folder plus the
  index. It is deterministic: the same inputs give the same bytes and
  hashes. It checks that every manifest key is in exactly one pack per built
  tier, that each entry starts `RIFF....WEBP`, and that each pack is under
  190 MB.
- **A `vite.config.ts` plugin** (`apply: 'build'`) copies the packs into
  `dist/assets/art/packs/` for web targets and sets the define. For the
  itch target (2.0) it also deletes `dist/assets/art/cards*/` and fails the
  build if `dist/` holds 1,000 files or more, so the cap is a build gate
  from the day the target exists.
- **Pages keeps the loose files beside the packs in 1.9** (owner question
  4): the Forge's art picker (`<img loading="lazy">` on the half files) and
  its loader read them, a tab still running the previous build reads them,
  and they are the pack fallback below. The game on Pages reads packs, so
  Pages exercises the itch path for a whole release before 2.0. The cost:
  every push to `main` uploads about 550 MB instead of about 280 MB, so the
  Pages artifact upload and deploy take roughly twice as long.
- **The Forge and itch.** The Forge's art picker (`src/forge/main.ts`, the
  lazy `<img>` on the loose half files) and its card loader break wherever
  the loose files are gone. So the itch target drops `dist/forge/` (the
  Forge is a bladedarlings.com page, unlinked, and has no place in the itch
  build), or the Forge moves to packs first. Either is a 2.0 step; the itch
  target's plugin enforces the first.
- **CI** (`deploy.yml`): half-res, then the manifest (`--require-half`), then
  `pack-art`, then the ladder as today.
- **`scripts/serve-lan.ts`** gains `Range` support (a few lines). Without
  it the phone LAN path would fall back to whole-pack reads (below).

### Reading a pack, and what happens when a read fails

A card is read with one `Range: bytes=<offset>-<offset+length-1>` request. The
first read of each pack in a session goes alone, and the others for that pack
wait for its answer. That costs one round trip per pack per session, and it
stops six parallel requests from each downloading a whole pack from a host
that ignores ranges.

| Response | What it means | What the store does |
| --- | --- | --- |
| 206, `Content-Range` starts at the offset, body length matches, starts `RIFF....WEBP` | good | decode |
| 200 with the whole pack | the host ignores `Range` (`serve-lan.ts` before its fix, a proxy) | whole-pack mode for that pack: keep the bytes (at most two packs held, least recently used dropped) and slice from them; no more range reads to it this session; one console warning |
| any `Content-Encoding` on the response (including a 206 whose body then fails to read) | the host compressed the pack (the itch trap), so ranges address compressed bytes; a compressed partial body cannot be decoded | treat as 200: whole-pack mode (`fetch` decompresses a full body transparently); one warning. Not retried as a transient failure |
| 416, wrong length or wrong magic | index and pack disagree (should be impossible with hashed names) | fail the key for the session; one error |
| 404 on the pack | a tab older than the deploy | try the loose URL (present on Pages in 1.9); otherwise fail the pack's keys |
| network error before any response or mid-body (a 206 with no `Content-Encoding` whose body fails to read), 408, 429, 5xx, an idle timeout | transient | the retry in section 1; the pack's mode is unchanged. Reads waiting on a pack's first read fail with it, and the store re-sends them |

Observed 2026-09-28: `bladedarlings.com` (Cloudflare in front of Pages)
answers a range request on a card `.webp` with `206` and
`Cache-Control: max-age=14400`, on a cache miss (`cf-cache-status: EXPIRED`).
The same on a `.bin` pack is part of the first Pages deploy's gate (gate 7),
since packs cannot reach Pages before the 1.9 cut.

## 6. Measurements and gates

All of it runs on a probe (`scripts/probe-art.mjs`, built with S3) that does
what the "before" probe did: a production build, `vite preview`, headless
Edge over CDP, and a fresh profile per run. It reads a small read-only
`window.__art` hook (`stats()`, `standIns()`, `missingTextures()`) that S3
adds beside `window.__game`.

1. **GPU residency, before and after, both tiers.** A scripted tour: menu,
   Collection (five spreads, a filter change, a zoom), the Deck Builder
   (three pool pages, the deck list, the Darling picker), the Shop and its
   deck preview, a batch pack opening, a draft pick, the Gauntlet, a Tower
   duel with a zoom, then back to Collection. At each stop it records, from
   outside the store: the Edge GPU process's private memory, its dedicated
   VRAM and its shared GPU memory (the Windows `GPU Process Memory`
   counters), and the renderer process's private memory. The GPU process's
   private memory alone is not enough: under ANGLE on D3D11 it holds a
   texture only until the texture is first drawn, and drawn art moves into
   dedicated VRAM. The first stop, the menu before any card art, is the
   base `B`. **Pass:** at every stop, GPU-process private + dedicated +
   shared stays under `B` + **1,000 MiB** on the desktop tier and `B` +
   **260 MiB** on the phone tier (the section 3 process-memory figures at
   budget, about 20% headroom, no pinned overflow on this tour), and the
   renderer process stays within 100 MiB of its value at `B`. The store's
   own byte counts are logged beside them for diagnosis but pass nothing.
   Against today, at the Collection stop: 4,176 MiB private + 281 MiB
   dedicated on the desktop tier, 1,190 MiB + 96 MiB on the phone tier.
2. **Time to Collection, before and after, both tiers.** Measured as today,
   plus the time until all 12 pockets of the first spread show real art.
   Runs: local, desktop at 50 Mbps, phone tier at 20 Mbps with a 4x CPU
   throttle. Before: 16.1-16.6 s, 43.9 s, 5.3 s and 29.8 s.
   **Pass:** the binder draws on its first frame; the first spread is real
   within 0.5 s locally and within 2 s throttled (12 half files are about
   0.4 MB).
3. **No stand-in left after arrival, every scene, two sizes.** At each stop
   of the tour, after the store has been idle (nothing queued or in flight)
   for 500 ms: `standIns()` (objects showing `art-loading`, or a CardView or
   BoardCardView still `awaitingArt` a key that is resident, or a
   provisional thumb whose key is resident) must be 0. `missingTextures()`
   (objects on Phaser's `__MISSING`) must also be 0, and the console must
   have no errors. The two sizes are desktop 1920x1080 at k=2 on the full
   tier and 844x390 at k=1 on the lite tier. Every production scene is
   covered, with the Showcase in a dev build.
4. **The eviction stress run.** The same tour with `?artBudget=8`, which
   evicts on every scene change. **Pass:** gate 3 holds, and the safety scan
   reports no missed lease. This is the proof that nothing a live object
   uses is destroyed.
5. **Main-thread cost.** Long tasks over 50 ms during the tour, before and
   after. **Pass:** no worse than before, which was none recorded.
6. **A desktop app run.** `npm run app:build`, then `app.exe` launched with
   `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>`,
   and the same probe over CDP (loose source on Tauri's protocol). It
   includes opening the privacy policy window during a duel's gated load:
   the #432 failure mode, which must still recover with no stand-in left.
   Unverified until the build: that WebView2 honours that variable for this
   app.
7. **The first Pages deploy with packs** (the 1.9 cut): for every pack,
   `curl -s -D - -o /dev/null -H "Accept-Encoding: gzip, br" -r 0-99 <pack URL>`
   returns `206` with no `content-encoding` header, and the live site passes
   gate 3 on a phone and a desktop.
8. **A context-loss run.** During a duel, the probe forces a loss and a
   restore through `WEBGL_lose_context` (`loseContext()`, then
   `restoreContext()`). **Pass:** the game keeps running, gate 3 holds once
   the store is idle again, and the console has no errors.

Unit tests (Phaser-free, `tests/art/`): the store's ordering by priority and
recency; cancellation dropping queued work; leases pinning against eviction;
LRU down to the low-water mark; the release grace; pins over budget; failure
backoff; `ready` never hanging; an arrival for a key that is already
resident is dropped; a removal notice re-runs every live holder of that key.
The source: the response ladder above against a fake `fetch` (206, 200,
`Content-Encoding`, a 206 whose body fails to read, short body, bad magic,
a `null` half entry, 404 then loose, network error then retry). The pack builder: on a three-file fixture,
every entry read back from its pack equals its source file, and two runs give
identical bytes. Each test names the behaviour it guards; none pins pack
hashes, counts of the real art set or file order.

## 7. The work split

Wave 2, per the plan. File sets do not overlap within the lane, and the
shared-file order in [plan-1.9.md](plan-1.9.md) (Sequencing) holds.

| PR | Files | After | Notes |
| --- | --- | --- | --- |
| **S1 The store** | NEW `src/art/artStore.ts`, `src/art/artBudget.ts`, `tests/art/artStore.test.ts`; EDIT `src/art/artLoader.ts`, `tests/art/artLoader.test.ts` | the owner's sitting | Phaser-free; the old API becomes wrappers; no behaviour change on its own |
| **S2 Sources and packs** | NEW `src/art/artSource.ts`, `scripts/pack-art.ts`, `tests/art/artSource.test.ts`, `tests/scripts/packArt.test.ts` (+ a 3-file fixture); EDIT `vite.config.ts`, `package.json` (the `build` script), `.gitignore`, `.github/workflows/deploy.yml`, `scripts/serve-lan.ts`, `docs/desktop-build.md`, `docs/architecture.md` | the sitting; runs beside S1 | the source interface is agreed first, in S1's PR description |
| **S3 The Phaser shell** | EDIT `src/scenes/ArtLoaderScene.ts` (decode, upload cap, eviction and the safety scan, `window.__art`), `src/art/ArtResolver.ts` (tier and the best-resident answer), `src/art/artWatch.ts` (`holdArt`), `src/ui/artGate.ts` (scene leases), `src/scenes/PreloadScene.ts`; NEW `scripts/probe-art.mjs` | S1, S2 | **ships behind a flag, default off (today's whole-manifest stream)**, flipped to "stream on" only when S5a's Collection, Deck Builder and Showcase split has landed. Without that split, S3 turns their `gateOnArt(this, null)` into a `now` lease on the whole manifest: 3 GB pinned, worse than today |
| **S4 Views hold what they draw** | EDIT `src/ui/CardView.ts`, `src/ui/BoardCardView.ts`, `src/ui/CardThumbCache.ts`, `src/ui/portraitArt.ts` (I9's `addPortraitArt`: the lease and the removal belt go inside it), `src/ui/saveCard.ts` | S3; **R13 in `CardView.ts`**; I9 (PR #473) | shared file order: R13, then this, then accessibility's card surfaces |
| **S5a Grids and menus** | EDIT `CollectionScene.ts`, `DeckBuilderScene.ts`, `CardShowcaseScene.ts`, `PackOpeningScene.ts`, `LimitedDraftScene.ts`, `LimitedDeckBuilderScene.ts`, `ShopScene.ts`, `ProfileScene.ts`, `AchievementsScene.ts`, `PlayScene.ts`, `GauntletScene.ts`, `PracticePickerScene.ts`, `src/ui/ZoneContentsModal.ts` | S4; I9 and I5 (`LimitedDraftScene.ts`), I9 (`ShopScene.ts`, `GauntletScene.ts`, `PracticePickerScene.ts`); I3 and I4 (`DeckBuilderScene.ts`) | before accessibility's core-scene pass (plan wave 3); can split into Collection, Deck Builder and Showcase, then the rest |
| **S5b The duel** | EDIT `src/scenes/DuelScene.ts` (the duel lease across rung restarts, the portrait leases) | S4; **I6 and I9** (wave 1) | shared file order: I6/I9, then this, then A2's two-target flow, then accessibility's Duel pass |
| **S6 Gates** | the probe runs (section 6), numbers into this doc; the desktop app run | S5a, S5b | measurement only |

Where the lane meets the rest of 1.9:

- **`src/ui/CardView.ts`:** R13's geometry first, then S4, then
  accessibility. S4's CardView change is small (a `holdArt` call and the
  best-resident answer), so it rebases easily if R13 slips.
- **`src/scenes/DuelScene.ts`:** I6 and I9 in wave 1, then S5b in wave 2,
  then A2 and accessibility in wave 3.
- **I9 is done, and it is this lane's foundation.** PR #473 (branch
  `fix/19-portraits`) gives the portrait sites one helper,
  `addPortraitArt` in `src/ui/portraitArt.ts`, used at 7 sites. S4 put the
  lease and the removal belt in that one place: it takes the card id, and
  `fitAndHoldArt` in `src/ui/artRefit.ts` holds the art through `holdArt`.
- **The scenes in S5a** are also touched by lane I (I3, I4, I5, I9) in
  wave 1 and by accessibility from wave 3, so S5a sits between them.
- **`deploy.yml` and `vite.config.ts`** belong to nobody else in 1.9 as far
  as the plan says; lane H's cut checklist should add gate 7.
- **First Dawn's art run** (wave 3) only adds files. The packs and the
  manifest pick them up, and gate 1 is re-read at the cut.

## 8. What can be deferred to 2.0

**The line:** the packaging is the 2.0 requirement, and eviction is the 1.9
benefit. The store is built so the source is a seam.

- **Where wave 2 would actually run long.** Not S2: packs are Phaser-free
  and about two days of work. The long parts are S5a (13 scene files that
  lane I touches before it and accessibility after it) and S6's gates.
- **If 1.9 runs long, defer S2 and S5a's long tail.** The long tail is the
  Profile picker, the Achievements hall, the Shop modals and the two
  Limited scenes. They stay correct through the old wrappers
  (`gateOnArt`, `awaitArt`, `ensureArt` on their own sets), just without
  paging-level leases. Ship S1, S3, S4, S5a's core (Collection, the Deck
  Builder and the Showcase, the three whole-manifest gates S3's flag waits
  on, plus pack opening), S5b and S6 over the
  loose source on every target. Players still get the residency cut and an
  instant Collection, and 2.0 adds a second source behind an interface that
  already exists, plus the build step. Nothing in 1.9 would need rewriting
  for itch.
- **What deferring S2 costs.** Packs on Pages through 1.9 are a release of
  live soak for the itch path (ranges through Cloudflare, the fallback
  ladder, real players' browsers). Deferring S2 forfeits that, so 2.0 then
  needs its own soak period on Pages before the itch launch.
- **If the whole lane slips,** five rules keep 2.0 from getting harder:
  1. No new code calls `load.image` for card art outside `ArtLoaderScene`
     and `ArtResolver`.
  2. New surfaces (First Dawn's, accessibility's) draw card art only
     through CardView, the thumb cache or `addPortraitArt`.
  3. `addPortraitArt` stays the single portrait entry point.
  4. Nothing new reads `assets/art/cards*/` by URL.
  5. No code caches a `Frame` or `Texture` reference across frames. Hold
     keys and resolve them when drawing, so an eviction can never leave a
     stale reference behind.
- **Always 2.0, whatever 1.9 does:** the itch target's deletion of the loose
  folders and `dist/forge/`, its file-count gate, the itch target's
  `connect-src` gaining `https://itch.io` for the beacon itch injects
  (`scripts/cspForTarget.ts`), moving the Forge to packs if Pages ever drops
  the loose files, and a persistent art cache if the owner wants one.

## 9. Traps this design has to respect

- **`DuelScene` restarts between rungs.** The duel lease is taken in
  `create` and released at `SHUTDOWN`. Ordering keeps the shared set: both
  run in one scene-manager step, and eviction runs only from the loader
  scene's update, after it. Nothing subscribes twice across restarts (the
  playbook trap); the store's `REMOVE` and `RESTORE_WEBGL` listeners are
  game-global and registered once.
- **Destroyed-texture crashes.** A missed lease stops the game loop
  (section 3). Only the loader scene evicts, only between frames, only after
  the safety scan, and the removal belt re-points every holder at once.
- **Timers on destroyed objects.** Every arrival callback checks `.active`,
  as `redrawWhenArtLands` does now.
- **`npm run build` in a worktree without `cards-half/`** writes `half: []`
  and would build full packs only. The gate probes must run on a build with
  both tiers (copy the half set in, as the "before" run did).
- **vite from a worktree** optimizes the shared `node_modules/.vite` cache
  through the junction. Probe runs use a production build and
  `vite preview` (no optimizer) or a temporary config whose `cacheDir` is in
  the scratchpad.
- **A hidden Browser pane freezes Phaser's loader.** The new pipeline does
  not use Phaser's loader, but the probe still runs in headless Edge, not
  the pane.

## 10. Questions for the owner

Each opens with the recommendation.

1. **Thumbnails bake from the half-resolution files on desktop too.**
   Recommended: yes, for bakes only. Every thumb bake at every render size
   (k is at most 2) needs no more pixels than the 320x400 file holds (the
   full-art window is 282x402 at the largest bake). Collection and Deck
   Builder paging would then download and decode 4x less. The 1.8 ruling
   against half resolution on desktop was about the zoom preview, which
   keeps full resolution, as do live cards in duels, pack reveals and
   inspects. The alternative is full files for bakes on desktop.
2. **Budgets: desktop 640 MiB of card art plus 192 MiB of thumbs; phone
   160 MiB plus 48 MiB.** Recommended: take them as starting values and let
   the gate tour tune them once, since they are constants. With the
   decoded copies closed after upload (section 1, decided), that is about
   832 MiB of texture memory on desktop and about 208 MiB on phones at
   budget. Keeping the copies would have made it about 1,472 MiB and 368
   MiB. Today: 3,002 MiB of card-art textures on desktop (4,176 MiB measured
   in Edge's GPU process) and 750 MiB on phones (1,190 MiB measured), before
   thumbs.
3. **What a binder page turn shows before its art arrives.** Recommended:
   the page-turn animation starts at once on input. The art swap into the
   new spread holds up to about 150 ms for the spread's art, then shows
   stand-ins for anything still missing, which fill in. Locally the 12 half
   files take a few tens of milliseconds, so players on a good link never
   see a stand-in, and a slow link never blocks the page. The alternatives
   are showing stand-ins at once, or waiting for every card (today's
   behaviour, per page instead of per manifest).
4. **Pages keeps the loose card files beside the packs through 1.9.**
   Recommended: yes. The game on Pages reads packs. The loose files serve
   the Forge, tabs still running the previous build, and the pack fallback,
   at about 270 MB more per deploy (about 550 MB in all, under Pages' 1 GB
   site limit), so every push to `main` uploads roughly twice as much and
   deploys take roughly twice as long. The Forge moves to packs and the
   loose files leave Pages by 2.0. itch never gets them, nor the Forge.
5. **A persistent art cache (Cache Storage keyed by pack hash), so a
   returning player does not download art again.** Recommended: not in 1.9.
   On Pages, Cloudflare's 4-hour cache and the browser's HTTP cache cover
   most repeat sessions on Chromium. Whether Safari caches 206 responses
   is unverified. On itch the storage is partitioned and Safari makes it
   ephemeral, so the cache helps least where it would matter most.
   Revisit with 2.0's measurements, Safari first.
6. **If 1.9 runs long, defer the packs (S2) and S5a's long tail to 2.0.**
   Recommended: yes, over deferring the whole lane. On-demand loading and
   eviction are what players feel in 1.9, and they do not depend on packs.
   The cost is the release of pack soak on Pages, so 2.0 would schedule its
   own before the itch launch.
7. **Scale the phone budget by the device's memory where the browser says
   it.** Recommended: yes. Where `navigator.deviceMemory` is present
   (Chromium on Android), scale the 160 + 48 MiB budget with it: half at
   2 GB or less, the base at 4 GB, 1.5x at 8 GB. Keep the base as the floor
   everywhere else, including iOS, which never exposes it. The alternative
   is one fixed phone budget.
8. **A shipped "no eviction" switch as the desktop fallback.** Recommended:
   yes, as a URL flag (`?artEvict=off`), which adds no player copy (a
   Settings toggle would need a string for the owner to word). It keeps
   on-demand loading but never evicts on the desktop tier (today's
   residency, bounded by what the player actually visits). It is the
   answer to a crash report after release that the gates did not catch,
   without a hotfix. The alternative is no switch, relying on the gates
   and a hotfix. As built (S1), the flag applies on every tier, not only
   desktop: it is explicit, and a phone under it behaves as today.
