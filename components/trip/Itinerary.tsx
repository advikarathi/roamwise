"use client";
import { useState } from "react";
import type { Activity, StayOption } from "@/lib/types";
import { dayRoute, MODE_WORD, type DayRoute } from "@/lib/routes";
import type { OutLink } from "@/lib/links";
import { LinkRow } from "./LinkRow";
import { isWetDay, weatherKind, type DayWeather } from "@/lib/extras";
import { WeatherIcon } from "./Weather";

const SLOTS = ["morning", "afternoon", "evening"] as const;
type Slot = (typeof SLOTS)[number];

/** Drop kept activities into days, matching each one's preferred time of day where possible,
 *  and keeping outdoor plans off wet days when there's a dry day free. */
export function buildDays(kept: Activity[], days: number, wet: boolean[] = []) {
  const grid: (Activity | null)[][] = Array.from({ length: days }, () => [null, null, null]);
  grid[0][0] = null; // arrival morning stays free
  const blocked = (d: number, s: number) => d === 0 && s === 0;
  const free = (d: number, s: number) => !grid[d][s] && !blocked(d, s);
  const okDay = (a: Activity, d: number) => a.indoor || !wet[d];

  const sorted = [...kept].sort((a, b) => b.durationHours - a.durationHours);
  for (const a of sorted) {
    const want = SLOTS.indexOf(a.timeOfDay as Slot);
    const long = a.durationHours >= 5;
    let placed = false;
    for (const strict of [true, false]) {
      for (let d = 0; d < days && !placed; d++) {
        if (strict && !okDay(a, d)) continue;
        if (long) {
          if (free(d, 0) && free(d, 1)) { grid[d][0] = a; grid[d][1] = a; placed = true; }
        } else if (free(d, want)) { grid[d][want] = a; placed = true; }
      }
    }
    for (let d = 0; d < days && !placed; d++) {
      for (let s = 0; s < 3 && !placed; s++) if (free(d, s)) { grid[d][s] = a; placed = true; }
    }
  }
  return grid.map((slots) => slots.filter((a, i) => a && slots.indexOf(a) === i) as Activity[]);
}

/** Getting-around agent output for one day: time between stops and a Maps route for the day. */
function RouteLine({ route }: { route: DayRoute }) {
  const known = route.legs.filter((l) => l.minutes !== undefined);
  return (
    <div className="route-line">
      {known.length > 0 && <span><b>~{route.travelMinutes} min</b> getting around: </span>}
      {known.length > 0 && (
        <span className="muted">
          {route.legs.map((l, i) => l.minutes === undefined ? null : (
            <span key={i}>{i > 0 ? " · " : ""}{i === route.legs.length - 1 ? "back" : l.to.length > 22 ? `${l.to.slice(0, 20)}…` : l.to} {l.minutes} min {MODE_WORD[l.mode!]}</span>
          ))}
        </span>
      )}
      <a href={route.mapsUrl} target="_blank" rel="noopener noreferrer">Route in Google Maps</a>
    </div>
  );
}

