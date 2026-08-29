import { describe, expect, it } from 'vitest';
import { CARD_DB } from '../../src/data/catalog';
import { AVATARS } from '../../src/data/opponents';
import { STARTER_DECKS } from '../../src/data/starterDecks';
import type { CardDb, CardDef } from '../../src/engine/types';
import { validateDarlingsDeck, validateWarchestDeck } from '../../src/meta/darlings';
import {
  isBasicLand,
  isDualLand,
  LAND_RESERVE_SIZE,
  MAX_DUAL_LANDS,
  WARCHEST_DECK_SIZE,
  DARLINGS_DECK_SIZE,
} from '../../src/meta/warchest';
import {
  convertAvatarReserveDecks,
  convertAvatarWarchest,
  deckTargetSupply,
  hasNoLegalTargets,
} from '../../scripts/avatarReserveDecks';
import { buildDarlingsDeck } from '../../scripts/darlingsDeckBuilder';
import { buildReserveMatrixFullOwnershipSave } from '../../scripts/reserveMatrixDecks';
import { runAvatarReserveMatrix } from '../../scripts/balance-matrix';

const save = buildReserveMatrixFullOwnershipSave(CARD_DB);
const PRE_STARBORNE_DB: CardDb = Object.fromEntries(
  Object.entries(CARD_DB).filter(([id]) => !id.startsWith('sb-')),
) as CardDb;

