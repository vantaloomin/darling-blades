<!-- source-of-truth: docs/roadmap.md, docs/architecture.md, docs/plan-player-replays.md, src/meta/SaveManager.ts, src/meta/services.ts, src/meta/Replay.ts, src/platform/env.ts, src/scenes/ProfileScene.ts, scripts/progression-sim.ts · last-verified: 2026-07-26 · design/plan doc - re-verify when the referenced code changes -->

# Save portability and cloud sync arc

## Goal

Release 1.5 lets players move a complete local profile between supported Darling Blades installs using a bounded, checksummed export code. Release 1.8 extends the same canonical save envelope to opt-in cloud sync, with explicit account, revision, offline, and conflict semantics. The arc has one validation and migration boundary so a code import and a cloud download cannot produce different interpretations of the same save.

## Non-goals

Release 1.5 does not create accounts, silently upload data, merge economies field by field, synchronize an active duel, or promise that a code will fit in a QR image before size is measured. Release 1.8 does not store authentication secrets inside `SaveData`, resolve concurrent gold or collection edits by addition, or turn the storage-key suffix into a schema version. The local key remains `darlingblades.save.v1`, with the legacy `waifutcg.save.v1` read only through existing migration behavior.

## Player-facing spec

Profile gains `Export save` and `Import save` actions in 1.5. Export produces a text code with a visible `DBS1` prefix, a `Copy` action, and a reminder:

> Keep this code private. It contains your collection, decks, progress, settings, and match record.

Import accepts pasted text, validates it without changing the active save, then shows a preview: save creation date, collection count, gold, deck count, progress summary, source schema, and whether stored replays are present. The destructive confirmation says:

> Replace this device's save? Your current profile will be overwritten. Export it first if you may want it back.

Cancel leaves memory and storage untouched. Success writes the imported profile once, reloads dependent services, and reports `Save imported`. Invalid, truncated, oversized, future-version, or checksum-failing codes produce distinct plain-language errors and never partially apply.

In 1.8, Settings or Profile gains `Cloud sync`. Signing in is explicit. The screen shows `Up to date`, `Changes on this device`, `Changes in cloud`, `Offline`, or `Choose a version`. A conflict preview compares last-updated time, collection count, gold, decks, and major progress. The player chooses `Keep this device` or `Use cloud`; there is no misleading automatic merge. The losing version is offered as a local export code before replacement.

## System touchpoints

### Engine

No game-rule or RNG change is required. Active engine state is not serialized into the profile, so imports occur only outside a duel. The serializer lives outside `src/engine` and never makes engine JSON a public compatibility promise. Seeded determinism and engine purity remain unchanged.

### Meta, save, and economy

Add pure `src/meta/SaveCode.ts` with a versioned envelope, canonical UTF-8 JSON serialization, compression codec identifier, base64url payload, checksum, decoded-size limit, and structured errors. It calls the same migration and normalization functions owned by `src/meta/SaveManager.ts`; it must not duplicate them or use `eval`. `src/meta/services.ts` coordinates atomic replacement and service refresh. Import is whole-profile replacement because merging gold, inventory, rewards, or claimed states creates duplication exploits.

The cloud layer adds a narrow `SaveSyncProvider` interface under `src/meta/sync/` for fetch, compare-and-swap upload, and session state. Browser and desktop adapters live in platform/I/O modules, not pure meta. The server stores an opaque canonical save blob plus revision metadata. Economy remains authoritative within the chosen whole profile; there is no sum, union, or max merge for gold, packs, collection counts, quests, achievements, tower state, or rewards.

### AI

No brain changes. Imported decks and replays pass their existing validators before use. AI still sees only `PlayerView`; neither sync metadata nor account identity enters a duel decision.

### UI scenes

`src/scenes/ProfileScene.ts` is the 1.5 home for export, import, preview, backup prompt, and status. Use a reusable modal/overlay primitive and a multiline input that works with keyboard and touch. The 1.8 account/status surface may remain in Profile or move to `src/scenes/SettingsScene.ts`, but must have only one owner. Scene code never parses payload JSON directly. Clipboard failure must expose selectable text instead of losing the code.

### Tooling and invariants

Add SaveCode fixtures for every historical save version accepted by current `migrate()`, current v22, corrupted checksums, invalid compression, oversized decoded data, unknown future schemas, prototype-pollution-shaped JSON, and noncanonical variant keys. Add provider contract tests with a fake in-memory revision server and race tests for two devices. Save schema changes always bump `SaveData.version` with a real stepwise `migrate()` and test; the current storage slot name never changes just because the schema does; pure layers import no browser/Phaser API; no existing progression gate is relaxed.

## Save-schema impact

The 1.5 export/import code adds no fields and requires no SaveData version bump. It serializes the current normalized `SaveData` as-is. Envelope metadata is outside the save:

```ts
interface SaveCodeEnvelope {
  magic: 'DBS1';
  codec: 'deflate-json-v1';
  schemaVersion: number;
  checksum: string;
  payload: string;
}
```

The final textual framing and checksum algorithm are implementation details that need golden fixtures before publication. Decoder limits are `TO MEASURE` from current and stress-fixture saves; measure with a proposed `npx tsx scripts/measure-save-code.ts` and publish encoded/decoded byte distributions before fixing caps or claiming QR support.

Cloud sync in 1.8 requires the next available schema version and adds exactly:

