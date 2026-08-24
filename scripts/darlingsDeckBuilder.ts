/*
 * Build a themed 79-card singleton Darlings deck for one avatar.
 *
 * WHY THIS EXISTS. The stage-2 scripted converter filled Darlings decks by
 * colour and curve alone, so each avatar kept only 8-12 cards of its own and
 * took 67-71 from generic catalog order. Measured 2026-08-08 against the five
 * curated shop precons, those piles lost badly (Morgan 27%, The Bride 26%)
 * while the precons sat in a healthy 12-point band. The fault was never the
 * format: it was that a mechanical fill has no skeleton and no identity.
 *
 * This builder fixes both halves:
 *   1. A ROLE SKELETON  - every deck gets a deliberate count of removal,
 *      sweepers, draw, recursion, pump and bodies, and a curve weighted to the
 *      cheap end because reserve formats reward turn-one and turn-two plays
 *      (Yohime wins 88% on an 8/8/16/8 curve; Hel and Valhalla's Muster both
 *      died of top-heaviness, the latter mulliganing 79% of its games).
 *   2. THEMED PRIORITY  - fill reaches for the avatar's own cards first, then
 *      its home set, then its creature tribes, before it ever takes a generic
 *      in-colour card.
 *
 * Ratios are OURS, derived from our own measurements rather than imported from
 * Commander decklists: a 79-card singleton list drawn against a fixed ten-land
 * reserve has no equivalent anywhere else, and the external decklist APIs we
 * reviewed either forbid derived datasets or sample tournament cEDH, which
 * assumes 100 cards and ~37 lands. The skeleton below is a hypothesis to be
 * measured with `--avatars-darlings`, not a truth to be trusted.
 */
import { CARD_DB } from '../src/data/catalog';
import { isLiveCollectible } from '../src/data/liveness';
import { AVATARS, type Avatar } from '../src/data/opponents';
import { DARLINGS_DECK_SIZE } from '../src/meta/warchest';
import type { CardDb, CardDef, Color } from '../src/engine/types';

export type Role =
  | 'removal'
  | 'sweeper'
  | 'draw'
  | 'recursion'
  | 'graveHate'
  | 'counter'
  | 'pump'
  | 'tokens'
  | 'lifeswing'
  | 'body'
  | 'other';

/** Target counts per role for a 79-card singleton list. Sums to <= 79; the
 *  remainder is filled as bodies, which are always the flexible slot. */
export const DARLINGS_SKELETON: Record<Exclude<Role, 'body' | 'other'>, number> = {
  removal: 10,
  sweeper: 2,
  draw: 8,
  recursion: 4,
  graveHate: 1,
  counter: 3,
  pump: 6,
  tokens: 3,
  lifeswing: 2,
};

/** Cards allowed at each mana value. Deliberately bottom-heavy. */
export const DARLINGS_CURVE: Record<number, number> = {
  1: 12,
  2: 18,
  3: 20,
  4: 15,
  5: 9,
  6: 5,
};

export function manaValueOf(card: CardDef | undefined): number {
  const cost = card?.cost;
  if (!cost) return 0;
  return (cost.generic ?? 0) + Object.values(cost.pips ?? {}).reduce((sum, v) => sum + (v ?? 0), 0);
}

function opsOf(card: CardDef): string[] {
  // `ops` is optional on AbilityDef (static-only abilities carry none).
  const fromAbilities = (card.abilities ?? []).flatMap((ability) => (ability.ops ?? []).map((op) => op.op));
  const fromChapters = (card.chapters ?? []).flat().map((op) => op.op);
  const fromEmpower = (card.empower?.ops ?? []).map((op) => op.op);
  return [...fromAbilities, ...fromChapters, ...fromEmpower];
}

/**
 * One role per card, most-specific first. A card that both sweeps and draws is
 * a sweeper, because that is the slot a deckbuilder is filling when they take
 * it. Bodies are last so any creature without a standout effect counts as one.
 */
export function classifyRole(card: CardDef): Role {
  const ops = new Set(opsOf(card));
  if (ops.has('massDestroy')) return 'sweeper';
  if (ops.has('cancel')) return 'counter';
  if (ops.has('severGrave') || ops.has('severTop')) return 'graveHate';
  if (ops.has('reclaim') || ops.has('raise') || card.retell) return 'recursion';
  if (
    ops.has('destroy') ||
    ops.has('sever') ||
    ops.has('damage') ||
    ops.has('tap') ||
    ops.has('preventCombat') ||
    ops.has('destroyArtifactOrSeverEnchantment') ||
    ops.has('destroyNewestOpponentArtifactOrEnchantment')
  ) {
    return 'removal';
  }
  if (ops.has('draw') || ops.has('foresee') || card.skim) return 'draw';
  if (ops.has('createToken')) return 'tokens';
  if (ops.has('boost') || ops.has('addCounters') || ops.has('awaken')) return 'pump';
  if (ops.has('gainLife') || ops.has('loseLife') || ops.has('grind')) return 'lifeswing';
  if (card.types.includes('creature')) return 'body';
  return 'other';
}

