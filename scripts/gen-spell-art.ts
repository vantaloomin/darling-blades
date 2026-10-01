/**
 * Generates real card art for the 417 non-creature SPELL/ARTIFACT/LAND prompt
 * entries: the 85 primary entries (18 instants, 16 sorceries, 10 enchantments,
 * 1 artifact, + 9 Ragnarök spells/runes, + 31 Gothic Monsters
 * charms/rituals/enchantments/artifacts), plus eight removal-answer records,
 * seven 1.6 returning-mechanics sprinkle spells, five Duat lands, two Wave B
 * support spells, seven Wave C spells, 26 Wave D1 non-creatures, and 24 Wave D2
 * non-creatures, 20 Wave D3 non-creatures, 20 Dark Tales companion spells,
 * 62 Starborne non-creatures, 97 Drowned Deep non-creatures, six regeneration
 * entries, and 48 First Dawn non-creatures. Prompts
 * live in docs/spell-art.md; the
 * chatgpt-imagegen CLI is backed by the user's ChatGPT
 * subscription — see the `anthropic-skills:chatgpt-imagegen` skill), then
 * post-processes each image to the exact 640×800 WebP deliverable
 * (docs/art-bible/index.md §1) at `public/assets/art/cards/<card-id>.webp` — the
 * same directory and dimensions as the creature art, so the manifest and
 * ArtResolver auto-pick these up with no code change. Existing WebPs are skipped,
 * so the run is idempotent and resumable.
 *
 * This mirrors scripts/gen-card-art.ts's hardened machinery exactly (temp-file
 * writes, raw-original reuse, Pillow preflight, 3-consecutive-failure abort,
 * win32 CLI fail-fast) with one deliberate composition difference: spells are
 * effect/moment SCENES, not character portraits. PREAMBLE therefore centers the
 * effect in the ART_RECT band; FIGURE_PREAMBLE pulls First Dawn's woman entries
 * back to head-to-knees while keeping the effect itself the hero.
 *
 * Each generation prompt is assembled as [SPELL/EFFECT PREAMBLE] + [entry Prompt
 * line] + [NEGATIVES]. Inspect the exact text with --show-prompt.
 *
 * NOTE: not yet wired into package.json — run directly:
 *   npx tsx scripts/gen-spell-art.ts [--only id1,id2] [--limit N]
 *                                    [--dry-run] [--show-prompt] [--force] [--cli <path>]
 *   npx tsx scripts/gen-spell-art.ts --recrop <file> [--out-dir <path>]
 *   npx tsx scripts/gen-spell-art.ts --spec <file> --out-dir <path> [--only ...]
 *
 *   --spec <file>     read prompts from this draft file instead of
 *                     docs/spell-art.md and skip the 417-id roster check (a set
 *                     with no card data yet, such as the First Dawn pilot);
 *                     requires --out-dir
 *   --out-dir <path>  write the WebPs here instead of public/assets/art/cards
 *                     and skip gen-art-manifest; must lie outside public/
 *   --only a,b        only these card ids
 *   --limit N         generate at most N images this run (skips don't count)
 *   --dry-run         list what would generate, touch nothing
 *   --show-prompt     print the fully assembled prompt (preamble + entry +
 *                     negatives) for every matched entry, touch nothing
 *   --force           regenerate ids whose WebP already exists
 *   --cli <path>      path to the chatgpt-imagegen python script (otherwise
 *                     $CHATGPT_IMAGEGEN_CLI, then a search of the local
 *                     skills-plugin install, then `chatgpt-imagegen` on PATH)
 *
 * The backend only supports a few sizes; we generate at 1024×1536 (nearest
 * larger portrait) and run scripts/smartcrop.py in subject mode to produce the
 * 4:5 / 640×800 deliverable. First Dawn woman entries pass `--focal-frac 0.1`;
 * all other entries keep subject mode's default crop. Raw uncropped originals
 * are kept in <tmp>/gen-spell-art/ for inspection.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { convertPngToWebp } from './convert-art-webp';
import { tmpdir } from 'node:os';
import { basename, dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = join(root, 'docs', 'spell-art.md');
const outDir = join(root, 'public', 'assets', 'art', 'cards');
const rawDir = join(tmpdir(), 'gen-spell-art');
const smartcropPath = join(root, 'scripts', 'smartcrop.py');

const OUT_W = 640;
const OUT_H = 800;
/** Nearest larger portrait size the image backend verifiably accepts (2:3). */
const GEN_SIZE = '1024x1536';
/** Per-image budget passed to the CLI (seconds) — detailed splashes can run 2–3 min. */
const GEN_TIMEOUT_S = 300;

/**
 * The 417 spell ids docs/spell-art.md must cover, in the authored order (instants
 * → sorceries → enchantments → the Jade Seal → Ragnarök → Gothic Monsters →
 * the removal answer cycle).
 * Parsing cross-checks against this
 * so a dropped or renamed entry fails loudly instead of silently generating a
 * short batch. Transcribed from src/data/cards/{instants,sorceries,enchantments,
 * artifacts}.ts (the artifact list contributes ONLY the non-creature Seal — the
 * five Construct creatures live in the creature art-bible).
 */
