import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PERSONA_TEMPLATE_VERSION } from '../../scripts/personas/templates';
import {
  cardsForPool,
  readCraftJournal,
  runMetagameLoop,
  runCli,
  type MeasuredRecord,
  type MeasureOptions,
  type MetagameOptions,
  type ProposedSwap,
} from '../../scripts/personas/craft';

const pool = cardsForPool('all');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function measured(field: MeasuredRecord['field'], score = 0.5): MeasuredRecord {
  return {
    field,
    seeds: 1,
    matchups: [],
    rowWins: score === 1 ? 1 : 0,
    losses: score === 0 ? 1 : 0,
    draws: score > 0 && score < 1 ? 1 : 0,
    games: 1,
    score,
  };
}

function proposalWithIncoming(
  current: Parameters<NonNullable<MetagameOptions['propose']>>[0],
  incoming: Parameters<NonNullable<MetagameOptions['propose']>>[1][number],
): ProposedSwap {
  const outgoing = current.assigned[0];
  const assigned = current.assigned.map((entry, index) =>
    index === 0 ? { ...entry, cardId: incoming.id } : { ...entry });
  return {
    build: {
      ...current,
      assigned,
      deck: [incoming.id, ...current.deck.slice(1)],
    },
    out: outgoing.cardId,
    in: incoming.id,
    role: outgoing.role,
  };
}

const firstAvailableProposal = (
  current: Parameters<NonNullable<MetagameOptions['propose']>>[0],
  candidates: Parameters<NonNullable<MetagameOptions['propose']>>[1],
): ProposedSwap | null => {
  const outgoing = current.assigned[0];
  const incoming = candidates.find((card) =>
    !card.types.includes('land') &&
    !card.token &&
    card.id !== outgoing.cardId &&
    !current.deck.includes(card.id) &&
    card.colors.every((color) => current.selectedColors.includes(color)));
  return incoming ? proposalWithIncoming(current, incoming) : null;
};

