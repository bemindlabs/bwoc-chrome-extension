import { useEffect, useState } from "react";
import { ensureIdentity } from "../background/signer";
import { getConfig, setConfig, type Config } from "../background/store";
import { api } from "../background/api";
import { Card, CapBadge, ErrorBanner } from "../shared/ui";
import type { WhoAmI } from "../shared/types";

export function Options() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [identity, setIdentity] = useState<{ controllerId: string; publicKeyHex: string } | null>(
    null,
  );
  const [who, setWho] = useState<WhoAmI | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newHost, setNewHost] = useState("");

  async function refresh() {
    setCfg(await getConfig());
    setIdentity(await ensureIdentity());
    try {
      setWho(await api.whoami());
      setErr(null);
    } catch {
      setWho(null);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  if (!cfg || !identity) return <div className="options">Loading…</div>;

  const extensionId = chrome.runtime.id;

  async function selectHost(url: string) {
    setCfg(await setConfig({ activeHostUrl: url }));
    refresh();
  }

  async function addHost() {
    const url = newHost.trim().replace(/\/$/, "");
    if (!url) return;
    try {
      // Tailnet HTTPS hosts need an optional host permission granted at runtime.
      if (url.startsWith("https://")) {
        const origin = new URL(url).origin + "/*";
        const granted = await chrome.permissions.request({ origins: [origin] });
        if (!granted) {
          setErr(`permission for ${origin} was denied`);
          return;
        }
      }
      const name = new URL(url).hostname;
      const hosts = [...cfg!.hosts.filter((h) => h.baseUrl !== url), { name, baseUrl: url }];
      setCfg(await setConfig({ hosts, activeHostUrl: url }));
      setNewHost("");
      setErr(null);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  async function enroll() {
    setMsg(null);
    setErr(null);
    const r = await api.enroll();
    if (r.status === 202) setMsg(r.message);
    else if (r.status === 401)
      setErr("bwocd rejected the self-signed enrollment (check the host URL + clock).");
    else setErr(`enroll failed (${r.status}): ${r.message}`);
    refresh();
  }

  return (
    <div className="options">
      <h2>🛰️ BWOC Control — Settings</h2>
      {err && <ErrorBanner message={err} />}

      <Card title="Hosts">
        <p className="muted">The bwocd daemon to control. Loopback works out of the box; a tailnet HTTPS host is requested as an optional permission.</p>
        {cfg.hosts.map((h) => (
          <label className="list-item" key={h.baseUrl}>
            <input
              type="radio"
              style={{ width: "auto" }}
              checked={cfg.activeHostUrl === h.baseUrl}
              onChange={() => selectHost(h.baseUrl)}
            />
            <strong>{h.name}</strong>
            <span className="muted mono">{h.baseUrl}</span>
          </label>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <input
            placeholder="https://host.tailnet.ts.net"
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
          />
          <button onClick={addHost}>Add</button>
        </div>
      </Card>

      <Card title="Identity">
        <div className="row between">
          <span className="muted">Controller id</span>
          <span className="mono">{identity.controllerId}</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <div className="muted">Public key (give to the operator to approve)</div>
          <div className="mono" style={{ wordBreak: "break-all" }}>
            {identity.publicKeyHex}
          </div>
          <button
            style={{ marginTop: 6 }}
            onClick={() => navigator.clipboard.writeText(identity.publicKeyHex)}
          >
            Copy public key
          </button>
        </div>
      </Card>

      <Card title="Enrollment">
        {who ? (
          <div className="row">
            ✅ Enrolled as <span className="mono">{who.controller_id}</span>
            {who.caps.map((c) => (
              <CapBadge key={c} cap={c} />
            ))}
            <span className="muted">· bwocd {who.bwocd_version}</span>
          </div>
        ) : (
          <>
            <p className="muted">
              Send this install's public key to the active host as a pending controller. An
              operator then approves it (assigning caps) in the control-center or
              <span className="mono"> controllers.toml</span>.
            </p>
            <button className="primary" onClick={enroll}>
              Request enrollment
            </button>
            {msg && <p className="muted">{msg}</p>}
          </>
        )}
      </Card>

      <Card title="bwocd CORS reminder">
        <p className="muted">
          Start bwocd allowing this extension's origin:
        </p>
        <div className="mono" style={{ wordBreak: "break-all" }}>
          bwocd --workspace &lt;ws&gt; --cors-origin chrome-extension://{extensionId}
        </div>
      </Card>
    </div>
  );
}
