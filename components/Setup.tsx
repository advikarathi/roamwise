"use client";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DESTINATIONS, estimateTripCost, findAirport, getPlace } from "@/lib/destinations";
import { AirportSearch } from "./AirportSearch";
import type { StayType, TripRequest, Vibe } from "@/lib/types";
import { nightsBetween } from "@/lib/agents/context";
import { Dice, Plane, VibeIcon } from "./Icons";

const VIBES: { id: Vibe; label: string }[] = [
  { id: "food", label: "Food" },
  { id: "culture", label: "Culture" },
  { id: "beach", label: "Beaches" },
  { id: "nightlife", label: "Nightlife" },
  { id: "outdoors", label: "Outdoors" },
  { id: "chill", label: "Slow & chill" },
];

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultRequest(): TripRequest {
  return {
    origin: "BOS",
    destination: "LIS",
    startDate: isoDaysFromNow(25),
    endDate: isoDaysFromNow(30),
    travelers: 1,
    budget: 1500,
    vibes: ["food", "culture"],
    stayType: "either",
  };
}

/** Ready-made trips (public/demos), so a visitor sees a full plan in one click. */
export const DEMO_TRIPS = [
  { code: "LIS", city: "Lisbon", flag: "🇵🇹" },
  { code: "HND", city: "Tokyo", flag: "🇯🇵" },
  { code: "CDG", city: "Paris", flag: "🇫🇷" },
];

