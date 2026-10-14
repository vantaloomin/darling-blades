/* global process, console, fetch, WebSocket, setTimeout, Buffer, window */
// The Duel's action-log equivalence test (docs/plan-mobile-overhaul.md, the
// gate for switching phones to the phone Duel).
//
// Plays seeded Practice duels through the real input path: a seeded policy
// picks the human's next move from the engine's legal actions, and the script
// performs it with real taps (phone) or clicks (desktop) on the game objects
// that move needs, read from the live scene. Each move must reach the engine
// as exactly the action the policy chose, and the phone and desktop runs of
// one seed must end with the same replay log (both seats' actions in order).
//
//   npm run dev                                       (in another shell)
//   node scripts/duel-input-equivalence.mjs [options]
//
//   --seeds 1,2,3       duel seeds (default 1,2,3); seed n plays starter deck n
//                       (mod 5) in the Warchest format against its mirror
//   --layouts a,b       phone, short, desktop (default phone,desktop)
//   --max-moves <n>     stop a duel after this many human moves (default 400)
//   --url <origin>      the dev server (default http://localhost:5173)
//   --browser <path>    Chrome or Edge (default: $CHROME, then the usual paths)
//   --shots <dir>       save a screenshot whenever a move fails
//   --verbose           print every move and what was tapped
//   --headed            show the browser window
//
// Moves it does not drive yet (a mulligan, a Duty, a sacrifice, an Empower or
// other cast choice, a graveyard cast, Foresee, a discard) are left out of the
// policy; a duel that reaches a decision with none of the driven moves stops
// there and is reported as such, not as a failure. Exits 1 on any mismatch.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function parseArgs(argv) {
  const opts = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) opts.set(key, 'true');
    else opts.set(key, argv[++i]);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const origin = opts.get('url') ?? 'http://localhost:5173';
const seeds = (opts.get('seeds') ?? '1,2,3').split(',').map(Number);
const layouts = (opts.get('layouts') ?? 'phone,desktop').split(',');
const maxMoves = Number(opts.get('max-moves') ?? 400);
const verbose = opts.has('verbose');
const shots = opts.has('shots') ? resolve(opts.get('shots')) : null;

/** Each layout: the page, the viewport and whether it taps (touch) or clicks. */
const LAYOUTS = {
  phone: { query: '?layout=compact&viewport=phone-island', width: 852, height: 393, touch: true },
  short: { query: '?layout=compact&viewport=phone-safari', width: 852, height: 313, touch: true },
  desktop: { query: '', width: 1280, height: 720, touch: false },
};
for (const layout of layouts) if (!LAYOUTS[layout]) throw new Error(`Unknown layout "${layout}"; use ${Object.keys(LAYOUTS).join(', ')}`);

