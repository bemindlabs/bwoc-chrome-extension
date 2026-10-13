// Typed registry of `bwoc` verbs the palette can run through bwocd's `/cli` proxy.
//
// Every entry was verified against the installed CLI (`bwoc <verb> --help`, bwoc 3.14.1):
// the positionals/flags below exist and `--json` is accepted. Verbs are also limited to
// what bwocd's `required_cap_for` allowlist (bwoc-control-center/bwocd/src/routes.rs)
// proxies — anything else would be a 403 "verb not allowed via /cli". Do not add a verb
// without running its `--help` and checking that allowlist.
//
// bwocd does NOT add `--json` for `/cli` (the caller owns the output shape), so
// `buildArgv` always appends it. bwocd pins `--workspace` itself and rejects any
// caller-supplied one, so no verb exposes it.

export type VerbKind = "read" | "mutation";
/** Capability bwocd requires for the verb (`read` is implicit for every controller). */
export type VerbCapability = "read" | "write";

export type ArgSpec = {
  name: string;
  label: string;
  description: string;
  /** positional: bare value in order; option: `--flag value`; flag: `--flag` boolean. */
  kind: "positional" | "option" | "flag";
  /** CLI flag for option/flag kinds, e.g. `--state`. */
  flag?: string;
  required?: boolean;
  choices?: string[];
};

export type Verb = {
  id: string;
  title: string;
  description: string;
  /** Leading subcommand words, e.g. ["task", "list"]. */
  argv: string[];
  args: ArgSpec[];
  kind: VerbKind;
  capability: VerbCapability;
};

const pos = (name: string, description: string, required = true): ArgSpec => ({
  name,
  label: name,
  description,
  kind: "positional",
  required,
});
const opt = (name: string, flag: string, description: string, extra: Partial<ArgSpec> = {}): ArgSpec => ({
  name,
  label: flag,
  description,
  kind: "option",
  flag,
  ...extra,
});
const flag = (name: string, f: string, description: string): ArgSpec => ({
  name,
  label: f,
  description,
  kind: "flag",
  flag: f,
});

const read = (v: Omit<Verb, "kind" | "capability">): Verb => ({ ...v, kind: "read", capability: "read" });
const mutation = (v: Omit<Verb, "kind" | "capability">): Verb => ({ ...v, kind: "mutation", capability: "write" });

