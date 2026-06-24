// Ed25519 signing via WebCrypto. The private key is generated non-extractable
// (extractable:false) — it never serializes to bytes in JS and can't be exported
// or backed up. Each install is therefore its own controller identity that must
// self-enroll (POST /enroll) and be approved by the operator with chosen caps.
//
// The signed payload format is owned by canonical.ts (byte-identical to cc-signing);
// here we only do key management + the actual Ed25519 operation + header assembly.

import { signingPayload, sha256Hex, randomNonceHex, toHex } from "./canonical";
import { loadPrivateKey, savePrivateKey, getConfig, setConfig } from "./store";

const ALG = "Ed25519";

export type Identity = { controllerId: string; publicKeyHex: string };

/** Ensure a keypair + controller id exist; generate on first run. Idempotent. */
export async function ensureIdentity(): Promise<Identity> {
  const cfg = await getConfig();
  const existing = await loadPrivateKey();
  if (existing && cfg.controllerId && cfg.publicKeyHex) {
    return { controllerId: cfg.controllerId, publicKeyHex: cfg.publicKeyHex };
  }

  const pair = (await crypto.subtle.generateKey({ name: ALG }, false, [
    "sign",
  ])) as CryptoKeyPair;
  await savePrivateKey(pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const publicKeyHex = toHex(raw);
  // Default controller id derived from the key — operator-overridable in options.
  const controllerId = cfg.controllerId ?? `ext-${publicKeyHex.slice(0, 8)}`;
  await setConfig({ controllerId, publicKeyHex });
  return { controllerId, publicKeyHex };
}

async function sign(payload: string): Promise<string> {
  const key = await loadPrivateKey();
  if (!key) throw new Error("no controller key — run ensureIdentity() first");
  const sig = await crypto.subtle.sign({ name: ALG }, key, new TextEncoder().encode(payload));
  return toHex(new Uint8Array(sig));
}

/**
 * Build the five X-BWOC-* headers for one request. `canonical` must come from
 * canonicalPath(); `body` is the raw request body bytes (empty for GET).
 */
export async function buildSignedHeaders(
  method: string,
  canonical: string,
  body: Uint8Array,
): Promise<Record<string, string>> {
  const { controllerId } = await ensureIdentity();
  const nonce = randomNonceHex();
  const ts = new Date().toISOString();
  const bodyHash = await sha256Hex(body);
  const payload = signingPayload(controllerId, method, canonical, nonce, ts, bodyHash);
  const signature = await sign(payload);
  return {
    "X-BWOC-Agent": controllerId,
    "X-BWOC-Nonce": nonce,
    "X-BWOC-Timestamp": ts,
    "X-BWOC-Body-SHA256": bodyHash,
    "X-BWOC-Signature": signature,
  };
}
