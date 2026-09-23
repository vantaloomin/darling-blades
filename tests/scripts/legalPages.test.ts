import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  BACK_TO_GAME,
  LEGAL_DOCUMENTS,
  PLACEHOLDERS,
  PUBLISHED_BASE,
  documentToHtml,
  footerNavLinks,
  renderAllPages,
  renderPage,
  resolveHref,
} from '../../scripts/gen-legal-pages';
import { NOTICES_FILE } from '../../scripts/gen-third-party-notices';
import { markOpenedByGame } from '../../src/ui/openExternalPage';

/**
 * The three legal pages are generated from the three owner-ruled documents at
 * every dev and build, so what is tested here is the CONTRACT between the
 * documents and the pages: nothing unfilled reaches a reader, every link
 * between the documents lands on a page this same build writes, and a
 * construct the converter cannot render fails the build instead of printing as
 * literal text. The generated HTML itself is never pinned; a wording or
 * styling change is the owner's to make, not a test's to block.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourceOf = (name: string): string => readFileSync(join(root, 'docs', 'legal', name), 'utf8');

/** An `[ALL CAPS]` token that is not a markdown link's text: an unfilled slot. */
const UNFILLED = /\[[A-Z][A-Z0-9 ._/-]*\](?!\()/;

const PAGES = renderAllPages(sourceOf);
const BUILT = new Set(PAGES.keys());
/** Everything a page may point at inside the build, beside the pages themselves. */
const SIBLING_FILES = new Set([NOTICES_FILE]);

function hrefsIn(html: string): string[] {
  return [...html.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]);
}

describe('the legal pages', () => {
  it('builds one page per document, and only those', () => {
    expect([...BUILT].sort()).toEqual(LEGAL_DOCUMENTS.map((doc) => doc.output).sort());
  });

  it.each(LEGAL_DOCUMENTS.map((doc) => [doc.source, doc] as const))(
    'renders %s with every placeholder filled',
    (_name, doc) => {
      const markdown = sourceOf(doc.source);
      // The document itself still carries its tokens; the page must not.
      const html = renderPage(markdown, doc);
      expect(html).not.toMatch(UNFILLED);
      for (const token of Object.keys(PLACEHOLDERS)) expect(html).not.toContain(token);
    },
  );

  it.each(LEGAL_DOCUMENTS.map((doc) => [doc.source, doc] as const))(
    'titles the %s page with the document\'s own H1',
    (_name, doc) => {
      const markdown = sourceOf(doc.source);
      const h1 = markdown.split('\n').find((line) => line.startsWith('# '))?.slice(2).trim();
      expect(h1).toBeTruthy();
      expect(documentToHtml(markdown, doc.source).title).toBe(h1);
      expect(renderPage(markdown, doc)).toContain(`<title>${h1}</title>`);
    },
  );

  it('points every internal link at something this build writes', () => {
    for (const [name, html] of PAGES) {
      for (const href of hrefsIn(html)) {
        if (href.startsWith('http')) continue;
        if (href === BACK_TO_GAME.href) continue;
        const target = href.replace(/^\.\//, '');
        expect(BUILT.has(target) || SIBLING_FILES.has(target), `${name} links ${href}`).toBe(true);
      }
    }
  });

  it('never leaves a link pointing at a markdown file or off the site', () => {
    for (const [name, html] of PAGES) {
      for (const href of hrefsIn(html)) {
        expect(href.endsWith('.md'), `${name} links ${href}`).toBe(false);
        expect(href.startsWith(PUBLISHED_BASE), `${name} links ${href}`).toBe(false);
      }
    }
  });

  it('resolves a sibling named as a file, as a page, or as the published URL', () => {
    expect(resolveHref('notices.md')).toBe('./notices.html');
    expect(resolveHref('./privacy-policy.md')).toBe('./privacy.html');
    expect(resolveHref(PLACEHOLDERS['[PRIVACY URL]'])).toBe('./privacy.html');
    expect(resolveHref(`${PUBLISHED_BASE}terms.html`)).toBe('./terms.html');
  });

  it('leaves an external link and the notices file exactly as written', () => {
    expect(resolveHref('https://www.cloudflare.com/privacypolicy/')).toBe(
      'https://www.cloudflare.com/privacypolicy/',
    );
    expect(resolveHref(NOTICES_FILE)).toBe(NOTICES_FILE);
  });

  it('gives every page a footer nav to the other two and back to the game', () => {
    for (const doc of LEGAL_DOCUMENTS) {
      const links = footerNavLinks(doc);
      expect(links.map((link) => link.href)).toEqual([
        ...LEGAL_DOCUMENTS.filter((other) => other !== doc).map((other) => `./${other.output}`),
        BACK_TO_GAME.href,
      ]);
      const html = PAGES.get(doc.output) ?? '';
      for (const link of links) expect(html).toContain(`href="${link.href}"`);
      // A page never offers itself.
      expect(hrefsIn(html)).not.toContain(`./${doc.output}`);
    }
  });

  it('refuses a placeholder it does not know rather than printing it', () => {
    expect(() => documentToHtml('# T\n\nEffective [SOME NEW TOKEN].\n', 'fake.md')).toThrow(
      /unfilled placeholder \[SOME NEW TOKEN\]/,
    );
  });

  it('refuses markdown it cannot render rather than printing it literally', () => {
    for (const unsupported of ['1. first', '> quoted', '| a | b |', '```ts']) {
      expect(() => documentToHtml(`# T\n\n${unsupported}\n`, 'fake.md'), unsupported).toThrow(
        /unsupported markdown/,
      );
    }
  });

  it('refuses a document with no H1, which would leave the page untitled', () => {
    expect(() => documentToHtml('## Only a subheading\n', 'fake.md')).toThrow(/no H1/);
  });

  it('escapes markup in the source instead of emitting it', () => {
    const html = documentToHtml('# T\n\nA <script> tag & an "attribute".\n', 'fake.md').body;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });
});

/** The one inline script a page carries, exactly as the browser hashes it. */
function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map((m) => {
    expect(m[1], 'a page loads no script from a file').toBe('');
    return m[2];
  });
}

