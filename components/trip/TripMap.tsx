"use client";
import type { Activity, StayOption } from "@/lib/types";
import { VibeIcon } from "../Icons";

const VIBE_COLOR: Record<string, string> = {
  food: "#ffc93c", culture: "#9db7ff", beach: "#7fdcff", nightlife: "#c3a8ff", outdoors: "#7fe0b8", chill: "#ffb3d9",
};

/** km east/north of the origin point. */
function offsetKm(lat: number, lng: number, oLat: number, oLng: number) {
  return { x: (lng - oLng) * 111.32 * Math.cos((oLat * Math.PI) / 180), y: (lat - oLat) * 110.57 };
}

/** Sticker-style map: your stay in the middle, walking rings at 1 and 2 km, and a pin per kept plan. */
export function TripMap({ stay, activities, center, stayUrl, mapFor }: {
  stay?: StayOption; activities: Activity[]; center?: { lat: number; lng: number };
  stayUrl?: string; mapFor: (a: Activity) => string;
}) {
  const pins = activities.filter((a) => a.lat !== undefined && a.lng !== undefined);
  const origin = stay?.lat !== undefined && stay.lng !== undefined ? { lat: stay.lat, lng: stay.lng! } : center;
  if (!origin || pins.length === 0) return null;

  const W = 360, H = 280, PAD = 34;
  const placed = pins.map((a) => {
    const o = offsetKm(a.lat!, a.lng!, origin.lat, origin.lng);
    return { a, ...o, km: Math.hypot(o.x, o.y) };
  });
  const NEAR = 6; // km; anything farther is a day trip and sits on the edge with its distance
  const near = placed.filter((p) => p.km <= NEAR);
  const radius = Math.max(1.6, ...near.map((p) => p.km)) * 1.12;
  const scale = (Math.min(W, H) / 2 - PAD) / radius; // px per km
  const cx = W / 2, cy = H / 2;

  const toXY = (p: { x: number; y: number; km: number }) => {
    if (p.km <= NEAR) return { x: cx + p.x * scale, y: cy - p.y * scale, far: false };
    const k = (Math.min(W, H) / 2 - 16) / p.km;
    return { x: cx + p.x * k, y: cy - p.y * k, far: true };
  };
  const walkMin = (km: number) => Math.round((km / 4.8) * 60);

  return (
    <section aria-labelledby="map-h">
      <h2 className="h2" id="map-h">Your map</h2>
      <div className="map-card">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of your stay and ${pins.length} plans`} style={{ display: "block", width: "100%", height: "auto" }}>
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke="#d3e3ff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="#f4f8ff" />
          <rect width={W} height={H} fill="url(#grid)" />
          {[1, 2].map((km) => km * scale < Math.min(W, H) / 2 && (
            <g key={km}>
              <circle cx={cx} cy={cy} r={km * scale} fill="none" stroke="#1b1f5e" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.5" />
              {/* 1 km label sits below-right, 2 km above-right, so they never collide */}
              <text x={cx + km * scale * 0.71 + 4} y={km === 1 ? cy + km * scale * 0.71 + 12 : cy - km * scale * 0.71 - 4} fontSize="11" fontWeight="700" fill="#4a4f86">{walkMin(km)} min walk</text>
            </g>
          ))}
          {placed.map((p) => {
            const { x, y, far } = toXY(p);
            return (
              <g key={p.a.id}>
                <path d={`M${cx} ${cy}L${x} ${y}`} stroke="#1b1f5e" strokeWidth="1.5" strokeDasharray="2 5" opacity="0.35" />
                <circle cx={x} cy={y} r="13" fill={VIBE_COLOR[p.a.vibe]} stroke="#1b1f5e" strokeWidth="2.5" />
                <g transform={`translate(${x - 8} ${y - 8})`} color="#1b1f5e"><VibeIcon vibe={p.a.vibe} size={16} /></g>
                {far && (
                  <text x={x} y={y + (y > cy ? -20 : 28)} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1b1f5e">{Math.round(p.km)} km</text>
                )}
              </g>
            );
          })}
          {/* the stay */}
          <g transform={`translate(${cx} ${cy})`}>
            <circle r="18" fill="#ffc93c" stroke="#1b1f5e" strokeWidth="3" />
            <path d="M-8 2L0-6l8 8M-5 0v7h10V0" fill="none" stroke="#1b1f5e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          <g transform={`translate(${PAD - 20} ${H - 18})`}>
            <path d={`M0 0h${scale}`} stroke="#1b1f5e" strokeWidth="3" />
            <path d={`M0 -5v10M${scale} -5v10`} stroke="#1b1f5e" strokeWidth="2" />
            <text x={scale + 6} y="4" fontSize="11" fontWeight="700" fill="#1b1f5e">1 km</text>
          </g>
        </svg>
        <ul className="map-list">
          {stay?.lat !== undefined && (
            <li>
              <span className="map-dot" style={{ background: "#ffc93c" }} />
              <span>{stay.name}</span>
              {stayUrl && <a href={stayUrl} target="_blank" rel="noopener noreferrer">Google Maps</a>}
            </li>
          )}
          {placed.sort((a, b) => a.km - b.km).map((p) => (
            <li key={p.a.id}>
              <span className="map-dot" style={{ background: VIBE_COLOR[p.a.vibe] }} />
              <span>{p.a.title} <span className="muted small">{p.km < 3 ? `${walkMin(p.km)} min walk` : `${Math.round(p.km)} km away`}</span></span>
              <a href={mapFor(p.a)} target="_blank" rel="noopener noreferrer">Google Maps</a>
            </li>
          ))}
        </ul>
        <p className="small muted" style={{ margin: "8px 0 0" }}>Pin locations are approximate.</p>
      </div>
    </section>
  );
}
