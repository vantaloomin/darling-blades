import Phaser from 'phaser';
import manifest from '../data/art-manifest.json';
import { ALL_CARDS } from '../data/catalog';
import { artKeyFor, artTextureKey } from '../art/artLoader';
import { ICON_PATHS } from '../art/iconPaths';
import type { CardDef, Color, Keyword, StaticDef } from '../engine/types';
import { setQualityTier } from '../platform/quality';
import { frameKeyFor } from '../ui/CardFrameFactory';
import { scoreCard, type ScorableCardDef, type ScorableEffectOp } from '../power/scoreCore';
import { buildHints, type CostingHint } from './hints';
import {
  COLOR_ORDER,
  builderHasType,
  cloneBuilderState,
  colorsForCost,
  evaluateBuilder,
  fromCardDef,
  ledgerLabelForPart,
  manaCostLabel,
  printedManaValue,
  rarityBudgetLabel,
  toCardDef,
  type BuilderMechanics,
  type BuilderConditionKind,
  type BuilderState,
  type CostState,
  type ManaAbilityColor,
  type MarkedThresholdSubject,
} from './logic';
import {
  CARD_TYPES,
  KEYWORD_OPTIONS,
  OP_OPTIONS,
  RARITIES,
  RARITY_LABELS,
  SETS,
  SET_LABELS,
  TARGETS,
  TARGET_LABELS,
  TOKEN_OPTIONS,
  TRIGGERS,
  TRIGGER_LABELS,
  defaultOp,
  type OpKind,
} from './vocab';
import { createBuilderStore } from './store';
import {
  CARD_BUILDER_GAME_CONFIG,
  CardBuilderPreloadScene,
  CardBuilderScene,
  forgeArtUrl,
  forgeFontStatus,
  forgeFontsLoaded,
  type FontFaceStatus,
} from './scene';
import './style.css';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Card Builder control is missing: #${id}`);
  return element as T;
}

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const format = (value: number): string => value.toFixed(2);
const signed = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const CONDITIONS = ['none', 'questActive', 'controlMarked', 'markedThreshold', 'creatureDiedThisTurn', 'controlsOther'] as const satisfies readonly BuilderConditionKind[];
const CONDITION_LABELS: Record<BuilderConditionKind, string> = {
  none: 'No condition',
  questActive: 'Quest active',
  controlMarked: 'Control marked permanent',
  markedThreshold: 'Marked threshold',
  creatureDiedThisTurn: 'A creature died this turn',
  controlsOther: 'Control another (subtype)',
};
const THRESHOLD_SUBJECTS = ['creatures', 'permanents'] as const satisfies readonly MarkedThresholdSubject[];

function optionMarkup<T extends string>(
  options: readonly T[],
  selected: string,
  labels: Partial<Record<T, string>> = {},
): string {
  return options.map((option) => (
    `<option value="${escapeHtml(option)}"${option === selected ? ' selected' : ''}>${escapeHtml(labels[option] ?? titleCase(option))}</option>`
  )).join('');
}

const store = createBuilderStore();

const cardName = byId<HTMLInputElement>('card-name');
const cardType = byId<HTMLSelectElement>('card-type');
const cardRarity = byId<HTMLSelectElement>('card-rarity');
const cardSubtypes = byId<HTMLInputElement>('card-subtypes');
const cardSet = byId<HTMLSelectElement>('card-set');
const cardLegendary = byId<HTMLInputElement>('card-legendary');
const cardFlavor = byId<HTMLTextAreaElement>('card-flavor');
const manaSection = byId<HTMLElement>('mana-section');
const genericMana = byId<HTMLInputElement>('generic-mana');
const genericValue = byId<HTMLOutputElement>('generic-value');
const manaValueOutput = byId<HTMLOutputElement>('mana-value');
const pipControls = byId<HTMLDivElement>('pip-controls');
const colorIdentityMode = byId<HTMLSelectElement>('color-identity-mode');
const colorOverrideControls = byId<HTMLFieldSetElement>('color-override-controls');
const xSpell = byId<HTMLInputElement>('x-spell');
const bodySection = byId<HTMLElement>('body-section');
const cardAttack = byId<HTMLInputElement>('card-attack');
const attackValue = byId<HTMLOutputElement>('attack-value');
const cardDefense = byId<HTMLInputElement>('card-defense');
const defenseValue = byId<HTMLOutputElement>('defense-value');
const keywordPalette = byId<HTMLDivElement>('keyword-palette');
const keywordScoreNote = byId<HTMLParagraphElement>('keyword-score-note');
const abilityList = byId<HTMLDivElement>('ability-list');
const mechanicEditors = byId<HTMLDivElement>('mechanic-editors');
const frameStyle = byId<HTMLSelectElement>('frame-style');
const holoFinish = byId<HTMLSelectElement>('holo-finish');
const fullArt = byId<HTMLInputElement>('full-art');
const manaPreview = byId<HTMLDivElement>('mana-preview');
const appliedKeywords = byId<HTMLDivElement>('applied-keywords');

cardType.innerHTML = optionMarkup(CARD_TYPES, 'creature');
cardRarity.innerHTML = optionMarkup(RARITIES, 'c', RARITY_LABELS);
cardSet.innerHTML = optionMarkup(SETS, 'base', SET_LABELS);
frameStyle.innerHTML = optionMarkup(['default', 'white', 'blue', 'red', 'gold', 'rainbow', 'black'] as const, 'default', {
  default: 'Default', white: 'White', blue: 'Blue', red: 'Red', gold: 'Gold', rainbow: 'Rainbow', black: 'Black',
});
holoFinish.innerHTML = optionMarkup(['default', 'none', 'shiny', 'rainbow', 'pearlescent', 'fractal', 'void'] as const, 'default', {
  default: 'Default', none: 'None', shiny: 'Shiny', rainbow: 'Rainbow', pearlescent: 'Pearlescent', fractal: 'Fractal', void: 'Void',
});

const PIP_VISUALS: Record<Color, { label: string; bg: string; fg: string }> = {
  W: { label: 'White', bg: '#f5ecd2', fg: '#5b4a1e' },
  U: { label: 'Blue', bg: '#8fc4ea', fg: '#123a63' },
  B: { label: 'Black', bg: '#b7a5c4', fg: '#1d1226' },
  R: { label: 'Red', bg: '#f0a08a', fg: '#611111' },
  G: { label: 'Green', bg: '#a8d3a4', fg: '#123f1f' },
};

function pipSvg(color: Color, sizeClass = ''): string {
  const visual = PIP_VISUALS[color];
  return `<svg class="mana-pip ${sizeClass}" viewBox="0 0 100 100" role="img" aria-label="${visual.label} mana">
    <circle cx="50" cy="50" r="47" fill="${visual.bg}" stroke="rgba(0,0,0,.6)" stroke-width="5"></circle>
    <path d="${ICON_PATHS[color]}" fill="${visual.fg}" fill-rule="evenodd"></path>
  </svg>`;
}

pipControls.innerHTML = COLOR_ORDER.map((color) => `
  <div class="pip-stepper" data-pip-stepper="${color}">
    ${pipSvg(color)}
    <span>${PIP_VISUALS[color].label}</span>
    <button type="button" data-pip="${color}" data-step="-1" aria-label="Remove ${PIP_VISUALS[color].label} pip">−</button>
    <output id="pip-count-${color}">0</output>
    <button type="button" data-pip="${color}" data-step="1" aria-label="Add ${PIP_VISUALS[color].label} pip">+</button>
  </div>
`).join('');
colorOverrideControls.innerHTML = COLOR_ORDER.map((color) => `
  <label title="${PIP_VISUALS[color].label}">
    ${pipSvg(color, 'tiny')}
    <input type="checkbox" data-color-identity="${color}" aria-label="${PIP_VISUALS[color].label} color identity" />
  </label>
`).join('');

function mutate(mutator: (next: BuilderState) => void): void {
  store.update((state) => {
    const next = cloneBuilderState(state);
    mutator(next);
    return next;
  });
}

function setTextInputHandler(
  input: HTMLInputElement | HTMLTextAreaElement,
  mutator: (next: BuilderState, value: string) => void,
): void {
  input.addEventListener('input', () => mutate((next) => mutator(next, input.value)));
}

