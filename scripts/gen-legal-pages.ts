/**
 * Builds the three legal pages in `public/` from the three sources in
 * `docs/legal/`, with one renderer, one placeholder map and one link resolver.
 *
 * | source                         | page                  |
 * | ------------------------------ | --------------------- |
 * | `docs/legal/privacy-policy.md` | `public/privacy.html` |
 * | `docs/legal/terms-of-service.md` | `public/terms.html` |
 * | `docs/legal/notices.md`        | `public/notices.html` |
 *
 * One source, many surfaces: the pages on the Pages site (and inside the
 * desktop bundle, where they work offline), the README section that links
 * them, the Legal panel in Settings, and the in-game "What is sent" panel that
 * lists the same fields. Every page is generated at build time, never
 * hand-edited, so none of them can drift from the document it states.
 *
 * The converter covers exactly the markdown these documents use (headings,
 * paragraphs, bullet lists, bold, italic, inline code, links) and refuses
 * anything else, so a new construct fails the build instead of rendering as
 * literal text. It also refuses an unfilled `[PLACEHOLDER]` it does not know:
 * the effective date is filled at the 1.8 cut (release-cut checklist), and the
 * pages carry a stand-in until then.
 *
 * Links BETWEEN the documents are rewritten to the sibling page, so
 * `[notices](notices.md)` and the absolute `[PRIVACY URL]` both land on a page
 * that this run also built. That is what keeps the set navigable offline.
 *
 * Each page carries one small script, the only one its policy admits (by
 * hash): when the GAME opened the page, "Back to the game" closes the tab
 * instead of starting a second copy of the game in it. See
 * `OPENED_BY_GAME_SCRIPT`.
 *
 * Usage:
 *   npx tsx scripts/gen-legal-pages.ts          write all three pages
 *   npx tsx scripts/gen-legal-pages.ts --check  exit 1 if any page is stale
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENED_BY_GAME } from '../src/ui/openExternalPage';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(root, 'docs', 'legal');
const OUTPUT_DIR = join(root, 'public');

export interface LegalDocument {
  /** File name inside `docs/legal/`. */
  source: string;
  /** File name written inside `public/`. */
  output: string;
  /** Short label this page carries in the other pages' footer nav. */
  nav: string;
}

/** The three documents that ship as pages, in the order the footer nav lists them. */
export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [
  { source: 'privacy-policy.md', output: 'privacy.html', nav: 'Privacy policy' },
  { source: 'terms-of-service.md', output: 'terms.html', nav: 'Terms of service' },
  { source: 'notices.md', output: 'notices.html', nav: 'Notices' },
] as const;

/** Where the pages are published. The in-game links stay relative; prose does not. */
export const PUBLISHED_BASE = 'https://vantaloomin.github.io/darling-blades/';

/** The tokens the drafts carry and what the pages show for each until the cut fills them. */
export const PLACEHOLDERS: Record<string, string> = {
  '[1.8 RELEASE DATE]': 'the day version 1.8 is released',
  '[PRIVACY URL]': `${PUBLISHED_BASE}privacy.html`,
};

/** The link back to the game, on every page. Relative, so the desktop bundle resolves it. */
export const BACK_TO_GAME = { label: 'Back to the game', href: './' } as const;

/** Shown beside "Back to the game" when the browser will not let the page close its own tab. */
export const BACK_TO_GAME_NOTE = 'The game is still open in the tab you came from. Close this tab to return to it.';

/**
 * The pages' one script, for a page the GAME opened (src/ui/openExternalPage.ts
 * adds `OPENED_BY_GAME` to the address on the web). Such a tab sits beside a
 * running game, so following "Back to the game" to `./` would start a second
 * copy of the game in it. Instead the link closes the tab, which returns the
 * player to the game's own; where the browser refuses to let a page close its
 * tab, the note beside the link says what to do. Links to the sibling pages
 * carry the marker along, so the promise holds after reading on.
 *
 * Opened any other way (from the README, a bookmark, the desktop app) the
 * script does nothing and "Back to the game" is an ordinary link. The desktop
 * shell handles that link itself by closing the page's window.
 *
 * Plain ES5 over the DOM, no dependencies. Its hash is the page policy's only
 * script source, so nothing else can run on the page.
 */
