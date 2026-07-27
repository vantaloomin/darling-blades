<!-- source-of-truth: docs/roadmap.md, docs/design-system.md, docs/architecture.md, src/meta/SaveManager.ts, src/scenes/SettingsScene.ts, src/ui/theme.ts, src/ui/CardView.ts, src/ui/BoardCardView.ts, src/ui/rulesText.ts, src/data/cardTypes.ts, src/data/catalog.ts · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Accessibility wave and localization decision brief

## Goal

Release 1.7 ships accessibility wave 1: redundant mana and rarity cues that do not rely on color alone, player-selectable text scaling, a high-contrast presentation option, and a verified interaction/readability audit across core scenes. The same milestone makes an explicit localization decision no later than 2026-08-15, or before Story Mode script production starts, whichever comes first, so 1.8 either builds the chosen scaffold or deliberately remains English-only.

## Non-goals

Accessibility wave 1 does not claim a formal compliance certification, full screen-reader operation inside Phaser, portrait mobile support, remappable controls, full motion/audio accessibility, or a translated language. The localization decision does not pretend translation is only a string-replacement task, and it does not commit to a language, vendor, or schedule without pricing the card, story, font, layout, and QA scope.

## Player-facing spec

Settings gains an `Accessibility` group:

- `Text size`: `Standard`, `Large`, `Largest`
- `High contrast`: `Off`, `On`

Mana identity always uses both a pip shape/sigil and color. Rarity always uses the established set-mark shape plus fill, and any textual card/detail surface writes the tier name. Marks, selection, legal targets, damage, warnings, and focus states use at least one non-color cue such as outline, icon, pattern, label, or motion-independent state. No player must distinguish red from green to make a legal choice.

Changing text size previews immediately and relayouts the current scene. It scales semantic UI type, help, rules, and dialogue text without scaling the entire game canvas or making cards physically larger. If content no longer fits, the surface reflows, pages, or scrolls; it does not shrink back secretly. High contrast strengthens foreground/background and focus separation while preserving card art.

Player-facing Settings copy:

> Text size changes menus, rules, and story text. Card art and battlefield size stay the same.

The localization decision has three honest outcomes:

| Option | What it commits to | Cost now | Cost later |
| --- | --- | --- | --- |
| A. English-only | Keep authored English strings and state that 2.0 has no localization promise. | Lowest engineering and editorial cost. Accessibility still needs long-text tests. | Highest retrofit risk after Story Mode and more sets add thousands of strings. |
| B. Catalog-ready English at 1.8 | Route UI, rules templates, cards, and Story text through stable keys; ship English, pseudo-locale, formatter, and fallback fonts. | Medium engineering, extraction, key governance, layout, and test-fixture cost. No translation vendor yet. | Translation remains a separate content and QA project, but architecture and overflow defects are found early. |
| C. Full second locale at 1.8 | Do Option B plus translate and review the approved content scope. | Highest immediate translation, terminology, font, build-size, layout, editorial, and platform QA cost. Requires language and vendor/community decisions. | Ongoing every-set and every-story localization cost, with the smallest retrofit debt. |

**Recommendation:** Option B. It buys reversibility before the large Story Mode corpus without implying a translated release.

## System touchpoints

### Engine

Rules behavior does not change. Engine types, actions, events, and card definitions keep stable internal identifiers rather than localized display strings. Never parse player-visible text to determine a rule. Redundant cues and text scaling are UI projections of the same deterministic state.

If localization proceeds, rules wording remains a pure formatting layer in `src/ui/rulesText.ts` or a new pure catalog formatter; effect resolution never imports locale resources. Engine purity and seeded determinism remain unchanged.

### Meta, save, and economy

`src/meta/SaveManager.ts` persists accessibility preferences and normalizes invalid values. No price, reward, or collection rule changes. If localization is Option B or C, locale preference belongs in settings in the 1.8 schema step, while platform default detection is only the fresh-save default. Save/export uses stable IDs, never translated names.

Text catalogs should separate UI chrome, parameterized rules templates, card name/flavor, story dialogue, and user-authored deck names. Deck names are never translated. Dates and numbers use an explicit formatter; gold values remain numeric data until display.

### AI

No brain changes. AI consumes stable `CardDef` data and `PlayerView`, not rendered colors, names, or localized rules strings. Accessibility visuals must not alter hit regions or legal-action computation. If a translated card name changes sort order, the collection sorter receives a display-name accessor without changing AI/data identity.

### UI scenes

`src/scenes/SettingsScene.ts` owns the controls. `src/ui/theme.ts` or a new pure typography resolver maps the persisted setting to semantic tokens. Audit every scene and shared UI primitive for local literal `fontSize`, color-only state, clipping, missing focus/selection distinction, and fixed-height copy. `src/ui/CardView.ts` and `src/ui/BoardCardView.ts` need special review because they contain local type sizes and dense rules surfaces.

Option B/C adds an `src/i18n/` catalog, typed keys, English bundle, pseudo-locale, interpolation/plural/date helpers, and font fallback metadata. Phaser scenes request strings through one injected service; data remains serializable and browser-free. Story dialogue data references stable text keys or language bundles according to the chosen authoring workflow.

### Tooling and invariants

Add contrast-token checks, color-cue screenshot/proof fixtures, text-scale layout fixtures, keyboard/touch focus tests, and a static audit for player-visible hardcoded strings if localization is chosen. Pseudo-locale expands text and exposes missing keys. Tests cover all three sizes and both contrast states. Pure engine/AI/data/meta boundaries remain free of Phaser/browser APIs; AI reads only `PlayerView`; tests do not import Phaser; schema additions migrate and test; balance floors only ratchet.

## Save-schema impact

Accessibility wave 1 requires the next available version and adds exactly:

