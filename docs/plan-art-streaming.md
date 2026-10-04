<!-- source-of-truth: src/config/features.ts, src/art/artBudget.ts, src/art/artLoader.ts, src/art/artSource.ts, src/art/ArtResolver.ts, src/art/artWatch.ts, src/art/artArrivals.ts, src/art/artRetry.ts, src/ui/CardThumbCache.ts, src/ui/artGate.ts, src/ui/duelArt.ts, src/art/pagedRequests.ts, src/art/packRequests.ts, src/art/artLifetime.ts, src/ui/displayWalk.ts, src/scenes/ArtLoaderScene.ts, scripts/probe-art.mjs, scripts/art-probe-metrics.mjs, scripts/art-probe-runtime.mjs, scripts/art-probe-compare.mjs, scripts/art-probe-processes.mjs, scripts/art-probe-save.ts, scripts/gen-art-manifest.ts, scripts/gen-art-halfres.ts, scripts/serve-lan.ts, .github/workflows/deploy.yml, src-tauri/tauri.conf.json · last-verified: 2026-10-03 · design doc, re-verify when the art loader, the thumbnail cache, the card-face geometry (R13) or the deploy pipeline changes -->

# Card art streaming: load on demand, unload under a budget (1.9 lane D)

**Status 2026-10-03: S1-S6 built; flag on in 1.9.**
`FEATURES.artStream` is true. S6's probe and gate calculations are implemented;
Section 6 records the approver's evidence and the revised gate-1 rule;
fresh runs of the revised tour are pending.
Built instrumentation and a default-on flag do not establish a passed gate.
The earlier deferral choices in section 8 remain historical release context.

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
| `soon` | the next and previous binder spread, the chosen opponent's duel set (the Tower screen's rung, Practice's selection, the Tower reward's Next Foe), later packs in a batch | newest first |
| `idle` | the boot warm set (below); on desktop, the full textures of the spread on screen, so a hover zooms at once | first in, first out |

- **A window, not batches.** Six fetches in flight on the web and eight on
  the desktop app's local protocol (6 to 12 gained only 176 to 216 files/s at
  full). A new `now` request waits for one free slot, not for a 48-file
  batch.
- **Uploads are capped per frame.** Decoded bitmaps become textures from the
  scene's update, at most 4 full or 8 half per frame (to be tuned by the
  long-task check in the gates). A decoded bitmap waiting for that frame
  still occupies the fetch/decode window. Paused frames cannot accumulate
  a decoded copy of every queued card.
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
| Pack opening | the rolled cards as live CardViews | built: first original pack gated before build; later packs leased at `soon`, promoted before their cards flip in the existing rarity-sorted runway; Skip gates its summary cards | `now`; later packs `soon` | the batch, released at scene shutdown or destruction | full / half |
| Duel | both decks, reserves, tokens, Darlings, portraits (115-137 keys; in the Tower also the 26 rung portraits the run recap draws) | the set (`src/ui/duelArt.ts`), gated at `create` as today; prefetched at `soon` once the opponent is chosen: the Tower screen's rung, Practice's selection, the Tower reward's Next Foe. Play has no prefetch: nothing is chosen there | `now` | the scene, through restarts between rungs (see Traps) | full / half |
| Limited draft | the pick pack (up to 15 thumbs), the picks, table portraits | built: current human pack gated at half; portraits gated at primary; picks through `PagedArt` | `now`; picks `visible` | scene and thumb Images; released at shutdown or destruction | half thumbs, primary portraits / half |
| Limited Deck Builder | text-only pool and deck pages; a 1.35 CardView inspect | built: pool gated as today, gate released after build; text pages prefetch their cards; inspect takes its own primary lease | gate and inspect `now`; pages `soon` | initial gate until build; inspect until destruction | full inspect / half |
| Shop | grid faces, featured thumbs, deck preview and nested inspect | built: faces gated; waiting and finished modal containers each own `awaitArt`; odds draws no card art. The atelier is Collection's existing inspect | `now` | scene until shutdown; each modal until destruction | full / half |
| Profile | the owned-card picker (thumbs) | built: picker page at once through `PagedArt`, neighbours prefetched | `visible`; neighbours `soon` | page sources until arrival and bake; thumb Images until destruction; modal destruction cancels outstanding requests | half / half |
| Achievements hall | furnishings as CardViews | built: hall set gated as today; shutdown release verified in `sceneArtLease` | `now` | scene until shutdown | full / half |
| Gauntlet, Practice picker, Play | avatar portraits; the Play deck faces (thumbs) | built: existing portrait and face gates retained; Tower and Practice still prefetch the chosen duel through S5b | `now`; chosen duel `soon` | scene until shutdown | full / half |
| Zone contents | one page of graveyard, severed or reserve thumbs | built: page through `PagedArt`, neighbours prefetched; the duel's primary lease normally already covers their sources | `visible`; neighbours `soon` | page until arrival and bake; thumb Images until destruction; modal destruction cancels outstanding requests | half bakes from resident primary when available / half |
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
These constants are checked by the gate tour (owner question 2); a
`?artBudget=<MiB>` URL override exists for the stress run.

The table gives the base budgets. Built in S6, the `lite` tier reads
`navigator.deviceMemory`: at most 2 GB halves both budgets, at least 8 GB
multiplies both by 1.5, and intermediate or unavailable values keep the base
budgets. The `full` tier is unchanged. An explicit `?artBudget=<MiB>` takes
precedence and scales the thumbnail budget proportionally. `?artEvict=off`
disables both source-art and thumbnail eviction while retaining on-demand
loading; `?artStream=off` selects the legacy whole-manifest loader instead.

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

