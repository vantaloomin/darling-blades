import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Hard boundary: the headless core must never touch Phaser or presentation code.
    files: ['src/engine/**', 'src/ai/**', 'src/data/**', 'src/meta/**', 'src/power/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'phaser', message: 'engine/ai/data/meta must stay Phaser-free (headless in Vitest).' },
          ],
          patterns: [
            {
              group: ['**/scenes/*', '**/duel/*', '**/ui/*', '**/art/*', '**/audio/*'],
              message: 'engine/ai/data/meta must not depend on presentation code.',
            },
            {
              // The harness trap, enforced by machine: the balance matrices and
              // the metagame sweep walk the same duel-completion code thousands
              // of times, so a signals emit reachable from the headless core
              // would burn the daily quota in one sweep. src/net is the scene
              // layer's alone.
              group: ['**/net/*'],
              message: 'engine/ai/data/meta must never reach the network (src/net is scene-layer only).',
            },
          ],
        },
      ],
    },
  },
  {
    // The Forge's headless half (docs/forge.md): the power scorer, and the
    // builder's state, hint, store and vocabulary modules. They run in the
    // browser page, in Vitest, and (the scorer) in the local balance CLI, so on
    // top of the block above they take no Node built-ins and no DOM. This
    // block's import rule replaces the one above for src/power, so it repeats
    // that block's restrictions.
    files: ['src/power/**', 'src/forge/logic.ts', 'src/forge/hints.ts', 'src/forge/store.ts', 'src/forge/vocab.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'phaser', message: 'The scorer and the Forge logic must stay Phaser-free (headless in Vitest).' },
          ],
          patterns: [
            {
              group: ['**/scenes/*', '**/duel/*', '**/ui/*', '**/art/*', '**/audio/*', '**/net/*', './scene', './main'],
              message: 'The scorer and the Forge logic must not depend on presentation or network code.',
            },
            {
              group: ['node:*'],
              message: 'The scorer and the Forge logic also run in the browser: no Node built-ins.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Headless module: no DOM.' },
        { name: 'document', message: 'Headless module: no DOM.' },
        { name: 'navigator', message: 'Headless module: no DOM.' },
        { name: 'localStorage', message: 'Headless module, and the Forge never touches storage.' },
        { name: 'sessionStorage', message: 'Headless module, and the Forge never touches storage.' },
      ],
    },
  },
);