export const OPENED_BY_GAME_SCRIPT = `(function () {
  var name = ${JSON.stringify(OPENED_BY_GAME.name)}, value = ${JSON.stringify(OPENED_BY_GAME.value)};
  if (new URLSearchParams(location.search).get(name) !== value) return;
  var links = document.querySelectorAll("a[href]");
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute("href");
    if (links[i].hasAttribute("data-back-to-game")) links[i].addEventListener("click", back);
    else if (/^\\.\\/[\\w-]+\\.html$/.test(href)) links[i].setAttribute("href", href + "?" + name + "=" + value);
  }
  function back(event) {
    event.preventDefault();
    window.close();
    setTimeout(function () {
      var notes = document.querySelectorAll("[data-back-note]");
      for (var j = 0; j < notes.length; j++) notes[j].hidden = false;
    }, 300);
  }
})();`;

/** The policy source that admits exactly `OPENED_BY_GAME_SCRIPT`. */
export function scriptHashSource(script: string): string {
  return `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`;
}

const OUTPUTS = new Set(LEGAL_DOCUMENTS.map((doc) => doc.output));
const SIBLING_BY_SOURCE = new Map(LEGAL_DOCUMENTS.map((doc) => [doc.source, `./${doc.output}`]));

/**
 * Point a link at the page this run builds, wherever the markdown aimed it.
 *
 * A document can name a sibling three ways: as the markdown file it is written
 * beside (`notices.md`), as the absolute published URL (what `[PRIVACY URL]`
 * fills to), or as the page itself. All three become the relative sibling page,
 * because a reader offline in the desktop bundle has no network and a reader on
 * the Pages site is already in the right directory. Anything else, including
 * every external link and the generated notices file, is left exactly as the
 * document wrote it.
 */
