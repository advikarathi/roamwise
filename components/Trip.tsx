"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { budgetLines, explain } from "@/lib/agents/budget";
import { getAirport } from "@/lib/airports";
import { getPlace } from "@/lib/destinations";
import { activityLinks, activityMap, cityMap, extraLinks, flightLinks, stayLinks, stayMap } from "@/lib/links";
import { fetchCityPhoto, fetchWeather, isWetDay, type CityPhoto, type TripWeather } from "@/lib/extras";
import { runRevise, type RunMode } from "@/lib/runPlan";
import type { Activity, AgentId, TripPlan } from "@/lib/types";
import type { SharedTrip } from "@/lib/tripStore";
import type { TripSnapshot } from "@/lib/tripText";
import { airportTransfer, taxiRate } from "@/lib/routes";
import { BudgetJar } from "./BudgetJar";
import { CrewAvatar } from "./CrewAvatar";
import { Book, Pin, Plane } from "./Icons";
import { ActivityDeck, type Decision } from "./trip/ActivityDeck";
import { BoardingPass } from "./trip/BoardingPass";
import { ChangeBar, type ChangeStatus } from "./trip/ChangeBar";
import { Friends, groupKeeps, type Person } from "./trip/Friends";
import { ChatBot } from "./trip/ChatBot";
import { EmailPlan } from "./trip/EmailPlan";
import { Events, type EventsState } from "./trip/Events";
import { dayCount, isoPlus, Itinerary, NO_EDITS, scheduleFor, type PlannerEdits } from "./trip/Itinerary";
import { LinkRow } from "./trip/LinkRow";
import { StayPolaroid } from "./trip/StayPolaroid";
import { TripMap } from "./trip/TripMap";
import { WeatherCard } from "./trip/Weather";

export interface SavedTrip {
  code: string;
  city: string;
  country: string;
  color: string;
  startDate: string;
  endDate: string;
  total: number;
  savedAt: number;
}

type ShareState =
  | { kind: "idle" } | { kind: "working" } | { kind: "ready"; url: string; copied: boolean }
  | { kind: "unavailable" } | { kind: "error"; message: string };

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const meKey = (id: string) => `roamwise:me:${id}`;
const readMe = (id?: string) => { try { return id ? localStorage.getItem(meKey(id)) : null; } catch { return null; } };
const writeMe = (id: string, name: string) => { try { localStorage.setItem(meKey(id), name); } catch { /* fine */ } };

