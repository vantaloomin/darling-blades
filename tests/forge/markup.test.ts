import { describe, expect, it } from 'vitest';
import { setRowMarkup, warningChipMarkup } from '../../src/forge/markup';

const HOSTILE = '"><img src=x onerror=alert(1)><script>alert(\'x\')</script>&';

/** Every tag the markup opens. */
const tags = (html: string): string[] => [...html.matchAll(/<([a-zA-Z][\w-]*)/g)].map((match) => match[1].toLowerCase());

/** Every attribute value, as written between its double quotes. */
const attributeValues = (html: string): string[] => [...html.matchAll(/\s[\w-]+="([^"]*)"/g)].map((match) => match[1]);

describe('set row markup', () => {
  // The Forge shares the game's origin: a card or set name from an imported
  // file or a share link must never become markup, in text or in attributes.
  it('escapes a hostile card name and type line everywhere it appears', () => {
    const html = setRowMarkup({
      id: HOSTILE,
      name: HOSTILE,
      typeLine: HOSTILE,
      costHtml: '<span class="generic-pip">2</span>',
      band: 'over',
      delta: 1.2,
      editing: true,
    });
    expect(new Set(tags(html))).toEqual(new Set(['li', 'button', 'span', 'strong', 'small']));
    // No attribute value can close its quotes or open a tag.
    for (const value of attributeValues(html)) expect(value).not.toMatch(/[<>"]/);
    // The name still reads as the name: escaped, not dropped.
    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toMatch(/aria-label="[^"]*&quot;&gt;&lt;img/);
  });

  it('escapes the text of a warning chip', () => {
    const html = warningChipMarkup({ id: 'fidelity', kind: 'note', text: HOSTILE });
    expect(new Set(tags(html))).toEqual(new Set(['span']));
    expect(html).not.toContain('<img');
  });
});
