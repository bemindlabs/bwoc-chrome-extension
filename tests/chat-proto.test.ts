import { describe, expect, it } from "vitest";
import golden from "./fixtures/chat-proto.golden.json";
import type { ChatEvent, ChatInput } from "../src/shared/chat-proto";

// Compile-time exhaustive: adding/removing a TS variant breaks typecheck here, forcing
// this table (and the fixture) to be updated. Value = required wire keys (besides `type`).
const TS_EVENT_FIELDS: Record<ChatEvent["type"], string[]> = {
  ready: ["agent", "model", "backend", "tools"],
  token: ["text"],
  message: ["text"],
  tool_call: ["id", "name", "args"],
  tool_result: ["id", "name", "ok", "output"],
  permission_request: ["id", "tool", "detail"],
  mode_changed: ["mode"],
  turn_end: [],
  team_message: ["from", "text", "ts"],
  compacted: ["removed"],
  error: ["message"],
  bye: [],
  session: ["session_id"],
};
const TS_INPUT_FIELDS: Record<ChatInput["type"], string[]> = {
  user: ["text"],
  permission: ["id", "allow"],
  set_mode: ["mode"],
  forget: [],
  quit: [],
};

type Frame = { type: string } & Record<string, unknown>;
const events = golden.events as Frame[];
const wrapper = golden.wrapperEvents as Frame[];
const inputs = golden.inputs as Frame[];
const byType = (xs: Frame[]) => new Map(xs.map((x) => [x.type, x]));

/** Known drift: Rust (origin/main) variants the TS mirror lacks, and vice versa. */
const EXPECTED_DRIFT = {
  eventsMissingInTs: [
    "cancelled", "described", "diff", "model_changed", "model_fallback", "restored", "reverted", "thinking",
  ],
  eventsOnlyInTs: ["session"], // bwocd wrapper frame, intentionally not in Rust
  inputsMissingInTs: ["cancel", "compact", "describe", "redo", "set_model", "undo"],
  inputsOnlyInTs: [] as string[],
};

describe("chat protocol golden vectors", () => {
  it("fixture lines survive a JSON line round-trip byte-for-byte", () => {
    for (const f of [...events, ...wrapper, ...inputs]) {
      const line = JSON.stringify(f);
      expect(line).not.toContain("\n");
      expect(JSON.parse(line)).toEqual(f);
    }
  });

  it("every TS ChatEvent variant has a golden vector with the required fields", () => {
    const all = byType([...events, ...wrapper]);
    for (const [type, fields] of Object.entries(TS_EVENT_FIELDS)) {
      const frame = all.get(type);
      expect(frame, `no golden vector for event ${type}`).toBeDefined();
      for (const k of fields) expect(frame, `${type}.${k}`).toHaveProperty(k);
    }
  });

  it("every TS ChatInput variant has a golden vector with the required fields", () => {
    const all = byType(inputs);
    for (const [type, fields] of Object.entries(TS_INPUT_FIELDS)) {
      const frame = all.get(type);
      expect(frame, `no golden vector for input ${type}`).toBeDefined();
      for (const k of fields) expect(frame, `${type}.${k}`).toHaveProperty(k);
    }
  });

  it("documents the drift between the Rust protocol and the TS mirror (fails when either side moves)", () => {
    const tsEvents = Object.keys(TS_EVENT_FIELDS);
    const tsInputs = Object.keys(TS_INPUT_FIELDS);
    const rustEvents = events.map((e) => e.type);
    const rustInputs = inputs.map((e) => e.type);
    expect(rustEvents.filter((t) => !tsEvents.includes(t)).sort()).toEqual(EXPECTED_DRIFT.eventsMissingInTs);
    expect(tsEvents.filter((t) => !rustEvents.includes(t)).sort()).toEqual(EXPECTED_DRIFT.eventsOnlyInTs);
    expect(rustInputs.filter((t) => !tsInputs.includes(t)).sort()).toEqual(EXPECTED_DRIFT.inputsMissingInTs);
    expect(tsInputs.filter((t) => !rustInputs.includes(t)).sort()).toEqual(EXPECTED_DRIFT.inputsOnlyInTs);
  });

  it("documents field-level drift on shared variants", () => {
    const user = byType(inputs).get("user")!;
    // Rust: principal is an object {"kind": ...}; TS mirror declares `principal?: string`.
    expect(typeof user.principal).toBe("object");
    const turnEnd = byType(events).get("turn_end")!;
    // Rust always sends token counts (u64) and an optional cost_usd the TS type omits.
    expect(turnEnd).toHaveProperty("prompt_tokens");
    expect(turnEnd).toHaveProperty("cost_usd");
    // Rust tool_call.args is a JSON *string*; TS says `unknown`.
    expect(typeof byType(events).get("tool_call")!.args).toBe("string");
  });

  it("clients can skip unknown event types (forward compat)", () => {
    const known = new Set(Object.keys(TS_EVENT_FIELDS));
    const handled = [...events, ...wrapper, { type: "from_the_future" }].filter((e) => known.has(e.type));
    expect(handled.map((e) => e.type)).not.toContain("from_the_future");
  });
});
