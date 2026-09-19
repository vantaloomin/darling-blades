<!-- source-of-truth: docs/plan-telemetry-and-accounts.md, docs/plan-save-portability.md, docs/plan-road-to-2.0.md, docs/roadmap.md, docs/git-workflow.md, docs/claude-playbook.md, src/meta/SaveManager.ts, src/meta/balanceTelemetry.ts, src/meta/SaveCode.ts, src/scenes/SettingsScene.ts, src/platform/env.ts, src/version.ts, eslint.config.js, scripts/balance-matrix.ts · last-verified: 2026-09-17 · rollout doc — the execution plan for plan-telemetry-and-accounts.md; re-verify when a wave lands or a vendor free tier moves -->

# Rollout: anonymous telemetry and optional cloud accounts

The execution plan for
[plan-telemetry-and-accounts.md](plan-telemetry-and-accounts.md). That document
is the **spec** — what we build and why it is compliant. This one is the
**schedule** — the order, the branches, the gates, the owner-only steps, and
what to do when a wave goes wrong.

**Nothing here is authorized to start.** Waves are written so each is a
self-contained contract that can be handed to an agent or to Codex when its
release opens.

## Decision log

All eight open decisions are now settled. Decision 4 was ruled by the owner on
2026-08-28; the rest are the plan doc's recommendations, adopted the same day.
**These are locked and are not relitigated** — reopening one reopens the wave
that implements it.

| # | Decision | Ruling |
| --- | --- | --- |
| 1 | Telemetry default | **ON**, with a Settings toggle and a one-time notice on the update that introduces it |
| 2 | Identity model | **A** — no client identifier; rotating server-side daily hash, salt never persisted, IP never written |
| 3 | Vendors | **Split.** Cloudflare (telemetry) + Supabase (accounts). Unlinkability is structural, not a policy |
| 4 | Naming collision | **Both renames.** `src/meta/telemetry.ts` → `balanceTelemetry.ts`; the new pure module is `playSignals.ts` (owner ruling, 2026-08-28) |
| 5 | Placement | Telemetry rides **1.8**. Accounts stay **2.1** |
| 6 | Accounts unlock content | **Never.** No cards, cosmetics, gold, achievements, or modes |
| 7 | Age gate | **16 everywhere**, on account creation only. No gate on the game |
| 8 | Desktop reporting | **Yes**, same code path, `platform: 'desktop'` |

Decision 4 gives both halves a name, which matters more than it looks: after
the rename, "telemetry" in this repo means *product signals* and
"balance telemetry" means *the harness record*. Every prompt, doc, and PR title
from here on uses those two terms and no others.

## Owner-only prerequisites

Agents cannot do these. Each blocks the wave named beside it, and each should be
done at least a week before that wave opens so a surprise does not stall it.

| Step | Blocks | Notes |
| --- | --- | --- |
| ~~Create a Cloudflare account~~ | T0 | **DONE 2026-09-10** (Workers Free plan). No custom domain needed — a Worker gets a free `*.workers.dev` hostname |
| ~~Decide the Worker hostname~~ | T0 | **DECIDED 2026-09-10: `db-signals.loominvanta.workers.dev`.** A hello-world placeholder Worker named `db-signals` is deployed there to register the subdomain; the real signals Worker replaces it under the same name. It goes in the client and in the privacy page, so changing it later is a code change |
| Cloudflare API token (Analytics read) → repo secret | T3 | Scope it to **Account Analytics: Read** only. Never a global key |
| ~~Set the Worker's salt secret in Cloudflare~~ | T2 | **DONE 2026-09-17**: `SALT_SECRET` is set on `db-signals`. Ruled the same day (D-T0.2, see the T0 finding): the daily salt is a random value held in one Workers KV key for the UTC day and then deleted, with `SALT_SECRET` mixed in, so a past day can never be recomputed. The KV namespace is created in T2 with the deploy token; it is not an owner step |
| Create the Supabase **prod** project, **EU region** | C0 | Region is chosen at creation and cannot be changed later |
| Create the Supabase **dev** project | C0 | This exhausts the free plan's 2-project allowance. There is no third |
| Register OAuth apps (Discord / Google / GitHub) | C0 | Redirect URIs must cover the Pages origin **and** the Tauri custom scheme |
| Publish the privacy page | T2 | Must be live before the first event is ever sent, not after. **RULED 2026-09-17: it goes live alongside 1.8.** The page ships inside the game's own Pages build, so the deploy that first carries a client able to send is the deploy that publishes the page: no build can send before its page exists. The desktop installer is tagged after that deploy |

**Secret hygiene, on a public repo.** The Supabase **anon** key is designed to
be public and belongs in the client bundle; RLS is what protects the data. The
Supabase **service_role** key is not, and must exist only as an Edge Function
environment variable — never in the repo, never in a client bundle, never in a
GitHub Actions log. The Cloudflare Analytics token lives only in repo secrets.
Add a CI grep for both key shapes as part of wave C2 so a paste accident fails
the build rather than shipping.

---

## Wave 0 — Groundwork

**No player-visible change. Can land any time, independent of both features.**
Doing this first means every later wave is written against final names.

### PR 0a — `refactor(meta): telemetry becomes balanceTelemetry`