const EXPECTED_IDS = [
  // instants (18)
  'in-fire-attack', 'in-wild-surge', 'in-read-the-ruse', 'in-shieldwall', 'in-valley-mist',
  'in-undertow', 'in-blessed-respite', 'in-grave-chill', 'in-boar-rush', 'in-tidal-slip',
  'in-doom-bolt', 'in-char', 'in-stand-as-one', 'in-sudden-insight', 'in-skysweeper-gale',
  'in-comet-blast', 'in-reapers-due', 'in-dream-fracture',
  // sorceries (16, including W3.5b's Base Set common sweepers)
  'so-divination', 'so-rampant-growth', 'so-raise-dead', 'so-lava-axe', 'so-muster-militia',
  'so-nurture', 'so-night-extortion', 'so-creeping-malaise', 'so-flame-lash', 'so-ember-squall',
  'so-dirge-of-loss', 'so-parade-of-heroes',
  'so-strategic-planning', 'so-warcry', 'so-stampede-season', 'so-judgment-of-heaven',
  // enchantments (10)
  'en-vow-of-peace', 'en-wild-blessing', 'en-withering-curse', 'en-clouded-mind', 'en-wings-of-dawn',
  'en-battle-fervor', 'en-call-of-the-wilds', 'en-banner-of-the-hegemon', 'en-peach-garden-oath',
  'en-olympus-ascendant',
  // artifact (1)
  'ar-imperial-jade-seal',
  // Dark Tales companion wave (20), added 2026-08-21
  'dt-twelve-dancing-heiresses', 'dt-poisoned-comb', 'dt-ball-before-midnight',
  'dt-banished-from-the-ball', 'dt-casita-hearth', 'dt-drowned-library',
  'dt-laced-too-tight', 'dt-carpet-escape', 'dt-chart-the-reef-road',
  'dt-rose-thorn-parry', 'dt-hearth-blessing', 'dt-sunrise-over-the-ballroom',
  'dt-drown-the-pages', 'dt-second-verse', 'dt-frozen-to-the-floor',
  'dt-apple-half-exchange', 'dt-shadow-miners-dirge', 'dt-ember-lantern-toss',
  'dt-grandmothers-remedy', 'dt-pumpkin-shell-lantern',
  // Ragnarök expansion (9): 4 spells + the 5-rune Aura cycle (src/data/cards/ragnarok.ts)
  'rg-ragnarok', 'rg-read-the-runes', 'rg-berserkers-fury', 'rg-call-the-einherjar',
  'rg-rune-of-fury', 'rg-rune-of-the-hunt', 'rg-rune-of-hunger', 'rg-rune-of-insight',
  'rg-rune-of-warding',
  // Gothic Monsters expansion (31): 9 charms + 8 rituals + 6 enchantments +
  // 8 non-creature artifacts (src/data/cards/gothic-monsters.ts — the set's
  // artifact CREATURES live in docs/art-bible/gothic-monsters.md)
  'gm-red-moon-rampage', 'gm-silver-knife', 'gm-fogged-window', 'gm-rose-thorn-snare',
  'gm-red-curtain-cut', 'gm-moonlit-prowl', 'gm-thunderclap', 'gm-wolfbane-shot',
  'gm-midnight-bite',
  'gm-dracula-ball-invite', 'gm-stormtower-resurrection', 'gm-graveyard-waltz',
  'gm-black-lace-pact', 'gm-midnight-autopsy', 'gm-candlelit-seance', 'gm-kicked-door',
  'gm-tattered-invitation',
  'gm-nocturne-manor', 'gm-grave-rose-garden', 'gm-cathedral-of-bats', 'gm-wolfsbane-ward',
  'gm-howling-gallery', 'gm-blood-candle',
  'gm-candelabra-of-souls', 'gm-velvet-coffin', 'gm-lightning-rod-spire', 'gm-silvered-rapier',
  'gm-holy-water-vial', 'gm-cellar-door', 'gm-funeral-bell', 'gm-broken-mirror',
  // Removal answer cycle (8), added 2026-07-18: one non-creature answer per house
  // (the ninth member, bk-boarkin-rootbreaker, is a creature in the beastkin bible)
  'in-cleanse-the-shrine', 'in-ram-the-gates', 'in-empty-fort-stratagem',
  'so-the-wilds-take-it-back', 'rg-yggdrasils-verdict', 'cf-bargain-unwound',
  'ac-recant-the-vow', 'gm-hunters-writ',
  // 1.6 returning-mechanics sprinkle (7), added 2026-08-18: the wave's seven
  // non-creature cards (its three creatures live in the per-set art bibles)
  'cf-tithe-of-seasons', 'cf-salt-the-barrow', 'ac-second-muster',
  'gm-retold-by-candlelight', 'so-echos-refrain', 'so-roadside-shrine',
  'en-persephones-return',
  // Sands of the Duat Wave A dual lands (5), added 2026-08-19
  'sd-land-the-weighing-hall', 'sd-land-emberwake-channel', 'sd-land-silt-tomb-terrace',
  'sd-land-noon-barge-landing', 'sd-land-reedway-delta',
  // Sands of the Duat Wave B support (2), added 2026-08-19
  'sd-pridehall-drillmaster', 'sd-bastet-gate-chorus',
  // Sands of the Duat Wave C spells (7), added 2026-08-19
  'sd-salt-and-linen', 'sd-the-debt-is-called', 'sd-noon-judgment', 'sd-two-harvests',
  'sd-hollow-the-chest', 'sd-sealed-doorway', 'sd-empty-every-jar',
  // Sands of the Duat Wave D1 non-creatures (26), added 2026-08-19; one reviewed
  // river-crossing card was cut and is intentionally absent from this roster.
  'sd-the-offering-table', 'sd-altar-of-the-fourth-hall', 'sd-resin-archive',
  'sd-natron-vault', 'sd-scale-weight', 'sd-reed-bound-canopic', 'sd-empty-heart-jar',
  'sd-tomb-seal', 'sd-lapis-funerary-mask', 'sd-censer-of-the-last-gate',
  'sd-lion-gate-standard', 'sd-tollgate-of-the-fourth-hall', 'sd-canopic-cartouche',
  'sd-barge-fire-brazier', 'sd-flood-measure-vessel',
  'sd-natron-crowned-canopic', 'sd-heart-scale-reliquary',
  'sd-hena-who-rows-against-the-hour',
  'sd-name-the-gate', 'sd-procession-halt', 'sd-weigh-the-room', 'sd-strike-the-lintel',
  'sd-stop-the-procession', 'sd-marked-at-the-gate', 'sd-the-hall-clears',
  'sd-the-gate-is-closed',
  // Sands of the Duat Wave D2 non-creatures (24), added 2026-08-19
  'sd-read-the-two-ways', 'sd-take-the-slow-channel', 'sd-hold-the-crossing',
  'sd-silt-reading', 'sd-row-against-the-hour', 'sd-channel-turns-back',
  'sd-book-of-the-two-ways', 'sd-wrong-door', 'sd-sand-through-the-grate',
  'sd-the-book-opens-twice', 'sd-read-the-sky-over-the-barge',
  'sd-the-map-argues-back', 'sd-river-returns-the-answer', 'sd-the-last-chart-of-the-duat',
  'sd-pay-before-the-asking', 'sd-cut-the-wrappings', 'sd-two-jars-one-heart',
  'sd-wrapped-against-the-season', 'sd-one-clean-cut', 'sd-second-wrapping',
  'sd-silence-after-the-verdict', 'sd-verdict-under-resin', 'sd-the-long-drying',
  'sd-the-weight-owed-in-full',
  // Sands of the Duat Wave D3 non-creatures (20), added 2026-08-19
  'sd-burn-the-rope', 'sd-flame-beneath-the-pan', 'sd-light-the-wake',
  'sd-prowfire-volley', 'sd-warcry-at-noon', 'sd-break-the-coil',
  'sd-ember-signal', 'sd-fire-along-the-barge', 'sd-run-the-deck',
  'sd-noon-serpent-judgment',
  'sd-give-the-field-its-due', 'sd-measure-the-silt', 'sd-root-through-the-ruin',
  'sd-ward-the-floodgate', 'sd-harvest-after-rain', 'sd-flood-before-noon',
  'sd-warding-of-the-first-furrow', 'sd-deeper-flood-channel',
  'sd-granary-of-rising-years', 'sd-route-beyond-the-gate',
  // Starborne non-creatures (62), added 2026-08-28 - authored from the locked
  // 151-card overplan; card data rides feat/starborne-cards, so ids are the
  // authority here until starborne.ts merges.
  'sb-prism-deflection', 'sb-orbital-cleansing', 'sb-chrome-medallion',
  'sb-cometary-verdict', 'sb-pale-nebula', 'sb-signal-inversion',
  'sb-prism-current', 'sb-relay-station', 'sb-sky-map', 'sb-deepfield-lands',
  'sb-night-market-bargain', 'sb-umbral-antenna', 'sb-corpse-lantern',
  'sb-darkside-landing', 'sb-flareburst', 'sb-solar-arc', 'sb-ignition-hymn',
  'sb-redline-salvage', 'sb-starfall-barrage', 'sb-ember-lane',
  'sb-warhead-glint', 'sb-root-of-light', 'sb-gravitic-bloom',
  'sb-orbital-graft', 'sb-overcanopy', 'sb-starborne-relay',
  'sb-null-orbit-array', 'sb-interstellar-crossing', 'sb-violet-wake-beacon',
  'sb-white-signal-bastion', 'sb-blue-echo-array', 'sb-black-starving-orbit',
  'sb-red-solar-lash', 'sb-green-propagation-chorus', 'sb-chromelight-lattice',
  'sb-pale-violet-crossing', 'sb-eclipse-docking-ring', 'sb-ember-void-rail',
  'sb-radiant-comet-lane', 'sb-aurora-reefway', 'sb-propagation-engine',
  'sb-deep-space-severance', 'sb-hullwake-overdrive', 'sb-signal-cathedral',
  'sb-propagation-choir', 'sb-starborne-apotheosis', 'sb-redline-supernova',
  'sb-halo-motherboard', 'sb-quiet-orbit', 'sb-marrow-eviction',
  'sb-signal-drown', 'sb-collapse-the-lane', 'sb-relay-bloom', 'sb-echo-burst',
  'sb-signal-recall', 'sb-void-lament', 'sb-hullsong', 'sb-bloomdrive-surge',
  'sb-overcharge-the-hull', 'sb-eclipse-tithe', 'sb-brood-communion',
  'sb-the-long-crossing',
  // Drowned Deep non-creatures (97), cut-list order (docs/spell-art.md 'Drowned Deep non-creatures')
  'dd-bell-that-will-not-ring', 'dd-tide-that-remembers', 'dd-the-lantern-watch', 'dd-wreckfire',
  'dd-gate-of-salt', 'dd-undertow', 'dd-glass-that-came-back', 'dd-kelp-cathedral',
  'dd-false-beacon', 'dd-storm-surge', 'dd-lightkeepers-oath', 'dd-widows-walk',
  'dd-lamp-lit-vigil', 'dd-last-lamp', 'dd-cold-current', 'dd-salt-in-the-wound',
  'dd-tithe-to-the-deep', 'dd-drowned-grove', 'dd-wrecker-lantern', 'dd-rite-of-the-false-beacon',
  'dd-widows-lantern', 'dd-tide-gate', 'dd-salt-ward', 'dd-what-the-lamps-saw',
  'dd-vigil-bell', 'dd-rite-of-the-salt-gate', 'dd-lamp-oil-bargain', 'dd-the-morning-count',
  'dd-still-water', 'dd-charts-of-the-drowned-coast', 'dd-bell-below', 'dd-fog-that-stays',
  'dd-drowned-ledger', 'dd-the-price', 'dd-what-the-jars-hold', 'dd-low-tide-grave',
  'dd-salt-marsh-bargain', 'dd-black-water', 'dd-what-was-promised', 'dd-reckoning-below',
  'dd-drowned-orchard', 'dd-net-full-of-stars', 'dd-marsh-road', 'dd-reef-bloom',
  'dd-old-growth', 'dd-the-marsh-remembers', 'dd-salt-fire', 'dd-lightning-on-the-water',
  'dd-rite-of-the-wreckers', 'dd-drowned-forge', 'dd-storm-front', 'dd-fire-on-the-point',
  'dd-horror-garden', 'dd-watch-and-tide', 'dd-shore-lantern', 'dd-harbour-vigil',
  'dd-drowned-chapel-bell', 'dd-salt-and-prayer', 'dd-lamp-relay', 'dd-rite-of-the-lamp',
  'dd-salt-chapel', 'dd-lamp-and-ledger', 'dd-chapel-ward', 'dd-tide-glass',
  'dd-fog-bank', 'dd-undertow-charm', 'dd-tide-that-turns', 'dd-still-harbour',
  'dd-net-of-glass', 'dd-drowned-bell', 'dd-salt-fog', 'dd-memory-of-the-drowned',
  'dd-cold-harbour', 'dd-cellar-jar', 'dd-salt-in-the-eyes', 'dd-the-deep-collects',
  'dd-tithe-of-the-wharf', 'dd-cold-bargain', 'dd-what-the-sea-wants', 'dd-black-tide-rising',
  'dd-deep-spawn-hatchery', 'dd-jar-of-eyes', 'dd-marsh-lamp-lure', 'dd-coral-graft',
  'dd-kelp-shade-swarm', 'dd-reef-lantern', 'dd-tidepool-bloom', 'dd-reef-growth',
  'dd-marsh-gate', 'dd-salt-fire-lesser', 'dd-forge-lamp', 'dd-drowned-fire-lesser',
  'dd-storm-front-lesser', 'dd-fire-on-the-water', 'dd-storm-surge-lesser', 'dd-drowned-forge-fire',
  'dd-rite-of-the-lamp-fire',
  // Regenerations 2026-09-22, authored order in docs/spell-art.md.
  'ac-mirror-of-avalon', 'ac-secret-of-avalon', 'ac-treasonous-glance',
  'cf-badb-cathas-warning', 'dt-glass-slipper-at-midnight', 'yn-hauntlink-apex',
  // First Dawn non-creatures (48), added 2026-09-29 - cut-list order (docs/spell-art.md
  // 'First Dawn non-creatures'); authored from the owner-reviewed final cut before
  // src/data/cards/first-dawn.ts lands, so ids are the authority here until it does.
  'fd-great-drum', 'fd-rise-from-tar', 'fdr-ambush-at-the-river', 'fd-fire-pit',
  'fd-ring-of-embers', 'fd-standing-stone', 'fd-obsidian-knife', 'fd-grip-of-the-old-beast',
  'fd-thunder-of-hooves', 'fdc-trial-of-first-scars', 'fd-duel-on-the-ridge',
  'fd-hurled-firebrand', 'fd-clan-hearth', 'fdr-elders-verdict', 'fd-trial-by-ember',
  'fd-meltwater', 'fd-thaw-old-bones', 'fd-ice-wall-denial', 'fd-tar-bubbles',
  'fd-swallowed-by-tar', 'fdr-ash-rite', 'fd-stampede-long-grass', 'fd-blaze-horn-charge',
  'fd-egg-of-first-dawn', 'fd-bone-totem', 'fd-spear-and-fang', 'fd-egg-clutch',
  'fdc-thick-hide-source', 'fd-challenge-the-beast', 'fd-ember-flick', 'fd-ember-tongue',
  'fd-test-of-the-hearth', 'fd-guard-the-nest', 'fd-sun-stare', 'fdr-bring-down-the-beast',
  'fd-nest-caller', 'fd-glide-wing-ambush', 'fd-glacier-memory', 'fd-cold-refusal',
  'fd-sea-lizard-wake', 'fd-ice-lens', 'fd-tar-rite', 'fd-tar-flat-grave', 'fd-tar-drowned',
  'fd-bone-whistle', 'fd-ember-pot', 'fdc-carved-tusk-hauntlink', 'fd-resin-cast',
] as const;