An evicted key with no remaining request, pin or failure history also loses
its store slot. Read-only residency queries do not recreate those records.
Released leases and canceled prefetches drop their slot references; retry
and final-failure history still lasts for the policy above.

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

Range reads pass `cache: 'no-store'` through the source's `Io`/`exchange`
seam. Chromium cannot share a sparse HTTP-cache entry between concurrent
range requests; otherwise it can reject them with
`ERR_CACHE_OPERATION_NOT_SUPPORTED`. This bypasses the browser HTTP cache
only for ranges. The CDN still caches the packs, and Pages sends
`max-age=14400`. Whole-pack reads and loose-file reads keep their existing
cache behaviour. A persistent art cache was ruled out of 1.9 (S-Q5).

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

`scripts/probe-art.mjs` drives a production build in headless Edge over CDP,
using a fresh disposable profile per run. It reads the existing, read-only
`window.__art` diagnostics beside `window.__game`. The desktop mode attaches
to the existing WebView2 game and validates its native app ancestry instead.
Fresh runs of this revised tour remain **pending approver measurement**.
Earlier design baselines, S5a observations and the S6 evidence quoted under
gate 1 explain the design and ruling; they are not fresh paired results.

The normal tour visits the menu; Collection (five spreads, a filter, zoom);
Deck Builder (pool pages, deck list, Darling picker); Shop previews; every
card in a three-pack batch; Limited draft and builder; Profile picker pages;
Achievements; Play, Practice and Tower; a duel, zoom and paged zone modal;
then Collection again. After all loops, a final duel exercises context loss
and restore, followed by Collection. Close/reopen stops exercise
scene and modal lifetimes. Runs and repeat children retain their JSON and
screenshots. A nonzero exit requires inspection of the named gate's verdict;
a legacy baseline can exceed streaming thresholds without invalidating its
raw measurements. A startup failure or incomplete evidence never passes.

At each stop, `residentMiB` and `pinnedMiB` are top-level fields computed as
bytes / 1,048,576 without rounding; unavailable legacy values are `null`.
`longTasks` is a numeric count, `longTaskTotalMs` is the sum, and
`longTaskDurationsMs` retains the individual unrounded durations over 50 ms.
Process memory comes from outside the store. Missing process identities,
Windows counters or observer support remain unavailable and make the
relevant gate **UNMEASURED**, rather than turning into zero.
The JSON source label comes from the read-only `window.__art.source` hook's
configured build source, rather than a guess from command-line options.
Request counters retain which pack or loose-file transports were used.

The measurement method is versioned as `probeVersion: s6-desktop-dispatch-v5` in
every run JSON and repeat parent. Memory and long-task comparisons refuse
missing or different versions, including a child that differs from its
repeat parent. Rerun both off and on; old evidence cannot be combined with
this method.

Before **every** stop's process-memory sample, in every mode, the probe
uses CDP `HeapProfiler.enable` / `HeapProfiler.collectGarbage` and waits
250 ms. It then records `jsHeapUsedMiB` from CDP `Runtime.getHeapUsage`
(`usedSize / 1,048,576`, without rounding) beside `rendererPrivateMiB`.
An unavailable heap reading stays null, with its reason recorded. These
separate JS-heap growth from native renderer memory; neither is inferred
from `performance.memory`.
The long-task recorder drains queued gameplay entries to the runner before
GC and clears that interval from the page. It disconnects through diagnostic
cleanup, GC, settling and counter sampling, then resumes without buffered
replay. Diagnostic work is excluded from gate 5 and cannot migrate to the
next stop.

The probe observes network events with zero response-body buffers. Chromium's
[inspector network agent](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/inspector/inspector_network_agent.cc)
otherwise retains response content independently of the HTTP cache (a 200 MB
desktop default). Its
[request metadata](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/inspector/network_resources_data.cc)
also survives completed requests. Before each idle stop's GC the probe resets
that domain and immediately reapplies the same network throttle; accumulated
request counts remain in the Node runner. This does not clear the HTTP cache,
reload the page, or reset the game's store. The initial menu's held requests
and an interrupted run's failure snapshot skip that reset. This method is
identical with streaming off and on. The renderer leak run must be repeated;
code inspection alone does not establish how much of its growth was inspector
retention.

Private bytes come from Windows `Get-Process.PrivateMemorySize64` for the
GPU and renderer PIDs identified by CDP. Dedicated/shared GPU bytes come
from the Windows `GPU Process Memory` counters. A renderer can exit between
CDP enumeration and the provider read; the supplied failures contain
`Cannot find a process` and `Process exited before memory measurement`.
The probe retries the complete four-counter observation up to three times,
waiting 150 ms between attempts and re-enumerating CDP PIDs each time.
`memorySampling.observations` retains the attempts. It uses one complete
observation, never counters stitched across attempts. If retries run out,
the final unavailable values stay null and the memory verdict stays
UNMEASURED.

After requesting browser/preview shutdown, cleanup polls owned processes
for up to 15 seconds, force-kills remaining trees, then verifies exit for
up to 5 seconds. Successfully killed stragglers appear in
`cleanup.warnings`, without failing gates 3 or 8. Only processes still alive
after that verification enter `cleanup.remaining` and fail cleanup.

### Preparation

Run this block once, then the gate blocks in the same PowerShell session.
Node, Python with Pillow and psutil, dependencies, Edge, and the existing
full-resolution art are prerequisites. By default, reuse the prepared web
build identified in the handoff; set `$s6Dist` to that exact directory. The
`normal` option regenerates half-resolution art, then builds the manifest,
packs, legal pages and notices. No command below stages, commits or pushes
changes.

