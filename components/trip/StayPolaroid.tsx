"use client";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { OutLink } from "@/lib/links";
import type { StayOption } from "@/lib/types";
import { Shuffle } from "../Icons";
import { LinkRow } from "./LinkRow";

/** Little illustrated building so every stay has a "photo" even without real images. */
function Building({ stay }: { stay: StayOption }) {
  const ink = "#1b1f5e";
  const seed = stay.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const floors = stay.kind === "apartment" ? 4 : 3;
  const cols = stay.kind === "apartment" ? 3 : 5;
  const w = cols * 26 + 20;
  const h = floors * 30 + 40;
  const x0 = (300 - w) / 2;
  const y0 = 205 - h;
  return (
    <svg className="polaroid-photo" viewBox="0 0 300 225" role="img" aria-label={`Illustration of ${stay.name}`} style={{ background: stay.color }}>
      <circle cx={seed % 2 ? 240 : 60} cy="48" r="22" fill="#fff" stroke={ink} strokeWidth="3" />
      <rect x={x0 - 40} y={y0 + 40} width="44" height={h - 40} fill="#fff" stroke={ink} strokeWidth="3" />
      <rect x={x0 + w - 4} y={y0 + 24} width="40" height={h - 24} fill="#ffe8f3" stroke={ink} strokeWidth="3" />
      <rect x={x0} y={y0} width={w} height={h} fill="#fff" stroke={ink} strokeWidth="3" />
      <path d={`M${x0 - 6} ${y0}h${w + 12}`} stroke={ink} strokeWidth="5" />
      {Array.from({ length: floors }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const lit = (seed + r * 3 + c * 5) % 4 === 0;
          return <rect key={`${r}-${c}`} x={x0 + 14 + c * 26} y={y0 + 12 + r * 30} width="14" height="18" rx="2"
            fill={lit ? "#ffc93c" : "#d3e3ff"} stroke={ink} strokeWidth="2.5" />;
        }),
      )}
      {stay.kind === "apartment" &&
        Array.from({ length: floors - 1 }).map((_, r) => (
          <path key={r} d={`M${x0 + 8} ${y0 + 34 + r * 30}h${w - 16}`} stroke={ink} strokeWidth="2.5" />
        ))}
      <rect x={x0 + w / 2 - 12} y={205 - 30} width="24" height="30" fill="#ff5a3c" stroke={ink} strokeWidth="3" />
      <path d="M0 205h300" stroke={ink} strokeWidth="3" />
      <rect x="0" y="206" width="300" height="20" fill="#fff" opacity="0.5" />
    </svg>
  );
}

/** Real photo when we have one; the illustration otherwise. Neighborhood photos say so. */
function StayPhoto({ stay }: { stay: StayOption }) {
  const [broken, setBroken] = useState(false);
  const src = stay.photo ?? stay.areaPhoto;
  if (!src || broken) return <Building stay={stay} />;
  return (
    <div className="stay-photo">
      <img className="polaroid-photo" src={src} alt={stay.photo ? stay.name : `The ${stay.neighborhood} area`} onError={() => setBroken(true)} />
      {!stay.photo && <span className="photo-note">Around {stay.neighborhood}</span>}
      {stay.photo && stay.imageCredit && <span className="photo-credit">Photo: {stay.imageCredit}</span>}
    </div>
  );
}

export function StayPolaroid({ stays, selectedId, onSelect, links }: {
  stays: StayOption[]; selectedId: string; onSelect: (id: string) => void; links: OutLink[];
}) {
  const reduce = useReducedMotion();
  const idx = Math.max(0, stays.findIndex((s) => s.id === selectedId));
  const s = stays[idx];
  const next = () => onSelect(stays[(idx + 1) % stays.length].id);

  return (
    <section aria-labelledby="stay-h">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 className="h2" id="stay-h">Where you'll stay</h2>
        <span className="small muted">{idx + 1} of {stays.length}</span>
      </div>
      <motion.div
        key={s.id}
        className="polaroid"
        initial={reduce ? false : { rotateY: 90, rotate: 0 }}
        animate={{ rotateY: 0, rotate: idx % 2 ? 1.5 : -1.5 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        style={{ transformPerspective: 900 }}
      >
        <StayPhoto key={s.id} stay={s} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.15 }}>{s.name}</div>
            <div className="muted small">
              {s.kind === "hotel" ? "Hotel" : "Apartment"} in {s.neighborhood}, about {s.walkMinutes} min walk to your plans
            </div>
            {s.rating && (
              <div className="small" style={{ fontWeight: 700, marginTop: 2 }}>
                ★ {s.rating.toFixed(1)} <span className="muted" style={{ fontWeight: 500 }}>({(s.ratingCount ?? 0).toLocaleString()} Google reviews)</span>
              </div>
            )}
            {(s.stars || s.reviewScore) && (
              <div className="small" style={{ fontWeight: 700, marginTop: 2 }}>
                {s.stars ? <span aria-label={`${s.stars} stars`}>{"★".repeat(Math.round(s.stars))} </span> : null}
                {s.reviewScore ? <span>{s.reviewScore.toFixed(1)}/10 from guests</span> : null}
              </div>
            )}
            {s.address && <div className="small muted">{s.address}</div>}
            {s.blurb && <p className="small" style={{ margin: "6px 0 0" }}>{s.blurb}</p>}
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 22 }}>${s.totalPrice.toLocaleString()}</div>
            <div className="small muted">${s.nightlyPrice}/night</div>
            {(s.priceListed !== undefined || s.id.startsWith("stay-")) && (
              <div className="small muted" title={s.priceListed ? "Price from the travel guide; check the booking site for today's rate" : "Estimated from similar places nearby"}>
                {s.priceListed ? "guide price" : "estimate"}
              </div>
            )}
          </div>
        </div>
        <div className="perks">{s.perks.map((p) => <span key={p} className="perk">{p}</span>)}</div>
      </motion.div>
      <p className="small muted" style={{ margin: "16px 0 6px", fontWeight: 600 }}>Find it and book for your dates</p>
      <LinkRow links={links} label="Book a stay" />
      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn" onClick={next}><Shuffle /> Show another stay</button>
      </div>
    </section>
  );
}