/** Set family from the id prefix (`rg-hel` -> `rg`, `tk-wei-caocao` -> `tk-wei`). */
export function setOf(id: string): string {
  const parts = id.split('-');
  return parts[0] === 'tk' && parts.length > 2 ? `${parts[0]}-${parts[1]}` : parts[0];
}

function eligible(card: CardDef, colors: readonly Color[]): boolean {
  if (!isLiveCollectible(card) || card.types.includes('land')) return false;
  if (card.supertypes?.includes('legendary') && card.types.includes('creature')) {
    // Legendary creatures other than the Darling stay out: they read as rival
    // commanders and muddy the deck's single-leader identity.
    return false;
  }
  return card.colors.every((color) => colors.includes(color));
}

export interface DarlingsBuild {
  avatarId: string;
  darlingId: string;
  cards: string[];
  /** Where each card came from, for the balance-record comment. */
  provenance: { own: number; homeSet: number; tribal: number; generic: number };
  roleCounts: Record<string, number>;
  curve: Record<number, number>;
}

/** Designed power level. Rarity is the cheapest honest proxy we have: the
 *  card was costed to be this strong on purpose. */
const RARITY_SCORE: Record<string, number> = { c: 0, r: 1.0, sr: 1.6, ur: 2.0, ssr: 2.4 };

/**
 * How strong a card is on its own, independent of theme.
 *
 * Avatars are NOT tied to their home expansion (owner, 2026-08-09), so set
 * affinity must never outrank quality: a strong generic card beats a weak
 * on-set one. This is the term that makes that true.
 *
 * Body rate (attack+defense per mana) is the backbone for creatures, with
 * credit for keywords and for having an effect at all, plus the rarity the
 * card was designed at. Non-creatures lean on rarity and effect count, since
 * a removal spell has no stats to rate.
 */
export function qualityScore(card: CardDef): number {
  const mv = Math.max(1, manaValueOf(card));
  const rarity = RARITY_SCORE[card.rarity] ?? 0;
  const keywords = (card.keywords ?? []).length;
  const opCount = opsOf(card).length;
  if (card.types.includes('creature')) {
    const rate = ((card.attack ?? 0) + (card.defense ?? 0)) / mv;
    return rate + keywords * 0.6 + Math.min(opCount, 3) * 0.4 + rarity;
  }
  // Cheap interaction is disproportionately good in a format that rewards
  // turn-one and turn-two plays, so spells get a mild low-cost premium.
  return Math.min(opCount, 3) * 0.8 + rarity + Math.max(0, 4 - mv) * 0.25;
}

/**
 * Theme affinity, added to quality rather than gating it. The avatar's own
 * cards get enough of a bump to survive against strong generics (they ARE the
 * identity), while home-set and tribal cards get a nudge that only decides
 * ties between comparable cards.
 */
export function themeBonus(card: CardDef, darling: CardDef, ownIds: Set<string>, tribes: Set<string>): number {
  if (ownIds.has(card.id)) return 3.0;
  let bonus = 0;
  if (setOf(card.id) === setOf(darling.id)) bonus += 0.8;
  if (card.types.includes('creature') && card.subtypes.some((s) => tribes.has(s))) bonus += 1.0;
  return bonus;
}

