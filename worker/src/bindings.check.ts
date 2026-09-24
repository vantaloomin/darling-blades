/**
 * A compile-time proof, and nothing else.
 *
 * `src/index.ts` declares its bindings STRUCTURALLY (`AnalyticsSink`, `KvLike`,
 * `RateLimiter`) instead of importing `AnalyticsEngineDataset`, `KVNamespace`
 * and `RateLimit` from the generated `worker-configuration.d.ts`. That is what
 * lets the game repo's Vitest suite import the Worker without dragging
 * Cloudflare's ambient types (which redefine `fetch`, `Request`, `Response` and
 * `caches`) into the game's global scope.
 *
 * The cost of that choice is that the structural interfaces could drift from
 * the real runtime and nothing would notice until a deploy. This file is the
 * thing that notices: it asserts that the bindings `wrangler types` generates
 * from wrangler.toml are assignable to what index.ts expects. It fails the
 * Worker's own `npm run typecheck`, which runs `wrangler types` first.
 *
 * Nothing imports this module, so it is never bundled: wrangler builds from
 * `main` in wrangler.toml and reaches only what index.ts imports.
 *
 * `SALT_SECRET` is added by hand below because it is a Worker SECRET, and
 * secrets are not declared in wrangler.toml, so `wrangler types` cannot know
 * about it. It is optional in index.ts precisely so its absence is a 503 at
 * runtime rather than a type error that would tempt someone into a fallback.
 */

import type { Env as StructuralEnv } from './index';

declare const generated: Cloudflare.Env & { SALT_SECRET?: string };

/** If this assignment stops compiling, index.ts and wrangler.toml have drifted. */
export const bindingsSatisfyStructuralEnv: StructuralEnv = generated;