**LANDED 2026-09-07** (the first 1.8 wave-0 item after Node 24). Scope as
written below; the only deviation is that four of the five docs named as
mentioning the path turned out to reference the `--telemetry` harness flag,
not the module, so only the two telemetry docs changed.

Branch: `claude/rename-balance-telemetry`

Measured blast radius, 2026-08-28: **3 TypeScript files import it** —
`scripts/balance-matrix.ts`, `tests/meta/telemetry.test.ts`,
`tests/meta/telemetryAggregation.test.ts` (both since renamed to match) — plus `tests/ai/reserveMulligan.test.ts`
which references the types, and five docs that mention the path
(`architecture.md`, `plan-1.6.md`, `plan-dt-companion.md`,
`handoff-1-6-classic-retirement.md`, and the two new docs).

Scope:

- `git mv src/meta/telemetry.ts src/meta/balanceTelemetry.ts`
- rename the two test files to match (`balanceTelemetry.test.ts`,
  `balanceTelemetryAggregation.test.ts`)
- update the 3 import sites and the doc mentions
- **do not rename the exported symbols.** `GameTelemetry`,
  `PlayerGameTelemetry`, `aggregatePlayerTelemetry` and friends stay as they
  are; only the module path moves. Renaming symbols multiplies the diff for no
  benefit and makes the git history harder to follow.

Gate: rungs 1-4 and 6. Exit: `npx vitest run tests/meta` green, no string
`meta/telemetry` remains anywhere outside a historical release note.

### PR 0b — `feat(save): v35 — anonymous-stats preference, and the parked cosmetics removal`

**BUILT 2026-09-17**, scope as written below with one correction to trap 3:
keying the seeding off `beganAtCurrentVersion` was itself the bug. That flag is
true only for a save AT the current version, so every bump re-seeded the
one-way fields of a save one version behind; measured on shipped code, the
v33 to v34 update wiped per-deck style, display pins, the deck-repair
acknowledgement and both Darlings flags. The guard is now
`arrivedAtVersion >= N` per field, which also means an opt-out from anonymous
stats survives the NEXT bump, not only a reload.

Branch: `claude/save-v35-stats-preference`

This is the bump the codebase has been waiting for. `CosmeticsSave.cardBack` and
`CosmeticsSave.playmat` have been dead since v33 and their own doc comment says
they "ride the next version bump that has to happen anyway rather than paying a
migration on its own." The telemetry preference is that bump, so v35 carries
both. Two commits, one PR.

Adds to `SaveData.settings`:

- `shareAnonStats: boolean` — **`true`** for fresh saves and for migrated saves
  (decision 1).
- `statsNoticeVersion: number` — `0` for every save, fresh or migrated, until
  the notice has been shown. **Owner ruling 2026-09-17: show the notice to all
  players unless we can verify they have seen it**, and the only proof is this
  stamp. (As first written a fresh save started at the current notice version
  because "a fresh save sees the first-run flow instead"; no first-run flow
  mentions stats, so a new player would only have learned of them from
  Settings or the privacy page.) The
  client compares it against a `STATS_NOTICE_VERSION` constant that lives
  beside the allowlist in `playSignals.ts` and is bumped whenever the set of
  fields sent changes; a save below it sees the notice and is stamped. This
  exists so an existing player is *told* on the update that anonymous stats
  began, rather than having collection start silently, and so every later
  schema change can re-arm the notice without another save bump. The privacy
  policy (section 8) and the terms (section 12) promise exactly that
  re-notification, so a one-shot boolean would break the promise at the
  first allowlist edit. (Changed from `statsNoticeSeen: boolean` on
  2026-09-10, before PR 0b landed; see `legal/README.md`, second-pass
  findings.) Defaulting ON without a notice would be the wrong posture even
  where it is legal.

Removes from `CosmeticsSave`: `cardBack`, `playmat`.

**Three traps, quoted from `SaveManager.ts` and in this order:**

1. The two dead names are **identical** to the live per-deck
   `SavedDeck.cardBack` / `SavedDeck.playmat`. A find/replace hits those and
   silently breaks the 1.6.3 Style feature. **Anchor on `CosmeticsSave`, never
   on the field name.**
2. The shared re-walk guard enumerates versions explicitly and ends in
   `|| cur.version === CURRENT_SAVE_VERSION`. **The outgoing 34 must be added to
   that list by hand** or every save sitting at v34 skips the block.
3. That block rewinds a current save and re-walks the chain, so any migration
   step runs on every load. **Key the seeding off `beganAtCurrentVersion`.**

Gate: rungs 1-6, plus a `SaveCode` fixture round-trip proving a v34 code decodes
to a valid v35 save with the preference present and the dead cosmetics fields
gone. Exit: the full migration fixture matrix green.

**Nothing reads either new field yet.** No UI, no network. That is intentional —
a toggle that does nothing is a lie, so the Settings row arrives in T2 with the
behaviour behind it.

---

## Telemetry — target 1.8

### T0 — Spike. Ships nothing.

