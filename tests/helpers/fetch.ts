import { vi } from "vitest";

export type Recorded = { url: string; init: RequestInit };

/** Replace global fetch with a mock. `respond` returns a Response (or throws for network failure). */
export function mockFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Recorded[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const rec = { url: String(url), init: init ?? {} };
    calls.push(rec);
    return respond(rec.url, rec.init);
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
