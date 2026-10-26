import type { CardDef } from '../../src/engine/types';
import { rulesText as realRulesText } from '../../src/ui/rulesText';
export * from '../../src/ui/rulesText';
/** The preview prints the draft's own rules text; everything else is the game's. */
export function rulesText(d: CardDef, opts?: { reminders?: boolean }): string {
  const printed = (d as CardDef & { __printed?: string }).__printed;
  return printed ?? realRulesText(d, opts);
}