**RAN 2026-09-10; finding in [telemetry-t0-finding.md](telemetry-t0-finding.md).**
Write and read paths proven against `db-signals.loominvanta.workers.dev`;
three corrections to this plan came out of it: the data-point cap (not the
request cap) binds and card rows are 95% of it (decision D-T0.1), the
in-memory salt is per isolate so distinct-install counts need a
secret-derived salt (D-T0.2), and every rollup count must be
`sum(_sample_interval)`. `scripts/measure-save-code.ts` turned out to exist
since 1.5 (PR #141; this doc was wrong) and was extended with real-catalog
profiles and run. The branch was merged rather than discarded because the
Worker source is what T1/T2 start from.

Branch: `claude/signals-spike` (as planned, a written finding; the code in
`worker/` is the spike's Worker, kept)

- Stand the Worker up on `db-signals.loominvanta.workers.dev` (decided
  2026-09-10; a placeholder Worker of that name already holds the hostname).
  Send synthetic events. Verify the WAE write path, the SQL API read path, and one real rollup
  query end to end.
- Project the free-tier headroom against a realistic DAU. Two digests per
  player-day against 100k requests/day is roughly 50k player-days of headroom;
  confirm the arithmetic against actual payload sizes rather than trusting it.
- **Run `scripts/measure-save-code.ts` here.** (Written 2026-08-28 as "build
  it, it does not exist"; it had existed since PR #141. Corrected 2026-09-10.)
  [plan-save-portability.md](plan-save-portability.md) proposed it, and wave C0
  needs its output to size the Supabase free tier. Doing it now means the
  accounts wave opens with the number already in hand.
- **Measure the blocker-loss rate.** `*.workers.dev` hostnames are on some
  ad-blocker and DNS-filter lists. Some events will never arrive. Estimate how
  many, write the number down, and put it in the privacy page and in every
  future reading of the data.

Exit: a written finding with the measured numbers, or a decision to change
carrier before any code is committed.

### T1 — The pure core

**BUILT 2026-09-17** as `src/meta/playSignals.ts` with 53 tests. What the next
wave inherits from it:

- `SIGNAL_FIELDS` (frozen) is the allowlist the Worker's validator is held
  equal to: heartbeat 14 fields, duel 10, cards 3 (`cardId`, `countBucket`,
  `duelsBucket`), 63 tests after the owner's four schema rulings below.
  Four compile-time assertions fail the typecheck if a field-type map and its
  allowlist disagree in either direction, and the builders project through the
  allowlist, so a stray key cannot reach a payload.
- `deckArchetype` is the precon's own id when the list is an unmodified precon
  (matched by a sorted signature against every shape a granted deck can take,
  verified through the real grant path for all 19 products) and `custom`
  otherwise. `DECK_INFO.archetype` was rejected: it is shop prose, not an enum.
- An opponent id outside our 46 built-in ids becomes `unknown`; a malformed
  result reads as `draw`, so a bug shows as an anomaly instead of inflating a
  win rate. `collectionBucket` counts distinct cards owned, not a percentage.
- **Three inputs have no source anywhere in `src/` today** and T2 has to add
  them in the scene or platform layer: `formFactor` (only a touch predicate
  exists, and no dimensions may be sent), `lang`, and `reducedMotion`.
- Four schema additions proposed by the build, **all ruled IN by the owner the
  same day**: `format`'s `constructed` value is renamed `warchest`; `result`
  gains `concede`, never also a loss; every card row carries `duelsBucket`, a
  bucketed count of the launch's duels with the card-count labels
  (`buildSessionCards(tally, duelsPlayed)`, the count required); the heartbeat
  gains `lossesBucket`. None has a producer yet. T2's scene layer owes: the
  mapping of the save's `constructed` and `warchest` deck formats to the signal
  value `warchest`; a branch on `showResults`'s `reason` for a concede; and a
  launch-scoped duel counter beside the in-memory card tally, never persisted.
- **v35 corrected in place, 2026-09-17.** PR 0b shipped to the train with a
  one-shot `statsNoticeSeen: boolean`, built from a copy of this doc that
  predated the owner ruling of 2026-09-10 (the amendment had landed on `main`
  only). It is now `statsNoticeVersion: number`, 0 for a migrated save and
  `STATS_NOTICE_VERSION` for a fresh one. No further save bump: v35 had not
  shipped to any player. The constant lives in the leaf module
  `src/meta/statsNotice.ts`, because `SaveManager` needs it and `playSignals`
  imports `SaveManager`; `playSignals` re-exports it beside the allowlist, and
  `tests/meta/statsNotice.test.ts` snapshots the allowlist per notice version,
  so an allowlist edit without a bump fails the suite.
- The two v35 preference fields are deliberately NOT signals. A consent flag
  must not itself be reported; an opt-out rate would be a separate owner
  decision and a separate field.
- Standing flake risk found on the way: `tests/meta/balanceTelemetry.test.ts`
  "does not change fixed-seed simulation outcomes when attached" timed out at
  5 s once when two full suites overlapped; it takes 1.15 s alone.

Branch: `claude/play-signals-core` · PR: `feat(meta): playSignals — the pure anonymous digest builders`

- New `src/meta/playSignals.ts`. Pure. No browser API, no Phaser, no network —
  it is inside the iron-invariant fence and stays there.
- Contents: the event types, every bucketing function, the **field allowlist as
  an exported constant**, `buildHeartbeat(save, env)`,
  `buildDuelDigest(result, deck, save)`, and since the 2026-09-17 ruling on
  D-T0.1 a third pair: `tallyCardsPlayed(tally, cardIds)`, a pure reducer over
  an in-memory tally the scene layer owns, and `buildSessionCards(tally)`, the
  batch sent once when the session ends. The duel digest carries no cards.
- Tests, and these are the point of the wave:
  - the outgoing key set **equals** the allowlist exactly — not "contains", equals;
  - a fixture save whose deck is named with a distinctive sentinel string
    produces a payload in which that sentinel **does not appear anywhere**,
    asserted against the serialised JSON;
  - every numeric field is bucketed — no raw counts escape;
  - the duel digest carries **no card id at all**, and the session card rows
    carry **no deck reference, no duel reference, no order and no timestamp**;
  - signed-in and signed-out inputs produce **byte-identical** output. This test
    is written now, before accounts exist, so C2 cannot quietly break it.

Gate: rungs 1-4, 6. Exit: 100% of the allowlist covered by test; zero network
code in the diff.

### T2 — Transport, consent surfaces, and the privacy page. **This is the shippable release.**

**TRANSPORT BUILT 2026-09-17** (client core and Worker, two contracts in
parallel; the consent surfaces and the privacy page follow). Nothing is
deployed and the Settings toggle does not exist yet, so nothing sends.

- **Wire format:** `POST /v1/signals?e=heartbeat|duel|cards`, the body being
  the pure builder's output byte for byte. No envelope, no version field, no
  type field: the client adds NOTHING in transit, and the kind travels in the
  query. An optional `&v=` is reserved on the Worker (absent means 1). The two
  halves were built apart and first agreed this by message;
  `tests/net/clientToWorker.test.ts` now runs the real client against the real
  Worker handler, so a drift on either side fails the suite. It caught one bug
  on its first run: `cardsPlayed` decided the row cap per CALL, so a call
  carrying several new ids that would overflow dropped all of them.
- **The facade** (`src/net/signals.ts`): `start`, `noticeAcknowledged`,
  `cardsPlayed`, `duelFinished`, `sessionEnding`. The consent UI needs only
  `noticeAcknowledged()` after it stamps `statsNoticeVersion`; the toggle needs
  no call, because the gate re-reads the save at every send.
- **The gate** (`src/net/signalsGate.ts`), evaluated at send time, closed by any
  of: the toggle off, `navigator.doNotTrack === '1'`,
  `navigator.globalPrivacyControl === true`, `?telemetry=off`, a development
  build (`IS_DEV`, which includes the local devtools flag, so it errs toward
  sending less), or a saved notice version below `STATS_NOTICE_VERSION`. A
  development build logs the exact payload with the prefix
  `[signals:dry-run]` and sends nothing. Accumulation is gated too: a session
  played with stats off leaves nothing in memory for a later toggle-on to send.
- **No client-side daily cap** (legal review, finding 5): one heartbeat per
  launch, tracked in memory, and the Worker's daily hash de-duplicates.
- **Card batch:** at most 60 rows (`SESSION_CARD_ROW_CAP`), the first 60
  distinct cards by play order, known cards still counting past the cap. The
  Worker REJECTS an over-cap batch (400) rather than truncating, because the
  batch is sorted by card id and an edge truncation would quietly bias the
  card distribution toward the start of the alphabet. 60 against the free
  tier's 100,000 data points a day: a five-duel session costs 26 points at the
  expected 20 cards (about 3,800 player-days a day) and 66 at the cap (about
  1,500). The body cap rose 4 KB to 8 KB: a full batch of the 60 longest real
  card ids measures 4,956 bytes.
- **Results:** `concede` only when the human conceded (the winner is the AI and
  the reason is `concede`); an AI concede is a win; a draw comes from
  `state.winner === 'draw'`. The save's `constructed`, `warchest` and absent
  deck formats all report `warchest`.
- **Worker storage:** dataset `db_signals_v2`. Heartbeat and duel rows are
  indexed by the daily hash; card rows are indexed by card id and their hash
  column is always empty, so a duel row and the same session's cards cannot be
  re-joined. Card rows carry no `appVersion` and no `platform` (the cards
  allowlist has three fields), so card play cannot be split by version or by
  web and desktop; widening it is an owner decision.
- **The harness trap, by machine:** eslint fences `**/net/*` off
  engine/ai/data/meta, a full headless duel makes zero network calls, no
  balance or sweep entry point imports `src/net` or `src/scenes`, and `src/net`
  is imported by exactly `src/gameBoot.ts` and `src/scenes/DuelScene.ts`. One
  pinned gap: a dynamic `import()` slips past the lint rule.
- **Privacy page, README and CSP, built 2026-09-17:** `scripts/gen-privacy-page.ts`
  renders the policy to `public/privacy.html` on every dev and build (owner
  ruling: the page goes live alongside 1.8, and shipping it inside the same
  Pages deploy as the client is what makes "live before the first event"
  true by construction). The README gains a Privacy section. `index.html`
  carries `connect-src 'self' https://api.github.com
  https://db-signals.loominvanta.workers.dev`, connect-src only. The desktop
  CSP (`src-tauri/tauri.conf.json`, must also allow `ipc:` and
  `http://ipc.localhost`) is owed with a desktop run.
- **DEPLOYED 2026-09-18** (owner-confirmed; replaces the T0 spike at the same
  hostname). KV namespace `db-signals-salt` created and its id committed in
  `worker/wrangler.toml` (an id is not a secret). The deploy token needed one
  more permission first, Account / Workers KV Storage / Edit: the spike never
  used KV, and without it `wrangler kv namespace list` fails with
  authentication error 10000 while every script call still works. Verified
  against the live Worker: `/health` answers `{"ok":true,"build":"t2"}`; all
  three events accepted with 204 from the real client builders
  (`worker/scripts/send-synthetic.ts`); fifteen malformed shapes refused with
  400, oversize 413, wrong content type 415, foreign origin 403, GET 405; the
  KV namespace holds exactly one key, `salt:<UTC date>`, expiring one hour
  after the day ends; read back from `db_signals_v2` within a minute, where
  all 37 card rows carry an EMPTY hash column and the heartbeat and duel rows
  carry one 16-character hash (one machine, one day). Found and fixed on the
  way: `worker/scripts/query.ts` discarded a positional SQL argument whenever
  `--view` was absent and silently ran the summary instead. One thing only
  the owner can see: the dashboard should show Workers Logs as off for
  `db-signals`.
- **Still owed before release:** a desktop run to learn whether WebView2 exposes `doNotTrack`,
  `globalPrivacyControl` and `sendBeacon` (the code survives any being absent;
  which exist there is unmeasured); the k = 10 floor, which is T3's rollup and
  is not true of anything yet.

Branch: `claude/play-signals-transport` · PR: `feat: anonymous play stats, off in one tap`

Client:

- New `src/net/` directory (impure, browser APIs allowed) containing
  `signalsClient.ts` — one `fetch`/`sendBeacon`, `credentials: 'omit'`, no
  `Authorization` header, no cookies.
- **Extend `eslint.config.js`.** The existing `no-restricted-imports` patterns
  group already fences `engine/ai/data/meta` off `scenes/duel/ui/art/audio`; add
  `**/net/*` to it. This is what keeps `playSignals.ts` pure by machine rather
  than by discipline.
- Suppression, all of it: the `shareAnonStats` toggle; `navigator.doNotTrack`;
  `navigator.globalPrivacyControl` (legally binding under CPRA — two lines, the
  highest compliance-per-line item in the whole rollout); `?telemetry=off`; and
  a build-time gate keyed off the `IS_DEV` precedent in `src/platform/env.ts`.
- **The harness trap.** Duel completion is the same code path the balance
  harnesses and the metagame sweep walk thousands of times. If a signal ever
  fires from there, one sweep emits millions of events and burns the daily quota
  in minutes. Structural defence: the emit call lives in the **scene layer**
  only, never in `engine`/`meta`, so headless runs physically cannot reach it.
  Add a test that asserts a headless duel produces zero emit calls.

UI:

- The Settings toggle. `SettingsScene.ts` is 399 lines with 7 toggles in two
  fixed columns and is at capacity — **budget a layout pass, not a one-line
  addition.**
- An in-game Privacy panel reachable from Settings, listing the exact fields
  sent. Reuse `src/ui/Modal.ts`.
- The notice for existing players, shown when `statsNoticeVersion` is below
  `STATS_NOTICE_VERSION`, then stamped. A `Toast`, not a blocking dialog.

Docs:

- `docs/privacy.md`, a README section, and the in-game panel — three surfaces,
  one source of truth, no drift.
- Both must cover **the pre-existing disclosures too**: `src/version.ts:34`
  already calls `api.github.com` on the Settings update check, which discloses
  the player's IP to GitHub, and GitHub Pages logs request IPs. Neither has ever
  been disclosed because there was no privacy policy.
- **README copy rule applies**: no em-dashes, no AI prose patterns, no emojis.
- **Drafts exist (2026-09-10):** [legal/privacy-policy.md](legal/privacy-policy.md),
  [legal/terms-of-service.md](legal/terms-of-service.md), and
  [legal/notices.md](legal/notices.md), with a review of this plan in
  [legal/README.md](legal/README.md). Five of its findings are T0-T2 tasks:
  the lawful-basis wording, the ePrivacy audience-measurement basis, WAE's
  automatic timestamp, disabling Workers observability, and the client-side
  once-per-day cap needing storage.

Worker (separate repo or a `worker/` directory — see the risk register):

- Schema validation that drops anything malformed, a payload size cap, a
  rate limit, and the rotating daily salt. **Corrected 2026-09-17:** the rate
  limit is the Workers rate-limit binding (`[[ratelimits]]` in
  `worker/wrangler.toml`, `limit` per `period` of 10 or 60 seconds, keyed on
  the same daily hash), in code, not a dashboard rule. Dashboard rate-limiting
  rules attach to a zone, a domain the account owns, and this Worker
  deliberately has none, only its `workers.dev` hostname. The binding is
  permissive and per Cloudflare location by design, which suits a spam brake
  and is not an accounting system.
- The salt is a random value created fresh each UTC day, held in one Workers
  KV key with an absolute expiry just past the day, and mixed with
  `SALT_SECRET` by HMAC (re-ruled 2026-09-17, see the T0 finding; it was "never
  persisted"). A missing secret answers 503 and writes nothing: there is no
  unsalted fallback. The IP is read, hashed, and discarded within the request.
  Neither it nor anything else derived from the request is ever written to WAE
  or logged.

Gate: rungs 1-6, plus a probe run confirming that with the toggle off the
network tab shows **zero** requests to the signals host. Exit criteria include
the privacy page being **live before the first real event is sent**.

### T3 — Rollup and a local dashboard

Branch: `claude/signals-rollup` · PR: `feat(scripts): signals rollup past the 90-day wall`

WAE retention is a fixed 90 days and is not configurable. That is a compliance
feature — storage limitation by construction — but it means trend lines need a
rollup.

- A daily GitHub Actions cron (free minutes on a public repo) queries the WAE
  SQL API and commits a small k-anonymised aggregate JSON.
- **The k-anonymity floor (k = 10) is enforced in the rollup query, not
  downstream.** Anything below it collapses to `other` before it is ever
  written. The durable artifact must be safer than the raw table it came from.
- A local viewer following the existing `npm run sweep-dash` shape (:5185). Pick
  a different port.

Gate: rungs 1-6. Exit: two consecutive successful cron runs, and a manual review
of the first committed aggregate confirming no value sits below k.

**BUILT 2026-09-18** (`scripts/signals-rollup/`, `scripts/signals-dash/`,
`.github/workflows/signals-rollup.yml`). The spec above was three bullets; these
are the decisions that filled it, all made on the safe side of the privacy
policy's promise.

- **The totals never touch `main`.** `main` deploys to Pages on every push, so a
  daily data commit would be a daily deploy. The workflow writes to an orphan
  branch, `signals-data`, which shares no history with `main` and is never
  merged. `/signals-data/` is gitignored on every other branch.
- **The floor counts installs, not rows.** A heartbeat or duel value publishes
  only when at least ten DISTINCT INSTALLS reported it that day (and its own
  number is at least ten). One player with fifty duels on a rare deck is a crowd
  of one, and a row floor would publish them. This is stricter than the
  policy's "fewer than 10 summaries", which is the direction a promise may be
  exceeded in. Card rows carry no hash by design, so they are counted in rows.
  Under sampling `count(DISTINCT blob3)` undercounts, which is also the safe
  direction.
- **Complementary suppression.** When the merged `other` is itself below the
  floor, the next-smallest value is folded in, again and again, until `other`
  passes; if nothing passes the dimension is `null`. Without this, one hidden
  value is the day total minus the published ones. Install-gated folds take
  the MAX of their members' gates as a lower bound (install sets overlap); row
  folds add. The `other` row of a cross carries a total and never a split.
- **Day gates.** A section with fewer than ten installs (heartbeat), ten
  dueling installs and ten duels (duel) or ten rows (cards) is `null` for the
  day. A day where all three close still writes a file, so the run is
  idempotent and the gap explains itself.
- **One guard before every write.** `assertNoSubFloorNumber` walks the day
  object and refuses to write if any number under the three sections is below
  ten or fractional. `ROLLUP_K` is a constant, and a test reads
  `docs/legal/privacy-policy.md` and fails if the policy stops saying "fewer
  than 10".
- **A published day is never rewritten.** Two versions of one day are a
  differencing leak. The backfill window is seven days and only fills gaps.
  Accepted and stated: a value present one day and absent the next tells a
  reader it was below ten that day, which is exactly what the policy describes.
- **No time of day anywhere in a file** (legal finding 3), keys sorted, so a
  re-run is byte-identical.
- **The Actions log is public.** The run logs days, paths and counts of
  published, folded and suppressed values. Never a query result, a raw count, a
  hash, or the name of a folded value; a test holds every log line to an
  allowlist of eight patterns.
- **`config.json` ships with `startDate: null`,** and a null start date means
  the run writes nothing. **Filling it is a release-cut item**, beside the
  privacy policy's effective date. It also keeps the deploy-day synthetic rows
  out of every report.
- **The dimension table is held equal to `SIGNAL_FIELDS`** in both directions,
  with `buildSha` the one named exclusion (a build hash is a near-unique value
  and `appVersion` answers the question), so a schema change fails the suite
  until someone decides how the new field rolls up.
- **`other` is a real value of `settings.renderScale` today.** It is carried as
  `other (reported)` so it can never be read as the fold bucket, and a test
  pins `renderScale` as the only field that has one.
- **Verified against the live dataset by the main session** (the agent never
  touched Cloudflare): all 36 queries for a day run clean in Analytics
  Engine's SQL dialect and return the expected columns and types against real
  rows; a complete day with no rows writes the all-`null` file; the viewer
  renders a fixture day with no console errors and no external request.
- **Owner check done 2026-09-18:** the Cloudflare dashboard shows zero
  observability events across a window holding about 45 real requests, so
  Workers Logs are off as configured.
- **What cannot be verified until 1.8 is on `main`:** the Actions run itself,
  the first-run creation of the orphan branch, the push, and the two repo
  secrets in use. GitHub runs schedules from the default branch only, so the
  cron starts at the cut, and the exit criterion above is met after it.
  `workflow_dispatch` is there for the first run. GitHub also disables a
  schedule after 60 days without repository activity.
- **Reading it:** `npm run signals-dash` (:5186) over a local checkout of the
  branch, `git fetch origin signals-data` then
  `git worktree add ../DarlingBlades-signals-data signals-data`, with
  `SIGNALS_ROLLUP_DIR` pointed at its `rollups` folder. The raw store, for the
  90 days it exists, is `npx tsx worker/scripts/query.ts`.
- **Two standing load flakes, both timeouts and neither a regression:**
  `tests/ui/shopRetail.test.ts` runs a transpiled source file under a 1,000 ms
  `runInNewContext` budget, and `tests/meta/balanceTelemetry.test.ts` has a
  5 s default; each has failed once under a full-suite run on a busy machine
  and passes alone.

### T4 — Read it honestly

Not a code wave. A standing rule that belongs in the release notes and in this
doc:

> These numbers are **directional, never evidence**. The endpoint is public on a
> public repo and is spammable; blockers silently drop an unmeasured share of
> web events; and the desktop build has no blockers at all, so **web and desktop
> completeness rates are not comparable** and must never be divided by one
> another. `npx tsx scripts/balance-matrix.ts` and the metagame sweep remain the
> only inputs to a card change.

---

## Cloud accounts — target 2.1

### C0 — Decision spike. **The wave that can fail.**

Branch: `claude/cloud-accounts-spike` (scratch; a written finding)

Prove, before a line of production code:

1. **Magic link and OAuth work inside the Tauri webview.** This is the classic
   trap — a callback landing in a desktop webview needs deep-link / custom-scheme
   handling, and the OAuth app's redirect URIs must be registered for it. If this
   cannot be made to work cleanly, the whole feature changes shape (device-code
   flow, or web-only accounts), so it is proven first and nothing else starts
   until it is.
2. **The same flows work in the GitHub Pages build**, which is a different
   origin with different redirect rules.
3. **Capacity.** Run `scripts/measure-save-code.ts` (built in T0) against a
   representative and a stress save. 500 MB free divided by the measured
   compressed size is the account ceiling. Write the number down.
4. **Deletion actually deletes.** Create, sync, delete, then verify from the
   dashboard that the `auth.users` row and the `saves` row are both gone.

Exit: a written finding. A failure here is a **success for the wave** — it costs
a spike instead of a release.

### C1 — The pure provider layer

Branch: `claude/save-sync-provider` · PR: `feat(meta): SaveSyncProvider and the conflict model`

This is [plan-save-portability.md](plan-save-portability.md) Wave 3, unchanged
and already specified there. No credentials needed.

- `SaveSyncProvider` interface + an in-memory provider + the conflict model, all
  in pure `src/meta/sync/`.
- The two-device compare-and-swap race matrix, deterministic and headless.
- **The two amendments this rollout makes to that doc:**
  - **`accountId` is dropped from `SaveData`** — Supabase binds identity in the
    JWT, so storing it in the blob is redundant personal data inside a shareable
    export code. That doc already flagged this as the preferred outcome "if the
    provider supports an unambiguous binding". It does.
  - **`deviceId` is stripped by `SaveCode.encode()`.** It is fine on the device
    and fine going to the player's own account, but a save code is *shared*, and
    a shared code must not carry a device identifier. Add a fixture test that a
    round-tripped code contains no `cloud` block at all.

Gate: rungs 1-4, 6. Exit: race matrix green; no adapter code in the diff.

### C2 — The Supabase adapter and the Cloud panel

Branch: `claude/cloud-sync-adapter` · PR: `feat: optional cloud save sync`

- `src/net/supabaseProvider.ts`, loaded by **dynamic `import()`** only when the
  player opens the Cloud panel. The client is roughly 50-70 KB gzipped and must
  not touch first paint. `checkForUpdate()` in `src/version.ts` is the existing
  precedent for on-demand-only network work; offline-first boot is unchanged.
- One table, RLS on every row: `saves(user_id uuid primary key references
  auth.users on delete cascade, revision int, payload text, updated_at
  timestamptz)`. Compare-and-swap is
  `update … where user_id = auth.uid() and revision = $expected`.
- Cloud panel: status states, sign in, sign out, upload, download, conflict
  preview, offline queue.
- **The unlinkability tests from T1 must still pass**, unchanged. If signing in
  changes a single byte of a digest, the wave is not done.
- Add the CI grep for `service_role` key shapes.

Gate: rungs 1-6 plus the C1 race matrix re-run against the real adapter in the
**dev** project. Exit: no test from T1 or C1 weakened or skipped.

### C3 — Self-service account management

Branch: `claude/cloud-account-management` · PR: `feat: manage and delete your cloud account`

The explicit requirement, and the wave that makes the feature honest.

| Action | Mechanism |
| --- | --- |
| **See** | email, created date, last sync, revision, byte size, linked providers |
| **Edit** | `supabase.auth.updateUser()`; display name; unlink an OAuth identity; sign out everywhere |
| **Export** | "Download my data" → reuse `SaveCode.ts` / `SaveImage.ts` |
| **Delete** | typed confirmation → Edge Function → `auth.users` delete, `on delete cascade` takes the save |

- The age gate (decision 7): **16 everywhere, account creation only.** A neutral
  date-of-birth entry, not a "are you over 16?" yes/no, which regulators
  discount. **Store only `ageVerified: true`. Never store the date.**
- Deletion **must leave the local save untouched** and the game fully playable
  offline, and the confirmation copy must say so. A delete button that looks like
  it might wipe the collection will not be pressed by the people who most want
  it.
- No em-dashes in any of this copy.

Gate: rungs 1-6, plus a **deletion drill** run end to end against the dev
project and verified from the dashboard. Exit: every row of the table above
demonstrated by an agent-written probe, not by inspection.

### C4 — Staged rollout

- Ship dark behind a flag. Enable for the desktop build first (smaller,
  self-selected, easier to support), then web.
- **Rollback drill before enabling:** confirm that a player whose cloud account
  is unreachable can still export a code, and that the game plays offline with
  the panel showing a clean error rather than a spinner.

---

## Ops runbook

Written now, because the moment to write it is not at 2 a.m.

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Signals volume drops to zero | Worker down, quota exhausted, or hostname blocked | Check the Cloudflare dashboard first. The game is unaffected either way — this is never a player-facing incident |
| Signals volume spikes implausibly | Spam against the public endpoint | Tighten the rate-limiting rule. **Discard the affected window from every rollup** and note it, rather than reasoning over poisoned data |
| Cloud sync failing for everyone | Supabase project **paused** after 7 days of low activity | Restore from Supabase Studio. Then check why the keep-alive cron stopped |
| Cloud sync failing for one player | Token expiry, clock skew, or a conflict they dismissed | The export code is always the fallback. Never hand-edit a row |
| The daily rollup workflow fails or stops | A rotated or expired `CLOUDFLARE_ANALYTICS_TOKEN`, a Cloudflare API change, or GitHub disabling the schedule after 60 days of repository inactivity | Nothing is lost for seven days: the next good run backfills every missing day in its window. Past seven days, run it locally with `--day` for each gap, before the 90-day wall takes the raw rows. A run that fails writes nothing, by design |
| A rollup file holds a number below ten | A bug past both the fold and the guard | Treat as a publication incident: fix forward, do NOT rewrite the day silently, record what was exposed and for how long |
| A player asks to be forgotten | — | Telemetry: nothing to delete, and say so plainly rather than implying a search happened. Accounts: point them at the in-app delete, which is self-serve by design |

**Kill switches, in escalation order:** the Settings toggle (per player) →
`?telemetry=off` (per session) → a build-time flag (next deploy) → disable the
Worker route (immediate, global, no deploy needed). The last one is the one that
matters in an incident, and it must be tested during T2 rather than discovered
during an outage.

**The keep-alive cron is load-bearing.** A daily GitHub Actions ping against the
Supabase project is the only thing standing between a quiet week and a paused
production database. If that workflow is ever disabled, renamed, or has its
secret rotated, cloud sync dies seven days later with no warning. Treat a failing
keep-alive run as a P1, not as a flaky job.

## Risk register

| Risk | Trigger to watch | Mitigation | Owner |
| --- | --- | --- | --- |
| Tauri OAuth redirect cannot be made to work | C0 spike | Web-only accounts, or a device-code flow. Reshapes the feature; does not kill it | Owner, at C0 |
| Supabase free project pauses | 7 days of low activity | Keep-alive cron; real traffic also resets it; restorable for a year from Studio | Owner |
| A vendor's free tier changes | Any time | Everything sits behind `SaveSyncProvider`; swapping providers is one file plus a data migration. Export codes are the permanent manual fallback | — |
| Blockers silently drop web events | Continuous | Measure the rate at T0, restate it every time the data is read, never compare web to desktop rates | — |
| Signals quota exhausted by spam | Sudden volume change | Rate limiting, schema validation, size cap, build-stamped header for filtering | — |
| The Worker source drifts from the client schema | Any schema edit | Keep the allowlist constant in `playSignals.ts` as the single source, and generate or assert the Worker's validator against it | — |
| `service_role` key leaks into the public repo | Any Supabase PR | CI grep added in C2; key exists only as an Edge Function env var | Owner |
| Save v35 migration breaks the Style feature | PR 0b | Anchor on `CosmeticsSave`, never the field name. Trap 1 of 3, quoted above | — |

## Explicitly out of scope

Recorded so a future session does not quietly widen the work: leaderboards, any
social or friends layer, cross-device *active-duel* sync, A/B testing
infrastructure, crash reporting, per-player support tooling, and any account
benefit whatsoever (decision 6). Adding any of these reopens the privacy
analysis from the top, because each one needs an identifier the current design
deliberately does not have.

## Re-verify before starting

The free-tier figures in [plan-telemetry-and-accounts.md](plan-telemetry-and-accounts.md)
were read on 2026-08-28 and are the kind of number that moves. **Re-read all
seven vendor sources at the top of wave T0 and again at the top of wave C0**,
and update the plan doc rather than trusting a figure that is by then a year
old. Cloudflare's WAE pricing page in particular currently says usage is not yet
being billed, which is explicitly a temporary state.
