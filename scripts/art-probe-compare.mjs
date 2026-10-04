/* global process, console */
// Compare existing probe evidence only; this command never starts a browser.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { longTaskMedianGate, memoryGate } from './art-probe-metrics.mjs';

function argumentsFor(argv) {
  const options = { gate: '1', pairs: [] };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      return value;
    };
    if (flag === '--pair') { options.pairs.push({ off: resolve(next()), on: resolve(next()) }); continue; }
    if (!['--gate', '--on', '--off', '--out'].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = next();
    if (options[flag] !== undefined) throw new Error(`Repeated argument: ${flag}`);
    options[flag] = flag === '--gate' ? value : resolve(value);
  }
  options.gate = options['--gate'] ?? '1';
  if (!['1', '5'].includes(options.gate) || !options['--out']
    || (options.gate === '1' && (!options['--on'] || !options['--off'] || options.pairs.length))
    || (options.gate === '5' && (options['--on'] || options['--off'] || !options.pairs.length))) {
    throw new Error('Usage: node scripts/art-probe-compare.mjs [--gate 1] --on ON.json --off OFF.json --out VERDICT.json\n   or: node scripts/art-probe-compare.mjs --gate 5 --pair OFF.json ON.json [--pair OFF.json ON.json ...] --out VERDICT.json');
  }
  const inputs = options.gate === '1' ? [options['--on'], options['--off']] : options.pairs.flatMap(pair => [pair.off, pair.on]);
  const comparablePath = (path) => process.platform === 'win32' ? path.toLowerCase() : path;
  const sameFile = (left, right) => {
    if (comparablePath(left) === comparablePath(right)) return true;
    try {
      const a = statSync(left, { bigint: true }), b = statSync(right, { bigint: true });
      // Windows namespace aliases and hard links must not overwrite evidence
      // or turn the same run into several independent pairs.
      return a.ino !== 0n && a.dev === b.dev && a.ino === b.ino;
    } catch { return false; }
  };
  if (inputs.some(path => sameFile(options['--out'], path))) throw new Error('The verdict path must differ from the input evidence paths');
  if (inputs.some((path, index) => inputs.slice(0, index).some(previous => sameFile(path, previous)))) throw new Error('Each run must have its own evidence path; repeated inputs cannot count as independent runs');
  return options;
}

try {
  const options = argumentsFor(process.argv.slice(2));
  const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  let result;
  if (options.gate === '5') {
    const errors = [];
    const pairs = options.pairs.map((paths, index) => Object.fromEntries(['off', 'on'].map(side => {
      try { return [side, read(paths[side])]; }
      catch (error) { errors.push(`Pair ${index + 1} ${side}: cannot read measurement evidence: ${error.message}`); return [side, null]; }
    })));
    result = longTaskMedianGate(pairs);
    result.reasons.push(...errors);
    result.inputs = options.pairs;
  } else {
    try { result = memoryGate(read(options['--on']), read(options['--off'])); }
    catch (error) { result = { status: 'UNMEASURED', reasons: [`Cannot read measurement evidence: ${error.message}`] }; }
    result.inputs = { on: options['--on'], off: options['--off'] };
  }
  mkdirSync(dirname(options['--out']), { recursive: true });
  writeFileSync(options['--out'], `${JSON.stringify(result, null, 2)}\n`);
  const number = (value) => typeof value === 'number' ? value.toFixed(3) : 'unmeasured';
  if (options.gate === '5') console.log(`Gate 5 ${result.status}: ${result.validPairs}/${result.attemptedPairs} valid pairs; median count on=${number(result.candidate.medianCount)} off=${number(result.baseline.medianCount)}; median total ms on=${number(result.candidate.medianTotalMs)} off=${number(result.baseline.medianTotalMs)}`);
  else console.log(`Gate 1 ${result.status}: GPU median peaks on=${number(result.candidate?.medianGpuPeakMiB)} MiB off=${number(result.baseline?.medianGpuPeakMiB)} MiB (${number(result.gpuPercentOfOff)}% of off, reduction=${number(result.gpuReductionPercent)}%); renderer on=${number(result.candidate?.medianRendererPeakMiB)} MiB off=${number(result.baseline?.medianRendererPeakMiB)} MiB, delta=${number(result.rendererDeltaMiB)} MiB`);
  for (const reason of result.reasons) console.log(reason);
  console.log(`Wrote ${options['--out']}`);
  process.exitCode = result.status === 'PASS' ? 0 : result.status === 'FAIL' ? 1 : 2;
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
