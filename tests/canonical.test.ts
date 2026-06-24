import { describe, it, expect } from "vitest";
import { signingPayload, canonicalPath, sha256Hex } from "../src/background/canonical";

// These assertions mirror cc-signing's own unit tests
// (bwoc-control-center/cc-signing/src/lib.rs). If either side changes the payload
// shape, this test (and bwocd auth) must change together — that's the point.
describe("signing payload (cc-signing parity)", () => {
  it("is sorted and method-uppercased — byte-identical to the Rust literal", () => {
    const p = signingPayload("s", "get", "/a?b=1", "n", "t", "h");
    expect(p).toBe('{"bodyHash":"h","method":"GET","nonce":"n","path":"/a?b=1","sender":"s","ts":"t"}');
  });

  it("keeps key order regardless of argument order", () => {
    const p = signingPayload("ctrl-1", "POST", "/cli", "deadbeef", "2026-06-24T00:00:00Z", "abc123");
    // bodyHash, method, nonce, path, sender, ts — lexicographic.
    expect(p).toBe(
      '{"bodyHash":"abc123","method":"POST","nonce":"deadbeef","path":"/cli","sender":"ctrl-1","ts":"2026-06-24T00:00:00Z"}',
    );
  });
});

describe("canonical path (cc-signing parity)", () => {
  it("returns the path unchanged with no query", () => {
    expect(canonicalPath("/fleet", null)).toBe("/fleet");
    expect(canonicalPath("/fleet", undefined)).toBe("/fleet");
  });
  it("sorts query entries by key then value", () => {
    expect(canonicalPath("/a", "z=2&a=1")).toBe("/a?a=1&z=2");
  });
});

describe("sha256Hex", () => {
  it("hashes the empty body to the known SHA-256 of empty input", async () => {
    expect(await sha256Hex(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("WebCrypto Ed25519 round-trip (sanity)", () => {
  it("signs and verifies a payload (same primitive the signer uses)", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const payload = signingPayload("s", "GET", "/fleet", "n", "t", "h");
    const data = new TextEncoder().encode(payload);
    const sig = await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, data);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, pair.publicKey, sig, data)).toBe(true);
    expect(sig.byteLength).toBe(64); // standard ed25519 signature dalek accepts
  });
});