function findBrowser() {
  const candidates = [
    opts.get('browser'),
    process.env.CHROME,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('No Chrome or Edge found; pass --browser <path> or set CHROME');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDebugger(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(100);
  }
  throw new Error('The browser never opened its debugging port');
}

/** A minimal CDP client: one browser socket, flattened sessions. */
function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (msg) => {
    const data = JSON.parse(typeof msg.data === 'string' ? msg.data : Buffer.from(msg.data).toString());
    if (data.id && pending.has(data.id)) {
      const { resolve: ok, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else ok(data.result);
    } else if (data.method) {
      for (const listener of listeners) listener(data);
    }
  });
  return {
    open: new Promise((ok, reject) => {
      ws.addEventListener('open', ok);
      ws.addEventListener('error', reject);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((ok, reject) => pending.set(id, { resolve: ok, reject }));
    },
    on(listener) {
      listeners.push(listener);
    },
    close() {
      ws.close();
    },
  };
}

/** mulberry32: the policy's own seeded stream, independent of the game's. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable JSON: keys sorted, so two equal actions print the same. */
function canon(value) {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canon(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Installed in the page: reads the live Duel scene. It only reads (where a
 * control is, what is selected, what the engine was sent); every move is made
 * by the real input events the script sends.
 */
function pageAgent() {
  const HUMAN = 0;
  const scene = () => window.__game.scene.getScene('Duel');
  const agent = {
    log: [],
    async install() {
      // The scene's own modules (one instance on the dev server): the order
      // the hand is drawn in, so a pick can find its card on screen.
      const [{ handDisplayOrder }, { CARD_DB }, { groupReserveSlots }] = await Promise.all([
        import('/src/ui/handSort.ts'), import('/src/data/catalog.ts'), import('/src/ui/reserveModalPresentation.ts'),
      ]);
      agent.reserveGroups = groupReserveSlots;
      agent.handOrder = (hand) => handDisplayOrder(hand, CARD_DB);
      const s = scene();
      const duel = s.duel;
      if (duel.__eqWrapped) return;
      const submit = duel.submit.bind(duel);
      duel.submit = (player, action) => {
        const before = agent.log.length;
        const events = submit(player, action);
        // A rejected action throws, so only accepted ones are logged.
        if (agent.log.length === before) agent.log.push({ player, action: JSON.parse(JSON.stringify(action)) });
        return events;
      };
      duel.__eqWrapped = true;
      agent.hits = [];
      s.input.on('pointerdown', (p, objects) => agent.hits.push(`${p.wasTouch ? 'touch' : 'mouse'} ${Math.round(p.worldX)},${Math.round(p.worldY)} -> ${objects.map((o) => `${o.type}@d${o.depth}`).join(' ') || 'nothing'}`));
    },
    /** The human's decision when the scene is settled and waiting on it, else why not. */
    status() {
      const s = scene();
      if (!s || !s.duel) return { phase: 'loading' };
      const a = s.duel.awaiting;
      const base = { logLength: agent.log.length, turn: s.duel.state.turn, step: s.duel.state.step, kind: a.kind };
      if (s.ended || a.kind === 'gameOver') return { ...base, phase: 'over', winner: s.duel.state.winner ?? null };
      const busy = s.versusBumperActive || s.animatingCombat || s.aiTimer || s.autoSkipTimer || s.endTurnTimer
        || s.coinChoiceTimer || s.endingTurn;
      if (busy) return { ...base, phase: 'busy' };
      if (!('player' in a) || a.player !== HUMAN) return { ...base, phase: 'waiting' };
      return { ...base, phase: 'decide', legal: s.duel.legalActions(HUMAN) };
    },
    /** What the policy needs to judge a legal action drivable. */
    facts() {
      const s = scene();
      const st = s.duel.state;
      return {
        hand: st.players[HUMAN].hand.slice(),
        battlefield: st.battlefield.map((p) => p.iid),
        views: [...s.views.keys()],
        reserve: s.duel.viewFor(HUMAN).you.landReserve ?? [],
      };
    },
    /** The world point of an object's centre, or null when it is not on screen. */
    centre(object) {
      if (!object || !object.active) return null;
      for (let o = object; o; o = o.parentContainer) if (o.visible === false || o.alpha === 0) return null;
      const b = object.getBounds();
      return { x: b.centerX, y: b.centerY };
    },
    primary() {
      const s = scene();
      if (s.phoneChrome) {
        const chrome = s.phoneChrome;
        for (const button of [chrome.wideButton, chrome.primaryButton]) {
          if (button?.container.visible) return { point: agent.centre(button.inputZone), what: `foot "${button.label.text}"` };
        }
        return null;
      }
      return { point: agent.centre(s.passArc), what: `smart button "${s.hud.button.text}"` };
    },
    tile(iid) {
      const view = scene().views.get(iid);
      return view ? { point: agent.centre(view), what: `tile ${iid}` } : null;
    },
    hand(handIndex) {
      const s = scene();
      if (s.phoneChrome) {
        const pose = s.handPoses.get(handIndex);
        if (!pose) return null;
        // Cards that do not fit share the last row, "N more in hand".
        const folded = [...s.handPoses.values()].filter((other) => other.y === pose.y).length > 1;
        return { point: { x: pose.x, y: pose.y }, what: folded ? 'more in hand' : `hand row ${handIndex}` };
      }
      const view = s.handViewFor(handIndex);
      return view ? { point: agent.centre(view), what: `hand card ${handIndex}` } : null;
    },
    target(ref) {
      const s = scene();
      if (ref.kind === 'permanent') return agent.tile(ref.iid);
      if (ref.kind === 'player') {
        const portrait = ref.player === HUMAN ? s.portrait : s.oppPortrait;
        return { point: agent.centre(portrait.targetZone) ?? agent.centre(portrait), what: `portrait ${ref.player}` };
      }
      return null;
    },
    /**
     * A hand card in a pick window (discard to hand size): the phone's sheet
     * tiles or the desktop overlay's cards, both drawn in the hand's display order.
     */
    overlayCard(handIndex) {
      const s = scene();
      const pos = agent.handOrder(s.duel.state.players[HUMAN].hand).indexOf(handIndex);
      if (s.phoneChrome) return agent.sheetTile(pos, s.overlay);
      const cards = s.overlay?.list.filter((o) => o.constructor.name === 'CardView') ?? [];
      return cards[pos] ? { point: agent.centre(cards[pos]), what: `pick card ${handIndex}` } : null;
    },
    /**
     * A land from the Warchest Reserves. Phone: the pinned Reserves row opens
     * the sheet, then the land's tile and Play land. Desktop: the Reserves pile
     * fans the playable kinds; the picked one is carried to the field.
     */
    reserveLand(intended) {
      const s = scene();
      const reserve = s.duel.viewFor(HUMAN).you.landReserve ?? [];
      const cardId = reserve[intended.reserveIndex];
      if (s.phoneChrome) {
        if (s.phoneZone?.tab === 'reserves') {
          const tiles = agent.sheetTiles(s.zoneModal?.container);
          const pos = tiles.findIndex((o) => o.name === `sheet:${cardId}`);
          if (pos < 0) return { stuck: `no tile for ${cardId}` };
          if (s.phoneZone.pick !== pos) return agent.sheetTile(pos);
          return agent.primary();
        }
        return agent.textStarting('Warchest Reserves');
      }
      if (s.carry) return { point: { x: 640, y: 300 }, what: 'the field (carry drop)' };
      if (s.landFan) {
        const legal = s.duel.legalActions(HUMAN);
        const playable = (i) => legal.some((a) => a.type === 'playLand' && a.reserveIndex === i);
        const groups = agent.reserveGroups(reserve, playable).filter((g) => g.playableIndex !== undefined);
        const pos = groups.findIndex((g) => g.cardId === cardId);
        const views = s.landFan.root.list.filter((o) => o.constructor.name === 'CardView');
        return views[pos] ? { point: agent.centre(views[pos]), what: `fan land ${cardId}` } : { stuck: `no fan card for ${cardId}` };
      }
      return { point: agent.centre(s.myReservePile.inputZone), what: 'the Reserves pile' };
    },
    /** A visible text starting with `prefix`, the topmost if several. */
    textStarting(prefix) {
      const s = scene();
      const found = s.children.list.flatMap(function walk(o) {
        return [o, ...(o.list ? o.list.flatMap(walk) : [])];
      }).filter((o) => o.type === 'Text' && o.text.startsWith(prefix) && agent.centre(o));
      found.sort((x, y) => (y.depth ?? 0) - (x.depth ?? 0));
      return found[0] ? { point: agent.centre(found[0]), what: `text "${found[0].text}"` } : null;
    },
    /** The phone sheet's tile at `pos` (src/ui/DuelPhoneSheet.ts names each tile's zone "sheet:<card>"). */
    sheetTiles(sheet) {
      return (sheet?.list ?? []).flatMap(function walk(o) {
        return [o, ...(o.list ? o.list.flatMap(walk) : [])];
      }).filter((o) => o.type === 'Zone' && o.name?.startsWith('sheet:'));
    },
    /**
     * The phone sheet's tile at `pos`. A long grid scrolls inside the sheet, so
     * a tile out of view is first dragged into it, as a thumb would.
     */
    sheetTile(pos, sheet = scene().zoneModal?.container) {
      const tile = agent.sheetTiles(sheet)[pos];
      const point = agent.centre(tile);
      if (!point) return null;
      const view = tile.getData('sheetViewport');
      if (view && (point.y < view.y + 8 || point.y > view.y + view.height - 8)) {
        const mid = view.y + view.height / 2;
        const dy = Math.max(-view.height * 0.4, Math.min(view.height * 0.4, mid - point.y));
        return { drag: { from: { x: point.x, y: mid - dy / 2 }, to: { x: point.x, y: mid + dy / 2 } }, what: `scroll sheet to tile ${pos}` };
      }
      return { point, what: `sheet tile ${pos}` };
    },
    /** A visible text exactly matching `label`, the topmost if several. */
    text(label) {
      const s = scene();
      const found = s.children.list.flatMap(function walk(o) {
        return [o, ...(o.list ? o.list.flatMap(walk) : [])];
      }).filter((o) => o.type === 'Text' && o.text === label && agent.centre(o));
      found.sort((x, y) => (y.depth ?? 0) - (x.depth ?? 0));
      return found[0] ? { point: agent.centre(found[0]), what: `text "${label}"` } : null;
    },
    /** A tap the duel needs that is no engine action: calling the coin flip. */
    chore() {
      const s = scene();
      // The phone's revealed coin is labelled too; only the call is a chore.
      if (s.phoneChrome && !s.phoneCoin?.panel.call) return null;
      return agent.text('Heads');
    },
    sameTarget(x, y) {
      return x.kind === y.kind && (x.kind === 'player' ? x.player === y.player : x.iid === y.iid);
    },
    /** The next thing to tap toward `intended`, from what the scene shows now. */
    next(intended) {
      const s = scene();
      const phone = !!s.phoneChrome;
      const a = s.duel.awaiting;
      if (phone && s.phoneRecap && (intended.type === 'castSpell' || intended.type === 'playLand')) {
        // The combat recap holds the column for a moment; a tap clears it.
        const dismiss = s.phoneChrome.handZones.find((z) => z.name === 'recap:dismiss');
        return dismiss ? { point: agent.centre(dismiss), what: 'the combat recap' } : null;
      }
      switch (intended.type) {
        case 'choosePlayDraw': {
          const call = agent.chore();
          if (call) return call;
          // The phone's foot and the desktop's coin panel word it differently.
          return intended.play ? agent.text('Play first') ?? agent.text('Play First') : agent.text('Draw first') ?? agent.text('Draw First');
        }
        case 'keepHand':
          return agent.text('Keep');
        case 'playLand':
          if (intended.handIndex < 0) return agent.reserveLand(intended);
          // falls through: a land from hand plays like a spell
        case 'castSpell': {
          if (s.pendingCasts) {
            const picks = s.targetPicks;
            const want = intended.targets ?? [];
            const wrong = picks.findIndex((pick, i) => !want[i] || !agent.sameTarget(pick, want[i]));
            if (wrong >= 0) return { stuck: `picked ${JSON.stringify(picks)} but meant ${JSON.stringify(want)}` };
            if (picks.length < want.length) return agent.target(want[picks.length]);
            return agent.primary();
          }
          if (s.carry) return { point: { x: 640, y: 300 }, what: 'the field (carry drop)' };
          if (phone && s.phoneFocus) {
            if (s.phoneFocus.handIndex !== intended.handIndex) return { stuck: `opened hand card ${s.phoneFocus.handIndex}` };
            return agent.primary();
          }
          if (phone && s.phoneZone?.tab === 'hand') {
            // The whole hand on the sheet: pick the card's tile, then Open.
            const pos = agent.handOrder(s.duel.state.players[HUMAN].hand).indexOf(intended.handIndex);
            if (s.phoneZone.pick !== pos) return agent.sheetTile(pos);
            return agent.primary();
          }
          return agent.hand(intended.handIndex);
        }
        case 'declareAttackers': {
          const want = new Set(intended.attackers);
          const rage = new Set(s.rageAttackers?.() ?? []);
          for (const iid of want) if (!rage.has(iid) && !s.selectedAttackers.has(iid)) return agent.tile(iid);
          for (const iid of s.selectedAttackers) if (!want.has(iid)) return agent.tile(iid);
          return agent.primary();
        }
        case 'declareBlockers': {
          const done = s.blockAssignments;
          for (const b of done) {
            if (!intended.blocks.some((w) => w.blocker === b.blocker && w.attacker === b.attacker)) return { stuck: `assigned ${JSON.stringify(b)}` };
          }
          const todo = intended.blocks.find((w) => !done.some((b) => b.blocker === w.blocker && b.attacker === w.attacker));
          if (!todo) return agent.primary();
          if (s.pendingBlocker === todo.blocker) return agent.tile(todo.attacker);
          return agent.tile(todo.blocker);
        }
        case 'chooseTarget':
          return agent.target(intended.target);
        case 'discard': {
          const picks = s.discardPicks;
          const want = new Set(intended.handIndices);
          const toggle = [...want].find((i) => !picks.has(i)) ?? [...picks].find((i) => !want.has(i));
          if (toggle === undefined) return phone ? agent.primary() : agent.text('Confirm');
          return agent.overlayCard(toggle);
        }
        case 'passStep':
        case 'passResponse':
          return agent.primary();
        default:
          return { stuck: `no driver for ${intended.type} (${a.kind})` };
      }
    },
    /** A world point in CSS pixels of the page. */
    toPage(point) {
      const s = scene();
      const cam = s.cameras.main;
      const canvas = window.__game.canvas;
      const rect = canvas.getBoundingClientRect();
      const sx = (point.x - cam.worldView.x) * cam.zoom + cam.x;
      const sy = (point.y - cam.worldView.y) * cam.zoom + cam.y;
      return { x: rect.left + sx * rect.width / window.__game.scale.width, y: rect.top + sy * rect.height / window.__game.scale.height };
    },
    /** Where the pointer lands in the world, to check `toPage`. */
    pointer() {
      const p = scene().input.activePointer;
      return { x: p.worldX, y: p.worldY };
    },
    replayLog() {
      const draft = scene().replayDraft;
      return draft ? JSON.parse(JSON.stringify(draft.actions ?? draft)) : null;
    },
  };
  window.__eq = agent;
}

/** The policy's pick among the drivable legal moves: progress first, then passing. */
function choose(legal, facts, random) {
  const views = new Set(facts.views);
  const targetOk = (t) => t.kind === 'player' || (t.kind === 'permanent' && views.has(t.iid));
  const castsByHand = new Map();
  for (const action of legal) {
    if (action.type !== 'castSpell') continue;
    castsByHand.set(action.handIndex, [...(castsByHand.get(action.handIndex) ?? []), action]);
  }
  const plainCast = (action) => {
    if (action.handIndex < 0 || action.graveIndex !== undefined || action.retell || action.whispers || action.tithe
      || action.hauntlinked || action.sacrifices || action.modes || action.x !== undefined || action.empowered) return false;
    // Only when the hand card has no other way to cast it, so the UI asks no choice.
    const all = castsByHand.get(action.handIndex) ?? [];
    if (all.some((other) => canon({ ...other, targets: undefined }) !== canon({ ...action, targets: undefined }))) return false;
    if (legal.some((other) => other.type === 'skim' && other.handIndex === action.handIndex)) return false;
    return (action.targets ?? []).every(targetOk);
  };
  const drivable = legal.filter((action) => {
    switch (action.type) {
      case 'choosePlayDraw':
      case 'keepHand':
      case 'passStep':
      case 'passResponse':
      case 'declareAttackers':
        return true;
      case 'playLand':
        // A reserve land: the screens offer the first playable copy of each kind.
        return action.handIndex >= 0 || legal.find((other) => other.type === 'playLand' && other.handIndex < 0
          && facts.reserve[other.reserveIndex] === facts.reserve[action.reserveIndex]) === action;
      case 'castSpell':
        return plainCast(action);
      case 'declareBlockers':
        return action.blocks.every((b) => views.has(b.blocker) && views.has(b.attacker));
      case 'chooseTarget':
        return targetOk(action.target);
      case 'discard':
        return true;
      default:
        return false;
    }
  });
  if (drivable.length === 0) return null;
  const weight = { playLand: 6, castSpell: 5, declareAttackers: 3, declareBlockers: 2 };
  const groups = new Map();
  for (const action of drivable) {
    const key = action.type === 'declareAttackers' && action.attackers.length === 0 ? 'noAttack'
      : action.type === 'declareBlockers' && action.blocks.length === 0 ? 'noBlock' : action.type;
    groups.set(key, [...(groups.get(key) ?? []), action]);
  }
  const keys = [...groups.keys()];
  const total = keys.reduce((sum, key) => sum + (weight[key] ?? 1), 0);
  let roll = random() * total;
  const key = keys.find((k) => (roll -= weight[k] ?? 1) < 0) ?? keys[keys.length - 1];
  const group = groups.get(key);
  return group[Math.floor(random() * group.length)];
}

async function playDuel(cdp, sessionId, layoutName, seed) {
  const layout = LAYOUTS[layoutName];
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  const tap = async (page) => {
    if (layout.touch) {
      const point = { x: page.x, y: page.y, radiusX: 4, radiusY: 4, id: 1 };
      // Sent together: Chrome holds each touch for the next frame, and a slow
      // headless frame between the two would make the tap read as a hold.
      await Promise.all([
        cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }, sessionId),
        cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId),
      ]);
    } else {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: page.x, y: page.y }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: page.x, y: page.y, button: 'left', clickCount: 1 }, sessionId);
      await sleep(60);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: page.x, y: page.y, button: 'left', clickCount: 1 }, sessionId);
    }
  };
  /** A touch drag from one design point to another, in steps, as a thumb scrolls. */
  const drag = async ({ from, to }) => {
    const toPage = (p) => evaluate(`JSON.stringify(window.__eq.toPage(${JSON.stringify(p)}))`).then(JSON.parse);
    const a = await toPage(from);
    const b = await toPage(to);
    const at = (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, radiusX: 4, radiusY: 4, id: 1 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] }, sessionId);
    for (let i = 1; i <= 8; i++) {
      await sleep(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / 8)] }, sessionId);
    }
    await sleep(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
  };
  const waitFor = async (expression, ms, what) => {
    const deadline = Date.now() + ms;
    while (!(await evaluate(expression).catch(() => false))) {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
      await sleep(250);
    }
  };
  const url = `${origin}/${layout.query}`;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: layout.width, height: layout.height, deviceScaleFactor: 1, mobile: layout.touch }, sessionId);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: layout.touch, maxTouchPoints: layout.touch ? 5 : 1 }, sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);
  await waitFor("window.__game?.scene?.isActive?.('MainMenu') === true", 120_000, 'the main menu (is `npm run dev` running?)');
  // A fresh profile: skip the tutorial and the stats notice, turn animations off
  // so the duel moves at a pace a slow headless browser keeps up with.
  // The duel plays a starter deck in the Warchest format, the one players
  // play, picked by the seed so the seeds between them cover every starter.
  await evaluate(`Promise.all([import('/src/meta/services.ts'), import('/src/data/starterDecks.ts')]).then(([{ Services }, { STARTER_DECKS }]) => {
    const save = Services.save.data;
    save.tutorialDone = true;
    save.settings.statsNoticeVersion = 99;
    save.settings.animations = 'off';
    const deck = STARTER_DECKS[${seed} % STARTER_DECKS.length];
    for (const id of [...deck.reserveCards, ...deck.landReserve]) save.collection[id] = (save.collection[id] ?? 0) + 1;
    save.decks = [{ id: 'equivalence', name: deck.name, cards: [...deck.reserveCards], heroCardId: null, landStyle: null,
      format: 'warchest', darlingId: null, landReserve: [...deck.landReserve] }];
    save.activeDeckId = 'equivalence';
    Services.save.flush();
  })`);
  await cdp.send('Page.navigate', { url }, sessionId);
  await waitFor("window.__game?.scene?.isActive?.('MainMenu') === true", 120_000, 'the main menu');
  await evaluate(`window.__game.scene.getScene('MainMenu').scene.start('Duel', { difficulty: 'easy', seedOverride: ${seed} }); true`);
  await waitFor("window.__game?.scene?.isActive?.('Duel') === true && !!window.__game.scene.getScene('Duel').duel", 60_000, 'the duel');
  await evaluate(`(${pageAgent.toString()})(); window.__eq.install().then(() => true)`);

  if (verbose) console.log(`  touch: ${await evaluate("String(window.__game.device.input.touch) + ' ' + ('ontouchstart' in window) + ' ' + navigator.maxTouchPoints")}`);
  const random = rng(seed * 7919 + 17);
  const failures = [];
  let moves = 0;
  let stopped = null;
  let checkedMapping = false;
  let lastStatus = '';
  let stableSince = Date.now();
  for (;;) {
    const status = await evaluate('JSON.stringify(window.__eq.status())').then(JSON.parse);
    if (status.phase === 'over') break;
    // Settled: the same decision for a beat, so an auto-skip hop or a queued AI
    // move cannot land between reading the decision and acting on it.
    const key = `${status.phase}:${status.logLength}:${status.kind}:${status.step}`;
    if (key !== lastStatus) {
      lastStatus = key;
      stableSince = Date.now();
    }
    if (status.phase === 'waiting' && Date.now() - stableSince >= 900) {
      const chore = await evaluate('JSON.stringify(window.__eq.chore())').then((v) => JSON.parse(v ?? 'null'));
      if (chore?.point) {
        await tap(await evaluate(`JSON.stringify(window.__eq.toPage(${JSON.stringify(chore.point)}))`).then(JSON.parse));
        lastStatus = '';
        await sleep(700);
        continue;
      }
    }
    if (status.phase !== 'decide' || Date.now() - stableSince < 900) {
      if (Date.now() - stableSince > 90_000) {
        stopped = `nothing happened for 90 s (${key})`;
        break;
      }
      await sleep(200);
      continue;
    }
    if (moves >= maxMoves) {
      stopped = `reached ${maxMoves} moves`;
      break;
    }
    const facts = await evaluate('JSON.stringify(window.__eq.facts())').then(JSON.parse);
    const intended = choose(status.legal, facts, random);
    if (!intended) {
      stopped = `a decision it does not drive yet: ${status.kind} (${status.legal.map((a) => a.type).join(', ')})`;
      break;
    }
    moves++;
    const startLog = status.logLength;
    const trail = [];
    let outcome = null;
    for (let step = 0; step < 12 && !outcome; step++) {
      const log = await evaluate('JSON.stringify(window.__eq.log)').then(JSON.parse);
      const mine = log.slice(startLog).filter((entry) => entry.player === 0);
      if (mine.length > 0) {
        outcome = canon(mine[0].action) === canon(intended)
          ? { ok: true }
          : { ok: false, why: `sent ${canon(mine[0].action)}` };
        break;
      }
      const next = await evaluate(`JSON.stringify(window.__eq.next(${JSON.stringify(intended)}))`).then((v) => JSON.parse(v ?? 'null'));
      if (next?.drag && layout.touch) {
        trail.push(next.what);
        await drag(next.drag);
        await sleep(500);
        continue;
      }
      if (!next || next.stuck || !next.point) {
        outcome = { ok: false, why: next?.stuck ?? `nothing to tap (${next?.what ?? 'no control'})` };
        break;
      }
      const page = await evaluate(`JSON.stringify(window.__eq.toPage(${JSON.stringify(next.point)}))`).then(JSON.parse);
      if (!checkedMapping && !layout.touch) {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: page.x, y: page.y }, sessionId);
        await sleep(300);
        const p = await evaluate('JSON.stringify(window.__eq.pointer())').then(JSON.parse);
        if (Math.hypot(p.x - next.point.x, p.y - next.point.y) > 2) throw new Error(`Page mapping is off: aimed at ${JSON.stringify(next.point)}, pointer at ${JSON.stringify(p)}`);
        checkedMapping = true;
      }
      trail.push(verbose ? `${next.what}@${Math.round(page.x)},${Math.round(page.y)}` : next.what);
      await tap(page);
      if (verbose) trail.push(`[${await evaluate('window.__eq.hits.splice(0).join("; ")')}]`);
      // Let the scene take the tap and redraw before reading it again.
      await sleep(700);
      for (let i = 0; i < 40; i++) {
        const st = await evaluate('JSON.stringify(window.__eq.status())').then(JSON.parse);
        if (st.phase !== 'busy') break;
        await sleep(250);
      }
    }
    if (!outcome) outcome = { ok: false, why: 'the move never reached the engine' };
    if (verbose && outcome.ok) console.log(`  move ${moves} (turn ${status.turn}, ${status.step}): ${canon(intended)}; tapped ${trail.join(' > ')}`);
    if (!outcome.ok) {
      failures.push({ move: moves, turn: status.turn, step: status.step, intended: canon(intended), why: outcome.why, trail });
      console.log(`  FAIL move ${moves} (turn ${status.turn}, ${status.step}): ${canon(intended)}: ${outcome.why}; tapped ${trail.join(' > ') || 'nothing'}`);
      if (shots) {
        mkdirSync(shots, { recursive: true });
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
        writeFileSync(join(shots, `${layoutName}-seed${seed}-move${moves}.png`), Buffer.from(data, 'base64'));
      }
      stopped = 'a move went wrong';
      break;
    }
  }
  const status = await evaluate('JSON.stringify(window.__eq.status())').then(JSON.parse);
  const log = await evaluate('JSON.stringify(window.__eq.log)').then(JSON.parse);
  return { moves, failures, stopped, over: status.phase === 'over', turn: status.turn, log: log.map((e) => `${e.player}:${canon(e.action)}`) };
}