export function buildDarlingsDeck(avatar: Avatar, db: CardDb = CARD_DB): DarlingsBuild {
  const darling = db[avatar.darlingId];
  if (!darling) throw new Error(`${avatar.id} has no Darling ${avatar.darlingId}`);
  const colors = darling.colors.length > 0 ? darling.colors : (['W', 'U', 'B', 'R', 'G'] as Color[]);
  const ownIds = new Set(avatar.deck.filter((id) => eligible(db[id], colors) && id !== darling.id));

  const tribes = new Set(
    [...ownIds]
      .map((id) => db[id])
      .filter((c): c is CardDef => Boolean(c?.types.includes('creature')))
      .flatMap((c) => c.subtypes),
  );

  // One ranking, quality-led: strength decides, theme adjusts. Ties break on
  // cheapness then id so the build stays deterministic.
  const pool = Object.values(db)
    .filter((card) => card.id !== darling.id && eligible(card, colors))
    .map((card) => {
      const quality = qualityScore(card);
      const theme = themeBonus(card, darling, ownIds, tribes);
      return {
        card,
        role: classifyRole(card),
        mv: manaValueOf(card),
        score: quality + theme,
        own: ownIds.has(card.id),
        homeSet: !ownIds.has(card.id) && setOf(card.id) === setOf(darling.id),
        tribal:
          !ownIds.has(card.id) &&
          card.types.includes('creature') &&
          card.subtypes.some((s) => tribes.has(s)),
      };
    })
    .sort((a, b) => b.score - a.score || a.mv - b.mv || a.card.id.localeCompare(b.card.id));

  const roleBudget: Record<string, number> = { ...DARLINGS_SKELETON };
  const curveBudget: Record<number, number> = { ...DARLINGS_CURVE };
  const chosen: typeof pool = [];
  const taken = new Set<string>();

  const curveKey = (mv: number): number => Math.min(Math.max(mv, 1), 6);
  const take = (entry: (typeof pool)[number]): void => {
    chosen.push(entry);
    taken.add(entry.card.id);
    curveBudget[curveKey(entry.mv)]--;
    if (entry.role in roleBudget) roleBudget[entry.role]--;
  };

  // Pass 1: fill the named roles, best-priority first, respecting the curve.
  for (const entry of pool) {
    if (chosen.length >= DARLINGS_DECK_SIZE) break;
    if (taken.has(entry.card.id)) continue;
    if (!(entry.role in roleBudget) || roleBudget[entry.role] <= 0) continue;
    if (curveBudget[curveKey(entry.mv)] <= 0) continue;
    take(entry);
  }
  // Pass 2: bodies only. Skeleton roles are already capped at their budget,
  // so this is what keeps a deck from becoming 23 card-draw spells: the
  // flexible remainder is always creatures, which is what a deck needs to
  // actually win rather than merely to see cards.
  for (const entry of pool) {
    if (chosen.length >= DARLINGS_DECK_SIZE) break;
    if (taken.has(entry.card.id)) continue;
    if (entry.role !== 'body' && entry.role !== 'other') continue;
    if (curveBudget[curveKey(entry.mv)] <= 0) continue;
    take(entry);
  }
  // Pass 3: last resort, ignore the curve budget so the deck always reaches 79.
  for (const entry of pool) {
    if (chosen.length >= DARLINGS_DECK_SIZE) break;
    if (taken.has(entry.card.id)) continue;
    take(entry);
  }
  if (chosen.length !== DARLINGS_DECK_SIZE) {
    throw new Error(`${avatar.id}: built ${chosen.length}/${DARLINGS_DECK_SIZE} Darlings cards`);
  }

  const provenance = { own: 0, homeSet: 0, tribal: 0, generic: 0 };
  const roleCounts: Record<string, number> = {};
  const curve: Record<number, number> = {};
  for (const entry of chosen) {
    if (entry.own) provenance.own++;
    else if (entry.homeSet) provenance.homeSet++;
    else if (entry.tribal) provenance.tribal++;
    else provenance.generic++;
    roleCounts[entry.role] = (roleCounts[entry.role] ?? 0) + 1;
    curve[entry.mv] = (curve[entry.mv] ?? 0) + 1;
  }
  return {
    avatarId: avatar.id,
    darlingId: darling.id,
    cards: chosen.map((entry) => entry.card.id),
    provenance,
    roleCounts,
    curve,
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const only = argv.find((a) => !a.startsWith('--'));
  const targets = only ? AVATARS.filter((a) => a.id === only) : AVATARS;
  for (const avatar of targets) {
    const build = buildDarlingsDeck(avatar);
    const p = build.provenance;
    const curve = Object.entries(build.curve).sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([mv, n]) => `${mv}:${n}`).join(' ');
    console.log(
      `${avatar.id} (${build.darlingId}) own ${p.own} / set ${p.homeSet} / tribe ${p.tribal} / generic ${p.generic}`,
    );
    console.log(`  roles ${JSON.stringify(build.roleCounts)}`);
    console.log(`  curve ${curve}`);
    if (argv.includes('--list')) console.log(`  ${build.cards.join(' ')}`);
  }
}

const invoked = process.argv[1]?.replace(/\\/g, '/').toLowerCase() ?? '';
if (invoked.endsWith('darlingsdeckbuilder.ts')) main();
