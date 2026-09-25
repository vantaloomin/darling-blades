<!-- source-of-truth: docs/plan-telemetry-and-accounts.md, docs/rollout-telemetry-and-accounts.md, scripts/gen-legal-pages.ts, scripts/gen-third-party-notices.ts, src/ui/legalPresentation.ts, src/version.ts, src/meta/SaveManager.ts, src-tauri/tauri.conf.json, src-tauri/src/lib.rs, LICENSE · last-verified: 2026-09-22 · legal documents index — live at 1.8, NOT legal advice; re-verify when telemetry or accounts code lands -->

# Legal documents

**Status: all three ship at 1.8.** `scripts/gen-legal-pages.ts` renders each of
them into `public/` on every `npm run dev` and `npm run build`, so
`privacy.html`, `terms.html` and `notices.html` travel in the same Pages deploy
as the client and inside the desktop bundle. The game links all three from the
**Legal** button in the Settings header, and the README's License section links
them too. **None of them has been reviewed by a lawyer**, and that pass is
still owed (see "Before any of this goes live"). They are written **as of the
1.8 release**, when they launch alongside anonymous play stats (telemetry wave
T2): stats are described as live, and nothing about cloud accounts appears.
They follow the spec
([plan-telemetry-and-accounts.md](../plan-telemetry-and-accounts.md)) and what
the code does today, so that the rollout's hard gate, *"the privacy page must
be live before the first event is sent"*, holds by construction.

| File | Purpose | Needed by |
| --- | --- | --- |
| [privacy-policy.md](privacy-policy.md) | What leaves the device, who receives it, how long it lives, player rights | 1.8 launch; hard-gated: live before the first T2 event |
| [terms-of-service.md](terms-of-service.md) | Terms of use for the game | 1.8 launch (anchors the 13+ audience) |
| [notices.md](notices.md) | Trademark non-affiliation, art rights, open-source notices | 1.8 launch (the README's MTG reference has no disclaimer today) |
| [accounts-2.1-additions.md](accounts-2.1-additions.md) | Staged cloud-accounts text for the policy and terms | Merge at wave C3 (2.1), not before |

Launching together at 1.8 also leaves the pre-existing gap open until then:
the GitHub update check and Pages hosting already disclose IPs with no
policy. If that matters to you before 1.8, a cut-down policy (sections 1, 2,
3.1, 3.2, 4 to 9, with 3.3 removed) could go up now.

The generated third-party notices file, `public/THIRD_PARTY_NOTICES.txt`, is
built beside the pages by `scripts/gen-third-party-notices.ts` and is what
`notices.md` links. See "Third-party notices" below for what it can and cannot
determine offline.

Copy rule: these are player-facing, so the no-em-dash / no-AI-prose rule
applies to the policy and terms bodies (this index is a dev doc).

## Placeholders to fill

Every `[BRACKETED]` token in the drafts is an owner input. The full set:

| Token | What it needs | Note |
| --- | --- | --- |
| ~~`[OPERATOR NAME]`~~ | **Filled 2026-09-15: `Blade Darlings`** | A publishing name, not an entity (owner ruling 2026-09-15: no LLC for 1.8, non-commercial, stay pseudonymous). Policy section 1 says so. Revisit at 2.1, when accounts hold real emails |
| ~~`[CONTACT EMAIL]`~~ | **Filled 2026-09-15: `admin@bladedarlings.com`** | A dedicated inbox, not a personal one. Watch it: the policy promises a reply within 30 days |
| ~~`[COUNTRY / STATE]`~~ | **Filled 2026-09-15: Maryland, USA** | Governing law and venue for the terms |
| `[1.8 RELEASE DATE]` | The 1.8 ship date: the terms' effective date, and the day anonymous play stats began (the rollup's `startDate` must equal it) | Change it on every material edit after launch. **Release-cut step:** until it is filled, the generated page prints "the day version 1.8 is released" in its place |
| `[PRIVACY EFFECTIVE DATE]` | The privacy policy's effective date | Split from `[1.8 RELEASE DATE]` at 1.8.1, the policy's first material edit after launch (Cloudflare named in §3.1, the card summary at every hide in §3.3). Change it on every material edit. **Release-cut step:** fill with the release day |
| ~~`[PRIVACY URL]`~~ | **Decided 2026-09-17, moved to the custom domain 2026-09-24: `https://bladedarlings.com/privacy.html`** | The generator substitutes it, and rewrites it to the sibling `privacy.html` when it appears as a link; see "Hosting" |
| ~~`[THIRD-PARTY NOTICES FILE]`~~ | **Filled 2026-09-22: a link to `THIRD_PARTY_NOTICES.txt`** | Generated beside the pages by `scripts/gen-third-party-notices.ts`; see "Third-party notices" |

