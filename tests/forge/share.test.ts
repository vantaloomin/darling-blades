import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../src/data/catalog';
import { fromCardDef } from '../../src/forge/logic';
import { entryFromState } from '../../src/forge/setModel';
import {
  MAX_SHARE_JSON_BYTES,
  MAX_SHARE_PAYLOAD_LENGTH,
  SHARE_VERSION_PREFIX,
  decodeSharePayload,
  encodeSharePayload,
  payloadFromFragment,
  shareUrl,
} from '../../src/forge/share';

/**
 * Golden compatibility fixture: a version 1 share link made on 2026-09-25.
 * Links already shared must keep opening, so this payload must always decode
 * to exactly this card. If it stops decoding, the change broke old links.
 * (Re-minted once, before the Forge first shipped, when flavor text left the
 * game: owner ruling R13. No link with flavor was ever published.)
 */
const GOLDEN_PAYLOAD = '1.PZCxbsMwDER_pbhZHtJu2lqgP5AlQ5GBtmhbiCwJlNzACPTvBZW26-Mdj8cHJhIH-4B3sJiTLDzwNrIMdxLHcTjBINLGsPhU_nLpHAb1yFxgvzAJU92FcTUo-_jPLyTikyieUqmasnBk8RPsq0H2uSg7w55aU01I0o1ntVCtNN1g3wwczxwLd9eNj3sS13Wzl1I_ArkeTaMPvvqe_cB95QgLPeGbi55LsnD9G1LVYTzQrgYpP3HKsHC00cLaGvZkUBPsrxftqmoh8fWAhcCgsC4aqTCaAUlv6VJMAotlGzaKSYa6CoXQFTkzCcWJVTjL87PCDgZrChpWVh8PGMx7CO-6cKZQuLUf';
const GOLDEN_ENTRY = {
  card: {
    id: 'forge-ember-warden-1',
    name: 'Ember Warden',
    types: ['creature'],
    subtypes: ['Warrior'],
    cost: { generic: 2, pips: { R: 1 } },
    colors: ['R'],
    attack: 3,
    defense: 2,
    keywords: ['firstBlade'],
    abilities: [{ when: 'arrives', targets: [{ what: 'any' }], ops: [{ op: 'damage', n: 1, to: 'target' }] }],
    rarity: 'r',
    set: 'base',
  },
  art: { donor: 'gm-manor-thrall' },
  appearance: { frame: 'red', holo: 'shiny', fullArt: false },
};

/** A payload carrying arbitrary JSON text, compressed the way the Forge compresses. */
const payloadOf = (json: string): string => `${SHARE_VERSION_PREFIX}${deflateRawSync(Buffer.from(json)).toString('base64url')}`;

describe('share links', () => {
  it('decodes the version 1 golden link to its card', async () => {
    expect(await decodeSharePayload(GOLDEN_PAYLOAD)).toEqual({ ok: true, entry: GOLDEN_ENTRY });
  });

  it('round-trips catalog cards through encode and decode', async () => {
    const sample = ALL_CARDS.filter((card) => !card.token).filter((_card, index) => index % 37 === 0);
    for (const card of sample) {
      const state = fromCardDef(card);
      state.appearance = { frame: 'gold', holo: 'pearlescent', fullArt: true };
      const entry = entryFromState(state, `forge-${card.id}`);
      const decoded = await decodeSharePayload(await encodeSharePayload(entry));
      expect(decoded, card.id).toEqual({ ok: true, entry });
    }
  });

  it('never carries a card\'s own image: the link opens with the card\'s game art', async () => {
    const state = fromCardDef(ALL_CARDS.find((card) => !card.token)!);
    state.artSource = 'custom';
    state.customArt = { image: 'c'.repeat(64), zoom: 1.2, x: 0, y: 0, rotation: 0, flip: false, background: '#000000' };
    const entry = entryFromState(state, 'forge-own-art-1');
    expect(entry.art.custom).toBeDefined();
    const payload = await encodeSharePayload(entry);
    const json = inflateRawSync(Buffer.from(payload.slice(SHARE_VERSION_PREFIX.length), 'base64url')).toString('utf8');
    expect(json).not.toContain('custom');
    expect(await decodeSharePayload(payload)).toEqual({ ok: true, entry: { ...entry, art: { donor: entry.art.donor } } });
    // A payload that brings one anyway (made by hand) opens without it.
    const crafted = payloadOf(JSON.stringify({ ...entry, art: { donor: entry.art.donor, custom: { ...entry.art.custom, image: 'data:image/png;base64,AAAA' } } }));
    const decoded = await decodeSharePayload(crafted);
    expect(decoded.ok && decoded.entry.art).toEqual({ donor: entry.art.donor });
  });

  it('carries the payload in the fragment, never the query', () => {
    const url = shareUrl('https://bladedarlings.com/forge/?qa=1#old', GOLDEN_PAYLOAD);
    expect(url).toBe(`https://bladedarlings.com/forge/?qa=1#card=${GOLDEN_PAYLOAD}`);
    expect(payloadFromFragment(new URL(url).hash)).toBe(GOLDEN_PAYLOAD);
    expect(payloadFromFragment('#something-else')).toBeNull();
  });

  it('refuses payloads that are not a Forge card, without throwing', async () => {
    const unreadable = { ok: false, reason: 'unreadable', name: null };
    expect(await decodeSharePayload('2.abc')).toEqual(unreadable);
    expect(await decodeSharePayload('1.not base64!')).toEqual(unreadable);
    expect(await decodeSharePayload(`1.${Buffer.from('plainly not deflate').toString('base64url')}`)).toEqual(unreadable);
    expect(await decodeSharePayload(payloadOf('{"card": '))).toEqual(unreadable);
    expect(await decodeSharePayload(`1.${'A'.repeat(MAX_SHARE_PAYLOAD_LENGTH)}`)).toEqual(unreadable);
  });

  it('stops inflating a payload that expands past one card', async () => {
    // A few hundred bytes of deflate that would inflate to megabytes.
    const bomb = payloadOf(`{"card":"${'x'.repeat(MAX_SHARE_JSON_BYTES * 8)}"}`);
    expect(bomb.length).toBeLessThan(MAX_SHARE_PAYLOAD_LENGTH);
    expect(await decodeSharePayload(bomb)).toEqual({ ok: false, reason: 'unreadable', name: null });
  });

  it('runs a decoded card through the import validator', async () => {
    const hostile = { ...GOLDEN_ENTRY, card: { ...GOLDEN_ENTRY.card, abilities: [{ when: 'spell', ops: [{ op: 'eval', code: 'alert(1)' }] }] } };
    expect(await decodeSharePayload(payloadOf(JSON.stringify(hostile)))).toEqual({ ok: false, reason: 'effect', name: 'Ember Warden' });
  });
});
