// Mirrors bwoc-control-center/src/types.ts (the bwocd JSON shapes). Keep in sync.

export type AgentEntry = {
  id: string;
  path: string;
  backend: string;
  incarnated: string;
  status: string;
  running?: boolean;
  inbox_count?: number;
  uptime_seconds?: number | null;
};

/** One Aparihāniya health condition from `bwoc fleet health --json`. */
export type HealthSignal = {
  condition: number;
  name: string;
  finding: string;
  status: string; // "ok" | "info" | "warn"
};

export type FleetSnapshot = {
  workspace: string;
  agents: AgentEntry[] | null;
  health: HealthSignal[] | null;
};

export type HostInfo = {
  hostname: string;
  workspace: string;
  bwocd_version: string | null;
};

/** `GET /whoami` — the calling controller's identity + granted caps. */
export type WhoAmI = {
  controller_id: string;
  caps: Capability[];
  bwocd_version: string;
};

export type Capability = "read" | "write" | "exec" | "dangerous";

/** A configured bwocd endpoint the extension can talk to. */
export type HostConfig = {
  /** Display label. */
  name: string;
  /** Base URL, e.g. http://127.0.0.1:10130 or https://host.tailnet.ts.net */
  baseUrl: string;
};
