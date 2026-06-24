import { useEffect, useState } from "react";
import { api } from "../background/api";
import { Card, ErrorBanner } from "../shared/ui";

export function AgentDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [status, setStatus] = useState<unknown>(null);
  const [inbox, setInbox] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, i] = await Promise.all([api.agentStatus(id), api.agentInbox(id)]);
        if (alive) {
          setStatus(s);
          setInbox(i);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <button onClick={onBack}>← Fleet</button>
        <strong style={{ marginLeft: 8 }}>{id}</strong>
      </div>
      {error && <ErrorBanner message={error} />}
      <Card title="Status">
        <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {status ? JSON.stringify(status, null, 2) : "…"}
        </pre>
      </Card>
      <Card title="Inbox">
        <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {inbox ? JSON.stringify(inbox, null, 2) : "…"}
        </pre>
      </Card>
    </>
  );
}
