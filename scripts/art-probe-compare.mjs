/* global process, console */
// Compare existing probe evidence only; this command never starts a browser.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { memoryGate } from './art-probe-metrics.mjs';

function argumentsFor(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (!['--on', '--off', '--out'].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (options[flag] !== undefined) throw new Error(`Repeated argument: ${flag}`);
    options[flag] = resolve(value);
  }
  if (!options['--on'] || !options['--off'] || !options['--out']) throw new Error('Usage: node scripts/art-probe-compare.mjs --on ON.json --off OFF.json --out VERDICT.json');
  const comparablePath = (path) => process.platform === 'win32' ? path.toLowerCase() : path;
  if (comparablePath(options['--out']) === comparablePath(options['--on']) || comparablePath(options['--out']) === comparablePath(options['--off'])) throw new Error('The verdict path must differ from the input evidence paths');
  return options;
}

try {
  const options = argumentsFor(process.argv.slice(2));
  let result;
  try {
    const on = JSON.parse(readFileSync(options['--on'], 'utf8').replace(/^\uFEFF/, ''));
    const off = JSON.parse(readFileSync(options['--off'], 'utf8').replace(/^\uFEFF/, ''));
    result = memoryGate(on, off);
  } catch (error) {
    result = { status: 'UNMEASURED', reasons: [`Cannot read measurement evidence: ${error.message}`] };
  }
  result.inputs = { on: options['--on'], off: options['--off'] };
  mkdirSync(dirname(options['--out']), { recursive: true });
  writeFileSync(options['--out'], `${JSON.stringify(result, null, 2)}\n`);
  const number = (value) => typeof value === 'number' ? value.toFixed(3) : 'unmeasured';
  console.log(`Gate 1 ${result.status}: GPU median peaks on=${number(result.candidate?.medianGpuPeakMiB)} MiB off=${number(result.baseline?.medianGpuPeakMiB)} MiB (${number(result.gpuPercentOfOff)}% of off, reduction=${number(result.gpuReductionPercent)}%); renderer on=${number(result.candidate?.medianRendererPeakMiB)} MiB off=${number(result.baseline?.medianRendererPeakMiB)} MiB, delta=${number(result.rendererDeltaMiB)} MiB`);
  for (const reason of result.reasons) console.log(reason);
  console.log(`Wrote ${options['--out']}`);
  process.exitCode = result.status === 'PASS' ? 0 : result.status === 'FAIL' ? 1 : 2;
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
