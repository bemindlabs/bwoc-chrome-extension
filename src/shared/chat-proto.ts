// TS mirror of bwoc_core::chat_proto (bwoc-framework/crates/bwoc-core/src/chat_proto.rs).
// Internally-tagged on `type`. Unknown variants must be ignored (forward-compatible) —
// the harness already skips unknown ChatInput, and clients should skip unknown ChatEvent.
// Used by the P3 streaming chat; defined here so the wire contract lives in one place.

export type ChatEvent =
  | { type: "ready"; agent: string; model: string; backend: string; tools: string[] }
  | { type: "token"; text: string }
  | { type: "message"; text: string }
  | { type: "tool_call"; id: string; name: string; args: unknown }
  | { type: "tool_result"; id: string; name: string; ok: boolean; output: string }
  | { type: "permission_request"; id: string; tool: string; detail: string }
  | { type: "mode_changed"; mode: string }
  | { type: "turn_end"; prompt_tokens?: number; completion_tokens?: number }
  | { type: "team_message"; from: string; text: string; ts: string }
  | { type: "compacted"; removed: number }
  | { type: "error"; message: string }
  | { type: "bye" }
  // bwocd wrapper frame (not from the harness): the session handle for /chat/input.
  | { type: "session"; session_id: string };

export type ChatInput =
  | { type: "user"; text: string; principal?: string }
  | { type: "permission"; id: string; allow: boolean }
  | { type: "set_mode"; mode: "default" | "accept_edits" | "bypass" | "plan" }
  | { type: "forget" }
  | { type: "quit" };