export const VERBS: readonly Verb[] = [
  read({
    id: "list",
    title: "List agents",
    description: "Agents registered in the workspace (agents.toml).",
    argv: ["list"],
    args: [
      opt("status", "--status", "Filter by status (exact match)", { choices: ["active", "stopped", "retired"] }),
      opt("backend", "--backend", "Filter by backend (exact match)"),
      flag("running", "--running", "Only agents whose daemon is running"),
      flag("inbox_pending", "--inbox-pending", "Only agents with pending inbox messages"),
      opt("sort", "--sort", "Sort key", { choices: ["id", "inbox", "incarnated", "backend"] }),
    ],
  }),
  read({
    id: "status",
    title: "Status summary",
    description: "Per-agent health and identity table.",
    argv: ["status"],
    args: [],
  }),
  read({
    id: "status.agent",
    title: "Status of one agent",
    description: "Health and identity snapshot for a single agent.",
    argv: ["status"],
    args: [pos("name", "Agent id (agent-foo) or bare name (foo)")],
  }),
  read({
    id: "status.all",
    title: "Status of every agent",
    description: "Full detail block for every agent.",
    argv: ["status"],
    args: [{ ...flag("all", "--all", "Detail block for every agent"), required: true }],
  }),
  read({
    id: "receipts",
    title: "Read receipts",
    description: "Was my message consumed? Query triage-log receipts.",
    argv: ["receipts"],
    args: [
      opt("message_id", "--message-id", "Only the receipt for this source message id"),
      opt("from", "--from", "Only receipts for messages from this sender"),
      opt("agent", "--agent", "Only receipts recorded by this recipient agent"),
    ],
  }),
  read({
    id: "fleet.status",
    title: "Fleet status",
    description: "Per-agent backend, status, pending inbox and last-seen.",
    argv: ["fleet", "status"],
    args: [],
  }),
  read({
    id: "fleet.health",
    title: "Fleet health",
    description: "The 7 Aparihaniya-dhamma fleet-governance signals.",
    argv: ["fleet", "health"],
    args: [opt("stale_days", "--stale-days", "Days without activity before an agent counts as stale")],
  }),
  read({
    id: "team.list",
    title: "List teams",
    description: "Teams with member and task counts.",
    argv: ["team", "list"],
    args: [],
  }),
  read({
    id: "task.list",
    title: "List a team's tasks",
    description: "Tasks of one team with state and claimant.",
    argv: ["task", "list"],
    args: [pos("team", "Team id")],
  }),
  read({
    id: "task.list.all",
    title: "List all tasks",
    description: "Tasks across every team, optionally filtered.",
    argv: ["task", "list"],
    args: [
      { ...flag("all", "--all", "Every team's tasks"), required: true },
      opt("agent", "--agent", "Only tasks claimed by this agent"),
      opt("state", "--state", "Only tasks in this state", { choices: ["pending", "in_progress", "completed"] }),
    ],
  }),
  read({
    id: "memory.list",
    title: "List memory entries",
    description: "User-authored workspace memory entries (.bwoc/memory/).",
    argv: ["memory", "list"],
    args: [opt("sort", "--sort", "Sort key", { choices: ["name", "size", "modified"] })],
  }),
  read({
    id: "memory.show.all",
    title: "Show all memory",
    description: "Every workspace memory entry, concatenated.",
    argv: ["memory", "show"],
    args: [{ ...flag("all", "--all", "Every entry"), required: true }],
  }),
  read({
    id: "memory.search",
    title: "Search memory",
    description: "Case-insensitive substring search across workspace memory (tier 1).",
    argv: ["memory", "search"],
    args: [pos("query", "Substring to search for")],
  }),
  // Mutations: visible, but disabled without the `write` capability and always behind
  // an explicit confirm dialog. `--no-plan` (opts out of the plan-approval gate) is
  // deliberately NOT exposed.
  mutation({
    id: "task.add",
    title: "Add a task",
    description: "Add a task to a team's list.",
    argv: ["task", "add"],
    args: [
      pos("team", "Team id the task belongs to"),
      pos("title", "Human-readable task title"),
      opt("deps", "--deps", "Comma-separated task ids that must complete first"),
      opt("id", "--id", "Explicit task id (default: auto)"),
    ],
  }),
  mutation({
    id: "task.claim",
    title: "Claim a task",
    description: "Claim a pending, unblocked task as an agent.",
    argv: ["task", "claim"],
    args: [
      pos("team", "Team id"),
      pos("task", "Task id to claim"),
      opt("as", "--as", "Claiming agent id (must be a team member)", { required: true }),
    ],
  }),
];

export type ArgValues = Record<string, string | boolean | undefined>;
export type BuildResult = { ok: true; argv: string[] } | { ok: false; errors: string[] };

/** True when `v` would be read as a flag by the CLI (and by bwocd's verb matcher). */
const looksLikeFlag = (v: string) => v.startsWith("-");

/**
 * Build the exact argv sent to `/cli`: subcommand words, positionals (in order), then
 * options/flags, then `--json`. Pure; validates required args and rejects values that
 * start with `-` (they'd be parsed as flags).
 */
export function buildArgv(verb: Verb, values: ArgValues): BuildResult {
  const errors: string[] = [];
  const positionals: string[] = [];
  const named: string[] = [];
  for (const a of verb.args) {
    const raw = values[a.name];
    if (a.kind === "flag") {
      if (raw === true || (a.required && raw === undefined)) named.push(a.flag!);
      continue;
    }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) {
      if (a.required) errors.push(`${a.label} is required`);
      continue;
    }
    if (looksLikeFlag(v)) {
      errors.push(`${a.label} can't start with "-" (it would be read as a flag)`);
      continue;
    }
    if (a.choices && !a.choices.includes(v)) {
      errors.push(`${a.label} must be one of: ${a.choices.join(", ")}`);
      continue;
    }
    if (a.kind === "positional") positionals.push(v);
    else named.push(a.flag!, v);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, argv: [...verb.argv, ...positionals, ...named, "--json"] };
}

/** Shell-ish rendering for display (confirm dialog): `bwoc a b "c d"`. */
export function formatArgv(argv: string[]): string {
  const q = (s: string) => (/^[\w./:=,@+-]+$/.test(s) ? s : JSON.stringify(s));
  return ["bwoc", ...argv.map(q)].join(" ");
}

/** Case-insensitive AND-match of every query token against id/title/description. */
export function filterVerbs(verbs: readonly Verb[], query: string): Verb[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [...verbs];
  return verbs.filter((v) => {
    const hay = `${v.id} ${v.title} ${v.description} ${v.argv.join(" ")}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });
}