describe("each page's policy", () => {
  it.each([...PAGES.keys()])('%s admits its own inline script by hash and nothing else', (name) => {
    const html = PAGES.get(name) ?? '';
    const scripts = inlineScripts(html);
    expect(scripts).toHaveLength(1);
    const policy = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? '';
    const scriptSrc = policy.split(';').map((part) => part.trim()).find((part) => part.startsWith('script-src'));
    const digest = createHash('sha256').update(scripts[0], 'utf8').digest('base64');
    expect(scriptSrc).toBe(`script-src 'sha256-${digest}'`);
    expect(policy).toContain("default-src 'none'");
  });
});

describe('"Back to the game" on a page the game opened', () => {
  interface FakeLink {
    href: string;
    back: boolean;
    listeners: ((event: { preventDefault: () => void }) => void)[];
  }

  /**
   * Run a page's real script against the page's real links, in a stand-in DOM
   * holding only what the script touches. `search` is the address's query.
   */
  function openPage(name: string, search: string) {
    const html = PAGES.get(name) ?? '';
    const links: FakeLink[] = [...html.matchAll(/<a href="([^"]*)"( data-back-to-game)?/g)].map((m) => ({
      href: m[1],
      back: m[2] !== undefined,
      listeners: [],
    }));
    const notes = [...html.matchAll(/<span data-back-note hidden>/g)].map(() => ({ hidden: true }));
    const elements = links.map((link) => ({
      getAttribute: (attr: string) => (attr === 'href' ? link.href : null),
      setAttribute: (attr: string, value: string) => {
        if (attr === 'href') link.href = value;
      },
      hasAttribute: (attr: string) => attr === 'data-back-to-game' && link.back,
      addEventListener: (type: string, fn: FakeLink['listeners'][number]) => {
        if (type === 'click') link.listeners.push(fn);
      },
    }));
    const document = {
      querySelectorAll: (selector: string) =>
        selector === 'a[href]' ? elements : selector === '[data-back-note]' ? notes : [],
    };
    const win = { close: vi.fn() };
    const timers: (() => void)[] = [];
    const run = new Function('location', 'document', 'window', 'setTimeout', 'URLSearchParams', inlineScripts(html)[0]);
    run({ search }, document, win, (fn: () => void) => timers.push(fn), URLSearchParams);
    const clickBack = (): { prevented: boolean } => {
      let prevented = false;
      for (const fn of links.find((link) => link.back)?.listeners ?? []) fn({ preventDefault: () => (prevented = true) });
      return { prevented };
    };
    return { links, notes, win, timers, clickBack };
  }

  const markedQuery = (href: string): string => markOpenedByGame(href).slice(href.length);

  it.each([...PAGES.keys()])('%s: closes its tab instead of loading a second game', (name) => {
    const page = openPage(name, markedQuery(`./${name}`));
    expect(page.links.filter((link) => link.back).length).toBeGreaterThan(0);
    for (const link of page.links.filter((l) => l.back)) expect(link.listeners.length).toBe(1);
    expect(page.clickBack().prevented).toBe(true);
    expect(page.win.close).toHaveBeenCalledTimes(1);
  });

  it('says what to do when the browser keeps the tab open', () => {
    const page = openPage('privacy.html', markedQuery('./privacy.html'));
    page.clickBack();
    expect(page.notes.length).toBeGreaterThan(0);
    expect(page.notes.every((note) => note.hidden)).toBe(true);
    // Still here once the close has had its chance: the notes show.
    for (const timer of page.timers) timer();
    expect(page.notes.every((note) => !note.hidden)).toBe(true);
  });

  it('carries the marker to the sibling pages, and leaves every other link alone', () => {
    const before = openPage('notices.html', '').links.map((link) => link.href);
    const after = openPage('notices.html', markedQuery('./notices.html')).links.map((link) => link.href);
    after.forEach((href, i) => {
      const was = before[i];
      if (BUILT.has(was.replace(/^\.\//, ''))) expect(href).toBe(markOpenedByGame(was));
      else expect(href).toBe(was);
    });
  });

  it('is an ordinary link when the page was not opened by the game', () => {
    for (const name of PAGES.keys()) {
      const page = openPage(name, '');
      expect(page.links.every((link) => link.listeners.length === 0)).toBe(true);
      expect(page.clickBack().prevented).toBe(false);
      expect(page.win.close).not.toHaveBeenCalled();
    }
  });
});