describe('persona metagame loop', () => {
  it('keeps round 0 byte-identical to the v1 craft through the real measure path', () => {
    const singleDir = mkdtempSync(join(tmpdir(), 'darling-persona-single-'));
    const metagameDir = mkdtempSync(join(tmpdir(), 'darling-persona-metagame-'));
    tempDirs.push(singleDir, metagameDir);
    const common = ['--field', 'starters', '--pool', 'all', '--seeds', '1', '--iterations', '0', '--seed', '424242'];
    expect(runCli(['--persona', 'burn', '--out', singleDir, ...common], {
      today: () => '2026-07-23',
      log: () => undefined,
    })).toBe(0);
    expect(runCli(['--metagame', '--personas', 'burn,weenie', '--rounds', '1', '--out', metagameDir, ...common], {
      today: () => '2026-07-23',
      log: () => undefined,
    })).toBe(0);

    const single = JSON.parse(readFileSync(join(singleDir, '2026-07-23-burn-all.json'), 'utf8'));
    const metagame = JSON.parse(readFileSync(join(metagameDir, '2026-07-23-metagame-burn-all.json'), 'utf8'));
    const round0 = metagame.metagame.rounds[0];
    expect(round0.seed).toBe(single.seed);
    expect(JSON.stringify(round0.deck)).toBe(JSON.stringify(single.deck));
    expect(JSON.stringify(round0.counts)).toBe(JSON.stringify(single.counts));
    expect(JSON.stringify(round0.selectedColors)).toBe(JSON.stringify(single.selectedColors));
    expect(JSON.stringify(round0.measured)).toBe(JSON.stringify(single.measured));
    expect(JSON.stringify(round0.hillClimb)).toBe(JSON.stringify(single.hillClimb));
    // Real games through the real measure path: CI runners measured >15s (timed
    // out PR #104's first verify run); the cap only bounds the failure case.
  }, 120000);

  it('records the other retained lists and is byte-deterministic', () => {
    const options = {
      poolId: 'all',
      pool,
      field: 'starters' as const,
      seeds: 1,
      iterations: 0,
      seed: 77,
      maxRounds: 3,
      personaIds: ['burn', 'weenie'],
      measure: (_deck: readonly string[], measureOptions: MeasureOptions) => measured(measureOptions.field),
    };
    const progress: Array<{ phase: string; round: number; personaId: string; personaIndex: number }> = [];
    const first = runMetagameLoop({
      ...options,
      onProgress: ({ phase, round, personaId, personaIndex }) =>
        progress.push({ phase, round, personaId, personaIndex }),
    });
    const second = runMetagameLoop(options);

    // The dashboard hook is a pure observer: identical results with or
    // without it, and it fires once per persona per crafted round in order.
    expect(progress).toEqual([
      { phase: 'seed', round: 0, personaId: 'burn', personaIndex: 0 },
      { phase: 'seed', round: 0, personaId: 'weenie', personaIndex: 1 },
      { phase: 'round', round: 1, personaId: 'burn', personaIndex: 0 },
      { phase: 'round', round: 1, personaId: 'weenie', personaIndex: 1 },
    ]);
    expect(JSON.stringify(first.artifacts)).toBe(JSON.stringify(second.artifacts));
    expect(first.summary).toMatchObject({ stoppedReason: 'stable-decks', completedRounds: 1, converged: true });
    const burn = first.artifacts.find((artifact) => artifact.persona.id === 'burn')!;
    const weenie = first.artifacts.find((artifact) => artifact.persona.id === 'weenie')!;
    expect(burn.mode).toBe('metagame-loop');
    expect(burn.field).toBe('personas');
    expect(burn.metagame!.rounds).toHaveLength(2);
    expect(burn.metagame!.rounds[0].round).toBe(0);
    expect(burn.metagame!.rounds[0].fieldComposition.every((entry) => entry.kind === 'static')).toBe(true);
    const opponent = burn.metagame!.rounds[1].fieldComposition.find((entry) => entry.personaId === 'weenie');
    expect(opponent).toMatchObject({ kind: 'persona', id: 'persona-weenie', name: 'The Weenie Player' });
    expect(opponent!.deck).toEqual(weenie.metagame!.rounds[0].deck);
    expect(burn.metagame!.rounds[1]).toMatchObject({
      round: 1,
      templateVersion: PERSONA_TEMPLATE_VERSION,
      measured: { field: 'personas' },
    });
  });

  it('uses prior-round fields for every response in a round', () => {
    const candidateByPersona = new Map<string, string>();
    const result = runMetagameLoop({
      poolId: 'all',
      pool,
      field: 'starters',
      seeds: 1,
      iterations: 1,
      seed: 91,
      maxRounds: 1,
      personaIds: ['burn', 'weenie'],
      measure: (deck, options) => {
        if (options.field !== 'personas') return measured(options.field, 0);
        const candidate = candidateByPersona.get(options.personaId);
        return measured(options.field, options.personaId === 'burn' && candidate === deck[0] ? 1 : 0);
      },
      propose: (current, candidates, template) => {
        const proposal = firstAvailableProposal(current, candidates);
        if (proposal) candidateByPersona.set(template.id, proposal.in);
        return proposal;
      },
    });
    const burn = result.artifacts.find((artifact) => artifact.persona.id === 'burn')!;
    const weenie = result.artifacts.find((artifact) => artifact.persona.id === 'weenie')!;
    const burnRound0 = burn.metagame!.rounds[0];
    const burnRound1 = burn.metagame!.rounds[1];
    const weenieRound1 = weenie.metagame!.rounds[1];
    const burnFieldEntry = weenieRound1.fieldComposition.find((entry) => entry.personaId === 'burn');

    expect(burnRound1.deck).not.toEqual(burnRound0.deck);
    expect(burnFieldEntry?.deck).toEqual(burnRound0.deck);
    expect(result.summary).toMatchObject({ stoppedReason: 'max-rounds', completedRounds: 1 });
  });

  it('keeps the first occurrence and measures period from the last occurrence', () => {
    const proposalCalls = new Map<string, number>();
    const usedIncoming = new Map<string, Set<string>>();
    const desiredBurnByWeenie = new Map<string, string>();
    const burnStates: string[] = [];
    let desiredBurnIndex = 0;
    const measureCalls = new Map<string, number>();
    const propose: NonNullable<MetagameOptions['propose']> = (current, candidates, template) => {
      const call = (proposalCalls.get(template.id) ?? 0) + 1;
      proposalCalls.set(template.id, call);
      if (call === 1) {
        if (template.id === 'burn') {
          const available = candidates.filter((card) =>
            !card.types.includes('land') &&
            !card.token &&
            !current.deck.includes(card.id) &&
            card.colors.every((color) => current.selectedColors.includes(color)));
          if (available.length < 2) throw new Error('period test needs two available burn cards');
          burnStates.push(current.deck[0], available[0].id, available[1].id);
        }
        return null;
      }
      const used = usedIncoming.get(template.id) ?? new Set<string>([current.deck[0]]);
      usedIncoming.set(template.id, used);
      const incomingId = template.id === 'burn'
        ? [burnStates[1], burnStates[1], burnStates[2], burnStates[0]][call - 2]
        : undefined;
      const incoming = candidates.find((card) =>
        !card.types.includes('land') &&
        !card.token &&
        !current.deck.includes(card.id) &&
        (template.id === 'burn' || !used.has(card.id)) &&
        (incomingId === undefined || card.id === incomingId) &&
        card.colors.every((color) => current.selectedColors.includes(color)));
      if (!incoming) return null;
      used.add(incoming.id);
      return proposalWithIncoming(current, incoming);
    };
    const result = runMetagameLoop({
      poolId: 'all',
      pool,
      field: 'starters',
      seeds: 1,
      iterations: 1,
      seed: 91,
      maxRounds: 4,
      personaIds: ['burn', 'weenie'],
      measure: (deck, options) => {
        const count = (measureCalls.get(options.personaId) ?? 0) + 1;
        measureCalls.set(options.personaId, count);
        if (options.field !== 'personas') return measured(options.field, 0);
        if (options.personaId === 'weenie') return measured(options.field, count % 2 === 1 ? 1 : 0);
        const opponent = options.fieldComposition?.find((entry) => entry.personaId === 'weenie');
        let desired = opponent ? desiredBurnByWeenie.get(opponent.deck[0]) : undefined;
        if (opponent && !desired) {
          desired = [burnStates[0], burnStates[1], burnStates[2], burnStates[0]][desiredBurnIndex++];
          desiredBurnByWeenie.set(opponent.deck[0], desired);
        }
        if (!desired) throw new Error('period test missing desired burn state');
        return measured(options.field, deck[0] === desired ? 1 : 0);
      },
      propose,
    });
    expect(result.summary).toMatchObject({
      stoppedReason: 'oscillation',
      converged: false,
      completedRounds: 4,
      oscillatingPersonas: ['burn'],
    });
    expect(result.summary.oscillations).toEqual([
      expect.objectContaining({ personaId: 'burn', firstRound: 0, repeatRound: 4, period: 3 }),
    ]);
    expect(result.artifacts.find((artifact) => artifact.persona.id === 'burn')!.honesty.oscillating).toBe(true);
    expect(result.artifacts.find((artifact) => artifact.persona.id === 'weenie')!.honesty.oscillating).toBe(false);
  });

  it('reports max-rounds when the cap arrives before stability or oscillation', () => {
    const measureCalls = new Map<string, number>();
    const result = runMetagameLoop({
      poolId: 'all',
      pool,
      field: 'starters',
      seeds: 1,
      iterations: 1,
      seed: 109,
      maxRounds: 1,
      personaIds: ['burn', 'weenie'],
      measure: (_deck, options) => {
        const count = (measureCalls.get(options.personaId) ?? 0) + 1;
        measureCalls.set(options.personaId, count);
        return measured(options.field, options.field === 'personas' && count % 2 === 0 ? 1 : 0);
      },
      propose: firstAvailableProposal,
    });
    expect(result.summary).toMatchObject({
      stoppedReason: 'max-rounds',
      completedRounds: 1,
      maxRounds: 1,
      converged: false,
    });
  });

  it('checkpoints every round boundary so a killed passive run keeps its rounds', () => {
    const options = {
      poolId: 'all',
      pool,
      field: 'starters' as const,
      seeds: 1,
      iterations: 0,
      seed: 77,
      maxRounds: 3,
      personaIds: ['burn', 'weenie'],
      measure: (_deck: readonly string[], measureOptions: MeasureOptions) => measured(measureOptions.field),
    };
    const checkpoints: Array<{ rounds: number; reason: string; converged: boolean; personas: number }> = [];
    const withHook = runMetagameLoop({
      ...options,
      onCheckpoint: (artifacts, summary) => checkpoints.push({
        rounds: summary.completedRounds,
        reason: summary.stoppedReason,
        converged: summary.converged,
        personas: artifacts.length,
      }),
    });
    const without = runMetagameLoop(options);

    // Fires after the seed pass and after each completed round, so the recovery
    // granularity is exactly one round rather than the whole run.
    expect(checkpoints).toEqual([
      { rounds: 0, reason: 'in-progress', converged: false, personas: 2 },
      { rounds: 1, reason: 'in-progress', converged: false, personas: 2 },
    ]);
    // Pure observer, exactly like onProgress: identical results either way.
    expect(JSON.stringify(withHook.artifacts)).toBe(JSON.stringify(without.artifacts));
  });

  it('carries usable rounds in a checkpoint artifact, never a finished-looking one', () => {
    const seen: Array<Record<string, unknown>> = [];
    runMetagameLoop({
      poolId: 'all',
      pool,
      field: 'starters',
      seeds: 1,
      iterations: 0,
      seed: 77,
      maxRounds: 3,
      personaIds: ['burn', 'weenie'],
      measure: (_deck, measureOptions) => measured(measureOptions.field),
      onCheckpoint: (artifacts) => seen.push(JSON.parse(JSON.stringify(artifacts[0]))),
    });

    // A checkpoint is the SAME artifact shape a finished run produces, so a
    // crashed sweep's output is readable directly. The seed checkpoint already
    // carries round 0's crafted deck and its measurement.
    const seedCheckpoint = seen[0] as {
      deck: string[];
      metagame: { summary: { stoppedReason: string; converged: boolean }; rounds: unknown[] };
    };
    expect(seedCheckpoint.deck.length).toBeGreaterThan(0);
    expect(seedCheckpoint.metagame.rounds).toHaveLength(1);
    // The one thing that must never be mistakable: a partial is not converged.
    expect(seedCheckpoint.metagame.summary.stoppedReason).toBe('in-progress');
    expect(seedCheckpoint.metagame.summary.converged).toBe(false);
  });

  it('overwrites its own checkpoints, so a completed run leaves no partial files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'darling-persona-checkpoint-'));
    tempDirs.push(dir);
    expect(runCli([
      '--metagame', '--personas', 'burn,weenie', '--rounds', '1', '--out', dir,
      '--field', 'starters', '--pool', 'all', '--seeds', '1', '--iterations', '0', '--seed', '424242',
    ], { today: () => '2026-08-24', log: () => undefined })).toBe(0);

    // Checkpoint paths ARE the final paths. A finished run therefore ends with
    // exactly the artifacts it always wrote, with no 'in-progress' left behind.
    for (const personaId of ['burn', 'weenie']) {
      const artifact = JSON.parse(
        readFileSync(join(dir, `2026-08-24-metagame-${personaId}-all.json`), 'utf8'),
      );
      expect(artifact.metagame.summary.stoppedReason).not.toBe('in-progress');
    }
  }, 120000);

  it('publishes format and checkpoint progress to the sweep dashboard status file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'darling-persona-status-'));
    tempDirs.push(dir);
    const statusPath = join(dir, 'status.json');
    expect(runCli([
      '--metagame', '--personas', 'burn,weenie', '--rounds', '1', '--out', dir,
      '--status-file', statusPath,
      '--field', 'starters', '--pool', 'all', '--seeds', '1', '--iterations', '0', '--seed', '424242',
    ], { today: () => '2026-08-25', log: () => undefined })).toBe(0);

    const status = JSON.parse(readFileSync(statusPath, 'utf8'));
    // The format is on screen because this harness measured the RETIRED classic
    // format until 2026-08-25 and the dashboard never said which one it was.
    expect(status.format).toBe('warchest');
    expect(status.state).toBe('done');
    // The dashboard sizes its staleness warning off the last checkpoint, so an
    // unattended multi-day run can be seen to be safe rather than merely alive.
    expect(status.checkpoint).toMatchObject({ artifacts: 2, completedRounds: 1 });
    expect(typeof status.checkpoint.at).toBe('string');
  }, 120000);

  it('reports each finished craft as it lands, not only at the round boundary', () => {
    const finished: Array<{ round: number; index: number; score: number }> = [];
    runMetagameLoop({
      poolId: 'all',
      pool,
      field: 'starters',
      seeds: 1,
      iterations: 0,
      seed: 77,
      maxRounds: 1,
      personaIds: ['burn', 'weenie'],
      measure: (_deck, options) => measured(options.field),
      onCraftComplete: (round, personaIndex) =>
        finished.push({ round: round.round, index: personaIndex, score: round.measured.score }),
    });

    // A round takes HOURS. Checkpoints are durability and fire at round
    // boundaries; this hook is visibility and fires per craft, so a dashboard
    // can show one persona's result without waiting out the rest of the round.
    expect(finished.map((f) => `${f.round}:${f.index}`)).toEqual(['0:0', '0:1', '1:0', '1:1']);
    expect(finished.every((f) => typeof f.score === 'number')).toBe(true);
  });

  it('accumulates finished crafts in the status file for the dashboard', () => {
    const dir = mkdtempSync(join(tmpdir(), 'darling-persona-crafts-'));
    tempDirs.push(dir);
    const statusPath = join(dir, 'status.json');
    expect(runCli([
      '--metagame', '--personas', 'burn,weenie', '--rounds', '1', '--out', dir,
      '--status-file', statusPath,
      '--field', 'starters', '--pool', 'all', '--seeds', '1', '--iterations', '0', '--seed', '424242',
    ], { today: () => '2026-08-25', log: () => undefined })).toBe(0);

    const status = JSON.parse(readFileSync(statusPath, 'utf8'));
    expect(status.finishedCrafts).toHaveLength(4);
    // personaId AND personaIndex both matter: artifacts sort by id, which is not
    // the order personaIndex counts in, so the dashboard needs the pairing to
    // label pips and highlight the active persona correctly.
    expect(status.finishedCrafts[0]).toMatchObject({ round: 0, personaIndex: 0, personaId: 'burn' });
    expect(status.finishedCrafts[1]).toMatchObject({ round: 0, personaIndex: 1, personaId: 'weenie' });
    for (const craft of status.finishedCrafts) {
      expect(typeof craft.score).toBe('number');
      expect(typeof craft.finishedAt).toBe('string');
    }
  }, 120000);

  /**
   * The 2026-08-25 sweep died 4h36 in with TWO crafts finished and nothing on
   * disk, because checkpoints only fired at round boundaries and the seed round
   * alone runs about nine hours. The journal is written per craft and
   * synchronously so that can never cost more than the craft in flight.
   */
  describe('crash durability and resume', () => {
    const run = (dir: string, extra: string[] = []): number => runCli([
      '--metagame', '--personas', 'burn,weenie', '--rounds', '1', '--out', dir,
      '--field', 'starters', '--pool', 'all', '--seeds', '1', '--iterations', '0',
      '--seed', '424242', ...extra,
    ], { today: () => '2026-08-25', log: () => undefined });

    it('journals every finished craft, not just every finished round', () => {
      const dir = mkdtempSync(join(tmpdir(), 'darling-journal-'));
      tempDirs.push(dir);
      expect(run(dir)).toBe(0);
      const journal = readCraftJournal(join(dir, 'craft-journal.jsonl'));
      // 2 personas x (seed round + 1 best-response round)
      expect(journal.size).toBe(4);
      expect([...journal.keys()].sort()).toEqual(['0:burn', '0:weenie', '1:burn', '1:weenie']);
    });

    it('resumes to a byte-identical result after losing everything but the journal', () => {
      const first = mkdtempSync(join(tmpdir(), 'darling-resume-a-'));
      const second = mkdtempSync(join(tmpdir(), 'darling-resume-b-'));
      tempDirs.push(first, second);
      expect(run(first)).toBe(0);
      const baseline = readFileSync(join(first, '2026-08-25-metagame-burn-all.json'), 'utf8');

      // Simulate a kill after the seed round: keep only round 0 in the journal,
      // and no artifacts at all.
      const lines = readFileSync(join(first, 'craft-journal.jsonl'), 'utf8')
        .split('\n').filter((l) => l.trim());
      const partial = lines.filter((l) => (JSON.parse(l) as { round: number }).round === 0);
      expect(partial).toHaveLength(2);
      writeFileSync(join(second, 'craft-journal.jsonl'), `${partial.join('\n')}\n`, 'utf8');

      expect(run(second, ['--resume'])).toBe(0);
      // Craft seeds derive from run seed + round + persona id, so a resumed run
      // must be indistinguishable from one that was never interrupted.
      expect(readFileSync(join(second, '2026-08-25-metagame-burn-all.json'), 'utf8')).toBe(baseline);
    }, 120000);

    it('keeps every complete entry when the journal was cut mid-write', () => {
      // A killed process can leave a half-written final line. Losing that entry
      // is correct; losing the ones before it is not.
      const dir = mkdtempSync(join(tmpdir(), 'darling-torn-'));
      tempDirs.push(dir);
      const path = join(dir, 'craft-journal.jsonl');
      const good = JSON.stringify({ round: 0, personaId: 'burn', seed: 1, crafted: { round: 0 } });
      writeFileSync(path, `${good}\n{"round":0,"personaId":"wee`, 'utf8');
      expect(readCraftJournal(path).size).toBe(1);
    });

    it('returns an empty map when there is no journal yet', () => {
      expect(readCraftJournal(join(tmpdir(), 'no-such-journal.jsonl')).size).toBe(0);
    });
  });

  it('documents the loop policy in CLI help', () => {
    const output: string[] = [];
    expect(runCli(['--help'], { log: (line) => output.push(line) })).toBe(0);
    expect(output.join('\n')).toContain('--metagame');
    expect(output.join('\n')).toContain('repeated non-stable deck as OSCILLATION');
  });
});
