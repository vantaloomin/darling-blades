/**
 * The Art section's Your Image side: the Game Art / Your Image switch, choosing
 * or dropping an image, the framing controls, and Choose Another / Remove
 * Image. The framing math is in framing.ts; the image handling in
 * imageLibrary.ts. The card itself is redrawn by the scene from the store.
 *
 * Browser-side (the DOM); no Phaser.
 */
import {
  ZOOM_SLIDER_STEPS,
  clampFraming,
  defaultFraming,
  fillFrame,
  fitWholeImage,
  leavesFrameEmpty,
  panRoom,
  resetFraming,
  sliderToZoom,
  zoomToSlider,
  type ArtFraming,
} from './framing';
import type { ForgeImageLibrary } from './imageLibrary';
import { cloneBuilderState, type BuilderState } from './logic';
import { artFrameOf as frameOf } from './setModel';
import type { BuilderStore } from './store';

export const CUSTOM_ART_COPY = {
  unreadable: 'That file isn\'t an image the Forge can read.',
  tooLarge: 'That image is too large (the limit is 20 MB).',
  notStored: 'This browser couldn\'t store the image. It stays until you close the tab; export your set to keep it.',
  missing: 'This card\'s image is no longer in this browser, so the card shows game art.',
  removeConfirm: 'Remove your image from this card?',
} as const;

/** The keyword drag's own type: a keyword dropped on the card is never an image. */
const KEYWORD_DRAG_TYPE = 'application/x-darlingblades-keyword';

export interface CustomArtPanelOptions {
  store: BuilderStore;
  images: ForgeImageLibrary;
  confirmAction(message: string): boolean;
}

export interface CustomArtPanel {
  /** Put a chosen or dropped file on the card in the editor. */
  applyFile(file: Blob): Promise<boolean>;
}

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Forge control is missing: #${id}`);
  return found as T;
}

