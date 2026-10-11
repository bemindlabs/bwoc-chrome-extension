import { useState } from "react";
import { cellText, isScalar, toTable } from "../shared/jsonview";
import type { CliOutcome } from "../shared/cliResult";
import { ErrorBanner } from "../shared/ui";

function Table({ value }: { value: unknown }) {
  const t = toTable(value);
  if (!t) return null;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {t.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i}>
              {t.columns.map((c) => (
                <td key={c} className="mono">
                  {cellText(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Node({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  if (isScalar(value)) {
    return (
      <div className="tree-leaf">
        {name !== undefined && <span className="muted">{name}: </span>}
        <span className="mono">{cellText(value)}</span>
      </div>
    );
  }
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const label = `${name ?? "result"} ${Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}`;
  return (
    <details open={depth < 2} className="tree-node">
      <summary>{label}</summary>
      {toTable(value) ? (
        <Table value={value} />
      ) : (
        entries.map(([k, v]) => <Node key={k} name={k} value={v} depth={depth + 1} />)
      )}
    </details>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ResultView({ outcome }: { outcome: CliOutcome }) {
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  if (outcome.kind === "error") {
    return (
      <div role="alert">
        <ErrorBanner message={outcome.cause} />
        <p className="muted">
          <strong>Remedy:</strong> {outcome.remedy}
        </p>
      </div>
    );
  }

  const pretty = JSON.stringify(outcome.value, null, 2);
  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <label className="row">
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={raw}
            onChange={(e) => setRaw(e.target.checked)}
          />
          Raw JSON
        </label>
        <button
          onClick={async () => setCopied((await copyText(pretty)) ? "ok" : "fail")}
          aria-label="Copy result JSON to clipboard"
        >
          Copy
        </button>
      </div>
      <div role="status" aria-live="polite" className="muted">
        {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed — select the raw JSON manually" : ""}
      </div>
      {raw ? (
        <pre className="mono raw">{pretty}</pre>
      ) : toTable(outcome.value) ? (
        <Table value={outcome.value} />
      ) : (
        <Node value={outcome.value} depth={0} />
      )}
    </div>
  );
}
