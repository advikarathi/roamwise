"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { getAirport, searchAirports, type AirportInfo } from "@/lib/airports";

/** Type a city, airport or code; pick from about 4,000 airports worldwide. */
export function AirportSearch({ id, label, value, onChange, placeholder }: {
  id: string; label: string; value: string; onChange: (code: string) => void; placeholder?: string;
}) {
  const current = getAirport(value);
  const display = (a?: AirportInfo) => (a ? `${a.city} (${a.code})` : "");
  const [text, setText] = useState(display(current));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  useEffect(() => { if (!open) setText(display(getAirport(value))); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = useMemo(() => (open ? searchAirports(text) : []), [text, open]);

  const pick = (a: AirportInfo) => {
    onChange(a.code);
    setText(display(a));
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${results[active].code}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onFocus={(e) => { e.currentTarget.select(); setOpen(true); }}
        onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
        onBlur={() => setTimeout(() => { setOpen(false); setText(display(getAirport(value))); }, 150)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % results.length); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length); }
          if (e.key === "Enter") { e.preventDefault(); pick(results[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="combo-list">
          {results.map((a, i) => (
            <li
              key={a.code}
              id={`${listId}-${a.code}`}
              role="option"
              aria-selected={i === active}
              className="combo-option"
              onMouseDown={(e) => { e.preventDefault(); pick(a); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="combo-code">{a.code}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700, display: "block" }}>{a.city}, {a.country}</span>
                <span className="small muted" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && text.trim().length >= 2 && results.length === 0 && (
        <div className="combo-list" style={{ padding: "12px 14px" }} role="status">No airports match "{text}". Try the city name or a 3-letter code.</div>
      )}
    </div>
  );
}
