import { useEffect, useState } from "react";
import { api, ApiError } from "../background/api";
import type { WhoAmI } from "../shared/types";
import { Card } from "../shared/ui";
import { Modal } from "../shared/Modal";
import { buildArgv, formatArgv, type ArgValues, type Verb } from "../shared/verbs";
import { disabledReason, requiresConfirm } from "../shared/capabilities";
import { interpretFailure, interpretResponse, type CliOutcome } from "../shared/cliResult";
import { PaletteDialog } from "./PaletteDialog";
import { ResultView } from "./ResultView";

/** Palette tab: pick a verb (Ctrl/Cmd+K), fill its args, run it through signed `/cli`. */
export function Palette({ who, openSignal }: { who: WhoAmI; openSignal: number }) {
  const [open, setOpen] = useState(false);
  const [verb, setVerb] = useState<Verb | null>(null);
  const [values, setValues] = useState<ArgValues>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<string[] | null>(null); // argv awaiting confirmation
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<CliOutcome | null>(null);

  // Ctrl/Cmd+K while the tab is mounted, plus the App-level signal when it wasn't.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  function choose(v: Verb) {
    setVerb(v);
    setValues({});
    setErrors([]);
    setOutcome(null);
    setOpen(false);
  }

  async function execute(argv: string[]) {
    setRunning(true);
    setOutcome(null);
    try {
      setOutcome(interpretResponse(await api.cli(argv)));
    } catch (e) {
      setOutcome(
        e instanceof ApiError
          ? interpretFailure(e.status, e.message)
          : interpretFailure(0, e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setRunning(false);
    }
  }

  function submit() {
    if (!verb || disabledReason(verb, who.caps)) return;
    const built = buildArgv(verb, values);
    if (!built.ok) return setErrors(built.errors);
    setErrors([]);
    if (requiresConfirm(verb)) setPending(built.argv); // never auto-run a mutation
    else void execute(built.argv);
  }

  const blocked = verb ? disabledReason(verb, who.caps) : null;

  return (
    <div>
      <button className="primary" onClick={() => setOpen(true)} aria-keyshortcuts="Control+K Meta+K">
        Search verbs <kbd>Ctrl/⌘ K</kbd>
      </button>

      {!verb && (
        <p className="muted">
          Run any read-only <span className="mono">bwoc --json</span> verb on the host. Mutations are
          listed but need the <span className="mono">write</span> capability and always ask first.
        </p>
      )}

      {verb && (
        <Card title={verb.title}>
          <div className="muted mono">bwoc {verb.argv.join(" ")}</div>
          <p className="muted">{verb.description}</p>
          {blocked && <p role="note" className="muted">{blocked}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {verb.args.map((a) => {
              const id = `arg-${verb.id}-${a.name}`;
              return (
                <div key={a.name} style={{ marginBottom: 8 }}>
                  {a.kind === "flag" ? (
                    <label className="row">
                      <input
                        id={id}
                        type="checkbox"
                        style={{ width: "auto" }}
                        checked={a.required ? true : values[a.name] === true}
                        disabled={a.required || !!blocked}
                        onChange={(e) => setValues({ ...values, [a.name]: e.target.checked })}
                      />
                      <span className="mono">{a.label}</span>
                      <span className="muted">{a.description}</span>
                    </label>
                  ) : (
                    <>
                      <label htmlFor={id}>
                        <span className="mono">{a.label}</span>
                        {a.required ? " (required)" : ""} <span className="muted">{a.description}</span>
                      </label>
                      {a.choices ? (
                        <select
                          id={id}
                          disabled={!!blocked}
                          value={(values[a.name] as string) ?? ""}
                          onChange={(e) => setValues({ ...values, [a.name]: e.target.value })}
                        >
                          <option value="">(any)</option>
                          {a.choices.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={id}
                          disabled={!!blocked}
                          value={(values[a.name] as string) ?? ""}
                          onChange={(e) => setValues({ ...values, [a.name]: e.target.value })}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {errors.length > 0 && (
              <ul role="alert" className="form-errors">
                {errors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            <button className="primary" type="submit" disabled={running || !!blocked}>
              {running ? "Running…" : verb.kind === "mutation" ? "Review & run…" : "Run"}
            </button>
          </form>
        </Card>
      )}

      {outcome && (
        <Card title="Result">
          <ResultView outcome={outcome} />
        </Card>
      )}

      {open && <PaletteDialog caps={who.caps} onSelect={choose} onClose={() => setOpen(false)} />}

      {pending && verb && (
        <Modal labelId="confirm-title" onClose={() => setPending(null)} initialFocus="button.cancel">
          <h2 id="confirm-title" className="h">
            Confirm: {verb.title}
          </h2>
          <p>This will change the workspace. The exact command to be run on the host:</p>
          <pre className="mono raw">{formatArgv(pending)}</pre>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="cancel" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => {
                const argv = pending;
                setPending(null);
                void execute(argv);
              }}
            >
              Run it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
