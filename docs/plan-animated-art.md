<!-- source-of-truth: docs/plan-road-to-2.0.md, docs/roadmap.md, docs/plan-art-streaming.md, src/config/rules.ts, src/meta/variants.ts, src/ui/CardView.ts, src/meta/SaveManager.ts · last-verified: 2026-10-02 · proposal: post-2.0, not scheduled, nothing built -->

# Animated art: a variant rarer than Full Art

**Status: Proposal, 2026-10-02; post-2.0; nothing built.** Added to the
roadmap at the owner's request. Placement is after 2.0 and not scheduled,
because the two hard parts, perfect loops and storage, need their own
investigation first.

## Goal

The owner's words (2026-10-02): "A new tier of rarity for images: Animated.
So this would be rarer than Full Art; and we'd need to figure out 'perfect
loops' and how to get the pipeline not to kill storage, which is why it's a
post-2.0 thing."

A pulled card can come as an **Animated** printing: the art moves in a
seamless loop. It is the rarest printing, the chase above Full Art.

## What already exists

Full Art (decided 2026-07-13, shipped in 1.2) is the precedent for adding a
printing axis, and most of its machinery carries over:

- **The roll:** every booster slot rolls rarity, frame, holo and Full Art
  independently (`DROPS` in `src/config/rules.ts`). Full Art is 0.25%, about
  one pull in 45 packs, and stacks with the frame and holo rolls.
- **The save:** `CardVariant.fullArt` is the third segment of the variant key
  (SaveData v20 to v21, with a real `migrate()`). An Animated printing changes
  that key again, so it needs a save bump and a migration.
- **The economy:** Full Art shards at ×25 and never auto-melts. **Premium Draft
  packs exclude the axis permanently**, because including it reopened the
  shard-farm exploit (measured 2026-07-17). Animated would follow both rules.
- **The render:** `CardView.setCard({ fullArt: true })` cover-fits the art to
  the whole frame. An Animated printing is presumably a Full Art printing
  whose art moves (see the open questions).

## The two hard parts

### 1. Perfect loops

A loop is perfect when its last frame flows into its first with no visible
jump. There are three ways to get one, from cheapest to richest:

- **(A) Procedural motion over the still art ("living art").** The shipped
  640×800 image stays the only picture. A small per-card **motion map**
  says what moves and how: a depth map for parallax, and masks for hair,
  cloth, fire, water, glow and particles. The motion is driven by periodic
  functions in a shader, so **every loop is perfect by construction**: there
  are no frames to stitch.
  - **Limit:** the motion is subtle (sway, shimmer, drift, flicker, a slow
    parallax push). Nobody blinks or turns her head.
  - **Generation:** the depth map comes from a depth-estimation model; the
    masks come from segmentation plus a hand-check, which is a prompt and
    QA job like today's art bible.
- **(B) Generated video loops.** An image-to-video model animates the still
  art, conditioned so the last frame matches the first. A loop-closure check
  (frame difference between the end and the start, plus optical flow) accepts
  or rejects each take, and a short cross-fade hides a near-miss.
  - **Richer motion**, but each card is a generation lottery, like the art
    runs; faces and hands can drift, and every take needs the owner's eyes.
- **(C) Both.** (A) for every Animated printing, and (B) for a small curated
  chase set (for example the Ultra Rares of a featured set).

### 2. Storage

The numbers today (2026-10-02):
- the shipped card art is 1,707 WebP files, 249 MB, 147 KB each on average;
- the repository's git history is already 1.21 GB;
- the 2.0 itch.io launch has hard limits: **500 MB per game, 1,000 files and
  200 MB per file**. That is why 1.9's art streaming ships the art in
  range-read pack files ([plan-art-streaming.md](plan-art-streaming.md)).

What each approach costs, per card, as estimates to be measured in the pilot:

| Approach | Per card | Every card (~1,650) | Notes |
| --- | --- | --- | --- |
| (A) motion maps | about 20-60 KB (a depth map plus a packed mask image) | about 35-100 MB | fits the itch budget; packs like the art |
| (B) video, AV1/WebM, 2-4 s at 480×600 | about 300-800 KB | about 0.5-1.3 GB | does not fit for every card |
| (B) animated WebP | about 2-5 MB | several GB | ruled out |

What follows:
- **(B) can't cover every card on itch.** It has to be a curated subset, or
  stream from somewhere other than the game's itch ZIP.
- **Video must not enter git history.** Every committed binary stays in the
  public repository's history forever. The masters (generated takes, frames)
  live outside the repository, like the art pipeline's raws today. If (B)
  ships, the shipped encodes need a home decided first: Git LFS, release-asset
  packs fetched at build time, or the repository as today, which only (A)'s
  small maps can afford.
- **The pipeline keeps finals only.** Intermediate frames are deleted once a
  take is accepted, and the accepted master is backed up outside the
  repository.

## Playing it

- **Runtime cost:** only the cards a player is looking at need to move. The
  pack-opening reveal, the zoomed or inspected card, and the Showcase animate.
  The binder, the deck list and the duel board show the first frame, or
  animate only a capped few. This fits 1.9's art store, with its leases and
  memory budget.
- **Reduced motion:** the Animations setting (off, reduced, full) and the
  system's reduced-motion preference show the still art. Animated printings
  must never be the only way to see a card.
- **Platforms:** (A) is a WebGL shader and runs wherever the game runs. (B)'s
  codec support differs (AV1 needs hardware decode on Safari; WebView2 on the
  desktop app supports it), so (B) also needs a fallback encode.

## Open questions (for the owner, when this is scheduled)

1. **The motion style:** (A) living art over the still, (B) generated video,
   or (C) both. Recommendation: **(C), starting with (A).** (A) solves both
   hard parts by construction. A pilot of about 5 cards answers whether its
   subtle motion is special enough before any video is generated.
2. **Which cards can come Animated:** every card, or a curated set (for
   example Ultra and Super-Super Rares, or a featured set at each launch).
3. **The axis:** an Animated printing as the top step of the Full Art axis
   (standard, Full Art, Animated), or a fifth independent roll that stacks
   with Full Art. It also needs a drop rate below 0.25% and a shard
   multiplier above ×25, each set by the economy gates' Monte Carlo, the way
   Full Art's were.
4. **Where the shipped files live,** if (B) ships: Git LFS, release-asset
   packs, or a curated set small enough for the repository.

## What it does not change

- No card's rules, cost or rarity. Animated is a printing, like a frame or a
  holo, never gameplay.
- The still art stays the source of truth for every card, and the art bible's
  rules (no long necks, the house rules) apply to every moving frame.
- Premium Draft packs exclude it, as they exclude Full Art.
