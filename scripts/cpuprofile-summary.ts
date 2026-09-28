/**
 * Summarise a V8 `.cpuprofile` (from `node --cpu-prof`) as self time and
 * inclusive time per function, the numbers a profile report quotes.
 *
 *   node --cpu-prof --cpu-prof-dir <dir> --import tsx scripts/action-log.ts \
 *     record --pair greedy:weenie,starter:starter-wild --seeds 4 --workers 0 --out x.jsonl
 *   npx tsx scripts/cpuprofile-summary.ts <dir>/<file>.cpuprofile [--top 40] [--filter src/ai]
 *
 * Inclusive time counts a function once per sample even when it recurses, so
 * a column never exceeds 100 percent.
 */
import { readFileSync } from 'node:fs';

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}

interface CpuProfile {
  nodes: ProfileNode[];
  samples: number[];
  timeDeltas: number[];
}

function label(node: ProfileNode): string {
  const url = node.callFrame.url.replace(/\\/g, '/');
  const at = url.lastIndexOf('/src/') >= 0 ? url.slice(url.lastIndexOf('/src/') + 1)
    : url.lastIndexOf('/scripts/') >= 0 ? url.slice(url.lastIndexOf('/scripts/') + 1)
      : url.split('/').pop() ?? url;
  return `${node.callFrame.functionName || '(anonymous)'} ${at}:${node.callFrame.lineNumber + 1}`;
}

function main(): void {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) throw new Error('usage: cpuprofile-summary <file.cpuprofile> [--top n] [--filter text]');
  const topIndex = args.indexOf('--top');
  const top = topIndex >= 0 ? Number(args[topIndex + 1]) : 40;
  const filterIndex = args.indexOf('--filter');
  const filter = filterIndex >= 0 ? args[filterIndex + 1] : undefined;
  const profile = JSON.parse(readFileSync(file, 'utf8')) as CpuProfile;
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map<number, number>();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);

  const self = new Map<string, number>();
  const inclusive = new Map<string, number>();
  let total = 0;
  profile.samples.forEach((id, i) => {
    const dt = profile.timeDeltas[i] ?? 0;
    total += dt;
    const leaf = byId.get(id)!;
    self.set(label(leaf), (self.get(label(leaf)) ?? 0) + dt);
    const seen = new Set<string>();
    for (let cur: number | undefined = id; cur !== undefined; cur = parent.get(cur)) {
      const key = label(byId.get(cur)!);
      if (seen.has(key)) continue;
      seen.add(key);
      inclusive.set(key, (inclusive.get(key) ?? 0) + dt);
    }
  });
  const show = (title: string, map: Map<string, number>): void => {
    console.log(`\n${title} (total ${(total / 1e6).toFixed(1)} s)`);
    const rows = [...map].filter(([k]) => !filter || k.includes(filter)).sort((a, b) => b[1] - a[1]).slice(0, top);
    for (const [k, v] of rows) {
      console.log(`${(v / 1e6).toFixed(2).padStart(8)} s ${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`);
    }
  };
  show('SELF', self);
  show('INCLUSIVE', inclusive);

  // --callers <text>: time under the matching function, split by the chain of
  // `--depth` frames above its outermost occurrence in each sample.
  const callersIndex = args.indexOf('--callers');
  if (callersIndex >= 0) {
    const needle = args[callersIndex + 1];
    const depthIndex = args.indexOf('--depth');
    const depth = depthIndex >= 0 ? Number(args[depthIndex + 1]) : 2;
    const callers = new Map<string, number>();
    profile.samples.forEach((id, i) => {
      const dt = profile.timeDeltas[i] ?? 0;
      const stack: string[] = [];
      for (let cur: number | undefined = id; cur !== undefined; cur = parent.get(cur)) stack.push(label(byId.get(cur)!));
      let at = -1;
      for (let k = stack.length - 1; k >= 0; k--) if (stack[k].includes(needle)) { at = k; break; }
      if (at < 0) return;
      const chain = stack.slice(at + 1, at + 1 + depth).map((s) => s.split(' ')[0]).join(' < ');
      callers.set(chain, (callers.get(chain) ?? 0) + dt);
    });
    show(`CALLERS of ${needle}`, callers);
  }
}

main();
