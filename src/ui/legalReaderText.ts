/**
 * The in-game legal reader's text (M26, mock M-LegalReader), Phaser-free.
 *
 * The reader shows the published page itself, never a second copy: it reads
 * the HTML that `scripts/gen-legal-pages.ts` writes into `public/` (and the
 * desktop bundle) and turns its body into plain blocks. That generator emits a
 * fixed shape, one element per line (`<h1>` to `<h3>`, `<p>`, `<ul>` of
 * `<li>`), between the "Back to the game" nav and the footer nav, so a line
 * reader is enough and anything else on a line is a failure the test catches.
 */

export type LegalBlockKind = 'h2' | 'h3' | 'p' | 'li';

export interface LegalBlock {
  kind: LegalBlockKind;
  text: string;
  /** Emphasised whole (an `<em>` paragraph: the page's lead-in lines). */
  emphasis?: boolean;
}

export interface LegalPageText {
  /** The page's H1. */
  title: string;
  /** "Effective date: …", lifted from the first paragraph when the page has one. */
  effective: string | null;
  blocks: LegalBlock[];
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** An element's text: tags dropped, the generator's entities decoded. */
export function legalInlineText(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m).trim();
}

/** Parse a generated legal page; throws on a body line the generator would not write. */
export function parseLegalPage(html: string): LegalPageText {
  const start = html.indexOf('</nav>');
  const end = html.indexOf('<nav class="pages">');
  if (start < 0 || end < start) throw new Error('legal reader: not a generated legal page');
  const lines = html.slice(start + '</nav>'.length, end).split('\n').map((l) => l.trim()).filter(Boolean);
  let title = '';
  let effective: string | null = null;
  const blocks: LegalBlock[] = [];
  for (const line of lines) {
    const m = line.match(/^<(h[123]|p|ul)>([\s\S]*)<\/\1>$/);
    if (!m) throw new Error(`legal reader: unexpected line ${line.slice(0, 40)}`);
    const [, tag, inner] = m;
    if (tag === 'h1') {
      title = legalInlineText(inner);
    } else if (tag === 'ul') {
      for (const item of inner.split('</li>')) {
        const text = legalInlineText(item.replace(/^<li>/, ''));
        if (text) blocks.push({ kind: 'li', text });
      }
    } else if (tag === 'p') {
      const text = legalInlineText(inner);
      if (effective === null && blocks.length === 0 && /^Effective date:/.test(text)) effective = text;
      else blocks.push({ kind: 'p', text, ...(/^<em>[\s\S]*<\/em>$/.test(inner) ? { emphasis: true } : {}) });
    } else {
      blocks.push({ kind: tag as 'h2' | 'h3', text: legalInlineText(inner) });
    }
  }
  return { title, effective, blocks };
}
