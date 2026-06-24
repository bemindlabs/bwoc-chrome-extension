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

1. **Build + load:**
   ```bash
   pnpm install && pnpm build
   ```
   Chrome → `chrome://extensions` → enable Developer mode → *Load unpacked* → pick `dist/`.

2. **Run bwocd allowing this extension's origin** (the options page shows the exact id):
   ```bash
   bwocd --workspace <ws> --cors-origin chrome-extension://<your-extension-id>
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

### Pinning the extension ID

The `--cors-origin` the operator configures depends on the extension ID. For a stable ID,
add a `key` to `manifest.config.ts` (a base64 public key) — see
[Chrome docs](https://developer.chrome.com/docs/extensions/reference/manifest/key). Until
then the ID is assigned per unpacked load.

## Requirements

- Chrome 137+ (WebCrypto Ed25519)
- A reachable `bwocd` (see [bwoc-control-center](https://github.com/bemindlabs/bwoc-control-center))
- Node 20+ / pnpm 10 to build

## License

[MIT](./LICENSE) © 2026 Bemind Technology
