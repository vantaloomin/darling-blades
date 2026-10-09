<!-- source-of-truth: scripts/showcase-match.ts, scripts/showcase-capture.mjs, src/dev/showcase.ts, trailer/ · last-verified: 2026-10-09 -->

# Trailers and showcase footage

Trailer footage is real gameplay, filmed from a seeded AI-vs-AI duel the dev server plays back full screen. Because the engine is deterministic, the same seed gives the same game every time, so any shot can be retaken. The footage is then cut into a video with [HyperFrames](https://github.com/heygen-com/hyperframes) (Apache 2.0), which renders HTML and GSAP animation to MP4.

Nothing here ships in the game. The showcase page is dev-server only, and the footage, renders and copied art are gitignored.

## 1. Find a good match

```
npx tsx scripts/showcase-match.ts --a darlings:darlings-hel --b avatar:the-marsh-mother --format darlings --seeds 40 --name hel-vs-marsh
```

This plays 40 seeded games of the pairing (Hard AI on both seats unless a side says otherwise) and scores each one. A good showcase is one seat 0 wins, in 12 to 24 turns, with high-rarity casts, Darling casts, creatures trading in combat, and a close finish. The best game is saved as a replay log at `showcase/<name>.json`, after the script replays it once the way the duel screen will.

- Sides use the same grammar as `scripts/action-log.ts`: `starter:`, `theme:`, `avatar:`, `darlings:`, `persona:` or `greedy:`, with an optional `@easy`, `@medium` or `@hard`.
- Seat 0 (`--a`) is the side the camera follows, so its hand is face up.
- `--seed N` saves that seed's game instead of searching.
- `--deck-name "..."` overrides the name shown under the hero's portrait. It defaults to the precon's, deck's or avatar's name.
- A log stops replaying once any card definition changes, because replays check a card-database stamp. Regenerate logs after card edits; they are never committed.

## 2. Watch or film it

With `npm run dev` running, open `http://localhost:5173/?showcase=hel-vs-marsh`. The duel plays itself with no replay bar or exit button.

- `&speed=2` halves the pause between actions.
- `&scale=1.5` (the default) renders at 1920x1080, and `&scale=2` renders at 2560x1440.

To record it, run:

```
node scripts/showcase-capture.mjs --name hel-vs-marsh
```

This opens the page in headless Chrome or Edge and waits until the board is built. It then stops the game's own loop and steps it one fixed frame at a time, taking a screenshot of each. Every timer and tween in the duel runs on Phaser's clock, so the result is a smooth 60 fps MP4 at `showcase/<name>.mp4` however slowly the machine draws.

- On a cloud box with no GPU this runs at about 3 frames a second.
- A gaming PC is far faster.
- `--fps 30` halves the work.
- `--realtime` records the live screen instead, at whatever rate the machine paints.
- The game's audio is not recorded. Trailer music and sound are laid on in the edit.

OBS on a headed browser window (`--headed`, or the page opened by hand) also works.

## 3. Cut the trailer

Each trailer is a HyperFrames project under `trailer/`. The first one is `trailer/teaser`, a 30-second cut built from:

- three gameplay shots with captions;
- a title card with a fan of card art;
- a five-card flip reveal;
- an end card that names the site.

```
cd trailer/teaser
npm install                 # GSAP, used by the composition
node prepare.mjs --footage showcase/hel-vs-marsh.mp4
npm run check               # lint, runtime, layout and contrast checks
npx hyperframes@0.8.143 render --output renders/teaser.mp4
```

`prepare.mjs` copies the card art, scene art, fonts and footage that the composition uses into `assets/`. Each gameplay shot picks its moment with `data-media-start` (seconds into the footage), so a new recording usually needs those three numbers retuned and nothing else.

Rendering needs Chrome and FFmpeg. `npx hyperframes doctor` checks both, and `npx hyperframes browser ensure` fetches the headless Chrome it prefers.

## Copy and claims

- Every on-screen claim must be true of the shipped game: card and set counts from `README.md`, the Gauntlet's rung count, the URL.
- Check those numbers again before rendering a trailer for a new release.
- Steam's own advice is to show gameplay within the first few seconds and to assume a muted autoplay. That is why the teaser opens on the board and every caption reads without sound.