export function dayLabel(startISO: string, offset: number) {
  const d = new Date(`${startISO}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

export function isoPlus(startISO: string, n: number) {
  const d = new Date(`${startISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** How many days the trip has on the ground (an overnight flight eats the first one). */
export const dayCount = (nights: number, arriveNextDay: boolean) => Math.max(1, nights - (arriveNextDay ? 1 : 0) + 1);

/** The traveler's edits on top of the suggested plan. */
export interface PlannerEdits {
  layout: string[][] | null; // activity ids per day, once they've moved something
  dropped: string[]; // taken off the plan (still kept in the deck)
  custom: Activity[]; // plans they typed in themselves
}
export const NO_EDITS: PlannerEdits = { layout: null, dropped: [], custom: [] };

/** The day-by-day schedule: the suggested plan until they edit it, then their layout. New keeps
 *  land on the lightest day; anything dropped stays off. */
export function scheduleFor(kept: Activity[], days: number, wet: boolean[], edits: PlannerEdits, dayDates: string[] = []): Activity[][] {
  const pool = [...kept, ...edits.custom].filter((a) => !edits.dropped.includes(a.id));
  // Events happen on a set date, so they're pinned to that day; everything else is placed freely.
  const dayOf = (a: Activity) => (a.date ? dayDates.indexOf(a.date) : -1);
  const SLOT = { morning: 0, afternoon: 1, evening: 2 } as const;
  if (!edits.layout) {
    const grid = buildDays(pool.filter((a) => dayOf(a) < 0), days, wet);
    for (const a of pool.filter((x) => dayOf(x) >= 0)) {
      const day = grid[dayOf(a)];
      const at = day.findIndex((b) => SLOT[b.timeOfDay] > SLOT[a.timeOfDay]);
      day.splice(at < 0 ? day.length : at, 0, a);
    }
    return grid;
  }
  const byId = new Map(pool.map((a) => [a.id, a]));
  const grid = Array.from({ length: days }, (_, i) => (edits.layout![i] ?? []).filter((id) => byId.has(id)));
  for (let i = days; i < edits.layout.length; i++) grid[days - 1].push(...edits.layout[i].filter((id) => byId.has(id)));
  const placed = new Set(grid.flat());
  for (const a of pool) {
    if (placed.has(a.id)) continue;
    const pinned = dayOf(a);
    const day = pinned >= 0 ? pinned : grid.reduce((best, d, j) => (d.length < grid[best].length ? j : best), 0);
    grid[day].push(a.id);
  }
  return grid.map((d) => d.map((id) => byId.get(id)!));
}

export function Itinerary({ schedule, startDate, arriveNextDay, travelers, weather, linksFor, edits, onEdits, allKept, stay, city }: {
  schedule: Activity[][]; startDate: string; arriveNextDay: boolean; travelers: number; weather?: DayWeather[];
  stay?: StayOption; city?: string;
  linksFor?: (a: Activity) => OutLink[];
  edits: PlannerEdits; onEdits: (e: PlannerEdits) => void; allKept: Activity[];
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const offset = arriveNextDay ? 1 : 0;
  const days = schedule.length;
  const dayWeather = Array.from({ length: days }, (_, i) => weather?.find((w) => w.date === isoPlus(startDate, i + offset)));
  const ids = schedule.map((d) => d.map((a) => a.id));
  const edited = edits.layout !== null || edits.dropped.length > 0 || edits.custom.length > 0;
  const droppedItems = [...allKept, ...edits.custom].filter((a) => edits.dropped.includes(a.id));
  const empty = schedule.every((d) => d.length === 0);

  const setLayout = (layout: string[][]) => onEdits({ ...edits, layout });
  const without = (id: string) => ids.map((d) => d.filter((x) => x !== id));

  /** Up/down within a day; past the edge it hops to the end/start of the neighboring day. */
  function nudge(day: number, index: number, dir: -1 | 1) {
    const grid = ids.map((d) => [...d]);
    const [id] = grid[day].splice(index, 1);
    const to = index + dir;
    if (to >= 0 && to <= grid[day].length && !(dir === 1 && index === ids[day].length - 1)) grid[day].splice(to, 0, id);
    else if (dir === -1 && day > 0) grid[day - 1].push(id);
    else if (dir === 1 && day < days - 1) grid[day + 1].unshift(id);
    else grid[day].splice(index, 0, id);
    setLayout(grid);
  }
  const moveToDay = (id: string, day: number) => { const grid = without(id); grid[day].push(id); setLayout(grid); };
  const drop = (id: string) => onEdits({ ...edits, layout: without(id), dropped: [...edits.dropped, id] });
  const restore = (id: string) => onEdits({ ...edits, dropped: edits.dropped.filter((x) => x !== id) });
  function addCustom(day: number) {
    const title = (drafts[day] ?? "").trim();
    if (!title) return;
    const a: Activity = { id: `custom-${Date.now()}`, title, blurb: "Added by you", vibe: "chill", price: 0, durationHours: 1.5, timeOfDay: "afternoon" };
    const grid = ids.map((d) => [...d]);
    grid[day].push(a.id);
    onEdits({ ...edits, custom: [...edits.custom, a], layout: grid });
    setDrafts((d) => ({ ...d, [day]: "" }));
  }

  return (
    <section aria-labelledby="days-h">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h2 className="h2" id="days-h">Your days</h2>
        {!empty && (
          <div style={{ display: "flex", gap: 8 }}>
            {edited && <button type="button" className="fare-tab" onClick={() => { onEdits(NO_EDITS); setEditing(false); }}>Reset to suggested</button>}
            <button type="button" className="fare-tab" aria-pressed={editing} onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit days"}</button>
          </div>
        )}
      </div>
      {editing && <p className="small muted" style={{ margin: "0 0 10px" }}>Move plans up or down, send them to another day, remove them, or add your own.</p>}
      {empty ? (
        <p className="muted" style={{ marginTop: 0 }}>Swipe right on a few ideas and they'll land here, day by day.</p>
      ) : (
        <div className="days">
          {schedule.map((items, i) => {
            const { weekday, date } = dayLabel(startDate, i + offset);
            return (
              <div className="day" key={i}>
                <div className="day-num"><b>{i + 1}</b><span className="small">{weekday}</span></div>
                <div className="day-items">
                  <div className="small muted" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span>{date}{i === 0 ? ", arrival day" : ""}{i === days - 1 && i > 0 ? ", fly home" : ""}</span>
                    {dayWeather[i] && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "#1b1f5e" }}>
                        <WeatherIcon kind={weatherKind(dayWeather[i]!.code, dayWeather[i]!.rainMm)} size={20} />{dayWeather[i]!.highF}°
                      </span>
                    )}
                  </div>
                  {items.length ? items.map((a, j) => (
                    <div key={a.id} className="day-entry">
                      {a.image ? <img className="day-thumb" src={a.image} alt="" loading="lazy" /> : <span className="day-thumb" aria-hidden="true" />}
                      <div style={{ minWidth: 0 }}>
                        <div className="day-item">
                          <span>{a.title}</span>
                          <span style={{ fontWeight: 700 }}>{a.price ? `$${a.price * travelers}` : "Free"}</span>
                        </div>
                        {editing ? (
                          <div className="edit-row">
                            <button type="button" className="mini-btn" aria-label={`Move ${a.title} earlier`} onClick={() => nudge(i, j, -1)} disabled={i === 0 && j === 0}>↑</button>
                            <button type="button" className="mini-btn" aria-label={`Move ${a.title} later`} onClick={() => nudge(i, j, 1)} disabled={i === days - 1 && j === items.length - 1}>↓</button>
                            <label className="sr-only" htmlFor={`day-${a.id}`}>Move {a.title} to day</label>
                            <select id={`day-${a.id}`} className="mini-select" value={i} onChange={(e) => moveToDay(a.id, Number(e.target.value))}>
                              {schedule.map((_, d) => <option key={d} value={d}>Day {d + 1}</option>)}
                            </select>
                            <button type="button" className="mini-btn" aria-label={`Remove ${a.title} from the plan`} onClick={() => drop(a.id)}>Remove</button>
                          </div>
                        ) : linksFor && !a.id.startsWith("custom-") && <LinkRow links={linksFor(a)} label={`Links for ${a.title}`} />}
                      </div>
                    </div>
                  )) : <div className="muted small">Free day to wander</div>}
                  {!editing && stay && items.length > 0 && <RouteLine route={dayRoute(stay, items, city ?? "")} />}
                  {editing && (
                    <form className="add-own" onSubmit={(e) => { e.preventDefault(); addCustom(i); }}>
                      <label className="sr-only" htmlFor={`add-${i}`}>Add your own plan to day {i + 1}</label>
                      <input id={`add-${i}`} className="input" placeholder="Add your own plan…" value={drafts[i] ?? ""} maxLength={60}
                        onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))} />
                      <button type="submit" className="mini-btn" disabled={!(drafts[i] ?? "").trim()}>Add</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {droppedItems.length > 0 && (
        <div className="small" style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className="muted">Removed:</span>
          {droppedItems.map((a) => (
            <button key={a.id} type="button" className="fare-tab" onClick={() => restore(a.id)} title="Put it back on the plan">{a.title} ↩</button>
          ))}
        </div>
      )}
    </section>
  );
}
