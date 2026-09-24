import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAI } from '../../src/ai/personality';
import { CARD_DB } from '../../src/data/catalog';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import { Game } from '../../src/engine/Game';
import { buildAiLandReserve } from '../../src/meta/duelSetup';
import { WARCHEST_HAND_SIZE } from '../../src/meta/warchest';

/**
 * THE HARNESS TRAP (rollout doc, wave T2).
 *
 * Duel completion is the same code the balance matrices and the multi-hour
 * metagame sweep walk thousands of times. One signal fired from there would
 * emit millions of events and burn the daily quota in minutes. The defence is
 * structural rather than conditional: the emit call lives in the scene layer
 * only, `eslint.config.js` forbids `engine`/`ai`/`data`/`meta` from importing
 * `src/net` at all, and the harness entry points never import a scene.
 *
 * These tests are the proof, in three layers: play a real headless duel with
 * the network spied on and count zero; read the fenced source as text and find
 * no net import; read the harness entry points as text and find neither.
 */

const ROOT = resolve(__dirname, '../..');

const FENCED_DIRS = ['src/engine', 'src/ai', 'src/data', 'src/meta'];

/** The scripts a sweep or a matrix actually starts from. */
const HARNESS_ENTRY_POINTS = [
  'scripts/balance-matrix.ts',
  'scripts/personas/craft.ts',
  'scripts/tuning-sweep.ts',
  'scripts/progression-sim.ts',
  'scripts/ai-watch-pass.ts',
];

/** Source with comments removed, so a doc comment cannot look like code. */
function code(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Every `from '...'` / `import('...')` specifier in a TypeScript source. */
function importSpecifiers(source: string): string[] {
  const out: string[] = [];
  const pattern = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) out.push(match[1]);
  return out;
}

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...tsFilesUnder(rel));
    else if (entry.endsWith('.ts')) out.push(rel);
  }
  return out;
}

describe('a headless duel emits nothing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 204 })));
    vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => true) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('plays a full reserve-native duel to its end with zero network calls', () => {
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const beaconSpy = navigator.sendBeacon as unknown as ReturnType<typeof vi.fn>;
    const decks: [string[], string[]] = [
      STARTER_DECKS[0].reserveCards!.slice(),
      STARTER_DECKS[1].reserveCards!.slice(),
    ];
    const landReserves: [string[], string[]] = [
      STARTER_DECKS[0].landReserve?.slice() ?? buildAiLandReserve(decks[0], CARD_DB),
      STARTER_DECKS[1].landReserve?.slice() ?? buildAiLandReserve(decks[1], CARD_DB),
    ];
    // The same loop shape as scripts/balance-matrix.ts playOut().
    const game = new Game({
      decks,
      seed: 20260917,
      db: CARD_DB,
      format: 'warchest',
      landReserves,
      startingHandSize: WARCHEST_HAND_SIZE,
    });
    const ais = [buildAI('medium', CARD_DB, 11), buildAI('medium', CARD_DB, 23)];
    let ended = false;
    for (let i = 0; i < 40_000; i++) {
      const awaiting = game.awaiting;
      if (awaiting.kind === 'gameOver') {
        ended = true;
        break;
      }
      const view = game.viewFor(awaiting.player);
      const legal = game.legalActions(awaiting.player);
      game.submit(awaiting.player, ais[awaiting.player].chooseAction(view, legal));
    }
    expect(ended).toBe(true);
    expect(game.instanceState.winner).not.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(beaconSpy).toHaveBeenCalledTimes(0);
  });
});

describe('the import fence, read as text', () => {
  it('no file under engine/ai/data/meta imports src/net', () => {
    const offenders: string[] = [];
    for (const dir of FENCED_DIRS) {
      for (const file of tsFilesUnder(dir)) {
        for (const spec of importSpecifiers(code(file))) {
          if (/(^|\/)net\//.test(spec)) offenders.push(`${file} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the harness entry points import neither src/net nor src/scenes', () => {
    const offenders: string[] = [];
    for (const file of HARNESS_ENTRY_POINTS) {
      const source = code(file); // a missing entry point makes this throw, which is the point
      for (const spec of importSpecifiers(source)) {
        if (/(^|\/)net\//.test(spec) || /(^|\/)scenes\//.test(spec)) offenders.push(`${file} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('nothing in src/ installs the test-only endpoint override', () => {
    // It lifts the dev-build suppressor, so a production caller would be a way
    // to send from a dev build. Only tests may ever name it.
    const offenders: string[] = [];
    for (const file of tsFilesUnder('src')) {
      if (file === 'src/net/signalsClient.ts') continue; // where it is defined
      if (/setSignalsTestEndpoint\s*\(/.test(code(file))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('src/net touches no device storage of any kind', () => {
    // Privacy policy 3.3: "The only thing it stores on your device for this
    // feature is your on or off choice, inside your save." Nothing in the
    // transport may write anywhere, which also rules out the queue the design
    // says does not exist.
    const storageApis = [
      'localStorage',
      'sessionStorage',
      'indexedDB',
      'document.cookie',
      'caches',
      'writeFile',
    ];
    const offenders: string[] = [];
    for (const file of tsFilesUnder('src/net')) {
      const source = code(file);
      for (const api of storageApis) if (source.includes(api)) offenders.push(`${file}: ${api}`);
    }
    expect(offenders).toEqual([]);
  });

  it('src/net is imported only by the scene and boot layers', () => {
    // One entry per FILE: MainMenuScene names two of src/net's modules (the
    // facade and the gate), and what this pins is which files may reach it.
    const importers = new Set<string>();
    for (const file of tsFilesUnder('src')) {
      if (file.startsWith('src/net/')) continue;
      for (const spec of importSpecifiers(code(file))) {
        if (/(^|\/)net\//.test(spec)) importers.add(file);
      }
    }
    // Boot sends the heartbeat, the duel scene the digests and the card batch,
    // and the two privacy scenes read the gate (Settings for the row's caption,
    // MainMenu for the first-run dialog's line) and acknowledge the notice
    // (MainMenu). Nothing under engine/ai/data/meta/ui appears here, which is
    // what keeps a harness run physically unable to reach the network. In
    // particular src/ui/StatsNoticeDialog.ts does NOT: the scene evaluates the
    // gate and hands it a finished string.
    expect([...importers].sort()).toEqual([
      'src/gameBoot.ts',
      'src/scenes/DuelScene.ts',
      'src/scenes/MainMenuScene.ts',
      'src/scenes/SettingsScene.ts',
    ]);
  });
});
