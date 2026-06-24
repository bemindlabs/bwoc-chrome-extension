// Typed bwocd client. Every call is ed25519-signed via signer.ts. All extension
// pages share the origin (and thus IndexedDB/the CryptoKey), so this module runs
// directly in the UI — no worker round-trip needed, and the non-extractable key
// still can't be exfiltrated.

import { buildSignedHeaders, ensureIdentity } from "./signer";
import { canonicalPath } from "./canonical";
import { getConfig } from "./store";
import type { FleetSnapshot, AgentEntry, HostInfo, WhoAmI } from "../shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const enc = new TextEncoder();

async function baseUrl(): Promise<string> {
  const cfg = await getConfig();
  if (!cfg.activeHostUrl) throw new ApiError(0, "no active host configured");
  return cfg.activeHostUrl.replace(/\/$/, "");
}

/** Signed request. `path` may include a query string; it is canonicalized for signing. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = await baseUrl();
  const [pathname, query] = path.split("?", 2);
  const canonical = canonicalPath(pathname, query ?? null);
  const bodyBytes = body === undefined ? new Uint8Array(0) : enc.encode(JSON.stringify(body));
  const signed = await buildSignedHeaders(method, canonical, bodyBytes);
  const headers: Record<string, string> = { ...signed };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : (bodyBytes as BufferSource),
    });
  } catch (e) {
    throw new ApiError(0, `network error: ${(e as Error).message}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  // /health and a few routes return JSON; tolerate empty bodies.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  health: () => request<{ ok: boolean }>("GET", "/health"),
  whoami: () => request<WhoAmI>("GET", "/whoami"),
  hosts: () => request<HostInfo>("GET", "/hosts"),
  fleet: () => request<FleetSnapshot>("GET", "/fleet"),
  agent: (id: string) => request<AgentEntry>("GET", `/agents/${id}`),
  agentStatus: (id: string) => request<unknown>("GET", `/agents/${id}/status`),
  agentInbox: (id: string) => request<unknown>("GET", `/agents/${id}/inbox`),

  /** Self-signed enrollment: register this install's public key as pending. */
  async enroll(): Promise<{ status: number; message: string }> {
    const { controllerId, publicKeyHex } = await ensureIdentity();
    try {
      await request<null>("POST", "/enroll", { id: controllerId, public_key: publicKeyHex });
      return { status: 202, message: "enrollment requested — awaiting operator approval" };
    } catch (e) {
      if (e instanceof ApiError) return { status: e.status, message: e.message };
      throw e;
    }
  },

  // P2: generic gated CLI proxy. Stubbed here so the client surface is stable.
  cli: (argv: string[], timeoutSecs?: number) =>
    request<{ ok: boolean; json: unknown; tier: string }>("POST", "/cli", {
      argv,
      timeout_secs: timeoutSecs,
    }),
};
