/**
 * Tribal Axes — the ONLY subtypes a static's `filter.subtype` may name.
 *
 * The governance rule comes from docs/plan-tribal-pass.md ("a static's
 * `filter.subtype` may only name an Axis") and is enforced by
 * tests/data/catalog.test.ts since 2026-08-17. Sub-types and flavour types
 * print on card faces freely but are mechanically inert.
 *
 * The list is the audit table's 13, plus Wolf (the Tier 0 consolidation
 * target), plus the set-headline Axes later sets added mechanically
 * (Hunter 1.3, Mermaid 1.4, Kitsune 1.5, Valkyrie CORE/Ragnarök), plus
 * Bastet (owner-ratified 2026-08-17 for Sands of the Duat; 0 cards until
 * the `sd-` waves land). Mermaid was found BY this list's enforcement
 * test on its first run: dt-seafoam-dagger's static filtered on it while
 * no audit listed it — the measured reality wins. Adding an Axis is a
 * design decision recorded in docs/plan-tribal-pass.md, never a drive-by
 * edit here.
 */
export const AXES: readonly string[] = [
  'Bastet',
  'Beastkin',
  'Construct',
  'Fae',
  'God',
  'Human',
  'Hunter',
  'Jin',
  'Kitsune',
  'Knight',
  'Mermaid',
  'Olympian',
  'Shu',
  'Strategist',
  'Valkyrie',
  'Warrior',
  'Wei',
  'Wolf',
  'Wu',
];
