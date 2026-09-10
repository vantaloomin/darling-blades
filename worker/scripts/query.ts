/**
 * T0 spike reader: proves the Workers Analytics Engine SQL API read path.
 *
 *   npx tsx worker/scripts/query.ts ["<sql>"]
 *
 * Needs CLOUDFLARE_ACCOUNT_ID and a token with Account Analytics: Read
 * (CLOUDFLARE_ANALYTICS_TOKEN, falling back to CLOUDFLARE_API_TOKEN, which the
 * deploy token deliberately lacks; a 403 here is the least-privilege split
 * working, not a bug). The default query is the shape the T3 rollup uses:
 * counts by event type over the last day, no per-row output.
 */

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
  console.error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ANALYTICS_TOKEN (or CLOUDFLARE_API_TOKEN) must be set.');
  process.exit(2);
}

const sql =
  process.argv[2] ??
  `SELECT blob1 AS type, blob2 AS build, count() AS points, count(DISTINCT blob3) AS distinct_hashes
   FROM db_signals_v1
   WHERE timestamp > NOW() - INTERVAL '1' DAY
   GROUP BY type, build
   ORDER BY type`;

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