setTextInputHandler(cardName, (next, value) => { next.name = value; });
setTextInputHandler(cardSubtypes, (next, value) => { next.subtypesText = value; });
setTextInputHandler(cardFlavor, (next, value) => { next.flavor = value; });
cardType.addEventListener('change', () => mutate((next) => {
  next.cardType = cardType.value as BuilderState['cardType'];
  next.additionalTypes = [];
}));
cardRarity.addEventListener('change', () => mutate((next) => { next.rarity = cardRarity.value as BuilderState['rarity']; }));
cardSet.addEventListener('change', () => mutate((next) => { next.set = cardSet.value as BuilderState['set']; }));
cardLegendary.addEventListener('change', () => mutate((next) => { next.legendary = cardLegendary.checked; }));
genericMana.addEventListener('input', () => mutate((next) => { next.cost.generic = Number(genericMana.value); }));
colorIdentityMode.addEventListener('change', () => mutate((next) => {
  next.colorOverride = colorIdentityMode.value === 'override' ? colorsForCost(next.cost) : null;
}));
colorOverrideControls.addEventListener('change', (event) => {
  const checkbox = (event.target as HTMLElement).closest<HTMLInputElement>('[data-color-identity]');
  if (!checkbox) return;
  const color = checkbox.dataset.colorIdentity as Color;
  mutate((next) => {
    const selected = new Set(next.colorOverride ?? colorsForCost(next.cost));
    if (checkbox.checked) selected.add(color);
    else selected.delete(color);
    next.colorOverride = COLOR_ORDER.filter((candidate) => selected.has(candidate));
  });
});
xSpell.addEventListener('change', () => mutate((next) => { next.isX = xSpell.checked; }));
cardAttack.addEventListener('input', () => mutate((next) => { next.attack = Number(cardAttack.value); }));
cardDefense.addEventListener('input', () => mutate((next) => { next.defense = Number(cardDefense.value); }));
frameStyle.addEventListener('change', () => mutate((next) => { next.appearance.frame = frameStyle.value as BuilderState['appearance']['frame']; }));
holoFinish.addEventListener('change', () => mutate((next) => { next.appearance.holo = holoFinish.value as BuilderState['appearance']['holo']; }));
fullArt.addEventListener('change', () => mutate((next) => { next.appearance.fullArt = fullArt.checked; }));

pipControls.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pip]');
  if (!button) return;
  const color = button.dataset.pip as Color;
  const step = Number(button.dataset.step);
  mutate((next) => { next.cost.pips[color] = Math.max(0, next.cost.pips[color] + step); });
});

function renderKeywordPalette(state: BuilderState): void {
  keywordPalette.innerHTML = KEYWORD_OPTIONS.map(({ keyword, name, reminder, value }) => {
    const selected = state.keywords.includes(keyword);
    return `<button type="button" class="keyword-chip palette-chip ${selected ? 'selected' : ''} ${value < 0 ? 'negative' : ''}"
      draggable="true" data-keyword="${keyword}" title="${escapeHtml(reminder)}">
      <span>${escapeHtml(name)}</span><strong>${signed(value)}</strong>
    </button>`;
  }).join('');
}

function addKeyword(keyword: Keyword): void {
  mutate((next) => {
    if (!next.keywords.includes(keyword)) next.keywords.push(keyword);
  });
}

function removeKeyword(keyword: Keyword): void {
  mutate((next) => { next.keywords = next.keywords.filter((candidate) => candidate !== keyword); });
}

keywordPalette.addEventListener('click', (event) => {
  const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-keyword]');
  if (!chip) return;
  const keyword = chip.dataset.keyword as Keyword;
  if (store.getState().keywords.includes(keyword)) removeKeyword(keyword);
  else addKeyword(keyword);
});

interface KeywordDragPayload { keyword: Keyword; source: 'palette' | 'applied' }
const DRAG_TYPE = 'application/x-darlingblades-keyword';

function dragPayload(event: DragEvent): KeywordDragPayload | null {
  const text = event.dataTransfer?.getData(DRAG_TYPE);
  if (!text) return null;
  return JSON.parse(text) as KeywordDragPayload;
}

function beginKeywordDrag(event: DragEvent, source: KeywordDragPayload['source']): void {
  const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-keyword]');
  if (!chip || !event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ keyword: chip.dataset.keyword, source }));
  document.body.classList.add('dragging-keyword');
}

keywordPalette.addEventListener('dragstart', (event) => beginKeywordDrag(event, 'palette'));
appliedKeywords.addEventListener('dragstart', (event) => beginKeywordDrag(event, 'applied'));
document.addEventListener('dragend', () => document.body.classList.remove('dragging-keyword'));

for (const target of [byId('canvas-drop-overlay'), appliedKeywords]) {
  target.addEventListener('dragover', (event) => { event.preventDefault(); });
  target.addEventListener('drop', (event) => {
    event.preventDefault();
    const payload = dragPayload(event);
    if (payload) addKeyword(payload.keyword);
    document.body.classList.remove('dragging-keyword');
  });
}
keywordPalette.addEventListener('dragover', (event) => { event.preventDefault(); });
keywordPalette.addEventListener('drop', (event) => {
  event.preventDefault();
  const payload = dragPayload(event);
  if (payload?.source === 'applied') removeKeyword(payload.keyword);
  document.body.classList.remove('dragging-keyword');
});
appliedKeywords.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-keyword]');
  if (button) removeKeyword(button.dataset.removeKeyword as Keyword);
});

function renderAppliedKeywords(state: BuilderState): void {
  if (state.keywords.length === 0) {
    appliedKeywords.innerHTML = '<span class="empty-drop-copy">Drop keywords here</span>';
    return;
  }
  appliedKeywords.innerHTML = state.keywords.map((keyword) => {
    const option = KEYWORD_OPTIONS.find((candidate) => candidate.keyword === keyword)!;
    return `<span class="keyword-chip applied-chip ${option.value < 0 ? 'negative' : ''}" draggable="true" data-keyword="${keyword}">
      ${escapeHtml(option.name)} <strong>${signed(option.value)}</strong>
      <button type="button" data-remove-keyword="${keyword}" aria-label="Remove ${escapeHtml(option.name)}">×</button>
    </span>`;
  }).join('');
}

function renderOpFields(op: ScorableEffectOp, context: string, opIndex: number): string {
  const base = `data-op-context="${escapeHtml(context)}" data-op-index="${opIndex}"`;
  const numberField = (field: string, value: number, min = 0, max = 20) => (
    `<label>${titleCase(field)}<input type="number" min="${min}" max="${max}" step="1" value="${value}" ${base} data-op-field="${field}" /></label>`
  );
  const selectField = (field: string, value: string, options: readonly string[], labels: Record<string, string> = {}) => (
    `<label>${titleCase(field)}<select ${base} data-op-field="${field}">${optionMarkup(options, value, labels)}</select></label>`
  );
  switch (op.op) {
    case 'damage':
      return `${selectField('n', String(op.n), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'X'])}${selectField('to', op.to, ['target', 'opponent', 'controller', 'eachCreature', 'eachOpponentCreature'], { eachCreature: 'Each creature', eachOpponentCreature: 'Each opposing creature' })}`;
    case 'gainLife': case 'draw': case 'foresee':
      return numberField('n', op.n, 0, 20);
    case 'loseLife': case 'discardRandom': case 'discard':
      return numberField('n', op.n, 0, 20);
    case 'sacrifice':
      return selectField('who', op.who, ['opponent', 'each'], { opponent: 'Opponent', each: 'Each player' });
    case 'severGrave': case 'grind':
      return `${numberField('n', op.n, 0, 30)}${selectField('who', op.who, ['self', 'opponent'])}`;
    case 'severTop':
      return numberField('n', op.n, 0, 30);
    case 'boost':
      return `${numberField('p', op.p, -12, 12)}${numberField('t', op.t, -12, 12)}${selectField('scope', op.scope, ['target', 'self', 'allYours', 'all', 'yourMarked', 'theirMarked'], { self: 'Self', allYours: 'All yours', all: 'All creatures', yourMarked: 'Your marked', theirMarked: 'Their marked' })}${renderOpKeywordFields(op.keywords ?? [], context, opIndex)}`;
    case 'addCounters':
      return `${numberField('n', op.n, 1, 12)}${selectField('to', op.to, ['target', 'self'])}`;
    case 'extraLandDrop':
      return numberField('n', op.n ?? 1, 1, 9);
    case 'createToken':
      return `${selectField('token', op.token, TOKEN_OPTIONS.map((token) => token.id), Object.fromEntries(TOKEN_OPTIONS.map((token) => [token.id, `${token.name} ${token.attack}/${token.defense}`])))}${numberField('count', op.count, 1, 12)}`;
    case 'massDestroy':
      return selectField('filter', op.filter, ['allCreatures', 'allFliers', 'allEnchantments'], { allCreatures: 'All creatures', allFliers: 'All Skyborne', allEnchantments: 'All enchantments' });
    case 'awaken':
      return selectField('scope', op.scope, ['self', 'allYours'], { allYours: 'All yours' });
    case 'raise':
      return selectField('to', op.to ?? 'target', ['target', 'top'], { target: 'Target', top: 'Top grave creature' });
    case 'ifTargetMarked': {
      const thenContext = `${context}|if:${opIndex}:then`;
      const elseContext = `${context}|if:${opIndex}:else`;
      return `<div class="branch-editor"><h3>Target is marked</h3>${renderOpList(op.then, thenContext)}<h3>Target is not marked</h3>${renderOpList(op.else ?? [], elseContext)}</div>`;
    }
    default:
      return '<span class="no-fields">No additional fields</span>';
  }
}