```ts
cloud: {
  accountId: string | null;
  deviceId: string;
  localRevision: number;
  lastSyncedRevision: number | null;
  lastSyncedAt: number | null;
};
```

Migration creates a stable random `deviceId` in the impure SaveManager/platform boundary, sets `accountId` and sync timestamps to `null`, and sets both revision counters to their unsynced defaults. Authentication tokens, refresh tokens, email addresses, and rejoin secrets are stored only by the selected platform credential adapter. Because migration randomness complicates repeatability, the migration function receives or is followed by an injected device-ID initializer; tests use a fixed ID. If the chosen provider can bind account identity outside the blob, omit `accountId` from SaveData before implementation rather than store redundant personal data.

## AI and balance impact

There is no intended gameplay change. The danger is economy duplication or loss, so the primary gates are serialization identity and concurrency tests. For a normalized fixture, decode(encode(save)) must deep-equal the normalized save; importing the same code twice must replace, not add; a compare-and-swap collision must yield a conflict, not a merged balance.

No balance matrix or metagame sweep is required for transport-only work. Run the progression simulator as an exploit regression if any merge, reward, or recovery logic is introduced:

```text
npx tsx scripts/progression-sim.ts --seeds 8 --days 60
```

Any effect of cloud conflict handling on economy is `TO MEASURE` through a new deterministic two-device sync test harness, not inferred from the metagame sweep. The measured 4.61x metagame speedup is unrelated and is not a gate here.

## Phased implementation plan

### Wave 1: canonical local code

Build the pure envelope encoder/decoder, limits, errors, golden fixtures, and import preview model. Ship no cloud API. Verification: focused SaveCode/SaveManager tests, migration fixture matrix, fuzz/property cases within bounded inputs, full Vitest, build, lint, docs, and measured code sizes for representative plus stress saves.

### Wave 2: safe Profile flow

Add copy, paste, preview, backup reminder, confirmation, atomic replace, and service refresh. The wave independently completes the 1.5 promise. Verification: UI model tests, storage-failure rollback test, repeated-import idempotency test, full Vitest, build, lint, and manual browser/desktop clipboard fallbacks.

### Wave 3: 1.8 provider and conflict spike

Choose the account/provider trust boundary, implement an in-memory provider first, and prove compare-and-swap, offline queueing, conflict detection, sign-out, and account-switch semantics. No production credentials are needed for the spike. Verification: provider contract tests, two-device deterministic scenario matrix, security review of token placement, full Vitest, build, lint, docs.

### Wave 4: production cloud adapter

Connect the approved backend, add consent/status UI, operational logging without save contents, deletion/sign-out flows, and staged rollout. Verification: adapter integration tests against a non-production environment, offline/reconnect/device-clock tests, data deletion test, platform builds, full Vitest, lint, docs, and a rollback drill using export codes.

## Open decisions for the user

- **Replay inclusion in save codes:** include the capped replay list, exclude it, or offer a checkbox. **Recommendation:** exclude by default with an explicit `Include replays` option because replay sharing has its own code and materially affects size.
- **Import policy:** whole-profile replacement or selective merge. **Recommendation:** whole-profile replacement only; selective economy merge is an exploit surface.
- **Code privacy:** checksum only, passphrase encryption, or account-bound encryption. **Recommendation:** checksum-only local codes with a clear privacy warning for 1.5; add encryption only after a recoverable key UX is specified.
- **Cloud provider:** managed backend, platform-specific storage, or self-hosted service. **Recommendation:** managed backend behind `SaveSyncProvider`, chosen only after cost, deletion, regional, and desktop/browser auth spikes.
- **Conflict policy:** explicit whole-save choice or automatic last-write-wins. **Recommendation:** explicit choice with export of the losing version.
- **Cloud account identity in SaveData:** store `accountId` in the blob or bind it only in provider metadata. **Recommendation:** provider metadata only if the selected backend supports an unambiguous binding.

## Risks and dependencies

Codes can become too large for reliable clipboard or QR workflows, compression parsers accept hostile input, and a non-atomic import can corrupt the only local profile. Cloud sync adds authentication, privacy, deletion, operations, clock skew, and concurrent-economy risks. Save format work depends on the final deck shapes in `docs/plan-darlings.md` and `docs/plan-variant-decks.md`, and should land after their combined 1.5 migration or encode whichever schema is current without guessing future fields. Replay inclusion depends on `docs/plan-player-replays.md`. Mobile copy/paste and account layouts depend on `docs/plan-mobile-overhaul.md`. Multiplayer credentials and cloud credentials may share a provider later, but `docs/plan-multiplayer.md` must not couple their tokens or lifecycles by default.

## Acceptance criteria

- Current and supported historical fixtures encode, decode, migrate, normalize, and deep-equal without losing collection, decks, progress, settings, or records.
- Corrupt, future, truncated, maliciously shaped, and oversized codes fail before any live save mutation.
- Import preview and destructive confirmation accurately summarize the replacement, and storage failure restores the prior profile.
- Export size limits are based on published `TO MEASURE` results, with no unmeasured QR claim.
- Cloud upload uses compare-and-swap revisions; two-device races always become an explicit conflict or a proven no-conflict update.
- Gold, inventory, claimed rewards, and progress are never added or unioned across conflicting profiles.
- Authentication secrets never enter SaveData, export codes, logs, replays, or engine state.
- Offline play remains available, sign-out leaves a coherent local save, and account deletion has a verified path.

