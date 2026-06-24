# Changelog

All notable changes to the BWOC Chrome extension are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-24

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

[0.1.0]: https://github.com/bemindlabs/bwoc-chrome-extension/releases/tag/v0.1.0
