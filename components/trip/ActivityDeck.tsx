"use client";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { useState } from "react";
import type { Activity, Vibe } from "@/lib/types";
import { usePhoto } from "@/lib/usePhoto";
import { External, Heart, Pin, Undo, VibeIcon, X } from "../Icons";

export type Decision = "keep" | "skip";

const VIBE_COLOR: Record<string, string> = {
  food: "#ffc93c", culture: "#c9d8ff", beach: "#9ee6ff", nightlife: "#d9c6ff", outdoors: "#b8f0d9", chill: "#ffd1e8",
};

const WHEN: Record<Activity["timeOfDay"], string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };

/** Photo across the top of the card, or a colored banner when there isn't one. */
function CardMedia({ image, vibe, credit }: { image?: string; vibe: Activity["vibe"]; credit?: string }) {
  const [broken, setBroken] = useState(false);
  if (image && !broken) {
    // draggable=false so the browser's image drag doesn't fight the swipe.
    return (
      <div className="card-media">
        <img src={image} alt="" draggable={false} onError={() => setBroken(true)} />
        {credit && <span className="photo-credit">Photo: {credit}</span>}
      </div>
    );
  }
  return (
    <div className="card-media" style={{ background: VIBE_COLOR[vibe], display: "grid", placeItems: "center" }}>
      <VibeIcon vibe={vibe} size={56} />
    </div>
  );
}