export function Setup({ initial, onSubmit, onDemo }: { initial: TripRequest; onSubmit: (r: TripRequest) => void; onDemo?: (code: string) => void }) {
  const [req, setReq] = useState<TripRequest>(initial);
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState(5);
  const [hint, setHint] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reduce = useReducedMotion();

  const set = <K extends keyof TripRequest>(k: K, v: TripRequest[K]) => setReq((r) => ({ ...r, [k]: v }));
  const nights = nightsBetween(req.startDate, req.endDate);
  const datesOk = req.endDate > req.startDate;

  function surprise() {
    if (rolling) return;
    const origin = findAirport(req.origin);
    if (!origin) return;
    const fits = DESTINATIONS.filter((d) => d.code !== req.destination)
      .map((d) => ({ d, cost: estimateTripCost(origin, d, nights, req.travelers), match: d.vibes.filter((v) => req.vibes.includes(v)).length }))
      .filter((x) => x.cost <= req.budget);
    if (!fits.length) {
      setHint(`Nothing fits $${req.budget.toLocaleString()} for ${nights} nights yet. Try a bigger budget or a shorter trip.`);
      return;
    }
    const best = Math.max(...fits.map((f) => f.match));
    const pool = fits.filter((f) => f.match === best);
    const pick = pool[Math.floor(Math.random() * pool.length)].d;

    setHint(null);
    setRolling(true);
    let ticks = 0;
    const timer = setInterval(() => {
      setFace(1 + Math.floor(Math.random() * 6));
      if (++ticks > (reduce ? 1 : 9)) {
        clearInterval(timer);
        setRolling(false);
        set("destination", pick.code);
        setHint(`${pick.city} fits your budget and your vibe.`);
        cardRefs.current[pick.code]?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
      }
    }, 70);
  }

  function toggleVibe(v: Vibe) {
    set("vibes", req.vibes.includes(v) ? req.vibes.filter((x) => x !== v) : [...req.vibes, v]);
  }

  return (
    <form
      className="narrow stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (datesOk) onSubmit(req);
      }}
    >
      <div>
        <h1 className="headline">Where to next?</h1>
        <p className="lede">Set a budget and a vibe. Your crew of four agents finds the flights, the place to stay, and what to do.</p>
        {onDemo && (
          <div className="demo-row">
            <span className="small" style={{ fontWeight: 700 }}>Just looking? Open a finished trip:</span>
            {DEMO_TRIPS.map((d) => (
              <button key={d.code} type="button" className="sticker" onClick={() => onDemo(d.code)}>
                <span aria-hidden="true">{d.flag}</span> {d.city}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="stack" style={{ gap: 4 }}>
        <AirportSearch id="destination" label="Going to" value={req.destination} placeholder="Search any city or airport"
          onChange={(code) => set("destination", code)} />
        <p className="small muted" style={{ margin: "6px 0 0" }}>Or pick a favorite, or roll the dice.</p>
        <div className="postcards">
          <motion.button type="button" className="dice-btn" onClick={surprise} whileTap={{ scale: 0.94 }} aria-label="Surprise me with a city that fits my budget">
            <motion.span animate={rolling && !reduce ? { rotate: [0, 90, 180, 270, 360] } : { rotate: 0 }} transition={{ duration: 0.5, repeat: rolling ? Infinity : 0 }} style={{ display: "inline-flex" }}>
              <Dice face={face} />
            </motion.span>
            Surprise me
          </motion.button>
          {[...(DESTINATIONS.some((d) => d.code === req.destination) ? [] : [getPlace(req.destination)].filter((p) => !!p)), ...DESTINATIONS].map((d) => {
            const selected = req.destination === d.code;
            return (
              <motion.button
                key={d.code}
                ref={(el) => { cardRefs.current[d.code] = el; }}
                type="button"
                className="postcard"
                aria-pressed={selected}
                onClick={() => set("destination", d.code)}
                animate={selected && !reduce ? { rotate: [-2, 2, -1, 0], y: -4 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ background: `linear-gradient(${d.color} 0 44%, #fff 44% 100%)` }}
              >
                <span className="code" style={{ color: "#1b1f5e" }}>{d.code}</span>
                <span className="postmark" style={{ color: "#1b1f5e" }} />
                <span className="city">{d.city}</span>
              </motion.button>
            );
          })}
        </div>
        {hint && <p className="small" role="status" style={{ margin: "4px 0 0", fontWeight: 600 }}>{hint}</p>}
      </section>

      <div className="panel stack">
        <div className="row">
          <div className="grow" style={{ flexBasis: "100%" }}>
            <AirportSearch id="origin" label="Flying from" value={req.origin} placeholder="Your city or airport"
              onChange={(code) => set("origin", code)} />
          </div>
          <div className="grow">
            <span className="field-label">Travelers</span>
            <div className="stepper" style={{ maxWidth: 220 }}>
              <button type="button" aria-label="Fewer travelers" disabled={req.travelers <= 1} onClick={() => set("travelers", req.travelers - 1)}>−</button>
              <span style={{ fontWeight: 800 }} aria-live="polite">{req.travelers}</span>
              <button type="button" aria-label="More travelers" disabled={req.travelers >= 6} onClick={() => set("travelers", req.travelers + 1)}>+</button>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="grow">
            <label className="field-label" htmlFor="start">Leave</label>
            <input id="start" type="date" className="input" value={req.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="grow">
            <label className="field-label" htmlFor="end">Come back</label>
            <input id="end" type="date" className="input" value={req.endDate} min={req.startDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
        </div>
        {!datesOk && <p className="small" style={{ margin: 0, color: "#c2321b", fontWeight: 600 }}>Pick a return date after you leave.</p>}

        <div>
          <div className="budget-readout">
            <label className="field-label" htmlFor="budget" style={{ marginBottom: 4 }}>Total budget</label>
            <span className="budget-number">${req.budget.toLocaleString()}</span>
          </div>
          <input id="budget" className="range" type="range" min={400} max={6000} step={50} value={req.budget}
            onChange={(e) => set("budget", Number(e.target.value))} />
          <p className="small muted" style={{ margin: 0 }}>
            Flights, stay and fun for {req.travelers === 1 ? "you" : `${req.travelers} people`}, {nights} {nights === 1 ? "night" : "nights"}.
          </p>
        </div>

        <div>
          <span className="field-label">Your vibe</span>
          <div className="stickers">
            {VIBES.map((v, i) => {
              const on = req.vibes.includes(v.id);
              return (
                <motion.button key={v.id} type="button" className="sticker" aria-pressed={on} onClick={() => toggleVibe(v.id)}
                  whileTap={{ scale: 0.9 }} animate={{ rotate: on ? (i % 2 ? 3 : -3) : 0, scale: on ? 1.04 : 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}>
                  <VibeIcon vibe={v.id} size={20} />
                  {v.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="field-label">Where you'll sleep</span>
          <div className="segmented">
            {(["hotel", "apartment", "either"] as StayType[]).map((s) => (
              <button key={s} type="button" aria-pressed={req.stayType === s} onClick={() => set("stayType", s)}>
                {s === "hotel" ? "Hotel" : s === "apartment" ? "Apartment" : "Either"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <motion.button type="submit" className="btn btn-primary btn-big" whileTap={{ scale: 0.98 }} disabled={!datesOk}>
        <Plane size={24} /> Send the crew
      </motion.button>
    </form>
  );
}
