<!-- source-of-truth: .github/workflows/release.yml, scripts/check-release-notes.ts, package.json · last-verified: 2026-08-25 · process doc — re-verify when the release workflow or the notes convention changes -->

# Release notes

One file per release, named for its tag: `v1.6.4.md`, `v1.7.0.md`.

`release.yml` looks for `docs/release-notes/${TAG}.md` when a `v*` tag is
pushed. If it exists, it becomes the opening body of the GitHub Release and the
generated PR list is appended below it. If it does not, the release falls back
to the generated list alone, which is what v1.6.2, v1.6.3 and v1.6.4 shipped
with.

`npm run check-release-notes` fails when `package.json`'s version has no file.
That check runs in `deploy.yml`, so a version bump without notes fails on the
PR. This matters because `release.yml` only runs on a tag push: without the
check, a missing file would surface when the release was already public.

## Writing one

These are player-facing copy, so the standing rules apply:

- **No em-dashes.** The checker enforces this one.
- Lead with what changed for the player, not the internals.
- Say which items came from player reports. People like seeing that.
- Keep the engineering detail for the PR description; the release page is for
  people deciding whether to download.

The generated PR list follows automatically, so do not restate it. Write the
paragraph the list cannot: what this release is *for*.
