import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import {
  DEFAULT_ART_DONOR,
  createInitialBuilderState,
  evaluateBuilder,
  fromCardDef,
} from '../../src/forge/logic';
import {
  FORGE_SET_FORMAT,
  FORGE_SET_VERSION,
  MAX_IMPORT_BYTES,
  MAX_SET_CARDS,
  editingIndex,
  emptySet,
  entryFromState,
  exportFileName,
  exportSetJson,
  hasUnsavedChanges,
  importSetText,
  newCardId,
  saveToSet,
  stateFromEntry,
  type ForgeSet,
} from '../../src/forge/setModel';
import { FORGE_LIMITS, type ForgeEntry } from '../../src/forge/validate';
import { scoreCard } from '../../src/power/scoreCore';

/** Every card a player can collect: the pool the Forge's Start From a Card offers, minus tokens. */
const COLLECTIBLE = ALL_CARDS.filter((card) => !card.token);

const FRAMES = ['default', 'gold', 'rainbow', 'black'] as const;
const HOLOS = ['default', 'shiny', 'fractal', 'void'] as const;

/** A catalog card as the Forge builds it, with a varied look and art. */
function builtEntry(index: number): ForgeEntry {
  const card = COLLECTIBLE[index];
  const state = fromCardDef(card);
  state.appearance = { frame: FRAMES[index % 4], holo: HOLOS[(index >> 2) % 4], fullArt: index % 3 === 0 };
  state.artDonorId = COLLECTIBLE[(index * 7) % COLLECTIBLE.length].id;
  return entryFromState(state, `forge-${card.id}-${index + 1}`);
}

function fileWith(cards: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: FORGE_SET_FORMAT, version: FORGE_SET_VERSION, name: 'Test Set', cards, ...extra });
}

/** One good card, as an export writes it. */
const good = (): Record<string, unknown> => JSON.parse(JSON.stringify(builtEntry(0))) as Record<string, unknown>;

/** `good()` with its card changed by `edit`. */
function withCard(edit: (card: Record<string, unknown>) => void): Record<string, unknown> {
  const entry = good();
  edit(entry.card as Record<string, unknown>);
  return entry;
}

