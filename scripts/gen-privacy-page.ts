/**
 * Builds `public/privacy.html` from `docs/legal/privacy-policy.md`.
 *
 * One source, three surfaces: the privacy page on the Pages site (and inside
 * the desktop bundle, where it works offline), the README section that links
 * it, and the in-game "What is sent" panel that lists the same fields. The page
 * is generated at build time, never hand-edited, so it cannot drift from the
 * policy. It ships in the SAME Pages deploy as the client that sends, which is
 * how "live before the first event is sent" holds by construction (owner
 * ruling 2026-09-17: the page goes live alongside 1.8).
 *
 * The converter covers exactly the markdown the policy uses (headings,
 * paragraphs, bullet lists, bold, italic, inline code, links) and refuses
 * anything else, so a new construct fails the build instead of rendering as
 * literal text. It also refuses an unfilled `[PLACEHOLDER]` it does not know:
 * the effective date is filled at the 1.8 cut (release-cut checklist), and the
 * page carries a stand-in until then.
 *
 * Usage:
 *   npx tsx scripts/gen-privacy-page.ts          write public/privacy.html
 *   npx tsx scripts/gen-privacy-page.ts --check  exit 1 if the file is stale
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'docs', 'legal', 'privacy-policy.md');
const TARGET = join(root, 'public', 'privacy.html');

/** The tokens the drafts carry and what the page shows for each until the cut fills them. */
const PLACEHOLDERS: Record<string, string> = {
  '[1.8 RELEASE DATE]': 'the day version 1.8 is released',
  '[PRIVACY URL]': 'https://vantaloomin.github.io/darling-blades/privacy.html',
};

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
    else parts.push(`<a href="${escapeHtml(m[5])}" rel="noopener">${escapeHtml(m[4])}</a>`);
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(escapeHtml(text.slice(last)));
  return parts.join('');
}

export function policyToHtml(markdown: string): { body: string; title: string } {
  let text = markdown.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  for (const [token, value] of Object.entries(PLACEHOLDERS)) text = text.split(token).join(value);
  const left = text.match(/\[[A-Z][A-Z0-9 ./-]*\]/);
  if (left) throw new Error(`gen-privacy-page: unfilled placeholder ${left[0]} in privacy-policy.md`);

  const lines = text.split('\n');
  const out: string[] = [];
  let title = 'Privacy Policy';
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
      if (level === 1) title = heading[2];
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
      throw new Error(`gen-privacy-page: unsupported markdown in privacy-policy.md: ${line.trim().slice(0, 40)}`);
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return { body: out.join('\n'), title };
}

export function renderPage(markdown: string): string {
  const { body, title } = policyToHtml(markdown);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0d0a14" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self'" />
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
    </style>
  </head>
  <body>
    <main>
      <nav><a href="./">Back to the game</a></nav>
${body}
    </main>
  </body>
</html>
`;
}

function main(argv: string[]): number {
  const check = argv.includes('--check');
  const html = renderPage(readFileSync(SOURCE, 'utf8'));
  if (check) {
    const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
    if (current !== html) {
      console.error('gen-privacy-page --check: public/privacy.html is stale; run `npm run gen-privacy-page`');
      return 1;
    }
    console.log('gen-privacy-page --check: public/privacy.html matches docs/legal/privacy-policy.md');
    return 0;
  }
  writeFileSync(TARGET, html);
  console.log(`gen-privacy-page: wrote public/privacy.html (${html.length} bytes)`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
