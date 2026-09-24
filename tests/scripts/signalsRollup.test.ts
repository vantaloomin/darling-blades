/**
 * The k-anonymity floor, the day file it produces, and the SQL the rollup sends.
 *
 * These tests are the deliverable, not its packaging. Everything the rollup
 * writes may be committed to a PUBLIC repository (docs/legal/README.md,
 * second-pass findings: "Rollup aggregates get committed to the public repo,
 * which is publication"), and the privacy policy promises players a specific
 * floor by number. So each test below is one sentence of that promise.
 *
 * Nothing here touches the network, reads an environment variable, or imports
 * Phaser.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  CARD_SHAPE,
  DUEL_SHAPE,
  EMPTY_LABEL,
  HEARTBEAT_SHAPE,
  OTHER,
  OTHER_REPORTED,
  ROLLUP_K,
  assertNoSubFloorNumber,
  buildDay,
  daysToRoll,
  foldEntries,
  labelOf,
  parseCount,
  serializeDay,
  toEntries,
  type Entry,
  type RawRow,
} from '../../scripts/signals-rollup/core';
import {
  CARD_CROSSES,
  CARD_DIMENSIONS,
  DUEL_CROSSES,
  DUEL_DIMENSIONS,
  HEARTBEAT_DIMENSIONS,
  addDays,
  buildQueries,
  isDay,
} from '../../scripts/signals-rollup/queries';
import { SIGNAL_FIELDS, SIGNAL_SETTINGS_FIELDS, SIGNAL_VOCAB } from '../../src/meta/playSignals';

const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/signals-rollup-rows.json', import.meta.url), 'utf8'),
) as Record<string, Record<string, RawRow[]>>;

const BUSY_DAY = '2026-09-16';
const QUIET_DAY = '2026-09-17';

const entry = (value: string, n: number, gate = n): Entry => ({ value, n, gate });
const published = (entries: readonly Entry[], gate: 'installs' | 'rows'): Record<string, number> | null =>
  foldEntries(entries, gate).published;

function buildFixtureDay(day: string) {
  return buildDay({ day, build: 't2', rows: FIXTURE[day] });
}

// ---------------------------------------------------------------------------
// The promise, in the policy's own words
// ---------------------------------------------------------------------------

describe('the floor and the promise', () => {
  it('uses the number the privacy policy tells players it uses', () => {
    const policy = readFileSync(new URL('../../docs/legal/privacy-policy.md', import.meta.url), 'utf8');
    const promised = /fewer than (\d+) summaries/.exec(policy);
    expect(promised, 'the privacy policy must still state the floor in "How long it is kept"').not.toBeNull();
    expect(Number(promised?.[1])).toBe(ROLLUP_K);
    // The other half of the same sentence: what a sub-floor value becomes.
    expect(policy).toContain('merged into "other"');
  });
});

// ---------------------------------------------------------------------------
// The floor itself
// ---------------------------------------------------------------------------

describe('foldEntries: the plain list', () => {
  it('publishes at and above k, and folds below k on either n or the gate', () => {
    const outcome = foldEntries(
      [entry('big', 100, 40), entry('at-k', 10, 10), entry('n-below-k', 9, 40), entry('gate-below-k', 50, 9)],
      'installs',
    );
    // n = 9 fails although 40 installs stand behind it; n = 50 fails although it
    // is the second largest number in the list, because 9 installs is a crowd of
    // nine. Both land in `other`, whose gate is the larger of the two.
    expect(outcome.published).toEqual({ big: 100, 'at-k': 10, [OTHER]: 59 });
    expect(outcome.publishedCount).toBe(2);
    expect(outcome.foldedCount).toBe(2);
  });

  it('never prints a zero, and never prints an `other` when nothing folded', () => {
    const outcome = foldEntries([entry('a', 40), entry('b', 20), entry('c', 0)], 'rows');
    expect(outcome.published).toEqual({ a: 40, b: 20 });
    expect(outcome.published).not.toHaveProperty(OTHER);
    expect(outcome.foldedCount).toBe(0);
  });

  it('suppresses the whole dimension when there is nothing to report', () => {
    expect(published([], 'rows')).toBeNull();
    expect(published([entry('a', 0), entry('b', 0)], 'rows')).toBeNull();
  });

  it('folds an install-gated value with a huge n and a tiny gate', () => {
    // One install, fifty duels. The duel count says "popular"; the install count
    // says "one person", and one person is who the floor exists for.
    expect(
      published([entry('common', 500, 60), entry('also-common', 300, 40), entry('one-player', 50, 1)], 'installs'),
    ).toEqual({ common: 500, [OTHER]: 350 });
  });

  it('collapses a two-value dimension entirely rather than leaving a residual', () => {
    // `other` = 50 from one install would be a population of one wearing a
    // disguise, and with a closed vocabulary its NAME follows by elimination. So
    // the only publishable value goes in with it and the dimension says one
    // number. This is the floor working, not the floor failing.
    expect(published([entry('common', 500, 60), entry('one-player', 50, 1)], 'installs')).toEqual({
      [OTHER]: 550,
    });
  });
});

describe('foldEntries: complementary suppression', () => {
  it('pulls the smallest publishable value in when `other` alone is below the floor', () => {
    // Without this, `other` = 3 is published, and 3 is exactly the number the
    // floor was asked to hide.
    expect(published([entry('a', 100), entry('b', 12), entry('c', 11), entry('d', 3)], 'rows')).toEqual({
      a: 100,
      b: 12,
      [OTHER]: 14,
    });
  });

  it('keeps pulling until `other` passes, and reports only `other` when everything folds', () => {
    // Three install-gated values below the gate: their union is at least 9, which
    // is still short, so the only publishable value joins them too.
    const outcome = foldEntries(
      [entry('a', 100, 100), entry('b', 50, 9), entry('c', 40, 8), entry('d', 30, 7)],
      'installs',
    );
    expect(outcome.published).toEqual({ [OTHER]: 220 });
    expect(outcome.publishedCount).toBe(0);
    expect(outcome.foldedCount).toBe(4);
  });

  it('nulls the dimension when everything folds and `other` still fails', () => {
    expect(published([entry('a', 5), entry('b', 4)], 'rows')).toBeNull();
  });
});

describe('foldEntries: the lower bound on `other`', () => {
  it('adds gates for row-counted entries, because rows are disjoint', () => {
    // 6 rows and 5 rows really are 11 different sessions.
    expect(published([entry('x', 6), entry('y', 5)], 'rows')).toEqual({ [OTHER]: 11 });
  });

  it('takes the largest gate for install-gated entries, because install sets can overlap', () => {
    // The same two numbers, counted in installs: the true union is at least 6 and
    // we do not know more than that, so the fold is suppressed rather than
    // guessed upward. This one line is the difference between an honest floor and
    // a floor that publishes a crowd of six as a crowd of eleven.
    expect(published([entry('x', 6), entry('y', 5)], 'installs')).toBeNull();
  });
});

describe('a literal value named `other`', () => {
  it('is carried as data and never confused with the fold bucket', () => {
    expect(labelOf('other', 'text')).toBe(OTHER_REPORTED);
    const outcome = foldEntries(
      [entry('1080p', 120), entry(OTHER_REPORTED, 25), entry('720p', 60), entry('1440p', 12), entry('rare', 8)],
      'rows',
    );
    // The real `other` keeps its own number and its own key; the fold bucket sits
    // beside it and holds something else entirely.
    expect(outcome.published).toEqual({ '1080p': 120, '720p': 60, [OTHER_REPORTED]: 25, [OTHER]: 20 });
  });

  it('is a real value of settings.renderScale today, and of nothing else', () => {
    // The rollout contract assumed no vocabulary contained `other` yet. It does:
    // `renderScaleBucket` returns `other` for any scale that is not one of the
    // three hard-coded ones, so the rename above is load-bearing NOW, not in some
    // future schema. This test pins the exact set, so a second field gaining the
    // value fails here and gets a decision rather than a silent merge.
    const carriers = Object.entries(SIGNAL_VOCAB)
      .filter(([, spec]) => spec.kind === 'enum' && (spec.values as readonly string[]).includes(OTHER))
      .map(([field]) => field);
    expect(carriers).toEqual(['renderScale']);
  });

  it('gives an empty blob a readable label instead of an empty key', () => {
    expect(labelOf('', 'text')).toBe(EMPTY_LABEL);
    expect(labelOf(null, 'text')).toBe(EMPTY_LABEL);
  });
});

describe('rows arriving from the SQL API', () => {
  it('reads numbers that arrive as strings', () => {
    expect(parseCount('1840')).toBe(1840);
    expect(parseCount(1840)).toBe(1840);
    expect(parseCount('')).toBe(0);
    expect(parseCount(null)).toBe(0);
    expect(parseCount('not a number')).toBe(0);
    expect(parseCount('-5')).toBe(0);
  });

  it('labels doubles, and merges two rows whose labels collide', () => {
    expect(labelOf('1', 'bool')).toBe('true');
    expect(labelOf('0', 'bool')).toBe('false');
    expect(labelOf('3', 'int')).toBe('3');
    const merged = toEntries(
      [
        { value: '1', n: '10' },
        { value: '1', n: '4' },
      ],
      'bool',
      HEARTBEAT_SHAPE,
    );
    expect(merged).toEqual([{ value: 'true', n: 14, gate: 14 }]);
  });

  it('takes a duel gate from its own column, and a heartbeat or card gate from n', () => {
    const duel = toEntries([{ value: 'limited', n: '120', gate: '9' }], 'text', DUEL_SHAPE);
    expect(duel).toEqual([{ value: 'limited', n: 120, gate: 9 }]);
    // A heartbeat row has no gate column at all: the published number IS the
    // distinct-install count. Reading a gate column here would find nothing and
    // suppress the entire section.
    const heartbeat = toEntries([{ value: 'web', n: '180', heartbeats: '430' }], 'text', HEARTBEAT_SHAPE);
    expect(heartbeat).toEqual([{ value: 'web', n: 180, gate: 180 }]);
    const card = toEntries([{ value: 'db-ember-scout', n: '300' }], 'text', CARD_SHAPE);
    expect(card).toEqual([{ value: 'db-ember-scout', n: 300, gate: 300 }]);
  });
});

// ---------------------------------------------------------------------------
// The day file
// ---------------------------------------------------------------------------

describe('buildDay: the busy fixture day', () => {
  const { json, summary } = buildFixtureDay(BUSY_DAY);

  it('publishes the day totals and the shape the viewer reads', () => {
    expect(json.schema).toBe(1);
    expect(json.day).toBe(BUSY_DAY);
    expect(json.k).toBe(ROLLUP_K);
    expect(json.build).toBe('t2');
    expect(json.heartbeat?.installs).toBe(220);
    expect(json.duel?.duels).toBe(1840);
    expect(json.duel?.installs).toBe(96);
    expect(json.cards?.rows).toBe(1459);
  });

  it('folds a dimension only when it has to, and leaves a clean one alone', () => {
    expect(json.heartbeat?.dimensions.platform).toEqual({ web: 180, desktop: 40 });
    expect(json.heartbeat?.dimensions.appVersion).toEqual({ '1.8.0': 190, [OTHER]: 30 });
    // `ja` (9) and `pt` (8) fold. Their union is at most 17 installs but AT LEAST
    // 9, and 9 is all the fold may assume, so `fr` (11) joins them to clear the
    // floor honestly.
    expect(json.heartbeat?.dimensions.lang).toEqual({ en: 180, de: 12, [OTHER]: 28 });
  });

  it('keeps a real `other` value beside a fold bucket without mixing them', () => {
    expect(json.heartbeat?.dimensions['settings.renderScale']).toEqual({
      '1080p': 120,
      '720p': 60,
      '1440p': 25,
      [OTHER_REPORTED]: 15,
    });
  });

  it('labels the double columns', () => {
    expect(json.heartbeat?.dimensions['settings.reducedMotion']).toEqual({ false: 205, true: 15 });
    expect(json.heartbeat?.dimensions.tutorialDone).toEqual({ true: 200, false: 20 });
    expect(json.heartbeat?.dimensions.gauntletBestRung).toEqual({ '0': 140, '1': 40, [OTHER]: 40 });
  });

  it('folds the duel format that 9 installs played 120 times', () => {
    expect(json.duel?.dimensions.format).toEqual({ warchest: 900, gauntlet: 520, [OTHER]: 420 });
  });

  it('never publishes the opponent only two installs played', () => {
    const opponents = json.duel?.dimensions.opponentId ?? {};
    expect(Object.keys(opponents)).not.toContain('zz-hidden-persona');
    expect(Object.keys(opponents)).not.toContain('chrome-broodmother');
    expect(opponents).toEqual({
      anubis: 400,
      bastet: 350,
      brunhild: 300,
      artoria: 250,
      'marsh-mother': 200,
      [OTHER]: 340,
    });
  });

  it('folds a cross row, folds inside a surviving row, and drops a split that is entirely suppressed', () => {
    const cross = json.duel?.crosses.opponentId;
    expect(cross?.by).toBe('result');
    // A row that publishes its split whole.
    expect(cross?.rows.brunhild).toEqual({ total: 300, split: { win: 150, loss: 150 } });
    // A row whose draw is three installs: the draw folds, and the loss goes with
    // it so the draw cannot be recovered by subtraction.
    expect(cross?.rows.anubis).toEqual({ total: 400, split: { win: 220, [OTHER]: 180 } });
    // A row where every result cell is below the gate: the row keeps its total
    // and the split is dropped entirely.
    expect(cross?.rows['marsh-mother']).toEqual({ total: 200 });
    expect(cross?.rows['marsh-mother']).not.toHaveProperty('split');
    // The fold bucket is a bag of rows that were each too small to stand alone.
    // Splitting it by result would reopen the question the fold just closed.
    expect(cross?.rows[OTHER]).toEqual({ total: 340 });
    // The rows of the cross are exactly the values the marginal published.
    expect(Object.keys(cross?.rows ?? {}).sort()).toEqual(
      Object.keys(json.duel?.dimensions.opponentId ?? {}).sort(),
    );
  });

  it('splits the cards cross by count bucket and folds the smallest, not the first', () => {
    const cross = json.cards?.crosses.cardId;
    expect(cross?.by).toBe('countBucket');
    expect(cross?.rows['db-tide-caller']).toEqual({ total: 260, split: { '1': 110, '2-3': 120, '4-7': 30 } });
    // `4-7` is 5 rows and folds; the smallest publishable is `1` at 80, not the
    // alphabetically first, and that is what joins it.
    expect(cross?.rows['db-sand-lantern']).toEqual({ total: 180, split: { '2-3': 95, [OTHER]: 85 } });
    expect(cross?.rows[OTHER]).toEqual({ total: 129 });
  });

  it('counts cards in rows, so two sub-floor cards can add up to a publishable `other`', () => {
    // 6 + 3 rows is 9, still short, so the smallest published card joins them.
    expect(json.cards?.dimensions.cardId).toEqual({
      'db-ember-scout': 300,
      'db-tide-caller': 260,
      'db-grove-warden': 240,
      'db-ash-herald': 200,
      'db-sand-lantern': 180,
      'db-quiet-tithe': 150,
      [OTHER]: 129,
    });
  });

  it('summarises the day in counts that are safe to print', () => {
    const sections = Object.fromEntries(summary.map((section) => [section.section, section]));
    expect(sections.heartbeat.present).toBe(true);
    expect(sections.duel.present).toBe(true);
    expect(sections.cards.present).toBe(true);
    for (const section of summary) {
      expect(section.published).toBeGreaterThan(0);
      expect(section.folded).toBeGreaterThan(0);
    }
  });

  it('holds the invariant: no number under a section is below the floor', () => {
    expect(() => assertNoSubFloorNumber(json)).not.toThrow();
  });
});

describe('buildDay: the day gates', () => {
  const rows = FIXTURE[BUSY_DAY];

  it('closes the heartbeat section when the day has fewer than k installs', () => {
    const { json } = buildDay({
      day: BUSY_DAY,
      build: 't2',
      rows: { ...rows, 'heartbeat.total': [{ n: '9' }] },
    });
    expect(json.heartbeat).toBeNull();
    expect(json.duel).not.toBeNull();
  });

  it('closes the duel section when fewer than k installs dueled, however many duels there were', () => {
    const { json } = buildDay({
      day: BUSY_DAY,
      build: 't2',
      rows: { ...rows, 'duel.total': [{ n: '9000', gate: '9' }] },
    });
    expect(json.duel).toBeNull();
    expect(json.heartbeat).not.toBeNull();
  });

  it('closes the cards section when the day has fewer than k card rows', () => {
    const { json } = buildDay({ day: BUSY_DAY, build: 't2', rows: { ...rows, 'cards.total': [{ n: '9' }] } });
    expect(json.cards).toBeNull();
  });

  it('still produces a whole file on a day where all three close', () => {
    const { json, summary } = buildFixtureDay(QUIET_DAY);
    expect(json).toEqual({
      schema: 1,
      day: QUIET_DAY,
      k: ROLLUP_K,
      build: 't2',
      heartbeat: null,
      duel: null,
      cards: null,
    });
    expect(summary.every((section) => !section.present)).toBe(true);
    expect(() => assertNoSubFloorNumber(json)).not.toThrow();
  });
});

describe('assertNoSubFloorNumber', () => {
  it('throws on a hand-broken object, and names no value', () => {
    const { json } = buildFixtureDay(BUSY_DAY);
    const broken = JSON.parse(JSON.stringify(json)) as Record<string, Record<string, Record<string, unknown>>>;
    (broken.heartbeat.dimensions.lang as Record<string, number>)['zz-rare-locale'] = 3;
    let message = '';
    expect(() => {
      try {
        assertNoSubFloorNumber(broken);
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
        throw error;
      }
    }).toThrow();
    // The message can reach a public Actions log, so it names the dimension and
    // redacts the value's own name and number.
    expect(message).toContain('heartbeat.dimensions.lang');
    expect(message).not.toContain('zz-rare-locale');
    expect(message).not.toMatch(/\b3\b/);
  });

  it('rejects a fractional number as well as a small one', () => {
    expect(() => assertNoSubFloorNumber({ heartbeat: { installs: 10.5 }, duel: null, cards: null })).toThrow();
    expect(() => assertNoSubFloorNumber({ heartbeat: { installs: ROLLUP_K }, duel: null, cards: null })).not.toThrow();
  });

  it('ignores the header fields, which are not counts', () => {
    // k = 10 passes on its own, but schema = 1 would fail if the walk started at
    // the root. It starts at the three sections.
    expect(() => assertNoSubFloorNumber({ schema: 1, k: 10, heartbeat: null, duel: null, cards: null })).not.toThrow();
  });
});

describe('serializeDay', () => {
  const { json } = buildFixtureDay(BUSY_DAY);
  const text = serializeDay(json);

  it('sorts every key, indents with two spaces, and ends with one newline', () => {
    expect(text.endsWith('}\n')).toBe(true);
    expect(text.split('\n')[0]).toBe('{');
    expect(text).toContain('\n  "build": "t2",');
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['build', 'cards', 'day', 'duel', 'heartbeat', 'k', 'schema']);
  });

  it('is byte-identical when the same day is built twice', () => {
    expect(serializeDay(buildFixtureDay(BUSY_DAY).json)).toBe(text);
  });

  it('is byte-identical when the input rows arrive in a different order', () => {
    const shuffled: Record<string, RawRow[]> = {};
    for (const [id, rows] of Object.entries(FIXTURE[BUSY_DAY])) shuffled[id] = [...rows].reverse();
    expect(serializeDay(buildDay({ day: BUSY_DAY, build: 't2', rows: shuffled }).json)).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// The day window
// ---------------------------------------------------------------------------

describe('daysToRoll', () => {
  const noon = (day: string): number => Date.parse(`${day}T12:00:00Z`);

  it('rolls up complete days only, back seven days, and never before the start date', () => {
    expect(daysToRoll({ startDate: '2020-01-01', nowMs: noon('2026-10-10'), existing: new Set() })).toEqual([
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
    expect(daysToRoll({ startDate: '2026-10-07', nowMs: noon('2026-10-10'), existing: new Set() })).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
  });

  it('picks exactly the missing days out of the window', () => {
    const existing = new Set(['2026-10-03', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
    expect(daysToRoll({ startDate: '2020-01-01', nowMs: noon('2026-10-10'), existing })).toEqual([
      '2026-10-04',
      '2026-10-09',
    ]);
  });

  it('has nothing to do before the start date arrives', () => {
    expect(daysToRoll({ startDate: '2026-11-01', nowMs: noon('2026-10-10'), existing: new Set() })).toEqual([]);
  });

  it('crosses a month and a year boundary', () => {
    expect(daysToRoll({ startDate: '2020-01-01', nowMs: noon('2027-01-02'), existing: new Set() })).toContain(
      '2026-12-31',
    );
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('2026-02-28')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The SQL
// ---------------------------------------------------------------------------

describe('buildQueries', () => {
  const queries = buildQueries('2026-10-01', { build: 't2', dataset: 'db_signals_v2' });

  it('filters the build and both day bounds, and counts with sum(_sample_interval)', () => {
    for (const query of queries) {
      expect(query.sql, query.id).toContain("blob2 = 't2'");
      expect(query.sql, query.id).toContain("timestamp >= toDateTime('2026-10-01 00:00:00')");
      expect(query.sql, query.id).toContain("timestamp < toDateTime('2026-10-02 00:00:00')");
      expect(query.sql, query.id).toContain('sum(_sample_interval)');
      expect(query.sql, query.id).toContain('FROM db_signals_v2');
    }
  });

  it('never uses a bare count(), and counts distinct installs only by the hash column', () => {
    for (const query of queries) {
      expect(query.sql, query.id).not.toMatch(/count\(\s*\)/);
      for (const call of query.sql.match(/count\([^)]*\)/g) ?? []) {
        expect(call, query.id).toBe('count(DISTINCT blob3)');
      }
    }
  });

  it('never counts installs on a card query, because a card row carries no hash', () => {
    for (const query of queries.filter((candidate) => candidate.id.startsWith('cards.'))) {
      expect(query.sql, query.id).not.toContain('blob3');
    }
  });

  it('asks one query per dimension, per cross, and per day total, with unique ids', () => {
    const ids = queries.map((query) => query.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('heartbeat.total');
    expect(ids).toContain('duel.total');
    expect(ids).toContain('cards.total');
    for (const dimension of HEARTBEAT_DIMENSIONS) expect(ids).toContain(`heartbeat.dim.${dimension.name}`);
    for (const dimension of DUEL_DIMENSIONS) expect(ids).toContain(`duel.dim.${dimension.name}`);
    for (const dimension of CARD_DIMENSIONS) expect(ids).toContain(`cards.dim.${dimension.name}`);
    for (const cross of DUEL_CROSSES) expect(ids).toContain(`duel.cross.${cross.first}`);
    for (const cross of CARD_CROSSES) expect(ids).toContain(`cards.cross.${cross.first}`);
    expect(ids.length).toBe(
      3 + HEARTBEAT_DIMENSIONS.length + DUEL_DIMENSIONS.length + CARD_DIMENSIONS.length + DUEL_CROSSES.length + CARD_CROSSES.length,
    );
  });

  it('walks the day bound across a month end', () => {
    const endOfMonth = buildQueries('2026-10-31', { build: 't2', dataset: 'db_signals_v2' });
    expect(endOfMonth[0].sql).toContain("timestamp < toDateTime('2026-11-01 00:00:00')");
  });

  it('refuses a build label or dataset name that could reach the SQL as something else', () => {
    expect(() => buildQueries('2026-10-01', { build: "t2' OR '1", dataset: 'db_signals_v2' })).toThrow();
    expect(() => buildQueries('2026-10-01', { build: 't2', dataset: 'db signals' })).toThrow();
    expect(() => buildQueries('not-a-day', { build: 't2', dataset: 'db_signals_v2' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// The dimension table against the schema it rolls up
// ---------------------------------------------------------------------------

describe('the dimension table covers the signal schema', () => {
  /** Excluded by design: a build hash is near-unique, and appVersion answers the question. */
  const EXCLUDED_HEARTBEAT_FIELDS = new Set(['buildSha']);

  it('covers every heartbeat field except the ones the design excludes, in both directions', () => {
    const expected = new Set<string>();
    for (const field of SIGNAL_FIELDS.heartbeat) {
      if (EXCLUDED_HEARTBEAT_FIELDS.has(field)) continue;
      if (field === 'settings') {
        for (const nested of SIGNAL_SETTINGS_FIELDS) expected.add(`settings.${nested}`);
        continue;
      }
      expected.add(field);
    }
    const covered = new Set(HEARTBEAT_DIMENSIONS.map((dimension) => dimension.name));
    expect([...covered].sort()).toEqual([...expected].sort());
  });

  it('covers every duel field, in both directions', () => {
    expect(DUEL_DIMENSIONS.map((dimension) => dimension.name).sort()).toEqual([...SIGNAL_FIELDS.duel].sort());
  });

  it('covers every card field, counting the one that is published as a cross', () => {
    const covered = new Set<string>(CARD_DIMENSIONS.map((dimension) => dimension.name));
    for (const cross of CARD_CROSSES) {
      covered.add(cross.first);
      covered.add(cross.by);
    }
    expect([...covered].sort()).toEqual([...SIGNAL_FIELDS.cards].sort());
  });

  it('crosses only dimensions that exist, and splits only by a field of the same event', () => {
    const duelNames = new Set(DUEL_DIMENSIONS.map((dimension) => dimension.name));
    for (const cross of DUEL_CROSSES) {
      expect(duelNames.has(cross.first)).toBe(true);
      expect(cross.by).toBe('result');
    }
    const cardNames = new Set(CARD_DIMENSIONS.map((dimension) => dimension.name));
    for (const cross of CARD_CROSSES) expect(cardNames.has(cross.first)).toBe(true);
  });

  it('reads one column per dimension, and never the install hash as a dimension', () => {
    const all = [...HEARTBEAT_DIMENSIONS, ...DUEL_DIMENSIONS, ...CARD_DIMENSIONS];
    for (const dimension of all) {
      expect(dimension.column, dimension.name).toMatch(/^(blob(?:[4-9]|1[0-6])|double[1-3])$/);
      expect(dimension.column, dimension.name).not.toBe('blob3');
    }
    for (const dimensions of [HEARTBEAT_DIMENSIONS, DUEL_DIMENSIONS, CARD_DIMENSIONS]) {
      const columns = dimensions.map((dimension) => dimension.column);
      expect(new Set(columns).size).toBe(columns.length);
    }
  });
});
