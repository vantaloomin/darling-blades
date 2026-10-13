import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderAllPages } from '../../scripts/gen-legal-pages';
import { parseLegalPage } from '../../src/ui/legalReaderText';

describe('the in-game legal reader (M26)', () => {
  it('reads every page the generator writes, its headings in order and no markup left', () => {
    for (const [name, html] of renderAllPages()) {
      const page = parseLegalPage(html);
      expect(page.title, name).not.toBe('');
      expect(page.blocks.length, name).toBeGreaterThan(3);
      for (const block of page.blocks) expect(block.text, name).not.toMatch(/<|&(amp|lt|gt|quot);/);
      const h2s = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].length;
      expect(page.blocks.filter((b) => b.kind === 'h2').length, name).toBe(h2s);
    }
  });

  it('lifts the effective date into the header and keeps the lead-in lines emphasised', () => {
    const privacy = parseLegalPage(readFileSync('public/privacy.html', 'utf8'));
    expect(privacy.effective).toMatch(/^Effective date: \w+ \d+, \d{4}$/);
    expect(privacy.blocks[0].kind).toBe('p');
    expect(privacy.blocks.some((b) => b.emphasis && b.text.startsWith('After each finished duel'))).toBe(true);
  });

  it('refuses a page it was not built to read', () => {
    expect(() => parseLegalPage('<html><body>hi</body></html>')).toThrow();
    expect(() => parseLegalPage('<nav></nav>\n<table></table>\n<nav class="pages"></nav>')).toThrow();
  });
});
