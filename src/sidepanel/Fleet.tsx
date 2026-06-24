import { useEffect, useState, useCallback } from "react";
import { api } from "../background/api";
import type { FleetSnapshot } from "../shared/types";
import { Card, Dot, ErrorBanner, statusDot } from "../shared/ui";

const POLL_MS = 15_000;

export function Fleet({ onSelect }: { onSelect: (id: string) => void }) {
  const [snap, setSnap] = useState<FleetSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSnap(await api.fleet());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <ErrorBanner message={error} />;
  if (!snap) return <span className="muted">Loading fleet…</span>;

  const agents = snap.agents ?? [];
  const health = snap.health ?? [];
  const warns = health.filter((h) => h.status !== "ok");

  return (
    <>
      <Card>
        <div className="row between">
          <span className="muted mono">{snap.workspace}</span>
          <span className="muted">{agents.length} agents</span>
        </div>
      </Card>

      {health.length > 0 && (
        <Card title="Health">
          {warns.length === 0 ? (
            <div className="row">
              <Dot kind="ok" /> <span className="muted">all {health.length} signals green</span>
            </div>
          ) : (
            warns.map((h) => (
              <div className="row" key={h.condition} style={{ marginBottom: 4 }}>
                <Dot kind={statusDot(h.status)} />
                <span>{h.name}</span>
                <span className="muted">— {h.finding}</span>
              </div>
            ))
          )}
        </Card>
      )}

      <Card title="Agents">
        {agents.map((a) => (
          <div className="list-item" key={a.id} onClick={() => onSelect(a.id)}>
            <Dot kind={statusDot(a.running ? "running" : a.status)} />
            <strong>{a.id.replace(/^agent-/, "")}</strong>
            <span className="muted">{a.backend}</span>
            <span style={{ flex: 1 }} />
            {(a.inbox_count ?? 0) > 0 && <span className="badge">{a.inbox_count} inbox</span>}
            <span className="muted">{a.status}</span>
          </div>
        ))}
        {agents.length === 0 && <span className="muted">no agents registered</span>}
      </Card>
    </>
  );
}