The 2.1 staging file carries its own extra placeholders (email sender, auth
log retention, and others), listed at its top.

## Hosting: where the documents live

The rollout names three surfaces (`docs/privacy.md`, a README section, an
in-game panel). One gap: **the Pages build does not publish `docs/`**, and a
privacy policy needs a stable URL that works without cloning the repo.
Options, cheapest first:

1. Link the GitHub file view (`github.com/vantaloomin/darling-blades/blob/main/docs/legal/privacy-policy.md`). Zero work; ugly; fine for a first cut.
2. Copy it into `public/privacy.html` at build time so it ships at `<pages-origin>/privacy.html` and inside the desktop bundle (works offline). Best long-term, one small build step.

**Chosen 2026-09-17: option 2, built rather than copied. Extended to all three
documents 2026-09-22.** `scripts/gen-legal-pages.ts` renders each source to its
page on every `npm run dev` and `npm run build` (the files are gitignored,
never hand-edited), styled with the game's own palette and fonts, so they ship
in the same Pages deploy as the client and inside the desktop bundle:

| Source | Page |
| --- | --- |
| `privacy-policy.md` | `public/privacy.html` |
| `terms-of-service.md` | `public/terms.html` |
| `notices.md` | `public/notices.html` |

It refuses to build on a markdown construct it does not cover or on an
unfilled placeholder it does not know, and it rewrites every link BETWEEN the
documents to the sibling page, so `[notices](notices.md)` and the absolute
`[PRIVACY URL]` both land on a page the same build wrote. Each page carries a
footer nav to the other two and back to the game. `npx tsx
scripts/gen-legal-pages.ts --check` fails if any page is stale.

In the game, a **Legal** button in the Settings header opens a panel with one
row per document and a Read button that opens the page beside the game
(`src/ui/legalPresentation.ts` owns the link set, `src/ui/LegalPanel.ts` draws
it). The "What is sent" panel renders its field list from `SIGNAL_FIELDS` with
a test that keeps the descriptions in step, and both it and the Legal panel use
the same guarded `openExternalPage` helper, so a webview that refuses a second
window leaves the game as it was. `index.html` also carries a `connect-src`
Content-Security-Policy naming the two hosts the game contacts (finding 6),
enforced by the browser; the desktop build's policy must also allow Tauri's IPC
origins and is set with a desktop run, not blind.

## Third-party notices

`scripts/gen-third-party-notices.ts` writes `public/THIRD_PARTY_NOTICES.txt`
beside the pages, from three committed, offline sources, so every machine
builds the same bytes:

- **npm.** `package-lock.json` names the production tree; each package's own
  `package.json` and LICENSE files supply the version, license id and text. A
  production package missing from `node_modules` is an error, not an omission.
- **Fonts.** The copyright line and license URL for Inter and Cinzel are read
  from each `.woff2` file's own `name` table, so a font swapped for a different
  cut updates the file on the next build.
- **Rust.** `src-tauri/Cargo.lock` gives crate and version for every crate the
  desktop installer redistributes.

**Two gaps, both deliberate and both offline limits.** The full **SIL OFL 1.1
text** is not reproduced: no copy of it ships in this repo and the generator
never invents license text. Committing one as `docs/legal/OFL-1.1.txt` inlines
it in the fonts section on the next build, which is the one step that closes
the OFL's redistribution requirement properly. And the **Rust crates' license
texts** are listed by crate and version only: `cargo about` is not installed,
so there is no offline source for them; the file says each crate's text ships
in its own registry source. Both are worth closing before a desktop release.

## Telemetry review, 2026-09-10

A review of the locked design against current regulator guidance and the
vendors' actual behaviour. **None of this reopens a locked decision.** Every
finding either corrects a claim in the spec or adds a task inside a wave that
already exists. Severity is for the owner's triage, not a legal opinion.

### Must fix before T2

1. **"No GDPR personal data" is overstated.** The Worker reads the IP and
   computes `hash(daily_salt, ip, ua)`. Under EU case law (Breyer, C-582/14)
   an IP address is personal data, and processing it transiently is still
   processing. The stored hash is pseudonymous while that day's salt exists,
   and becomes anonymous only once the salt is gone. The design is still
   excellent; the *claim* is wrong. Consequence: the policy must name a lawful
   basis (legitimate interests, Art. 6(1)(f)) and describe the IP handling,
   which the draft does. Do not ship copy that says "we collect no personal
   data".
