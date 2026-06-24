// Byte-identical port of cc-signing (bwoc-control-center/cc-signing/src/lib.rs).
// The Rust verifier (bwocd) signs/checks over EXACTLY these strings, so any drift
// here breaks auth. The golden-vector test (tests/canonical.test.ts) asserts the
// payload equals cc-signing's literal — do not change this without updating both.

/**
 * The canonical payload both sides sign: a flat JSON object with
 * lexicographically sorted keys and an UPPERCASE method. Built by manual string
 * templating (NOT JSON.stringify) so key order/escaping can never drift from the
 * Rust `format!`.
 */
export function signingPayload(
  sender: string,
  method: string,
  path: string,
  nonce: string,
  ts: string,
  bodyHash: string,
): string {
  const m = method.toUpperCase();
  return `{"bodyHash":"${bodyHash}","method":"${m}","nonce":"${nonce}","path":"${path}","sender":"${sender}","ts":"${ts}"}`;
}

/** Canonical request path: pathname + query entries sorted by key then value. */
export function canonicalPath(path: string, query?: string | null): string {
  if (!query) return path;
  const entries = query
    .split("&")
    .filter((s) => s.length > 0)
    .map((kv): [string, string] => {
      const i = kv.indexOf("=");
      return i === -1 ? [kv, ""] : [kv.slice(0, i), kv.slice(i + 1)];
    });
  // Sort by key, then value — matches Rust's tuple sort (sorts on .0 then .1).
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const qs = entries.map(([k, v]) => `${k}=${v}`).join("&");
  return `${path}?${qs}`;
}

const HEX = "0123456789abcdef";
function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += HEX[b >> 4] + HEX[b & 0x0f];
  return out;
}

/** sha256 hex of a request body (matches cc_signing::sha256_hex). */
export async function sha256Hex(body: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", body as BufferSource);
  return toHex(new Uint8Array(digest));
}

export function randomNonceHex(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return toHex(b);
}

export { toHex };
