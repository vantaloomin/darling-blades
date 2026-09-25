import Phaser from 'phaser';
import manifest from '../data/art-manifest.json';
import { ALL_CARDS } from '../data/catalog';
import { MECHANIC_DEFINITIONS, MECHANIC_NAMES, type MechanicId } from '../data/glossary';
import { artKeyFor, artTextureKey } from '../art/artLoader';
import { ICON_PATHS } from '../art/iconPaths';
import type { CardDef, Color, Keyword, ManaCost, StaticDef } from '../engine/types';
import { setQualityTier } from '../platform/quality';
import { frameKeyFor } from '../ui/CardFrameFactory';
import type { ScorableCardDef, ScorableEffectOp } from '../power/scoreCore';
import { buildHints, type CostingHint } from './hints';
import { translatePart } from './ledger';
import {
  COLOR_ORDER,
  builderHasType,
  cloneBuilderState,
  colorsForCost,
  createInitialBuilderState,
  evaluateBuilder,
  fidelityNotes,
  fromCardDef,
  manaCostLabel,
  printedManaValue,
  rarityBudgetLabel,
  toCardDef,
  type BuilderMechanics,
  type BuilderConditionKind,
  type BuilderState,
  type CostState,
  type ForgeWarning,
  type ManaAbilityColor,
  type MarkedThresholdSubject,
  type VerdictBand,
} from './logic';
import { escapeHtml, estimateTag, setRowMarkup, signedNumber, warningChipMarkup } from './markup';
import {
  MAX_IMPORT_BYTES,
  MAX_SET_CARDS,
  editingIndex,
  editorStatus,
  emptySet,
  entryFromState,
  exportFileName,
  exportSetJson,
  hasUnsavedChanges,
  importMessage,
  importSetText,
  sameEntry,
  saveToSet,
  scoreSummary,
  setDisplayName,
  slugify,
  stateFromEntry,
  type EditorSession,
  type ForgeSet,
  type ImportResult,
} from './setModel';
import {
  MAX_SHARE_URL_LENGTH,
  decodeSharePayload,
  encodeSharePayload,
  payloadFromFragment,
  shareUrl,
} from './share';
import {
  FORGE_STORAGE_KEY,
  parseAutosave,
  readAutosave,
  writeAutosave,
  type ForgeAutosave,
  type ForgeStorage,
} from './storage';
import { FORGE_LIMITS, opFieldRange, type ForgeEntry } from './validate';
import {
  CARD_TYPES,
  FRAME_CHOICES,
  HOLO_CHOICES,
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
  type CardImage,
  type FontFaceStatus,
} from './scene';
import './style.css';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Forge control is missing: #${id}`);
  return element as T;
}

const format = (value: number): string => value.toFixed(2);
const signed = signedNumber;
const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
const cardCount = (n: number): string => `${n} ${n === 1 ? 'card' : 'cards'}`;

/** A whole number inside the editors' range (the validator's range: see validate.ts). */
function clampInt(value: number, min: number, max: number): number {
  const whole = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, whole));
}

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

/** The effect editors' field labels. Creature stats are Attack and Defense. */
const FIELD_LABELS: Record<string, string> = {
  n: 'Amount', p: 'Attack', t: 'Defense', to: 'To', who: 'Who', scope: 'Scope', count: 'Count', token: 'Token', filter: 'Filter',
};

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
const addAbilityButton = byId<HTMLButtonElement>('add-ability');
const mechanicEditors = byId<HTMLDivElement>('mechanic-editors');
const frameStyle = byId<HTMLSelectElement>('frame-style');
const holoFinish = byId<HTMLSelectElement>('holo-finish');
const fullArt = byId<HTMLInputElement>('full-art');
const manaPreview = byId<HTMLDivElement>('mana-preview');
const appliedKeywords = byId<HTMLDivElement>('applied-keywords');

cardType.innerHTML = optionMarkup(CARD_TYPES, 'creature');
cardRarity.innerHTML = optionMarkup(RARITIES, 'c', RARITY_LABELS);
cardSet.innerHTML = optionMarkup(SETS, 'base', SET_LABELS);
frameStyle.innerHTML = optionMarkup(FRAME_CHOICES, 'default');
holoFinish.innerHTML = optionMarkup(HOLO_CHOICES, 'default');

// Mechanic toggles take their names and tooltips from the game's glossary.
for (const label of document.querySelectorAll<HTMLElement>('[data-mechanic-id]')) {
  const id = label.dataset.mechanicId as MechanicId;
  if (!Object.hasOwn(MECHANIC_DEFINITIONS, id)) continue;
  label.title = MECHANIC_DEFINITIONS[id];
  const name = label.querySelector<HTMLElement>('[data-mechanic-name]');
  if (name) name.textContent = MECHANIC_NAMES[id];
}

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

/** A printed mana cost as pips. Built from numbers only, never from player text. */
function costMarkup(cost: ManaCost | undefined, isX: boolean, pipClass: string): string {
  if (!cost) return '';
  const items: string[] = [];
  if (isX) items.push('<span class="generic-pip">X</span>');
  if (cost.generic > 0) items.push(`<span class="generic-pip">${Number(cost.generic)}</span>`);
  for (const color of COLOR_ORDER) {
    for (let index = 0; index < (cost.pips[color] ?? 0); index += 1) items.push(pipSvg(color, pipClass));
  }
  return items.join('') || '<span class="generic-pip">0</span>';
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
colorOverrideControls.innerHTML = `<legend>Colors</legend>${COLOR_ORDER.map((color) => `
  <label title="${PIP_VISUALS[color].label}">
    ${pipSvg(color, 'tiny')}
    <input type="checkbox" data-color-identity="${color}" aria-label="${PIP_VISUALS[color].label} color identity" />
  </label>
`).join('')}`;

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

setTextInputHandler(cardName, (next, value) => { next.name = value.slice(0, FORGE_LIMITS.nameLength); });
setTextInputHandler(cardSubtypes, (next, value) => { next.subtypesText = value; });
setTextInputHandler(cardFlavor, (next, value) => { next.flavor = value.slice(0, FORGE_LIMITS.flavorLength); });
cardType.addEventListener('change', () => mutate((next) => {
  next.cardType = cardType.value as BuilderState['cardType'];
  next.additionalTypes = [];
}));
cardRarity.addEventListener('change', () => mutate((next) => { next.rarity = cardRarity.value as BuilderState['rarity']; }));
cardSet.addEventListener('change', () => mutate((next) => { next.set = cardSet.value as BuilderState['set']; }));
cardLegendary.addEventListener('change', () => mutate((next) => { next.legendary = cardLegendary.checked; }));
genericMana.addEventListener('input', () => mutate((next) => { next.cost.generic = clampInt(Number(genericMana.value), 0, FORGE_LIMITS.generic); }));
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
cardAttack.addEventListener('input', () => mutate((next) => { next.attack = clampInt(Number(cardAttack.value), 0, FORGE_LIMITS.stat); }));
cardDefense.addEventListener('input', () => mutate((next) => { next.defense = clampInt(Number(cardDefense.value), 0, FORGE_LIMITS.stat); }));
frameStyle.addEventListener('change', () => mutate((next) => { next.appearance.frame = frameStyle.value as BuilderState['appearance']['frame']; }));
holoFinish.addEventListener('change', () => mutate((next) => { next.appearance.holo = holoFinish.value as BuilderState['appearance']['holo']; }));
fullArt.addEventListener('change', () => mutate((next) => { next.appearance.fullArt = fullArt.checked; }));

pipControls.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-pip]');
  if (!button) return;
  const color = button.dataset.pip as Color;
  const step = Number(button.dataset.step);
  mutate((next) => { next.cost.pips[color] = clampInt(next.cost.pips[color] + step, 0, FORGE_LIMITS.pip); });
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
const KNOWN_KEYWORDS = new Set<string>(KEYWORD_OPTIONS.map((option) => option.keyword));