export function initCustomArtPanel({ store, images, confirmAction }: CustomArtPanelOptions): CustomArtPanel {
  const sourceInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="art-source"]')];
  const randomArt = element<HTMLButtonElement>('random-art');
  const gamePanel = element<HTMLDivElement>('game-art-panel');
  const panel = element<HTMLDivElement>('custom-art-panel');
  const dropZone = element<HTMLDivElement>('custom-art-drop');
  const controls = element<HTMLDivElement>('custom-art-controls');
  const fileInput = element<HTMLInputElement>('custom-art-file');
  const message = element<HTMLParagraphElement>('custom-art-message');
  const zoom = element<HTMLInputElement>('custom-art-zoom');
  const zoomValue = element<HTMLOutputElement>('custom-art-zoom-value');
  const panX = element<HTMLInputElement>('custom-art-x');
  const panXValue = element<HTMLOutputElement>('custom-art-x-value');
  const panY = element<HTMLInputElement>('custom-art-y');
  const panYValue = element<HTMLOutputElement>('custom-art-y-value');
  const rotation = element<HTMLInputElement>('custom-art-rotation');
  const rotationValue = element<HTMLOutputElement>('custom-art-rotation-value');
  const flip = element<HTMLButtonElement>('custom-art-flip');
  const backgroundField = element<HTMLLabelElement>('custom-art-background-field');
  const background = element<HTMLInputElement>('custom-art-background');
  const canvasShell = element<HTMLDivElement>('canvas-shell');
  zoom.max = String(ZOOM_SLIDER_STEPS);

  let messageIsProblem = false;
  function showMessage(text: string, problem = false): void {
    message.textContent = text;
    messageIsProblem = problem && text !== '';
    message.classList.toggle('problem', messageIsProblem);
  }

  function update(mutator: (next: BuilderState) => void): void {
    store.update((state) => {
      const next = cloneBuilderState(state);
      mutator(next);
      return next;
    });
  }

  /** Change the framing of the image on the card, clamped to the picture's own ranges. */
  function reframe(change: (framing: ArtFraming, image: { width: number; height: number }) => ArtFraming): void {
    const custom = store.getState().customArt;
    const info = custom ? images.imageInfo(custom.image) : null;
    if (!custom || !info) return;
    const framing = clampFraming(info, change(custom, info));
    update((next) => {
      if (next.customArt?.image === custom.image) next.customArt = { ...framing, image: custom.image };
    });
  }

  async function applyFile(file: Blob): Promise<boolean> {
    panel.setAttribute('aria-busy', 'true');
    try {
      const result = await images.addFile(file);
      if (!result.ok) {
        showMessage(result.problem === 'too-large' ? CUSTOM_ART_COPY.tooLarge : CUSTOM_ART_COPY.unreadable, true);
        return false;
      }
      update((next) => {
        next.artSource = 'custom';
        next.customArt = { ...defaultFraming(), image: result.id };
      });
      images.release(result.id);
      showMessage(result.persistent ? '' : CUSTOM_ART_COPY.notStored, !result.persistent);
      return true;
    } finally {
      panel.removeAttribute('aria-busy');
    }
  }

  const chooseFile = (): void => fileInput.click();
  element<HTMLButtonElement>('custom-art-choose').addEventListener('click', chooseFile);
  element<HTMLButtonElement>('custom-art-replace').addEventListener('click', chooseFile);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void applyFile(file);
  });

  for (const input of sourceInputs) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      showMessage('');
      update((next) => { next.artSource = input.value === 'custom' ? 'custom' : 'game'; });
    });
  }

  // Dropping an image file: on the drop zone, anywhere in the panel, or on the card.
  const carriesFiles = (event: DragEvent): boolean => {
    const types = event.dataTransfer?.types ?? [];
    return types.includes('Files') && !types.includes(KEYWORD_DRAG_TYPE);
  };
  const acceptDrop = (target: HTMLElement, activeClass: string): void => {
    target.addEventListener('dragover', (event) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      target.classList.add(activeClass);
    });
    target.addEventListener('dragleave', (event) => {
      if (!target.contains(event.relatedTarget as Node | null)) target.classList.remove(activeClass);
    });
    target.addEventListener('drop', (event) => {
      target.classList.remove(activeClass);
      if (!carriesFiles(event)) return;
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file) void applyFile(file);
    });
  };
  acceptDrop(panel, 'file-over');
  acceptDrop(canvasShell, 'file-over');
  // A file dropped anywhere else is ignored, rather than the browser leaving the page to open it.
  document.addEventListener('dragover', (event) => {
    if (event.defaultPrevented || !carriesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  });
  document.addEventListener('drop', (event) => {
    if (!event.defaultPrevented && carriesFiles(event)) event.preventDefault();
  });

  zoom.addEventListener('input', () => reframe((framing, image) => ({ ...framing, zoom: sliderToZoom(image, Number(zoom.value)) })));
  panX.addEventListener('input', () => reframe((framing) => ({ ...framing, x: Number(panX.value) / 100 })));
  panY.addEventListener('input', () => reframe((framing) => ({ ...framing, y: Number(panY.value) / 100 })));
  rotation.addEventListener('input', () => reframe((framing) => ({ ...framing, rotation: Number(rotation.value) })));
  flip.addEventListener('click', () => reframe((framing) => ({ ...framing, flip: !framing.flip })));
  background.addEventListener('input', () => reframe((framing) => ({ ...framing, background: background.value.toLowerCase() })));
  element<HTMLButtonElement>('custom-art-fit').addEventListener('click', () => (
    reframe((framing, image) => fitWholeImage(image, framing, frameOf(store.getState())))
  ));
  element<HTMLButtonElement>('custom-art-fill').addEventListener('click', () => (
    reframe((framing, image) => fillFrame(image, framing, frameOf(store.getState())))
  ));
  element<HTMLButtonElement>('custom-art-reset').addEventListener('click', () => reframe((_framing, image) => resetFraming(image)));
  element<HTMLButtonElement>('custom-art-remove').addEventListener('click', () => {
    if (!store.getState().customArt || !confirmAction(CUSTOM_ART_COPY.removeConfirm)) return;
    showMessage('');
    update((next) => { next.customArt = null; });
  });

  // Slider positions round-trip exactly (position to framing and back), so
  // setting them while the player drags one changes nothing under the pointer.
  const setValue = (input: HTMLInputElement, value: string): void => {
    if (input.value !== value) input.value = value;
  };

  function render(): void {
    const state = store.getState();
    const custom = state.artSource === 'custom';
    for (const input of sourceInputs) input.checked = input.value === state.artSource;
    gamePanel.hidden = custom;
    randomArt.hidden = custom;
    panel.hidden = !custom;
    const art = state.customArt;
    dropZone.hidden = art !== null;
    controls.hidden = art === null;
    if (!art) {
      if (!messageIsProblem) showMessage('');
      return;
    }
    const status = images.status(art.image);
    if (status === 'missing') showMessage(CUSTOM_ART_COPY.missing, true);
    else if (message.textContent === CUSTOM_ART_COPY.missing) showMessage('');
    const info = images.imageInfo(art.image);
    for (const input of [zoom, panX, panY, rotation]) input.disabled = !info;
    flip.disabled = !info;
    flip.setAttribute('aria-pressed', String(art.flip));
    rotationValue.value = `${Math.round(art.rotation)}°`;
    setValue(rotation, String(Math.round(art.rotation)));
    zoomValue.value = `${art.zoom.toFixed(2)}×`;
    panXValue.value = String(Math.round(art.x * 100));
    panYValue.value = String(Math.round(art.y * 100));
    setValue(panX, String(Math.round(art.x * 100)));
    setValue(panY, String(Math.round(art.y * 100)));
    if (background.value !== art.background) background.value = art.background;
    if (!info) {
      backgroundField.hidden = true;
      return;
    }
    const frame = frameOf(state);
    setValue(zoom, String(zoomToSlider(info, art.zoom)));
    zoom.setAttribute('aria-valuetext', `${art.zoom.toFixed(2)}×`);
    const room = panRoom(info, art, frame);
    // An axis the picture can't move along (it spans the window exactly) is switched off.
    panX.disabled = room.x < 0.5;
    panY.disabled = room.y < 0.5;
    backgroundField.hidden = !(info.hasAlpha || leavesFrameEmpty(info, art, frame));
  }

  store.subscribe(render);
  images.onChange(render);
  render();
  return { applyFile };
}
