<!-- source-of-truth: docs/roadmap.md, docs/mobile-lan-plan.md, docs/design-system.md, docs/architecture.md, src/main.ts, src/platform/gestureCore.ts, src/platform/gestures.ts, src/platform/quality.ts, src/platform/renderScale.ts, src/platform/animPolicy.ts, src/art/ArtResolver.ts, src/scenes/DuelScene.ts, src/scenes/DeckBuilderScene.ts · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Complete mobile UX overhaul implementation plan

## Goal

Release 1.8 makes every supported player journey comfortable on a real phone in landscape, building on the Tier 1 LAN/mobile foundation that already ships. The overhaul replaces desktop composition squeezed into 1280x720 with explicit compact-landscape layouts, touch-first information hierarchy, stable gestures, safe-area handling, and measured performance across an approved device/browser matrix.

## Non-goals

The recommended 1.8 scope does not add portrait gameplay, native app-store distribution, LAN or internet multiplayer, a second rules implementation, or lower-resolution rules text. It does not rewrite the already-shipped gesture recognizer, rotate overlay, audio recovery, FX-lite policy, half-resolution art path, or page-hide save flush without a measured defect. It also does not call desktop browser resizing a real-device pass.

## Player-facing spec

On a supported phone held in landscape, Main Menu, Play, Duel, Collection, Deck Builder, Shop, Pack Opening, Limited, Story, Profile, Settings, Glossary, Achievements, and all overlays fit the safe viewport without browser chrome hiding required controls. Full-width buttons retain the established 90 by 44 design-pixel floor, and compact icon controls retain at least 44 by 44. No required action depends on hover.

The current gestures remain consistent: a short steady press activates, a held press opens details, and a drag scrolls or moves only on surfaces that advertise it. The established recognizer values, including a 250 ms tap window, 10 design-pixel slop, and 450 ms long press, are changed only from observed device evidence. A dead-zone release never casts or confirms accidentally.

Duel uses a compact profile rather than shrinking all desktop objects. The current phase and primary action stay reachable by the playing thumb; the battlefield remains the focus; hand browsing can expand temporarily; graveyard, Sever, history, help, settings, and concede live behind labeled secondary controls. Targeting, Foresee choices, marks, and stack responses use large, explicit states. Opening card detail never fires the card action beneath it.

List scenes use paging or bounded scrolling, sticky high-value controls, and full-width search/filter affordances. Dense dialogs become pages or sheets rather than tiny text. Portrait orientation continues to show a simple rotate message if the user accepts the recommendation below.

## System touchpoints

### Engine

No rules or game-state changes. Mobile input resolves to the same typed actions as mouse/keyboard input, and the engine remains unaware of device class, orientation, pointer count, safe areas, art tier, or render scale. Seeded determinism and headless purity remain exact.

### Meta, save, and economy

No new economy behavior. Purchase, shard, crafting, reward, and deck mutations keep the same confirmation and transaction services. Page-hide and visibility transitions retain the existing save flush behavior. Layout selection is derived from viewport/safe-area/input capabilities rather than persisted, so rotating or moving the same save between devices cannot strand it in a bad profile.

If the overhaul adds an explicit player override such as `Prefer compact layout`, that requires a separately approved setting and schema migration; it is not part of the recommended automatic model.

### AI

No brain changes. UI animation, frame rate, and touch timing cannot feed AI seeds or action choice. AI continues to receive only `PlayerView`. Refactoring Duel controls must preserve action IDs and seat checks; add regression tests where a touch action and desktop action produce the same engine command.

### UI scenes

Introduce a pure layout contract under `src/ui/layout/`, for example:

```ts
type LayoutProfile = 'wide' | 'compact-landscape' | 'short-landscape';

interface ScreenMetrics {
  width: number;
  height: number;
  safeTop: number;
  safeRight: number;
  safeBottom: number;
  safeLeft: number;
  touch: boolean;
}
```

Shared scene header/footer, modal, pager, search, tabs, card grid, and button primitives consume the resolved profile. Scenes define profile-specific composition through pure geometry helpers, not scattered `isMobile` offsets. `src/scenes/DuelScene.ts` is its own high-risk workstream because its board, hand, stack, history, prompts, and overlays interact. `DeckBuilderScene`, `CollectionScene`, `ShopScene`, `PackOpeningScene`, Story, and Limited need separate dense-surface proofs.

### Tooling and invariants

Keep `src/platform/gestureCore.ts` pure and unit-tested, with `src/platform/gestures.ts` as the Phaser adapter. Preserve quality/render/animation policy boundaries. Add deterministic layout fixtures for approved viewports and safe-area insets, automated hit-target checks, overlay exclusivity checks, screenshot probes, touch replay tests, and a real-device QA sheet. Never `setInteractive` on a scaled Container. No Phaser/browser APIs enter engine/AI/data/meta/config; tests do not import Phaser; save changes migrate if any; no balance floor is lowered.

## Save-schema impact

No schema bump and no new field are planned. Existing render scale, animation, audio, and related settings continue to migrate through `SaveManager`; device quality and layout profile remain derived runtime policy. Migration sketch: `none`.

