"use client";
import { motion } from "motion/react";
import type { BudgetLine } from "@/lib/types";

export const CATEGORY_COLOR: Record<BudgetLine["category"], string> = {
  flights: "#3d7bff",
  stay: "#ffc93c",
  activities: "#2ec4a0",
  transit: "#ff7fbf",
};

const LABEL: Record<BudgetLine["category"], string> = {
  flights: "Flights",
  stay: "Stay",
  activities: "Things to do",
  transit: "Getting around",
};

/** A jar that fills with one layer per category. Over budget? It spills. */
export function BudgetJar({ lines, budget }: { lines: BudgetLine[]; budget: number }) {
  const total = lines.reduce((s, l) => s + l.actual, 0);
  const left = budget - total;
  const top = 34;
  const bottom = 150;
  const inner = bottom - top;
  let cursor = bottom;
  const ink = "#1b1f5e";

  return (
    <div className="jar-wrap">
      <svg width="120" height="160" viewBox="0 0 120 160" role="img" aria-label={`$${total.toLocaleString()} of $${budget.toLocaleString()} used`}>
        <defs>
          <clipPath id="jar-inside">
            <path d="M24 34h72v98a18 18 0 0 1-18 18H42a18 18 0 0 1-18-18z" />
          </clipPath>
        </defs>
        <g clipPath="url(#jar-inside)">
          <rect x="0" y="0" width="120" height="160" fill="#fff" />
          {lines.map((l) => {
            const h = Math.min(inner, (l.actual / budget) * inner);
            cursor -= h;
            return (
              <motion.rect key={l.category} x="0" width="120" fill={CATEGORY_COLOR[l.category]} stroke={ink} strokeWidth="2"
                initial={false} animate={{ y: cursor, height: Math.max(0, h) }} transition={{ type: "spring", stiffness: 160, damping: 20 }} />
            );
          })}
        </g>
        <path d="M24 34h72v98a18 18 0 0 1-18 18H42a18 18 0 0 1-18-18z" fill="none" stroke={ink} strokeWidth="3" />
        <rect x="18" y="20" width="84" height="16" rx="5" fill={left < 0 ? "#ff5a3c" : "#fff"} stroke={ink} strokeWidth="3" />
        <path d="M34 50v40" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
      </svg>
      <div>
        <div className="budget-left">{left >= 0 ? `$${left.toLocaleString()} left` : `$${(-left).toLocaleString()} over`}</div>
        <div className="muted small" style={{ marginBottom: 10 }}>
          ${total.toLocaleString()} of your ${budget.toLocaleString()}
        </div>
        <div className="legend">
          {lines.map((l) => (
            <div className="legend-row" key={l.category}>
              <span className="swatch" style={{ background: CATEGORY_COLOR[l.category] }} />
              <span>{LABEL[l.category]}</span>
              <span style={{ fontWeight: 700 }}>${l.actual.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
