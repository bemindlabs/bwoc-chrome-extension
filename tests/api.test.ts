import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChrome } from "./helpers/chrome";
import { json, mockFetch } from "./helpers/fetch";
import { api, ApiError } from "../src/background/api";
import { getConfig, setConfig } from "../src/background/store";
import { signingPayload, toHex } from "../src/background/canonical";

const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)));
const hdr = (init: RequestInit) => init.headers as Record<string, string>;

beforeEach(() => {
  installChrome();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request building", () => {
  it("GETs base+path from the active host, trimming a trailing slash, with no body/content-type", async () => {
    await setConfig({ activeHostUrl: "https://h.ts.net/" });
    const { calls } = mockFetch(() => json({ ok: true }));
    expect(await api.health()).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://h.ts.net/health");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.body).toBeUndefined();
    expect(hdr(calls[0].init)["Content-Type"]).toBeUndefined();
  });

  it.each([
    ["whoami", () => api.whoami(), "/whoami"],
    ["hosts", () => api.hosts(), "/hosts"],
    ["fleet", () => api.fleet(), "/fleet"],
    ["agent", () => api.agent("agent-x"), "/agents/agent-x"],
    ["agentStatus", () => api.agentStatus("agent-x"), "/agents/agent-x/status"],
    ["agentInbox", () => api.agentInbox("agent-x"), "/agents/agent-x/inbox"],
  ])("%s hits %s", async (_n, call, path) => {
    const { calls } = mockFetch(() => json({}));
    await call();
    expect(new URL(calls[0].url).pathname).toBe(path);
    expect(calls[0].init.method).toBe("GET");
  });

  it("sends all X-BWOC-* headers and the signature verifies with the stored public key", async () => {
    const { calls } = mockFetch(() => json({}));
    await api.fleet();
    const h = hdr(calls[0].init);
    for (const k of ["X-BWOC-Agent", "X-BWOC-Nonce", "X-BWOC-Timestamp", "X-BWOC-Body-SHA256", "X-BWOC-Signature"]) {
      expect(h[k], k).toBeTruthy();
    }
    // empty-body hash for GET
    expect(h["X-BWOC-Body-SHA256"]).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    const cfg = await getConfig();
    expect(h["X-BWOC-Agent"]).toBe(cfg.controllerId);
    const pub = await crypto.subtle.importKey("raw", fromHex(cfg.publicKeyHex!), { name: "Ed25519" }, false, ["verify"]);
    const payload = signingPayload(h["X-BWOC-Agent"], "GET", "/fleet", h["X-BWOC-Nonce"], h["X-BWOC-Timestamp"], h["X-BWOC-Body-SHA256"]);
    expect(
      await crypto.subtle.verify({ name: "Ed25519" }, pub, fromHex(h["X-BWOC-Signature"]), new TextEncoder().encode(payload)),
    ).toBe(true);
  });

  it("signs the canonicalized (sorted) query but sends the original path", async () => {
    const { calls } = mockFetch(() => json({}));
    await api.agent("a?z=2&a=1");
    const h = hdr(calls[0].init);
    expect(calls[0].url.endsWith("/agents/a?z=2&a=1")).toBe(true);
    const cfg = await getConfig();
    const pub = await crypto.subtle.importKey("raw", fromHex(cfg.publicKeyHex!), { name: "Ed25519" }, false, ["verify"]);
    const payload = signingPayload(h["X-BWOC-Agent"], "GET", "/agents/a?a=1&z=2", h["X-BWOC-Nonce"], h["X-BWOC-Timestamp"], h["X-BWOC-Body-SHA256"]);
    expect(
      await crypto.subtle.verify({ name: "Ed25519" }, pub, fromHex(h["X-BWOC-Signature"]), new TextEncoder().encode(payload)),
    ).toBe(true);
  });

  it("cli() POSTs argv + timeout_secs as JSON, with Content-Type and a body hash over the exact bytes", async () => {
    const { calls } = mockFetch(() => json({ ok: true, json: { x: 1 }, tier: "read" }));
    const res = await api.cli(["fleet", "health", "--json"], 30);
    expect(res).toEqual({ ok: true, json: { x: 1 }, tier: "read" });
    const c = calls[0];
    expect(c.url).toBe("http://127.0.0.1:10130/cli");
    expect(c.init.method).toBe("POST");
    expect(hdr(c.init)["Content-Type"]).toBe("application/json");
    const bytes = c.init.body as Uint8Array;
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({ argv: ["fleet", "health", "--json"], timeout_secs: 30 });
    const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
    expect(hdr(c.init)["X-BWOC-Body-SHA256"]).toBe(toHex(new Uint8Array(digest)));
  });

  it("cli() omits timeout_secs when not given", async () => {
    const { calls } = mockFetch(() => json({}));
    await api.cli(["list"]);
    expect(JSON.parse(new TextDecoder().decode(calls[0].init.body as Uint8Array))).toEqual({ argv: ["list"] });
  });

  it("tolerates an empty 200 body (returns null)", async () => {
    mockFetch(() => new Response("", { status: 200 }));
    expect(await api.health()).toBeNull();
  });
});

