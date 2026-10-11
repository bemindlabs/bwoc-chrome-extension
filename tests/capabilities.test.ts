import { describe, expect, it } from "vitest";
import { VERBS } from "../src/shared/verbs";
import { disabledReason, hasCapability, isVerbEnabled, requiresConfirm } from "../src/shared/capabilities";
import { interpretFailure, interpretResponse } from "../src/shared/cliResult";
import { cellText, toTable } from "../src/shared/jsonview";

const read = VERBS.find((v) => v.kind === "read")!;
const mut = VERBS.find((v) => v.kind === "mutation")!;

describe("capability gating", () => {
  it("read is implicit, write must be granted", () => {
    expect(hasCapability([], "read")).toBe(true);
    expect(hasCapability(["read"], "write")).toBe(false);
    expect(hasCapability(["read", "write"], "write")).toBe(true);
  });

  it("exec/dangerous do not imply write", () => {
    expect(isVerbEnabled(mut, ["read", "exec", "dangerous"])).toBe(false);
  });

  it("disables mutations without write, enables with it", () => {
    expect(isVerbEnabled(mut, ["read"])).toBe(false);
    expect(disabledReason(mut, ["read"])).toMatch(/write/);
    expect(isVerbEnabled(mut, ["read", "write"])).toBe(true);
    expect(disabledReason(mut, ["read", "write"])).toBeNull();
  });

  it("read verbs are always enabled, even with no caps", () => {
    for (const v of VERBS.filter((x) => x.kind === "read")) expect(isVerbEnabled(v, [])).toBe(true);
    expect(disabledReason(read, [])).toBeNull();
  });

  it("only mutations require confirmation", () => {
    for (const v of VERBS) expect(requiresConfirm(v)).toBe(v.kind === "mutation");
  });
});

describe("interpretResponse / interpretFailure", () => {
  it("parses JSON stdout", () => {
    expect(interpretResponse({ ok: true, exit_code: 0, stdout: '{"a":1}\n' })).toMatchObject({ kind: "json", value: { a: 1 } });
  });
  it("non-zero exit gives cause (stderr) + remedy", () => {
    const o = interpretResponse({ ok: false, exit_code: 2, stdout: "", stderr: "no such team" });
    expect(o).toMatchObject({ kind: "error" });
    if (o.kind === "error") {
      expect(o.cause).toContain("no such team");
      expect(o.remedy).not.toBe("");
    }
  });
  it("non-JSON success is an error", () => {
    expect(interpretResponse({ ok: true, stdout: "hello" }).kind).toBe("error");
  });
  it("every transport status maps to a remedy", () => {
    for (const s of [0, 400, 401, 403, 503, 500, 418]) {
      const o = interpretFailure(s, "boom");
      expect(o.kind === "error" && o.remedy.length > 0).toBe(true);
    }
  });
});

describe("jsonview", () => {
  it("tables arrays of objects with a union of columns", () => {
    expect(toTable([{ a: 1 }, { b: 2 }])).toEqual({ columns: ["a", "b"], rows: [{ a: 1 }, { b: 2 }] });
    expect(toTable([])).toBeNull();
    expect(toTable([1, 2])).toBeNull();
    expect(toTable({ a: 1 })).toBeNull();
  });
  it("cellText", () => {
    expect(cellText(null)).toBe("null");
    expect(cellText({ a: 1 })).toBe('{"a":1}');
    expect(cellText(3)).toBe("3");
  });
});