The alternative uses the probe's Git-free `--build` path after generating
its inputs. That option builds and runs a preliminary tour; it is not a
build-only switch. Its separate web output survives the later desktop build.
Most tours use `--repeat 1`; the paired gate-1 runs use three. Each web tour
also runs one cold
timing pass in a separate fresh profile after closing the tour browser.
`--timing` runs only the cold pass. Timing runs use three independent
profiles (`--repeat` defaults to 3).

```powershell
Set-Location -LiteralPath 'Z:\Coding Projects\DarlingBlades-worktrees\w7-art'
$s6Out = Join-Path $env:TEMP ('db-s6\measurements-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $s6Out -Force | Out-Null
$s6BuildMode = 'existing' # existing, normal, or probe (Git-free build alternative).
$s6Dist = Join-Path (Get-Location).Path 'dist' # Use the prepared web directory from the handoff.
if ($env:TAURI_ENV_PLATFORM) { throw 'Prepare the web build without TAURI_ENV_PLATFORM set' }
if ($s6BuildMode -eq 'probe') {
    foreach ($script in @('gen-art-halfres', 'gen-art-manifest', 'pack-art', 'gen-legal-pages', 'gen-third-party-notices')) {
        & npx.cmd tsx "scripts/$script.ts"
        if ($LASTEXITCODE -ne 0) { throw "Preparation failed: $script" }
    }
    $s6Dist = Join-Path $s6Out 'web-dist'
    node scripts/probe-art.mjs --build --dist $s6Dist --stream off --tier full --repeat 1 --out $s6Out --label preparation-off
    Write-Host "Preliminary tour exit: $LASTEXITCODE; inspect preparation-off.json"
} elseif ($s6BuildMode -eq 'normal') {
    npm.cmd run gen-art-halfres
    if ($LASTEXITCODE -ne 0) { throw 'Half-resolution generation failed' }
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
    $s6Dist = (Resolve-Path -LiteralPath 'dist').Path
} elseif ($s6BuildMode -ne 'existing') {
    throw 's6BuildMode must be existing, normal, or probe'
}
if (-not (Test-Path -LiteralPath (Join-Path $s6Dist 'index.html'))) { throw 'Prepared web build is missing' }
Write-Host "Build: $s6Dist; evidence: $s6Out"
```

### Gates as measured

Empty cells are reserved for the approver's actual observations, artifact
paths and verdicts. Do not populate them from estimates, unit tests,
historical runs or a failed browser launch. A table row is not an assertion
that the run happened.

#### Gate 1: paired GPU peaks, renderer peaks and retention

**Owner ruling, 2026-10-03: measure against today.** Edge's measured GPU
process cost is about 3-5 times live texture bytes (about 1.4 times just
after context restore); the original B+1,000 / B+260 limits assumed about
1.2 times. The 640+192 MiB desktop and 160+48 MiB phone budgets are unchanged.
The former renderer B+100 rule also failed with streaming off (+170 MiB).

The approver's same-tour evidence, measured outside the sandbox:

| Tier | Streaming-off GPU peak (MiB) | Streaming-on GPU peak (MiB) | Reduction |
| --- | --- | --- | --- |
| full | 6,563 | 3,325 | about 49% |
| lite | 2,120 | 1,354 | about 36% |

A full-tier 8 MiB run stayed flat at about 1,800 MiB through 1,039 evictions.
These observations justify the rule; they do not substitute for fresh paired
runs of this build. The earlier design baselines remain in section 3:
3,002 MiB of desktop source textures (4,176 MiB GPU-process private) and
750 MiB on phones (1,190 MiB private), before unbounded thumbs.

At every stop, sum all identified GPU processes' private, dedicated and
shared memory. Take the maximum of those sums over the complete tour, and
separately the maximum total renderer private memory. Missing counters
remain missing, never zero. **Peak reduction passes** when the on GPU peak
is at most 60% of off on `full`, or at most 70% on `lite`. **Renderer passes**
when its on peak is at most its off peak plus 100 MiB. Both must pass.
With repeats, compare the medians of the per-run peaks, never pooled stops
or an average; every requested repeat must have complete evidence.

Run off then on back to back on the same machine, build, tier and tour,
without intervening build or measurement jobs. The standalone Phaser-free
`scripts/art-probe-compare.mjs` reads the two JSONs (individual runs or
repeat parents), writes the numbers, percentages and paired verdict, and
rejects incomplete or mismatched evidence. Code/document build hashes,
machine hashes, timestamps, fixture and ordered-stop metadata identify the
pair. External URLs and attached apps have no verified local build hash,
so cannot supply this paired verdict. A single unpaired run reports gate 1
as **UNMEASURED**, retaining its raw peaks. Its successful exit only means
the applicable capture gates passed; it is not a paired gate-1 pass.

The first `menu` still loads the fixture before navigation, holds art IO
and checks zero resident art. Its counters remain diagnostic, not limits.
`--loops N` (default 1) then repeats the entire scene tour N times in one
page. Only the disposable save fixture is reset between loops; the store
and caches survive, with unchanged navigation time origin and no context
restore. Loop 2 and later suffix their stop names with `-loop2`, etc.
Gates 3 and 4 continue checking every stop of every loop.

**Gate 1 leak** is separate: on `--budget 8 --loops 2`, loop 2's GPU peak
and renderer peak must each be at most loop 1's corresponding peak plus
100 MiB. With more loops, every later loop is checked against loop 1.
Forced context loss runs once after all loops, followed by a final return
to Collection, so a restore cannot conceal retained allocations. These
last two stops count in the full-tour paired peak, but not loop peaks.
Desktop attach accepts one loop because its privacy test reloads the page.