/**
 * Every prompt is assembled as [SPELL/EFFECT PREAMBLE] + [entry prompt] +
 * [NEGATIVES]. The preamble is carried verbatim on every prompt because a fixed
 * preamble plus tight per-entry descriptors is the main lever for cast coherence
 * in text-to-image generation (same rationale as gen-card-art's PREAMBLE).
 *
 * Composition is load-bearing and DELIBERATELY DIFFERENT from gen-card-art:
 * spells are effect/moment SCENES, not portraits, so the default composition
 * clause demands the dramatic magical action sit at the vertical center of the
 * canvas (inside the card window's visible middle band — docs/spell-art.md §2),
 * with the top and bottom reserved as atmospheric bleed. It must NOT introduce
 * character framing for an effect-only spell, and when a figure is present the
 * EFFECT remains the hero of the frame.
 *
 * First Dawn needs a second composition. Its spells mostly put a woman beside
 * the effect, and the default "exact vertical center" sentence made the model
 * draw her large and centred, with her head high. In the First Dawn bulk run,
 * after one redo, 16 of 47 spells still had the head above the card's y=179
 * head line; 11 of those were above the window top at y=138. FIGURE_PREAMBLE
 * stages those entries as pulled-back head-to-knees scenes and pairs them with
 * a figure crop. The effect-first subject text and every style byte stay the
 * same. Selection uses the entry's authored spell-art section, not its id: the
 * set spans fd-, fdr- and fdc-. Within that section only the positive authored
 * marker "EXACTLY … adult woman/women" selects figure framing. A "NO woman"
 * opening and every effect-only entry lack that marker and keep PREAMBLE.
 */
