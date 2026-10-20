"use client";
import { AnimatePresence, motion } from "motion/react";
import type { OutLink } from "@/lib/links";
import type { FlightOption } from "@/lib/types";
import { LinkRow } from "./LinkRow";

const hours = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

/** The flight, as a boarding pass. Tabs swap between the three fares Skye shortlisted. */
export function BoardingPass({ flights, selectedId, onSelect, links }: {
  flights: FlightOption[]; selectedId: string; onSelect: (id: string) => void; links: OutLink[];
}) {
  const f = flights.find((x) => x.id === selectedId) ?? flights[0];
  // Decorative barcode, stable per flight.
  const bars = Array.from({ length: 38 }, (_, i) => ((f.id.charCodeAt(i % f.id.length) + i * 7) % 4) + 1);

  return (
    <section aria-labelledby="flight-h">
      <h2 className="h2" id="flight-h">Your flight</h2>
      <div className="fare-tabs" role="group" aria-label="Fare options">
        {flights.map((x) => (
          <button key={x.id} type="button" className="fare-tab" aria-pressed={x.id === f.id} onClick={() => onSelect(x.id)}>
            {x.label} <span style={{ fontWeight: 500 }}>${x.price.toLocaleString()}</span>
          </button>
        ))}
      </div>

      <div className="pass">
        <div className="pass-top">
          <span>{f.sample ? (f.carrierCode ? `${f.carrier} · practice data` : "Sample fare") : f.carrier}{!f.sample && f.flightNumbers?.length ? ` · ${f.flightNumbers.join(" + ")}` : ""}</span>
          <span>{f.stops === 0 ? "Nonstop" : `1 stop in ${f.via}`}</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={f.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
            <div className="pass-body">
              <div>
                <div className="pass-code">{f.origin}</div>
                <div className="pass-time">Departs {f.departTime}</div>
              </div>
              <div style={{ textAlign: "center", padding: "0 4px" }}>
                <svg width="64" height="24" viewBox="0 0 64 24" aria-hidden="true">
                  <path d="M2 12h60" stroke="#1b1f5e" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
                  <path d="M26 14l16-3-3-4h-3l-4 4-6-1-2-4h-2l1 6z" fill="#fff" stroke="#1b1f5e" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
                <div className="small" style={{ fontWeight: 700 }}>{hours(f.durationMinutes)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="pass-code">{f.destination}</div>
                <div className="pass-time">{f.arriveTime ? `Lands ${f.arriveTime}${f.arriveNextDay ? " +1" : ""}` : `${hours(f.durationMinutes)} flight`}</div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="pass-tear" />
        <div className="pass-foot">
          <div>
            <div className="pass-price">${f.price.toLocaleString()}</div>
            <div className="small muted">Round trip, all travelers</div>
          </div>
          <svg width="150" height="40" viewBox="0 0 150 40" aria-hidden="true">
            {bars.reduce<{ x: number; els: React.ReactNode[] }>((acc, w, i) => {
              if (i % 2 === 0) acc.els.push(<rect key={i} x={acc.x} y="0" width={w} height="40" fill="#1b1f5e" />);
              acc.x += w + 1;
              return acc;
            }, { x: 0, els: [] }).els}
          </svg>
        </div>
      </div>
      <p className="small muted" style={{ margin: "14px 0 6px", fontWeight: 600 }}>
        {f.sample
          ? f.carrierCode
            ? "This fare is Duffel test data: the airline is real but the flight, times and price are made up, so there is no exact flight to open. A live Duffel key gives real flights. These links search your dates, travelers and stops."
            : "This is a sample fare (no live flight data yet), so there is no exact flight to open. These links search your dates, travelers and stops; pick the flight you like there."
          : f.recentFare
            ? `Real fare: ${f.carrier} ${f.flightNumbers?.join(" + ") ?? ""}, found by travelers in the last 48 hours. Fares change; "This exact fare" opens it with today's price.`
            : `Find this ${f.carrier} flight${f.flightNumbers?.length ? ` (${f.flightNumbers.join(" + ")})` : ""} on`}
      </p>
      <LinkRow links={links} label="Book flights" />
    </section>
  );
}
