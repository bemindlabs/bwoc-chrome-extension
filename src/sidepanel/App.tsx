import { useEffect, useState } from "react";
import { api, ApiError } from "../background/api";
import type { WhoAmI } from "../shared/types";
import { Card, CapBadge, ErrorBanner } from "../shared/ui";
import { Fleet } from "./Fleet";
import { AgentDetail } from "./AgentDetail";
import { Palette } from "./Palette";

type Conn =
  | { state: "loading" }
  | { state: "ok"; who: WhoAmI }
  | { state: "unenrolled" }
  | { state: "error"; message: string };

export function App() {
  const [conn, setConn] = useState<Conn>({ state: "loading" });
  const [tab, setTab] = useState<"fleet" | "palette">("fleet");
  const [selected, setSelected] = useState<string | null>(null);
  const [paletteSignal, setPaletteSignal] = useState(0);

  async function probe() {
    setConn({ state: "loading" });
    try {
      const who = await api.whoami();
      setConn({ state: "ok", who });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setConn({ state: "unenrolled" });
      else setConn({ state: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  useEffect(() => {
    probe();
  }, []);

  // Ctrl/Cmd+K anywhere in the side panel jumps to the palette and opens it.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && tab !== "palette") {
        e.preventDefault();
        setTab("palette");
        setPaletteSignal((n) => n + 1);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [tab]);

  if (conn.state === "loading") {
    return (
      <div className="app">
        <Header />
        <Card>
          <span className="muted">Connecting to bwocd…</span>
        </Card>
      </div>
    );
  }

  if (conn.state === "unenrolled") {
    return (
      <div className="app">
        <Header />
        <Card title="Not enrolled yet">
          <p className="muted">
            This install isn't an approved controller for the active host. Open the options page
            to enroll, then have the operator approve it.
          </p>
          <button className="primary" onClick={() => chrome.runtime.openOptionsPage()}>
            Open options
          </button>
        </Card>
      </div>
    );
  }

  if (conn.state === "error") {
    return (
      <div className="app">
        <Header />
        <ErrorBanner message={conn.message} />
        <div style={{ height: 8 }} />
        <button onClick={probe}>Retry</button>
        <button onClick={() => chrome.runtime.openOptionsPage()} style={{ marginLeft: 8 }}>
          Configure host
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <Header who={conn.state === "ok" ? conn.who : undefined} />
      <div className="tabs">
        <div className={tab === "fleet" ? "tab active" : "tab"} onClick={() => setTab("fleet")}>
          Fleet
        </div>
        <div className={tab === "palette" ? "tab active" : "tab"} onClick={() => setTab("palette")}>
          Palette
        </div>
        <div className="tab muted" title="Coming in P3">
          Chat
        </div>
      </div>
      {tab === "palette" && conn.state === "ok" ? (
        <Palette who={conn.who} openSignal={paletteSignal} />
      ) : selected ? (
        <AgentDetail id={selected} onBack={() => setSelected(null)} />
      ) : (
        <Fleet onSelect={setSelected} />
      )}
    </div>
  );
}

function Header({ who }: { who?: WhoAmI }) {
  return (
    <div className="row between" style={{ marginBottom: 12 }}>
      <strong>🛰️ BWOC Control</strong>
      <div className="row">
        {who?.caps.map((c) => (
          <CapBadge key={c} cap={c} />
        ))}
        <button onClick={() => chrome.runtime.openOptionsPage()} title="Options">
          ⚙
        </button>
      </div>
    </div>
  );
}
