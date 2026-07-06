import Phaser from 'phaser';

/**
 * The one reusable text-search `<input>` overlay — the codebase's only
 * `this.add.dom` consumer (requires `dom: { createContainer: true }` in the
 * Phaser config). Mounts a styled HTML input at design-space (x, y) and calls
 * `onChange` with the live value as the player types. Phaser positions the DOM
 * node in scene space and destroys it on scene shutdown, so no manual cleanup is
 * needed. Used by both the Collection binder and the Deck Builder pool.
 */
export function createSearchInput(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { width?: number; placeholder?: string; onChange: (value: string) => void },
): Phaser.GameObjects.DOMElement {
  const width = opts.width ?? 220;
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = opts.placeholder ?? 'Search cards…';
  input.setAttribute(
    'style',
    [
      `width:${width}px`,
      'box-sizing:border-box',
      'padding:6px 10px',
      'font:14px Inter, Arial, sans-serif',
      'color:#e8def7',
      'background:#241d3a',
      'border:1px solid #3a3355',
      'border-radius:6px',
      'outline:none',
    ].join(';'),
  );
  input.addEventListener('input', () => opts.onChange(input.value));
  return scene.add.dom(x, y, input).setOrigin(0.5).setDepth(50);
}