function renderOpKeywordFields(keywords: Keyword[], context: string, opIndex: number): string {
  return `<fieldset class="mini-keywords"><legend>Granted Keywords</legend>${KEYWORD_OPTIONS.map((option) => (
    `<label title="${escapeHtml(option.reminder)}"><input type="checkbox" data-op-keyword="${option.keyword}" data-op-context="${escapeHtml(context)}" data-op-index="${opIndex}"${keywords.includes(option.keyword) ? ' checked' : ''} />${escapeHtml(option.name)}</label>`
  )).join('')}</fieldset>`;
}

function renderOpList(ops: ScorableEffectOp[], context: string): string {
  const rows = ops.map((op, opIndex) => {
    const kind = (op as { op: OpKind }).op;
    return `<div class="op-editor">
      <div class="op-head">
        <label>Effect<select data-op-kind data-op-context="${escapeHtml(context)}" data-op-index="${opIndex}">${optionMarkup(OP_OPTIONS.map((option) => option.kind), kind, Object.fromEntries(OP_OPTIONS.map((option) => [option.kind, option.label])))}</select></label>
        <button type="button" class="icon-button" data-remove-op data-op-context="${escapeHtml(context)}" data-op-index="${opIndex}" aria-label="Remove effect">×</button>
      </div>
      <div class="op-fields">${renderOpFields(op, context, opIndex)}</div>
    </div>`;
  }).join('');
  return `${rows || '<p class="empty-editor">No effects. Add one below.</p>'}
    <div class="add-op-row">
      <select data-new-op-context="${escapeHtml(context)}">${optionMarkup(OP_OPTIONS.map((option) => option.kind), 'damage', Object.fromEntries(OP_OPTIONS.map((option) => [option.kind, option.label])))}</select>
      <button type="button" data-add-op data-op-context="${escapeHtml(context)}">Add Effect</button>
    </div>`;
}

function renderStaticEditor(staticDef: StaticDef, abilityIndex: number): string {
  const scope = staticDef.scope;
  return `<div class="static-editor">
    <div class="field-grid three-up">
      <label>Scope<select data-ability-index="${abilityIndex}" data-ability-field="static-scope">${optionMarkup(['self', 'attached', 'filter'] as const, scope, { self: 'Self', attached: 'Attached', filter: 'Filtered team' })}</select></label>
      <label>Power<input type="number" min="-12" max="12" value="${staticDef.p ?? 0}" data-ability-index="${abilityIndex}" data-ability-field="static-p" /></label>
      <label>Health<input type="number" min="-12" max="12" value="${staticDef.t ?? 0}" data-ability-index="${abilityIndex}" data-ability-field="static-t" /></label>
      ${scope === 'filter' ? `<label>Subtype<input type="text" value="${escapeHtml(staticDef.filter?.subtype ?? '')}" data-ability-index="${abilityIndex}" data-ability-field="static-filter-subtype" /></label><label class="check-row"><input type="checkbox" data-ability-index="${abilityIndex}" data-ability-field="static-filter-other"${staticDef.filter?.other ? ' checked' : ''} /> Other only</label>` : ''}
    </div>
    <fieldset class="mini-keywords"><legend>Granted Keywords</legend>${KEYWORD_OPTIONS.map((option) => (
      `<label><input type="checkbox" data-static-keyword="${option.keyword}" data-ability-index="${abilityIndex}"${staticDef.grantKeywords?.includes(option.keyword) ? ' checked' : ''} />${escapeHtml(option.name)}</label>`
    )).join('')}</fieldset>
  </div>`;
}

function renderAbilities(): void {
  const state = store.getState();
  if (state.abilities.length === 0) {
    abilityList.innerHTML = '<p class="empty-editor">No abilities. Add one to price effects or statics.</p>';
    return;
  }
  abilityList.innerHTML = state.abilities.map((ability, abilityIndex) => `
    <details class="ability-editor" open>
      <summary><span>Ability ${abilityIndex + 1}</span><button type="button" class="icon-button" data-remove-ability="${abilityIndex}" aria-label="Remove ability">×</button></summary>
      <div class="ability-body">
        <div class="field-grid three-up">
          <label>Trigger<select data-ability-index="${abilityIndex}" data-ability-field="when">${optionMarkup(TRIGGERS, ability.when, TRIGGER_LABELS)}</select></label>
          ${ability.when !== 'static' ? `<label>Target<select data-ability-index="${abilityIndex}" data-ability-field="target">${optionMarkup(TARGETS, ability.target, TARGET_LABELS)}</select></label>` : ''}
          <label>Condition<select data-ability-index="${abilityIndex}" data-ability-field="condition">${optionMarkup(CONDITIONS, ability.condition, CONDITION_LABELS)}</select></label>
          ${ability.condition === 'markedThreshold' ? `
            <label>Threshold Count<input type="number" min="1" max="12" step="1" value="${ability.conditionN}" data-ability-index="${abilityIndex}" data-ability-field="condition-n" /></label>
            <label>Threshold Subject<select data-ability-index="${abilityIndex}" data-ability-field="condition-subject">
              <option value=""${ability.conditionSubject === null ? ' selected' : ''}>Unspecified</option>
              ${optionMarkup(THRESHOLD_SUBJECTS, ability.conditionSubject ?? '')}
            </select></label>
          ` : ''}
          ${ability.condition === 'controlsOther' ? `<label>Subtype<input type="text" value="${escapeHtml(ability.conditionSubtype ?? '')}" data-ability-index="${abilityIndex}" data-ability-field="condition-subtype" /></label>` : ''}
          ${ability.when === 'allyDies' || ability.when === 'allyAttacks' ? `
            <label>Only this subtype<input type="text" value="${escapeHtml(ability.filter?.subtype ?? '')}" data-ability-index="${abilityIndex}" data-ability-field="filter-subtype" /></label>
            <label class="check-row"><input type="checkbox" data-ability-index="${abilityIndex}" data-ability-field="filter-other"${ability.filter?.other ? ' checked' : ''} /> Other creatures only</label>
            ${ability.when === 'allyDies' ? `<label class="check-row"><input type="checkbox" data-ability-index="${abilityIndex}" data-ability-field="filter-sacrifice"${ability.filter?.sacrifice ? ' checked' : ''} /> Sacrificed only</label>` : ''}
          ` : ''}
          ${ability.when !== 'static' && ability.when !== 'spell' ? `<label class="check-row"><input type="checkbox" data-ability-index="${abilityIndex}" data-ability-field="once-per-turn"${ability.oncePerTurn ? ' checked' : ''} /> Once per turn</label>` : ''}
        </div>
        ${ability.when === 'static' ? renderStaticEditor(ability.static, abilityIndex) : renderOpList(ability.ops, `ability:${abilityIndex}`)}
      </div>
    </details>
  `).join('');
}

function costEditor(key: string, cost: CostState, note: string): string {
  return `<div class="cost-editor" data-cost-editor="${key}">
    <p class="field-note">${escapeHtml(note)}</p>
    <label>Generic<input type="number" min="0" max="9" step="1" value="${cost.generic}" data-mechanic-cost="${key}" data-cost-color="generic" /></label>
    ${COLOR_ORDER.map((color) => `<label>${pipSvg(color, 'tiny')}<input type="number" min="0" max="9" step="1" value="${cost.pips[color]}" data-mechanic-cost="${key}" data-cost-color="${color}" /></label>`).join('')}
  </div>`;
}

