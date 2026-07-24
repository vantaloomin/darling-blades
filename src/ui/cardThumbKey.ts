/** Stable cache key for a card thumbnail, including the optional land style and variant. */
export function cardThumbKey(cardId: string, landStyle?: string, variantKey?: string): string {
  return `card-thumb-${cardId}${landStyle ? `--${landStyle}` : ''}${variantKey ? `--v-${variantKey}` : ''}`;
}
