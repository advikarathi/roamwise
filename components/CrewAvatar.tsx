"use client";
import { motion, useReducedMotion } from "motion/react";
import type { AgentId, AgentState } from "@/lib/types";

export const CREW: Record<AgentId, { name: string; role: string; color: string }> = {
  flights: { name: "Skye", role: "Flights agent", color: "#3d7bff" },
  stays: { name: "Nest", role: "Stays agent", color: "#ffc93c" },
  activities: { name: "Juno", role: "Activities agent", color: "#2ec4a0" },
  budget: { name: "Penny", role: "Budget agent", color: "#ff7fbf" },
};

/** A little character for each agent. Bobs while working, sleeps while waiting, beams when done. */
export function CrewAvatar({ agent, state, size = 72 }: { agent: AgentId; state: AgentState; size?: number }) {
  const reduce = useReducedMotion();
  const { color } = CREW[agent];
  const working = state === "working";
  const ink = "#1b1f5e";

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-hidden="true"
      animate={working && !reduce ? { y: [0, -5, 0], rotate: [0, -3, 3, 0] } : { y: 0, rotate: 0 }}
      transition={working ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
      style={{ overflow: "visible", opacity: state === "waiting" ? 0.75 : 1 }}
    >
      {/* body */}
      <path d="M14 46c0-17 11-28 26-28s26 11 26 28c0 14-11 24-26 24S14 60 14 46z" fill={color} stroke={ink} strokeWidth="3" />
      {/* cheeks */}
      <circle cx="26" cy="52" r="4" fill="#fff" opacity="0.45" />
      <circle cx="54" cy="52" r="4" fill="#fff" opacity="0.45" />

      {/* eyes */}
      {state === "waiting" ? (
        <g stroke={ink} strokeWidth="3" strokeLinecap="round">
          <path d="M28 44h7M45 44h7" />
        </g>
      ) : state === "done" ? (
        <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M27 45q4-5 8 0M45 45q4-5 8 0" />
        </g>
      ) : (
        <g>
          <circle cx="31" cy="43" r="6" fill="#fff" stroke={ink} strokeWidth="2.5" />
          <circle cx="49" cy="43" r="6" fill="#fff" stroke={ink} strokeWidth="2.5" />
          <motion.g animate={working && !reduce ? { x: [-1.5, 1.5, -1.5] } : { x: 0 }} transition={{ duration: 1.4, repeat: Infinity }}>
            <circle cx="32" cy="44" r="2.6" fill={ink} />
            <circle cx="50" cy="44" r="2.6" fill={ink} />
          </motion.g>
        </g>
      )}

      {/* mouth */}
      {state === "error" ? (
        <path d="M34 59q6-5 12 0" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d={state === "done" ? "M32 55q8 8 16 0" : "M35 56q5 3 10 0"} stroke={ink} strokeWidth="3" fill={state === "done" ? "#fff" : "none"} strokeLinecap="round" />
      )}

      {/* accessories tell you who's who */}
      {agent === "flights" && (
        <g>
          <path d="M20 24q20-14 40 0l-4 6H24z" fill="#fff" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M16 30h48" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M36 22l4-3 4 3" stroke={color} strokeWidth="2.5" fill="none" />
        </g>
      )}
      {agent === "stays" && (
        <g>
          <path d="M22 26L40 10l18 16" fill="#ff5a3c" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <rect x="49" y="10" width="6" height="10" fill="#ff5a3c" stroke={ink} strokeWidth="2.5" />
        </g>
      )}
      {agent === "activities" && (
        <g>
          <path d="M60 30V6" stroke={ink} strokeWidth="3" strokeLinecap="round" />
          <path d="M60 7l14 5-14 5z" fill="#ff5a3c" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      )}
      {agent === "budget" && (
        <g>
          <circle cx="62" cy="18" r="10" fill="#ffc93c" stroke={ink} strokeWidth="3" />
          <path d="M62 12v12M65 14.5c-1-1.2-6-1.5-6 1 0 2.8 6 1.3 6 4 0 2.4-5 2.2-6 .8" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* zzz while waiting */}
      {state === "waiting" && (
        <text x="60" y="34" fontSize="13" fontWeight="800" fill={ink} fontFamily="system-ui">z z</text>
      )}
      {/* check badge when done */}
      {state === "done" && (
        <g>
          <circle cx="66" cy="62" r="10" fill="#fff" stroke={ink} strokeWidth="3" />
          <path d="M61 62l3.5 3.5L71 59" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </motion.svg>
  );
}