| Tier | Off/on JSONs | Median off/on GPU peaks (MiB) | Reduction | Median off/on renderer peaks (MiB) | Paired verdict |
| --- | --- | --- | --- | --- | --- |
| full | | | | | |
| lite | | | | | |

| Tier, 8 MiB | Loop 1/2 GPU peaks (MiB) | Loop 1/2 renderer peaks (MiB) | JSON / gate 1 leak |
| --- | --- | --- | --- |
| full | | | |
| lite | | | |

```powershell
$gateOut = Join-Path $s6Out 'gate1'
foreach ($tier in @('full', 'lite')) {
    # Keep each off/on pair consecutive, on this machine and this exact build.
    $offLabel = "gate1-$tier-off"
    $onLabel = "gate1-$tier-on"
    node scripts/probe-art.mjs --dist $s6Dist --tier $tier --stream off --repeat 3 --out $gateOut --label $offLabel
    Write-Host "$offLabel capture exit: $LASTEXITCODE"
    node scripts/probe-art.mjs --dist $s6Dist --tier $tier --stream on --repeat 3 --out $gateOut --label $onLabel
    Write-Host "$onLabel capture exit: $LASTEXITCODE"
    node scripts/art-probe-compare.mjs --off (Join-Path $gateOut "$offLabel.json") --on (Join-Path $gateOut "$onLabel.json") --out (Join-Path $gateOut "gate1-$tier-paired.json")
    Write-Host "$tier paired gate 1 exit: $LASTEXITCODE"
    node scripts/probe-art.mjs --dist $s6Dist --tier $tier --stream on --budget 8 --loops 2 --repeat 1 --out $gateOut --label "gate1-$tier-leak"
    Write-Host "$tier gate 1 leak exit: $LASTEXITCODE; inspect gate1-$tier-leak.json"
}
```

#### Gate 2: cold time to Collection

Every ordinary web tour now captures a separate cold pass automatically;
its `collectionTiming` and repeat medians come from that pass, whose JSON
and capture status remain under `coldTimingRun`. The tour and timing
browsers run serially. `--timing` selects the same measurement alone.
Attached desktop tours remain outside this cold-profile measurement.

The cold pass builds its owned-card save offline through
`scripts/art-probe-save.ts`, using the real `freshSave`, collectible catalog
and starter-deck data without Phaser or a browser boot. In a fresh profile,
the probe injects this fixture before the **first game navigation** and
clears browser cache before that navigation. No bootstrap browser load or
seed reload warms the app. From the first navigation it records the binder's
first draw, the loading line disappearing, and all 12 first-spread pockets
showing real art. It also records Collection-entry clocks and the binder's
frame number. Offline fixture construction, warm tour stops and page-turn
timings are excluded.

Run all four scenarios with streaming off and on, three independent profiles
per cell. Publish the medians of all three observations without trimming
failures or outliers. Acceptance applies to the cold **Collection-entry**
clock: binder on frame 1, all 12 pockets real within 500 ms locally or
2,000 ms when throttled. Navigation clocks are reported separately so boot
cost remains visible; they must not be presented as Collection-entry time.

`--net N` means N megabits/s and **40 ms imposed round-trip latency** through
CDP's `latency` parameter (minimum request-to-response delay). It does not
mean 40 ms each way, nor measured Internet RTT. The local scenarios impose
zero latency. `--cpu 4` applies fourfold CPU slowdown. See the
[CDP network emulation definition](https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-emulateNetworkConditions).

| Scenario | Mode | Navigation to binder / loading gone / 12 real, median ms | Entry to binder / 12 real, median ms | Binder frame / pockets | JSON / verdict |
| --- | --- | --- | --- | --- | --- |
| full local | off | | | | |
| full local | on | | | | |
| full 50 Mbps, 40 ms, CPU 1 | off | | | | |
| full 50 Mbps, 40 ms, CPU 1 | on | | | | |
| lite local | off | | | | |
| lite local | on | | | | |
| lite 20 Mbps, 40 ms, CPU 4 | off | | | | |
| lite 20 Mbps, 40 ms, CPU 4 | on | | | | |

```powershell
$gateOut = Join-Path $s6Out 'gate2'
$scenarios = @(
    @{ name = 'full-local'; tier = 'full'; net = $null; cpu = 1 },
    @{ name = 'full-50'; tier = 'full'; net = 50; cpu = 1 },
    @{ name = 'lite-local'; tier = 'lite'; net = $null; cpu = 1 },
    @{ name = 'lite-20-cpu4'; tier = 'lite'; net = 20; cpu = 4 }
)
foreach ($scenario in $scenarios) {
    foreach ($mode in @('off', 'on')) {
        $label = 'gate2-' + $scenario.name + '-' + $mode
        $probeArgs = @('scripts/probe-art.mjs', '--dist', $s6Dist, '--timing', '--tier', $scenario.tier,
            '--stream', $mode, '--cpu', [string]$scenario.cpu, '--repeat', '3', '--out', $gateOut, '--label', $label)
        if ($null -ne $scenario.net) { $probeArgs += @('--net', [string]$scenario.net) }
        & node @probeArgs
        Write-Host "$label exit: $LASTEXITCODE; inspect the parent JSON and all three child runs"
    }
}
```

#### Gate 3: arrival and live-object correctness

