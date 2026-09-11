<!-- source-of-truth: docs/plan-telemetry-and-accounts.md, docs/rollout-telemetry-and-accounts.md, src/version.ts, src/meta/SaveManager.ts, src/meta/services.ts, src-tauri/tauri.conf.json, src-tauri/src/lib.rs · last-verified: 2026-09-11 · DRAFT privacy policy as of 1.8 — not live, not legal advice; the field list must match src/meta/playSignals.ts once it exists -->

<!--
DRAFT, written as of the 1.8 release (telemetry wave T2). Not published. Not
reviewed by a lawyer.
- Fill every [BRACKETED] token (see docs/legal/README.md).
- Must be live at [PRIVACY URL] before the first real event is sent.
- Cloud accounts (2.1) text is staged in accounts-2.1-additions.md, not here.
- Player copy rule: no em-dashes, plain sentences.
-->

# Darling Blades Privacy Policy

**Effective date:** [1.8 RELEASE DATE]

Darling Blades is a single-player card game made by [OPERATOR NAME] ("we",
"us"). You can play it in a web browser or as a desktop app. This policy
explains what information leaves your device when you play, who receives it,
and what you can do about it.

The short version: your game lives on your device. We do not use cookies, we
do not sell data, we do not run ads, and we do not share anything with
advertising or analytics companies. Starting with version 1.8, the game can
send anonymous play stats: a small summary of how it is played, with no name,
no account, and no identifier that could link it back to you. You can switch
them off in Settings at any time.

## 1. Who is responsible

[OPERATOR NAME] is responsible for the information described here (the "data
controller" under the GDPR). Contact: BladeDarlings@gmail.com.

## 2. Your save stays on your device

Your collection, decks, progress, and settings are stored on your own device,
in your browser's local storage or in the desktop app's storage. We never
receive your save. If you clear your browser data, the save is deleted, and we
have no copy to restore.

If you choose to copy a save code or deck code and share it, that code
contains what it describes (your save or your deck list, including deck
names). Sharing it is your choice, and we do not receive it.

We do not use cookies, and the game does not load any third-party scripts,
fonts, or trackers.

## 3. When the game connects to the internet

The game plays fully offline. It connects to the internet only in these three
cases.

### 3.1 Loading the web version

The web version is hosted on GitHub Pages, run by GitHub, Inc. When your
browser loads the game, GitHub receives your IP address and standard browser
information, as it does for any website, and may keep this in its server logs
for security purposes. See [GitHub's privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).
The desktop app does not load the game from the internet. It runs on
Microsoft Edge WebView2, a Windows component whose own diagnostic settings
are controlled by Windows and described in Microsoft's privacy statement, not
by this game.

### 3.2 Checking for updates

When you press the update check button in Settings, the game asks GitHub for
the latest version number. GitHub receives your IP address as part of that
request. The game sends nothing else, and this only happens when you press the
button.

### 3.3 Anonymous play stats

If "Share anonymous play stats" is on in Settings, the game sends short
summaries of how it is played to a service we run on Cloudflare, at
`db-signals.loominvanta.workers.dev`. It is on by default. Players who had the
game before version 1.8 are told about it once, the first time they open 1.8.
The Privacy panel in Settings shows this same list.

**What we want to learn:** which formats and colours get played, how long
duels last, how far players get, and whether players come back to the game.
We use this only to improve the game.

**What is sent.** Two kinds of summary, and nothing else:

<!-- Keep this list identical to the allowlist constant in src/meta/playSignals.ts. -->

*Once per session, a check-in:*

- game version and build, and whether it is the web or desktop version
- device size category (phone, tablet, or computer), never your screen size
- language, as two letters (for example `en`)
- a few display settings (animation level, reduced motion, render scale)
- your daily streak, achievements, wins, packs opened, and collection size,
  each rounded into a broad range (for example "streak 7 to 13"), never an
  exact number
- whether you finished the tutorial, and your best Gauntlet rung

*After each finished duel, a duel summary:*

- the format, your deck's colours, a general deck type from our own list, and
  a broad range for the deck's mana curve
- whether the deck was a starter, a custom deck, or a draft deck
- which built-in computer opponent you played, the difficulty, the number of
  turns, mulligans, and the result
- which cards were played and how often, sent as separate entries that are
  not connected to the duel or the deck

**What is never sent:** your deck names or any other text you type, save
codes, replays, your exact collection, your IP address or location, your
exact screen size, or your full browser identification string.

**How it stays anonymous.** The game creates no identifier. The only thing it
stores on your device for this feature is your on or off choice, inside your
save. Our service does see your IP address when
the summary arrives, as every internet request does. It uses the IP address
only in memory, together with your browser type and a random value that is
replaced every 24 hours and never saved, to count each device once per day.
The IP address itself is never written down. Because the daily random value is
thrown away, even we cannot connect one day's summaries to another's.

**Legal basis (GDPR).** Our legitimate interest in understanding how the game
is played so we can improve it (Article 6(1)(f)). We think this interest is
reasonable because the summaries are anonymous by design and you can switch
them off at any time.

**How long it is kept.** Individual summaries are kept by Cloudflare for 90
days and then deleted automatically. Each one carries the time it was
received. Before that, we combine them into daily totals, and any value
reported by fewer than 10 summaries in a period is merged into "other" so that
no rare combination stands out. We keep those totals, which contain no
individual summaries, and we may publish them in the game's public code
repository.

**Who processes it.** Cloudflare, Inc. runs the service for us under its data
processing terms. See [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/).

**How to turn it off.** Any of these stops all play stats immediately:

- switch off "Share anonymous play stats" in Settings
- turn on Global Privacy Control or Do Not Track in your browser (web version
  only); the game treats either as a request to send nothing
- open the web version with `?telemetry=off` at the end of the address

When it is off, the game makes no requests to our stats service at all.

Because the summaries carry no identifier, we cannot find, show, or delete
"your" summaries: there is no way to tell which ones came from you. This is on
purpose.

## 4. Children

Darling Blades is made for players aged 13 and over, and it is not directed
at children under 13. Play stats summaries contain no name, identifier, or
other personal information, so we cannot tell a child's summary from anyone
else's, and we treat every one the same way. If you believe a child
under 13 has given us personal information, contact BladeDarlings@gmail.com and we
will delete it.

## 5. Your rights

Depending on where you live (for example under the GDPR in the EU and UK, or
the CCPA in California), you may have the right to access, correct, delete, or
receive a copy of personal information about you, to object to or restrict
how it is used, and to complain to your local data protection authority.

- **Play stats** carry no identifier, so there is nothing we can link to you,
  look up, or delete. You can stop them at any time as described in 3.3.
- **Your save** is only on your device, so you control it completely.

We do not sell or share personal information as the CCPA defines those terms,
and we honour Global Privacy Control as an opt-out signal.

To use any right, or to ask a question, email BladeDarlings@gmail.com. We will reply
within 30 days.

## 6. International transfers

Cloudflare and GitHub are based in the United States and may process
information there. They protect transfers from the EU and UK under the EU-US
Data Privacy Framework and standard contractual clauses.
<!-- RE-VERIFY both vendors' transfer mechanisms at wave T0. -->

## 7. Security

The game's source code is public, so anyone can check what it sends. Play
stats are sent over an encrypted connection and never with cookies or
sign-in details.

## 8. Changes to this policy

If we change this policy, we will update the effective date above. If a change
affects what the game sends, the game will tell you the next time you open it,
before anything new is sent. Past versions are kept in the game's public code
history.

## 9. Contact

[OPERATOR NAME] · BladeDarlings@gmail.com