If the user chooses a persistent override, add exactly `settings.layoutPreference: 'auto' | 'wide' | 'compact'` in the next available schema, default existing and fresh saves to `auto`, and test invalid-value normalization. Do not persist raw viewport dimensions or safe-area insets.

## AI and balance impact

Gameplay is intended to be identical. The key automated invariant is that equivalent touch and desktop commands yield the same action log and result. Run AI gates only after Duel input/session refactors, not because pixels changed:

```text
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
```

Progression and metagame sweeps are not mobile-layout gates. The measured 4.61x Node metagame speedup says nothing about phone performance.

Performance budgets are `TO MEASURE` on the approved device/browser matrix. Add a repeatable probe such as `npx tsx scripts/mobile-perf-report.ts --fixtures duel,collection,pack --duration <S>` backed by browser traces, and publish frame-time distribution, peak memory where available, scene transition time, art decode failures, input latency, and crash/reload observations. Do not invent a minimum device or frame target before the user approves the support matrix.

## Phased implementation plan

### Wave 1: profiles, primitives, and device baseline

Choose the support matrix, capture current real-device failures, add ScreenMetrics/profile resolution, safe geometry, hit-target assertions, and shared compact primitives. Do not migrate scenes yet. Verification: pure geometry/gesture tests, viewport fixture matrix, production build, full Vitest, lint, docs, and baseline traces on every approved device.

### Wave 2: navigation and list scenes

Migrate Main Menu, Play, Practice, Collection, Deck Builder, Shop, Profile, Settings, Achievements, and Glossary to profile-based composition. Each scene is independently shippable behind compact-layout selection. Verification: screenshot/hit-target/overlay checks per scene, search/paging/scroll touch scripts, build, full Vitest, lint, accessibility text-scale matrix, real-device pass.

### Wave 3: Duel and high-risk gameplay overlays

Implement compact Duel composition and audit phase, hand, targeting, stack response, Foresee, marks, history, card detail, results, replay, and tutorial states. Verification: engine-command equivalence, gesture dead-zone/long-press tests, every Duel state screenshot, replay-mode no-side-effects, avatar/floor matrices, build, full Vitest, lint, extended real-device sessions.

### Wave 4: spectacle, Story, and release hardening

Migrate Pack Opening, Limited flows, Story, reward reveals, credits, and rare overlays; tune quality policy only from measurements; close the real-device issue ledger. Verification: performance traces, page-hide/reload, audio interruption, orientation/safe-area/browser-chrome transitions, full Vitest, build, lint, docs, and signed human QA matrix.

## Open decisions for the user

- **Portrait scope:** block with rotate guidance or build portrait layouts. **Recommendation:** landscape-only for 1.8; portrait multiplies every Duel and dense-card constraint.
- **Support matrix:** define the oldest iPhone/Safari, Android/Chrome, tablet, and desktop-touch targets. **Recommendation:** approve a small named matrix before Wave 1; do not use a generic `mobile` label.
- **Installation:** browser/LAN only, installable PWA, or native store package. **Recommendation:** browser-first overhaul; treat PWA/offline install as a separate spike and native stores as separate product work.
- **Layout override:** automatic only or a saved compact/wide preference. **Recommendation:** automatic only unless tablet testing shows a recurring misclassification.
- **Duel hand interaction:** tap-to-expand fan, horizontal tray, or paged hand. **Recommendation:** prototype fan and tray on real phones, then choose from mis-tap and readability evidence.
- **Performance target:** choose frame-time and memory floors only after baseline traces. **Recommendation:** set ratcheting targets from the weakest supported device, not the developer desktop.

## Risks and dependencies

The fixed virtual canvas encourages local offsets that work at one aspect ratio and fail under safe areas or browser chrome. Duel has overlapping gestures and scaled containers, making accidental actions the highest risk. Text scaling can invalidate compact layouts, while larger sets increase memory/art pressure. This plan depends on `docs/plan-accessibility-i18n.md` for semantic text and contrast, `docs/plan-story-mode.md` for dialogue/map surfaces, and `docs/plan-save-portability.md` for mobile clipboard/account flows. Variant slot picking in `docs/plan-variant-decks.md`, replay sharing in `docs/plan-player-replays.md`, and Tutor worker UX in `docs/plan-suggested-decks.md` all require compact layouts. Multiplayer in `docs/plan-multiplayer.md` must consume these primitives rather than create a third layout system.

## Acceptance criteria

- Every shipped scene and overlay has an approved compact-landscape layout with no required control outside safe bounds.
- All primary touch controls meet the established target floors, and no required interaction depends on hover, right click, or precision drag.
- Tap, long press, scroll/drag, modal capture, and dead-zone behavior are consistent and have no duplicate activation.
- Equivalent touch and desktop action sequences produce identical engine action logs and results.
- Portrait behavior matches the recorded user decision and never exposes a half-usable gameplay scene.
- Real-device performance `TO MEASURE` values and support targets are published, then met on every approved device/browser pair.
- Page hide, resume, audio interruption, rotation, safe-area, browser chrome, clipboard fallback, and offline/reload paths are verified.
- Human QA records each scene, device, orientation, text size, and unresolved visual issue separately from automated pass results.