At every tour stop, wait until nothing is queued, in flight or pending upload
for 500 ms. `standIns()` and `missingTextures()` must both be zero, with no
console errors. This includes provisional thumbnails whose source is now
resident. Check full at 1920x1080, k=2, and lite at 844x390, k=1. `--stream
default` also verifies the shipped default selects the store. After the
production runs, `--url <dev URL> --showcase` repeats the tour in a dev build,
then visits Showcase, changes its pick twice and returns to Collection. These
two additional full/lite runs use the loose source and their own profiles.
The block owns a hidden Vite server on port 4392, with a temporary config and
cache. Its dev defines match the app's version and loose source; the temporary
config does not invoke Git or change the repository's config.

| Surface / tier | Stops checked | Stand-ins | Missing textures | Console errors | JSON / verdict |
| --- | --- | --- | --- | --- | --- |
| production full | | | | | |
| production lite | | | | | |
| Showcase, dev full | | | | | |
| Showcase, dev lite | | | | | |

```powershell
$gateOut = Join-Path $s6Out 'gate3'
foreach ($tier in @('full', 'lite')) {
    $label = "gate3-$tier-default"
    node scripts/probe-art.mjs --dist $s6Dist --tier $tier --stream default --repeat 1 --out $gateOut --label $label
    Write-Host "$label exit: $LASTEXITCODE; inspect $gateOut\$label.json"
}
New-Item -ItemType Directory -Path $gateOut -Force | Out-Null
$devRoot = (Get-Location).Path
$devPort = 4392
$devUrl = "http://127.0.0.1:$devPort/"
$devConfig = Join-Path $gateOut 'showcase.vite.config.mjs'
$devSettings = @{
    root = $devRoot
    cacheDir = (Join-Path $gateOut 'vite-cache')
    define = @{
        __APP_VERSION__ = ((Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version | ConvertTo-Json -Compress)
        __GIT_SHA__ = '"dev"'
        __ART_SOURCE__ = '"loose"'
    }
    server = @{ host = '127.0.0.1'; port = $devPort; strictPort = $true }
}
('export default ' + ($devSettings | ConvertTo-Json -Depth 5 -Compress) + ';') |
    Set-Content -LiteralPath $devConfig -Encoding UTF8
$portCheck = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $devPort)
try { $portCheck.Start() } finally { $portCheck.Stop() }
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$viteBin = (Resolve-Path -LiteralPath 'node_modules/vite/bin/vite.js').Path
$viteArgs = @(('"' + $viteBin + '"'), '--config', ('"' + $devConfig + '"'), '--configLoader', 'runner')
$devTreeCode = @'
import json, psutil, sys
try:
    root = psutil.Process(int(sys.argv[1]))
    rows = []
    for proc in [root] + root.children(recursive=True):
        try:
            rows.append({'pid': proc.pid, 'startedAt': proc.create_time()})
        except psutil.NoSuchProcess:
            pass
    print(json.dumps(rows))
except psutil.NoSuchProcess:
    print('[]')
'@
$dev = $null
$devStartTicks = $null
$devOwned = @()
$devCleanupUnknown = $false
$devCleanupExit = 1
try {
    $dev = Start-Process -FilePath $nodeExe -ArgumentList $viteArgs -WorkingDirectory $devRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $gateOut 'showcase-vite.stdout.log') `
        -RedirectStandardError (Join-Path $gateOut 'showcase-vite.stderr.log')
    $devStartTicks = $dev.StartTime.ToUniversalTime().Ticks
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    while ($true) {
        if ($dev.HasExited) { throw 'Showcase Vite server exited; inspect its logs' }
        try {
            $response = Invoke-WebRequest -Uri $devUrl -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { break }
        } catch { }
        if ([DateTime]::UtcNow -ge $deadline) { throw 'Showcase Vite server did not become ready' }
        Start-Sleep -Milliseconds 200
    }
    $snapshot = python -c $devTreeCode $dev.Id
    if ($LASTEXITCODE -ne 0) { throw 'Could not record the owned Vite process tree' }
    $devOwned += @($snapshot | ConvertFrom-Json)
    foreach ($tier in @('full', 'lite')) {
        $label = "gate3-showcase-$tier"
        node scripts/probe-art.mjs --url $devUrl --showcase --tier $tier --stream on --repeat 1 --out $gateOut --label $label
        Write-Host "$label exit: $LASTEXITCODE; inspect all Showcase stops and the return to Collection"
    }
} finally {
    if ($null -ne $dev) {
        $current = Get-Process -Id $dev.Id -ErrorAction SilentlyContinue
        if ($current -and $current.StartTime.ToUniversalTime().Ticks -eq $devStartTicks) {
            $snapshot = python -c $devTreeCode $dev.Id
            if ($LASTEXITCODE -eq 0) { $devOwned += @($snapshot | ConvertFrom-Json) }
            else { $devCleanupUnknown = $true }
            taskkill.exe /PID $dev.Id /T /F | Out-Null
        }
    }
    $ownedJson = ConvertTo-Json -InputObject @($devOwned) -Depth 4 -Compress
    $cleanupJson = $ownedJson | python -c @'
import json, psutil, sys
owned = json.load(sys.stdin)
seen, waiting, errors = set(), [], []
for item in owned:
    identity = (item['pid'], item['startedAt'])
    if identity in seen:
        continue
    seen.add(identity)
    try:
        proc = psutil.Process(item['pid'])
        if proc.create_time() == item['startedAt']:
            proc.kill()
            waiting.append(proc)
    except psutil.NoSuchProcess:
        pass
    except psutil.AccessDenied:
        errors.append({'pid': item['pid'], 'reason': 'access denied'})
_, alive = psutil.wait_procs(waiting, timeout=5)
print(json.dumps({'tracked': owned, 'remaining': [proc.pid for proc in alive], 'errors': errors}))
sys.exit(1 if alive or errors else 0)
'@
    $devCleanupExit = $LASTEXITCODE
    $cleanupJson | Set-Content -LiteralPath (Join-Path $gateOut 'showcase-vite-cleanup.json') -Encoding UTF8
}
if ($devCleanupUnknown -or $devCleanupExit -ne 0) { throw 'Vite process cleanup is incomplete or unverified' }
```

#### Gate 4: eviction stress

Run the same full and lite tours at `--budget 8` (`?artBudget=8`). Gate 3 must
hold and the safety scan must report zero missed leases/thumbnail holds.
Every stop must report an effective source budget of exactly 8 MiB, and the
completed tour must observe both source evictions and thumbnail evictions
greater than zero. An eviction-disabled run cannot prove this gate. Source
and thumbnail budgets both scale under the override.

| Tier | Effective budget (MiB) | Source / thumb evictions | Missed leases / holds | Stand-ins / missing textures | Console errors | JSON / verdict |
| --- | --- | --- | --- | --- | --- | --- |
| full, 8 MiB | | | | | | |
| lite, 8 MiB | | | | | | |

```powershell
$gateOut = Join-Path $s6Out 'gate4'
foreach ($tier in @('full', 'lite')) {
    $label = "gate4-$tier-8mib"
    node scripts/probe-art.mjs --dist $s6Dist --tier $tier --stream on --budget 8 --repeat 1 --out $gateOut --label $label
    Write-Host "$label exit: $LASTEXITCODE; inspect $gateOut\$label.json"
}
```

#### Gate 5: main-thread cost against streaming off

Collect a new off baseline and pass its JSON to `--baseline` for the on run.
The comparison requires the same complete **ordered** stop list, tier,
throttle, budget, eviction mode, target and art source. Pack, draft and Tower
inputs use deterministic seeds; the captured pack/draft card IDs, Tower
opponent and duel seed must also match between the actual runs. Matching
stop names alone is insufficient. Both the total count of tasks over 50 ms
and their total duration must be no greater than the baseline. Historical
zero-task observations cannot stand in for this build's baseline.
Unavailable observers or mismatched conditions/fixtures are UNMEASURED.

| Tier | Off count / total ms | On count / total ms | Ordered stops, conditions and fixtures match | Baseline / candidate JSON | Verdict |
| --- | --- | --- | --- | --- | --- |
| full | | | | | |
| lite | | | | | |

```powershell
$gateOut = Join-Path $s6Out 'gate5'
foreach ($tier in @('full', 'lite')) {
    $offLabel = "gate5-$tier-off"
    node scripts/probe-art.mjs --dist $s6Dist --tier $tier --stream off --repeat 1 --out $gateOut --label $offLabel
    Write-Host "$offLabel exit: $LASTEXITCODE; retain its JSON even if streaming thresholds fail"
    $baseline = Join-Path $gateOut "$offLabel.json"
    if (-not (Test-Path -LiteralPath $baseline)) { throw "Missing baseline: $baseline" }
    $onLabel = "gate5-$tier-on"
    node scripts/probe-art.mjs --dist $s6Dist --tier $tier --stream on --repeat 1 --baseline $baseline --out $gateOut --label $onLabel
    Write-Host "$onLabel exit: $LASTEXITCODE; inspect its gate 5 comparison"
}
```

#### Gate 6: packaged desktop and privacy-window interruption

Build the actual Tauri app, find Cargo's `app.exe`, and launch it with a fresh
`WEBVIEW2_USER_DATA_FOLDER` and an inherited debugging port. Attach to the
existing game target, retaining Tauri's own URL and loose-art source. The
probe validates app/PID ancestry and never shuts down the native app; this
block's `finally` owns the process tree, verifies cleanup, and restores the
environment. It preserves the profile and artifacts for inspection.

The probe establishes a cold duel with art-store reads in flight, holding
only their fetch dispatch in a probe-injected page shim. CDP Fetch interception
is not used on the app: continuing an intercepted request bypasses WebView2's
custom-protocol handler for `http://tauri.localhost` and produces connection
refusals. Web tours keep their existing CDP mechanism. No app code or player
flow installs this shim, and cleanup restores the original fetch function.

