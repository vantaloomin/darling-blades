/** Stable cache key for a card thumbnail, including the optional land style. */
export function cardThumbKey(cardId: string, landStyle?: string): string {
  return `card-thumb-${cardId}${landStyle ? `--${landStyle}` : ''}`;
}
