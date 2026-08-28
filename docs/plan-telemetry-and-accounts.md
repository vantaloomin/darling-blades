<!-- source-of-truth: docs/roadmap.md, docs/plan-road-to-2.0.md, docs/plan-save-portability.md, src/meta/SaveManager.ts, src/meta/SaveCode.ts, src/meta/telemetry.ts, src/meta/Quests.ts, src/meta/Achievements.ts, src/platform/env.ts, src/version.ts, src/scenes/SettingsScene.ts, eslint.config.js, .github/workflows/deploy.yml · last-verified: 2026-08-28 · design/plan doc — investigation only, no code exists; re-verify when the referenced code changes -->

# Anonymous telemetry and optional cloud accounts

**Status: investigation, 2026-08-28. No code was written and none is
authorized by this document.** It exists to close the gap
[plan-road-to-2.0.md](plan-road-to-2.0.md) named: *"Cloud saves is the only
item with neither a plan doc nor code."* It now has a spec. It also adds a
second, cheaper feature the roadmap never listed — anonymous play telemetry —
because the two share one hard requirement (a privacy posture) and one hard
prohibition (they must never be joinable).

**All eight open decisions were ruled on 2026-08-28** — decision 4 by the owner,
the rest by adopting this document's recommendations. The execution plan that
follows from them is
[rollout-telemetry-and-accounts.md](rollout-telemetry-and-accounts.md): waves,
branches, gates, owner-only prerequisites, and the ops runbook. This document
remains the **spec** (what and why); that one is the **schedule** (order and
how). Still no code.

## Goal

Two independent capabilities, deliberately built so that neither can be used to
learn anything about the other.

1. **Anonymous play telemetry.** Learn how the game is actually played —
   heartbeat, streaks, achievement progress, cards played, decks used — from a
   stream that carries **no identifier of any kind** and therefore cannot be
   tied to a person, an install, or an account. Free to run. Compliant with
   GDPR / ePrivacy, CCPA/CPRA, and COPPA by *collecting nothing that those laws
   regulate*, rather than by bolting consent machinery onto a design that does.
2. **Optional cloud accounts.** A player who wants their save on more than one
   device can create an account, sync, and — critically — **manage that account
   themselves**: see it, edit it, export it, and delete it outright, with no
   support ticket and no email to a human. Free to run. Never required, never
   gating content.

## Non-goals

- Telemetry does **not** identify, count returning individuals, build cohorts,
  follow a player across days, profile, target, A/B test, or feed anything to a
  third-party analytics vendor.
