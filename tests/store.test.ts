import { beforeEach, describe, expect, it } from "vitest";
import { installChrome, type ChromeMock } from "./helpers/chrome";
import { getConfig, setConfig, loadPrivateKey, savePrivateKey } from "../src/background/store";

let mock: ChromeMock;
beforeEach(() => {
  mock = installChrome();
});

describe("config (chrome.storage.local)", () => {
  it("returns defaults on an empty store", async () => {
    const cfg = await getConfig();
    expect(cfg.controllerId).toBeNull();
    expect(cfg.publicKeyHex).toBeNull();
    expect(cfg.activeHostUrl).toBe("http://127.0.0.1:10130");
    expect(cfg.hosts).toEqual([{ name: "local", baseUrl: "http://127.0.0.1:10130" }]);
  });

  it("round-trips host, hosts and identity fields", async () => {
    await setConfig({
      hosts: [{ name: "tail", baseUrl: "https://h.ts.net" }],
      activeHostUrl: "https://h.ts.net",
      controllerId: "ext-1234",
      publicKeyHex: "ab".repeat(32),
    });
    expect(await getConfig()).toEqual({
      hosts: [{ name: "tail", baseUrl: "https://h.ts.net" }],
      activeHostUrl: "https://h.ts.net",
      controllerId: "ext-1234",
      publicKeyHex: "ab".repeat(32),
    });
    expect(mock.data.config).toBeDefined();
  });

  it("setConfig merges a patch and returns the merged config", async () => {
    await setConfig({ controllerId: "a" });
    const next = await setConfig({ publicKeyHex: "ff" });
    expect(next.controllerId).toBe("a");
    expect(next.publicKeyHex).toBe("ff");
    expect((await getConfig()).controllerId).toBe("a");
  });

  it("fills missing fields from defaults when storage holds a partial config", async () => {
    mock.data.config = { controllerId: "x" };
    const cfg = await getConfig();
    expect(cfg.controllerId).toBe("x");
    expect(cfg.activeHostUrl).toBe("http://127.0.0.1:10130");
  });
});

describe("private key handle (IndexedDB)", () => {
  it("is null before anything is saved", async () => {
    expect(await loadPrivateKey()).toBeNull();
  });

  it("round-trips a non-extractable CryptoKey via structured clone", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"])) as CryptoKeyPair;
    await savePrivateKey(pair.privateKey);
    const loaded = await loadPrivateKey();
    expect(loaded).not.toBeNull();
    expect(loaded!.extractable).toBe(false);
    const data = new TextEncoder().encode("hi");
    const sig = await crypto.subtle.sign({ name: "Ed25519" }, loaded!, data);
    expect(await crypto.subtle.verify({ name: "Ed25519" }, pair.publicKey, sig, data)).toBe(true);
  });
});
