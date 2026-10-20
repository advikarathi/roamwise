"use client";
import type { Activity } from "@/lib/types";
import { External, Heart, VibeIcon } from "../Icons";

export type EventsState = { kind: "off" } | { kind: "loading" } | { kind: "ready"; events: Activity[] } | { kind: "none" };

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const ticketSearch = (a: Activity, city: string) => `https://www.google.com/search?q=${encodeURIComponent(`${a.title} ${a.address ?? ""} ${city} tickets`)}`;

/** "Happening while you're there": dated events found by the events agent's web search. */
export function Events({ state, city, kept, travelers, onKeep }: {
  state: EventsState; city: string; kept: Set<string>; travelers: number; onKeep: (id: string) => void;
}) {
  if (state.kind === "off") return null;
  return (
    <section className="panel" aria-labelledby="events-h" aria-busy={state.kind === "loading"}>
      <h2 className="h2" id="events-h">Happening while you&apos;re there</h2>
      {state.kind === "loading" && (
        <p className="small muted" style={{ margin: 0 }}>Juno is searching the web for concerts, festivals and shows on your dates… this takes about a minute.</p>
      )}
      {state.kind === "none" && <p className="small muted" style={{ margin: 0 }}>No dated events turned up for your trip. The deck still has plenty to do.</p>}
      {state.kind === "ready" && (
        <ul className="event-list">
          {[...state.events].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).map((a) => {
            const isKept = kept.has(a.id);
            return (
              <li key={a.id} className="event-row">
                <div className="event-date"><b>{a.date ? day(a.date).split(", ")[1] : ""}</b><span>{a.date ? day(a.date).split(",")[0] : ""}</span></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, display: "flex", gap: 6, alignItems: "center" }}><VibeIcon vibe={a.vibe} size={16} /> {a.title}</div>
                  <div className="small muted">{a.blurb.replace(/^[^.]*\. /, "")}</div>
                  <div className="small" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                    <span style={{ fontWeight: 700 }}>{a.price ? `~$${a.price * travelers}` : "Free"}</span>
                    {a.address && <span className="muted">{a.address}</span>}
                    {a.infoUrl && <a href={a.infoUrl} target="_blank" rel="noopener noreferrer"><External size={13} /> Event page</a>}
                    <a href={ticketSearch(a, city)} target="_blank" rel="noopener noreferrer">Find tickets</a>
                  </div>
                </div>
                <button type="button" className="mini-btn" aria-pressed={isKept} onClick={() => onKeep(a.id)} disabled={isKept}
                  style={isKept ? { background: "var(--mint)" } : undefined}>
                  {isKept ? "On your plan" : <><Heart size={13} /> Keep</>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {state.kind === "ready" && <p className="small muted" style={{ margin: "8px 0 0" }}>Found on the web; check the event page for times and tickets.</p>}
    </section>
  );
}
