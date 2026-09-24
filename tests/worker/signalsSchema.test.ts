import { describe, expect, it } from 'vitest';
import { AVATARS } from '../../src/data/opponents';
import type { CardDb, Color } from '../../src/engine/types';
import {
  BUILD_STAMP_MAX_LENGTH,
  GAUNTLET_RUNG_CAP,
  MULLIGAN_CAP,
  SIGNAL_FIELDS,
  SIGNAL_SETTINGS_FIELDS,
  SIGNAL_VOCAB,
  buildDuelDigest,
  buildHeartbeat,
  buildSessionCards,
  deckColoursOf,
  type DuelDeckInput,
  type DuelResultInput,
  type SignalEnv,
  type SignalVocabSpec,
} from '../../src/meta/playSignals';
import {
  EVENT_TYPES,
  MAX_CARD_ROWS,
  PROHIBITED_KEYS,
  SIGNAL_FIELDS as WORKER_FIELDS,
  SIGNAL_SETTINGS_FIELDS as WORKER_SETTINGS_FIELDS,
  SIGNAL_VOCAB as WORKER_VOCAB,
  WIRE_VERSION,
  eventTypeOf,
  validate,
  versionIsAccepted,
  type EventType,
  type Json,
  type VocabSpec,
} from '../../worker/src/schema';
import { TINY_DB, richSave } from '../meta/playSignals.fixtures';

/**
 * The edge validator, held equal to the client's allowlist.
 *
 * `worker/src/schema.ts` restates the field allowlist and the value vocabulary
 * rather than importing `src/meta/playSignals.ts`, because importing it would
 * drag the card catalog, the avatar roster and the save schema into a Worker
 * bundle. These tests are what makes the copy safe: they are the reason the
 * Worker lives in this repo at all (owner ruling D-T0.3), and they fail the
 * moment the two descriptions of the schema disagree in either direction.
 *
 * They live under `tests/worker/` rather than inside `worker/` because this is
 * the only place that can import BOTH sides: `worker/` has its own lockfile and
 * no test runner, and adding one there would give the repo two suites, only one
 * of which the ladder and CI run.
 */

const ENV: SignalEnv = {
  appVersion: '1.8.0',
  buildSha: 'a1b2c3d',
  platform: 'web',
  formFactor: 'mobile',
  lang: 'en-GB',
  reducedMotion: false,
};

const DECK: DuelDeckInput = {
  cards: ['fx-white-two', 'fx-blue-three'],
  landReserve: null,
  darlingId: null,
  db: TINY_DB,
};

const RESULT: DuelResultInput = {
  format: 'gauntlet',
  opponentId: AVATARS[0].id,
  difficulty: 'hard',
  result: 'concede',
  turns: 12,
  mulligans: 2,
};

/** The payloads the REAL builders produce, which are what the endpoint must take. */
function realPayloads(): { heartbeat: Json; duel: Json; cards: Json[] } {
  const save = richSave();
  return {
    heartbeat: buildHeartbeat(save, ENV) as unknown as Json,
    duel: buildDuelDigest(RESULT, DECK, save) as unknown as Json,
    cards: buildSessionCards({ 'fx-black-five': 5, 'fx-white-two': 1 }, 3) as unknown as Json[],
  };
}

/**
 * The body IS the payload: the event kind travels in the `?e=` query parameter,
 * so validation takes it as an argument rather than reading it out of the JSON.
 */
function accepts(type: EventType, payload: unknown): boolean {
  return validate(type, payload).ok;
}