function dragPayload(event: DragEvent): KeywordDragPayload | null {
  const text = event.dataTransfer?.getData(DRAG_TYPE);
  if (!text) return null;
  try {
    const payload = JSON.parse(text) as Partial<KeywordDragPayload>;
    if (typeof payload.keyword !== 'string' || !KNOWN_KEYWORDS.has(payload.keyword)) return null;
    return { keyword: payload.keyword as Keyword, source: payload.source === 'applied' ? 'applied' : 'palette' };
  } catch {
    return null;
  }
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
    return `<span class="keyword-chip applied-chip ${option.value < 0 ? 'negative' : ''}" draggable="true" data-keyword="${keyword}" title="${escapeHtml(option.reminder)}">
      ${escapeHtml(option.name)} <strong>${signed(option.value)}</strong>
      <button type="button" data-remove-keyword="${keyword}" aria-label="Remove ${escapeHtml(option.name)}">×</button>
    </span>`;
  }).join('');
}

/** How deep an effect list sits inside "If the target is marked" branches (1 = top level). */
function contextDepth(context: string): number {
  return 1 + (context.match(/\|if:/g)?.length ?? 0);
}

function renderOpFields(op: ScorableEffectOp, context: string, opIndex: number): string {
  const base = `data-op-context="${escapeHtml(context)}" data-op-index="${opIndex}"`;
  const kind = (op as { op: OpKind }).op;
  const numberField = (field: string, value: number) => {
    const range = opFieldRange(kind, field) ?? { min: 0, max: 20 };
    return `<label>${FIELD_LABELS[field] ?? titleCase(field)}<input type="number" min="${range.min}" max="${range.max}" step="1" value="${value}" ${base} data-op-field="${field}" /></label>`;
  };
  const selectField = (field: string, value: string, options: readonly string[], labels: Record<string, string> = {}) => (
    `<label>${FIELD_LABELS[field] ?? titleCase(field)}<select ${base} data-op-field="${field}">${optionMarkup(options, value, labels)}</select></label>`
  );
  switch (op.op) {
    case 'damage':
      return `${selectField('n', String(op.n), ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'X'])}${selectField('to', op.to, ['target', 'opponent', 'controller', 'eachCreature', 'eachOpponentCreature'], { eachCreature: 'Each creature', eachOpponentCreature: 'Each opposing creature' })}`;
    case 'gainLife': case 'draw': case 'foresee':
      return numberField('n', op.n);
    case 'loseLife': case 'discardRandom': case 'discard':
      return numberField('n', op.n);
    case 'sacrifice':
      return selectField('who', op.who, ['opponent', 'each'], { opponent: 'Opponent', each: 'Each player' });
    case 'severGrave': case 'grind':
      return `${numberField('n', op.n)}${selectField('who', op.who, ['self', 'opponent'])}`;
    case 'severTop':
      return numberField('n', op.n);
    case 'boost':
      return `${numberField('p', op.p)}${numberField('t', op.t)}${selectField('scope', op.scope, ['target', 'self', 'allYours', 'all', 'yourMarked', 'theirMarked'], { self: 'Self', allYours: 'All yours', all: 'All creatures', yourMarked: 'Your marked', theirMarked: 'Their marked' })}${renderOpKeywordFields(op.keywords ?? [], context, opIndex)}`;
    case 'addCounters':
      return `${numberField('n', op.n)}${selectField('to', op.to, ['target', 'self'])}`;
    case 'extraLandDrop':
      return numberField('n', op.n ?? 1);
    case 'createToken':
      return `${selectField('token', op.token, TOKEN_OPTIONS.map((token) => token.id), Object.fromEntries(TOKEN_OPTIONS.map((token) => [token.id, `${token.name} ${token.attack}/${token.defense}`])))}${numberField('count', op.count)}`;
    case 'massDestroy':
      return selectField('filter', op.filter, ['allCreatures', 'allFliers', 'allEnchantments'], { allCreatures: 'All creatures', allFliers: 'All Skyborne', allEnchantments: 'All enchantments' });
    case 'awaken':
      return selectField('scope', op.scope, ['self', 'allYours'], { allYours: 'All yours' });
    case 'raise':
      return selectField('to', op.to ?? 'target', ['target', 'top'], { target: 'Target', top: 'Top creature card in your graveyard' });
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

/** The effect kinds offered in a list: branches stop nesting at the validator's depth. */
function opKindsFor(context: string): OpKind[] {
  const kinds = OP_OPTIONS.map((option) => option.kind);
  return contextDepth(context) >= FORGE_LIMITS.branchDepth ? kinds.filter((kind) => kind !== 'ifTargetMarked') : kinds;
}

function renderOpList(ops: ScorableEffectOp[], context: string): string {
  const kinds = opKindsFor(context);
  const labels = Object.fromEntries(OP_OPTIONS.map((option) => [option.kind, option.label]));
  const rows = ops.map((op, opIndex) => {
    const kind = (op as { op: OpKind }).op;
    return `<div class="op-editor">
      <div class="op-head">
        <label>Effect<select data-op-kind data-op-context="${escapeHtml(context)}" data-op-index="${opIndex}">${optionMarkup(kinds.includes(kind) ? kinds : [...kinds, kind], kind, labels)}</select></label>
        <button type="button" class="icon-button" data-remove-op data-op-context="${escapeHtml(context)}" data-op-index="${opIndex}" aria-label="Remove effect">×</button>
      </div>
      <div class="op-fields">${renderOpFields(op, context, opIndex)}</div>
    </div>`;
  }).join('');
  const full = ops.length >= FORGE_LIMITS.opsPerList;
  return `${rows || '<p class="empty-editor">No effects yet. Add one below.</p>'}
    <div class="add-op-row">
      <select data-new-op-context="${escapeHtml(context)}"${full ? ' disabled' : ''}>${optionMarkup(kinds, 'damage', labels)}</select>
      <button type="button" data-add-op data-op-context="${escapeHtml(context)}"${full ? ' disabled' : ''}>Add Effect</button>
    </div>`;
}

const SUBTYPE_MAX = FORGE_LIMITS.filterSubtypeLength;
const STAT_RANGE = `min="${-FORGE_LIMITS.statChange}" max="${FORGE_LIMITS.statChange}"`;

function renderStaticEditor(staticDef: StaticDef, abilityIndex: number): string {
  const scope = staticDef.scope;
  return `<div class="static-editor">
    <div class="field-grid three-up">
      <label>Scope<select data-ability-index="${abilityIndex}" data-ability-field="static-scope">${optionMarkup(['self', 'attached', 'filter'] as const, scope, { self: 'Self', attached: 'Attached', filter: 'Filtered team' })}</select></label>
      <label>Attack<input type="number" ${STAT_RANGE} value="${staticDef.p ?? 0}" data-ability-index="${abilityIndex}" data-ability-field="static-p" /></label>
      <label>Defense<input type="number" ${STAT_RANGE} value="${staticDef.t ?? 0}" data-ability-index="${abilityIndex}" data-ability-field="static-t" /></label>
      ${scope === 'filter' ? `<label>Subtype<input type="text" maxlength="${SUBTYPE_MAX}" value="${escapeHtml(staticDef.filter?.subtype ?? '')}" data-ability-index="${abilityIndex}" data-ability-field="static-filter-subtype" /></label><label class="check-row"><input type="checkbox" data-ability-index="${abilityIndex}" data-ability-field="static-filter-other"${staticDef.filter?.other ? ' checked' : ''} /> Other only</label>` : ''}
    </div>
    <fieldset class="mini-keywords"><legend>Granted Keywords</legend>${KEYWORD_OPTIONS.map((option) => (
      `<label title="${escapeHtml(option.reminder)}"><input type="checkbox" data-static-keyword="${option.keyword}" data-ability-index="${abilityIndex}"${staticDef.grantKeywords?.includes(option.keyword) ? ' checked' : ''} />${escapeHtml(option.name)}</label>`
    )).join('')}</fieldset>
  </div>`;
}

function renderAbilities(): void {
  const state = store.getState();
  addAbilityButton.disabled = state.abilities.length >= FORGE_LIMITS.abilities;
  if (state.abilities.length === 0) {
    abilityList.innerHTML = '<p class="empty-editor">No abilities yet. Add one to give the card effects.</p>';
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
            <label>Threshold Count<input type="number" min="1" max="${FORGE_LIMITS.thresholdCount}" step="1" value="${ability.conditionN}" data-ability-index="${abilityIndex}" data-ability-field="condition-n" /></label>
            <label>Threshold Subject<select data-ability-index="${abilityIndex}" data-ability-field="condition-subject">
              <option value=""${ability.conditionSubject === null ? ' selected' : ''}>Unspecified</option>
              ${optionMarkup(THRESHOLD_SUBJECTS, ability.conditionSubject ?? '')}
            </select></label>
          ` : ''}
          ${ability.condition === 'controlsOther' ? `<label>Subtype<input type="text" maxlength="${SUBTYPE_MAX}" value="${escapeHtml(ability.conditionSubtype ?? '')}" data-ability-index="${abilityIndex}" data-ability-field="condition-subtype" /></label>` : ''}
          ${ability.when === 'allyDies' || ability.when === 'allyAttacks' ? `
            <label>Only this subtype<input type="text" maxlength="${SUBTYPE_MAX}" value="${escapeHtml(ability.filter?.subtype ?? '')}" data-ability-index="${abilityIndex}" data-ability-field="filter-subtype" /></label>
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
  const max = FORGE_LIMITS.generic;
  return `<div class="cost-editor" data-cost-editor="${key}">
    <p class="field-note">${escapeHtml(note)}</p>
    <label>Generic<input type="number" min="0" max="${max}" step="1" value="${cost.generic}" data-mechanic-cost="${key}" data-cost-color="generic" /></label>
    ${COLOR_ORDER.map((color) => `<label>${pipSvg(color, 'tiny')}<input type="number" min="0" max="${FORGE_LIMITS.pip}" step="1" value="${cost.pips[color]}" data-mechanic-cost="${key}" data-cost-color="${color}" aria-label="${PIP_VISUALS[color].label} mana" /></label>`).join('')}
  </div>`;
}

function mechanicKeywordEditor(key: 'hauntlink' | 'awakening', keywords: Keyword[]): string {
  return `<fieldset class="mini-keywords"><legend>Keywords</legend>${KEYWORD_OPTIONS.map((option) => (
    `<label title="${escapeHtml(option.reminder)}"><input type="checkbox" data-mechanic-keyword="${key}" value="${option.keyword}"${keywords.includes(option.keyword) ? ' checked' : ''} />${escapeHtml(option.name)}</label>`
  )).join('')}</fieldset>`;
}

function statInput(label: string, key: 'hauntlink' | 'awakening', stat: 'p' | 't', value: number): string {
  return `<label>${label}<input type="number" ${STAT_RANGE} value="${value}" data-mechanic-stat="${key}" data-stat="${stat}" /></label>`;
}

/** "Duty" to "Duties" (the name comes from the glossary, so it is not hardcoded). */
function dutyPlural(count: number): string {
  const name = MECHANIC_NAMES.duty;
  if (count === 1) return name;
  return name.endsWith('y') ? `${name.slice(0, -1)}ies` : `${name}s`;
}

function renderMechanicEditors(): void {
  const mechanics = store.getState().mechanics;
  const names = MECHANIC_NAMES;
  const panels: string[] = [];
  const note = (text: string): string => `<p class="field-note">${escapeHtml(text)}</p>`;
  if (mechanics.empower.enabled) panels.push(`<details open><summary>${names.empower}</summary>${costEditor('empower', mechanics.empower.cost, `The ${names.empower} effect counts at half its value. Cost plus ${names.empower} should stay at 9 or less.`)}${renderOpList(mechanics.empower.ops, 'empower')}</details>`);
  if (mechanics.rite.enabled) panels.push(`<details open><summary>${names.rite}</summary><label>Creatures Sacrificed<input type="number" min="1" max="${FORGE_LIMITS.riteSacrifices}" value="${mechanics.rite.n}" data-mechanic-number="rite" /></label>${note('Each creature sacrificed counts -0.70.')}</details>`);
  if (mechanics.nineLives.enabled) panels.push(`<details open><summary>${names.nineLives}</summary>${note('Counts a flat +0.90. It belongs on creatures; the Forge won\'t stop you putting it elsewhere.')}</details>`);
  if (mechanics.preserve.enabled) panels.push(`<details open><summary>${names.preserve}</summary>${costEditor('preserve', mechanics.preserve.cost, 'Counts a flat +0.50, whatever its cost.')}</details>`);
  if (mechanics.skim.enabled) panels.push(`<details open><summary>${names.skim}</summary>${costEditor('skim', mechanics.skim.cost, 'Counts a flat +0.35, whatever its cost.')}</details>`);
  if (mechanics.retell.enabled) panels.push(`<details open><summary>${names.retell}</summary>${costEditor('retell', mechanics.retell.cost, 'The recast counts at 0.40 of the effect\'s value. Its cost doesn\'t change that.')}<label class="check-row"><input type="checkbox" data-retell-override${mechanics.retell.overrideOps ? ' checked' : ''} /> Use different effects for the ${names.retell}</label>${mechanics.retell.overrideOps ? renderOpList(mechanics.retell.ops, 'retell') : ''}</details>`);
  if (mechanics.hauntlink.enabled) panels.push(`<details open><summary>${names.hauntlink}</summary>${costEditor('hauntlink', mechanics.hauntlink.cost, 'The value includes the linked bonus and the cost to relink.')}<div class="field-grid two-up">${statInput('Linked Attack', 'hauntlink', 'p', mechanics.hauntlink.p)}${statInput('Linked Defense', 'hauntlink', 't', mechanics.hauntlink.t)}</div>${mechanicKeywordEditor('hauntlink', mechanics.hauntlink.keywords)}</details>`);
  if (mechanics.awakening.enabled) panels.push(`<details open><summary>${names.championAwakening}</summary><div class="field-grid two-up">${statInput('Awakened Attack', 'awakening', 'p', mechanics.awakening.p)}${statInput('Awakened Defense', 'awakening', 't', mechanics.awakening.t)}</div>${mechanicKeywordEditor('awakening', mechanics.awakening.keywords)}</details>`);
  if (mechanics.chapters.enabled) {
    const full = mechanics.chapters.chapters.length >= FORGE_LIMITS.chapters;
    panels.push(`<details open><summary>${names.quest} Chapters</summary>${mechanics.chapters.chapters.map((ops, chapterIndex) => `<div class="chapter-editor"><div class="section-heading"><h3>Chapter ${chapterIndex + 1}</h3><button type="button" class="icon-button" data-remove-chapter="${chapterIndex}" aria-label="Remove chapter">×</button></div>${renderOpList(ops, `chapter:${chapterIndex}`)}</div>`).join('')}<button type="button" class="small-button" data-add-chapter${full ? ' disabled' : ''}>Add Chapter</button></details>`);
  }
  if (mechanics.manaAbility.enabled) panels.push(`<details open><summary>Mana Ability</summary><fieldset class="mana-ability-colors"><legend>Produces</legend>${COLOR_ORDER.map((color) => `<label>${pipSvg(color, 'tiny')}<input type="checkbox" data-mana-ability-color="${color}"${mechanics.manaAbility.colors.includes(color) ? ' checked' : ''} />${PIP_VISUALS[color].label}</label>`).join('')}</fieldset>${note('A mana source that isn\'t a land counts +1.30. Mana from lands counts nothing.')}</details>`);
  if (mechanics.entersTapped.enabled) panels.push(`<details open><summary>Enters Tapped</summary>${note('Printed on the card only. It doesn\'t change the score.')}</details>`);
  if (mechanics.activated.enabled) {
    const extra = mechanics.activated.extra?.length ?? 0;
    const extraNote = extra > 0
      ? `<p class="no-fields">${escapeHtml(`Plus ${extra} more ${dutyPlural(extra)} from the loaded card, kept as printed. They share one tap: the best counts in full and each other one at 0.2.`)}</p>`
      : '';
    panels.push(`<details open><summary>${names.duty}</summary>${costEditor('activated', mechanics.activated.cost, `Mana paid along with the tap; leave it at zero for a free tap. A ${names.duty} counts as about 2 uses on a creature and 3 on anything else, minus 0.4 for each mana it costs (at most 1.5 off).`)}<label>Target<select data-mechanic-target="activated">${optionMarkup(TARGETS.filter((target) => target !== 'spell'), mechanics.activated.target, TARGET_LABELS)}</select></label>${renderOpList(mechanics.activated.ops, 'activated')}${extraNote}</details>`);
  }
  if (mechanics.whispers.enabled) panels.push(`<details open><summary>${names.whispers}</summary>${costEditor('whispers', mechanics.whispers.cost, `On a Charm, ${names.whispers} is worth 0.5 for each mana it saves. On a creature or a sorcery-speed card it adds nothing at its printed cost. Real cards keep the ${names.whispers} cost 1 below the fair cost of the effect.`)}</details>`);
  if (mechanics.tithe.enabled) panels.push(`<details open><summary>${names.tithe}</summary>${note(`Counts a flat +0.50. As you cast it, sacrifice any number of creatures: it costs 1 less for every 2 points of their combined Defense, rounded down; colored mana is still paid. Not with X, ${names.retell}, ${names.hauntlink}, ${names.whispers} or ${names.rite}.`)}</details>`);
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
  if (branch[3] === 'else' && !gate.else) gate.else = [];
  return branch[3] === 'then' ? gate.then : (gate.else ?? []);
}

function renderAllEditors(): void {
  renderAbilities();
  renderMechanicEditors();
}

addAbilityButton.addEventListener('click', () => {
  if (store.getState().abilities.length >= FORGE_LIMITS.abilities) return;
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
    const kind = select.value as OpKind;
    if (!opKindsFor(context).includes(kind)) return;
    mutate((next) => {
      const ops = opsForContext(next, context);
      if (ops.length < FORGE_LIMITS.opsPerList) ops.push(defaultOp(kind));
    });
    renderAllEditors();
    return;
  }
  const addChapter = target.closest<HTMLButtonElement>('[data-add-chapter]');
  if (addChapter) {
    mutate((next) => {
      if (next.mechanics.chapters.chapters.length < FORGE_LIMITS.chapters) next.mechanics.chapters.chapters.push([{ op: 'foresee', n: 1 }]);
    });
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
  const range = opFieldRange(op.op, field);
  if (field === 'n' && op.op === 'damage' && rawValue === 'X') target[field] = 'X';
  else if (range) target[field] = clampInt(Number(rawValue), range.min, range.max);
  else target[field] = rawValue;
}

const STAT_LIMIT = FORGE_LIMITS.statChange;

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
    const subtype = input.value.slice(0, SUBTYPE_MAX);
    mutate((next) => {
      const ability = next.abilities[index];
      if (abilityField === 'when') ability.when = input.value as typeof ability.when;
      else if (abilityField === 'target') ability.target = input.value as typeof ability.target;
      else if (abilityField === 'condition') ability.condition = input.value as BuilderConditionKind;
      else if (abilityField === 'condition-n') ability.conditionN = clampInt(Number(input.value), 1, FORGE_LIMITS.thresholdCount);
      else if (abilityField === 'condition-subject') ability.conditionSubject = input.value
        ? input.value as MarkedThresholdSubject
        : null;
      else if (abilityField === 'condition-subtype') ability.conditionSubtype = subtype;
      else if (abilityField === 'filter-subtype') ability.filter = { ...ability.filter, subtype };
      else if (abilityField === 'filter-other') ability.filter = { ...ability.filter, other: (input as HTMLInputElement).checked ? true : undefined };
      else if (abilityField === 'filter-sacrifice') ability.filter = { ...ability.filter, sacrifice: (input as HTMLInputElement).checked ? true : undefined };
      else if (abilityField === 'once-per-turn') ability.oncePerTurn = (input as HTMLInputElement).checked;
      else if (abilityField === 'static-scope') ability.static.scope = input.value as StaticDef['scope'];
      else if (abilityField === 'static-p') ability.static.p = clampInt(Number(input.value), -STAT_LIMIT, STAT_LIMIT);
      else if (abilityField === 'static-t') ability.static.t = clampInt(Number(input.value), -STAT_LIMIT, STAT_LIMIT);
      else if (abilityField === 'static-filter-subtype') ability.static.filter = { ...ability.static.filter, subtype };
      else if (abilityField === 'static-filter-other') ability.static.filter = { ...ability.static.filter, other: (input as HTMLInputElement).checked };
    });
    if (abilityField === 'when' || abilityField === 'condition' || abilityField === 'static-scope') renderAbilities();
    return;
  }
  const mechanicNumber = input.dataset.mechanicNumber;
  if (mechanicNumber === 'rite') {
    mutate((next) => { next.mechanics.rite.n = clampInt(Number(input.value), 1, FORGE_LIMITS.riteSacrifices); });
    return;
  }
  const mechanicCost = input.dataset.mechanicCost as 'empower' | 'preserve' | 'skim' | 'retell' | 'hauntlink' | 'activated' | 'whispers' | undefined;
  if (mechanicCost) {
    mutate((next) => {
      const cost = next.mechanics[mechanicCost].cost;
      const color = input.dataset.costColor as Color | 'generic';
      if (color === 'generic') cost.generic = clampInt(Number(input.value), 0, FORGE_LIMITS.generic);
      else cost.pips[color] = clampInt(Number(input.value), 0, FORGE_LIMITS.pip);
    });
    return;
  }
  const mechanicStat = input.dataset.mechanicStat as 'hauntlink' | 'awakening' | undefined;
  if (mechanicStat) {
    mutate((next) => { next.mechanics[mechanicStat][input.dataset.stat as 'p' | 't'] = clampInt(Number(input.value), -STAT_LIMIT, STAT_LIMIT); });
  }
});

document.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement | HTMLSelectElement;
  if (input.matches('[data-op-kind]')) {
    const context = input.dataset.opContext as OpsContext;
    const kind = input.value as OpKind;
    if (!opKindsFor(context).includes(kind)) return;
    mutate((next) => { opsForContext(next, context)[Number(input.dataset.opIndex)] = defaultOp(kind); });
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

// ── Confirmations, messages and the banner ───────────────────────────────────

const DISCARD_CHANGES = 'Discard your unsaved changes to this card?';
/** The ?qa=1 probe answers confirmations itself; everyone else gets the browser's dialog. */
let confirmOverride: ((message: string) => boolean) | null = null;
function confirmAction(message: string): boolean {
  return confirmOverride ? confirmOverride(message) : window.confirm(message);
}

const banner = byId<HTMLDivElement>('forge-banner');
const bannerText = byId<HTMLParagraphElement>('forge-banner-text');
function showBanner(text: string, problem = false): void {
  bannerText.textContent = text;
  banner.classList.toggle('problem', problem);
  banner.hidden = false;
}
byId<HTMLButtonElement>('forge-banner-dismiss').addEventListener('click', () => { banner.hidden = true; });

const actionMessage = byId<HTMLParagraphElement>('action-message');
const setMessage = byId<HTMLParagraphElement>('set-message');
const messageTimers = new Map<HTMLElement, number>();
function showMessage(target: HTMLElement, text: string, problem = false, clearAfterMs = 0): void {
  target.textContent = text;
  target.classList.toggle('problem', problem);
  window.clearTimeout(messageTimers.get(target));
  if (clearAfterMs > 0) messageTimers.set(target, window.setTimeout(() => { target.textContent = ''; }, clearAfterMs));
}

// ── The set, and which card the editor holds ─────────────────────────────────

let forgeSet: ForgeSet = emptySet();
let session: EditorSession = { editingId: null, baseline: entryFromState(createInitialBuilderState(), '') };
let loadedSourceCard: ScorableCardDef | null = null;
let loadedBaseline: BuilderState | null = null;
let loadedFidelityWarnings: ForgeWarning[] = [];

const editorStatusLine = byId<HTMLParagraphElement>('editor-status');
const setNameInput = byId<HTMLInputElement>('set-name');
const setList = byId<HTMLOListElement>('set-list');
const setEmpty = byId<HTMLParagraphElement>('set-empty');
const setCount = byId<HTMLSpanElement>('set-count');
const clearSetButton = byId<HTMLButtonElement>('clear-set');
const importFile = byId<HTMLInputElement>('import-file');
const storageNote = byId<HTMLParagraphElement>('storage-note');

const hasUnsaved = (): boolean => hasUnsavedChanges(forgeSet, session, store.getState());

function typeLineOf(card: ScorableCardDef): string {
  const types = [...(card.supertypes ?? []), ...card.types].map(titleCase).join(' ');
  return card.subtypes.length > 0 ? `${types} · ${card.subtypes.join(' ')}` : types;
}

function renderSetPanel(): void {
  if (document.activeElement !== setNameInput) setNameInput.value = forgeSet.name;
  const editing = editingIndex(forgeSet, session);
  setList.innerHTML = forgeSet.cards.map((entry, index) => {
    const score = scoreSummary(entry.card);
    return setRowMarkup({
      id: entry.card.id,
      name: entry.card.name,
      typeLine: typeLineOf(entry.card),
      costHtml: costMarkup(entry.card.cost, entry.card.x !== undefined, 'tiny'),
      band: score.verdict,
      delta: score.delta,
      editing: index === editing,
    });
  }).join('');
  setList.hidden = forgeSet.cards.length === 0;
  setEmpty.hidden = forgeSet.cards.length > 0;
  setCount.textContent = cardCount(forgeSet.cards.length);
  clearSetButton.disabled = forgeSet.cards.length === 0;
}

function renderEditorStatus(): void {
  editorStatusLine.textContent = editorStatus(forgeSet, session, store.getState());
}

interface LoadedContext { source: ScorableCardDef; baseline: BuilderState }

/** Put a card in the editor, with what it is (session) and where it came from (loaded). */
function openInEditor(state: BuilderState, nextSession: EditorSession, loaded: LoadedContext | null): void {
  session = nextSession;
  loadedSourceCard = loaded?.source ?? null;
  loadedBaseline = loaded ? cloneBuilderState(loaded.baseline) : null;
  loadedFidelityWarnings = loaded ? fidelityNotes(loaded.source, toCardDef(loaded.baseline)) : [];
  store.update(() => cloneBuilderState(state));
  renderAllEditors();
  renderArtGrid();
  renderLoadResults();
  renderSetPanel();
  renderEditorStatus();
}

function startFreshCard(): void {
  const fresh = createInitialBuilderState();
  openInEditor(fresh, { editingId: null, baseline: entryFromState(fresh, '') }, null);
}

/** Save the card in the editor. False when the set is full. */
function saveCurrentCard(): boolean {
  const result = saveToSet(forgeSet, session, store.getState());
  if (!result.ok) {
    showMessage(actionMessage, `A set holds up to ${MAX_SET_CARDS} cards.`, true);
    return false;
  }
  forgeSet = result.set;
  session = { editingId: result.id, baseline: null };
  showMessage(actionMessage, '');
  renderSetPanel();
  renderEditorStatus();
  scheduleAutosave();
  return true;
}

byId<HTMLButtonElement>('save-to-set').addEventListener('click', () => { saveCurrentCard(); });
byId<HTMLButtonElement>('save-and-next').addEventListener('click', () => {
  if (saveCurrentCard()) startFreshCard();
});
byId<HTMLButtonElement>('new-card').addEventListener('click', () => {
  if (hasUnsaved() && !confirmAction(DISCARD_CHANGES)) return;
  startFreshCard();
});

function openSetCard(id: string): void {
  if (id === session.editingId) return;
  const entry = forgeSet.cards.find((candidate) => candidate.card.id === id);
  if (!entry) return;
  if (hasUnsaved() && !confirmAction(DISCARD_CHANGES)) return;
  openInEditor(stateFromEntry(entry), { editingId: id, baseline: null }, null);
}

function removeSetCard(id: string): void {
  const entry = forgeSet.cards.find((candidate) => candidate.card.id === id);
  if (!entry || !confirmAction(`Remove ${entry.card.name} from the set?`)) return;
  forgeSet = { ...forgeSet, cards: forgeSet.cards.filter((candidate) => candidate !== entry) };
  // The editor keeps the card, now as a new card that is not in the set.
  if (session.editingId === id) session = { editingId: null, baseline: null };
  renderSetPanel();
  renderEditorStatus();
  scheduleAutosave();
}

setList.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const remove = target.closest<HTMLButtonElement>('[data-remove-card]');
  if (remove) {
    removeSetCard(remove.dataset.removeCard ?? '');
    return;
  }
  const open = target.closest<HTMLButtonElement>('[data-open-card]');
  if (open) openSetCard(open.dataset.openCard ?? '');
});