function TopCard({ a, crewPick, travelers, mapUrl, onDecide }: {
  a: Activity; crewPick: boolean; travelers: number; mapUrl?: string; onDecide: (d: Decision) => void;
}) {
  const { image, infoUrl } = usePhoto(a);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const keepOpacity = useTransform(x, [20, 110], [0, 1]);
  const skipOpacity = useTransform(x, [-110, -20], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110 || info.velocity.x > 600) onDecide("keep");
    else if (info.offset.x < -110 || info.velocity.x < -600) onDecide("skip");
  };

  return (
    <motion.article
      className="card card-photo"
      style={{ x, rotate, background: "#fff", zIndex: 2 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      variants={{
        exit: (dir: Decision) => ({ x: dir === "keep" ? 420 : -420, rotate: dir === "keep" ? 20 : -20, opacity: 0, transition: { duration: 0.32 } }),
      }}
      initial={{ scale: 0.95, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      exit="exit"
      aria-label={a.title}
    >
      <motion.span className="card-stamp" style={{ opacity: keepOpacity, left: 18, color: "#1f9e7f", rotate: -12 }}>KEEP</motion.span>
      <motion.span className="card-stamp" style={{ opacity: skipOpacity, right: 18, color: "#e0412a", rotate: 12 }}>SKIP</motion.span>
      <CardMedia image={image} vibe={a.vibe} credit={a.imageCredit} />
      <div className="card-body">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="card-tag" style={{ background: VIBE_COLOR[a.vibe], display: "inline-flex", alignItems: "center", gap: 6 }}>
          <VibeIcon vibe={a.vibe} size={16} /> {a.vibe[0].toUpperCase() + a.vibe.slice(1)}
        </span>
        {crewPick && <span className="card-tag" style={{ background: "#ffe3f1" }}>Juno's pick</span>}
        {mapUrl && (
          // Stop the pointer from starting a drag so a tap opens the map.
          <a className="card-map" href={mapUrl} target="_blank" rel="noopener noreferrer" onPointerDownCapture={(e) => e.stopPropagation()}>
            <Pin size={15} /> Map
          </a>
        )}
        {infoUrl && (
          <a className="card-map" style={mapUrl ? { marginLeft: 0 } : undefined} href={infoUrl} target="_blank" rel="noopener noreferrer" onPointerDownCapture={(e) => e.stopPropagation()}>
            <External size={15} /> Read more
          </a>
        )}
      </div>
      <h3 className="card-title">{a.title}</h3>
      {a.rating && (
        <div className="small" style={{ fontWeight: 700, marginTop: -4 }}>
          ★ {a.rating.toFixed(1)} <span className="muted" style={{ fontWeight: 500 }}>({(a.ratingCount ?? 0).toLocaleString()} Google reviews)</span>
        </div>
      )}
      <p className="card-blurb">{a.blurb}</p>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span className="muted">{WHEN[a.timeOfDay]}, about {a.durationHours}h</span>
        <span style={{ fontWeight: 800, fontSize: 24 }}>{a.price === 0 ? "Free" : `$${(a.price * travelers).toLocaleString()}`}</span>
      </div>
      </div>
    </motion.article>
  );
}

/** Swipe right to keep, left to skip. Kept cards build the itinerary and fill the budget jar. */
export function ActivityDeck({ activities, decisions, suggested, travelers, mapFor, onDecide, onUndo, onReset }: {
  activities: Activity[];
  mapFor?: (a: Activity) => string;
  decisions: Record<string, Decision>;
  suggested: string[];
  travelers: number;
  onDecide: (id: string, d: Decision) => void;
  onUndo: () => void;
  onReset: () => void;
}) {
  const reduce = useReducedMotion();
  const [lastDir, setLastDir] = useState<Decision>("keep");
  const [filter, setFilter] = useState<Vibe | "all">("all");
  const undecided = activities.filter((a) => !decisions[a.id]);
  const remaining = filter === "all" ? undecided : undecided.filter((a) => a.vibe === filter);
  const vibeCounts = undecided.reduce<Partial<Record<Vibe, number>>>((m, a) => ({ ...m, [a.vibe]: (m[a.vibe] ?? 0) + 1 }), {});
  const kept = activities.filter((a) => decisions[a.id] === "keep").length;
  const top = remaining[0];
  const next = remaining[1];

  const decide = (d: Decision) => {
    if (!top) return;
    setLastDir(d);
    onDecide(top.id, d);
  };

  return (
    <section aria-labelledby="deck-h">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 className="h2" id="deck-h">Things to do</h2>
        <span className="small muted" aria-live="polite">{undecided.length} left, {kept} kept</span>
      </div>
      <div className="fare-tabs" role="group" aria-label="Filter ideas by vibe" style={{ marginBottom: 4 }}>
        <button type="button" className="fare-tab" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All {undecided.length}</button>
        {(Object.keys(VIBE_COLOR) as Vibe[]).filter((v) => vibeCounts[v]).map((v) => (
          <button key={v} type="button" className="fare-tab" aria-pressed={filter === v} onClick={() => setFilter(v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <VibeIcon vibe={v} size={16} /> {v[0].toUpperCase() + v.slice(1)} <span style={{ fontWeight: 500 }}>{vibeCounts[v]}</span>
          </button>
        ))}
      </div>

      <div className="deck">
        {next?.image && <img src={next.image} alt="" hidden />}
        {next && (
          <div className="card" style={{ transform: "rotate(3deg) translateY(8px)", background: "#f4f8ff", zIndex: 1 }} aria-hidden="true" />
        )}
        <AnimatePresence initial={false} custom={lastDir}>
          {top ? (
            <TopCard key={top.id} a={top} crewPick={suggested.includes(top.id)} travelers={travelers} mapUrl={mapFor?.(top)} onDecide={decide} />
          ) : (
            <motion.div key="empty" className="card" initial={reduce ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ alignItems: "center", justifyContent: "center", textAlign: "center", background: "#b8f0d9" }}>
              {filter !== "all" && undecided.length ? (
                <>
                  <h3 className="card-title">No more {filter} ideas</h3>
                  <p style={{ margin: 0 }}>{undecided.length} other ideas are still waiting.</p>
                  <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => setFilter("all")}>Show all ideas</button>
                </>
              ) : (
                <>
                  <h3 className="card-title">All sorted</h3>
                  <p style={{ margin: 0 }}>You kept {kept} {kept === 1 ? "plan" : "plans"}. They're on your itinerary below.</p>
                  <button type="button" className="btn" style={{ marginTop: 12 }} onClick={onReset}>Deal the deck again</button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="deck-actions">
        <button type="button" className="round-btn" aria-label="Skip this idea" onClick={() => decide("skip")} disabled={!top} style={{ color: "#e0412a" }}>
          <X size={28} />
        </button>
        <button type="button" className="round-btn" aria-label="Undo last swipe" onClick={onUndo} style={{ width: 48, height: 48, alignSelf: "center" }}>
          <Undo size={20} />
        </button>
        <button type="button" className="round-btn" aria-label="Keep this idea" onClick={() => decide("keep")} disabled={!top} style={{ color: "#1f9e7f" }}>
          <Heart size={28} />
        </button>
      </div>
    </section>
  );
}
