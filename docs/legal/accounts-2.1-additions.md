<!-- source-of-truth: docs/plan-telemetry-and-accounts.md, docs/rollout-telemetry-and-accounts.md, docs/legal/privacy-policy.md, docs/legal/terms-of-service.md · last-verified: 2026-09-10 · staged legal text for cloud accounts (2.1) — merge into the policy and terms at wave C3, not before -->

# Staged for 2.1: cloud accounts legal text

Not part of the 1.8 documents. This is the text that merges into
[privacy-policy.md](privacy-policy.md) and
[terms-of-service.md](terms-of-service.md) when cloud accounts ship (wave C3).
Re-check every vendor fact here at wave C0 first; see review findings 7 to 10
in [README.md](README.md).

Extra placeholders: `[EMAIL SENDER]`, `[AUTH LOG RETENTION]`,
`[DISPLAY NAME]`, `[INACTIVE PERIOD]`, `[NOTICE]`.

## Privacy policy edits

**Intro:** add "Optional cloud accounts let you keep your save on more than one
device" to the short version, and change "three cases" in section 3 to "four
cases".

**New section 3.4, after 3.3:**

> ### 3.4 Cloud accounts (optional)
>
> You never need an account to play, and an account never unlocks anything. If
> you create one, you can keep your save on more than one device.
>
> **What we store:** your email address, the sign-in method you chose (email
> link, or Discord, Google, or GitHub), your cloud save, when it was last
> synced, and [DISPLAY NAME, if the feature ships]. When you create an account
> we ask for your date of birth to confirm you are 16 or older. We keep only
> the answer "confirmed", never the date.
>
> **What our provider records:** when you sign in, our account provider
> records your IP address and browser type for security, such as spotting
> unusual sign-ins. These records are kept for [AUTH LOG RETENTION].
>
> **Legal basis (GDPR):** providing the service you asked for (Article
> 6(1)(b)), and our legitimate interest in keeping accounts secure (Article
> 6(1)(f)).
>
> **Who processes it:** Supabase, Inc. (accounts and cloud saves, hosted in
> the EU), [EMAIL SENDER] (sends sign-in emails), and, if you sign in with
> one, the provider you chose (Discord, Google, or GitHub), which learns that
> you signed in to Darling Blades.
>
> **Kept apart from play stats:** accounts and play stats run on different
> companies' services and different addresses, and the game never puts
> account information into a play stats summary. Signing in does not change
> what play stats send.
>
> **Managing your account:** from the Cloud panel in the game you can see what
> we hold, change your email, unlink a sign-in method, download your data,
> sign out everywhere, and delete your account. Deleting removes your account
> and your cloud save straight away. It never touches the save on your device.
>
> **How long it is kept:** until you delete the account. [INACTIVE-ACCOUNT
> POLICY, if any.]

**3.3, "What is never sent":** add "an account, email, or sign-in token".

**Section 4 (Children):** add "Cloud accounts are available only to players
aged 16 and over."

**Section 5 (Rights):** add the bullet "**Cloud accounts:** use the Cloud
panel, which lets you do all of the above yourself, or contact us."

**Section 6 (Transfers):** "Cloudflare, GitHub, and Supabase are based in the
United States...", plus [EMAIL SENDER] if it is outside the EU.

**Section 7 (Security):** add "Cloud saves are protected so that each account
can read and write only its own save."

## Terms of service edits

**Intro:** "in the web version, the desktop app, and optional cloud accounts".

**Section 1:** add "You must be at least 16 to create a cloud account."

**New section 6, before "Things you may not do" (renumber after it):**

> ## 6. Cloud accounts (optional)
>
> An account is optional and never unlocks cards, cosmetics, gold,
> achievements, or modes.
>
> - Keep your sign-in email and linked accounts secure. You are responsible
>   for activity on your account.
> - One account per person. Do not create accounts automatically or in bulk.
> - Do not try to access another player's account or save, or to get around
>   the service's limits or security.
> - The service runs on free hosting and may be slow, paused, or unavailable
>   at times. Always keep a save code as a backup.
> - You can delete your account at any time from the Cloud panel. We may
>   suspend or delete an account that breaks these terms, or that has been
>   inactive for [INACTIVE PERIOD], after [NOTICE, if possible]. Deleting an
>   account never touches the save on your device.
> - [DISPLAY NAME RULES, if display names ship: no impersonation, slurs, or
>   personal information about others.]

**Ending these terms:** "You can stop playing at any time, and delete your
account from the Cloud panel." Update the survival clause's section numbers
after renumbering.
