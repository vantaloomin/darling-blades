import { UI_ICON_NAMES, type UiIconName } from './uiIcons';

/**
 * An icon inside a control's label, written as `{name}` (`Buy · {gold} 500`,
 * `{gear} Settings`): the control draws its text, the icon, then the rest.
 * A label holds at most one. Phaser-free.
 */
export function iconToken(name: UiIconName): string {
  return `{${name}}`;
}

const TOKEN = new RegExp(`\\{(${UI_ICON_NAMES.join('|')})\\}`);

/** Split a label at its icon token; `null` when it has none. */
export function splitIconLabel(label: string): { head: string; icon: UiIconName; tail: string } | null {
  const match = TOKEN.exec(label);
  if (!match) return null;
  return {
    head: label.slice(0, match.index).trimEnd(),
    icon: match[1] as UiIconName,
    tail: label.slice(match.index + match[0].length).trimStart(),
  };
}
