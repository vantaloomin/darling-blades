import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import rule from '../../eslint-rules/art-lookup-handles-late-art.js';

/**
 * The lint rule that keeps every card-art lookup honest about art that lands
 * after it was drawn (1.9, I9; configured in eslint.config.js for src/scenes
 * and src/ui). Its scope is the method or named function around the lookup,
 * and it reads the syntax tree, never the text.
 */

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

tester.run('art-lookup-handles-late-art', rule, {
  valid: [
    {
      name: 'a view that holds what it draws',
      code: `class V { apply() { const ref = Art.resolver!.getArt(this.id); this.art.setTexture(ref.textureKey); this.cancel = holdArt(this, ref, () => this.apply()); } }`,
    },
    {
      name: 'a portrait helper that fits and holds, resolving again on each redraw',
      code: `export function addPortraitArt(id: string) { const ref = resolver.getArt(id); fitAndHoldArt(image, ref, () => resolver.getArt(id), fit, holdArt); }`,
    },
    {
      name: 'a portrait drawn through addPortraitArt',
      code: `class S { draw(id: string) { const ref = Art.resolver?.getArt(id); if (ref) addPortraitArt(this, 0, 0, id, fit); } }`,
    },
    {
      name: 'a view that waits for its texture',
      code: `class V { apply() { const ref = Art.resolver!.getArt(this.id); if (ref.pending) redrawWhenArtLands(this, ref.pending, () => this.apply()); } }`,
    },
    {
      name: 'a lookup inside a callback, handled by the method around it',
      code: `class S { draw(ids: string[]) { const refs = ids.map((id) => Art.resolver!.getArt(id)); refs.forEach((ref, i) => { if (ref) addPortraitArt(this, 0, 0, ids[i], fit); }); } }`,
    },
    {
      name: 'a one-shot bake that refuses the stand-in',
      code: `export function bake(id: string) { const ref = Art.resolver?.getArt(id); if (!ref || ref.pending !== undefined) return null; return ref; }`,
    },
  ],
  invalid: [
    {
      name: 'a holdArt in a different method does not cover this one',
      code: `class V { apply() { const ref = Art.resolver!.getArt(this.id); this.art.setTexture(ref.textureKey); } hold(ref: ArtRef) { holdArt(this, ref, noop); } }`,
      errors: [{ messageId: 'unhandled' }],
    },
    {
      name: 'a plain image from the lookup',
      code: `class S { draw(id: string) { const ref = Art.resolver?.getArt(id); if (ref) this.add.image(0, 0, ref.textureKey, ref.frameName); } }`,
      errors: [{ messageId: 'unhandled' }],
    },
    {
      name: 'a comment that mentions .pending',
      code: `class S { draw(id: string) { // ref.pending is ignored here\n const ref = Art.resolver?.getArt(id); this.add.image(0, 0, ref.textureKey); } }`,
      errors: [{ messageId: 'unhandled' }],
    },
    {
      name: "a scene field named pending, not the art answer's",
      code: `class S { draw(id: string) { if (this.pending) return; const ref = Art.resolver?.getArt(id); this.add.image(0, 0, ref.textureKey); } }`,
      errors: [{ messageId: 'unhandled' }],
    },
    {
      name: 'a handler in a different method does not cover this one',
      code: `class S { draw(id: string) { const ref = Art.resolver?.getArt(id); this.add.image(0, 0, ref.textureKey); } other(id: string) { addPortraitArt(this, 0, 0, id, fit); } }`,
      errors: [{ messageId: 'unhandled' }],
    },
  ],
});
