# Changelog

All notable changes to the BWOC Chrome extension are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-14

### Added

- **Pinned extension id** (`domnbaocpijnohbchnaoclndapioomgd`) via a manifest `key`, so
  bwocd's `--cors-origin` is fixed; derivation steps in the README.
- **Release workflow**: tags `v*` run typecheck/test/build and attach
  `bwoc-chrome-extension-<tag>.zip` + sha256 to the GitHub Release.
- **P2 first slice — command palette** (`Palette` tab, `Ctrl/Cmd+K`): accessible
  (dialog/combobox/listbox roles, focus trap, `aria-activedescendant`) searchable list over a
  typed verb registry (`src/shared/verbs.ts`) of 13 read verbs and 2 mutations, run through the
  signed `api.cli()`. Results render as table/tree with a raw-JSON toggle and copy; errors show
  cause + remedy.
- Capability gating (`src/shared/capabilities.ts`): mutations are disabled without the `write`
  cap and require an explicit confirm dialog showing the exact argv; never auto-run.
- Tests for registry well-formedness, argv building, capability gating and result parsing.

### Changed

- **Request robustness** (`api.ts`): every fetch has an abort timeout (default 15 s,
  per-call override; `cli()` uses its `timeoutSecs` + 5 s margin); idempotent GETs retry
  once on network error/timeout/5xx (signed mutations never retry); errors name the
  host and the remedy. Signing contract unchanged.
- `api.cli()` response type now matches bwocd (`ok`, `exit_code`, `stdout`, `stderr`, `tier`)
  instead of a non-existent `json` field; callers parse `stdout`.

### Fixed

- **Request timeout now covers the response body.** The abort timer was cleared as soon
  as `fetch` resolved (headers), so a daemon that stalled mid-body hung the call forever.
- **Ctrl/Cmd+K no longer opens the search dialog on top of a pending confirmation**, which
  stacked two modal focus traps.


## [0.1.0] - 2026-07-27

First release — **P1: read-only fleet over signed HTTP**.

### Added

- **MV3 extension** (Vite + React 19 + `@crxjs/vite-plugin`): side panel (Fleet +
  Agent detail), popup (health glance + open side panel), options (host config,
  identity, enrollment).
- **Per-device Ed25519 identity** via WebCrypto (`extractable: false`) — the private
  key never leaves the browser; the public key + controller id are stored in
  `chrome.storage`, the key handle in IndexedDB.
- **Signed bwocd client** (`api.ts`) mirroring the `cc-signing` wire contract
  byte-for-byte (`canonical.ts`), with a **golden-vector test** (`tests/canonical.test.ts`)
  as the drift guard against the Rust verifier.
- **Enrollment flow**: self-signed `POST /enroll` from the options page, then poll
  `/whoami` for operator approval + granted capabilities.
- **Capability-aware UI**: caps from `/whoami` shown as badges; Palette/Chat tabs
  stubbed for P2/P3.

### Requires
- `bwocd` started with `--cors-origin chrome-extension://<id>` (this PR's companion
  bwocd change). The options page shows the exact flag to run.

[Unreleased]: https://github.com/bemindlabs/bwoc-chrome-extension/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/bemindlabs/bwoc-chrome-extension/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/bemindlabs/bwoc-chrome-extension/releases/tag/v0.1.0
