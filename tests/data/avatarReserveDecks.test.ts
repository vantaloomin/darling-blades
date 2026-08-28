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
import { convertAvatarReserveDecks, convertAvatarWarchest, hasNoLegalTargets } from '../../scripts/avatarReserveDecks';
import { buildDarlingsDeck } from '../../scripts/darlingsDeckBuilder';
import { buildReserveMatrixFullOwnershipSave } from '../../scripts/reserveMatrixDecks';
import { runAvatarReserveMatrix } from '../../scripts/balance-matrix';

const save = buildReserveMatrixFullOwnershipSave(CARD_DB);

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
  // The headline defect is one the converter can hit for ANY avatar: it
  // retained sd-strike-the-lintel x4 (targets artifactOrEnchantment) into a
  // format whose five starter columns contain zero artifacts and zero
  // enchantments, so 4 of her 40 cards were blank in 100% of games. Retention
  // eligibility does not check that a card has legal targets. Full evidence
  // chain in her opponents.ts entry.
  const HAND_TUNED_WARCHEST = new Set([
    'morgan',
    'hel',
    'glass-coffin-queen',
    'anubis-who-holds-the-scale',
    'the-bride',
  ]);

  /**
   * Retention eligibility asked only "is this a legal nonland?", never "can
   * this card's target ever exist?". That shipped sd-strike-the-lintel x4 -
   * which targets artifactOrEnchantment - into Anubis against five starter
   * columns holding ZERO artifacts and ZERO enchantments: four cards blank in
   * 100% of her games, 33% win rate, repaired only by a hand-tune. The fault
   * was never hers specifically; it can hit ANY avatar carrying narrow removal.
   */
  describe('retention rejects cards whose targets cannot exist in the format', () => {
    const suppliedBy = (id: string): string[] => {
      const card = CARD_DB[id];
      const out: string[] = [];
      if (card?.types.includes('artifact')) out.push('artifact', 'artifactOrEnchantment');
      if (card?.types.includes('enchantment')) out.push('enchantment', 'artifactOrEnchantment');
      return out;
    };
    const supplyFor = (source: readonly string[]): Set<string> => new Set([
      ...STARTER_DECKS.flatMap((deck) => (deck.reserveCards ?? []).flatMap(suppliedBy)),
      ...source.flatMap(suppliedBy),
    ]);

    it('the five starter columns really do supply no artifact or enchantment', () => {
      // The premise the whole defect rests on. If a future set puts an artifact
      // into a starter column, these cards stop being dead and this test says so.
      const columnSupply = new Set(
        STARTER_DECKS.flatMap((deck) => (deck.reserveCards ?? []).flatMap(suppliedBy)),
      );
      expect([...columnSupply]).toEqual([]);
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

    it('never rejects a card whose targets are ordinary creatures', () => {
      const creatureRemoval = Object.values(CARD_DB).filter((card) =>
        (card.abilities ?? []).some((a) => (a.targets ?? []).some((t) => t.what === 'creature')));
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

  it('untuned committed data IS the deterministic converter output', () => {
    // Card-content identity, order-insensitive: the committed literals group
    // duplicates via expand() while the converter emits raw append order, and
    // list order only feeds the seeded shuffle.
    const sorted = (cards: readonly string[]): string[] => [...cards].sort();
    for (const avatar of AVATARS) {
      const first = convertAvatarReserveDecks(avatar);
      const second = convertAvatarReserveDecks(avatar);
      expect(first, `${avatar.id} converter is not deterministic`).toEqual(second);
      expect(sorted(first.landReserve)).toEqual(sorted(avatar.landReserve));
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
      expect(sorted(buildDarlingsDeck(avatar).cards)).toEqual(sorted(avatar.darlingsDeck));
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
