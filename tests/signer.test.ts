import { beforeEach, describe, expect, it } from "vitest";
import { installChrome } from "./helpers/chrome";
import { buildSignedHeaders, ensureIdentity } from "../src/background/signer";
import { loadPrivateKey, getConfig } from "../src/background/store";
import { signingPayload, toHex } from "../src/background/canonical";

const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)));

beforeEach(() => {
  installChrome();
});

describe("ensureIdentity", () => {
  it("generates an id and 32-byte public key, persists them", async () => {
    const id = await ensureIdentity();
    expect(id.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(id.controllerId).toBe(`ext-${id.publicKeyHex.slice(0, 8)}`);
    const cfg = await getConfig();
    expect(cfg.controllerId).toBe(id.controllerId);
    expect(cfg.publicKeyHex).toBe(id.publicKeyHex);
  });

  it("is idempotent", async () => {
    const a = await ensureIdentity();
    const b = await ensureIdentity();
    expect(b).toEqual(a);
  });

  it("keeps an operator-chosen controllerId", async () => {
    const { setConfig } = await import("../src/background/store");
    await setConfig({ controllerId: "custom-id" });
    expect((await ensureIdentity()).controllerId).toBe("custom-id");
  });
});

describe("private key", () => {
  it("is a non-extractable Ed25519 sign key and cannot be exported", async () => {
    await ensureIdentity();
    const key = (await loadPrivateKey())!;
    expect(key.algorithm.name).toBe("Ed25519");
    expect(key.extractable).toBe(false);
    expect(key.usages).toEqual(["sign"]);
    await expect(crypto.subtle.exportKey("pkcs8", key)).rejects.toThrow();
    await expect(crypto.subtle.exportKey("jwk", key)).rejects.toThrow();
  });
});

describe("buildSignedHeaders", () => {
  it("emits the five X-BWOC-* headers and the signature verifies against the public key", async () => {
    const { controllerId, publicKeyHex } = await ensureIdentity();
    const body = new TextEncoder().encode('{"a":1}');
    const h = await buildSignedHeaders("post", "/cli?x=1", body);

    expect(Object.keys(h).sort()).toEqual([
      "X-BWOC-Agent",
      "X-BWOC-Body-SHA256",
      "X-BWOC-Nonce",
      "X-BWOC-Signature",
      "X-BWOC-Timestamp",
    ]);
    expect(h["X-BWOC-Agent"]).toBe(controllerId);
    expect(h["X-BWOC-Nonce"]).toMatch(/^[0-9a-f]{32}$/);
    expect(new Date(h["X-BWOC-Timestamp"]).toISOString()).toBe(h["X-BWOC-Timestamp"]);
    const digest = await crypto.subtle.digest("SHA-256", body);
    expect(h["X-BWOC-Body-SHA256"]).toBe(toHex(new Uint8Array(digest)));

    const pub = await crypto.subtle.importKey("raw", fromHex(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
    const payload = signingPayload(
      controllerId,
      "POST",
      "/cli?x=1",
      h["X-BWOC-Nonce"],
      h["X-BWOC-Timestamp"],
      h["X-BWOC-Body-SHA256"],
    );
    const sig = fromHex(h["X-BWOC-Signature"]);
    expect(sig.length).toBe(64);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, pub, sig, new TextEncoder().encode(payload))).toBe(true);
    // tampering with the path invalidates it
    const bad = signingPayload(controllerId, "POST", "/other", h["X-BWOC-Nonce"], h["X-BWOC-Timestamp"], h["X-BWOC-Body-SHA256"]);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, pub, sig, new TextEncoder().encode(bad))).toBe(false);
  });

  it("uses a fresh nonce per request", async () => {
    const a = await buildSignedHeaders("GET", "/fleet", new Uint8Array(0));
    const b = await buildSignedHeaders("GET", "/fleet", new Uint8Array(0));
    expect(a["X-BWOC-Nonce"]).not.toBe(b["X-BWOC-Nonce"]);
  });
});
