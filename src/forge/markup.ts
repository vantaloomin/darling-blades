/**
 * HTML strings for the parts of the page that show text a player (or an
 * imported file, or a share link) controls: card names, set names, type lines.
 * The Forge shares the game's origin, so a script injected here would run
 * next to the player's save. Every such string is escaped here, in text and
 * in attributes alike; the rest of the page builds on these helpers.
 *
 * Headless (no DOM): the tests check the escaping on the strings themselves.
 */
import type { ForgeWarning, VerdictBand } from './logic';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const signedNumber = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;

export const ESTIMATE_TOOLTIP = 'A provisional rate. It hasn\'t been measured in play yet.';

export function estimateTag(): string {
  return `<span class="estimate-tag" title="${escapeHtml(ESTIMATE_TOOLTIP)}">Estimate</span>`;
}

const VERDICT_WORD: Record<VerdictBand, string> = { under: 'Under', accurate: 'Accurate', over: 'Over' };

export interface SetRowView {
  id: string;
  name: string;
  typeLine: string;
  /** Mana cost markup built by the page from numbers only (never player text). */
  costHtml: string;
  band: VerdictBand;
  delta: number;
  /** This row is the card in the editor. */
  editing: boolean;
  /** The card carries the player's own image. */
  ownArt?: boolean;
}

/** One row of the set list: open the card, see its verdict, or remove it. */
export function setRowMarkup(row: SetRowView): string {
  const id = escapeHtml(row.id);
  const name = escapeHtml(row.name);
  return `<li class="set-row${row.editing ? ' editing' : ''}">
    <button type="button" class="set-row-open${row.ownArt ? ' own-art' : ''}" data-open-card="${id}"${row.editing ? ' aria-current="true"' : ''}>
      <span class="set-row-cost">${row.costHtml}</span>
      <span class="set-row-text"><strong>${name}</strong><small>${escapeHtml(row.typeLine)}</small></span>
      ${row.ownArt ? '<span class="own-art-tag">Own art</span>' : ''}
      <span class="verdict-chip ${row.band}">${VERDICT_WORD[row.band]} ${signedNumber(row.delta)}</span>
    </button>
    <button type="button" class="icon-button" data-remove-card="${id}" aria-label="Remove ${name}" title="Remove ${name}">×</button>
  </li>`;
}

/** A warning chip: a problem, an estimate (with its tag), or a note. */
export function warningChipMarkup(warning: ForgeWarning): string {
  const tag = warning.kind === 'estimate' ? estimateTag() : '';
  return `<span class="warning-chip ${warning.kind}">${tag}<span>${escapeHtml(warning.text)}</span></span>`;
}