function mechanicKeywordEditor(key: 'hauntlink' | 'awakening', keywords: Keyword[]): string {
  return `<fieldset class="mini-keywords"><legend>Keywords</legend>${KEYWORD_OPTIONS.map((option) => (
    `<label><input type="checkbox" data-mechanic-keyword="${key}" value="${option.keyword}"${keywords.includes(option.keyword) ? ' checked' : ''} />${escapeHtml(option.name)}</label>`
  )).join('')}</fieldset>`;
}

function renderMechanicEditors(): void {
  const mechanics = store.getState().mechanics;
  const panels: string[] = [];
  if (mechanics.empower.enabled) panels.push(`<details open><summary>Empower</summary>${costEditor('empower', mechanics.empower.cost, 'The rider is priced at 0.5 times its op value. The total printed plus Empower MV warns above 9.')}${renderOpList(mechanics.empower.ops, 'empower')}</details>`);
  if (mechanics.rite.enabled) panels.push(`<details open><summary>Rite</summary><label>Creatures Sacrificed<input type="number" min="1" max="9" value="${mechanics.rite.n}" data-mechanic-number="rite" /></label><p class="field-note">Rite is a -0.70 MEP drawback per creature.</p></details>`);
  if (mechanics.nineLives.enabled) panels.push('<details open><summary>Nine Lives</summary><p class="field-note">Flat +0.90 MEP. Creature-only rules validity is not silently enforced.</p></details>');
  if (mechanics.preserve.enabled) panels.push(`<details open><summary>Preserve</summary>${costEditor('preserve', mechanics.preserve.cost, 'No MEP effect from cost. Preserve is a flat +0.50 option value.')}</details>`);
  if (mechanics.skim.enabled) panels.push(`<details open><summary>Skim</summary>${costEditor('skim', mechanics.skim.cost, 'No MEP effect from cost. Skim is a flat +0.35 option value.')}</details>`);
  if (mechanics.retell.enabled) panels.push(`<details open><summary>Retell</summary>${costEditor('retell', mechanics.retell.cost, 'No direct MEP effect from cost. Retell prices the recast effect at 0.40 times value.')}<label class="check-row"><input type="checkbox" data-retell-override${mechanics.retell.overrideOps ? ' checked' : ''} /> Override printed ops</label>${mechanics.retell.overrideOps ? renderOpList(mechanics.retell.ops, 'retell') : ''}</details>`);
  if (mechanics.hauntlink.enabled) panels.push(`<details open><summary>Hauntlink</summary>${costEditor('hauntlink', mechanics.hauntlink.cost, 'Hauntlink MEP includes linked magnitude and the relink cost tax.')}<div class="field-grid two-up"><label>Linked Power<input type="number" min="-12" max="12" value="${mechanics.hauntlink.p}" data-mechanic-stat="hauntlink" data-stat="p" /></label><label>Linked Health<input type="number" min="-12" max="12" value="${mechanics.hauntlink.t}" data-mechanic-stat="hauntlink" data-stat="t" /></label></div>${mechanicKeywordEditor('hauntlink', mechanics.hauntlink.keywords)}</details>`);
  if (mechanics.awakening.enabled) panels.push(`<details open><summary>Awakening</summary><div class="field-grid two-up"><label>Awakened Power<input type="number" min="-12" max="12" value="${mechanics.awakening.p}" data-mechanic-stat="awakening" data-stat="p" /></label><label>Awakened Health<input type="number" min="-12" max="12" value="${mechanics.awakening.t}" data-mechanic-stat="awakening" data-stat="t" /></label></div>${mechanicKeywordEditor('awakening', mechanics.awakening.keywords)}</details>`);
  if (mechanics.chapters.enabled) panels.push(`<details open><summary>Quest Chapters</summary>${mechanics.chapters.chapters.map((ops, chapterIndex) => `<div class="chapter-editor"><div class="section-heading"><h3>Chapter ${chapterIndex + 1}</h3><button type="button" class="icon-button" data-remove-chapter="${chapterIndex}" aria-label="Remove chapter">×</button></div>${renderOpList(ops, `chapter:${chapterIndex}`)}</div>`).join('')}<button type="button" class="small-button" data-add-chapter>Add Chapter</button></details>`);
  if (mechanics.manaAbility.enabled) panels.push(`<details open><summary>Mana Ability</summary><fieldset class="mana-ability-colors"><legend>Produces</legend>${COLOR_ORDER.map((color) => `<label>${pipSvg(color, 'tiny')}<input type="checkbox" data-mana-ability-color="${color}"${mechanics.manaAbility.colors.includes(color) ? ' checked' : ''} />${PIP_VISUALS[color].label}</label>`).join('')}</fieldset><p class="field-note">Nonland mana sources score +1.30 MEP. Land mana has no MEP effect.</p></details>`);
  if (mechanics.entersTapped.enabled) panels.push('<details open><summary>Enters Tapped</summary><p class="field-note">Printed rules text only. No MEP effect in scoreCore.</p></details>');
  if (mechanics.activated.enabled) panels.push(`<details open><summary>Duty (tap ability)</summary>${costEditor('activated', mechanics.activated.cost, 'Mana paid beside the tap; leave at zero for a free tap. Section 4q: expected activations reuse the dawn split (2.0x creature / 3.0x non-creature) minus 0.4 per activation mana, cap 1.5, floor 0. A creature whose per-trigger value reaches 2.0 uses perTrigger + 1.0 (NEEDS MATH band).')}<label>Target<select data-mechanic-target="activated">${optionMarkup(TARGETS.filter((target) => target !== 'spell'), mechanics.activated.target, TARGET_LABELS)}</select></label>${renderOpList(mechanics.activated.ops, 'activated')}${mechanics.activated.extra?.length ? `<p class="no-fields">Plus ${mechanics.activated.extra.length} more Dut${mechanics.activated.extra.length > 1 ? 'ies' : 'y'} from the loaded card, kept as printed. Duties share the one tap: the best is priced in full, each other at x0.2 (section 4t, NEEDS MATH).</p>` : ''}</details>`);
  if (mechanics.whispers.enabled) panels.push(`<details open><summary>Whispers (fresh-graveyard cast)</summary>${costEditor('whispers', mechanics.whispers.cost, 'Section 4r: on a Charm the option is 0.5 x (printed MV minus Whispers MV); on a body or sorcery-speed effect it is 0 at printed. E_FIRE is NEEDS MATH until measured. Guard: keep the Whispers cost at fair - 1, never below fair - 2.')}</details>`);
  if (mechanics.tithe.enabled) panels.push('<details open><summary>Tithe (any-number sacrifice)</summary><p class="field-note">Section 4s: flat +0.50 option (Kamigawa Offering regime). One generic less per two points of sacrificed Defense, rounded down; pips always paid. Creatures only; Drowned Deep prints it only on Horrors. Not with X, Retell, Hauntlink, Whispers or Rite. Renamed from Dread 2026-09-11.</p></details>');
  mechanicEditors.innerHTML = panels.join('');
}

type RootOpsContext = `ability:${number}` | 'empower' | 'retell' | 'activated' | `chapter:${number}`;
type OpsContext = string;

function rootOpsForContext(state: BuilderState, context: RootOpsContext): ScorableEffectOp[] {
  if (context.startsWith('ability:')) return state.abilities[Number(context.split(':')[1])].ops;
  if (context === 'empower') return state.mechanics.empower.ops;
  if (context === 'retell') return state.mechanics.retell.ops;
  if (context === 'activated') return state.mechanics.activated.ops;
  return state.mechanics.chapters.chapters[Number(context.split(':')[1])];
}

function opsForContext(state: BuilderState, context: OpsContext): ScorableEffectOp[] {
  const branch = /^(.*)\|if:(\d+):(then|else)$/.exec(context);
  if (!branch) return rootOpsForContext(state, context as RootOpsContext);
  const parent = opsForContext(state, branch[1]);
  const gate = parent[Number(branch[2])];
  if (gate?.op !== 'ifTargetMarked') throw new Error(`Invalid marked branch context: ${context}`);
  return branch[3] === 'then' ? gate.then : (gate.else ?? []);
}

function renderAllEditors(): void {
  renderAbilities();
  renderMechanicEditors();
}

