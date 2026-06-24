import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, ApiError } from "../background/api";
import type { FleetSnapshot } from "../shared/types";
import { Dot, ErrorBanner } from "../shared/ui";

function Popup() {
  const [snap, setSnap] = useState<FleetSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .fleet()
      .then(setSnap)
      .catch((e) =>
        setErr(e instanceof ApiError && e.status === 401 ? "not enrolled" : String(e.message ?? e)),
      );
  }, []);

  async function openPanel() {
    const win = await chrome.windows.getCurrent();
    if (win.id !== undefined) await chrome.sidePanel.open({ windowId: win.id });
    window.close();
  }

  const agents = snap?.agents ?? [];
  const warns = (snap?.health ?? []).filter((h) => h.status !== "ok");

  return (
    <div className="popup">
      <div className="row between" style={{ marginBottom: 10 }}>
        <strong>🛰️ BWOC</strong>
        <button onClick={() => chrome.runtime.openOptionsPage()}>⚙</button>
      </div>
      {err ? (
        <ErrorBanner message={err} />
      ) : !snap ? (
        <span className="muted">Loading…</span>
      ) : (
        <div className="row" style={{ marginBottom: 10 }}>
          <Dot kind={warns.length === 0 ? "ok" : "warn"} />
          <span>
            {agents.length} agents · {warns.length === 0 ? "all green" : `${warns.length} warn`}
          </span>
        </div>
      )}
      <button className="primary" style={{ width: "100%" }} onClick={openPanel}>
        Open side panel
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
