import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Hard boundary: the headless core must never touch Phaser or presentation code.
    files: ['src/engine/**', 'src/ai/**', 'src/data/**', 'src/meta/**'],
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
);