byId<HTMLButtonElement>('add-ability').addEventListener('click', () => {
  mutate((next) => { next.abilities.push({ when: 'arrives', condition: 'none', conditionN: 3, conditionSubject: null, target: 'none', ops: [{ op: 'foresee', n: 1 }], static: { scope: 'self', p: 0, t: 0, grantKeywords: [] } }); });
  renderAbilities();
});

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const removeAbility = target.closest<HTMLButtonElement>('[data-remove-ability]');
  if (removeAbility) {
    event.preventDefault();
    const index = Number(removeAbility.dataset.removeAbility);
    mutate((next) => { next.abilities.splice(index, 1); });
    renderAbilities();
    return;
  }
  const removeOp = target.closest<HTMLButtonElement>('[data-remove-op]');
  if (removeOp) {
    const context = removeOp.dataset.opContext as OpsContext;
    const index = Number(removeOp.dataset.opIndex);
    mutate((next) => { opsForContext(next, context).splice(index, 1); });
    renderAllEditors();
    return;
  }
  const addOp = target.closest<HTMLButtonElement>('[data-add-op]');
  if (addOp) {
    const context = addOp.dataset.opContext as OpsContext;
    const select = document.querySelector<HTMLSelectElement>(`[data-new-op-context="${CSS.escape(context)}"]`);
    if (!select) return;
    mutate((next) => { opsForContext(next, context).push(defaultOp(select.value as OpKind)); });
    renderAllEditors();
    return;
  }
  const addChapter = target.closest<HTMLButtonElement>('[data-add-chapter]');
  if (addChapter) {
    mutate((next) => { next.mechanics.chapters.chapters.push([{ op: 'foresee', n: 1 }]); });
    renderMechanicEditors();
    return;
  }
  const removeChapter = target.closest<HTMLButtonElement>('[data-remove-chapter]');
  if (removeChapter) {
    mutate((next) => { next.mechanics.chapters.chapters.splice(Number(removeChapter.dataset.removeChapter), 1); });
    renderMechanicEditors();
  }
});

function setOpField(op: ScorableEffectOp, field: string, rawValue: string): void {
  const target = op as unknown as Record<string, unknown>;
  if (field === 'n' && op.op === 'damage') target[field] = rawValue === 'X' ? 'X' : Number(rawValue);
  else if (['n', 'p', 't', 'count'].includes(field)) target[field] = Number(rawValue);
  else target[field] = rawValue;
}

document.addEventListener('input', (event) => {
  const input = event.target as HTMLInputElement | HTMLSelectElement;
  const opField = input.dataset.opField;
  const opContext = input.dataset.opContext as OpsContext | undefined;
  if (opField && opContext) {
    mutate((next) => setOpField(opsForContext(next, opContext)[Number(input.dataset.opIndex)], opField, input.value));
    return;
  }
  const abilityField = input.dataset.abilityField;
  if (abilityField) {
    const index = Number(input.dataset.abilityIndex);
    mutate((next) => {
      const ability = next.abilities[index];
      if (abilityField === 'when') ability.when = input.value as typeof ability.when;
      else if (abilityField === 'target') ability.target = input.value as typeof ability.target;
      else if (abilityField === 'condition') ability.condition = input.value as BuilderConditionKind;
      else if (abilityField === 'condition-n') ability.conditionN = Number(input.value);
      else if (abilityField === 'condition-subject') ability.conditionSubject = input.value
        ? input.value as MarkedThresholdSubject
        : null;
      else if (abilityField === 'condition-subtype') ability.conditionSubtype = input.value;
      else if (abilityField === 'filter-subtype') ability.filter = { ...ability.filter, subtype: input.value };
      else if (abilityField === 'filter-other') ability.filter = { ...ability.filter, other: (input as HTMLInputElement).checked ? true : undefined };
      else if (abilityField === 'filter-sacrifice') ability.filter = { ...ability.filter, sacrifice: (input as HTMLInputElement).checked ? true : undefined };
      else if (abilityField === 'once-per-turn') ability.oncePerTurn = (input as HTMLInputElement).checked;
      else if (abilityField === 'static-scope') ability.static.scope = input.value as StaticDef['scope'];
      else if (abilityField === 'static-p') ability.static.p = Number(input.value);
      else if (abilityField === 'static-t') ability.static.t = Number(input.value);
      else if (abilityField === 'static-filter-subtype') ability.static.filter = { ...ability.static.filter, subtype: input.value };
      else if (abilityField === 'static-filter-other') ability.static.filter = { ...ability.static.filter, other: (input as HTMLInputElement).checked };
    });
    if (abilityField === 'when' || abilityField === 'condition' || abilityField === 'static-scope') renderAbilities();
    return;
  }
  const mechanicNumber = input.dataset.mechanicNumber;
  if (mechanicNumber === 'rite') {
    mutate((next) => { next.mechanics.rite.n = Number(input.value); });
    return;
  }
  const mechanicCost = input.dataset.mechanicCost as 'empower' | 'preserve' | 'skim' | 'retell' | 'hauntlink' | 'activated' | 'whispers' | undefined;
  if (mechanicCost) {
    mutate((next) => {
      const cost = next.mechanics[mechanicCost].cost;
      const color = input.dataset.costColor as Color | 'generic';
      if (color === 'generic') cost.generic = Number(input.value);
      else cost.pips[color] = Number(input.value);
    });
    return;
  }
  const mechanicStat = input.dataset.mechanicStat as 'hauntlink' | 'awakening' | undefined;
  if (mechanicStat) {
    mutate((next) => { next.mechanics[mechanicStat][input.dataset.stat as 'p' | 't'] = Number(input.value); });
  }
});

document.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement | HTMLSelectElement;
  if (input.matches('[data-op-kind]')) {
    const context = input.dataset.opContext as OpsContext;
    mutate((next) => { opsForContext(next, context)[Number(input.dataset.opIndex)] = defaultOp(input.value as OpKind); });
    renderAllEditors();
    return;
  }
  if (input.matches('[data-op-keyword]')) {
    const context = input.dataset.opContext as OpsContext;
    const keyword = input.dataset.opKeyword as Keyword;
    mutate((next) => {
      const op = opsForContext(next, context)[Number(input.dataset.opIndex)];
      if (op.op !== 'boost') return;
      const set = new Set(op.keywords ?? []);
      if ((input as HTMLInputElement).checked) set.add(keyword); else set.delete(keyword);
      op.keywords = [...set];
    });
    return;
  }
  if (input.matches('[data-static-keyword]')) {
    const index = Number(input.dataset.abilityIndex);
    const keyword = input.dataset.staticKeyword as Keyword;
    mutate((next) => {
      const set = new Set(next.abilities[index].static.grantKeywords ?? []);
      if ((input as HTMLInputElement).checked) set.add(keyword); else set.delete(keyword);
      next.abilities[index].static.grantKeywords = [...set];
    });
    return;
  }
  const mechanicToggle = input.dataset.mechanicToggle as keyof BuilderMechanics | undefined;
  if (mechanicToggle) {
    mutate((next) => { next.mechanics[mechanicToggle].enabled = (input as HTMLInputElement).checked; });
    renderMechanicEditors();
    return;
  }
  if (input.matches('[data-retell-override]')) {
    mutate((next) => { next.mechanics.retell.overrideOps = (input as HTMLInputElement).checked; });
    renderMechanicEditors();
    return;
  }
  if (input.matches('[data-mechanic-target="activated"]')) {
    mutate((next) => { next.mechanics.activated.target = input.value as BuilderMechanics['activated']['target']; });
    return;
  }
  const mechanicKeyword = input.dataset.mechanicKeyword as 'hauntlink' | 'awakening' | undefined;
  if (mechanicKeyword) {
    const keyword = input.value as Keyword;
    mutate((next) => {
      const list = next.mechanics[mechanicKeyword].keywords;
      if ((input as HTMLInputElement).checked && !list.includes(keyword)) list.push(keyword);
      else next.mechanics[mechanicKeyword].keywords = list.filter((candidate) => candidate !== keyword);
    });
    return;
  }
  const manaColor = input.dataset.manaAbilityColor as ManaAbilityColor | undefined;
  if (manaColor) {
    mutate((next) => {
      const list = next.mechanics.manaAbility.colors;
      if ((input as HTMLInputElement).checked && !list.includes(manaColor)) list.push(manaColor);
      else next.mechanics.manaAbility.colors = list.filter((candidate) => candidate !== manaColor);
    });
  }
});

const loadCards = [...ALL_CARDS].sort((left, right) => (
  left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
));
const loadCardById = new Map(loadCards.map((card) => [card.id, card]));
const loadSets = [...new Set(loadCards.map((card) => card.set ?? 'base'))]
  .sort((left, right) => left.localeCompare(right));