const PREAMBLE =
  // Subject: this is a spell effect scene, not a portrait (load-bearing).
  'A dramatic magic-spell effect illustration: the subject is the spell effect itself — a ' +
  'burst, bolt, aura, ward, curse, gale, resurrection, vision, or radiant blessing — not a ' +
  'character portrait. Any figure present is secondary; the magical effect is the hero of the ' +
  'frame. ' +
  // Composition (measured band — keep the focal action centered vertically).
  'Composition: the dramatic focal action sits at the exact vertical center of the canvas, ' +
  'inside the middle band, with the top and bottom of the image reserved as atmospheric ' +
  'background bleed — energy and effects may streak into the top for drama but the readable ' +
  'core of the effect stays centered. ' +
  // Cel DNA + register + scenic background (mirrors index.md §2).
  'Style: crisp cel-shaded gacha anime splash art — clean confident inked linework with ' +
  'line-weight variation, hard-edged cel shading in two to three tone steps, bright anime ' +
  'specular highlights, saturated readable colors, dramatic cinematic energy. The effect ' +
  'glows and pops off a fully rendered anime key-visual background with real depth, rendered ' +
  'slightly softer and more atmospheric than the focal magic, with a crisp rim of light ' +
  'separating the effect from the scene. The illustration is completely text-free. ';

/**
 * First Dawn's pulled-back spell scene. Reuse PREAMBLE's subject and style
 * spans so their bytes cannot drift; only the composition and anatomy
 * sentences differ.
 */