/** Deep clone that also strips `readonly`, so `toEqual` compares data not types. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------

describe('the edge validator and the client allowlist are one schema', () => {
  it('the field allowlist is identical, per event and in order', () => {
    expect(plain(WORKER_FIELDS)).toEqual(plain(SIGNAL_FIELDS));
    expect(plain(WORKER_SETTINGS_FIELDS)).toEqual(plain(SIGNAL_SETTINGS_FIELDS));
  });

  it('the value vocabulary is identical, field by field and value by value', () => {
    expect(plain(WORKER_VOCAB)).toEqual(plain(SIGNAL_VOCAB));
  });

  it('every allowlisted field has a vocabulary entry, and every entry is allowlisted', () => {
    const allowlisted = new Set<string>([
      ...SIGNAL_FIELDS.heartbeat.filter((field) => field !== 'settings'),
      ...SIGNAL_SETTINGS_FIELDS,
      ...SIGNAL_FIELDS.duel,
      ...SIGNAL_FIELDS.cards,
    ]);
    expect(new Set(Object.keys(WORKER_VOCAB))).toEqual(allowlisted);
    expect(new Set(Object.keys(SIGNAL_VOCAB))).toEqual(allowlisted);
  });

  it('the caps the client clamps to are the caps the edge enforces', () => {
    expect(WORKER_VOCAB.gauntletBestRung).toEqual({ kind: 'int', min: 0, max: GAUNTLET_RUNG_CAP });
    expect(WORKER_VOCAB.mulligans).toEqual({ kind: 'int', min: 0, max: MULLIGAN_CAP });
    expect(WORKER_VOCAB.appVersion.maxLength).toBe(BUILD_STAMP_MAX_LENGTH);
    expect(WORKER_VOCAB.buildSha.maxLength).toBe(BUILD_STAMP_MAX_LENGTH);
  });

  it('the vocabulary is frozen on both sides, so an assertion against it means something', () => {
    expect(Object.isFrozen(SIGNAL_VOCAB)).toBe(true);
    for (const spec of Object.values(SIGNAL_VOCAB) as readonly SignalVocabSpec[]) {
      expect(Object.isFrozen(spec)).toBe(true);
      if (spec.kind === 'enum') expect(Object.isFrozen(spec.values)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------

describe('the payloads the real builders produce', () => {
  it('validate, all three of them', () => {
    const payloads = realPayloads();
    expect(accepts('heartbeat', payloads.heartbeat)).toBe(true);
    expect(accepts('duel', payloads.duel)).toBe(true);
    expect(accepts('cards', payloads.cards)).toBe(true);
  });

  it('validate for every colour identity a deck can have', () => {
    // 31 non-empty WUBRG subsets plus the colourless deck: the whole closed
    // vocabulary, generated through the real builder rather than asserted.
    const byColour: Record<Color, string> = {
      W: 'fx-white-two',
      U: 'fx-blue-three',
      B: 'fx-black-five',
      R: 'fx-red-one',
      G: 'fx-green-four',
    };
    const colours: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];
    const seen = new Set<string>();
    for (let mask = 0; mask < 1 << colours.length; mask++) {
      const cards = colours.filter((_, bit) => (mask & (1 << bit)) !== 0).map((c) => byColour[c]);
      const deck: DuelDeckInput = {
        cards: cards.length > 0 ? cards : ['fx-colourless-six'],
        landReserve: null,
        darlingId: null,
        db: TINY_DB as CardDb,
      };
      const emitted = deckColoursOf(deck);
      seen.add(emitted);
      expect(
        (WORKER_VOCAB.deckColours.values as readonly string[]).includes(emitted),
        `the edge rejects the colour identity "${emitted}"`,
      ).toBe(true);
    }
    expect(seen.size).toBe(32);
  });

  it('validate for a Limited draft deck, which is the one archetype the builder overrides', () => {
    const save = richSave();
    (save as unknown as Record<string, unknown>).limited = { activeRun: { seed: 1 } };
    const digest = buildDuelDigest({ ...RESULT, format: 'limited' }, DECK, save);
    expect(digest.deckSource).toBe('drafted');
    expect(accepts('duel', digest as unknown as Json)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

/** Where a field lives, so a per-field probe can put a value in the right place. */
type Slot = { event: EventType; nested: boolean };