2. **ePrivacy Art. 5(3) covers reading, not only storing.** The spec says 5(3)
   is not engaged because nothing is stored on the device. But 5(3) also
   covers *gaining access to* information already on the device, and EDPB
   Guidelines 2/2023 read that broadly (script-read values sent to a server
   count). The heartbeat reads the save (streak, achievements) and sends
   derived values. The defensible EU position is not "5(3) does not apply" but
   the **audience-measurement exemption** national regulators recognise (the
   CNIL's is the most detailed): strictly anonymous statistics, sole purpose of
   measuring the service, no cross-site tracking, no combination with other
   data, an easy objection mechanism, and limited retention. The design meets
   every one of those conditions *as written*. Record that as the basis in the
   plan doc, and treat the conditions as a checklist any future schema edit
   must pass. Default ON (decision 1) stands under this reading.
3. **Workers Analytics Engine stamps every row with a precise timestamp.** The
   schema's prohibition list says "timestamps finer than the hour". WAE adds a
   `timestamp` column to every data point at write time, and it cannot be
   stripped. Options: accept it and say so in the policy (the draft does: raw
   rows hold write time for up to 90 days, rollups truncate to the day), or
   drop the prohibition from the spec. It does not change the privacy picture
   much on unlinked rows, but the spec and the policy must not contradict the
   vendor.
4. **Turn Workers Logs / observability off.** New Workers created from
   current templates ship with `observability.enabled = true` in
   `wrangler.toml`, which retains invocation logs (request metadata) in
   Cloudflare's dashboard. That is a second store of exactly the data the
   design promises never to write. T0 checklist: disable observability and
   Logpush on `db-signals`, never `console.log` a request, and **check the
   placeholder Worker deployed today**, since it came from a template.
5. **"At most once per UTC day" needs storage the spec says does not exist.**
   The client cannot know it already sent today's heartbeat without persisting
   a date, which would be the device storage model A rejected. Either let the
   Worker's daily hash do the de-duplication (the design already computes it)
   and drop the client-side day cap, or store `lastHeartbeatDay` in the save
   and accept that the preference-save argument now covers it. Pick one in T1
   before the digest builder is written.

### Second-pass findings (Fable 5.1 review, 2026-09-10)

A fresh read of the drafts against the code and the spec, after the Opus 5
draft. Fixes marked *applied* are already in the files.

- **Policy section 8 promises a mechanism PR 0b does not build.** "If a
  change affects what the game sends, the game will tell you the next time
  you open it" needs a re-armable notice. `statsNoticeSeen: boolean` fires
  once, ever. *Applied (owner ruling 2026-09-10):* PR 0b now specs
  `statsNoticeVersion: number`, compared against a constant bumped with the
  allowlist, in the same v35 migration. Terms section 12 makes the same
  promise.
- **The policy said the feature stores nothing on the device; it stores the
  preference** (`shareAnonStats`, and `statsNoticeVersion`). *Applied:* the
  policy now says only the on/off choice is stored. If finding 5 resolves as
  a client-side `lastHeartbeatDay`, that sentence must widen again.
- **Section 4 repeated the overclaim finding 1 warns against** ("do not
  collect anything about any player"). *Applied:* reworded to what is true,
  the summaries carry no identifier so every one is treated the same.
- **Rollup aggregates get committed to the public repo (wave T3), which is
  publication.** *Applied:* the policy now says totals may be published.
- **DNT is mostly gone from browsers** (Firefox removed it in 135, Chrome in
  2025) and the desktop WebView2 exposes neither signal to the player.
  *Applied:* "web version only". GPC is the one that matters; keep both in
  code, it costs nothing.
- **WebView2 was listed as open-source software in the notices.** It is
  proprietary. *Applied:* moved to its own sentence in notices and disclosed
  in policy 3.1, since its diagnostic data is Microsoft's, not ours.
- **Bundled fonts owe an OFL notice.** `public/assets/fonts/` ships Inter and
  Cinzel (SIL OFL 1.1), which require the copyright notice and license text
  to travel with redistributed copies. *Applied:* named in notices; the
  generated third-party file must include the OFL text.
- **The plan doc stated the wrong ePrivacy basis** ("5(3) is not engaged").
  *Applied:* the identity-model section of `plan-telemetry-and-accounts.md`
  now records the audience-measurement basis and the Breyer point.
- **The placeholder regex missed two placeholders.** *Applied:* fixed below.
- **CSP and Phaser need a probe, not an assumption.** Finding 6 is right, but
  a `<meta>` CSP with a strict `script-src` may need `blob:` or
  `'wasm-unsafe-eval'` for Phaser's WebGL and audio paths. Ship `connect-src`
  first (that is the privacy claim), tighten the rest by probe.
- **Sections 3.1 and 3.2 state no lawful basis.** GDPR Art. 13 wants one per
  purpose. One sentence ("our legitimate interest in delivering the game and
  letting you check for updates") closes it; left for the lawyer pass since
  GitHub is arguably its own controller for hosting logs.
- Checked and sound: Breyer C-582/14, EDPB Guidelines 2/2023, the CNIL
  exemption conditions, WAE's fixed `timestamp` column, wrangler's
  `observability.enabled` default, Supabase's built-in SMTP limits and
  auth IP logging, Thaler v. Perlmutter (D.C. Cir. 2025), Tauri log plugin
  debug-only, no fonts or scripts loaded from third parties.

### Should fix (cheap, strong)

6. **Ship a Content-Security-Policy.** `src-tauri/tauri.conf.json` has
   `"csp": null`, and the web build has none. A `connect-src 'self'
   https://api.github.com https://db-signals.loominvanta.workers.dev` policy
   (plus the Supabase host at 2.1) makes the privacy page's "these are the only
   hosts the game contacts" claim **enforced by the browser**, the same way the
   ESLint fence makes layer purity structural. Tauri: set `app.security.csp`.
   Web: a `<meta http-equiv="Content-Security-Policy">` tag in `index.html`
   (Pages cannot set headers). Fold into T2.
7. **Accounts will need a third vendor for email.** Supabase's built-in SMTP is
   rate-limited to a handful of emails per hour and is documented as not for
   production. Magic-link auth at any real scale needs custom SMTP (Resend,
   Postmark, SES, and so on), which is a new processor that receives email
   addresses and must be named in the policy. Add it to wave C0's vendor list.
8. **Supabase Auth logs IPs and user agents.** The auth audit log and the
   sessions table record IP address and user agent on sign-in. The accounts
   section of the policy has to say so, with Supabase's retention. This does
   not touch telemetry unlinkability (different vendor, different host), but
   the spec's accounts data inventory currently lists only email and save.
9. **International transfers.** Supabase EU region keeps data at rest in the
   EU, but Supabase Inc. and Cloudflare Inc. are US companies. The policy needs
   a transfers sentence (both participate in the EU-US Data Privacy Framework
   and offer SCCs in their DPAs; re-verify at C0). Both DPAs apply
   automatically under their self-serve terms; no signature needed, but read
   them.

### Worth knowing (no action unless you want it)

10. **EU representative (GDPR Art. 27).** A controller outside the EU that
    offers a service to people in the EU normally needs an EU representative,
    with an exemption for occasional, low-risk processing. Anonymous-by-design
    telemetry fits the exemption comfortably; accounts at 2.1 are the point to
    ask a lawyer.
11. **The k = 10 floor is rollup-only.** Raw WAE rows (per-card rows, duel
    digests) sit queryable, below k, for 90 days. That is fine and expected;
    the policy states the 90-day raw retention so the k-anonymity promise is
    not read as covering the raw store.
12. **What is already clean, verified in code today:** no cookies anywhere;
    the save lives only in `localStorage` (`src/meta/services.ts:21`); the
    only outbound request is the on-demand update check
    (`src/version.ts:34`); `index.html` loads no third-party scripts or fonts;
    the Tauri log plugin is debug-builds only (`src-tauri/src/lib.rs:5`), so
    shipped desktop builds write no log file; the only free text a player
    types is a deck name (`SavedDeck.name`), which the spec already bans from
    payloads.

## Owner decisions these drafts surface

Short confirm-or-change items. Defaults are what the drafts assume.

1. **Content rating / audience.** Drafts say 13+ to play (the spec's line).
   Confirm that matches the art and themes.
2. **Art rights statement vs AI-generated art.** The README reserves all rights
   to the card art. The art is AI-generated (`docs/art-pipeline.md`), and in
   the US purely AI-generated images may not be copyrightable (Copyright
   Office guidance, *Thaler v. Perlmutter*). "All rights reserved" is still a
   reasonable statement of intent, but it may be weaker than it reads. The
   notices draft keeps the reservation and adds an optional AI-art disclosure
   line (commented out) for you to include or cut. Required if the game ever
   goes on Steam.
3. **Save editing.** The terms say editing your own local save is fine (it is
   single-player, open source, and a save editor exists). Confirm.
4. **Operator identity.** Individual or an entity (an LLC separates personal
   liability, and would be the name in `[OPERATOR NAME]`).

## Before any of this goes live

- Fill every placeholder; `rg "\[[A-Z0-9 ./-]+\]" docs/legal` should find
  none (the character class must cover `1.8` and `THIRD-PARTY`).
- Have a lawyer read the privacy policy and terms once, ideally before 2.1
  (accounts), which is where the real obligations start.
- Match the policy's field list to the final `playSignals.ts` allowlist
  constant, byte for byte. The rollout's single-source rule applies here too.