describe('set file round trip', () => {
  // The format contract: for every card the Forge can build, exporting it and
  // importing the file back reproduces the same card, art and look, and scores
  // identically. Checked over the whole collectible catalog, a set at a time.
  it('reproduces every collectible catalog card exactly through export and import', () => {
    const failures: string[] = [];
    for (let start = 0; start < COLLECTIBLE.length; start += MAX_SET_CARDS) {
      const entries = COLLECTIBLE.slice(start, start + MAX_SET_CARDS).map((_card, offset) => builtEntry(start + offset));
      const set: ForgeSet = { name: 'Catalog', cards: entries };
      const result = importSetText(exportSetJson(set));
      if (!result.ok) throw new Error(`import refused the export: ${result.problem}`);
      expect(result.skipped).toEqual([]);
      result.set.cards.forEach((imported, offset) => {
        const exported = entries[offset];
        const label = exported.card.id;
        try {
          expect(imported).toEqual(exported);
          const before = scoreCard(exported.card);
          const after = scoreCard(imported.card);
          expect(after.parts).toEqual(before.parts);
          expect([after.power, after.budget, after.delta]).toEqual([before.power, before.budget, before.delta]);
          // Opened in the editor, the imported card evaluates as the export did.
          expect(evaluateBuilder(stateFromEntry(imported)).score.delta).toBe(before.delta);
        } catch (error) {
          failures.push(`${label}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
        }
      });
    }
    expect(failures, `${COLLECTIBLE.length} collectible cards checked`).toEqual([]);
  });

  it('names the file after the set', () => {
    expect(exportFileName({ name: 'Tides of the Drowned Deep!', cards: [] })).toBe('tides-of-the-drowned-deep.json');
    expect(exportFileName({ name: '   ', cards: [] })).toBe('my-set.json');
  });

  it('recomputes the score on import instead of trusting the file', () => {
    const entry = good();
    entry.score = { power: 999, budget: 0, delta: 999, verdict: 'over' };
    const result = importSetText(fileWith([entry]));
    expect(result.ok && result.set.cards).toHaveLength(1);
    expect(result.ok && 'score' in result.set.cards[0]).toBe(false);
  });
});

describe('importing a hostile or broken file', () => {
  it('refuses a file that is not a version 1 Forge set', () => {
    for (const text of [
      'not json',
      '[]',
      JSON.stringify({ format: 'something-else', version: 1, cards: [] }),
      JSON.stringify({ format: FORGE_SET_FORMAT, version: 2, cards: [] }),
      JSON.stringify({ format: FORGE_SET_FORMAT, version: 1, cards: {} }),
    ]) {
      expect(importSetText(text)).toEqual({ ok: false, problem: 'not-a-set' });
    }
  });

  it('refuses a file over the size cap before parsing it', () => {
    expect(importSetText(`${fileWith([])}${' '.repeat(MAX_IMPORT_BYTES)}`)).toEqual({ ok: false, problem: 'too-large' });
  });

  it('skips each bad card with its reason and imports the good ones', () => {
    const deepBranch = (depth: number): unknown => (
      depth === 0 ? { op: 'draw', n: 1 } : { op: 'ifTargetMarked', then: [deepBranch(depth - 1)] }
    );
    const hostile: [string, Record<string, unknown> | string, string][] = [
      ['unknown effect', withCard((card) => { card.abilities = [{ when: 'spell', ops: [{ op: 'stealTheSave' }] }]; }), 'effect'],
      ['number out of range', withCard((card) => { card.abilities = [{ when: 'spell', ops: [{ op: 'draw', n: 99 }] }]; }), 'number'],
      ['fractional number', withCard((card) => { card.attack = 2.5; }), 'number'],
      ['overlong name', withCard((card) => { card.name = 'x'.repeat(FORGE_LIMITS.nameLength + 1); }), 'name'],
      ['overlong flavor', withCard((card) => { card.flavor = 'x'.repeat(FORGE_LIMITS.flavorLength + 1); }), 'text'],
      ['unknown card field', withCard((card) => { card.onLoad = 'alert(1)'; }), 'field'],
      ['prototype key', JSON.stringify(good()).replace('"name":', '"__proto__":{"polluted":true},"name":'), 'field'],
      ['unknown keyword', withCard((card) => { card.keywords = ['flying']; }), 'keyword'],
      ['unknown trigger', withCard((card) => { card.abilities = [{ when: 'upkeep', ops: [] }]; }), 'trigger'],
      ['unknown token', withCard((card) => { card.abilities = [{ when: 'spell', ops: [{ op: 'createToken', token: 'token-nope', count: 1 }] }]; }), 'token'],
      ['too many effects', withCard((card) => { card.abilities = [{ when: 'spell', ops: Array.from({ length: FORGE_LIMITS.opsPerList + 1 }, () => ({ op: 'draw', n: 1 })) }]; }), 'size'],
      ['branches nested too deep', withCard((card) => { card.abilities = [{ when: 'spell', ops: [deepBranch(FORGE_LIMITS.branchDepth)] }]; }), 'size'],
      ['unknown card type', withCard((card) => { card.types = ['planeswalker']; }), 'type'],
      ['not a card', { card: 'hello' }, 'shape'],
    ];
    const cards = [good(), ...hostile.map(([, value]) => (typeof value === 'string' ? JSON.parse(value) : value)), good()];
    const result = importSetText(fileWith(cards));
    if (!result.ok) throw new Error(result.problem);
    expect(result.total).toBe(cards.length);
    expect(result.set.cards).toHaveLength(2);
    expect(result.skipped.map((skip) => skip.reason)).toEqual(hostile.map(([, , reason]) => reason));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('falls back to the default art for an unknown donor and ignores a custom-art field', () => {
    const entry = good();
    entry.art = { donor: 'no-such-card', custom: { image: 'forge-image-1', zoom: 1.5 } };
    const result = importSetText(fileWith([entry]));
    expect(result.ok && result.set.cards[0].art).toEqual({ donor: DEFAULT_ART_DONOR });
  });

  it('keeps well-formed unique ids and replaces duplicate or malformed ones', () => {
    const first = good();
    const duplicate = good();
    const malformed = withCard((card) => { card.id = '"><script>'; });
    const result = importSetText(fileWith([first, duplicate, malformed]));
    if (!result.ok) throw new Error(result.problem);
    const ids = result.set.cards.map((entry) => entry.card.id);
    expect(ids[0]).toBe((first.card as { id: string }).id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('imports at most a full set and says the rest did not fit', () => {
    const cards = Array.from({ length: MAX_SET_CARDS + 3 }, () => good());
    const result = importSetText(fileWith(cards));
    expect(result.ok && result.set.cards.length).toBe(MAX_SET_CARDS);
    expect(result.ok && result.overCap).toBe(3);
  });
});

describe('the card in the editor and the set', () => {
  it('adds a new card, then updates it in place while it is being edited', () => {
    const state = createInitialBuilderState();
    const added = saveToSet(emptySet(), { editingId: null, baseline: null }, state);
    if (!added.ok) throw new Error('save refused');
    expect(added.set.cards).toHaveLength(1);
    const session = { editingId: added.id, baseline: null };
    expect(editingIndex(added.set, session)).toBe(0);
    expect(hasUnsavedChanges(added.set, session, state)).toBe(false);

    state.attack = 5;
    expect(hasUnsavedChanges(added.set, session, state)).toBe(true);
    const updated = saveToSet(added.set, session, state);
    if (!updated.ok) throw new Error('save refused');
    expect(updated.id).toBe(added.id);
    expect(updated.set.cards).toHaveLength(1);
    expect(updated.set.cards[0].card.attack).toBe(5);
  });

  it('refuses a new card once the set is full, but still updates a card in it', () => {
    const state = createInitialBuilderState();
    let set = emptySet();
    for (let index = 0; index < MAX_SET_CARDS; index += 1) {
      set = { ...set, cards: [...set.cards, entryFromState(state, newCardId(set, state.name))] };
    }
    expect(saveToSet(set, { editingId: null, baseline: null }, state)).toEqual({ ok: false, reason: 'full' });
    expect(saveToSet(set, { editingId: set.cards[0].card.id, baseline: null }, state).ok).toBe(true);
  });

  it('counts a new card as unsaved once it differs from what it was opened as', () => {
    const state = createInitialBuilderState();
    const baseline = entryFromState(state, '');
    expect(hasUnsavedChanges(emptySet(), { editingId: null, baseline }, state)).toBe(false);
    state.name = 'Changed';
    expect(hasUnsavedChanges(emptySet(), { editingId: null, baseline }, state)).toBe(true);
    // A shared card has no baseline: it is unsaved until it is saved.
    expect(hasUnsavedChanges(emptySet(), { editingId: null, baseline: null }, createInitialBuilderState())).toBe(true);
  });

  it('gives each new card an id that is unique in the set and survives a rename', () => {
    const state = createInitialBuilderState();
    const first = saveToSet(emptySet(), { editingId: null, baseline: null }, state);
    if (!first.ok) throw new Error('save refused');
    const second = saveToSet(first.set, { editingId: null, baseline: null }, state);
    if (!second.ok) throw new Error('save refused');
    expect(second.id).not.toBe(first.id);
    state.name = 'Renamed Blade';
    const renamed = saveToSet(second.set, { editingId: first.id, baseline: null }, state);
    expect(renamed.ok && renamed.id).toBe(first.id);
  });
});