const FIGURE_PREAMBLE =
  PREAMBLE.slice(0, PREAMBLE.indexOf('Composition: ')) +
  "Composition: the spell's moment is staged as a pulled-back scene; any woman's whole " +
  'figure from the top of her head to her knees fits in the middle half of the canvas ' +
  'height, the top of her head about one third of the way down with open sky above; the ' +
  'effect and every story element sit beside her between her head and her knees. ' +
  // Anatomy and props (owner review round 1, 2026-10-01): four of the First
  // Dawn spell redraws were a missing arm, an arm not joined to the body, a
  // haftless axe and a foreshortened throw. Same sentence as gen-card-art's
  // FIGURE_PREAMBLE; PREAMBLE stays byte for byte for every other entry.
  'Anatomy: every woman has exactly two arms and two hands, both clearly attached at her ' +
  'shoulders; every weapon, shield or tool is either gripped in a hand, strapped to her, or ' +
  'resting on the ground or a surface; nothing floats in the air except fire, sparks, dust ' +
  'or a thrown missile in flight. ' +
  PREAMBLE.slice(PREAMBLE.indexOf('Style: '));

/** The authored spell-art section whose woman entries use figure framing. */
const FIGURE_GROUP = 'First Dawn non-creatures';
/** Positive figure marker; effect-only prompts may still contain negative woman/women text. */
const WOMAN_ENTRY_MARKER = /\bEXACTLY [A-Z0-9-]+ adult (?:woman|women)\b/;
const FIGURE_FOCAL_FRAC = 0.1;

/**
 * Negative block appended after the entry prompt: the NO-TEXT hard rule (extra
 * strict here — banners, seals, and oath-scrolls in this file invite stamped
 * nameplates and garbled CJK) plus the style/anatomy negatives from index.md §2.
 */
const NEGATIVES =
  ' Strictly no text of any kind anywhere in the image: no words, letters, numbers, ' +
  'nameplates, banner-text, seal-glyphs, captions, titles, logos, watermarks, signatures, or ' +
  'calligraphy panels, absolutely no CJK glyphs — banners, seals, war-standards, oath-scrolls, ' +
  'and sashes render blank or abstract-patterned, never lettered. NOT painterly, NOT ' +
  'soft-focus, NOT 3D render, NOT photorealistic, NOT a rough sketch; no flat color-wash, ' +
  'empty-gradient, or cutout-sticker background; no muddy or desaturated colors, no plastic ' +
  'skin, no same-face, no extra or melted fingers, no broken weapon geometry, no real-person ' +
  'likeness.';

// The entry Prompt line ends unpunctuated ("… 640×800 portrait"), so close the
// sentence before the negatives block.
const hasWoman = (entry: Entry): boolean => WOMAN_ENTRY_MARKER.test(entry.prompt);
const isFigureEntry = (entry: Entry): boolean => entry.group === FIGURE_GROUP && hasWoman(entry);
const cropArgsFor = (entry: Entry): string[] =>
  isFigureEntry(entry) ? ['--focal-frac', String(FIGURE_FOCAL_FRAC)] : [];
const preambleFor = (entry: Entry): string => isFigureEntry(entry) ? FIGURE_PREAMBLE : PREAMBLE;
const assemblePrompt = (entry: Entry): string => preambleFor(entry) + entry.prompt + '.' + NEGATIVES;

const PYTHON = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

// --- arg parsing ---------------------------------------------------------------

interface Args {
  spec?: string;
  only?: string[];
  limit?: number;
  recrop?: string;
  outDir?: string;
  dryRun: boolean;
  showPrompt: boolean;
  force: boolean;
  cli?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, showPrompt: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (flag: string): string => {
      const v = argv[++i];
      if (v === undefined) fail(`${flag} requires a value`);
      return v;
    };
    if (a === '--only') args.only = next(a).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--spec') args.spec = next(a);
    else if (a === '--recrop') args.recrop = next(a);
    else if (a === '--out-dir') {
      const value = next(a);
      if (value.length === 0) fail('--out-dir must not be empty');
      args.outDir = value;
    }
    else if (a === '--limit') {
      const n = Number(next(a));
      if (!Number.isInteger(n) || n <= 0) fail('--limit must be a positive integer');
      args.limit = n;
    } else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--show-prompt') args.showPrompt = true;
    else if (a === '--force') args.force = true;
    else if (a === '--cli') args.cli = next(a);
    else fail(`unknown argument: ${a}`);
  }
  return args;
}

function fail(msg: string): never {
  console.error(`gen-spell-art: ${msg}`);
  process.exit(1);
}

/** Whether `child` is `parent` or lies under it (case-insensitive on Windows). */
function isSameOrInside(child: string, parent: string): boolean {
  const norm = (value: string) => {
    const n = normalize(resolve(value));
    return process.platform === 'win32' ? n.toLowerCase() : n;
  };
  const c = norm(child);
  const p = norm(parent);
  return c === p || c.startsWith(p.endsWith(sep) ? p : `${p}${sep}`);
}

// --- spell-art.md parsing --------------------------------------------------------

interface Entry {
  id: string;
  name: string;
  group: string;
  prompt: string;
}

interface RecropEntry {
  id: string;
  scale: number;
  offsetY: number;
  tag?: string;
}

interface SmartcropResult {
  source: string;
  crop: [number, number, number, number];
  achievedScale: number;
  achievedOffsetY: number;
}

/**
 * (card-id → prompt) pairs from docs/spell-art.md, in file order. A draft
 * `path` (--spec) skips the roster check: its ids are not in EXPECTED_IDS by
 * design, and it only ever writes to an --out-dir.
 */
