import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORGE_THEME_VARS } from '../../src/forge/gameTheme';

describe('Forge theme', () => {
  it("keeps style.css's fallbacks equal to the game theme it loads", () => {
    const css = readFileSync(new URL('../../src/forge/style.css', import.meta.url), 'utf8');
    const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    for (const [name, value] of Object.entries(FORGE_THEME_VARS)) {
      const declared = new RegExp(`${name}:\\s*([^;]+);`).exec(root)?.[1].trim();
      expect(declared, name).toBe(value);
    }
  });
});
