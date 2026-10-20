"use client";
import { motion, useReducedMotion } from "motion/react";
import type { SavedTrip } from "./Trip";
import { Stamp } from "./Stamp";

function stampDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "2-digit" }).toUpperCase();
}

export function Passport({ trips, onPlan }: { trips: SavedTrip[]; onPlan: () => void }) {
  const reduce = useReducedMotion();
  const countries = new Set(trips.map((t) => t.country)).size;

  return (
    <div className="narrow stack">
      <div className="passport-book">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 30, letterSpacing: "-0.02em" }}>My passport</div>
            <div style={{ opacity: 0.85 }}>
              {trips.length ? `${trips.length} ${trips.length === 1 ? "trip" : "trips"} planned, ${countries} ${countries === 1 ? "country" : "countries"}` : "Every trip you save gets a stamp"}
            </div>
          </div>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffc93c" strokeWidth="1.6" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
          </svg>
        </div>
        <div className="passport-pages">
          {trips.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", display: "grid", placeItems: "center", textAlign: "center", gap: 12 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>No stamps yet. Plan a trip and save it to get your first one.</p>
              <button type="button" className="btn" onClick={onPlan}>Plan a trip</button>
            </div>
          ) : (
            trips.map((t, i) => (
              <motion.div key={t.savedAt} className="stamp-cell" initial={reduce ? false : { scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 18 }}>
                <Stamp city={t.city} code={t.code} date={stampDate(t.startDate)} color={t.color} tilt={((i * 37) % 24) - 12} />
                <span className="small muted">${t.total.toLocaleString()} total</span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
