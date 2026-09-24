import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PUBLISHED_BASE } from '../../scripts/gen-legal-pages';

/**
 * Link previews (Discord, Slack, X, Bluesky, Mastodon, iMessage) read the Open
 * Graph and Twitter Card tags in index.html and fetch the image by the absolute
 * URL they name. Two things can silently break a preview: the image URL and the
 * canonical URL drifting from the published domain, which lives in one place
 * (PUBLISHED_BASE), and the image the head names not being a file the build
 * ships. Both are rules about the head, not a pin of its text.
 */
const head = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

const content = (attr: 'property' | 'name', key: string): string => {
  const match = head.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`));
  expect(match, `index.html names ${key}`).not.toBeNull();
  return match![1];
};

describe('link preview tags', () => {
  it('name the published domain for the canonical URL and the image', () => {
    expect(content('property', 'og:url')).toBe(PUBLISHED_BASE);
    const image = content('property', 'og:image');
    expect(image.startsWith(PUBLISHED_BASE)).toBe(true);
    expect(content('name', 'twitter:image')).toBe(image);
    expect(content('name', 'twitter:card')).toBe('summary_large_image');
  });

  it('name an image the build ships from public/', () => {
    const image = content('property', 'og:image');
    const file = image.slice(PUBLISHED_BASE.length);
    expect(file).not.toContain('/');
    expect(existsSync(new URL(`../../public/${file}`, import.meta.url))).toBe(true);
  });

  it('carry the same title and description on both tag families', () => {
    expect(content('property', 'og:title')).toBe(content('name', 'twitter:title'));
    expect(content('property', 'og:description')).toBe(content('name', 'twitter:description'));
    expect(content('property', 'og:description')).toBe(content('name', 'description'));
  });
});