export function resolveHref(href: string): string {
  const local = href.startsWith(PUBLISHED_BASE)
    ? href.slice(PUBLISHED_BASE.length)
    : href.replace(/^\.\//, '');
  const sibling = SIBLING_BY_SOURCE.get(local);
  if (sibling) return sibling;
  if (OUTPUTS.has(local)) return `./${local}`;
  return href;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Inline markdown: code, bold, italic, links. Escapes everything else. */
function inline(text: string): string {
  const parts: string[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    parts.push(escapeHtml(text.slice(last, m.index)));
    if (m[1] !== undefined) parts.push(`<code>${escapeHtml(m[1])}</code>`);
    else if (m[2] !== undefined) parts.push(`<strong>${escapeHtml(m[2])}</strong>`);
    else if (m[3] !== undefined) parts.push(`<em>${escapeHtml(m[3])}</em>`);
    else parts.push(`<a href="${escapeHtml(resolveHref(m[5]))}" rel="noopener">${escapeHtml(m[4])}</a>`);
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(escapeHtml(text.slice(last)));
  return parts.join('');
}

/**
 * An `[ALL CAPS]` token that is NOT a markdown link's text, which is what an
 * unfilled placeholder looks like once every known one has been substituted.
 * `[THIRD_PARTY_NOTICES.txt](...)` is a link, so it is not one.
 */
const UNFILLED_PLACEHOLDER = /\[[A-Z][A-Z0-9 ._/-]*\](?!\()/;

export function documentToHtml(markdown: string, sourceName: string): { body: string; title: string } {
  let text = markdown.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  for (const [token, value] of Object.entries(PLACEHOLDERS)) text = text.split(token).join(value);
  const left = text.match(UNFILLED_PLACEHOLDER);
  if (left) throw new Error(`gen-legal-pages: unfilled placeholder ${left[0]} in ${sourceName}`);

  const lines = text.split('\n');
  const out: string[] = [];
  let title: string | null = null;
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = (): void => {
    if (paragraph.length > 0) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = (): void => {
    if (list.length > 0) out.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,3}) (.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      if (level === 1 && title === null) title = heading[2];
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^- (.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    if (list.length > 0 && /^\s{2,}\S/.test(line)) {
      list[list.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^(>|```|\||\d+\. |#)/.test(line.trim())) {
      throw new Error(`gen-legal-pages: unsupported markdown in ${sourceName}: ${line.trim().slice(0, 40)}`);
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (title === null) throw new Error(`gen-legal-pages: ${sourceName} has no H1 to title its page with`);
  return { body: out.join('\n'), title };
}

/** The footer nav: the other two documents, then the way back to the game. */
export function footerNavLinks(doc: LegalDocument): readonly { label: string; href: string }[] {
  return [
    ...LEGAL_DOCUMENTS.filter((other) => other.output !== doc.output).map((other) => ({
      label: other.nav,
      href: `./${other.output}`,
    })),
    BACK_TO_GAME,
  ];
}

/**
 * One nav link. "Back to the game" is marked for the page script and carries
 * its hidden note, which the script shows only if the tab would not close.
 */
function navLink(link: { label: string; href: string }): string {
  const anchor = `<a href="${escapeHtml(link.href)}"`;
  if (link.href !== BACK_TO_GAME.href) return `${anchor}>${escapeHtml(link.label)}</a>`;
  return `${anchor} data-back-to-game>${escapeHtml(link.label)}</a><span data-back-note hidden> ${escapeHtml(BACK_TO_GAME_NOTE)}</span>`;
}

export function renderPage(markdown: string, doc: LegalDocument): string {
  const { body, title } = documentToHtml(markdown, doc.source);
  const footer = footerNavLinks(doc)
    .map(navLink)
    .join('<span aria-hidden="true"> · </span>');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0d0a14" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${scriptHashSource(OPENED_BY_GAME_SCRIPT)}; style-src 'unsafe-inline'; font-src 'self'; img-src 'self'" />
    <title>${escapeHtml(title)}</title>
    <link rel="icon" href="favicon.ico" />
    <style>
      @font-face { font-family: 'Cinzel'; font-weight: 400 700; font-display: swap; src: url('assets/fonts/cinzel-latin-var.woff2') format('woff2'); }
      @font-face { font-family: 'Inter'; font-weight: 400 700; font-display: swap; src: url('assets/fonts/inter-latin-var.woff2') format('woff2'); }
      :root { color-scheme: dark; }
      body { margin: 0; background: #0d0a14; color: #c9bde0; font: 17px/1.6 Inter, Arial, sans-serif; }
      main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
      h1, h2, h3 { font-family: Cinzel, Georgia, serif; color: #f0e6ff; line-height: 1.25; text-wrap: balance; }
      h1 { font-size: 2rem; margin: 0 0 1rem; }
      h2 { font-size: 1.35rem; margin: 2.25rem 0 0.75rem; border-top: 1px solid #4a3f6e; padding-top: 1.25rem; }
      h3 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; color: #ffd88a; }
      p, li { max-width: 65ch; }
      strong { color: #f0e6ff; }
      em { color: #ffd88a; font-style: normal; }
      code { font: 0.92em/1 ui-monospace, Consolas, monospace; background: #241d3a; padding: 0.1em 0.35em; border-radius: 4px; color: #f0e6ff; }
      a { color: #ffd88a; }
      a:focus-visible { outline: 2px solid #ffd700; outline-offset: 2px; }
      ul { padding-left: 1.25rem; }
      li { margin: 0.35rem 0; }
      nav { font-size: 0.95rem; color: #8f83a8; margin-bottom: 1.5rem; }
      nav.pages { margin: 2.5rem 0 0; border-top: 1px solid #4a3f6e; padding-top: 1.25rem; }
    </style>
  </head>
  <body>
    <main>
      <nav>${navLink(BACK_TO_GAME)}</nav>
${body}
      <nav class="pages">${footer}</nav>
    </main>
    <script>${OPENED_BY_GAME_SCRIPT}</script>
  </body>
</html>
`;
}

/** Every page this run would write, keyed by its file name in `public/`. */
export function renderAllPages(read: (source: string) => string = (source) =>
  readFileSync(join(SOURCE_DIR, source), 'utf8')): Map<string, string> {
  const pages = new Map<string, string>();
  for (const doc of LEGAL_DOCUMENTS) pages.set(doc.output, renderPage(read(doc.source), doc));
  return pages;
}

function main(argv: string[]): number {
  const check = argv.includes('--check');
  const pages = renderAllPages();
  if (check) {
    const stale: string[] = [];
    for (const [name, html] of pages) {
      const target = join(OUTPUT_DIR, name);
      const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
      if (current !== html) stale.push(name);
    }
    if (stale.length > 0) {
      console.error(
        `gen-legal-pages --check: stale in public/: ${stale.join(', ')}; run \`npm run gen-legal-pages\``,
      );
      return 1;
    }
    console.log(`gen-legal-pages --check: ${pages.size} page(s) match docs/legal/`);
    return 0;
  }
  for (const [name, html] of pages) writeFileSync(join(OUTPUT_DIR, name), html);
  console.log(`gen-legal-pages: wrote ${[...pages.keys()].map((name) => `public/${name}`).join(', ')}`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
