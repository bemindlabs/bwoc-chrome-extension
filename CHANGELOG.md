# Changelog

All notable changes to the BWOC Chrome extension are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Pinned extension id** (`domnbaocpijnohbchnaoclndapioomgd`) via a manifest `key`, so
  bwocd's `--cors-origin` is fixed; derivation steps in the README.
- **Release workflow**: tags `v*` run typecheck/test/build and attach
  `bwoc-chrome-extension-<tag>.zip` + sha256 to the GitHub Release.

### Changed

- **Request robustness** (`api.ts`): every fetch has an abort timeout (default 15 s,
  per-call override; `cli()` uses its `timeoutSecs` + 5 s margin); idempotent GETs retry
  once on network error/timeout/5xx (signed mutations never retry); errors name the
  host and the remedy. Signing contract unchanged.

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

[Unreleased]: https://github.com/bemindlabs/bwoc-chrome-extension/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bemindlabs/bwoc-chrome-extension/releases/tag/v0.1.0