setNameInput.addEventListener('input', () => {
  forgeSet = { ...forgeSet, name: setNameInput.value.slice(0, FORGE_LIMITS.setNameLength) };
  scheduleAutosave();
});
setNameInput.addEventListener('change', () => {
  if (!setNameInput.value.trim()) {
    forgeSet = { ...forgeSet, name: setDisplayName(forgeSet) };
    setNameInput.value = forgeSet.name;
    scheduleAutosave();
  }
});

/** Detach the editor from the set (after an import or a clear replaced it). */
function detachEditor(): void {
  if (session.editingId !== null) session = { editingId: null, baseline: null };
}

clearSetButton.addEventListener('click', () => {
  const n = forgeSet.cards.length;
  if (n === 0) return;
  const name = setDisplayName(forgeSet);
  const question = n === 1
    ? `Remove the 1 card in ${name}? Export it first if you want to keep it.`
    : `Remove all ${n} cards from ${name}? Export it first if you want to keep them.`;
  if (!confirmAction(question)) return;
  forgeSet = { ...forgeSet, cards: [] };
  detachEditor();
  showMessage(setMessage, '');
  renderSetPanel();
  renderEditorStatus();
  scheduleAutosave();
});

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

byId<HTMLButtonElement>('export-set').addEventListener('click', () => {
  downloadBlob(new Blob([exportSetJson(forgeSet)], { type: 'application/json' }), exportFileName(forgeSet));
});

