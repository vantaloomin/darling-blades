import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

/**
 * The fence itself, exercised through the real ESLint API against the repo's
 * real flat config. The text scan in harnessTrap.test.ts proves today's tree is
 * clean; this proves the rule would STOP tomorrow's import, which is the part a
 * grep cannot tell you.
 *
 * `lintText` resolves the config from `filePath` without the file needing to
 * exist, so no fixture is written into `src/meta` (the one directory this wave
 * must not add files to).
 */

const ROOT = resolve(__dirname, '../..');

const eslint = new ESLint({ cwd: ROOT });

/** Messages from `no-restricted-imports` only. */
async function restrictedImportMessages(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath, warnIgnored: false });
  return result.messages
    .filter((message) => message.ruleId === 'no-restricted-imports')
    .map((message) => message.message);
}

describe('eslint keeps the headless core off the network', () => {
  it('a src/meta file importing src/net fails the lint', async () => {
    const messages = await restrictedImportMessages(
      resolve(ROOT, 'src/meta/importFenceFixture.ts'),
      "import { signals } from '../net/signals';\nexport const x = signals;\n",
    );
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.join(' ')).toContain('src/net is scene-layer only');
  }, 30_000);

  it('engine, ai and data are fenced the same way', async () => {
    for (const dir of ['engine', 'ai', 'data']) {
      const messages = await restrictedImportMessages(
        resolve(ROOT, `src/${dir}/importFenceFixture.ts`),
        "import { sendSignal } from '../net/signalsClient';\nexport const x = sendSignal;\n",
      );
      expect(messages.length, `src/${dir} is not fenced`).toBeGreaterThan(0);
    }
  }, 30_000);

  it('a DYNAMIC import slips past eslint — which is why the text scan exists', async () => {
    // Documented gap, pinned so it is noticed if it ever closes:
    // `no-restricted-imports` only sees static import/export declarations, so a
    // `await import('../net/...')` inside src/meta would lint clean. The
    // specifier scan in tests/net/harnessTrap.test.ts matches `import('...')`
    // too and is the layer that actually catches this one.
    const messages = await restrictedImportMessages(
      resolve(ROOT, 'src/meta/importFenceFixture.ts'),
      "export const load = async (): Promise<unknown> => import('../net/signals');\n",
    );
    expect(messages).toEqual([]);
  }, 30_000);

  it('the scene layer may import src/net, and Phaser is still fenced off meta', async () => {
    const allowed = await restrictedImportMessages(
      resolve(ROOT, 'src/scenes/importFenceFixture.ts'),
      "import { signals } from '../net/signals';\nexport const x = signals;\n",
    );
    expect(allowed).toEqual([]);
    // The pre-existing half of the same rule, so this test fails if the group
    // is ever replaced rather than extended.
    const phaser = await restrictedImportMessages(
      resolve(ROOT, 'src/meta/importFenceFixture.ts'),
      "import Phaser from 'phaser';\nexport const x = Phaser;\n",
    );
    expect(phaser.length).toBeGreaterThan(0);
  }, 30_000);
});
