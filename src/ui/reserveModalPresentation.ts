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