/** Replace the set with an imported one (asking first when that loses cards). */
function applyImport(text: string): ImportResult {
  const result = importSetText(text);
  if (!result.ok) {
    showMessage(setMessage, importMessage(result), true);
    return result;
  }
  const n = forgeSet.cards.length;
  if (n > 0) {
    const name = setDisplayName(forgeSet);
    const question = n === 1
      ? `Replace the 1 card in ${name} with the imported set?`
      : `Replace the ${n} cards in ${name} with the imported set?`;
    if (!confirmAction(question)) return result;
  }
  forgeSet = result.set;
  detachEditor();
  showMessage(setMessage, importMessage(result), result.skipped.length > 0 || result.overCap > 0);
  renderSetPanel();
  renderEditorStatus();
  scheduleAutosave();
  return result;
}

byId<HTMLButtonElement>('import-set').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', () => {
  const file = importFile.files?.[0];
  importFile.value = '';
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    showMessage(setMessage, importMessage({ ok: false, problem: 'too-large' }), true);
    return;
  }
  file.text().then(applyImport, () => showMessage(setMessage, importMessage({ ok: false, problem: 'not-a-set' }), true));
});

// ── Autosave (darlingblades.forge.v1 only; see storage.ts) ───────────────────

/**
 * The page's storage, or null when the browser refuses it. `window.` is
 * spelled out: the build replaces a bare `localStorage` with `undefined`
 * (vite.forge.config.ts) so that Phaser's own storage probe finds nothing.
 */
