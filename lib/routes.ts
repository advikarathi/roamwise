// Getting-around agent: how long it takes to move between each day's plans, a Google Maps route for
// the whole day, and the airport-to-hotel transfer. Pure functions from coordinates; no API calls.
// Times are estimates from straight-line distance (scaled up for real streets).
import type { Activity, StayOption } from "./types";

export type Mode = "walk" | "transit" | "taxi";

export interface Leg {
  to: string;
  km?: number; // missing when we don't know where a plan is
  minutes?: number;
  mode?: Mode;
}

export interface DayRoute {
  legs: Leg[]; // stay -> plan 1 -> plan 2 -> ... -> back to the stay
  travelMinutes: number;
  mapsUrl: string;
}

interface Point { lat: number; lng: number }

/** Straight-line distance in km. */
export function km(a: Point, b: Point): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const STREET = 1.3; // streets are ~30% longer than a straight line

/** Walk under ~2 km; transit across town; a taxi or train for day trips. */
export function legFor(distanceKm: number): { minutes: number; mode: Mode } {
  const road = distanceKm * STREET;
  if (road <= 2.2) return { minutes: Math.max(3, Math.round((road / 4.8) * 60)), mode: "walk" };
  if (road <= 25) return { minutes: Math.round((road / 18) * 60 + 10), mode: "transit" };
  return { minutes: Math.round((road / 55) * 60 + 15), mode: "taxi" };
}

const enc = encodeURIComponent;
const place = (a: { title?: string; name?: string; lat?: number; lng?: number }, city: string) => `${a.title ?? a.name}, ${city}`;

/** The day as a route from the stay through each plan and back. */
export function dayRoute(stay: StayOption, items: Activity[], city: string): DayRoute {
  const stops: { label: string; point?: Point }[] = items.map((a) => ({
    label: a.title, point: a.lat !== undefined && a.lng !== undefined ? { lat: a.lat, lng: a.lng } : undefined,
  }));
  const home = stay.lat !== undefined && stay.lng !== undefined ? { lat: stay.lat, lng: stay.lng } : undefined;
  const path = [{ label: stay.name, point: home }, ...stops, { label: stay.name, point: home }];

  const legs: Leg[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1].point, to = path[i].point;
    if (from && to) {
      const d = km(from, to);
      legs.push({ to: path[i].label, km: Math.round(d * 10) / 10, ...legFor(d) });
    } else legs.push({ to: path[i].label });
  }
  const travelMinutes = legs.reduce((s, l) => s + (l.minutes ?? 0), 0);

  // One link for the whole day. Google's URL API takes waypoints for walking/driving, not transit,
  // so long days open as a driving route (Maps offers transit per leg from there).
  const allWalk = legs.every((l) => l.mode === "walk");
  const waypoints = items.slice(0, 9).map((a) => place(a, city)).join("|");
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${enc(place(stay, city))}&destination=${enc(place(stay, city))}`
    + (waypoints ? `&waypoints=${enc(waypoints)}` : "") + `&travelmode=${allWalk ? "walking" : "driving"}`;
  return { legs, travelMinutes, mapsUrl };
}

/** Airport to the stay: distance, and rough taxi and public-transport times and taxi price. */
export function airportTransfer(airport: Point & { code: string }, stay: StayOption, taxiPerKm = 1.2) {
  if (stay.lat === undefined || stay.lng === undefined) return undefined;
  const d = km(airport, { lat: stay.lat, lng: stay.lng }) * STREET;
  return {
    km: Math.round(d),
    taxiMinutes: Math.round((d / 40) * 60 + 8),
    taxiPrice: Math.round(4 + d * taxiPerKm),
    transitMinutes: Math.round((d / 25) * 60 + 20),
  };
}

/** Rough taxi cost per km by country (USD). */
export function taxiRate(countryCode?: string): number {
  const pricey = new Set("CH NO IS DK GB US FR NL IE AU NZ SG AE LU SE FI BE AT DE JP CA".split(" "));
  const cheap = new Set("IN TH VN ID PH KH LA NP LK EG MA KE TZ PE CO BO MX TR GE MY PK BD".split(" "));
  return countryCode && pricey.has(countryCode) ? 2.2 : countryCode && cheap.has(countryCode) ? 0.5 : 1.2;
}

export const MODE_WORD: Record<Mode, string> = { walk: "walk", transit: "by transit", taxi: "by taxi or train" };
