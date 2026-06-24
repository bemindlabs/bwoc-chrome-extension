// Persistence. The non-extractable Ed25519 private key is a CryptoKey — it can't
// be JSON-serialized, so it lives in IndexedDB (structured-clone). Everything else
// (controller id, public key hex, host list) is plain config in chrome.storage.local.

import type { HostConfig } from "../shared/types";

const DB_NAME = "bwoc-ext";
const STORE = "keys";
const KEY_ID = "controller-private-key";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbReq<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const r = fn(tx.objectStore(STORE));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

export async function loadPrivateKey(): Promise<CryptoKey | null> {
  const k = await idbReq<CryptoKey | undefined>("readonly", (s) => s.get(KEY_ID));
  return k ?? null;
}

export async function savePrivateKey(key: CryptoKey): Promise<void> {
  await idbReq("readwrite", (s) => s.put(key, KEY_ID));
}

// ── chrome.storage.local config ───────────────────────────────────────────────

export type Config = {
  controllerId: string | null;
  publicKeyHex: string | null;
  hosts: HostConfig[];
  activeHostUrl: string | null;
};

const DEFAULT_CONFIG: Config = {
  controllerId: null,
  publicKeyHex: null,
  hosts: [{ name: "local", baseUrl: "http://127.0.0.1:10130" }],
  activeHostUrl: "http://127.0.0.1:10130",
};

export async function getConfig(): Promise<Config> {
  const got = (await chrome.storage.local.get("config")) as { config?: Partial<Config> };
  return { ...DEFAULT_CONFIG, ...(got.config ?? {}) };
}

export async function setConfig(patch: Partial<Config>): Promise<Config> {
  const next = { ...(await getConfig()), ...patch };
  await chrome.storage.local.set({ config: next });
  return next;
}