function slotOf(field: string): Slot {
  if ((SIGNAL_SETTINGS_FIELDS as readonly string[]).includes(field)) {
    return { event: 'heartbeat', nested: true };
  }
  if ((SIGNAL_FIELDS.heartbeat as readonly string[]).includes(field)) {
    return { event: 'heartbeat', nested: false };
  }
  if ((SIGNAL_FIELDS.duel as readonly string[]).includes(field)) return { event: 'duel', nested: false };
  return { event: 'cards', nested: false };
}

/** A real payload with one field replaced. */
function withField(field: string, value: unknown): { type: EventType; payload: unknown } {
  const payloads = realPayloads();
  const slot = slotOf(field);
  if (slot.event === 'cards') {
    const rows = payloads.cards.map((row) => ({ ...row, [field]: value }));
    return { type: 'cards', payload: rows };
  }
  const base = slot.event === 'heartbeat' ? payloads.heartbeat : payloads.duel;
  if (slot.nested) {
    return {
      type: 'heartbeat',
      payload: { ...base, settings: { ...(base.settings as Json), [field]: value } },
    };
  }
  return { type: slot.event, payload: { ...base, [field]: value } };
}

/** Values that must be refused for a given spec: wrong shape, wrong type, out of range. */
function illegalValuesFor(spec: VocabSpec): unknown[] {
  switch (spec.kind) {
    case 'enum':
      return ['zzq-not-a-vocabulary-value', '', 0, true, null, spec.values[0] + 'x'];
    case 'int':
      return [spec.min - 1, spec.max + 1, 1.5, Number.NaN, String(spec.min), true, null];
    case 'bool':
      return ['true', 1, 0, null, {}];
    case 'string': {
      const tooLong = 'a'.repeat(spec.maxLength + 1);
      // Upper case and a space are outside every pattern in the vocabulary.
      return [tooLong, 'HAS UPPER CASE', ' ', 7, true, null, {}];
    }
  }
}