- Telemetry is **not** a balance instrument. `src/meta/telemetry.ts` (the
  existing per-duel balance record consumed by the harnesses) stays the source
  of truth for balance. A public endpoint on a public repo is spammable and
  its numbers are directional, never evidence. See [Abuse](#abuse-and-data-quality).
- Cloud accounts do **not** unlock cards, cosmetics, gold, achievements, or
  modes. An account that buys the player something is not optional in any
  meaningful sense, and it would turn the account age gate into a content gate.
- Cloud accounts do **not** merge saves field by field, sync an active duel, or
  replace the local-first save. Offline play is unaffected by both features.
- This document does not re-litigate the save envelope. `src/meta/SaveCode.ts`
  shipped in 1.5 and is the canonical blob; cloud sync is a remote slot for it.
  [plan-save-portability.md](plan-save-portability.md) already owns the sync
  semantics (revision, compare-and-swap, conflict UI, `cloud:` save block); this
  document answers that doc's six open decisions and amends two of them.

## What already exists (measured, 2026-08-28)

The scale of the work depends entirely on what is already there, so:

| Asset | State | Why it matters |
| --- | --- | --- |
| `src/meta/SaveCode.ts` | **Shipped** (1.5) — versioned, checksummed, compressed envelope | Cloud sync is transport for an existing blob, not a new format. Also the free GDPR Art. 20 data-export answer. |
| `src/meta/SaveImage.ts` | Codec built and tested, UI not | A second export carrier, already verified against Pillow. |
| [plan-save-portability.md](plan-save-portability.md) | Waves 1-2 shipped, Waves 3-4 spec'd | `SaveSyncProvider`, conflict model, and the `cloud:` save block are already designed. |
| `src/version.ts` | **Already makes a network call** to `api.github.com` on the Settings update check | There is a pre-existing, undisclosed outbound request. See [the disclosure gap](#the-pre-existing-disclosure-gap). |
| `src/meta/Quests.ts` | `daily.streak.{count,lastWinDay}` | Streak values already computed client-side. Nothing new to derive. |
| `src/meta/Achievements.ts` | `AchievementState.{unlocked,claimed,pinned}` | Achievement status already a durable, countable set. |
| `src/meta/telemetry.ts` | **Name is taken** — 505 lines of balance telemetry; **3 importing files** | Naming collision, ruled: renamed to `balanceTelemetry.ts`. Blast radius is small enough to be mechanical. |
| `src/scenes/SettingsScene.ts` | 399 lines, 7 toggles in two fixed columns | Adding an 8th toggle plus a Cloud entry point needs a layout pass, not a one-liner. |
| `eslint.config.js` | `no-restricted-imports` already fences `engine/ai/data/meta` off `scenes/duel/ui/art/audio` | The mechanism to fence pure layers off a new `src/net/` already exists and just needs one more group. |
| Hosting | GitHub Pages (static, no backend) + Tauri NSIS desktop app | There is no server. Any backend is a new external dependency, and both build targets must work. |
| Privacy policy | **Does not exist** | Required before either feature ships. |

## Part 1 — Anonymous telemetry

### The core design idea

The stated requirement — "completely anonymous, never tied to a specific user,
but capture heartbeat, streaks, achievement status" — reads like a
contradiction, because retention and streak analytics conventionally need a
per-user identifier followed over time. It is not a contradiction, and the
resolution is the single most important decision in this document:

> **Send state snapshots, never user timelines.**

The client already knows its own streak, its own achievement count, its own
win record. It reports those as **values on an unlinked event**. The server
aggregates them into distributions. We learn "the median daily streak among
installs active today is 4, and 6% are past 30" without ever knowing that any
install had streaks 1, 2, 3, 4 on consecutive days.

Every requested metric survives this transformation. Nothing about it requires
knowing who anyone is.

### Identity model

Three options were considered. Only one is recommended.

**A. No client identifier at all; rotating server-side daily hash.
✅ Recommended.**
The client stores nothing and sends nothing identifying. The edge Worker
computes, in memory, `hash(salt_of_the_day, ip, coarse_ua)` purely to
de-duplicate within a single UTC day, then writes only that hash. The salt
rotates every 24 hours and is never persisted, so two days of data cannot be
linked even by us, even under subpoena. The IP is never written anywhere. This
is the model Plausible and Fathom use and publish legal analysis for.

Because **nothing is stored on the player's device**, ePrivacy Art. 5(3) — the
rule that actually produces cookie banners, and which applies to *any* storage
or access on terminal equipment, not just cookies — is not engaged. Because
nothing identifying is transmitted or retained, there is no GDPR personal data
to have a lawful basis for, no data subject access request to service, and no
deletion mechanism to build. **That absence is what makes this "minimal
changes."**

Trade-off, stated honestly: we get daily active installs, but we cannot compute
true multi-day retention cohorts. We get the *distribution* of streak lengths
instead, which answers the same product questions ("are players coming back?")
without the tracking.

**B. Persistent random `installId` in `localStorage`. ❌ Reject.**
It would give true retention cohorts. It is also a persistent identifier, which
means: ePrivacy consent (a real banner, on first launch, blocking — the
opposite of minimal changes); GDPR personal data with all the attendant
obligations; and, under COPPA, a persistent identifier is *itself* personal
information, so a pessimistic child-directed reading of the game would put us
in scope. Not worth it.

**C. Client-side daily-rotating id. ❌ Reject.** Same device-storage problem as
B for a fraction of B's benefit.

Under A, a memory-only session id (`crypto.randomUUID()` at boot, never
persisted, gone on reload) coalesces multiple pings within one launch. That is
not storage on the device and does not change the analysis.

### The event schema

Two event types. Both are digests, not streams.

**`heartbeat` — at most once per launch, and at most once per UTC day.**

| Field | Shape | Note |
| --- | --- | --- |
| `appVersion` / `buildSha` | string | already build-stamped in `src/version.ts` |
| `platform` | `web` \| `desktop` | Pages build vs Tauri |
| `formFactor` | `mobile` \| `tablet` \| `desktop` | bucket, never raw dimensions |
| `lang` | 2-letter | `en`, not `en-GB` — region narrows the crowd |
| `settings` | animations tier, reduced-motion, renderScale | product signal, no identity |
| `streakBucket` | `0`,`1`,`2`,`3`,`4-6`,`7-13`,`14-29`,`30+` | from `daily.streak.count` |
| `achievementsBucket` | share unlocked, bucketed to tenths | from `AchievementState` |
| `winsBucket`, `packsBucket`, `collectionBucket` | bucketed | progress shape |
| `tutorialDone`, `gauntletBestRung` | boolean, small int | funnel |

**`duel` — one digest per completed duel.**

| Field | Shape | Note |
| --- | --- | --- |
| `format` | constructed \| darlings \| limited \| gauntlet | |
| `deckColours` | colour identity string | e.g. `WU` |
| `deckArchetype` | enum from our own labels | **never the player's deck name** |
| `curveBucket`, `deckSource` | bucket, precon/custom/drafted | |
| `opponentId` | our built-in opponent ids | ours, not a person |
| `difficulty`, `turns`, `result`, `mulligans` | small ints/enums | |
| `cardsPlayed` | **separate rows**, one per `cardId` + count | see the k-anonymity rule below |

**The prohibition list is part of the schema, not a guideline.** Never
transmitted, at all, ever: deck names (player-authored free text, so a possible
name, handle, slur, or shared secret), any save code or replay log, IP or geo
(the Worker sees the IP; it must never write it, and `cf.country` is
deliberately dropped too), timestamps finer than the hour, exact collection
contents, verbatim user-agent, exact screen dimensions, and any account id,
email, or JWT from Part 2.

### The caveat the request asked about: when play data *does* break anonymity

The request was right to hedge on this. Play data can de-anonymise, in two
specific ways, and both have concrete mitigations.

1. **A full decklist is close to a fingerprint.** Sixty cards, plus a rare
   cosmetic, plus an unusual achievement set, arriving on one event, could let
   a determined observer match a streamer or forum poster who publishes their
   list. **Mitigation, and it is the reason for the schema shape above:** never
   emit a decklist. Emit the deck's *colour identity + archetype + curve
   bucket* on the duel row, and emit `cardsPlayed` as **separate rows carrying
   no deck reference**. Joining the two then yields nothing.
2. **Rare values are identifying.** One install in the world playing a
   particular card in a particular format on a particular day is a population of
   one. **Mitigation:** enforce **k-anonymity at query time** — any dimension
   value with fewer than *k* distinct contributing rows in the period collapses
   to `other`. Propose **k = 10**, written into the rollup queries and stated in
   the privacy page. Everything numeric is bucketed at the client, before it
   leaves the device, so the raw values never exist server-side to leak.

### Vendor: a Cloudflare Worker writing to Workers Analytics Engine

**Recommended.** The decisive property is that **no third-party analytics
vendor ever receives player data.** We own the endpoint, the schema, and the
storage. That is the strongest available answer to "never tied to a user" — it
is not a vendor's privacy promise, it is our own code, in a public repo, that
anyone can read.

Free-tier facts, verified 2026-08-28:

- **Workers free plan: 100,000 requests/day**, 10 ms CPU per invocation, 50
  subrequests per request. Two digests per player-day means roughly 50,000
  player-days/day of headroom, which is far beyond any realistic near-term DAU.
- **Workers Analytics Engine free plan: 100,000 data points written/day and
  10,000 read queries/day**, with unlimited cardinality. Cloudflare's pricing
  page currently states usage is **not being billed at all** yet, with the
  published numbers shared in advance.
- **Retention is 90 days, fixed, not configurable.** This is a *compliance
  feature* — GDPR's storage-limitation principle is satisfied by construction,
  and there is no long-lived raw store to breach or subpoena.
- Client cost: one `fetch` (or `navigator.sendBeacon`). **No SDK, no bundle
  weight, no cookies.**

The 90-day wall is the one real limitation, and it has a free fix: a **daily
rollup**. Either a Cron Trigger Worker writing aggregates to D1 (free tier: 5 GB
storage, 100,000 rows written/day, 5 million rows read/day), or a GitHub Actions
cron — free minutes on a public repo — that queries the WAE SQL API and commits
a small aggregate JSON. Rollups are already k-anonymised, so the durable
artifact is safer than the raw table it came from.

**Rejected alternatives.** *Umami* (cloud free tier or self-hosted) is
genuinely cookieless and consent-free and would work; rejected as primary
because a third party then holds the events and its custom-property support is
thinner than a schema we design. *PostHog* has a large free tier but person
profiles and session replay are its default posture, which is the wrong shape
for this requirement. *Plausible* has no free tier. *Google Analytics* is
rejected outright: it requires a consent banner, shares with ad infrastructure,
and is incompatible with the promise being made here.

### Consent posture, and why it stays small

Under identity model A there is nothing stored on the device and nothing
personal transmitted, so no banner, no blocking modal, no consent-management
platform, no DSAR flow, and no deletion endpoint are required. What ships
anyway, because it is cheap and it is the right posture:

1. **A Settings toggle — "Share anonymous play stats."** This is the CCPA/CPRA
   opt-out affordance and GDPR good practice. One boolean in
   `SaveData.settings`. Default is [decision 1](#open-decisions-for-the-user).
2. **Honour `navigator.doNotTrack` and `navigator.globalPrivacyControl`.** Two
   lines of code. GPC is a *legally binding* opt-out signal under CPRA, so this
   is the single highest compliance-per-line item in the document.
3. **A privacy page** — `docs/privacy.md`, a README section, and an in-game
   panel reachable from Settings — listing the exact fields sent, verbatim.
   This is CCPA "notice at collection" and it is genuinely required the moment
   anything is collected at all.
4. **A one-line first-run notice** (Toast or a line in the existing first-launch
   flow), not a blocking dialog.
5. **Kill switches:** `?telemetry=off` in the URL, and a build-time flag so dev
   builds, Vitest, and the balance harnesses never emit. `IS_DEV` in
   `src/platform/env.ts` is the existing precedent.

### COPPA

COPPA applies to services directed to children under 13, or with actual
knowledge of under-13 users. Darling Blades is an anime-styled adult-audience
TCG, not a child-directed service. The minimal-change compliant position:

- **Telemetry collects no persistent identifier and no personal information**,
  so it falls outside COPPA's collection definition even under a pessimistic
  reading. This is the real protection; the rest is hygiene.
- **State the intended audience** (13+ to play; accounts 16+) in the README and
  the privacy page.
- **Age-gate account creation only** — never the game. Use a neutral
  date-of-birth entry, not a "are you over 13?" yes/no, which is a known-weak
  pattern regulators discount. Under the threshold declines the account; local
  play is untouched. **Store only `ageVerified: true`. Never store the date.**
- GDPR Art. 8 sets the digital-consent age at 16 with member-state discretion
  down to 13. Declining under-16 for accounts everywhere is one rule instead of
  a jurisdiction matrix, and is the smaller change. See decision 7.

### Abuse and data quality

The repo is public, so the endpoint is public and spammable, and the free tier
has a hard daily ceiling. Mitigations: a Cloudflare free-plan rate-limiting
rule; strict schema validation in the Worker that drops anything malformed;
a payload size cap; a build-stamped header so junk from an unknown build is
trivially filterable at query time; and a documented refusal to treat these
numbers as balance evidence. **Inflated or poisoned counts must never silently
become the basis for a card change** — that is what
`npx tsx scripts/balance-matrix.ts` and the metagame sweep are for.

## Part 2 — Optional cloud accounts

### Vendor: Supabase free tier

**Recommended**, with the escape hatch below. Free-tier facts, verified
2026-08-28: 500 MB database, **50,000 monthly active users**, 5 GB egress, 1 GB
file storage, **2 active projects**, and **free projects are paused after one
week of inactivity**.

Why it fits:

- **Auth is the expensive part, and it is done.** Email magic link (no passwords
  to store, hash, leak, or reset) plus OAuth providers (Discord, Google,
  GitHub) — all included free. 50,000 MAU is not a near-term constraint.
- **The data layer is one table.**
  `saves(user_id uuid primary key references auth.users on delete cascade,
  revision int, payload text, updated_at timestamptz)`, plus row-level-security
  policies restricting every row to `auth.uid()`. Compare-and-swap is
  `update … where user_id = auth.uid() and revision = $expected` — exactly the
  semantics [plan-save-portability.md](plan-save-portability.md) already specs.
- **Capacity is measurable, not guessed.** 500 MB divided by the compressed
  save size gives the account ceiling. That size is currently **unmeasured**;
  `scripts/measure-save-code.ts` is proposed but does not exist, and building it
  is a prerequisite of wave C0.
- **EU region** on project creation keeps EU data in-region; Supabase publishes
  a DPA.

### Self-service account management (the explicit requirement)

The request was specific: the player must be able to manage their own account,
including editing and deleting. All four of these are free and none needs a
human in the loop.

| Action | Mechanism | Regulation it answers |
| --- | --- | --- |
| **See** | Cloud panel shows email, created date, last sync, save revision, byte size, linked providers | GDPR Art. 15 |
| **Edit** | `supabase.auth.updateUser()` for email; display name; unlink an OAuth identity; sign out everywhere | GDPR Art. 16 |
| **Export** | "Download my data" → **reuse `SaveCode.ts` / `SaveImage.ts`** | GDPR Art. 20 — already built, for free |
| **Delete** | "Delete my cloud account" → typed confirmation → Edge Function (or `SECURITY DEFINER` RPC) deleting the `auth.users` row; `on delete cascade` removes the save in the same statement | GDPR Art. 17, CCPA delete |

Deletion must leave the local save **completely untouched** and the game fully
playable offline. The confirmation copy says so, because a delete button that
looks like it might wipe the player's collection will not be pressed by the
people who most want it.

### Risks, stated plainly

- **Free projects pause after 7 days of low activity.** This is the single
  biggest reliability risk and it must appear in the release notes' honest-limits
  section, not just here. Mitigation: real player traffic resets the timer, and
  a daily GitHub Actions cron (free on a public repo) pinging a trivial endpoint
  covers the quiet weeks. A paused project is restorable from the dashboard for
  up to a year.
- **2 active projects** on free means dev and prod exhaust the allowance.
- **Free-tier policy can change.** The mitigation is architectural, not
  contractual: everything sits behind `SaveSyncProvider`, so swapping providers
  is one file plus a data migration, and the export-code path is always the
  manual fallback.
- **Bundle weight.** The Supabase JS client is roughly 50-70 KB gzipped.
  Mitigation: `import()` it dynamically, only when the player opens the Cloud
  panel. Offline-first boot is unchanged, and `checkForUpdate()` in
  `src/version.ts` is the existing precedent for on-demand-only network work.
- **Tauri OAuth redirects are the classic trap.** A magic link or OAuth callback
  landing inside a desktop webview needs deep-link / custom-protocol handling.
  **This is the item most likely to fail, so wave C0 proves it in both build
  targets before anything else is committed.**

**Runner-up: a Cloudflare Worker + D1 + OAuth.** One vendor for both features,
one dashboard, and it never pauses. Rejected as primary because it means
hand-rolling sessions, tokens, and email delivery — the exact area where a
mistake is a breach rather than a bug. Note the deliberate trade in the other
direction, too: putting accounts on Cloudflare *weakens* the unlinkability story
below, because one vendor's edge logs would see both request streams.

## The rule that keeps the two features apart

This is an invariant, enforced mechanically, not a promise in prose.

- **Different vendors, different hostnames, different code paths.** Cloudflare
  for telemetry, Supabase for accounts. Two vendors makes unlinkability
  *structural* rather than a policy we are trusted to follow.
- The telemetry `fetch` uses `credentials: 'omit'`, sends no `Authorization`
  header and no cookies, and is never issued from inside an authenticated flow.
- **No account id, email, or JWT ever appears in a telemetry payload**, enforced
  by (a) a unit test asserting the outgoing payload's key set equals the
  allowlist exactly, and (b) an ESLint rule forbidding the telemetry module from
  importing the cloud module — the same `no-restricted-imports` shape already
  used for layer purity.
- **Signing in must not change what telemetry sends.** Signed-in and signed-out
  installs must be indistinguishable in the stream. A test asserts the digest
  builder produces byte-identical output for both.

## Layering, and the naming collision

Fits the iron invariants without bending them:

- **`src/meta/` stays pure.** The event types, the bucketing functions, the
  allowlist, the digest builders, the `SaveSyncProvider` interface, and the
  conflict model all live here and are fully unit-testable headless. No browser
  APIs, no Phaser, no network.
- **New `src/net/` (impure).** `telemetryClient.ts` (fetch/beacon) and
  `supabaseProvider.ts` (dynamic import). `eslint.config.js` gains one more
  entry in the existing `no-restricted-imports` patterns group so
  `engine/ai/data/meta` cannot import `src/net/*`.
- **`src/meta/telemetry.ts` is already taken** by 505 lines of balance
  telemetry. **RULED 2026-08-28: both renames.** It becomes
  `src/meta/balanceTelemetry.ts` and the new pure module is
  `src/meta/playSignals.ts`. Measured blast radius is 3 importing TypeScript
  files, so the rename is mechanical; it lands as PR 0a of the rollout, before
  anything else, so every later wave is written against final names.

## Save-schema impact

Deliberately almost nothing, which is the point.

**Telemetry needs exactly one field:** `settings.shareAnonStats: boolean`. One
`SaveData.version` bump, one stepwise `migrate()` step, one test. Under identity
model A there is no id, no queue, and no consent record to persist.

**Cloud accounts** use the block
[plan-save-portability.md](plan-save-portability.md) already specified, with
**two amendments this investigation makes**:

1. **Drop `accountId` from `SaveData`.** That doc flagged this as the preferred
   outcome "if the provider supports an unambiguous binding." Supabase binds
   identity in the JWT, so storing it in the blob is redundant personal data
   sitting inside a shareable export code.
2. **`deviceId` must be stripped by `SaveCode.encode()`.** It is a persistent
   local identifier; that is fine while it stays on the device and goes only to
   the player's own account, but a save code is *shared*, and a shared code must
   not carry a device identifier. Add a fixture test that asserts a round-tripped
   code contains no `cloud` block at all.

## Phased plan

Telemetry and accounts are independent and should not be scheduled together.
**Telemetry's entire value is the trend line, and a trend line that starts at
2.1 is worth nothing at 2.1** — it should land as early as the privacy page can
be written. Accounts stay at 2.1 as
[plan-road-to-2.0.md](plan-road-to-2.0.md) has them.

### Telemetry

- **T0 — spike, ships nothing.** Stand the Worker up on a throwaway subdomain,
  send synthetic events, verify the SQL API and the rollup query, and check free
  tier headroom against a projected DAU. Build `scripts/measure-save-code.ts`
  here; wave C0 needs it too.
- **T1 — pure core.** `src/meta/` digest builders, bucketing, the allowlist, and
  the payload-shape test. Zero network. Ships dark behind a flag.
- **T2 — transport and the consent surfaces.** `src/net/`, the Settings toggle,
  DNT/GPC, `docs/privacy.md`, the README section, the in-game privacy panel, the
  first-run line. **This is the shippable release.**
- **T3 — rollup and a local dashboard.** The cron rollup past the 90-day wall,
  plus a small local viewer following the existing `npm run sweep-dash` shape.

### Cloud accounts

- **C0 — decision and spike.** Vendor chosen, EU region, throwaway project.
  **Prove magic-link and OAuth in both the Pages build and the Tauri webview
  before committing to anything.** This is the wave that can fail.
- **C1 — pure provider layer.** `SaveSyncProvider`, an in-memory provider, the
  conflict model, and the two-device race matrix. Headless, no credentials
  needed. This is [plan-save-portability.md](plan-save-portability.md) Wave 3,
  unchanged.
- **C2 — Supabase adapter and the Cloud panel.** Status states, sign in, sign
  out, compare-and-swap upload/download, offline queue.
- **C3 — account management.** Email change, export my data, delete my account,
  sign out everywhere, the age gate, and a verified deletion drill.
- **C4 — staged rollout.** Plus a rollback drill using export codes.

### Verification ladder additions

Beyond the standard gate (`npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
`npm run build`, the doc checkers):

- payload allowlist test — outgoing key set equals the allowlist exactly;
- signed-in vs signed-out digests are byte-identical;
- telemetry-off means **zero** network requests, asserted, not eyeballed;
- deck names never appear in any payload, asserted against a fixture save whose
  deck is named with a distinctive sentinel string;
- two-device compare-and-swap race matrix;
- a deletion drill — create, sync, delete, confirm the row and the auth user are
  gone and the local save still loads.

## The pre-existing disclosure gap

Worth surfacing on its own, because it is true today and independent of
everything above: **`src/version.ts` already makes a network call** to
`api.github.com` when the player presses the Settings update check, which
discloses their IP address to GitHub. GitHub Pages hosting logs request IPs as
well. Neither is disclosed anywhere, because there is no privacy policy. That
is a small gap, but it is a real one, and `docs/privacy.md` should cover both
regardless of which way the decisions below go.

## Decisions — ALL RULED 2026-08-28

Kept in full because the reasoning is the record. **These are locked**;
reopening one reopens the wave in
[rollout-telemetry-and-accounts.md](rollout-telemetry-and-accounts.md) that
implements it. Decision 4 was ruled by the owner; the rest are the
recommendations below, adopted as written.

**Ruled: 1 ON · 2 model A · 3 split vendors · 4 both renames
(`balanceTelemetry.ts` + `playSignals.ts`) · 5 telemetry 1.8, accounts 2.1 ·
6 never unlocks · 7 age 16 everywhere · 8 desktop reports.**

1. **Telemetry default: ON with an easy off, or OFF requiring opt-in?**
   *Recommendation: ON.* Under identity model A nothing personal is collected,
   and an opt-in sample is biased toward exactly the highly-engaged players
   whose behaviour we least need to learn. OFF is the more conservative posture
   and is a defensible owner call.
2. **Identity model A (no identifier, rotating server-side hash) vs B
   (persistent `installId`)?** *Recommendation: A.* B buys retention cohorts and
   costs a consent banner, GDPR personal-data obligations, and COPPA exposure.
3. **Vendor split (Cloudflare telemetry + Supabase accounts) or single-vendor
   Cloudflare for both?** *Recommendation: split*, because it makes
   unlinkability structural. Single-vendor is simpler to operate and never
   pauses.
4. **The naming collision.** Rename `src/meta/telemetry.ts` →
   `balanceTelemetry.ts` (a wide but purely mechanical rename), or leave it and
   name the new module something distinct such as `playSignals.ts`.
   *Recommendation: rename the existing file*, because "telemetry" is the word
   everyone will reach for and the balance module is the one with a qualifier
   available.
5. **Release placement.** *Recommendation:* telemetry rides **1.8** (earlier is
   strictly better for a trend line); accounts stay at **2.1**.
6. **Does an account unlock anything?** *Recommendation: no, never.*
7. **Age gate threshold for accounts.** 13 global with 16 for the EU, or 16
   everywhere. *Recommendation: 16 everywhere* — one rule, no jurisdiction
   matrix, smaller change. No gate on the game itself either way.
8. **Does the Tauri desktop build send telemetry?** *Recommendation: yes*, same
   code path, `platform: 'desktop'`.

## Sources for the free-tier figures

All verified 2026-08-28 and subject to vendor change; re-verify before wave T0
and wave C0 rather than trusting these numbers at implementation time.

- [Cloudflare Workers Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)
- [Cloudflare Workers platform limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase GDPR compliance](https://supabase.com/docs/guides/security/gdpr-compliance)
