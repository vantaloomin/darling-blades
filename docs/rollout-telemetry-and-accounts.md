<!-- source-of-truth: docs/plan-telemetry-and-accounts.md, docs/plan-save-portability.md, docs/plan-road-to-2.0.md, docs/roadmap.md, docs/git-workflow.md, docs/claude-playbook.md, src/meta/SaveManager.ts, src/meta/telemetry.ts, src/meta/SaveCode.ts, src/scenes/SettingsScene.ts, src/platform/env.ts, src/version.ts, eslint.config.js, scripts/balance-matrix.ts · last-verified: 2026-08-28 · rollout doc — the execution plan for plan-telemetry-and-accounts.md; re-verify when a wave lands or a vendor free tier moves -->

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
| Create a Cloudflare account | T0 | Free plan is sufficient. No custom domain needed — a Worker gets a free `*.workers.dev` hostname |
| Decide the Worker hostname | T0 | Proposal: `db-signals.<account>.workers.dev`. It goes in the client and in the privacy page, so changing it later is a code change |
| Cloudflare API token (Analytics read) → repo secret | T3 | Scope it to **Account Analytics: Read** only. Never a global key |
| Create the Supabase **prod** project, **EU region** | C0 | Region is chosen at creation and cannot be changed later |
| Create the Supabase **dev** project | C0 | This exhausts the free plan's 2-project allowance. There is no third |
| Register OAuth apps (Discord / Google / GitHub) | C0 | Redirect URIs must cover the Pages origin **and** the Tauri custom scheme |
| Publish the privacy page | T2 | Must be live before the first event is ever sent, not after |

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

Branch: `claude/rename-balance-telemetry`

Measured blast radius, 2026-08-28: **3 TypeScript files import it** —
`scripts/balance-matrix.ts`, `tests/meta/telemetry.test.ts`,
`tests/meta/telemetryAggregation.test.ts` — plus `tests/ai/reserveMulligan.test.ts`
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

Branch: `claude/save-v35-stats-preference`

This is the bump the codebase has been waiting for. `CosmeticsSave.cardBack` and
`CosmeticsSave.playmat` have been dead since v33 and their own doc comment says
they "ride the next version bump that has to happen anyway rather than paying a
migration on its own." The telemetry preference is that bump, so v35 carries
both. Two commits, one PR.

Adds to `SaveData.settings`:

- `shareAnonStats: boolean` — **`true`** for fresh saves and for migrated saves
  (decision 1).
- `statsNoticeSeen: boolean` — `false` for migrated saves, `true` for fresh ones
  (a fresh save sees the first-run flow instead). This exists so an existing
  player is *told* on the update that anonymous stats began, rather than having
  collection start silently. Defaulting ON without a notice would be the wrong
  posture even where it is legal.

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

Branch: `claude/signals-spike` (never merged; a scratch branch and a written
finding)

- Stand the Worker up on the chosen `workers.dev` hostname. Send synthetic
  events. Verify the WAE write path, the SQL API read path, and one real rollup
  query end to end.
- Project the free-tier headroom against a realistic DAU. Two digests per
  player-day against 100k requests/day is roughly 50k player-days of headroom;
  confirm the arithmetic against actual payload sizes rather than trusting it.
- **Build `scripts/measure-save-code.ts` here.** It does not exist,
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

Branch: `claude/play-signals-core` · PR: `feat(meta): playSignals — the pure anonymous digest builders`

- New `src/meta/playSignals.ts`. Pure. No browser API, no Phaser, no network —
  it is inside the iron-invariant fence and stays there.
- Contents: the event types, every bucketing function, the **field allowlist as
  an exported constant**, `buildHeartbeat(save, env)` and
  `buildDuelDigest(result, deck, save)`.
- Tests, and these are the point of the wave:
  - the outgoing key set **equals** the allowlist exactly — not "contains", equals;
  - a fixture save whose deck is named with a distinctive sentinel string
    produces a payload in which that sentinel **does not appear anywhere**,
    asserted against the serialised JSON;
  - every numeric field is bucketed — no raw counts escape;
  - `buildDuelDigest` emits per-card rows carrying **no deck reference**;
  - signed-in and signed-out inputs produce **byte-identical** output. This test
    is written now, before accounts exist, so C2 cannot quietly break it.

Gate: rungs 1-4, 6. Exit: 100% of the allowlist covered by test; zero network
code in the diff.

### T2 — Transport, consent surfaces, and the privacy page. **This is the shippable release.**

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
- The one-time notice for existing players, gated on `statsNoticeSeen`. A
  `Toast`, not a blocking dialog.

Docs:

- `docs/privacy.md`, a README section, and the in-game panel — three surfaces,
  one source of truth, no drift.
- Both must cover **the pre-existing disclosures too**: `src/version.ts:34`
  already calls `api.github.com` on the Settings update check, which discloses
  the player's IP to GitHub, and GitHub Pages logs request IPs. Neither has ever
  been disclosed because there was no privacy policy.
- **README copy rule applies**: no em-dashes, no AI prose patterns, no emojis.

Worker (separate repo or a `worker/` directory — see the risk register):

- Schema validation that drops anything malformed, a payload size cap, a
  Cloudflare free-plan rate-limiting rule, and the rotating daily salt.
- The salt rotates every 24h and **is never persisted**. The IP is read, hashed,
  and discarded within the request. Neither is ever written to WAE.

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
