"use client";
import { useReducedMotion } from "motion/react";

/** Dotted flight path between two airport codes. The plane loops while the crew works and parks on arrival. */
export function RouteArc({ from, to, flying, color = "#3d7bff" }: { from: string; to: string; flying: boolean; color?: string }) {
  const reduce = useReducedMotion();
  const path = "M44 118 Q180 -6 316 118";
  const ink = "#1b1f5e";
  const plane = (
    <g>
      <path d="M-13 3 L13 -1 L9 -6 L4 -6 L-1 -1 L-9 -3 L-12 -9 L-15 -9 L-13 -1 Z" fill="#fff" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M-4 1 L-8 9 L-4 9 L3 1" fill="#fff" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </g>
  );

  return (
    <svg className="route" viewBox="0 0 360 150" role="img" aria-label={`Flight path from ${from} to ${to}`}>
      <path d={path} fill="none" stroke={ink} strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" />
      {[{ x: 44, code: from }, { x: 316, code: to }].map((p) => (
        <g key={p.code + p.x}>
          <circle cx={p.x} cy={118} r={9} fill={p.x === 316 ? color : "#fff"} stroke={ink} strokeWidth="2.5" />
          <text x={p.x} y={145} textAnchor="middle" fontFamily="'Space Mono', monospace" fontWeight="700" fontSize="15" fill={ink}>{p.code}</text>
        </g>
      ))}
      {flying && !reduce ? (
        <g>
          {plane}
          <animateMotion dur="3.2s" repeatCount="indefinite" rotate="auto" path={path} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.55 1" />
        </g>
      ) : (
        <g transform={flying ? "translate(180 56)" : "translate(302 98) rotate(38)"}>{plane}</g>
      )}
    </svg>
  );
}