function parseSpec(path: string = specPath): Entry[] {
  const draft = path !== specPath;
  const content = readFileSync(path, 'utf8');
  const entries: Entry[] = [];
  let open: Entry | null = null;
  let group = '';
  for (const line of content.split(/\r?\n/)) {
    const section = line.match(/^## (.+?)\s*$/);
    if (section) {
      // Counts are documentation, not identity: "First Dawn … (48)" remains
      // the same group when its roster changes.
      group = section[1].replace(/\s+\(\d+\)$/, '');
      continue;
    }
    const heading = line.match(/^### (.+?) — `([^`]+)`\s*$/);
    if (heading) {
      open = { id: heading[2], name: heading[1], group, prompt: '' };
      entries.push(open);
      continue;
    }
    const prompt = line.match(/^- \*\*Prompt:\*\* ?(.*)$/);
    if (prompt && open) open.prompt = prompt[1].trim();
  }

  const missing = entries.filter((e) => e.prompt === '');
  if (missing.length > 0) {
    fail(`${basename(path)}: entries missing a Prompt field: ${missing.map((e) => e.id).join(', ')}`);
  }
  if (draft) {
    const ids = entries.map((e) => e.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) fail(`${basename(path)}: duplicated ids: ${[...new Set(dupes)].join(', ')}`);
    return entries;
  }

  // Cross-check against the expected ids so a dropped/renamed/reordered entry
  // fails loudly instead of silently generating a short or wrong batch.
  const seen = entries.map((e) => e.id);
  const expected = new Set<string>(EXPECTED_IDS);
  const unexpected = seen.filter((id) => !expected.has(id));
  const absent = EXPECTED_IDS.filter((id) => !seen.includes(id));
  const dupes = seen.filter((id, i) => seen.indexOf(id) !== i);
  if (unexpected.length || absent.length || dupes.length) {
    const parts = [
      absent.length ? `missing: ${absent.join(', ')}` : '',
      unexpected.length ? `unexpected: ${unexpected.join(', ')}` : '',
      dupes.length ? `duplicated: ${[...new Set(dupes)].join(', ')}` : '',
    ].filter(Boolean);
    fail(`spell-art.md roster does not match the ${EXPECTED_IDS.length} expected spell ids — ${parts.join('; ')}`);
  }
  return entries;
}

function readRecropBatch(file: string): RecropEntry[] {
  const path = resolve(root, file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`could not read recrop batch ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Array.isArray(raw)) fail(`recrop batch must contain an array: ${path}`);
  const seen = new Set<string>();
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object') fail(`recrop[${index}] must be an object`);
    const value = item as Record<string, unknown>;
    const id = value.id;
    const scaleValue = value.scale;
    const offsetValue = value.offsetY;
    const tag = value.tag;
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
      fail(`recrop[${index}].id must be a safe card id`);
    }
    if (scaleValue !== undefined && (typeof scaleValue !== 'number' || !Number.isFinite(scaleValue) || scaleValue < 1)) {
      fail(`recrop[${index}].scale must be a finite number >= 1`);
    }
    if (offsetValue !== undefined && (typeof offsetValue !== 'number' || !Number.isInteger(offsetValue))) {
      fail(`recrop[${index}].offsetY must be a finite integer number of pixels`);
    }
    if (tag !== undefined && (typeof tag !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(tag))) {
      fail(`recrop[${index}].tag must be a safe non-empty tag`);
    }
    const outputKey = `${id}\u0000${tag ?? ''}`;
    if (seen.has(outputKey)) fail(`recrop batch contains duplicate output: ${id}${tag ? `.${tag}` : ''}`);
    seen.add(outputKey);
    return {
      id,
      scale: scaleValue === undefined ? 1 : scaleValue,
      offsetY: offsetValue === undefined ? 0 : offsetValue,
      tag,
    };
  });
}

function parseSmartcropResult(stdout: string, id: string): SmartcropResult {
  const line = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) fail(`smartcrop produced no JSON output for ${id}`);
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    fail(`smartcrop produced invalid JSON for ${id}: ${line}`);
  }
  if (!raw || typeof raw !== 'object') fail(`smartcrop JSON was not an object for ${id}`);
  const value = raw as Record<string, unknown>;
  const crop = value.crop;
  const achievedScale = value.achieved_scale;
  const achievedOffsetY = value.achieved_offset_y;
  if (typeof value.source !== 'string') fail(`smartcrop returned no source for ${id}`);
  if (!Array.isArray(crop) || crop.length !== 4 || !crop.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    fail(`smartcrop returned an invalid crop box for ${id}`);
  }
  if (value.W !== OUT_W || value.H !== OUT_H) {
    fail(`smartcrop returned ${String(value.W)}x${String(value.H)} for ${id}, expected ${OUT_W}x${OUT_H}`);
  }
  if (typeof achievedScale !== 'number' || !Number.isFinite(achievedScale)) {
    fail(`smartcrop returned no achieved scale for ${id}`);
  }
  if (typeof achievedOffsetY !== 'number' || !Number.isInteger(achievedOffsetY)) {
    fail(`smartcrop returned no achieved offset y for ${id}`);
  }
  return { source: value.source, crop: crop as [number, number, number, number], achievedScale, achievedOffsetY };
}

function runRecrop(file: string, dryRun: boolean, reviewOutDir?: string): void {
  const batch = readRecropBatch(file);
  const targetDir = reviewOutDir === undefined ? outDir : resolve(root, reviewOutDir);
  if (reviewOutDir !== undefined && targetDir.toLowerCase() === outDir.toLowerCase()) {
    fail('--out-dir must be different from public/assets/art/cards for non-destructive recrop review');
  }
  if (dryRun) {
    console.log(`gen-spell-art: recrop dry run, ${batch.length} entr${batch.length === 1 ? 'y' : 'ies'}; nothing written`);
    for (const entry of batch) {
      const rawPath = join(rawDir, `${entry.id}.raw.png`);
      console.log(
        `${existsSync(rawPath) ? 'WOULD-RECROP' : 'MISSING-RAW'} ${entry.id} requested=${entry.scale} ` +
          `offsetY=${entry.offsetY}${entry.tag ? ` tag=${entry.tag}` : ''}`,
      );
    }
    return;
  }
  mkdirSync(targetDir, { recursive: true });
  const capped: string[] = [];
  const missing: string[] = [];
  const failures: string[] = [];
  let processed = 0;
  console.log(`gen-spell-art: recrop mode, ${batch.length} entr${batch.length === 1 ? 'y' : 'ies'}; generation calls: none`);

  for (const entry of batch) {
    const rawPath = join(rawDir, `${entry.id}.raw.png`);
    if (!existsSync(rawPath)) {
      missing.push(entry.id);
      console.log(`MISSING-RAW ${entry.id} requested=${entry.scale}`);
      continue;
    }
    const filename = `${entry.id}${entry.tag ? `.${entry.tag}` : ''}.webp`;
    const outPath = join(targetDir, filename);
    const tmpPath = `${outPath}.recrop.tmp.png`;
    const post = spawnSync(
      PYTHON,
      [
        smartcropPath,
        rawPath,
        tmpPath,
        String(OUT_W),
        String(OUT_H),
        'subject',
        '--margin-scale',
        String(entry.scale),
        '--offset-y',
        String(entry.offsetY),
      ],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    if (post.error || post.status !== 0) {
      rmSync(tmpPath, { force: true });
      const detail = post.error
        ? `smartcrop spawn failed: ${post.error.message}`
        : (post.stderr ?? '').trim().split(/\r?\n/).slice(-3).join(' | ');
      failures.push(`${entry.id}: ${detail || `smartcrop exited ${post.status ?? 'unknown'}`}`);
      console.log(`FAILED ${entry.id} requested=${entry.scale}`);
      continue;
    }
    try {
      const result = parseSmartcropResult(post.stdout ?? '', entry.id);
      convertPngToWebp(tmpPath, outPath);
      rmSync(tmpPath, { force: true });
      const isCapped = result.achievedScale < entry.scale * 0.97;
      if (isCapped) capped.push(entry.id);
      const status = isCapped ? 'CAPPED' : 'OK';
      console.log(
        `${status} ${entry.id} requested=${entry.scale} achieved=${result.achievedScale.toFixed(6)} ` +
          `offsetY=${entry.offsetY} achievedOffsetY=${result.achievedOffsetY} ` +
          `${entry.tag ? `tag=${entry.tag} ` : ''}source=${result.source} crop=[${result.crop.join(',')}] ` +
          `out=${outPath}`,
      );
      processed++;
    } catch (error) {
      rmSync(tmpPath, { force: true });
      failures.push(`${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`FAILED ${entry.id} requested=${entry.scale}`);
    }
  }

  if (reviewOutDir === undefined) {
    const manifest = spawnSync('npm run gen-art-manifest', { shell: true, stdio: 'inherit' });
    if (manifest.status !== 0) fail('gen-art-manifest failed after --recrop');
  }
  console.log(
    `gen-spell-art: recropped ${processed}/${batch.length}; CAPPED=${capped.length}; MISSING-RAW=${missing.length}; ` +
      `FAILED=${failures.length}`,
  );
  if (capped.length > 0) console.log(`CAPPED list: ${capped.join(', ')}`);
  if (missing.length > 0) console.log(`MISSING-RAW list: ${missing.join(', ')}`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

// --- imagegen CLI resolution -------------------------------------------------------

/** Search the local Claude skills-plugin install for the bundled CLI script. */
function findSkillCli(): string | undefined {
  const appData = process.env.APPDATA;
  if (!appData) return undefined;
  const base = join(appData, 'Claude', 'local-agent-mode-sessions', 'skills-plugin');
  try {
    for (const a of readdirSync(base)) {
      for (const b of readdirSync(join(base, a))) {
        const candidate = join(base, a, b, 'skills', 'chatgpt-imagegen', 'chatgpt-imagegen');
        if (existsSync(candidate)) return candidate;
      }
    }
  } catch {
    // no local skills install — fall through
  }
  return undefined;
}

/** argv prefix that invokes the imagegen CLI (it's a #!python script, so run it via python). */
function resolveCli(explicit?: string): string[] {
  const path = explicit ?? process.env.CHATGPT_IMAGEGEN_CLI ?? findSkillCli();
  if (path) {
    if (!existsSync(path)) fail(`imagegen CLI not found at ${path}`);
    return [PYTHON, path];
  }
  // Last resort: a PATH install (e.g. a wrapper the user set up themselves).
  // Shell-less spawnSync only resolves .exe on Windows — a .cmd/.bat wrapper
  // would ENOENT on every entry, so fail fast with instructions instead.
  if (process.platform === 'win32') {
    fail('no imagegen CLI found — pass --cli <path> or set CHATGPT_IMAGEGEN_CLI');
  }
  return ['chatgpt-imagegen'];
}

// --- generation ----------------------------------------------------------------

function generateOne(
  cliArgv: string[],
  entry: Entry,
  force: boolean,
  targetDir: string,
): { ok: boolean; error?: string; reusedRaw?: boolean } {
  const rawPath = join(rawDir, `${entry.id}.raw.png`);
  const outPath = join(targetDir, `${entry.id}.webp`);
  const tmpPath = `${outPath}.tmp.png`;
  const prompt = assemblePrompt(entry);

  // A raw original left by a previous run (its post-process failed or the batch
  // was interrupted) makes the paid generation call unnecessary — re-crop it
  // instead. --force always regenerates (that's its purpose: getting a NEW
  // image, not a re-crop of the rejected one).
  const reusedRaw = !force && existsSync(rawPath);
  if (!reusedRaw) {
    const gen = spawnSync(
      cliArgv[0],
      [
        ...cliArgv.slice(1),
        prompt,
        '-o',
        rawPath,
        '--size',
        GEN_SIZE,
        '--timeout',
        String(GEN_TIMEOUT_S),
        '--quiet',
        '--no-progress',
      ],
      { encoding: 'utf8', timeout: (GEN_TIMEOUT_S + 60) * 1000 },
    );
    if (gen.error) return { ok: false, error: `spawn failed: ${gen.error.message}` };
    if (gen.status !== 0) {
      const tail = (gen.stderr ?? '').trim().split('\n').slice(-3).join(' | ');
      return { ok: false, error: `imagegen exited ${gen.status}: ${tail || '(no stderr)'}` };
    }
    if (!existsSync(rawPath)) return { ok: false, error: 'imagegen reported success but wrote no file' };
  }

  // Write via temp + rename: an interrupted write must never leave a truncated
  // <id>.webp that skip-existing would forever treat as done (the manifest and
  // resolver trust file presence).
  const post = spawnSync(
    PYTHON,
    [smartcropPath, rawPath, tmpPath, String(OUT_W), String(OUT_H), 'subject', ...cropArgsFor(entry)],
    { encoding: 'utf8' },
  );
  if (post.status !== 0) {
    rmSync(tmpPath, { force: true });
    return { ok: false, error: `post-process failed: ${(post.stderr ?? '').trim().split('\n').pop()}` };
  }
  try {
    convertPngToWebp(tmpPath, outPath);
  } catch (error) {
    rmSync(tmpPath, { force: true });
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  rmSync(tmpPath, { force: true });
  return { ok: true, reusedRaw };
}

// --- main ------------------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.recrop) {
    if (args.spec || args.only || args.limit !== undefined || args.showPrompt || args.force || args.cli) {
      fail('--recrop cannot be combined with generation filters or --force/--cli');
    }
    runRecrop(args.recrop, args.dryRun, args.outDir);
    return;
  }
  // --out-dir in generation mode writes somewhere the game never reads and
  // skips the manifest, so a draft set's ids can never ship by accident. A
  // draft --spec must use it; the target may not lie anywhere under public/.
  const targetDir = args.outDir === undefined ? outDir : resolve(root, args.outDir);
  if (args.outDir !== undefined && isSameOrInside(targetDir, join(root, 'public'))) {
    fail('--out-dir must lie outside public/ (the game serves everything under it)');
  }
  if (args.spec !== undefined && args.outDir === undefined) {
    fail('--spec requires --out-dir (a draft spec never writes shipped art)');
  }
  const specFile = args.spec === undefined ? specPath : resolve(root, args.spec);
  if (!existsSync(specFile)) fail(`spec file not found: ${specFile}`);

  let entries = parseSpec(specFile);

  if (args.only) {
    const known = new Set(entries.map((e) => e.id));
    const unknown = args.only.filter((id) => !known.has(id));
    if (unknown.length > 0) fail(`--only ids not in ${basename(specFile)}: ${unknown.join(', ')}`);
    const wanted = new Set(args.only);
    entries = entries.filter((e) => wanted.has(e.id));
  }

  // Prompt-inspection mode: print the exact assembled prompt(s) and exit without
  // generating — review text before a batch burns quota.
  if (args.showPrompt) {
    for (const e of entries) {
      console.log(`--- ${e.id} ---`);
      console.log(assemblePrompt(e));
    }
    console.log(`gen-spell-art: --show-prompt — ${entries.length} prompt(s) shown, nothing generated`);
    return;
  }

  const exists = (e: Entry) => existsSync(join(targetDir, `${e.id}.webp`));
  const skipped = args.force ? [] : entries.filter(exists);
  let todo = args.force ? entries : entries.filter((e) => !exists(e));
  if (args.limit !== undefined) todo = todo.slice(0, args.limit);

  console.log(
    `gen-spell-art: ${entries.length} spell entr${entries.length === 1 ? 'y' : 'ies'} matched — ` +
      `${todo.length} to generate, ${skipped.length} already on disk in ${targetDir}` +
      (args.outDir !== undefined ? ' (out-dir: gen-art-manifest will not run)' : ''),
  );

  if (args.dryRun) {
    for (const e of entries) {
      const state = !args.force && exists(e) ? 'exists — skip (use --force)' : todo.includes(e) ? 'would generate' : 'beyond --limit';
      const framing = e.group === FIGURE_GROUP
        ? isFigureEntry(e)
          ? ` (figure framing: yes; crop ${cropArgsFor(e).join(' ')})`
          : ' (figure framing: no; default preamble/crop — no positive woman marker)'
        : '';
      console.log(`  ${e.id.padEnd(28)} ${state}${framing}`);
    }
    console.log('gen-spell-art: dry run — nothing generated');
    return;
  }
  if (todo.length === 0) {
    console.log('gen-spell-art: nothing to do');
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });
  const cliArgv = resolveCli(args.cli);

  // Preflight the post-processor BEFORE burning any generation quota — missing
  // Python image/detection deps would otherwise fail every entry after its paid call.
  const pil = spawnSync(PYTHON, ['-c', 'import PIL'], { encoding: 'utf8' });
  if (pil.status !== 0) fail('Pillow is required for post-processing — `pip install pillow` and rerun');
  const imgutils = spawnSync(PYTHON, ['-c', 'import imgutils; from imgutils.detect import detect_faces'], { encoding: 'utf8' });
  if (imgutils.status !== 0) {
    fail('dghs-imgutils is required for smart crop post-processing — `pip install -r scripts/requirements.txt` and rerun');
  }

  const failures: { id: string; error: string }[] = [];
  let generated = 0;
  let consecutiveFailures = 0;
  const batchStart = Date.now();
  for (let i = 0; i < todo.length; i++) {
    const entry = todo[i];
    const t0 = Date.now();
    process.stdout.write(`[${i + 1}/${todo.length}] ${entry.id} … `);
    const res = generateOne(cliArgv, entry, args.force, targetDir);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (res.ok) {
      generated++;
      consecutiveFailures = 0;
      console.log(`ok in ${secs}s${res.reusedRaw ? ' (re-cropped existing raw — no quota spent)' : ''}`);
    } else {
      failures.push({ id: entry.id, error: res.error ?? 'unknown error' });
      consecutiveFailures++;
      console.log(`FAILED after ${secs}s — ${res.error}`);
      if (consecutiveFailures >= 3) {
        console.error(
          'gen-spell-art: 3 consecutive failures — aborting batch to protect quota ' +
            '(the default run resumes where it left off)',
        );
        break;
      }
    }
  }

  const totalMin = ((Date.now() - batchStart) / 60000).toFixed(1);
  console.log(
    `gen-spell-art: ${generated}/${todo.length} generated in ${totalMin} min` +
      (failures.length > 0 ? `, ${failures.length} failed` : '') +
      ` (raw originals in ${rawDir})`,
  );
  for (const f of failures) console.error(`  FAIL ${f.id}: ${f.error}`);

  if (generated > 0 && args.outDir === undefined) {
    const manifest = spawnSync('npm run gen-art-manifest', { shell: true, stdio: 'inherit' });
    if (manifest.status !== 0) fail('gen-art-manifest failed — run `npm run gen-art-manifest` manually');
  }
  if (failures.length > 0) process.exitCode = 1;
}

main();