function forgeStorage(): (ForgeStorage & Storage) | null {
  try {
    const storage = window.localStorage;
    storage.getItem(FORGE_STORAGE_KEY);
    return storage;
  } catch {
    return null;
  }
}

const storage = forgeStorage();
let storageWorking = storage !== null;
let autosaveTimer = 0;
let autosaveSuspended = false;

function renderStorageNote(): void {
  storageNote.textContent = storageWorking
    ? 'Your set is saved in this browser. Export it to keep a copy or move it to another device.'
    : 'This browser isn\'t saving your set. Export it before you close the tab.';
  storageNote.classList.toggle('problem', !storageWorking);
}

function autosaveSnapshot(): ForgeAutosave {
  return {
    set: forgeSet,
    editor: {
      entry: entryFromState(store.getState(), 'forge-editor'),
      editingId: session.editingId,
      baseline: session.baseline,
      loadedFrom: loadedSourceCard?.id ?? null,
      loadedBaseline: loadedBaseline ? entryFromState(loadedBaseline, 'forge-editor') : null,
    },
  };
}

function flushAutosave(): void {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = 0;
  if (autosaveSuspended || !storage) return;
  const ok = writeAutosave(storage, autosaveSnapshot());
  if (ok !== storageWorking) {
    storageWorking = ok;
    renderStorageNote();
  }
}

