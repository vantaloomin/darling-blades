export interface ReserveModalGroup {
  cardId: string;
  count: number;
  /** A reserve slot of this kind with a legal play action, if any has one. */
  playableIndex?: number;
}

/**
 * Group identical Warchest Reserve slots into one tile per kind. Identical
 * cardIds are interchangeable to the engine — `playLand` only names which
 * `reserveIndex`, and any slot of the same kind produces the same state — so
 * a count badge plus one Play land per kind is the whole real choice. Kinds
 * keep the reserve's own order.
 */
/**
 * Land-carry fan: the playable kinds arc up-right of the Reserves pile,
 * middle card lifted highest so two or three read as a held hand.
 */
export function landFanSlots(
  count: number,
  pileX: number,
  pileY: number,
): { x: number; y: number }[] {
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: pileX + 26 + i * 96,
    y: pileY - 118 - (count > 1 ? Math.round(14 * (1 - Math.abs(i - mid) / Math.max(1, mid))) : 0),
  }));
}

export function groupReserveSlots(
  cardIds: readonly string[],
  playable: (index: number) => boolean,
): ReserveModalGroup[] {
  const groups = new Map<string, ReserveModalGroup>();
  cardIds.forEach((cardId, index) => {
    const group = groups.get(cardId);
    if (!group) {
      groups.set(cardId, {
        cardId,
        count: 1,
        ...(playable(index) ? { playableIndex: index } : {}),
      });
      return;
    }
    group.count += 1;
    if (group.playableIndex === undefined && playable(index)) group.playableIndex = index;
  });
  return [...groups.values()];
}
