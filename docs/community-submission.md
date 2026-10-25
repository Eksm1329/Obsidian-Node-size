# Community directory submission

Status: prepared, **not submitted or approved**.

## Submission details

- Repository: https://github.com/Eksm1329/Obsidian-Node-size
- Name: Folder Node Size
- ID: `folder-node-size`
- Current release: [1.0.4](https://github.com/Eksm1329/Obsidian-Node-size/releases/tag/1.0.4)
- Description: Set graph node sizes by folder, with subfolder rules and per-note exceptions.
- Maintainer: Eksm1329; original Node Factor contributor: CalfMoon.
- License: MIT; original copyright and license are retained.
- Platforms: desktop and mobile (`isDesktopOnly: false`); user reports from MacBook and iPhone are recorded in the README.
- Release attachments verified: `main.js`, `manifest.json`, `styles.css`.
- Validation for 1.0.4: 47 automated tests, lint and build passed; 540 before/after benchmark samples preserve matching sizes.

## Distinct functionality and implementation disclosures

This is a fork of [Node Factor](https://github.com/calfmoon/node-factor), based on commit `b04d2e77c9d4434f6971778f0ff5a28b6c4f00cd`. It adds folder-wide rules, optional subfolders, deepest-folder precedence, per-note exceptions, rename handling, and incremental scheduled calculations. It retains upstream code and must be assessed as a fork.

It uses Obsidian's internal graph renderer. Shape guards, cancellation and restoration reduce compatibility risks but cannot guarantee compatibility with future Obsidian changes. The runtime has no network calls, telemetry, payment or account requirements, and does not modify note contents.

## Required before submission

The current [developer policies](https://docs.obsidian.md/Developer+policies) require a fork to have either:

1. Explicit written approval from the original author, publicly verifiable; or
2. Proof the original author is unreachable and the project has not been updated for at least six months, followed by contacting the author and allowing 30 days for public acknowledgment.

No evidence satisfying either route is recorded in this repository. MIT redistribution permission is not evidence of separate approval under the directory's fork policy. Preserve attribution in either case. Do not claim compliance or submit as an independently written plugin while this is unresolved.

Suggested request to the upstream author (draft only; **not sent**):

> Hi CalfMoon, I maintain Folder Node Size, an MIT-licensed fork of Node Factor: https://github.com/Eksm1329/Obsidian-Node-size. It adds folder-wide node sizes, subfolder rules and per-note exceptions, with desktop/mobile support. Your original copyright, license and attribution are retained. May I have your explicit permission to publish this fork in the Obsidian Community directory under the name Folder Node Size? Obsidian's fork policy requires publicly verifiable approval, so a reply here would let us link to it in our submission. Thank you.

## Current submission process

The [official submission guide](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin) now directs authors to the Community directory, rather than a pull request adding an entry to `community-plugins.json`.

After resolving the fork requirement:

1. Sign in at https://community.obsidian.md with the maintainer's Obsidian account.
2. Connect the GitHub account that owns the repository.
3. Open **Plugins → New plugin** and enter the repository URL above; choose the appropriate owner.
4. Review the developer policies and maintenance commitment, then submit.
5. Address the automated review's findings and publish when eligible. Record the actual listing/submission link here once it exists.

Submission requires an authenticated Obsidian account and GitHub ownership verification. No authenticated directory session is available in the coding environment. Do not treat the existing GitHub release or this preparation document as a completed directory submission.