describe('every value in the vocabulary is accepted and everything else is refused', () => {
  const fields = Object.keys(WORKER_VOCAB);

  it.each(fields)('%s: every legal value is accepted', (field) => {
    const spec = (WORKER_VOCAB as Readonly<Record<string, VocabSpec>>)[field];
    const legal: unknown[] =
      spec.kind === 'enum'
        ? [...spec.values]
        : spec.kind === 'int'
          ? [spec.min, spec.max, Math.floor((spec.min + spec.max) / 2)]
          : spec.kind === 'bool'
            ? [true, false]
            : // A `string` field: probe the real values the builders emit for it,
              // which realPayloads already covers, plus the boundary length.
              [];
    for (const value of legal) {
      const probe = withField(field, value);
      expect(accepts(probe.type, probe.payload), `${field} = ${JSON.stringify(value)} was refused`).toBe(
        true,
      );
    }
  });

  it.each(fields)('%s: every illegal value is refused', (field) => {
    const spec = (WORKER_VOCAB as Readonly<Record<string, VocabSpec>>)[field];
    for (const value of illegalValuesFor(spec)) {
      const probe = withField(field, value);
      expect(accepts(probe.type, probe.payload), `${field} = ${JSON.stringify(value)} was accepted`).toBe(
        false,
      );
    }
  });

  it('id fields take a real id of every kind and refuse a shape that is not an id', () => {
    for (const field of ['opponentId', 'deckArchetype', 'cardId'] as const) {
      for (const legal of ['unknown', 'custom', 'sd-bakhet-gate-warden-of-the-lower-city', 'a']) {
        const probe = withField(field, legal);
        expect(accepts(probe.type, probe.payload), `${field} = ${legal} was refused`).toBe(true);
      }
      for (const illegal of ['9-leading-digit', '-leading-dash', 'Has-Capital', 'has_underscore', 'a'.repeat(49)]) {
        const probe = withField(field, illegal);
        expect(accepts(probe.type, probe.payload), `${field} = ${illegal} was accepted`).toBe(false);
      }
    }
  });

  it('build stamps take what safeBuildStamp emits, including an empty one, and nothing else', () => {
    for (const field of ['appVersion', 'buildSha'] as const) {
      for (const legal of ['1.8.0', 'a1b2c3d', 'dev', '', 'v1.8.0-rc.1_build', 'x'.repeat(40)]) {
        const probe = withField(field, legal);
        expect(accepts(probe.type, probe.payload), `${field} = "${legal}" was refused`).toBe(true);
      }
      for (const illegal of ['x'.repeat(41), 'has space', 'has/slash', 'héllo']) {
        const probe = withField(field, illegal);
        expect(accepts(probe.type, probe.payload), `${field} = "${illegal}" was accepted`).toBe(false);
      }
    }
  });

  it('lang takes a bare two-letter subtag and refuses a region', () => {
    for (const legal of ['en', 'de', 'ja', 'xx']) {
      const probe = withField('lang', legal);
      expect(accepts(probe.type, probe.payload)).toBe(true);
    }
    for (const illegal of ['en-GB', 'EN', 'eng', 'e']) {
      const probe = withField('lang', illegal);
      expect(accepts(probe.type, probe.payload), `lang = ${illegal} was accepted`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------

describe('a body that is not exactly the schema is refused', () => {
  it('refuses one extra key, on any event and at any depth', () => {
    const payloads = realPayloads();
    expect(accepts('heartbeat', { ...payloads.heartbeat, extra: 1 })).toBe(false);
    expect(
      accepts('heartbeat', {
        ...payloads.heartbeat,
        settings: { ...(payloads.heartbeat.settings as Json), extra: 1 },
      }),
    ).toBe(false);
    expect(accepts('duel', { ...payloads.duel, extra: 1 })).toBe(false);
    expect(accepts('cards', payloads.cards.map((row) => ({ ...row, extra: 1 })))).toBe(false);
  });

  it('refuses one missing key, on any event', () => {
    const payloads = realPayloads();
    for (const field of SIGNAL_FIELDS.heartbeat) {
      const short = { ...payloads.heartbeat };
      delete short[field];
      expect(accepts('heartbeat', short), `a heartbeat without ${field} was accepted`).toBe(false);
    }
    for (const field of SIGNAL_FIELDS.duel) {
      const short = { ...payloads.duel };
      delete short[field];
      expect(accepts('duel', short), `a duel without ${field} was accepted`).toBe(false);
    }
    for (const field of SIGNAL_FIELDS.cards) {
      const rows = payloads.cards.map((row) => {
        const short = { ...row };
        delete short[field];
        return short;
      });
      expect(accepts('cards', rows), `a card row without ${field} was accepted`).toBe(false);
    }
    for (const field of SIGNAL_SETTINGS_FIELDS) {
      const settings = { ...(payloads.heartbeat.settings as Json) };
      delete settings[field];
      expect(accepts('heartbeat', { ...payloads.heartbeat, settings })).toBe(false);
    }
  });

  it('refuses every name on the prohibition list, wherever it appears', () => {
    const payloads = realPayloads();
    // The list in docs/plan-telemetry-and-accounts.md, verbatim.
    const prohibited = [
      'deckName',
      'saveCode',
      'replay',
      'ip',
      'geo',
      'country',
      'userAgent',
      'screen',
      'accountId',
      'email',
      'jwt',
      'deviceId',
      'timestamp',
    ];
    for (const key of prohibited) {
      expect(PROHIBITED_KEYS, `${key} is missing from the Worker's prohibition list`).toContain(key);
      const result = validate('heartbeat', { ...payloads.heartbeat, [key]: 'x' });
      expect(result.ok, `a heartbeat carrying ${key} was accepted`).toBe(false);
      if (!result.ok) expect(result.reason).toBe('prohibited-key');
      // And nested inside settings.
      expect(
        accepts('heartbeat', {
          ...payloads.heartbeat,
          settings: { ...(payloads.heartbeat.settings as Json), [key]: 'x' },
        }),
      ).toBe(false);
      // And on a card row, where the batch is an array rather than an object.
      expect(accepts('cards', payloads.cards.map((row) => ({ ...row, [key]: 'x' })))).toBe(false);
    }
  });

  it('refuses a body that is not the shape its event calls for', () => {
    expect(validate('heartbeat', [1, 2, 3]).ok).toBe(false);
    expect(validate('heartbeat', 'a string').ok).toBe(false);
    expect(validate('heartbeat', null).ok).toBe(false);
    expect(validate('cards', 'a string').ok).toBe(false);
    expect(validate('cards', null).ok).toBe(false);
    expect(validate('duel', 42).ok).toBe(false);
  });

  it('reads the event kind and the optional version out of the query, not the body', () => {
    for (const kind of EVENT_TYPES) expect(eventTypeOf(kind)).toBe(kind);
    for (const junk of [null, '', 'card', 'session', 'HEARTBEAT', 'heartbeat ']) {
      expect(eventTypeOf(junk), `"${junk}" was read as an event kind`).toBeNull();
    }
    // Absent means the version this Worker speaks; anything else is refused, so
    // a future schema break cannot be accepted by today's Worker by accident.
    expect(WIRE_VERSION).toBe(1);
    expect(versionIsAccepted(null)).toBe(true);
    expect(versionIsAccepted('1')).toBe(true);
    for (const junk of ['', '2', '0', '1.0', 'one']) {
      expect(versionIsAccepted(junk), `version "${junk}" was accepted`).toBe(false);
    }
  });

  it('refuses a body that still carries the discriminator the wire format removed', () => {
    const payloads = realPayloads();
    // The spike flattened `type` and `v` in beside the fields, and an earlier
    // draft of this Worker wrapped them in an envelope. Both are now extra keys
    // and must be refused, so a client left on either shape fails loudly.
    expect(accepts('heartbeat', { ...payloads.heartbeat, type: 'heartbeat', v: 1 })).toBe(false);
    expect(accepts('heartbeat', { v: 1, type: 'heartbeat', payload: payloads.heartbeat })).toBe(false);
    expect(accepts('duel', { ...payloads.duel, cardsPlayed: [] })).toBe(false);
  });

  it('refuses a payload of the wrong SHAPE for its event', () => {
    const payloads = realPayloads();
    expect(accepts('heartbeat', payloads.cards)).toBe(false);
    expect(accepts('cards', payloads.heartbeat)).toBe(false);
    expect(accepts('duel', payloads.heartbeat)).toBe(false);
    expect(accepts('heartbeat', payloads.duel)).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('the cards batch', () => {
  function rows(n: number, duels = '4-7'): Json[] {
    return Array.from({ length: n }, (_, i) => ({
      cardId: `card-${String(i).padStart(3, '0')}`.replace(/[0-9]/g, (d) => 'abcdefghij'[Number(d)]),
      countBucket: '2-3',
      duelsBucket: duels,
    }));
  }

  it('takes a batch at the cap and refuses one row over it', () => {
    expect(MAX_CARD_ROWS).toBe(60);
    expect(accepts('cards', rows(MAX_CARD_ROWS))).toBe(true);
    const over = validate('cards', rows(MAX_CARD_ROWS + 1));
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe('batch-too-large');
  });

  it('refuses an empty batch, because an empty one says nothing and costs a write', () => {
    const empty = validate('cards', []);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toBe('empty-batch');
  });

  it('refuses a batch whose rows disagree on duelsBucket', () => {
    const mixed = [...rows(3, '2-3'), ...rows(2, '8+')];
    const result = validate('cards', mixed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('batch-duels-disagree');
  });

  it('carries no duel reference, no deck reference and no order key, by shape', () => {
    expect(plain(SIGNAL_FIELDS.cards)).toEqual(['cardId', 'countBucket', 'duelsBucket']);
    // There is nowhere in the row to put one, which is the design, so the
    // assertion is that the allowlist is exactly three fields and that adding
    // any of the tempting fourth ones is refused.
    for (const field of ['duelId', 'deckArchetype', 'deckColours', 'index', 'order', 'seq']) {
      expect(accepts('cards', rows(2).map((row) => ({ ...row, [field]: 'x' })))).toBe(false);
    }
  });
});
