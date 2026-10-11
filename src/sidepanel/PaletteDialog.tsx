import { useMemo, useState, type KeyboardEvent } from "react";
import { Modal } from "../shared/Modal";
import { disabledReason } from "../shared/capabilities";
import { VERBS, filterVerbs, type Verb } from "../shared/verbs";
import { CapBadge } from "../shared/ui";

/** Searchable verb list (ARIA combobox + listbox). Enter selects, arrows move, Esc closes. */
export function PaletteDialog({
  caps,
  onSelect,
  onClose,
}: {
  caps: string[];
  onSelect: (verb: Verb) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => filterVerbs(VERBS, query), [query]);
  const index = Math.min(active, Math.max(results.length - 1, 0));
  const optionId = (v: Verb) => `palette-opt-${v.id}`;
  const current = results[index];

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((index + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((index - 1 + results.length) % results.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(results.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (current && !disabledReason(current, caps)) onSelect(current);
    }
  }

  return (
    <Modal labelId="palette-title" onClose={onClose} initialFocus="input">
      <h2 id="palette-title" className="h">
        Command palette
      </h2>
      <input
        role="combobox"
        aria-label="Search bwoc verbs"
        aria-expanded="true"
        aria-controls="palette-list"
        aria-autocomplete="list"
        aria-activedescendant={current ? optionId(current) : undefined}
        placeholder="Search verbs… (↑ ↓ Enter, Esc)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <ul id="palette-list" role="listbox" aria-label="Verbs" className="palette-list">
        {results.map((v, i) => {
          const reason = disabledReason(v, caps);
          return (
            <li
              key={v.id}
              id={optionId(v)}
              role="option"
              aria-selected={i === index}
              aria-disabled={reason ? true : undefined}
              title={reason ?? undefined}
              className={`palette-opt${i === index ? " active" : ""}${reason ? " disabled" : ""}`}
              onMouseMove={() => setActive(i)}
              onClick={() => !reason && onSelect(v)}
            >
              <div className="row between">
                <strong>{v.title}</strong>
                <span className="row">
                  {v.kind === "mutation" && <span className="badge write">mutation</span>}
                  <CapBadge cap={v.capability} />
                </span>
              </div>
              <div className="muted mono">bwoc {v.argv.join(" ")}</div>
              <div className="muted">{reason ?? v.description}</div>
            </li>
          );
        })}
      </ul>
      <div role="status" aria-live="polite" className="muted">
        {results.length ? `${results.length} verb${results.length === 1 ? "" : "s"}` : "No verbs match"}
      </div>
    </Modal>
  );
}