```ts
settings: {
  // existing settings remain
  textScale: 1 | 1.15 | 1.3;
  highContrast: boolean;
};
```

Migration sets `textScale: 1` and `highContrast: false`. Normalization accepts only the three literal scale values and a boolean, falling back safely. If this lands in the same schema train as Story Mode, combine the additions in one migration step rather than bumping twice.

There is no color-vision-mode field in the recommended design because critical mana/rarity/legal-state redundancy is always on. A mode toggle would create untested unsafe combinations.

If localization Option B or C is approved for 1.8, add:

```ts
settings.locale: string;
```

Migration sets the installed English locale, such as `en`, for existing saves. Fresh saves may choose from platform preference only when a complete supported bundle exists. Unknown or removed locale values fall back to English without rewriting authored names. If Option A is chosen, no locale field or scaffold is added.

## AI and balance impact

No gameplay remeasure is expected. The gates are perceptual and geometric: every critical state has a redundant cue, every core scene remains operable at 1.3 scale, and high contrast preserves state distinction. Contrast ratios, clipped nodes, missing cue counts, and supported-layout results are `TO MEASURE` with a proposed visual audit command such as `npx tsx scripts/accessibility-audit.ts --scenes all --scales 1,1.15,1.3` plus human color-vision simulation review.

Run avatar/floor matrices only if interaction refactoring touches action dispatch or Duel UI logic:

```text
npx tsx scripts/balance-matrix.ts --avatars --seeds 40
npx tsx scripts/balance-matrix.ts --floors --seeds 80
```

Progression simulation and the metagame sweep are not feature gates because prices, rewards, cards, and AI strategy do not change. The measured 4.61x metagame speedup has no accessibility meaning.

## Phased implementation plan

### Wave 1: semantic cue and type audit

Inventory every critical color-only state and literal UI type size, define token/semantic replacements, add save fields/migration, and build proof fixtures before broad scene edits. Verification: focused setting/theme tests, contrast calculations for tokens, migration tests, build, full Vitest, lint, docs.

### Wave 2: core accessibility implementation

Apply always-on redundant mana/rarity/legal cues, text-scale tokens, high contrast, and reflow to Main Menu, Play, Duel, Deck Builder, Collection, Shop, Settings, Profile, and shared overlays. Verification: all scale/contrast fixture matrix, keyboard/touch interactions, build, full Vitest, lint, human simulated color-vision and clipping review.

### Wave 3: Story and long-tail scenes

Cover Story, Limited, Pack Opening, Achievements, Glossary, Tutorial, dense cards, and error/empty states. Fix shared primitives rather than scene-specific shrink hacks. Verification: pseudo-long English strings even if Option A wins, real device/mobile-landscape pass, full Vitest, build, lint, docs.

### Wave 4: execute the localization decision

By 2026-08-15 or before Story script production, record A, B, or C. For B/C, build typed catalogs, English extraction, pseudo-locale, formatter, fallback font, and missing-key gates for 1.8. For C, do not start translation until language and content scope are approved. Verification: catalog completeness, pseudo-locale screenshots, stable-ID save/replay tests, font/license review, full Vitest, build, lint, docs.

## Open decisions for the user

- **Localization direction by 2026-08-15:** A English-only, B catalog-ready English, or C full second locale. **Recommendation:** B.
- **Translation scope if C:** UI only; UI plus rules/card names; or UI, full cards, and Story. **Recommendation:** full player-visible scope if a locale is advertised; partial card/story localization creates a confusing product.
- **Second language if C:** choose only after audience, font coverage, translator availability, and platform demand are reviewed. **Recommendation:** make no language promise in this design doc.
- **Text scale values:** keep 100/115/130 percent, or choose a different three-step range after fixtures. **Recommendation:** start with these three and adjust before schema lock if 130 percent cannot reflow cleanly.
- **High contrast scope:** UI chrome only or include card frames/effects. **Recommendation:** UI chrome, text backplates, focus, and rules state; preserve authored card art while adding readable overlays.
- **Color cue policy:** always-on redundancy or selectable vision profiles. **Recommendation:** always-on redundancy for critical information, with no profile matrix in wave 1.

## Risks and dependencies

Scaling a fixed 1280x720 canvas can expose hardcoded heights, and scaling only some text is worse than a coherent token system. High contrast can accidentally erase rarity or legal-state distinctions. Localization multiplies every authored surface, needs grammatical formatting rather than concatenation, and turns shipped keys into compatibility contracts. Story Mode in `docs/plan-story-mode.md` is the deadline driver. Mobile layouts in `docs/plan-mobile-overhaul.md` multiply reflow cases. Save/cloud codes in `docs/plan-save-portability.md` must persist stable IDs and the chosen settings. Coach explanations in `docs/plan-suggested-decks.md` need keyed reason templates if Option B/C wins. Mod content needs a declared locale/fallback policy in `docs/plan-mod-ugc.md`.

## Acceptance criteria

- Every mana, rarity, legal-target, selection, warning, and destructive state needed to play has a non-color cue.
- Main and long-tail scenes remain readable, navigable, and unclipped at all three text sizes and both contrast states on supported layout profiles.
- Existing saves migrate to standard text and default contrast with no other setting drift.
- Accessibility settings apply immediately and persist through reload, save export/import, and cloud sync.
- Literal UI font sizes are either justified card-internal geometry or replaced by semantic tokens.
- The localization decision is recorded by 2026-08-15 or before Story script production, with Option A, B, or C and approved scope.
- If B/C wins, all in-scope English strings have typed keys, pseudo-locale coverage, fallback fonts, and missing-key gates before 1.8.
- Human review records the still-manual color-vision, readability, focus, and clipping results; automated checks are not presented as certification.
