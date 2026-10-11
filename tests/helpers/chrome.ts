// In-memory chrome.* mock + fresh IndexedDB, installed on globalThis per test.
import { IDBFactory } from "fake-indexeddb";
import { vi } from "vitest";

export type ChromeMock = {
  /** Raw backing store of chrome.storage.local, for assertions. */
  data: Record<string, unknown>;
  openOptionsPage: ReturnType<typeof vi.fn>;
};

/** Install a fresh chrome.storage.local + runtime mock and an empty IndexedDB. */
export function installChrome(): ChromeMock {
  const data: Record<string, unknown> = {};
  const openOptionsPage = vi.fn();

  const local = {
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      if (keys == null) return structuredClone(data);
      const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in data) out[k] = structuredClone(data[k]);
      return out;
    },
    async set(items: Record<string, unknown>) {
      for (const [k, v] of Object.entries(items)) data[k] = structuredClone(v);
    },
    async remove(keys: string | string[]) {
      for (const k of typeof keys === "string" ? [keys] : keys) delete data[k];
    },
    async clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local },
    runtime: { openOptionsPage },
  };
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  return { data, openOptionsPage };
}
