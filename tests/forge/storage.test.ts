import { describe, expect, it } from 'vitest';
import { createInitialBuilderState } from '../../src/forge/logic';
import { entryFromState, saveToSet, emptySet } from '../../src/forge/setModel';
import {
  FORGE_STORAGE_KEY,
  readAutosave,
  writeAutosave,
  type ForgeAutosave,
} from '../../src/forge/storage';

const GAME_SAVE_KEYS = ['darlingblades.save.v1', 'waifutcg.save.v1'];

/**
 * A Storage stand-in that records every call made to it. It implements the
 * whole Storage interface, so a call to anything the autosave has no business
 * using (removeItem, clear, key, length) shows up in the log.
 */
function recordingStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const calls: string[] = [];
  const storage: Storage = {
    get length() { calls.push('length'); return data.size; },
    key(index) { calls.push(`key:${index}`); return [...data.keys()][index] ?? null; },
    getItem(key) { calls.push(`getItem:${key}`); return data.get(key) ?? null; },
    setItem(key, value) { calls.push(`setItem:${key}`); data.set(key, String(value)); },
    removeItem(key) { calls.push(`removeItem:${key}`); data.delete(key); },
    clear() { calls.push('clear'); data.clear(); },
  };
  return { storage, calls, data };
}

function sampleAutosave(): ForgeAutosave {
  const state = createInitialBuilderState();
  const saved = saveToSet(emptySet(), { editingId: null, baseline: null }, state);
  if (!saved.ok) throw new Error('save refused');
  state.name = 'Half Finished';
  return {
    set: { ...saved.set, name: 'Autosaved Set' },
    editor: { entry: entryFromState(state, 'forge-editor'), editingId: saved.id, baseline: null, loadedFrom: null, loadedBaseline: null },
  };
}

describe('the Forge autosave', () => {
  it('reads and writes only its own key and never touches the game save', () => {
    const gameSave = { [GAME_SAVE_KEYS[0]]: '{"version":9}', [GAME_SAVE_KEYS[1]]: 'legacy' };
    const { storage, calls, data } = recordingStorage(gameSave);
    expect(writeAutosave(storage, sampleAutosave())).toBe(true);
    const read = readAutosave(storage);
    expect(read.available && read.save?.set.cards).toHaveLength(1);
    expect(calls).toEqual([`setItem:${FORGE_STORAGE_KEY}`, `getItem:${FORGE_STORAGE_KEY}`]);
    for (const key of GAME_SAVE_KEYS) expect(data.get(key)).toBe(gameSave[key]);
  });

  it('brings back the set and the card in the editor', () => {
    const { storage } = recordingStorage();
    const saved = sampleAutosave();
    writeAutosave(storage, saved);
    const read = readAutosave(storage);
    if (!read.available || !read.save) throw new Error('nothing read back');
    expect(read.save.set).toEqual(saved.set);
    expect(read.save.editor?.entry.card.name).toBe('Half Finished');
    expect(read.save.editor?.editingId).toBe(saved.editor?.editingId);
  });

  it('keeps a card\'s own image by id and never writes image bytes to storage', () => {
    const { storage, data } = recordingStorage();
    const saved = sampleAutosave();
    const id = 'f'.repeat(64);
    const framing = { zoom: 1.5, x: 0.2, y: -0.1, rotation: 12, flip: false, background: '#102030' };
    const first = saved.set.cards[0];
    const byId = { ...first, art: { donor: first.art.donor, custom: { image: id, ...framing } } };
    // A data URL reaching the autosave would be a bug: the write drops it rather than store image bytes.
    const withBytes = {
      ...first,
      card: { ...first.card, id: 'forge-second-2' },
      art: { donor: first.art.donor, custom: { image: `data:image/png;base64,${'A'.repeat(4000)}`, ...framing } },
    };
    expect(writeAutosave(storage, { ...saved, set: { ...saved.set, cards: [byId, withBytes] }, editor: { ...saved.editor!, entry: withBytes } })).toBe(true);
    expect(data.get(FORGE_STORAGE_KEY)).not.toContain('data:image');
    const read = readAutosave(storage);
    if (!read.available || !read.save) throw new Error('nothing read back');
    expect(read.save.set.cards.map((entry) => entry.art)).toEqual([byId.art, { donor: first.art.donor }]);
    expect(read.save.editor?.entry.art).toEqual({ donor: first.art.donor });
  });

  it('drops an autosave it cannot trust instead of failing', () => {
    for (const text of ['{not json', '{"format":"darling-blades-forge-autosave","version":7}', '"just a string"']) {
      const { storage } = recordingStorage({ [FORGE_STORAGE_KEY]: text });
      expect(readAutosave(storage)).toEqual({ available: true, save: null });
    }
    const hostile = JSON.parse(JSON.stringify({ format: 'darling-blades-forge-autosave', version: 1, ...sampleAutosave() }));
    hostile.set.cards[0].card.abilities = [{ when: 'spell', ops: [{ op: 'fetchSaveFile' }] }];
    const { storage } = recordingStorage({ [FORGE_STORAGE_KEY]: JSON.stringify(hostile) });
    const read = readAutosave(storage);
    expect(read.available && read.save?.set.cards).toEqual([]);
  });

  it('reports a browser that will not save, and keeps working', () => {
    expect(readAutosave(null)).toEqual({ available: false });
    expect(writeAutosave(null, sampleAutosave())).toBe(false);
    const blocked: Storage = {
      ...recordingStorage().storage,
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('QuotaExceededError'); },
    };
    expect(readAutosave(blocked)).toEqual({ available: false });
    expect(writeAutosave(blocked, sampleAutosave())).toBe(false);
  });
});