function scheduleAutosave(): void {
  if (autosaveSuspended || !storage) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(flushAutosave, 400);
}

window.addEventListener('pagehide', flushAutosave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAutosave(); });
// Another tab saved: take its set (this tab keeps its own card in the editor).
window.addEventListener('storage', (event) => {
  if (autosaveSuspended || event.key !== FORGE_STORAGE_KEY || event.newValue === null || !storage) return;
  const incoming = parseAutosave(event.newValue);
  if (!incoming) return;
  forgeSet = incoming.set;
  if (session.editingId !== null && editingIndex(forgeSet, session) < 0) session = { editingId: null, baseline: null };
  renderSetPanel();
  renderEditorStatus();
});

/** Put back what the last visit left: the set, and the card in the editor. */
function restoreAutosave(): void {
  const read = readAutosave(storage);
  if (!read.available) {
    storageWorking = false;
    return;
  }
  if (!read.save) return;
  forgeSet = read.save.set;
  const editor = read.save.editor;
  if (!editor) return;
  const source = editor.loadedFrom ? loadCardById.get(editor.loadedFrom) ?? null : null;
  const loaded = source && editor.loadedBaseline
    ? { source, baseline: stateFromEntry(editor.loadedBaseline) }
    : null;
  session = { editingId: editor.editingId, baseline: editor.baseline };
  loadedSourceCard = loaded?.source ?? null;
  loadedBaseline = loaded ? loaded.baseline : null;
  loadedFidelityWarnings = loaded ? fidelityNotes(loaded.source, toCardDef(loaded.baseline)) : [];
  store.update(() => stateFromEntry(editor.entry));
}

// ── Share links ─────────────────────────────────────────────────────────────

const shareFallback = byId<HTMLLabelElement>('share-fallback');
const shareFallbackInput = byId<HTMLInputElement>('share-fallback-input');

/** The editor's card as an entry to share (a set card keeps its id). */
function currentShareEntry(): ForgeEntry {
  const state = store.getState();
  return entryFromState(state, session.editingId ?? `forge-${slugify(state.name, 'card')}`);
}