describe("errors", () => {
  it("throws ApiError(0, 'no active host configured') without a host", async () => {
    await setConfig({ activeHostUrl: null });
    const { calls } = mockFetch(() => json({}));
    await expect(api.fleet()).rejects.toMatchObject({ status: 0, message: "no active host configured" });
    expect(calls).toHaveLength(0);
  });

  it("maps a network failure to ApiError(0) naming the host, cause and remedy", async () => {
    mockFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const err = await api.fleet().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/bwocd unreachable at .*\(Failed to fetch\).*--cors-origin/);
  });

  it("uses the response text as the message on HTTP errors", async () => {
    mockFetch(() => new Response("bad signature", { status: 401, statusText: "Unauthorized" }));
    const err = await api.whoami().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, message: "bad signature" });
  });

  it("falls back to statusText when the error body is empty", async () => {
    mockFetch(() => new Response("", { status: 403, statusText: "Forbidden" }));
    expect(await api.fleet().catch((e) => e)).toMatchObject({ status: 403, message: "Forbidden" });
  });
});

describe("timeout", () => {
  /** A response whose headers arrive at once but whose body stalls until the request is aborted. */
  const stalledBody = (init: RequestInit, status = 200) =>
    new Response(
      new ReadableStream({
        start(controller) {
          init.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      }),
      { status },
    );

  it("covers the body read, not just the headers", async () => {
    const { calls } = mockFetch((_url, init) => stalledBody(init));
    const err = await api.health({ timeoutMs: 20 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/GET \/health timed out/);
    expect(calls).toHaveLength(2); // a timed-out GET is retried once, like any other
  });

  it("times out a stalled error body instead of reporting an empty one", async () => {
    mockFetch((_url, init) => stalledBody(init, 503));
    const err = await api.fleet({ timeoutMs: 20 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/GET \/fleet timed out/);
  });
});

describe("enroll", () => {
  it("POSTs the id and public key, reporting 202 on success", async () => {
    const { calls } = mockFetch(() => new Response("", { status: 202 }));
    const r = await api.enroll();
    expect(r).toEqual({ status: 202, message: "enrollment requested — awaiting operator approval" });
    const cfg = await getConfig();
    expect(calls[0].url.endsWith("/enroll")).toBe(true);
    expect(JSON.parse(new TextDecoder().decode(calls[0].init.body as Uint8Array))).toEqual({
      id: cfg.controllerId,
      public_key: cfg.publicKeyHex,
    });
  });

  it("returns {status,message} for an ApiError instead of throwing", async () => {
    mockFetch(() => new Response("already pending", { status: 409 }));
    expect(await api.enroll()).toEqual({ status: 409, message: "already pending" });
  });

  it("returns status 0 for a network error", async () => {
    mockFetch(() => {
      throw new Error("down");
    });
    const r = await api.enroll();
    expect(r.status).toBe(0);
    expect(r.message).toMatch(/bwocd unreachable at .*\(down\).*--cors-origin/);
  });
});
