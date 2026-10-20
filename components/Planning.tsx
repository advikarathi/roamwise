"use client";
import { AnimatePresence, motion } from "motion/react";
import { getPlace } from "@/lib/destinations";
import type { AgentId, AgentState, TripRequest } from "@/lib/types";
import { CREW, CrewAvatar } from "./CrewAvatar";
import { RouteArc } from "./RouteArc";

export type CrewStatus = Record<AgentId, { state: AgentState; message: string }>;

export const ORDER: AgentId[] = ["budget", "flights", "stays", "activities"];

export function Planning({ request, crew, error, onBack }: {
  request: TripRequest; crew: CrewStatus; error: string | null; onBack: () => void;
}) {
  const dest = getPlace(request.destination);
  const allDone = ORDER.every((a) => crew[a].state === "done");

  return (
    <div className="narrow stack">
      <div>
        <h1 className="headline" style={{ fontSize: "clamp(40px, 10vw, 60px)" }}>
          {allDone ? `${dest?.city ?? request.destination} is ready` : `Planning ${dest?.city ?? request.destination}`}
        </h1>
        <p className="lede" style={{ marginBottom: 0 }}>
          {allDone ? "Opening your trip board." : "Flights and stays search at the same time. Juno plans around wherever you sleep."}
        </p>
      </div>

      <RouteArc from={request.origin} to={request.destination} flying={!allDone && !error} color={dest?.color} />

      <div className="crew" aria-live="polite">
        {ORDER.map((id) => {
          const s = crew[id];
          return (
            <motion.div key={id} className="crew-card" data-state={s.state} layout>
              <CrewAvatar agent={id} state={s.state} />
              <div>
                <div className="crew-name">{CREW[id].name} <span className="crew-role">{CREW[id].role}</span></div>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={s.message}
                    className="bubble"
                    style={s.state === "done" ? { background: CREW[id].color + "33" } : undefined}
                    initial={{ opacity: 0, scale: 0.85, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  >
                    {s.message}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {error && (
        <div className="error-box" role="alert">
          {error}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={onBack}>Change trip details</button>
          </div>
        </div>
      )}
    </div>
  );
}
