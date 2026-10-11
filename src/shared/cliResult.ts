// Turn a `/cli` response (or a thrown ApiError) into something renderable: parsed JSON,
// or an error with a cause and a remedy. Pure, so it is unit-tested without a network.

export type CliResponse = {
  ok: boolean;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  tier?: string;
};

export type CliOutcome =
  | { kind: "json"; value: unknown; raw: string }
  | { kind: "error"; cause: string; remedy: string };

export function interpretResponse(res: CliResponse): CliOutcome {
  const stdout = (res.stdout ?? "").trim();
  const stderr = (res.stderr ?? "").trim();
  if (!res.ok) {
    return {
      kind: "error",
      cause: `bwoc exited ${res.exit_code ?? "non-zero"}${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ""}`,
      remedy: "Check the argument values (agent/team ids must exist in the workspace) and try again.",
    };
  }
  try {
    return { kind: "json", value: JSON.parse(stdout), raw: stdout };
  } catch {
    return {
      kind: "error",
      cause: `bwoc succeeded but its output is not JSON${stdout ? `: ${stdout.slice(0, 200)}` : " (empty output)"}`,
      remedy: "This verb may not support --json on this bwoc version; update bwoc on the host.",
    };
  }
}

/** Map a transport failure (status from ApiError, 0 = network) to cause + remedy. */
export function interpretFailure(status: number, message: string): CliOutcome {
  const cause = message || `HTTP ${status}`;
  switch (status) {
    case 0:
      return { kind: "error", cause, remedy: "bwocd is unreachable: check the host URL in Options, that bwocd is running, and --cors-origin includes this extension." };
    case 400:
      return { kind: "error", cause, remedy: "bwocd rejected the arguments; fix the values and retry." };
    case 401:
      return { kind: "error", cause, remedy: "This install is not an approved controller: enroll in Options and ask the operator to approve it." };
    case 403:
      return { kind: "error", cause, remedy: "bwocd refused this verb for this controller: it needs a higher capability or is not proxied via /cli." };
    case 503:
      return { kind: "error", cause, remedy: "bwocd is at its concurrency limit; wait a moment and retry." };
    default:
      return { kind: "error", cause, remedy: status >= 500 ? "bwocd or bwoc failed or timed out on the host; check the bwocd log." : "Retry; if it persists check the bwocd log." };
  }
}
