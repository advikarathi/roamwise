"use client";
import { weatherKind, type TripWeather } from "@/lib/extras";
import { CrewAvatar } from "../CrewAvatar";

export function WeatherIcon({ kind, size = 28 }: { kind: ReturnType<typeof weatherKind>; size?: number }) {
  const ink = "#1b1f5e";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {kind === "sun" && (
        <g>
          <circle cx="16" cy="16" r="7" fill="#ffc93c" stroke={ink} strokeWidth="2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} d="M16 3v4" stroke={ink} strokeWidth="2" strokeLinecap="round" transform={`rotate(${a} 16 16)`} />
          ))}
        </g>
      )}
      {kind !== "sun" && (
        <g>
          {kind === "cloud" && <circle cx="21" cy="11" r="5" fill="#ffc93c" stroke={ink} strokeWidth="2" />}
          <path d="M8 22a5 5 0 0 1 1-9.9A7 7 0 0 1 22.5 13 4.5 4.5 0 0 1 23 22z" fill="#fff" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          {kind === "rain" && <path d="M11 25l-1 3M16 25l-1 3M21 25l-1 3" stroke="#3d7bff" strokeWidth="2.2" strokeLinecap="round" />}
          {kind === "snow" && <path d="M11 26h.01M16 27h.01M21 26h.01" stroke={ink} strokeWidth="3" strokeLinecap="round" />}
          {kind === "storm" && <path d="M16 23l-2 4h3l-2 4" stroke="#ff5a3c" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </g>
      )}
    </svg>
  );
}

const SOURCE_NOTE: Record<TripWeather["source"], string> = {
  forecast: "Forecast for your dates",
  "last-year": "What it was like on these dates last year",
  estimate: "Rough seasonal estimate (live weather loads in the full app)",
};

function shortDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
}

export function WeatherCard({ weather, movedOutdoor }: { weather: TripWeather | null; movedOutdoor: number }) {
  if (!weather || !weather.days.length) return null;
  const days = weather.days;
  const avgHigh = Math.round(days.reduce((s, d) => s + d.highF, 0) / days.length);
  const wet = days.filter((d) => ["rain", "storm", "snow"].includes(weatherKind(d.code, d.rainMm))).length;
  const packing =
    avgHigh >= 80 ? "Pack sunscreen and light layers." : avgHigh >= 65 ? "T-shirt weather with a light layer for evenings." : avgHigh >= 50 ? "Bring a jacket." : "Bring a warm coat.";
  const line =
    weather.source === "estimate"
      ? `Expect highs around ${avgHigh}°F. ${packing}`
      : `Highs around ${avgHigh}°F${wet ? `, wet on ${wet} ${wet === 1 ? "day" : "days"}` : ", mostly dry"}. ${packing}${movedOutdoor ? ` I kept outdoor plans off the rainy days.` : ""}`;

  return (
    <section className="panel" aria-labelledby="wx-h">
      <h2 className="h2" id="wx-h">Weather</h2>
      <div className="wx-row">
        {days.map((d) => {
          const kind = weatherKind(d.code, d.rainMm);
          return (
            <div className="wx-day" key={d.date} title={`${d.date}: high ${d.highF}°F, low ${d.lowF}°F${d.rainMm ? `, ${d.rainMm} mm rain` : ""}`}>
              <span className="small" style={{ fontWeight: 700 }}>{shortDay(d.date)}</span>
              <WeatherIcon kind={kind} />
              <span style={{ fontWeight: 800 }}>{d.highF}°</span>
              <span className="small muted">{d.lowF}°</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <CrewAvatar agent="activities" state="done" size={44} />
        <span className="bubble" style={{ marginTop: 0 }}>{line}</span>
      </div>
      <p className="small muted" style={{ margin: "10px 0 0" }}>{SOURCE_NOTE[weather.source]}. Weather data from Open-Meteo.</p>
    </section>
  );
}
