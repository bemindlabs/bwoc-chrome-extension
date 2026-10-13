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

const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_BACKOFF_MS = 400;
/** Margin on top of a CLI call's own timeout, for the daemon round-trip. */
const CLI_MARGIN_MS = 5_000;

interface RequestOpts {
  /** Abort the fetch after this many ms (default 15 s). */
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function hostOf(base: string): string {
  try {
    return new URL(base).host;
  } catch {
    return base;
  }
}

/** One signed attempt. Signing is redone per attempt so the timestamp/nonce stay fresh. */
async function attempt<T>(
  base: string,
  method: string,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const [pathname, query] = path.split("?", 2);
  const canonical = canonicalPath(pathname, query ?? null);
  const bodyBytes = body === undefined ? new Uint8Array(0) : enc.encode(JSON.stringify(body));
  const signed = await buildSignedHeaders(method, canonical, bodyBytes);
  const headers: Record<string, string> = { ...signed };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  let text: string;
  try {
    res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : (bodyBytes as BufferSource),
      signal: ctrl.signal,
    });
    // Read the body while the timer is still armed: fetch resolves on headers, so a
    // daemon that stalls mid-body would otherwise hang this call with no timeout.
    const response = res;
    text = await response.text().catch((e: unknown) => {
      // An unreadable *error* body still has a usable status; anything else is a failure.
      if (ctrl.signal.aborted || response.ok) throw e;
      return "";
    });
  } catch (e) {
    const host = hostOf(base);
    if (ctrl.signal.aborted) {
      throw new ApiError(
        0,
        `${method} ${pathname} timed out after ${Math.round(timeoutMs / 1000)}s waiting for bwocd at ${host}: check the daemon is running and the host is reachable (tailscale up?)`,
      );
    }
    throw new ApiError(
      0,
      `bwocd unreachable at ${host} (${(e as Error).message}): start it with --cors-origin chrome-extension://${typeof chrome !== "undefined" ? chrome.runtime?.id : "<id>"}, or check the host URL in options`,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ApiError(res.status, text || res.statusText);
  // /health and a few routes return JSON; tolerate empty bodies.
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Signed request. `path` may include a query string; it is canonicalized for signing.
 * Idempotent GETs get one retry (short backoff) on network error/timeout or 5xx;
 * mutations are never retried.
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOpts = {},
): Promise<T> {
  const base = await baseUrl();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    return await attempt<T>(base, method, path, body, timeoutMs);
  } catch (e) {
    const retryable = e instanceof ApiError && (e.status === 0 || e.status >= 500);
    if (method !== "GET" || !retryable) throw e;
    await sleep(RETRY_BACKOFF_MS);
    return attempt<T>(base, method, path, body, timeoutMs);
  }
}

export const api = {
  // Every GET accepts optional per-call { timeoutMs } (default 15 s).
  health: (o?: RequestOpts) => request<{ ok: boolean }>("GET", "/health", undefined, o),
  whoami: (o?: RequestOpts) => request<WhoAmI>("GET", "/whoami", undefined, o),
  hosts: (o?: RequestOpts) => request<HostInfo>("GET", "/hosts", undefined, o),
  fleet: (o?: RequestOpts) => request<FleetSnapshot>("GET", "/fleet", undefined, o),
  agent: (id: string, o?: RequestOpts) => request<AgentEntry>("GET", `/agents/${id}`, undefined, o),
  agentStatus: (id: string, o?: RequestOpts) => request<unknown>("GET", `/agents/${id}/status`, undefined, o),
  agentInbox: (id: string, o?: RequestOpts) => request<unknown>("GET", `/agents/${id}/inbox`, undefined, o),

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

  /** Gated `/cli` proxy. bwocd returns the raw process result; callers parse `stdout`. */
  cli: (argv: string[], timeoutSecs?: number) =>
    request<{ ok: boolean; exit_code: number; stdout: string; stderr: string; tier: string }>(
      "POST",
      "/cli",
      { argv, timeout_secs: timeoutSecs },
      timeoutSecs === undefined
        ? undefined
        : { timeoutMs: timeoutSecs * 1000 + CLI_MARGIN_MS },
    ),
};
