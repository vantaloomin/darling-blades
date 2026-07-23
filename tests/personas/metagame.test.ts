import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cardsForPool,
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
    const first = runMetagameLoop(options);
    const second = runMetagameLoop(options);

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
      templateVersion: 'persona-v1.0.0',
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

  it('documents the loop policy in CLI help', () => {
    const output: string[] = [];
    expect(runCli(['--help'], { log: (line) => output.push(line) })).toBe(0);
    expect(output.join('\n')).toContain('--metagame');
    expect(output.join('\n')).toContain('repeated non-stable deck as OSCILLATION');
  });
});