It opens the real `./privacy.html` window only while Duel has its
`Unsheathing` gate, positive store in-flight work and held dispatches, all
checked in the same call that opens the window. The evidence identifies
`interruption: page-fetch-dispatch`; these are outstanding store reads,
not a claim that their native HTTP transport has started. Immediately after
the window-open call, the shim forwards each original request and signal
through the original page fetch so Tauri's handler serves it. Privacy document
requests are never held. Real art I/O can overlap the remaining window
initialization. The probe verifies the new window's canonical privacy path
and `Darling Blades Privacy Policy` title, the completed duel, and the privacy
target's disappearance through its return-to-game route. Gate 3 must hold after
recovery. Gate 8 also requires gate 3 for the entire tour; the previous desktop
context-restore evidence was complete, but those eight probe-created console
errors alone made both gates fail.

Run this after local web measurements. `app:build` rebuilds `dist` for loose
Tauri assets; rebuild the web target before reusing that directory for a web
gate. The alternative preparation's separate `$s6Dist` avoids that overwrite.
WebView2 environment inheritance is documented by
[Microsoft](https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/debug-visual-studio-code#using-an-environment-variable);
whether this packaged build attaches successfully remains an actual gate.

| App / source | Native PID and descendant evidence | Pending gate / new privacy window | Network failures / duel recovery | Cleanup survivors | JSON / verdict |
| --- | --- | --- | --- | --- | --- |
| app.exe / loose | | | | | |

The launcher owns the app tree and verifies recorded PID/creation-time
identities. It writes JSON arrays to temporary files, then the Python helper
reads a file and writes `native-cleanup.json` directly, including empty trees
and errors. The launcher writes a failure record if that helper cannot run;
there is no JSON stdin pipe or inline `python -c` quoting. The old block's
explicit `ConvertTo-Json -InputObject @(...)` handles empty arrays correctly
on PowerShell 5.1; the missing record's original cause was not established.

Use `-SkipBuild` for a probe-only rerun against the existing
`src-tauri/target/release/app.exe`; this skips both the build and Cargo
metadata. `-AppExe <path>` supports another target directory. Every launch
records the resolved executable, SHA-256, profile and build choice in
`native-launch.json`. Preserve the cleanup and owned-identity input files
beside the probe JSON.

```powershell
$gateOut = Join-Path $s6Out 'gate6'
# First measurement: builds, resolves app.exe, launches, probes and closes its tree.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/probe-art-desktop.ps1 -Out $gateOut
# Probe-only rerun: reuse the already measured binary without building or running Cargo.
# powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/probe-art-desktop.ps1 -SkipBuild -Out (Join-Path $s6Out 'gate6-rerun')
if ($LASTEXITCODE -ne 0) { throw 'Inspect gate6-desktop.json and native-cleanup.json' }
```

#### Gate 7: deployed pack ranges and live rendering

After deploying the matching 1.9 build, check **every distinct full and half
pack in the staged index**, requesting bytes 0-99 with `Accept-Encoding:
gzip, br`. Each must return 206, matching `Content-Range`, and no
`Content-Encoding`. Then run the live tour on both tiers and require gate 3.
Checking one pack, the local preview, or transport alone does not pass this
gate. The local index must match the deployed build's content hashes.

| Target | Packs checked / 206 / no encoding | Full live gate 3 | Lite live gate 3 | JSON / verdict |
| --- | --- | --- | --- | --- |
| first matching 1.9 Pages deploy | | | | |

```powershell
$gateOut = Join-Path $s6Out 'gate7'
$liveBase = 'https://bladedarlings.com/' # Use the matching deployed build, including its project path if any.
node scripts/probe-art.mjs --check-packs $liveBase --repeat 1 --out $gateOut --label gate7-packs
Write-Host "Pack transport exit: $LASTEXITCODE; inspect gate7-packs.json"
foreach ($tier in @('full', 'lite')) {
    $label = "gate7-live-$tier"
    node scripts/probe-art.mjs --url $liveBase --tier $tier --stream default --repeat 1 --out $gateOut --label $label
    Write-Host "$label exit: $LASTEXITCODE; inspect the live gate 3 evidence"
}
```

#### Gate 8: actual context loss and restore

The tour forces `WEBGL_lose_context` during Duel and requires both actual
`webglcontextlost` and `webglcontextrestored` events. After restoration the
game's frame counter must advance, pinned art must reload, and gate 3 must
hold with no console errors. Calling the extension without observed events,
an unavailable extension or canvas fallback cannot prove the gate.

| Tier | Lost / restored events | Frames advanced | Stand-ins / missing textures | Console errors | JSON / verdict |
| --- | --- | --- | --- | --- | --- |
| full | | | | | |
| lite | | | | | |

```powershell
$gateOut = Join-Path $s6Out 'gate8'
foreach ($tier in @('full', 'lite')) {
    $label = "gate8-$tier-restore"
    node scripts/probe-art.mjs --dist $s6Dist --tier $tier --stream on --repeat 1 --out $gateOut --label $label
    Write-Host "$label exit: $LASTEXITCODE; inspect actual events, running frames and the restored stop"
}
```

Run gates 1-5 and 8 before gate 6 if `$s6Dist` is the ordinary `dist` folder,
or repeat web preparation after gate 6. Gate 7 follows the matching deploy.
The standalone approver copy of this runbook is
`C:\Users\Jim\AppData\Local\Temp\db-s6\RUNBOOK.md`.

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
| **S1 The store (built)** | NEW `src/art/artStore.ts`, `src/art/artBudget.ts`, `tests/art/artStore.test.ts`; EDIT `src/art/artLoader.ts`, `tests/art/artLoader.test.ts` | the owner's sitting | Built: Phaser-free store, budgets, leases, priorities and compatibility wrappers |
| **S2 Sources and packs (built)** | NEW `src/art/artSource.ts`, `scripts/pack-art.ts`, `tests/art/artSource.test.ts`, `tests/scripts/packArt.test.ts` (+ a 3-file fixture); EDIT `vite.config.ts`, `package.json` (the `build` script), `.gitignore`, `.github/workflows/deploy.yml`, `scripts/serve-lan.ts`, `docs/desktop-build.md`, `docs/architecture.md` | the sitting; runs beside S1 | Built: loose and packed sources, content-hashed packs, range fallbacks and target-specific build wiring |
| **S3 The Phaser shell (built)** | EDIT `src/scenes/ArtLoaderScene.ts` (decode, upload cap, eviction and the safety scan, `window.__art`), `src/art/ArtResolver.ts` (tier and the best-resident answer), `src/art/artWatch.ts` (`holdArt`), `src/ui/artGate.ts` (scene leases), `src/scenes/PreloadScene.ts`; NEW `scripts/probe-art.mjs` | S1, S2 | Built; **on by default in 1.9** after S5a's Collection, Deck Builder and Showcase paging split. `?artStream=off` selects the legacy whole-manifest loader |
| **S4 Views hold what they draw (built)** | EDIT `src/ui/CardView.ts`, `src/ui/BoardCardView.ts`, `src/ui/CardThumbCache.ts`, `src/ui/portraitArt.ts` (I9's `addPortraitArt`: the lease and the removal belt go inside it), `src/ui/saveCard.ts` | S3; **R13 in `CardView.ts`**; I9 (PR #473) | Built: view, portrait, export and thumbnail ownership; shared-file order was R13, then S4, then accessibility |
| **S5a Grids and menus (built)** | EDIT `CollectionScene.ts`, `DeckBuilderScene.ts`, `CardShowcaseScene.ts`, `PackOpeningScene.ts`, `LimitedDraftScene.ts`, `LimitedDeckBuilderScene.ts`, `ShopScene.ts`, `ProfileScene.ts`, `AchievementsScene.ts`, `PlayScene.ts`, `GauntletScene.ts`, `PracticePickerScene.ts`, `src/ui/ZoneContentsModal.ts`; shared `artGate.ts`, `pagedRequests.ts`, `packRequests.ts`, `artLifetime.ts`; probe and Phaser-free tests | S4; I9 and I5 (`LimitedDraftScene.ts`), I9 (`ShopScene.ts`, `GauntletScene.ts`, `PracticePickerScene.ts`); I3 and I4 (`DeckBuilderScene.ts`) | Built: core and long tail, preserving the landed accessibility layouts. Paged thumbnails, per-pack reveal gates and destroy-bound modal waits are in place; flag on in 1.9 |
| **S5b The duel (built)** | EDIT `src/scenes/DuelScene.ts` (the duel lease across rung restarts, the portrait leases) | S4; **I6 and I9** (wave 1) | Built: duel and portrait leases, including rung handover; shared-file order was I6/I9, then S5b, then A2 and accessibility |
| **S6 Gates (built)** | `scripts/probe-art.mjs`, `scripts/art-probe-metrics.mjs`, `scripts/art-probe-processes.mjs`, `scripts/art-probe-save.ts`; section 6 and the standalone runbook | S5a, S5b | Built: corrected timing, memory and long-task measurements; desktop attach and gate runbook. All eight approver measurements remain pending; no measured gate result is claimed |

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

The S5a long tail below is now implemented; its rendered gates remain open.
The earlier deferral boundary is retained here as release context.

- **Where wave 2 would actually run long.** Not S2: packs are Phaser-free
  and about two days of work. The long parts are S5a (13 scene files that
  lane I touches before it and accessibility after it) and S6's gates.
- **If 1.9 runs long, defer S2 and S5a's long tail.** The long tail is the
  Profile picker, the Achievements hall, the Shop modals and the two
  Limited scenes. They stay correct through the old wrappers
  (`gateOnArt`, `awaitArt`, `ensureArt` on their own sets), just without
  paging-level leases. Ship S1, S3, S4, S5a's core (Collection, the Deck
  Builder and the Showcase, the three whole-manifest gates that originally
  required S3's flag, plus pack opening), S5b and S6 over the
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
  scene's update, after it. Confirmed in S5b by reading the Phaser 3.90
  source (`ScenePlugin.restart` queues the stop and the start;
  `SceneManager.update` runs `processQueue` before any scene steps); the
  store half is tested in `tests/art/duelRungCarry.test.ts`. Nothing
  subscribes twice across restarts (the playbook trap); the store's `REMOVE`
  and `RESTORE_WEBGL` listeners are game-global and registered once.
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
   returning player does not download art again.** Ruled out of 1.9 (S-Q5).
   On Pages, Cloudflare still caches the packs and Pages sends
   `max-age=14400`. Range reads bypass the browser HTTP cache because
   Chromium cannot share a sparse entry between concurrent ranges;
   whole-pack and loose-file reads keep their existing cache behaviour.
   On itch the storage is partitioned and Safari makes it
   ephemeral, so the cache helps least where it would matter most.
   Revisit with 2.0's measurements, Safari first.
6. **If 1.9 runs long, defer the packs (S2) and S5a's long tail to 2.0.**
   Recommended: yes, over deferring the whole lane. On-demand loading and
   eviction are what players feel in 1.9, and they do not depend on packs.
   The cost is the release of pack soak on Pages, so 2.0 would schedule its
   own before the itch launch.
7. **Scale the phone budget by the device's memory where the browser says
   it.** Built in S6. Where `navigator.deviceMemory` is present, scale both
   lite budgets: half at 2 GB or less, the base between 2 and 8 GB, and 1.5x
   at 8 GB or more. An unavailable or invalid value keeps the base; the full
   tier is unchanged. Both the art store and thumbnail cache receive the
   device-memory value, and an explicit `?artBudget=<MiB>` overrides it.
8. **A shipped "no eviction" switch as the desktop fallback.** Recommended:
   yes, as a URL flag (`?artEvict=off`), which adds no player copy (a
   Settings toggle would need a string for the owner to word). It keeps
   on-demand loading but never evicts on the desktop tier (today's
   residency, bounded by what the player actually visits). It is the
   answer to a crash report after release that the gates did not catch,
   without a hotfix. The alternative is no switch, relying on the gates
   and a hotfix. As built, the flag applies on every tier, not only desktop;
   S6 also wires it through the thumbnail cache, so it disables both source
   and thumbnail eviction. It does not select the legacy loader: that is
   `?artStream=off`.