async function main() {
  const port = 9333 + Math.floor(Math.random() * 500);
  const profileRoot = mkdtempSync(join(tmpdir(), 'equivalence-profile-'));
  let failed = false;
  const results = new Map();
  try {
    for (const seed of seeds) {
      for (const layoutName of layouts) {
        // A fresh browser profile per duel: the same empty save every time.
        const profile = mkdtempSync(join(profileRoot, 'p-'));
        const browser = spawn(findBrowser(), [
          ...(opts.get('headed') ? [] : ['--headless=new']),
          `--remote-debugging-port=${port}`,
          `--user-data-dir=${profile}`,
          '--hide-scrollbars',
          '--mute-audio',
          '--no-first-run',
          '--no-default-browser-check',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
          'about:blank',
        ], { stdio: 'ignore' });
        const cdp = cdpClient(await waitForDebugger(port));
        await cdp.open;
        try {
          const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
          const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
          await cdp.send('Page.enable', {}, sessionId);
          await cdp.send('Runtime.enable', {}, sessionId);
          cdp.on((msg) => {
            if (msg.sessionId !== sessionId) return;
            if (msg.method === 'Runtime.exceptionThrown') {
              console.error('  [page]', msg.params.exceptionDetails?.exception?.description?.split('\n')[0] ?? msg.params.exceptionDetails?.text);
            }
          });
          const started = Date.now();
          const result = await playDuel(cdp, sessionId, layoutName, seed);
          results.set(`${seed}:${layoutName}`, result);
          const end = result.over ? 'the duel ended' : `stopped: ${result.stopped}`;
          console.log(`seed ${seed} ${layoutName}: ${result.moves} moves over ${result.turn} turns, ${result.failures.length === 0 ? 'every move matched' : `${result.failures.length} wrong`}; ${end} (${Math.round((Date.now() - started) / 1000)} s)`);
          if (result.failures.length > 0) failed = true;
        } finally {
          cdp.close();
          browser.kill();
          await sleep(500);
        }
      }
      // The layouts must have sent the engine the same actions, both seats.
      const runs = layouts.map((l) => [l, results.get(`${seed}:${l}`)]).filter(([, r]) => r);
      for (const [name, run] of runs.slice(1)) {
        const [firstName, first] = runs[0];
        const n = Math.min(first.log.length, run.log.length);
        const diverge = first.log.slice(0, n).findIndex((line, i) => line !== run.log[i]);
        if (diverge >= 0) {
          failed = true;
          console.log(`seed ${seed}: ${firstName} and ${name} differ at action ${diverge + 1}: ${first.log[diverge]} vs ${run.log[diverge]}`);
        } else if (first.log.length !== run.log.length && first.over && run.over) {
          failed = true;
          console.log(`seed ${seed}: ${firstName} sent ${first.log.length} actions, ${name} ${run.log.length}`);
        } else if (first.log.length !== run.log.length) {
          console.log(`seed ${seed}: ${firstName} and ${name} agree on the first ${n} actions, where the shorter run stopped`);
        } else {
          console.log(`seed ${seed}: ${firstName} and ${name} sent the same ${n} actions`);
        }
      }
    }
  } finally {
    rmSync(profileRoot, { recursive: true, force: true });
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
