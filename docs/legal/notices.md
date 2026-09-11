<!-- source-of-truth: LICENSE, README.md, package.json, src-tauri/Cargo.toml, docs/art-pipeline.md · last-verified: 2026-09-11 · DRAFT legal notices template — not live, not legal advice -->

<!--
DRAFT. Not published.
- Suggested placements: a "Notices" / "About" panel in Settings, the README
  License section, and the desktop installer's license page.
- Player copy rule: no em-dashes, plain sentences.
-->

# Darling Blades Notices

## Not affiliated with Magic: The Gathering

Darling Blades is an independent game. It is not affiliated with, endorsed
by, sponsored by, or approved by Wizards of the Coast LLC or Hasbro, Inc.
Magic: The Gathering is a trademark of Wizards of the Coast LLC, and is
mentioned only to describe the style of game this is.

## Code

Copyright (c) 2026 [OPERATOR NAME]. The source code is released under the MIT
License. See the `LICENSE` file for the full text.

## Art, icons, and name

The illustrated card and scene art, the desktop app icons, and the Darling
Blades name and logo are not covered by the MIT License. All rights reserved.

You are welcome to share screenshots, videos, and streams of the game, and to
make non-commercial fan content about it. For anything else, including
commercial use or using the art in another project, ask first at
BladeDarlings@gmail.com.

<!-- OPTIONAL, owner decision (docs/legal/README.md, decision 2):
The card and scene art was created with the help of AI image generation tools
and then selected, directed, and edited for the game.
-->

## Mythology and history

Many cards draw on myths, legends, and historical figures. They are creative
interpretations and are not meant to represent any real person, belief, or
tradition as it actually is.

## Open-source software

Darling Blades is built with open-source software, including Phaser (MIT
License) and, in the desktop app, Tauri (MIT or Apache 2.0 License). The
fonts Inter and Cinzel are used under the SIL Open Font License 1.1. The full
list of third-party components and their licenses is in
[THIRD-PARTY NOTICES FILE].

The desktop app runs on Microsoft Edge WebView2, a Windows component provided
by Microsoft under its own terms.

<!--
TODO before the next desktop release: generate the third-party notices file.
The NSIS installer redistributes compiled Rust crates, and several licenses
(MIT, Apache 2.0, BSD) require their notice to travel with the binary.
Candidates: `npx license-checker-rseidelsohn --production` for npm, and
`cargo about generate` for src-tauri. Output to a THIRD_PARTY_NOTICES file
bundled with both builds. The OFL fonts in public/assets/fonts/ (Inter,
Cinzel) need their copyright line and the OFL text included in that file;
the OFL requires it for redistribution.
-->