let loadSearchValue = '';
let loadSetValue = 'all';
let loadColorValue = 'all';
let loadedSourceCard: ScorableCardDef | null = null;
let loadedBaseline: BuilderState | null = null;
let loadedFidelityWarnings: string[] = [];
const loadSearch = byId<HTMLInputElement>('load-search');
const loadSetFilter = byId<HTMLSelectElement>('load-set-filter');
const loadColorFilter = byId<HTMLSelectElement>('load-color-filter');
const loadResults = byId<HTMLDivElement>('load-results');
const loadResultCount = byId<HTMLSpanElement>('load-result-count');
const loadedCardChip = byId<HTMLDivElement>('loaded-card-chip');
const loadedCardLabel = byId<HTMLSpanElement>('loaded-card-label');
const resetLoaded = byId<HTMLButtonElement>('reset-loaded');

function setLabel(set: string): string {
  return SET_LABELS[set as keyof typeof SET_LABELS] ?? titleCase(set.replaceAll('-', ' '));
}

loadSetFilter.innerHTML = '<option value="all">All sets</option>'
  + loadSets.map((set) => `<option value="${escapeHtml(set)}">${escapeHtml(setLabel(set))}</option>`).join('');
loadColorFilter.innerHTML = '<option value="all">All colors</option>'
  + COLOR_ORDER.map((color) => `<option value="${color}">${PIP_VISUALS[color].label}</option>`).join('')
  + '<option value="C">Colorless</option>';

function filteredLoadCards(): ScorableCardDef[] {
  const query = loadSearchValue.trim().toLowerCase();
  return loadCards.filter((card) => {
    if (query && !`${card.name} ${card.id}`.toLowerCase().includes(query)) return false;
    if (loadSetValue !== 'all' && (card.set ?? 'base') !== loadSetValue) return false;
    if (loadColorValue === 'C' && card.colors.length > 0) return false;
    if (COLOR_ORDER.includes(loadColorValue as Color) && !card.colors.includes(loadColorValue as Color)) return false;
    return true;
  });
}

function cardColorLabel(card: ScorableCardDef): string {
  if (card.colors.length === 0) return 'Colorless';
  return card.colors.map((color) => PIP_VISUALS[color].label).join('/');
}

function renderLoadResults(): void {
  const matches = filteredLoadCards();
  const selectedId = loadedSourceCard?.id;
  loadResultCount.textContent = `${matches.length} cards`;
  loadResults.innerHTML = matches.map((card) => `
    <button type="button" class="load-card-row ${card.id === selectedId ? 'selected' : ''}" data-load-card-id="${escapeHtml(card.id)}">
      <strong>${escapeHtml(card.name)}</strong>
      <span>${escapeHtml(card.id)}</span>
      <small>${escapeHtml(setLabel(card.set ?? 'base'))} / ${escapeHtml(cardColorLabel(card))}</small>
    </button>
  `).join('') || '<p class="empty-editor">No cards match these filters.</p>';
}

const FIDELITY_FIELDS = [
  'id',
  'name',
  'types',
  'subtypes',
  'supertypes',
  'cost',
  'colors',
  'attack',
  'defense',
  'keywords',
  'x',
  'abilities',
  'empower',
  'rite',
  'nineLives',
  'preserve',
  'skim',
  'retell',
  'hauntlink',
  'awakening',
  'chapters',
  'manaAbility',
  'entersTapped',
  'activated',
  'whispers',
  'tithe',
  'rarity',
  'flavor',
  'token',
  'set',
] as const satisfies readonly (keyof ScorableCardDef)[];

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, nested) => {
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return nested;
    return Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right)));
  });
}

function fidelityFieldValue(card: ScorableCardDef, field: (typeof FIDELITY_FIELDS)[number]): unknown {
  const value = card[field];
  if (field === 'colors') return [...(value as Color[])].sort();
  return value;
}

function fidelityNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

function fidelityWarningsFor(source: ScorableCardDef, baseline: BuilderState): string[] {
  const converted = toCardDef(baseline);
  const changedFields = FIDELITY_FIELDS.filter((field) => (
    stableJson(fidelityFieldValue(source, field)) !== stableJson(fidelityFieldValue(converted, field))
  ));
  const originalScore = scoreCard(source);
  const convertedScore = scoreCard(converted);
  const scoreChanges = [
    ['PowerScore', originalScore.power, convertedScore.power],
    ['Budget', originalScore.budget, convertedScore.budget],
    ['Delta', originalScore.delta, convertedScore.delta],
  ] as const;
  const changedScores = scoreChanges
    .filter(([, before, after]) => before !== after)
    .map(([label, before, after]) => `${label} ${fidelityNumber(before)} to ${fidelityNumber(after)}`);
  const warnings: string[] = [];
  if (changedFields.length > 0) {
    warnings.push(`Load round trip did not preserve: ${changedFields.join(', ')}.${changedScores.length === 0 ? ' Score is unchanged.' : ''}`);
  }
  if (changedScores.length > 0) warnings.push(`Load round trip changed ${changedScores.join(', ')}.`);
  return warnings;
}

function applyLoadedCard(card: ScorableCardDef): void {
  const appearance = { ...store.getState().appearance };
  const loaded = fromCardDef(card);
  loaded.appearance = appearance;
  loadedSourceCard = card;
  loadedBaseline = cloneBuilderState(loaded);
  loadedFidelityWarnings = fidelityWarningsFor(card, loadedBaseline);
  store.update(() => cloneBuilderState(loadedBaseline!));
  renderAllEditors();
  renderArtGrid();
  renderLoadResults();
}

function renderLoadedCardStatus(state: BuilderState): void {
  if (!loadedSourceCard || !loadedBaseline) {
    loadedCardChip.hidden = true;
    return;
  }
  const modified = stableJson(state) !== stableJson(loadedBaseline);
  loadedCardChip.hidden = false;
  loadedCardChip.classList.toggle('modified', modified);
  loadedCardLabel.textContent = `${modified ? 'Modified from' : 'Loaded'}: ${loadedSourceCard.name}`;
}

loadSearch.addEventListener('input', () => { loadSearchValue = loadSearch.value; renderLoadResults(); });
loadSetFilter.addEventListener('change', () => { loadSetValue = loadSetFilter.value; renderLoadResults(); });
loadColorFilter.addEventListener('change', () => { loadColorValue = loadColorFilter.value; renderLoadResults(); });
loadResults.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-load-card-id]');
  if (!button) return;
  const card = loadCardById.get(button.dataset.loadCardId!);
  if (card) applyLoadedCard(card);
});
byId<HTMLButtonElement>('random-card').addEventListener('click', () => {
  const matches = filteredLoadCards();
  if (matches.length === 0) return;
  applyLoadedCard(matches[Math.floor(Math.random() * matches.length)]);
});
resetLoaded.addEventListener('click', () => {
  if (!loadedBaseline) return;
  store.update(() => cloneBuilderState(loadedBaseline!));
  renderAllEditors();
  renderArtGrid();
  renderLoadResults();
});

const ART_PAGE_SIZE = 32;
const manifestCards = new Set(manifest.cards);
const artCards = ALL_CARDS.filter((card) => manifestCards.has(card.artRef ?? card.id));
let artSearchValue = '';
let artSetValue = 'all';
let artColorValue = 'all';
let artPage = 0;
const artSearch = byId<HTMLInputElement>('art-search');
const artSetFilter = byId<HTMLSelectElement>('art-set-filter');
const artColorFilter = byId<HTMLSelectElement>('art-color-filter');
const artGrid = byId<HTMLDivElement>('art-grid');
const artPageLabel = byId<HTMLSpanElement>('art-page-label');
const artPrev = byId<HTMLButtonElement>('art-prev');
const artNext = byId<HTMLButtonElement>('art-next');
artSetFilter.innerHTML = `<option value="all">All sets</option>${optionMarkup(SETS, '', SET_LABELS)}`;
artColorFilter.innerHTML = '<option value="all">All colors</option>' + COLOR_ORDER.map((color) => `<option value="${color}">${PIP_VISUALS[color].label}</option>`).join('') + '<option value="C">Colorless</option>';

function filteredArtCards(): CardDef[] {
  const query = artSearchValue.trim().toLowerCase();
  return artCards.filter((card) => {
    if (query && !`${card.name} ${card.id} ${card.subtypes.join(' ')}`.toLowerCase().includes(query)) return false;
    if (artSetValue !== 'all' && (card.set ?? 'base') !== artSetValue) return false;
    if (artColorValue === 'C' && card.colors.length > 0) return false;
    if (COLOR_ORDER.includes(artColorValue as Color) && !card.colors.includes(artColorValue as Color)) return false;
    return true;
  });
}

