"use client";
import { useState } from "react";
import type { Activity } from "@/lib/types";
import type { Decision } from "./ActivityDeck";

export interface Person {
  name: string;
  decisions: Record<string, Decision>;
}

const COLORS = ["#ffc93c", "#7fe0b8", "#ff9cc9", "#9db7ff", "#ffb07a", "#c3a8ff"];
export const personColor = (i: number) => COLORS[i % COLORS.length];

export function Initial({ name, i, size = 30 }: { name: string; i: number; size?: number }) {
  return (
    <span className="initial" style={{ background: personColor(i), width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** An activity makes the group plan when at least half of the people who swiped on it kept it. */
export function groupKeeps(activities: Activity[], people: Person[]) {
  return activities.filter((a) => {
    const votes = people.map((p) => p.decisions[a.id]).filter(Boolean);
    const keeps = votes.filter((v) => v === "keep").length;
    return keeps > 0 && keeps >= Math.ceil(votes.length / 2);
  });
}

/** Who's swiping right now, plus the group tally. */
export function Friends({ people, active, onSwitch, onAdd, activities, shareState, onShare }: {
  people: Person[];
  active: number;
  onSwitch: (i: number) => void;
  onAdd: (name: string) => void;
  activities: Activity[];
  shareState: { kind: "idle" } | { kind: "working" } | { kind: "ready"; url: string; copied: boolean } | { kind: "unavailable" } | { kind: "error"; message: string };
  onShare: () => void;
}) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const tally = activities
    .map((a) => ({ a, keepers: people.map((p, i) => ({ p, i })).filter(({ p }) => p.decisions[a.id] === "keep") }))
    .filter((t) => t.keepers.length > 0)
    .sort((x, y) => y.keepers.length - x.keepers.length);

  return (
    <section className="panel" aria-labelledby="friends-h">
      <h2 className="h2" id="friends-h">Plan with friends</h2>
      <p className="small muted" style={{ marginTop: -4 }}>
        Everyone swipes the same deck. Plans at least half the group keeps go on the itinerary.
      </p>

      <div className="swiper-tabs" role="group" aria-label="Who is swiping">
        {people.map((p, i) => (
          <button key={p.name + i} type="button" className="swiper-tab" aria-pressed={i === active} onClick={() => onSwitch(i)}>
            <Initial name={p.name} i={i} size={26} /> {p.name}
          </button>
        ))}
        {adding ? (
          <form className="add-friend" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(""); setAdding(false); } }}>
            <label htmlFor="friend-name" className="sr-only">Friend's name</label>
            <input id="friend-name" className="input" style={{ height: 40 }} autoFocus value={name} maxLength={24}
              onChange={(e) => setName(e.target.value)} placeholder="Their name" />
            <button type="submit" className="btn" style={{ height: 40 }} disabled={!name.trim()}>Add</button>
          </form>
        ) : (
          <button type="button" className="swiper-tab" onClick={() => setAdding(true)} disabled={people.length >= 8}>+ Add a friend</button>
        )}
      </div>
      {people.length > 1 && (
        <p className="small" style={{ margin: "8px 0 0", fontWeight: 600 }}>Pass the phone: {people[active].name} is swiping now.</p>
      )}

      {tally.length > 0 && people.length > 1 && (
        <ul className="tally">
          {tally.slice(0, 6).map(({ a, keepers }) => (
            <li key={a.id}>
              <span style={{ minWidth: 0 }}>{a.title}</span>
              <span className="tally-faces" aria-label={`Kept by ${keepers.map((k) => k.p.name).join(", ")}`}>
                {keepers.map(({ p, i }) => <Initial key={i} name={p.name} i={i} size={24} />)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
        <button type="button" className="btn" onClick={onShare} disabled={shareState.kind === "working"}>
          {shareState.kind === "working" ? "Making a link…" : "Share a link so friends swipe on their own phones"}
        </button>
        {shareState.kind === "ready" && (
          <div className="share-box">
            <input className="input" readOnly value={shareState.url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
            <span className="small" role="status">{shareState.copied ? "Copied. Send it to your group." : "Copy this link and send it to your group."}</span>
          </div>
        )}
        {shareState.kind === "unavailable" && (
          <p className="small muted" role="status" style={{ margin: 0 }}>Share links work once the app is online. In this preview, pass the phone instead.</p>
        )}
        {shareState.kind === "error" && <p className="small" role="alert" style={{ margin: 0, color: "#c2321b", fontWeight: 600 }}>{shareState.message}</p>}
      </div>
    </section>
  );
}
