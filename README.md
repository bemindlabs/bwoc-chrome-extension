<div align="center">

# 🛰️ bwoc-chrome-extension

**Operate your whole BWOC agent fleet from the browser.**

A Chrome (MV3) extension that drives the [`bwocd`](https://github.com/bemindlabs/bwoc-control-center)
control daemon over ed25519-signed requests — fleet dashboard, agent detail, (soon) a
command palette over every `bwoc --json` verb and live streaming chat. Local or over the
tailnet.

[![CI](https://github.com/bemindlabs/bwoc-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/bemindlabs/bwoc-chrome-extension/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

## How it works

A browser extension can't exec the `bwoc` CLI, so it talks to **`bwocd`** — the BWOC
control daemon (loopback `:10130`, exposed over the tailnet via `tailscale serve`). Every
request is **ed25519-signed** with a per-device key; the extension is just another
*controller* alongside the desktop control-center app, reusing the same `cc-signing` wire
contract.

```
side panel / popup / options ──signed HTTPS──▶ bwocd :10130 ──▶ bwoc … --json
   (React 19, WebCrypto Ed25519)              (CORS + /whoami + caps)
```

The private key is generated **non-extractable** in WebCrypto — it never leaves the
browser and can't be backed up; each install is its own controller identity that
self-enrolls and is approved by the operator with chosen capabilities.

## Setup

1. **Build + load** (or [install from a release zip](#install-from-release-zip)):
   ```bash
   pnpm install && pnpm build
   ```
   Chrome → `chrome://extensions` → enable Developer mode → *Load unpacked* → pick `dist/`.

2. **Run bwocd allowing this extension's origin.** The extension id is pinned, so it is
   the same for everyone:
   ```bash
   bwocd --workspace <ws> --cors-origin chrome-extension://domnbaocpijnohbchnaoclndapioomgd
   ```

3. **Enroll:** open the extension's **options** → *Request enrollment*. Then approve the
   pending controller out-of-band (control-center, or add it to
   `.bwoc/bwocd/controllers.toml` with the caps you want: `read`, `read,write`, …).

4. Open the **side panel** (toolbar icon → *Open side panel*) — the live fleet appears.

## Status — phased

| Phase | Scope | State |
| --- | --- | --- |
| **P1** | Read-only fleet dashboard + agent detail over signed HTTP | ✅ this release |
| P2 | Command palette over all ~82 `--json` verbs + capability-gated mutations | planned |
| P3 | Live streaming agent chat (NDJSON `chat_proto`) + permission prompts | planned |
| P4 | Teams/tasks + memory boards | planned |

## Develop

```bash
pnpm dev         # vite dev (HMR)
pnpm typecheck
pnpm test        # golden-vector cc-signing parity test (the drift guard)
pnpm build       # → dist/ (load unpacked)
```

The signing contract (`src/background/canonical.ts`) is **byte-identical** to
[`cc-signing`](https://github.com/bemindlabs/bwoc-control-center/blob/main/cc-signing/src/lib.rs);
`tests/canonical.test.ts` fails if it drifts.

### Install from release zip

Each `v*` tag publishes `bwoc-chrome-extension-<tag>.zip` (+ `.sha256`) on the
[Releases page](https://github.com/bemindlabs/bwoc-chrome-extension/releases).

```bash
sha256sum -c bwoc-chrome-extension-<tag>.zip.sha256
unzip bwoc-chrome-extension-<tag>.zip -d bwoc-chrome-extension
```

Then Chrome → `chrome://extensions` → Developer mode → *Load unpacked* → pick the
unzipped folder. The id is the same as a local build.

### Pinning the extension ID

`manifest.config.ts` carries a `key` (the base64 **public** key, per the
[Chrome docs](https://developer.chrome.com/docs/extensions/reference/manifest/key)), so the
extension id is stable across machines and reloads:

```
domnbaocpijnohbchnaoclndapioomgd
```

Re-derive it from the manifest key (id = first 128 bits of SHA-256 of the DER public
key, hex digits `0-9a-f` mapped to `a-p`):

```bash
grep -A1 'key:' manifest.config.ts | grep -o '"[A-Za-z0-9+/=]*"' | tr -d '"' \
  | base64 -d | sha256sum | head -c32 | tr '0-9a-f' 'a-p'; echo
```

The matching private key is **not** in the repo (it is only needed to sign Chrome Web
Store updates). To mint a new identity: `openssl genrsa -out key.pem 2048`, then
`openssl rsa -in key.pem -pubout -outform DER | base64 -w0` into `key`, and update the id here.

## Requirements

- Chrome 137+ (WebCrypto Ed25519)
- A reachable `bwocd` (see [bwoc-control-center](https://github.com/bemindlabs/bwoc-control-center))
- Node 20+ / pnpm 10 to build

## License

[MIT](./LICENSE) © 2026 Bemind Technology