function renderArtGrid(): void {
  const matches = filteredArtCards();
  const pages = Math.max(1, Math.ceil(matches.length / ART_PAGE_SIZE));
  artPage = Math.min(Math.max(0, artPage), pages - 1);
  const visible = matches.slice(artPage * ART_PAGE_SIZE, (artPage + 1) * ART_PAGE_SIZE);
  const selected = store.getState().artDonorId;
  artGrid.innerHTML = visible.map((card) => {
    const artKey = card.artRef ?? card.id;
    return `<button type="button" class="art-thumb ${card.id === selected ? 'selected' : ''}" data-art-id="${card.id}" title="${escapeHtml(card.name)}">
      <img src="${escapeHtml(forgeArtUrl(artKey))}" alt="" loading="lazy" decoding="async" />
      <span>${escapeHtml(card.name)}</span>
    </button>`;
  }).join('') || '<p class="empty-editor">No real art matches these filters.</p>';
  artPageLabel.textContent = `${matches.length} arts · page ${artPage + 1}/${pages}`;
  artPrev.disabled = artPage === 0;
  artNext.disabled = artPage >= pages - 1;
}

artSearch.addEventListener('input', () => { artSearchValue = artSearch.value; artPage = 0; renderArtGrid(); });
artSetFilter.addEventListener('change', () => { artSetValue = artSetFilter.value; artPage = 0; renderArtGrid(); });
artColorFilter.addEventListener('change', () => { artColorValue = artColorFilter.value; artPage = 0; renderArtGrid(); });
artPrev.addEventListener('click', () => { artPage -= 1; renderArtGrid(); });
artNext.addEventListener('click', () => { artPage += 1; renderArtGrid(); });
artGrid.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-art-id]');
  if (!button) return;
  mutate((next) => { next.artDonorId = button.dataset.artId!; });
  renderArtGrid();
});
byId<HTMLButtonElement>('random-art').addEventListener('click', () => {
  const matches = filteredArtCards();
  if (matches.length === 0) return;
  const card = matches[Math.floor(Math.random() * matches.length)];
  mutate((next) => { next.artDonorId = card.id; });
  renderArtGrid();
});

function renderManaPreview(state: BuilderState): void {
  if (state.cardType === 'land') {
    manaPreview.innerHTML = '<span class="no-cost">No printed cost</span>';
    return;
  }
  const items: string[] = [];
  if (state.isX) items.push('<span class="generic-pip">X</span>');
  if (state.cost.generic > 0) items.push(`<span class="generic-pip">${state.cost.generic}</span>`);
  for (const color of COLOR_ORDER) {
    for (let index = 0; index < state.cost.pips[color]; index += 1) items.push(pipSvg(color, 'small'));
  }
  manaPreview.innerHTML = items.join('') || '<span class="generic-pip">0</span>';
}

function syncBasicControls(state: BuilderState): void {
  if (document.activeElement !== cardName) cardName.value = state.name;
  if (document.activeElement !== cardSubtypes) cardSubtypes.value = state.subtypesText;
  if (document.activeElement !== cardFlavor) cardFlavor.value = state.flavor;
  cardType.value = state.cardType;
  cardRarity.value = state.rarity;
  cardSet.value = state.set;
  cardLegendary.checked = state.legendary;
  genericMana.value = String(state.cost.generic);
  genericValue.value = String(state.cost.generic);
  manaValueOutput.value = `MV ${printedManaValue(state)}`;
  colorIdentityMode.value = state.colorOverride === null ? 'cost' : 'override';
  colorOverrideControls.hidden = state.colorOverride === null;
  for (const checkbox of colorOverrideControls.querySelectorAll<HTMLInputElement>('[data-color-identity]')) {
    checkbox.checked = state.colorOverride?.includes(checkbox.dataset.colorIdentity as Color) ?? false;
  }
  xSpell.checked = state.isX;
  manaSection.hidden = builderHasType(state, 'land');
  bodySection.hidden = !builderHasType(state, 'creature');
  cardAttack.value = String(state.attack);
  attackValue.value = String(state.attack);
  cardDefense.value = String(state.defense);
  defenseValue.value = String(state.defense);
  for (const color of COLOR_ORDER) byId<HTMLOutputElement>(`pip-count-${color}`).value = String(state.cost.pips[color]);
  frameStyle.value = state.appearance.frame;
  holoFinish.value = state.appearance.holo;
  fullArt.checked = state.appearance.fullArt;
  keywordScoreNote.textContent = builderHasType(state, 'creature')
    ? 'Keywords on creatures contribute their live MEP values.'
    : 'Noncreature keywords render but have no MEP effect.';
  for (const checkbox of document.querySelectorAll<HTMLInputElement>('[data-mechanic-toggle]')) {
    const key = checkbox.dataset.mechanicToggle as keyof BuilderMechanics;
    checkbox.checked = state.mechanics[key].enabled;
  }
  const typeSummary = [state.cardType, ...state.additionalTypes].map(titleCase).join(' ');
  byId('card-type-summary').textContent = `${typeSummary} · ${RARITY_LABELS[state.rarity]}`;
}

function verdictSubtitle(state: BuilderState, band: EvaluationBand): string {
  const cost = builderHasType(state, 'land') ? 'a costless land' : manaCostLabel(state.cost);
  const rarity = RARITY_LABELS[state.rarity];
  if (band === 'under') return `Under Value: delivers less than ${cost} at ${rarity} should buy.`;
  if (band === 'over') return `Over Value: does more than ${cost} at ${rarity} should buy.`;
  return `Accurate Value: within costing noise for ${cost} at ${rarity}.`;
}
type EvaluationBand = ReturnType<typeof evaluateBuilder>['band'];

function renderEvaluation(state: BuilderState): void {
  const evaluation = evaluateBuilder(state);
  const { score, band } = evaluation;
  byId('metric-power').textContent = format(score.power);
  byId('metric-budget').textContent = format(score.budget);
  byId('metric-delta').textContent = signed(score.delta);
  const budgetFormula = byId('budget-formula');
  budgetFormula.textContent = rarityBudgetLabel(state);
  budgetFormula.title = budgetFormula.textContent;
  const labels: Record<EvaluationBand, string> = { under: 'Under Value', accurate: 'Accurate Value', over: 'Over Value' };
  byId('verdict-label').textContent = labels[band];
  byId('verdict-subtitle').textContent = verdictSubtitle(state, band);
  const verdict = byId('verdict-copy');
  verdict.className = `verdict-copy ${band}`;
  const clamped = Math.min(3, Math.max(-3, score.delta));
  byId('gauge-needle').style.left = `${((clamped + 3) / 6) * 100}%`;
  byId('gauge-value').textContent = signed(score.delta);
  const warningChips = byId('warning-chips');
  warningChips.innerHTML = [...evaluation.warnings, ...loadedFidelityWarnings]
    .map((warning) => `<span>${escapeHtml(warning)}</span>`)
    .join('');
  byId('ledger-count').textContent = `${score.parts.length} parts`;
  byId('score-ledger').innerHTML = score.parts.map((part) => `<div><span>${escapeHtml(ledgerLabelForPart(evaluation.card, part))}</span><strong class="${part.v < 0 ? 'negative' : ''}">${signed(part.v)}</strong></div>`).join('') || '<p class="empty-editor">No priced parts.</p>';
  byId('ledger-total').textContent = format(score.power);
  renderHints(state, buildHints(state));
}

function renderHints(state: BuilderState, hints: CostingHint[]): void {
  const list = byId('hint-list');
  if (evaluateBuilder(state).band === 'accurate') {
    list.innerHTML = '<div class="accurate-note"><strong>Accurate Value</strong><span>Delta is already inside ±0.75. No change is recommended.</span></div>';
    return;
  }
  list.innerHTML = hints.map((hint, index) => `<article class="hint-row">
    <div><strong>${escapeHtml(hint.title)}</strong><span>${escapeHtml(hint.detail)}</span><small>${escapeHtml(hint.rateSource)}</small></div>
    <div class="hint-result"><span>${signed(hint.movement)} move</span><strong>Δ ${signed(hint.resultingDelta)}</strong><button type="button" data-apply-hint="${index}">Apply</button></div>
  </article>`).join('') || '<p class="empty-editor">No legal one-step lever improves this Delta.</p>';
  list.querySelectorAll<HTMLButtonElement>('[data-apply-hint]').forEach((button) => {
    button.addEventListener('click', () => {
      const hint = hints[Number(button.dataset.applyHint)];
      store.update(() => cloneBuilderState(hint.nextState));
      renderAllEditors();
      renderArtGrid();
    });
  });
}

