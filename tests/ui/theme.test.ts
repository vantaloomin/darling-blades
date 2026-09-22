import { describe, expect, it } from 'vitest';
import { colorInt, theme } from '../../src/ui/theme';

describe('theme tokens', () => {
  it('parses a hex colour into its Graphics integer', () => {
    expect(colorInt('#ffd88a')).toBe(0xffd88a);
  });

  it('keeps the design frame, control heights, and depth ordering coherent', () => {
    expect(theme.design.centerX * 2).toBe(theme.design.width);
    expect(theme.design.centerY * 2).toBe(theme.design.height);
    expect(theme.control.heightSm).toBeLessThanOrEqual(theme.control.minHitHeight);
    expect(theme.control.heightMd).toBeLessThanOrEqual(theme.control.minHitHeight);
    expect(theme.depth.floats).toBeLessThan(theme.depth.popover);
    expect(theme.depth.popover).toBeLessThan(theme.depth.overlay);
    expect(theme.depth.overlay).toBeLessThan(theme.depth.modal);
    expect(theme.depth.modal).toBeLessThan(theme.depth.inspect);
    expect(theme.depth.inspect).toBeLessThan(theme.depth.results);
  });
});