describe('avatar reserve-native deck data (1.6 migration stage 2)', () => {
  for (const avatar of AVATARS) {
    it(`${avatar.id}: reserveDeck, landReserve, and darlingsDeck are shipping-legal`, () => {
      expect(avatar.reserveDeck).toHaveLength(WARCHEST_DECK_SIZE);
      expect(validateWarchestDeck(CARD_DB, save, avatar.reserveDeck, avatar.landReserve)).toEqual([]);
      expect(avatar.landReserve).toHaveLength(LAND_RESERVE_SIZE);
      const duals = avatar.landReserve.filter((id) => isDualLand(CARD_DB[id]));
      expect(duals.length).toBeLessThanOrEqual(MAX_DUAL_LANDS);
      for (const id of avatar.landReserve) {
        const card = CARD_DB[id];
        expect(isBasicLand(card) || isDualLand(card), `${id} is not a basic or dual`).toBe(true);
      }

      expect(avatar.darlingsDeck).toHaveLength(DARLINGS_DECK_SIZE);
      expect(
        validateDarlingsDeck(CARD_DB, save, avatar.darlingsDeck, avatar.darlingId, avatar.landReserve),
      ).toEqual([]);

      // Portraits cost zero new art: the classic idiom carries over. The
      // portrait card leads the Warchest list (or IS the Darling).
      expect(
        avatar.reserveDeck.includes(avatar.portraitCardId) || avatar.darlingId === avatar.portraitCardId,
        `${avatar.id} portrait ${avatar.portraitCardId} missing from reserveDeck`,
      ).toBe(true);
    });
  }

  /*
   * Avatars whose reserve data has been hand-tuned away from the scripted
   * first cut, with the dated reason. Each entry is a deliberate divergence;
   * the legality tests above still cover them in full.
   *   morgan — 2026-08-08 pass 2, RETAINED 2026-08-09: reshaped a flat mv3
   *   pile (only 2 cards below mv3, four 6-drops) into a real curve, 32% ->
   *   48%. Re-measured against the quality-led builder and kept, 52% to 46%.
   *   hel — 2026-08-09 ARCHETYPE REPAIR. Her first hand-tune was dropped when
   *   the builder beat it 33% to 21%, but the builder cannot fix her: its
   *   curve cap deletes the expensive payoffs a reanimator exists to cheat
   *   into play, so it is archetype-blind here. This build gives the engine
   *   real targets (Siege Juggernaut, Bronze Colossus). See opponents.ts.
   *
   * Hand tuning only earns an exception while it still measures better than
   * the builder; both entries above were re-tested under that rule.
   */
  // 2026-08-22 Dark Tales companion balance touch: only rung 17 kept its
  // hand-tuned adoption. Measured at 40 seeds/cell over 12 columns, the
  // builder baseline vs the hand tune: R17 76% -> 79% (floor 70.5, KEPT);
  // R18 86% -> 61% -> 66% -> 73% over two allowed iterations (floor 77.5,
  // REVERTED); R19 60% -> 55% -> 55% -> 51% (floor 55.5, REVERTED). The
  // exemption rule is unchanged: a hand tune only holds while it still
  // measures better than the builder, and the flip re-tests R17 against the
  // gate-open builder.
  // 2026-08-23 rung-21 tuning pass: anubis-who-holds-the-scale joins on the
  // same archetype-blindness grounds as hel. Her converter build measured 33%
  // on the (now reserve-native) avatar matrix with a 10% worst cell; the hand
  // tune measures 57%, so the exemption is earned under the standing rule.
  // The converter now rejects that same dead-target shape for ANY avatar: it
  // would otherwise retain sd-strike-the-lintel x4 (targets
  // artifactOrEnchantment) into a format whose five starter columns contain
  // zero artifacts and zero enchantments. Full evidence chain in opponents.ts.
  const HAND_TUNED_WARCHEST = new Set([
    'morgan',
    'hel',
    'glass-coffin-queen',
    'anubis-who-holds-the-scale',
    'the-bride',
  ]);

  /**
   * Retention eligibility asks whether a card's narrow target can exist in the
   * format. That keeps sd-strike-the-lintel out of Anubis against five starter
   * columns holding ZERO artifacts and ZERO enchantments. The same gate also
   * covers marked-target cards when no card in the format can add a mark.
   */
  describe('retention rejects cards whose targets cannot exist in the format', () => {
    const supplyFor = (source: readonly string[]): ReadonlySet<string> => new Set([
      ...deckTargetSupply(STARTER_DECKS.flatMap((deck) => deck.reserveCards ?? [])),
      ...deckTargetSupply(source),
    ]);

    it('the five starter columns really do supply no artifact or enchantment', () => {
      // The premise the whole defect rests on. If a future set puts an artifact
      // into a starter column - or a creature that token-creates one, which
      // deckTargetSupply now sees - these cards stop being dead and this test
      // says so. Mark generators are a separate supply dimension.
      const columnSupply = deckTargetSupply(STARTER_DECKS.flatMap((deck) => deck.reserveCards ?? []));
      expect([...columnSupply].filter((what) => what !== 'marked')).toEqual([]);
      expect(columnSupply.has('marked')).toBe(true);
    });

    it('no avatar converter build ships a dead-target card', () => {
      for (const avatar of AVATARS) {
        const built = convertAvatarReserveDecks(avatar).reserveDeck;
        const supply = supplyFor(avatar.deck);
        const dead = built.filter((id) => hasNoLegalTargets(CARD_DB[id], supply));
        expect(dead, `${avatar.id} retained dead-target cards`).toEqual([]);
        // The freed slots must refill, not leave a short deck.
        expect(built).toHaveLength(WARCHEST_DECK_SIZE);
      }
    });

    it('drops the exact card that caused the Anubis regression', () => {
      const anubis = AVATARS.find((a) => a.id === 'anubis-who-holds-the-scale')!;
      // Still in her classic source list; the gate is what keeps it out.
      expect(anubis.deck).toContain('sd-strike-the-lintel');
      expect(convertAvatarReserveDecks(anubis).reserveDeck).not.toContain('sd-strike-the-lintel');
    });

    it('keeps a narrow-target card when the format can answer it', () => {
      // Not a blanket ban on artifactOrEnchantment removal: supply one and the
      // card is live again. Otherwise this gate would misfire on a future set.
      const artifactId = Object.values(CARD_DB).find((c) => c.types.includes('artifact'))?.id;
      expect(artifactId, 'pool has no artifact to test with').toBeDefined();
      const lintel = CARD_DB['sd-strike-the-lintel'];
      expect(hasNoLegalTargets(lintel, new Set())).toBe(true);
      expect(hasNoLegalTargets(lintel, new Set(['artifactOrEnchantment']))).toBe(false);
    });

    it('rejects a dead targeted arrival exactly like a dead spell target', () => {
      const spellSide: CardDef = {
        id: 'synthetic-spell-narrow',
        name: 'Synthetic Spell Narrow',
        types: ['charm'],
        subtypes: [],
        colors: ['R'],
        abilities: [{ when: 'spell', targets: [{ what: 'artifact' }], ops: [{ op: 'sever', to: 'target' }] }],
        rarity: 'c',
      };
      const arrival: CardDef = {
        ...spellSide,
        id: 'synthetic-arrival-narrow',
        name: 'Synthetic Arrival Narrow',
        types: ['creature'],
        attack: 1,
        defense: 1,
        abilities: [{ when: 'arrives', targets: [{ what: 'artifact' }], ops: [{ op: 'sever', to: 'target' }] }],
      };

      expect(hasNoLegalTargets(spellSide, new Set())).toBe(true);
      expect(hasNoLegalTargets(arrival, new Set())).toBe(true);
      expect(hasNoLegalTargets(arrival, new Set(['artifact']))).toBe(false);
    });

    it('requires a mark generator for marked targets, but not for tapped targets', () => {
      const markedAnswer: CardDef = {
        id: 'synthetic-marked-answer',
        name: 'Synthetic Marked Answer',
        types: ['charm'],
        subtypes: [],
        colors: ['R'],
        abilities: [{
          when: 'spell',
          targets: [{ what: 'creature', marked: true }],
          ops: [{ op: 'sever', to: 'target' }],
        }],
        rarity: 'c',
      };
      const markGenerator: CardDef = {
        id: 'synthetic-mark-generator',
        name: 'Synthetic Mark Generator',
        types: ['creature'],
        subtypes: [],
        colors: ['R'],
        abilities: [{ when: 'arrives', ops: [{ op: 'addCounters', n: 1, to: 'self' }] }],
        rarity: 'c',
      };
      const propagateOnly: CardDef = {
        ...markGenerator,
        id: 'synthetic-propagate-only',
        name: 'Synthetic Propagate Only',
        abilities: [{ when: 'arrives', ops: [{ op: 'propagate' }] }],
      };
      const moveOnly: CardDef = {
        ...markGenerator,
        id: 'synthetic-move-only',
        name: 'Synthetic Move Only',
        abilities: [{ when: 'arrives', ops: [{ op: 'moveMark' }] }],
      };
      const tappedAnswer: CardDef = {
        ...markedAnswer,
        id: 'synthetic-tapped-answer',
        name: 'Synthetic Tapped Answer',
        abilities: [{
          when: 'spell',
          targets: [{ what: 'creature', tapped: true }],
          ops: [{ op: 'sever', to: 'target' }],
        }],
      };
      const db: CardDb = {
        [markedAnswer.id]: markedAnswer,
        [markGenerator.id]: markGenerator,
        [propagateOnly.id]: propagateOnly,
        [moveOnly.id]: moveOnly,
        [tappedAnswer.id]: tappedAnswer,
      };

      expect(deckTargetSupply([markedAnswer.id], db).has('marked')).toBe(false);
      expect(hasNoLegalTargets(markedAnswer, deckTargetSupply([markedAnswer.id], db))).toBe(true);
      expect(deckTargetSupply([markedAnswer.id, propagateOnly.id, moveOnly.id], db).has('marked')).toBe(false);
      expect(deckTargetSupply([markedAnswer.id, markGenerator.id], db).has('marked')).toBe(true);
      expect(hasNoLegalTargets(markedAnswer, deckTargetSupply([markedAnswer.id, markGenerator.id], db))).toBe(false);
      expect(hasNoLegalTargets(tappedAnswer, new Set())).toBe(false);
    });

    it('never rejects a card whose targets are ordinary creatures', () => {
      const creatureRemoval = Object.values(CARD_DB).filter((card) =>
        (card.abilities ?? []).some((a) => (a.targets ?? []).some((t) => t.what === 'creature' && !t.marked)));
      expect(creatureRemoval.length).toBeGreaterThan(0);
      for (const card of creatureRemoval) {
        expect(hasNoLegalTargets(card, new Set()), `${card.id} wrongly flagged`).toBe(false);
      }
    });

    it('also excludes a dead-target card from catalog refill', () => {
      const narrowId = 'synthetic-refill-narrow';
      const fillerIds = Array.from({ length: 36 }, (_, index) => `synthetic-refill-filler-${index}`);
      const filler = (id: string): CardDef => ({
        id,
        name: id,
        types: ['creature'],
        subtypes: ['Filler'],
        cost: { generic: 1, pips: { R: 1 } },
        colors: ['R'],
        attack: 1,
        defense: 1,
        rarity: 'c',
      });
      const db: CardDb = {
        'synthetic-red-basic': {
          id: 'synthetic-red-basic',
          name: 'Synthetic Mountain',
          types: ['land'],
          subtypes: [],
          supertypes: ['basic'],
          colors: [],
          manaAbility: ['R'],
          rarity: 'c',
        },
        'synthetic-source-body': {
          id: 'synthetic-source-body',
          name: 'Synthetic Source Body',
          types: ['creature'],
          subtypes: ['Source'],
          cost: { generic: 1, pips: { R: 1 } },
          colors: ['R'],
          attack: 1,
          defense: 1,
          rarity: 'c',
        },
        [narrowId]: {
          id: narrowId,
          name: 'Synthetic Narrow Answer',
          types: ['charm'],
          subtypes: [],
          cost: { generic: 0, pips: { R: 1 } },
          colors: ['R'],
          abilities: [{
            when: 'spell',
            targets: [{ what: 'artifactOrEnchantment' }],
            ops: [{ op: 'destroy', to: 'target' }],
          }],
          rarity: 'ur',
        },
        ...Object.fromEntries(fillerIds.map((id) => [id, filler(id)])),
      };
      const avatar = {
        id: 'synthetic-supply-poor',
        name: 'Synthetic Supply Poor',
        deck: [
          ...Array.from({ length: 4 }, () => 'synthetic-source-body'),
          narrowId,
          ...Array.from({ length: 55 }, () => 'synthetic-red-basic'),
        ],
      };

      const built = convertAvatarWarchest(avatar, db);

      expect(built).toHaveLength(WARCHEST_DECK_SIZE);
      expect(built).not.toContain(narrowId);
      expect(built.filter((id) => fillerIds.includes(id))).toHaveLength(fillerIds.length);
    });
  });

  /**
   * The Warchest gate above runs at conversion time; Darlings lists are
   * authored by the themed builder and hand tunes, which have no such gate.
   * The 2026-08-28 scan showed every committed list already self-supplies its
   * narrow targets - the 79-card in-colour singleton fill sweeps in colorless
   * artifact staples, 9-28 artifact/enchantment permanents per deck - so this
   * ratchets that property in: a card is judged against what its OWN deck can
   * put on the board (types plus token creation), the one supply that exists
   * in every matchup including a supply-free mirror.
   */
  it('every committed darlingsDeck self-supplies its narrow-target cards', () => {
    for (const avatar of AVATARS) {
      const list = [...avatar.darlingsDeck, avatar.darlingId];
      const supply = deckTargetSupply(list);
      const dead = list.filter((id) => hasNoLegalTargets(CARD_DB[id], supply));
      expect(dead, `${avatar.id} darlingsDeck carries dead-target cards`).toEqual([]);
    }
  });

  it('untuned committed data IS the deterministic converter output', () => {
    // Card-content identity, order-insensitive: the committed literals group
    // duplicates via expand() while the converter emits raw append order, and
    // list order only feeds the seeded shuffle.
    const sorted = (cards: readonly string[]): string[] => [...cards].sort();
    for (const avatar of AVATARS) {
      // The historical pre-Starborne fixture intentionally excludes sb-*;
      // the new Starborne avatar must be checked against the live catalog.
      const sourceDb = avatar.id === 'chrome-broodmother' || avatar.id === 'the-violet-signal-queen'
        ? CARD_DB
        : PRE_STARBORNE_DB;
      const first = convertAvatarReserveDecks(avatar, sourceDb);
      const second = convertAvatarReserveDecks(avatar, sourceDb);
      expect(first, `${avatar.id} converter is not deterministic`).toEqual(second);
      expect(sorted(first.landReserve)).toEqual(sorted(avatar.landReserve));
      if (avatar.id === 'chrome-broodmother' || avatar.id === 'the-violet-signal-queen') {
        // Starborne's classic, reserve, and land lists are locked authored
        // contract fields. Only the Darlings surface is converter-owned here.
        expect(sorted(first.darlingsDeck)).toEqual(sorted(avatar.darlingsDeck));
        expect(first.darlingId).toEqual(avatar.darlingId);
        continue;
      }
      if (HAND_TUNED_WARCHEST.has(avatar.id)) {
        // 2026-08-21 live-pool pin: Morgan and Hel retain their hand-tuned
        // reserve literals, including their authored Darlings lists.
        expect(sorted(first.reserveDeck), `${avatar.id} is listed as hand-tuned but matches the first cut`)
          .not.toEqual(sorted(avatar.reserveDeck));
        continue;
      }
      // darlingsDeck is now authored by the themed builder, not the stage-2
      // converter: the converter's colour-and-curve fill left 67-71 of 79
      // cards as generic filler and measured 26-31% against the shop precons.
      expect(sorted(buildDarlingsDeck(avatar, sourceDb).cards)).toEqual(sorted(avatar.darlingsDeck));
      expect(first.darlingId).toEqual(avatar.darlingId);
      expect(sorted(first.reserveDeck)).toEqual(sorted(avatar.reserveDeck));
    }
  });

  it('both reserve avatar matrix modes construct and play a seeded game', () => {
    const only = [AVATARS[0].id];
    const warchest = runAvatarReserveMatrix('warchest', 1, only);
    expect(warchest.rows).toHaveLength(1);
    expect(warchest.table).toContain('reserve starters');
    const darlings = runAvatarReserveMatrix('darlings', 1, only);
    expect(darlings.rows).toHaveLength(1);
  });
});
