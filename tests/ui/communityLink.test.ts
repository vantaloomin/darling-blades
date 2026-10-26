import { describe, expect, it } from 'vitest';
import { COMMUNITY_LINK, communityLinkLabel } from '../../src/ui/communityLink';

describe('communityLinkLabel', () => {
  // A stand-in measure: 8 px per character plus 50 px of icon and padding.
  const width = (label: string): number => 50 + 8 * label.length;
  const [full, short] = COMMUNITY_LINK.labels;

  it('shows the full name when it fits, the short one when only that fits, and the icon alone otherwise', () => {
    expect(communityLinkLabel(width(full), width)).toBe(full);
    expect(communityLinkLabel(width(full) - 1, width)).toBe(short);
    expect(communityLinkLabel(width(short) - 1, width)).toBeNull();
  });
});