store.subscribe(() => {
  const state = store.getState();
  syncBasicControls(state);
  renderKeywordPalette(state);
  renderAppliedKeywords(state);
  renderManaPreview(state);
  renderLoadedCardStatus(state);
  renderEvaluation(state);
});

renderAllEditors();
renderLoadResults();
renderArtGrid();
store.update((state) => state);

const qaMode = new URLSearchParams(window.location.search).get('qa') === '1';
const qaConsoleIssues: string[] = [];
if (qaMode) {
  const recordConsole = (level: 'error' | 'warn', args: unknown[]): void => {
    qaConsoleIssues.push(`${level}: ${args.map((value) => String(value)).join(' ')}`);
  };
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args: unknown[]) => { recordConsole('error', args); originalError(...args); };
  console.warn = (...args: unknown[]) => { recordConsole('warn', args); originalWarn(...args); };
  window.addEventListener('error', (event) => qaConsoleIssues.push(`window error: ${event.message}`));
  window.addEventListener('unhandledrejection', (event) => qaConsoleIssues.push(`unhandled rejection: ${String(event.reason)}`));
}

setQualityTier('full');
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'canvas-shell',
  width: CARD_BUILDER_GAME_CONFIG.width,
  height: CARD_BUILDER_GAME_CONFIG.height,
  backgroundColor: '#0a0812',
  audio: { noAudio: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [CardBuilderPreloadScene, CardBuilderScene],
});
game.registry.set('cardbuilder-store', store);

interface CardBuilderProbe {
  store: typeof store;
  evaluate(): ReturnType<typeof evaluateBuilder>;
  addKeyword(keyword: Keyword): void;
  applyFirstHint(): CostingHint | null;
  frameKey(): string;
  /** The art texture the card was last drawn with (the loading stand-in until the file lands). */
  artTexture(): string | null;
  /** The real-art texture the current donor should end up drawing (for a donor with an
   *  art file, as every art-picker donor and the default donor have). */
  donorArtTexture(): string;
  /** `performance.now()` when the first card was drawn, or null before it. */
  firstCardAt(): number | null;
  /** The page's Cinzel/Inter faces and their load status. */
  fonts(): FontFaceStatus[];
}

function cardScene(): CardBuilderScene | null {
  return game.scene.isActive('CardBuilder') ? game.scene.getScene('CardBuilder') as CardBuilderScene : null;
}

const probe: CardBuilderProbe = {
  store,
  evaluate: () => evaluateBuilder(store.getState()),
  addKeyword,
  applyFirstHint: () => {
    const hint = buildHints(store.getState(), 1)[0];
    if (!hint) return null;
    store.update(() => cloneBuilderState(hint.nextState));
    renderAllEditors();
    return hint;
  },
  frameKey: () => {
    const card = evaluateBuilder(store.getState()).card;
    return frameKeyFor(card.colors, card.types);
  },
  artTexture: () => cardScene()?.renderedArtTexture ?? null,
  donorArtTexture: () => artTextureKey(artKeyFor(store.getState().artDonorId)),
  firstCardAt: () => cardScene()?.firstDrawnAt ?? null,
  fonts: forgeFontStatus,
};

(window as unknown as { __game: Phaser.Game; __cardBuilder: CardBuilderProbe }).__game = game;
(window as unknown as { __game: Phaser.Game; __cardBuilder: CardBuilderProbe }).__cardBuilder = probe;

interface CardBuilderQaResult {
  status: 'pending' | 'pass' | 'fail';
  firstCardAt?: number;
  realArtAt?: number;
  artTexture?: string | null;
  fonts?: FontFaceStatus[];
  initialFrame?: string;
  frameAfterWhitePip?: string;
  initialDelta?: number;
  deltaAfterManaSlider?: number;
  draggedKeywordPart?: { label: string; v: number };
  hintPromisedDelta?: number;
  deltaAfterHint?: number;
  consoleIssues: string[];
  failure?: string;
}

const qaResult: CardBuilderQaResult = { status: 'pending', consoleIssues: qaConsoleIssues };
(window as unknown as { __cardBuilderQa: CardBuilderQaResult }).__cardBuilderQa = qaResult;

function waitFor(condition: () => boolean, failure: string, timeoutMs = 25000): Promise<void> {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const inspect = (): void => {
      if (condition()) {
        resolve();
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        reject(new Error(failure));
        return;
      }
      window.setTimeout(inspect, 100);
    };
    inspect();
  });
}

/** The first card is on the canvas (drawn with the art stand-in if its file is still on the way). */
function waitForCardScene(): Promise<void> {
  return waitFor(
    () => probe.firstCardAt() !== null && !document.querySelector('#canvas-shell .loading-note'),
    'CardBuilder scene did not draw the first card',
  );
}

/** The donor's own art file has landed and the card has been redrawn with it. */
function waitForDonorArt(): Promise<void> {
  return waitFor(
    () => probe.artTexture() === probe.donorArtTexture(),
    'The card was never redrawn with its real art',
  );
}

function publishQaResult(): void {
  document.documentElement.dataset.qaStatus = qaResult.status;
  const output = document.createElement('pre');
  output.id = 'qa-result';
  output.hidden = true;
  output.textContent = JSON.stringify(qaResult);
  document.body.append(output);
  const badge = document.createElement('div');
  badge.className = `qa-badge ${qaResult.status}`;
  badge.textContent = qaResult.status === 'pass' ? 'QA probe passed' : `QA probe failed: ${qaResult.failure ?? 'unknown'}`;
  document.body.append(badge);
}

async function runBrowserQa(): Promise<void> {
  try {
    await waitForCardScene();
    qaResult.firstCardAt = probe.firstCardAt() ?? undefined;
    qaResult.fonts = probe.fonts();
    await waitForDonorArt();
    qaResult.realArtAt = performance.now();
    qaResult.artTexture = probe.artTexture();
    if (!forgeFontsLoaded()) throw new Error('Card text is not using the loaded webfonts');

    qaResult.initialFrame = probe.frameKey();
    qaResult.initialDelta = probe.evaluate().score.delta;

    genericMana.value = '0';
    genericMana.dispatchEvent(new Event('input', { bubbles: true }));
    qaResult.deltaAfterManaSlider = probe.evaluate().score.delta;

    pipControls.querySelector<HTMLButtonElement>('[data-pip="W"][data-step="1"]')?.click();
    qaResult.frameAfterWhitePip = probe.frameKey();

    const dragSource = document.querySelector<HTMLElement>('[data-keyword="skyborne"]');
    const dropTarget = byId('canvas-drop-overlay');
    if (!dragSource) throw new Error('Skyborne drag source is missing');
    const transfer = new DataTransfer();
    dragSource.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    dropTarget.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    dropTarget.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    dragSource.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
    qaResult.draggedKeywordPart = probe.evaluate().score.parts.find((part) => part.label === 'skyborne');

    document.querySelector<HTMLButtonElement>('[data-keyword="sentinel"]')?.click();
    const firstHint = buildHints(store.getState(), 1)[0];
    const applyButton = document.querySelector<HTMLButtonElement>('[data-apply-hint="0"]');
    if (!firstHint || !applyButton) throw new Error('Expected an applicable Over Value hint');
    qaResult.hintPromisedDelta = firstHint.resultingDelta;
    applyButton.click();
    qaResult.deltaAfterHint = probe.evaluate().score.delta;

    if (qaResult.initialFrame === qaResult.frameAfterWhitePip) throw new Error('Frame did not respond to the added white pip');
    if (qaResult.initialDelta === qaResult.deltaAfterManaSlider) throw new Error('Delta did not respond to the mana slider');
    if (qaResult.draggedKeywordPart?.v !== 0.75) throw new Error('Skyborne ledger value did not equal +0.75 MEP');
    if (qaResult.hintPromisedDelta !== qaResult.deltaAfterHint) throw new Error('Applied hint Delta did not match its promise');
    if (qaConsoleIssues.length > 0) throw new Error(`Console reported ${qaConsoleIssues.length} issue(s)`);
    qaResult.status = 'pass';
  } catch (error) {
    qaResult.status = 'fail';
    qaResult.failure = error instanceof Error ? error.message : String(error);
  }
  publishQaResult();
}

if (qaMode) void runBrowserQa();