async function copyShareLink(): Promise<void> {
  shareFallback.hidden = true;
  const payload = await encodeSharePayload(currentShareEntry());
  const url = shareUrl(window.location.href, payload);
  if (url.length > MAX_SHARE_URL_LENGTH) {
    showMessage(actionMessage, 'This card is too complex for a link. Export it as JSON instead.', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showMessage(actionMessage, 'Link copied.', false, 5000);
  } catch {
    showMessage(actionMessage, '');
    shareFallbackInput.value = url;
    shareFallback.hidden = false;
    shareFallbackInput.focus();
    shareFallbackInput.select();
  }
}

byId<HTMLButtonElement>('copy-link').addEventListener('click', () => { void copyShareLink(); });

/**
 * Open a shared card: decoded and checked by the same validator as an
 * imported file, then put in the editor as a new unsaved card. A link never
 * changes the set. False when the payload was not a card.
 */
async function openSharedPayload(payload: string): Promise<boolean> {
  const decoded = await decodeSharePayload(payload);
  if (!decoded.ok) {
    showBanner('That link didn\'t contain a card the Forge could open.', true);
    return false;
  }
  if (hasUnsaved() && !confirmAction(DISCARD_CHANGES)) return false;
  openInEditor(stateFromEntry(decoded.entry), { editingId: null, baseline: null }, null);
  showBanner('Opened a shared card. Save it to your set to keep it.');
  return true;
}

async function openSharedFragment(): Promise<void> {
  const payload = payloadFromFragment(window.location.hash);
  if (payload === null) return;
  try {
    await openSharedPayload(payload);
  } finally {
    // The link has done its job; a reload must not open it again.
    history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`);
  }
}

window.addEventListener('hashchange', () => { void openSharedFragment(); });

// ── Save Image ──────────────────────────────────────────────────────────────

const saveImageButton = byId<HTMLButtonElement>('save-image');
const manifestCards = new Set(manifest.cards);

/** True once the card on the canvas has its real art (not the loading stand-in). */
function cardArtReady(scene: CardBuilderScene): boolean {
  const artKey = artKeyFor(store.getState().artDonorId);
  return !manifestCards.has(artKey) || scene.renderedArtTexture === artTextureKey(artKey);
}

async function captureCurrentCard(): Promise<CardImage> {
  const scene = cardScene();
  if (!scene || !cardArtReady(scene)) throw new Error('The card has not finished loading');
  return scene.captureCardImage();
}

saveImageButton.addEventListener('click', () => {
  saveImageButton.disabled = true;
  captureCurrentCard()
    .then((image) => {
      downloadBlob(image.blob, `${slugify(store.getState().name, 'card')}.png`);
      showMessage(actionMessage, '');
    })
    .catch(() => showMessage(actionMessage, 'Couldn\'t save the image. Try again once the card has finished loading.', true))
    .finally(() => { saveImageButton.disabled = false; });
});

// ── Start From a Card ───────────────────────────────────────────────────────

const loadCards = [...ALL_CARDS].sort((left, right) => (
  left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
));
const loadCardById = new Map(loadCards.map((card) => [card.id, card]));
const loadSets = [...new Set(loadCards.map((card) => card.set ?? 'base'))]
  .sort((left, right) => left.localeCompare(right));
let loadSearchValue = '';
let loadSetValue = 'all';
let loadColorValue = 'all';
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
    if (query && !card.name.toLowerCase().includes(query)) return false;
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
  loadResultCount.textContent = cardCount(matches.length);
  loadResults.innerHTML = matches.map((card) => `
    <button type="button" class="load-card-row ${card.id === selectedId ? 'selected' : ''}" data-load-card-id="${escapeHtml(card.id)}">
      <strong>${escapeHtml(card.name)}</strong>
      <span>${escapeHtml(RARITY_LABELS[card.rarity])}</span>
      <small>${escapeHtml(setLabel(card.set ?? 'base'))} / ${escapeHtml(cardColorLabel(card))}</small>
    </button>
  `).join('') || '<p class="empty-editor">No cards match these filters.</p>';
}

function applyLoadedCard(card: ScorableCardDef): void {
  if (hasUnsaved() && !confirmAction(DISCARD_CHANGES)) return;
  const loaded = fromCardDef(card);
  loaded.appearance = { ...store.getState().appearance };
  openInEditor(loaded, { editingId: null, baseline: entryFromState(loaded, '') }, { source: card, baseline: loaded });
}

function renderLoadedCardStatus(state: BuilderState): void {
  if (!loadedSourceCard || !loadedBaseline) {
    loadedCardChip.hidden = true;
    return;
  }
  const modified = !sameEntry(entryFromState(state, ''), entryFromState(loadedBaseline, ''));
  loadedCardChip.hidden = false;
  loadedCardChip.classList.toggle('modified', modified);
  loadedCardLabel.textContent = `${modified ? 'Changed from' : 'Loaded'} ${loadedSourceCard.name}`;
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

// ── Art ─────────────────────────────────────────────────────────────────────

const ART_PAGE_SIZE = 32;
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
    if (query && !`${card.name} ${card.subtypes.join(' ')}`.toLowerCase().includes(query)) return false;
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
    return `<button type="button" class="art-thumb ${card.id === selected ? 'selected' : ''}" data-art-id="${escapeHtml(card.id)}" title="${escapeHtml(card.name)}">
      <img src="${escapeHtml(forgeArtUrl(artKey))}" alt="" loading="lazy" decoding="async" />
      <span>${escapeHtml(card.name)}</span>
    </button>`;
  }).join('') || '<p class="empty-editor">No pictures match these filters.</p>';
  artPageLabel.textContent = `${matches.length} pictures · page ${artPage + 1} of ${pages}`;
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

// ── The card preview, the verdict and the hints ─────────────────────────────

function renderManaPreview(state: BuilderState): void {
  if (state.cardType === 'land') {
    manaPreview.innerHTML = '<span class="no-cost">No printed cost</span>';
    return;
  }
  const card = toCardDef(state);
  manaPreview.innerHTML = costMarkup(card.cost, state.isX, 'small');
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
    ? 'Keywords add their value on creatures.'
    : 'Keywords print on a non-creature but add nothing.';
  for (const checkbox of document.querySelectorAll<HTMLInputElement>('[data-mechanic-toggle]')) {
    const key = checkbox.dataset.mechanicToggle as keyof BuilderMechanics;
    checkbox.checked = state.mechanics[key].enabled;
  }
  const typeSummary = [state.cardType, ...state.additionalTypes].map(titleCase).join(' ');
  byId('card-type-summary').textContent = `${typeSummary} · ${RARITY_LABELS[state.rarity]}`;
}

function verdictSubtitle(state: BuilderState, band: VerdictBand): string {
  const cost = builderHasType(state, 'land') ? 'a costless land' : manaCostLabel(state.cost);
  const rarity = RARITY_LABELS[state.rarity];
  if (band === 'under') return `Does less than ${cost} at ${rarity} should buy.`;
  if (band === 'over') return `Does more than ${cost} at ${rarity} should buy.`;
  return `Fair for ${cost} at ${rarity}.`;
}

const VERDICT_LABELS: Record<VerdictBand, string> = { under: 'Under Value', accurate: 'Accurate Value', over: 'Over Value' };

function renderEvaluation(state: BuilderState): void {
  const evaluation = evaluateBuilder(state);
  const { score, band } = evaluation;
  byId('metric-power').textContent = format(score.power);
  byId('metric-budget').textContent = format(score.budget);
  byId('metric-delta').textContent = signed(score.delta);
  const budgetFormula = byId('budget-formula');
  budgetFormula.textContent = rarityBudgetLabel(state);
  budgetFormula.title = budgetFormula.textContent;
  byId('verdict-label').textContent = VERDICT_LABELS[band];
  byId('verdict-subtitle').textContent = verdictSubtitle(state, band);
  const verdict = byId('verdict-copy');
  verdict.className = `verdict-copy ${band}`;
  const clamped = Math.min(3, Math.max(-3, score.delta));
  byId('gauge-needle').style.left = `${((clamped + 3) / 6) * 100}%`;
  byId('gauge-value').textContent = signed(score.delta);
  byId('warning-chips').innerHTML = [...evaluation.warnings, ...loadedFidelityWarnings].map(warningChipMarkup).join('');
  byId('ledger-count').textContent = `${score.parts.length} ${score.parts.length === 1 ? 'part' : 'parts'}`;
  byId('score-ledger').innerHTML = score.parts.map((part) => {
    const line = translatePart(evaluation.card, part);
    return `<div><span>${escapeHtml(line.text)}${line.estimate ? estimateTag() : ''}</span><strong class="${part.v < 0 ? 'negative' : ''}">${signed(part.v)}</strong></div>`;
  }).join('') || '<p class="empty-editor">No priced parts.</p>';
  byId('ledger-total').textContent = format(score.power);
  renderHints(band, buildHints(state));
}

function renderHints(band: VerdictBand, hints: CostingHint[]): void {
  const list = byId('hint-list');
  if (band === 'accurate') {
    list.innerHTML = '<div class="accurate-note"><strong>Accurate Value</strong><span>The difference is already within 0.75. Nothing to change.</span></div>';
    return;
  }
  list.innerHTML = hints.map((hint, index) => `<article class="hint-row">
    <div><strong>${escapeHtml(hint.title)}</strong><span>${escapeHtml(hint.detail)}</span><small>${escapeHtml(hint.rateSource)}</small></div>
    <div class="hint-result"><span>${signed(hint.movement)} change</span><strong>Difference after: ${signed(hint.resultingDelta)}</strong><button type="button" data-apply-hint="${index}">Apply</button></div>
  </article>`).join('') || '<p class="empty-editor">No single change brings the difference closer to zero.</p>';
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
  renderEditorStatus();
  scheduleAutosave();
});

const qaMode = new URLSearchParams(window.location.search).get('qa') === '1';
/** The ?qa=1 probe's copy of every storage entry, taken before the page writes anything. */
const qaStorageBefore = qaMode ? storageSnapshot() : null;

function storageSnapshot(): Map<string, string> {
  const entries = new Map<string, string>();
  if (!storage) return entries;
  // Read only: the probe lists what is there so it can prove nothing else changed.
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) entries.set(key, storage.getItem(key) ?? '');
  }
  return entries;
}

restoreAutosave();
renderStorageNote();
renderAllEditors();
renderLoadResults();
renderArtGrid();
renderSetPanel();
store.update((state) => state);
if (!qaMode) void openSharedFragment();

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
  // Transparent so Save Image can read the card with clear corners; the
  // camera paints the page's dark background behind the card every frame.
  transparent: true,
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
  /** The set, and the editor's place in it. */
  forgeSet(): ForgeSet;
  session(): EditorSession;
  exportJson(): string;
  /** The card as a PNG, as Save Image makes it (no download). */
  captureImage(): Promise<CardImage>;
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
  forgeSet: () => forgeSet,
  session: () => session,
  exportJson: () => exportSetJson(forgeSet),
  captureImage: captureCurrentCard,
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
  set?: { savedCards: number; editingAfterSave: number; exportedChars: number; importedCards: number; roundTripSame: boolean; scoresSame: boolean };
  share?: { payloadChars: number; urlChars: number; decodedSame: boolean; openedAsNewUnsaved: boolean; setUnchanged: boolean };
  image?: { type: string; width: number; height: number; bytes: number };
  storage?: { keysBefore: number; changedKeys: string[]; forgeKeyWritten: boolean; forgeKeyRestored: boolean };
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

/** The PNG's own size, read from its header (bytes 16-23 of the IHDR chunk). */
async function pngSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  const bytes = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, index) => bytes[index] === byte)) return null;
  const view = new DataView(bytes.buffer);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Everything the probe changes, so it can put the page and the Forge key back. */
interface QaRestorePoint {
  forgeKey: string | null;
  set: ForgeSet;
  session: EditorSession;
  state: BuilderState;
  loaded: LoadedContext | null;
}

function restoreAfterQa(point: QaRestorePoint): boolean {
  autosaveSuspended = true;
  window.clearTimeout(autosaveTimer);
  confirmOverride = null;
  forgeSet = point.set;
  openInEditor(point.state, point.session, point.loaded);
  if (!storage) return true;
  try {
    if (point.forgeKey === null) storage.removeItem(FORGE_STORAGE_KEY);
    else storage.setItem(FORGE_STORAGE_KEY, point.forgeKey);
    return storage.getItem(FORGE_STORAGE_KEY) === point.forgeKey;
  } catch {
    return false;
  }
}

async function runBrowserQa(): Promise<void> {
  const restorePoint: QaRestorePoint = {
    forgeKey: qaStorageBefore?.get(FORGE_STORAGE_KEY) ?? null,
    set: forgeSet,
    session,
    state: cloneBuilderState(store.getState()),
    loaded: loadedSourceCard && loadedBaseline ? { source: loadedSourceCard, baseline: loadedBaseline } : null,
  };
  // Should the tab close mid-probe, the designer's own autosave still comes back.
  const restoreOnHide = (): void => { restoreAfterQa(restorePoint); };
  window.addEventListener('pagehide', restoreOnHide);
  let restored = false;
  try {
    // Start from a fresh card and an empty set, answering every confirmation.
    confirmOverride = () => true;
    forgeSet = emptySet();
    startFreshCard();

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
    if (qaResult.initialDelta === qaResult.deltaAfterManaSlider) throw new Error('Difference did not respond to the mana slider');
    if (qaResult.draggedKeywordPart?.v !== 0.75) throw new Error('Skyborne was not worth +0.75 points in the breakdown');
    if (qaResult.hintPromisedDelta !== qaResult.deltaAfterHint) throw new Error('Applied hint did not land on the difference it promised');

    // Set builder: Save to Set, Save and Start Next, then a second card.
    byId<HTMLButtonElement>('save-to-set').click();
    const editingAfterSave = editingIndex(forgeSet, session);
    cardName.value = 'QA First Card';
    cardName.dispatchEvent(new Event('input', { bubbles: true }));
    byId<HTMLButtonElement>('save-and-next').click();
    if (session.editingId !== null) throw new Error('Save and Start Next did not open a new card');
    cardName.value = 'QA Second Card';
    cardName.dispatchEvent(new Event('input', { bubbles: true }));
    byId<HTMLButtonElement>('save-to-set').click();
    const saved = forgeSet;
    if (editingAfterSave !== 0) throw new Error('Save to Set did not make the card the one being edited');
    if (saved.cards.length !== 2 || saved.cards[0].card.name !== 'QA First Card') throw new Error('The set did not hold the two saved cards');

    // Export, then import the file back over the set.
    const exported = exportSetJson(saved);
    const imported = applyImport(exported);
    if (!imported.ok) throw new Error('The exported set did not import');
    const roundTripSame = forgeSet.cards.length === saved.cards.length
      && forgeSet.cards.every((entry, index) => sameEntry(entry, saved.cards[index]) && entry.card.id === saved.cards[index].card.id);
    const scoresSame = forgeSet.cards.every((entry, index) => (
      JSON.stringify(scoreSummary(entry.card)) === JSON.stringify(scoreSummary(saved.cards[index].card))
    ));
    qaResult.set = {
      savedCards: saved.cards.length, editingAfterSave, exportedChars: exported.length,
      importedCards: forgeSet.cards.length, roundTripSame, scoresSame,
    };
    if (!roundTripSame || !scoresSame) throw new Error('Export then import did not reproduce the set');

    // Share: encode, decode, and open it the way a link does.
    const shared = currentShareEntry();
    const payload = await encodeSharePayload(shared);
    const decoded = await decodeSharePayload(payload);
    const decodedSame = decoded.ok && sameEntry(decoded.entry, shared);
    const setBeforeShare = forgeSet;
    const opened = await openSharedPayload(payload);
    const openedAsNewUnsaved = opened && session.editingId === null && session.baseline === null
      && sameEntry(entryFromState(store.getState(), ''), shared) && hasUnsaved() && !banner.hidden;
    qaResult.share = {
      payloadChars: payload.length,
      urlChars: shareUrl(window.location.href, payload).length,
      decodedSame,
      openedAsNewUnsaved,
      setUnchanged: forgeSet === setBeforeShare,
    };
    if (!decodedSame || !openedAsNewUnsaved || !qaResult.share.setUnchanged) throw new Error('The share link did not round-trip the card');
    banner.hidden = true;

    // Save Image, without the download.
    const image = await captureCurrentCard();
    const size = await pngSize(image.blob);
    qaResult.image = { type: image.blob.type, width: size?.width ?? 0, height: size?.height ?? 0, bytes: image.blob.size };
    if (image.blob.type !== 'image/png' || !size || size.height < 700) throw new Error('Save Image did not make a PNG at least 700 px tall');

    // Storage: only the Forge's own key may have changed.
    flushAutosave();
    const after = storageSnapshot();
    const before = qaStorageBefore ?? new Map<string, string>();
    const keys = new Set([...before.keys(), ...after.keys()]);
    const changedKeys = [...keys].filter((key) => before.get(key) !== after.get(key));
    const forgeKeyWritten = storage !== null && after.has(FORGE_STORAGE_KEY);
    restored = true;
    const forgeKeyRestored = restoreAfterQa(restorePoint);
    qaResult.storage = { keysBefore: before.size, changedKeys, forgeKeyWritten, forgeKeyRestored };
    if (changedKeys.some((key) => key !== FORGE_STORAGE_KEY)) throw new Error('A storage key other than the Forge\'s own changed');
    if (storage && !forgeKeyWritten) throw new Error('The autosave never wrote the Forge key');
    if (!forgeKeyRestored) throw new Error('The Forge key was not restored');

    if (qaConsoleIssues.length > 0) throw new Error(`Console reported ${qaConsoleIssues.length} issue(s)`);
    qaResult.status = 'pass';
  } catch (error) {
    qaResult.status = 'fail';
    qaResult.failure = error instanceof Error ? error.message : String(error);
  } finally {
    if (!restored) restoreAfterQa(restorePoint);
    window.removeEventListener('pagehide', restoreOnHide);
  }
  publishQaResult();
}

if (qaMode) void runBrowserQa();