export function Trip({ plan: initialPlan, mode, shared, onSave, onNew, initialKeeps }: {
  plan: TripPlan;
  /** Demo trips arrive with ideas already kept, so every section is filled in. */
  initialKeeps?: string[];
  mode: RunMode;
  shared?: SharedTrip;
  onSave: (t: SavedTrip) => void;
  onNew: () => void;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const req = plan.request;
  const place = getPlace(req.destination);
  const [flightId, setFlightId] = useState(plan.selectedFlightId);
  const [stayId, setStayId] = useState(plan.selectedStayId);

  // People swiping. Index 0 is whoever made the trip.
  const [people, setPeople] = useState<Person[]>(shared?.people.length ? shared.people
    : [{ name: "You", decisions: Object.fromEntries((initialKeeps ?? []).map((id) => [id, "keep" as const])) }]);
  const [active, setActive] = useState(0);
  const [history, setHistory] = useState<{ who: number; id: string }[]>([]);
  const [sharedId, setSharedId] = useState<string | undefined>(shared?.id);
  const [myName, setMyName] = useState<string | null>(() => readMe(shared?.id));
  const [share, setShare] = useState<ShareState>({ kind: "idle" });
  const [ownerPrompt, setOwnerPrompt] = useState(false);
  const [ownerNameDraft, setOwnerNameDraft] = useState("");

  // Ask-the-crew state
  const [busy, setBusy] = useState(false);
  const [changeStatus, setChangeStatus] = useState<ChangeStatus>({});
  const [changeError, setChangeError] = useState<string | null>(null);

  // Extras
  const [photo, setPhoto] = useState<CityPhoto | null>(null);
  const [weather, setWeather] = useState<TripWeather | null>(null);

  const flight = plan.flights.find((f) => f.id === flightId) ?? plan.flights[0];
  const stay = plan.stays.find((s) => s.id === stayId) ?? plan.stays[0];
  const me = people[active] ?? people[0];
  const kept = people.length > 1 ? groupKeeps(plan.activities, people) : plan.activities.filter((a) => people[0].decisions[a.id] === "keep");
  const lines = useMemo(() => budgetLines(req, flight, stay, kept, plan.transitEstimate), [req, flight, stay, kept, plan.transitEstimate]);
  const total = lines.reduce((s, l) => s + l.actual, 0);
  const note = explain(lines, req.budget);
  const wetDays = weather?.days.filter(isWetDay).length ?? 0;
  const landing = getAirport(flight.destination);
  const transfer = landing ? airportTransfer(landing, stay, taxiRate(landing.countryCode)) : undefined;

  // The day plan: suggested by the crew, then whatever the traveler changes in "Edit days".
  const [edits, setEdits] = useState<PlannerEdits>(NO_EDITS);
  const days = dayCount(plan.nights, flight.arriveNextDay);
  const wet = Array.from({ length: days }, (_, i) => {
    const w = weather?.days.find((d) => d.date === isoPlus(req.startDate, i + (flight.arriveNextDay ? 1 : 0)));
    return w ? isWetDay(w) : false;
  });
  const dayDates = Array.from({ length: days }, (_, i) => isoPlus(req.startDate, i + (flight.arriveNextDay ? 1 : 0)));
  const schedule = scheduleFor(kept, days, wet, edits, dayDates);

  // Events agent: searches the web for what's on during the trip, after the board is on screen.
  const [events, setEvents] = useState<EventsState>({ kind: mode === "server" ? "loading" : "off" });
  useEffect(() => {
    if (mode !== "server") return;
    let live = true;
    fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: plan.destinationName, country: plan.country, startDate: req.startDate, endDate: req.endDate }),
    })
      .then((r) => r.json() as Promise<{ events?: Activity[]; reason?: string }>)
      .then((j) => {
        if (!live) return;
        const found = j.events ?? [];
        if (j.reason === "off") { setEvents({ kind: "off" }); return; }
        setEvents(found.length ? { kind: "ready", events: found } : { kind: "none" });
        // Events join the deck (first), so they can be swiped, kept and scheduled like anything else.
        if (found.length) setPlan((p) => ({ ...p, activities: [...found, ...p.activities.filter((a) => !a.id.startsWith("ev-"))] }));
      })
      .catch(() => live && setEvents({ kind: "none" }));
    return () => { live = false; };
  }, [mode, plan.destinationName, plan.country, req.startDate, req.endDate]);
  const scheduledIds = new Set(schedule.flat().map((a) => a.id));
  const snapshot: TripSnapshot = {
    plan, flight, stay, schedule, lines, total, weather: weather?.days,
    otherIdeas: plan.activities.filter((a) => !scheduledIds.has(a.id)),
  };

  useEffect(() => {
    let live = true;
    fetchCityPhoto(plan.destinationName, plan.country).then((p) => live && setPhoto(p));
    const spot = plan.center ?? getAirport(req.destination);
    if (spot) fetchWeather(spot.lat, spot.lng, req.startDate, req.endDate).then((w) => live && setWeather(w));
    return () => { live = false; };
  }, [plan.destinationName, plan.country, plan.center, req.destination, req.startDate, req.endDate]);

  // Guests opening a shared link swipe as themselves.
  useEffect(() => {
    if (!sharedId || !myName) return;
    setPeople((ps) => {
      const i = ps.findIndex((p) => p.name.toLowerCase() === myName.toLowerCase());
      if (i >= 0) { setActive(i); return ps; }
      setActive(ps.length);
      return [...ps, { name: myName, decisions: {} }];
    });
  }, [sharedId, myName]);

  // Save my swipes to the shared trip, and pick up everyone else's every few seconds.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushVotes = (person: Person) => {
    if (!sharedId || mode !== "server") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/trips/${sharedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(person) }).catch(() => {});
    }, 500);
  };
  useEffect(() => {
    if (!sharedId || mode !== "server") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/trips/${sharedId}`, { cache: "no-store" });
        if (!res.ok) return;
        const remote = (await res.json()) as SharedTrip;
        setPeople((local) => {
          const mine = local[active];
          const merged = remote.people.map((p) => (mine && p.name.toLowerCase() === mine.name.toLowerCase() ? mine : p));
          if (mine && !merged.some((p) => p.name.toLowerCase() === mine.name.toLowerCase())) merged.push(mine);
          const idx = merged.findIndex((p) => mine && p.name === mine.name);
          if (idx >= 0 && idx !== active) setActive(idx);
          return merged;
        });
      } catch { /* try again next tick */ }
    }, 8000);
    return () => clearInterval(t);
  }, [sharedId, mode, active]);

  function decide(id: string, d: Decision) {
    setPeople((ps) => {
      const next = ps.map((p, i) => (i === active ? { ...p, decisions: { ...p.decisions, [id]: d } } : p));
      pushVotes(next[active]);
      return next;
    });
    setHistory((h) => [...h, { who: active, id }]);
  }

  function undo() {
    const last = [...history].reverse().find((h) => h.who === active);
    if (!last) return;
    setHistory((h) => { const i = h.lastIndexOf(last); return h.filter((_, j) => j !== i); });
    setPeople((ps) => {
      const next = ps.map((p, i) => {
        if (i !== active) return p;
        const d = { ...p.decisions };
        delete d[last.id];
        return { ...p, decisions: d };
      });
      pushVotes(next[active]);
      return next;
    });
  }

  async function ask(text: string) {
    setBusy(true);
    setChangeError(null);
    setChangeStatus({});
    const current = { ...plan, selectedFlightId: flight.id, selectedStayId: stay.id };
    let updated: TripPlan | null = null;
    await runRevise(current, text, mode, (e) => {
      if (e.type === "status") setChangeStatus((s) => ({ ...s, [e.agent as AgentId]: { state: e.state, message: e.message } }));
      if (e.type === "error") setChangeError(e.message);
      if (e.type === "plan") updated = e.plan;
    }).catch(() => setChangeError("Couldn't reach the crew. Check your connection and try again."));
    if (updated) {
      const u: TripPlan = updated;
      setPlan(u);
      setFlightId(u.selectedFlightId);
      setStayId(u.selectedStayId);
      if (sharedId && mode === "server") {
        fetch(`/api/trips/${sharedId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: u }) }).catch(() => {});
      }
    }
    setBusy(false);
    setTimeout(() => setChangeStatus({}), 4000);
  }

  async function shareLink(ownerName?: string) {
    if (mode !== "server") { setShare({ kind: "unavailable" }); return; }
    const named = ownerName ? people.map((p, i) => (i === 0 ? { ...p, name: ownerName } : p)) : people;
    if (ownerName) setPeople(named);
    try {
      let id = sharedId;
      if (!id) {
        setShare({ kind: "working" });
        const res = await fetch("/api/trips", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: { ...plan, selectedFlightId: flight.id, selectedStayId: stay.id }, people: named }),
        });
        if (!res.ok) throw new Error();
        id = ((await res.json()) as { id: string }).id;
        setSharedId(id);
        writeMe(id, named[0].name);
        setMyName(named[0].name);
        window.history.replaceState(null, "", `/t/${id}`);
      }
      const url = `${window.location.origin}/t/${id}`;
      let copied = false;
      try { await navigator.clipboard.writeText(url); copied = true; } catch { /* show the link to copy by hand */ }
      setShare({ kind: "ready", url, copied });
    } catch {
      setShare({ kind: "error", message: "Couldn't make a link right now. Try again in a moment." });
    }
  }

  const needsGuestName = Boolean(sharedId && !myName);

  return (
    <div className="trip-grid">
      <header className="trip-hero">
        <div style={{ minWidth: 0 }}>
          <p className="muted" style={{ margin: "0 0 6px", fontWeight: 600 }}>
            {shortDate(req.startDate)} to {shortDate(req.endDate)}, {plan.nights} nights{plan.country ? ` in ${plan.country}` : ""}
          </p>
          <h1 className="trip-city">{plan.destinationName}</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
            <a className="link-chip" href={cityMap(plan)} target="_blank" rel="noopener noreferrer"><Pin size={15} /> Open in Google Maps</a>
            {plan.source === "demo" && <span className="demo-pill" title="Real places from travel guides; prices are estimates. Add API keys for live fares and rates.">Estimated prices</span>}
          </div>
        </div>
        {photo && (
          <figure className="hero-photo">
            <img src={photo.url} alt={`${plan.destinationName}`} onError={() => setPhoto(null)} />
            <figcaption>Photo via <a href={photo.pageUrl} target="_blank" rel="noreferrer">Wikipedia</a></figcaption>
          </figure>
        )}
      </header>

      {needsGuestName ? (
        <GuestName onDone={(n) => { writeMe(sharedId!, n); setMyName(n); }} />
      ) : (
        <div style={{ gridColumn: "1 / -1" }}>
          <ChangeBar busy={busy} status={changeStatus} error={changeError} onAsk={ask} />
        </div>
      )}

      <div className="stack" style={{ gap: 28 }}>
        <section className="panel" aria-labelledby="budget-h">
          <h2 className="h2" id="budget-h">Budget jar</h2>
          <BudgetJar lines={lines} budget={req.budget} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
            <CrewAvatar agent="budget" state={total <= req.budget ? "done" : "error"} size={48} />
            <span className="bubble" style={{ marginTop: 0 }}>{note}</span>
          </div>
        </section>

        <WeatherCard weather={weather} movedOutdoor={wetDays && kept.some((a) => !a.indoor) ? 1 : 0} />
        <BoardingPass flights={plan.flights} selectedId={flight.id} onSelect={setFlightId} links={flightLinks(plan, flight)} />
        <StayPolaroid stays={plan.stays} selectedId={stay.id} onSelect={setStayId} links={stayLinks(plan, stay, flight)} />
        <section className="panel" aria-labelledby="around-h">
          <h2 className="h2" id="around-h">Getting there and around</h2>
          {transfer && (
            <p className="small" style={{ marginTop: -4 }}>
              <b>From {flight.destination} airport to {stay.name}</b> ({transfer.km} km): about {transfer.taxiMinutes} min by taxi (~${transfer.taxiPrice}),
              or about {transfer.transitMinutes} min by public transport. Estimates; check the directions link for today's options.
            </p>
          )}
          <LinkRow links={extraLinks(plan, stay, flight)} label="Transport and more" />
        </section>
      </div>

      <div className="stack" style={{ gap: 28 }}>
        <Friends
          people={people}
          active={active}
          onSwitch={setActive}
          onAdd={(name) => { setPeople((ps) => [...ps, { name, decisions: {} }]); setActive(people.length); }}
          activities={plan.activities}
          shareState={share}
          onShare={() => {
            if (!sharedId && people[0].name === "You" && mode === "server") {
              setOwnerPrompt(true); // ask for a name inline first
              return;
            }
            void shareLink();
          }}
        />
        {ownerPromptNode()}

        <ActivityDeck
          activities={plan.activities}
          decisions={me.decisions}
          suggested={plan.suggestedActivityIds}
          travelers={req.travelers}
          mapFor={(a) => activityMap(plan, a)}
          onDecide={decide}
          onUndo={undo}
          onReset={() => {
            setPeople((ps) => ps.map((p, i) => (i === active ? { ...p, decisions: {} } : p)));
            setHistory((h) => h.filter((x) => x.who !== active));
          }}
        />

        <Events state={events} city={plan.destinationName} kept={new Set(kept.map((a) => a.id))} travelers={req.travelers} onKeep={(id) => decide(id, "keep")} />
        <Itinerary
          schedule={schedule}
          startDate={req.startDate}
          arriveNextDay={flight.arriveNextDay}
          travelers={req.travelers}
          weather={weather?.days}
          linksFor={(a) => activityLinks(plan, a)}
          edits={edits}
          onEdits={setEdits}
          allKept={kept}
          stay={stay}
          city={plan.destinationName}
        />
        <TripMap stay={stay} activities={schedule.flat()} center={plan.center} stayUrl={stayMap(plan, stay)} mapFor={(a) => activityMap(plan, a)} />
        <EmailPlan snapshot={snapshot} serverMode={mode === "server"} />

        <div className="stack" style={{ gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary btn-big"
            onClick={() => onSave({
              code: req.destination,
              city: plan.destinationName,
              country: plan.country,
              color: place?.color ?? "#3d7bff",
              startDate: req.startDate,
              endDate: req.endDate,
              total,
              savedAt: Date.now(),
            })}
          >
            <Book size={24} /> Stamp my passport
          </button>
          <button type="button" className="btn" onClick={onNew}><Plane /> Plan another trip</button>
        </div>
      </div>
      <ChatBot snapshot={snapshot} serverMode={mode === "server"} />
    </div>
  );

  // Inline "what's your name" step before the first share link.
  function ownerPromptNode() {
    if (!ownerPrompt) return null;
    return (
      <form className="panel" onSubmit={(e) => { e.preventDefault(); const n = ownerNameDraft.trim(); if (n) { setOwnerPrompt(false); void shareLink(n); } }}>
        <label className="field-label" htmlFor="owner-name">Your name, so friends know whose picks are whose</label>
        <div className="change-form">
          <input id="owner-name" className="input" value={ownerNameDraft} maxLength={24} autoFocus onChange={(e) => setOwnerNameDraft(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={!ownerNameDraft.trim()}>Create link</button>
        </div>
      </form>
    );
  }
}

function GuestName({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form className="panel" style={{ gridColumn: "1 / -1" }} onSubmit={(e) => { e.preventDefault(); if (name.trim()) onDone(name.trim()); }}>
      <h2 className="h2">You're invited to plan this trip</h2>
      <label className="field-label" htmlFor="guest-name">What's your name?</label>
      <div className="change-form">
        <input id="guest-name" className="input" value={name} maxLength={24} autoFocus onChange={(e) => setName(e.target.value)} placeholder="So the group knows your picks" />
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Start swiping</button>
      </div>
    </form>
  );
}
