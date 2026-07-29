export interface ClearedPinSummary {
  deckName: string;
  countCleared: number;
}

/** Player-facing result copy for variant pins cleared by sharding. */
export function clearedPinSummaryCopy(summary: ClearedPinSummary): string {
  const noun = summary.countCleared === 1 ? 'look' : 'looks';
  return `Cleared ${summary.countCleared} pinned ${noun} in ${summary.deckName}.`;
}
