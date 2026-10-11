import { describe, expect, it } from "vitest";
import { VERBS, buildArgv, filterVerbs, formatArgv } from "../src/shared/verbs";

// Verbs bwocd's /cli allowlist maps to `read` / `write` (routes.rs `required_cap_for`).
const READ_PREFIXES = [["list"], ["status"], ["receipts"], ["fleet", "health"], ["fleet", "status"], ["team", "list"], ["task", "list"], ["memory", "list"], ["memory", "show"], ["memory", "search"]];
const WRITE_PREFIXES = [["task", "add"], ["task", "claim"], ["task", "complete"], ["send"], ["outbox", "flush"]];
const startsWith = (argv: string[], p: string[]) => p.every((w, i) => argv[i] === w);

describe("verb registry", () => {
  it("has entries", () => expect(VERBS.length).toBeGreaterThan(0));

  it("every entry is well-formed", () => {
    for (const v of VERBS) {
      expect(v.id, v.id).toMatch(/^[a-z]+(\.[a-z]+)*$/);
      expect(v.title.trim(), v.id).not.toBe("");
      expect(v.description.trim(), v.id).not.toBe("");
      expect(v.argv.length, v.id).toBeGreaterThan(0);
      for (const w of v.argv) expect(w, v.id).toMatch(/^[a-z][a-z-]*$/);
      expect(["read", "mutation"]).toContain(v.kind);
      expect(["read", "write"]).toContain(v.capability);
      const names = new Set<string>();
      for (const a of v.args) {
        expect(names.has(a.name), `${v.id}.${a.name} duplicate`).toBe(false);
        names.add(a.name);
        if (a.kind !== "positional") expect(a.flag, `${v.id}.${a.name}`).toMatch(/^--[a-z-]+$/);
        expect(a.description.trim()).not.toBe("");
      }
    }
  });

  it("has no duplicate ids", () => {
    const ids = VERBS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never exposes --workspace (bwocd pins it) or --no-plan", () => {
    for (const v of VERBS) for (const a of v.args) expect(["--workspace", "-C", "--no-plan"]).not.toContain(a.flag);
  });

  it("kind and capability agree, and match bwocd's allowlist tiers", () => {
    for (const v of VERBS) {
      expect(v.kind === "mutation", v.id).toBe(v.capability === "write");
      const prefixes = v.kind === "mutation" ? WRITE_PREFIXES : READ_PREFIXES;
      expect(prefixes.some((p) => startsWith(v.argv, p)), `${v.id} not in bwocd ${v.kind} allowlist`).toBe(true);
    }
  });

  it("flags mutations (task add/claim) and keeps all others read", () => {
    const m = VERBS.filter((v) => v.kind === "mutation").map((v) => v.id).sort();
    expect(m).toEqual(["task.add", "task.claim"]);
  });
});

describe("buildArgv", () => {
  const get = (id: string) => VERBS.find((v) => v.id === id)!;

  it("appends --json and orders positionals before options", () => {
    const r = buildArgv(get("task.add"), { title: "do x", team: "t1", deps: "a,b" });
    expect(r).toEqual({ ok: true, argv: ["task", "add", "t1", "do x", "--deps", "a,b", "--json"] });
  });

  it("emits required flags without input", () => {
    expect(buildArgv(get("task.list.all"), { state: "pending" })).toEqual({
      ok: true,
      argv: ["task", "list", "--all", "--state", "pending", "--json"],
    });
  });

  it("reports missing required args", () => {
    const r = buildArgv(get("task.claim"), { team: "t1" });
    expect(r.ok).toBe(false);
  });

  it("rejects values that look like flags and invalid choices", () => {
    expect(buildArgv(get("memory.search"), { query: "--workspace=/etc" }).ok).toBe(false);
    expect(buildArgv(get("list"), { status: "bogus" }).ok).toBe(false);
  });

  it("formats argv for display with quoting", () => {
    expect(formatArgv(["task", "add", "t1", "do x", "--json"])).toBe('bwoc task add t1 "do x" --json');
  });
});

describe("filterVerbs", () => {
  it("returns all for empty query and ANDs tokens", () => {
    expect(filterVerbs(VERBS, "  ").length).toBe(VERBS.length);
    const ids = filterVerbs(VERBS, "task list").map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(["task.list", "task.list.all"]));
    expect(ids).not.toContain("fleet.health");
    expect(filterVerbs(VERBS, "zzzz-nothing")).toEqual([]);
  });
});
