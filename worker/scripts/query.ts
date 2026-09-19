/**
 * Reader for the Analytics Engine SQL API: proves the read path and gives the
 * shape the T3 rollup starts from.
 *
 *   npx tsx worker/scripts/query.ts                 # the default summary
 *   npx tsx worker/scripts/query.ts --view cards    # a named view
 *   npx tsx worker/scripts/query.ts "SELECT ..."    # any SQL
 *
 * Needs CLOUDFLARE_ACCOUNT_ID and a token with Account Analytics: Read
 * (CLOUDFLARE_ANALYTICS_TOKEN, falling back to CLOUDFLARE_API_TOKEN). The T0
 * spike measured that the deploy token is ALSO accepted by the SQL API
 * (finding 2), so a 403 here means the token is wrong, not that the split is
 * being enforced. The T3 token should still be created and scoped separately.
 *
 * THIS SCRIPT IS NEVER PART OF A TEST RUN: it makes a real, authenticated
 * network call, and Vitest collects `tests/**\/*.test.ts` only.
 *
 * THE ONE RULE FOR EVERY QUERY WRITTEN AGAINST THIS DATASET: counts are
 * `sum(_sample_interval)`, never `count()`. Analytics Engine samples writes per
 * index value, and the spike measured 20 heartbeats stored as 2 under a shared
 * index (finding 4). `count()` silently reports the sample, not the traffic.
 *
 * Column layout: see the header of worker/src/index.ts. Dataset db_signals_v2.
 */

const DATASET = 'db_signals_v2';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
  console.error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ANALYTICS_TOKEN (or CLOUDFLARE_API_TOKEN) must be set.');
  process.exit(2);
}

const VIEWS: Record<string, string> = {
  /** Everything that arrived in the last day, by event and build. The default. */
  summary: `SELECT blob1 AS event,
                   blob2 AS build,
                   sum(_sample_interval) AS estimated,
                   count() AS stored,
                   count(DISTINCT index1) AS distinct_index
            FROM ${DATASET}
            WHERE timestamp > NOW() - INTERVAL '1' DAY
            GROUP BY event, build
            ORDER BY event`,

  /** Daily active installs. An UPPER bound: see T0 finding 5 on isolate divergence. */
  installs: `SELECT toDate(timestamp) AS day,
                    count(DISTINCT blob3) AS installs_upper_bound,
                    sum(_sample_interval) AS heartbeats
             FROM ${DATASET}
             WHERE blob1 = 'heartbeat' AND timestamp > NOW() - INTERVAL '7' DAY
             GROUP BY day
             ORDER BY day`,

  /** Win rate by format. Concedes are their own outcome and are never folded into losses. */
  duels: `SELECT blob4 AS format,
                 blob12 AS result,
                 sum(_sample_interval) AS duels
          FROM ${DATASET}
          WHERE blob1 = 'duel' AND timestamp > NOW() - INTERVAL '7' DAY
          GROUP BY format, result
          ORDER BY format, result`,

  /**
   * Cards by play volume. The k = 10 floor is applied at ROLLUP (wave T3), not
   * here: this view is the raw read, and a card below the floor must be
   * collapsed to `other` before anything derived from it is published.
   */
  cards: `SELECT blob4 AS card_id,
                 blob5 AS count_bucket,
                 sum(_sample_interval) AS rows_estimated
          FROM ${DATASET}
          WHERE blob1 = 'card' AND timestamp > NOW() - INTERVAL '7' DAY
          GROUP BY card_id, count_bucket
          ORDER BY rows_estimated DESC
          LIMIT 50`,
};

const args = process.argv.slice(2);
const viewIndex = args.indexOf('--view');
// Without --view, viewIndex is -1 and `args[viewIndex + 1]` is args[0]: the old
// value comparison threw away the very SQL it was looking for (found 2026-09-18).
const positional = args.find((arg, i) => !arg.startsWith('--') && (viewIndex < 0 || i !== viewIndex + 1));

let sql: string;
if (viewIndex >= 0) {
  const name = args[viewIndex + 1];
  if (!name || !VIEWS[name]) {
    console.error(`--view must be one of: ${Object.keys(VIEWS).join(', ')}`);
    process.exit(2);
  }
  sql = VIEWS[name];
} else {
  sql = positional ?? VIEWS.summary;
}

async function main(): Promise<void> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'text/plain' },
    body: sql,
  });
  const text = await res.text();
  console.log(`status ${res.status}`);
  console.log(text);
  if (!res.ok) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
