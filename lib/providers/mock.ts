// Demo-mode data. Realistic-looking, generated from the destination table so the
// whole app works with zero API keys. Every number here is an estimate.
import type { Activity, FlightOption, StayOption, TripRequest } from "../types";
import { distanceMiles, estimateFare, findAirport, getPlace, type Airport } from "../destinations";
import { getAirport } from "../airports";

/** Small deterministic RNG so the same request gives the same demo results. */
function seeded(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CARRIERS = ["Skylark Air", "Coastline Airways", "Northstar", "Bluebird Air", "Meridian"];

const HUBS = "ATL ORD DFW JFK LAX SFO SEA MIA LHR CDG FRA AMS IST DXB DOH SIN HKG ICN NRT DEL BOM JNB ADD GRU BOG PTY MEX SYD AKL".split(" ");

/** The connecting hub that adds the least distance to the trip. */
function hubFor(origin: Airport, dest: Airport): string {
  let best = "ORD";
  let bestMiles = Infinity;
  for (const code of HUBS) {
    if (code === origin.code || code === dest.code) continue;
    const h = findAirport(code);
    if (!h) continue;
    const miles = distanceMiles(origin, h) + distanceMiles(h, dest);
    if (miles < bestMiles) { bestMiles = miles; best = code; }
  }
  return best;
}

function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function mockFlights(req: TripRequest): FlightOption[] {
  const rand = seeded(`${req.origin}-${req.destination}-${req.startDate}`);
  const o = findAirport(req.origin);
  const d = findAirport(req.destination);
  if (!o || !d) return [];
  const miles = distanceMiles(o, d);
  const base = estimateFare(o, d);
  const nonstopMinutes = Math.round(miles / 8.2 + 35); // ~490 mph plus taxi
  const tzShiftMinutes = Math.round((d.lng - o.lng) / 15) * 60; // rough time-zone difference

  const make = (
    label: FlightOption["label"],
    stops: number,
    priceFactor: number,
    departMinutes: number,
  ): FlightOption => {
    const layover = label === "Fastest" ? 85 : Math.round(110 + rand() * 80);
    const duration = nonstopMinutes + stops * layover;
    const arriveLocal = departMinutes + duration + tzShiftMinutes;
    return {
      id: `${label}-${Math.floor(rand() * 1e6)}`,
      label,
      carrier: CARRIERS[Math.floor(rand() * CARRIERS.length)],
      origin: o.code,
      destination: d.code,
      departTime: clock(departMinutes),
      arriveTime: clock(arriveLocal),
      arriveNextDay: arriveLocal >= 1440,
      durationMinutes: duration,
      stops,
      via: stops ? hubFor(o, d) : undefined,
      price: Math.round(base * priceFactor * (0.92 + rand() * 0.16) * req.travelers),
      sample: true,
    };
  };

  // Long hauls and smaller airports usually need a connection.
  const oSize = getAirport(o.code)?.size ?? 3;
  const dSize = getAirport(d.code)?.size ?? 3;
  const minStops = miles > 7500 || (miles > 900 && Math.min(oSize, dSize) < 3) ? 1 : 0;
  const evening = 17 * 60 + Math.round(rand() * 5) * 25;
  return [
    make("Cheapest", Math.min(2, minStops + 1), 0.82, 6 * 60 + Math.round(rand() * 6) * 20),
    make("Best value", minStops, 1.0, evening),
    make("Fastest", minStops, 1.18, 9 * 60 + Math.round(rand() * 4) * 15),
  ];
}

const HOTEL_NAMES = ["Casa {n}", "Hotel {n}", "The {n} House", "{n} Rooms"];
const APT_NAMES = ["Sunny flat in {n}", "Rooftop studio, {n}", "Cozy 1-bed in {n}", "Bright loft in {n}"];
// For cities without hand-written neighborhoods.
const GENERIC_HOTELS = ["Hotel {c} Central", "The {c} Boutique", "Downtown {c} Inn", "{c} Garden Hotel"];
const GENERIC_APTS = ["Sunny flat near the center", "Cozy 1-bed, {c}", "Top-floor studio with a view", "Quiet apartment, {c}"];
const STAY_COLORS = ["#FFD23F", "#FF8FAB", "#7CD4FD", "#A3E635", "#FDBA74"];
const PERKS = ["Balcony", "Free breakfast", "Rooftop", "Washer", "Late checkout", "Kitchen", "Walkable", "Quiet street"];

export function mockStays(req: TripRequest, nights: number): StayOption[] {
  const rand = seeded(`${req.destination}-${req.stayType}-${nights}`);
  const dest = getPlace(req.destination);
  const hoods = dest?.neighborhoods ?? ["City center", "Old town", "Riverside"];
  const kinds: ("hotel" | "apartment")[] =
    req.stayType === "hotel" ? ["hotel", "hotel", "hotel"]
    : req.stayType === "apartment" ? ["apartment", "apartment", "apartment"]
    : ["apartment", "hotel", "apartment"];
  const rooms = Math.max(1, Math.ceil(req.travelers / 2));

  return kinds.map((kind, i) => {
    const hood = hoods[(i + Math.floor(rand() * hoods.length)) % hoods.length];
    const base = kind === "hotel" ? dest?.hotelNightly ?? 160 : dest?.apartmentNightly ?? 120;
    const factor = [1.0, 1.25, 0.8][i];
    const nightly = Math.round(base * factor * (0.9 + rand() * 0.2) * rooms);
    const templates = dest?.featured ? (kind === "hotel" ? HOTEL_NAMES : APT_NAMES) : kind === "hotel" ? GENERIC_HOTELS : GENERIC_APTS;
    const name = templates[Math.floor(rand() * templates.length)].replace("{n}", hood).replace("{c}", dest?.city ?? "City");
    const perks = [...PERKS].sort(() => rand() - 0.5).slice(0, 3);
    return {
      id: `stay-${i}-${Math.floor(rand() * 1e6)}`,
      name,
      kind,
      neighborhood: hood,
      nightlyPrice: nightly,
      totalPrice: nightly * nights,
      perks,
      walkMinutes: Math.round(8 + rand() * 14),
      color: STAY_COLORS[i % STAY_COLORS.length],
      ...(dest?.hoodCoords?.[hood]
        ? { lat: dest.hoodCoords[hood][0] + (rand() - 0.5) * 0.004, lng: dest.hoodCoords[hood][1] + (rand() - 0.5) * 0.004 }
        : {}),
    };
  });
}

const GENERIC: Omit<Activity, "id">[] = [
  { title: "Local market breakfast", blurb: "Start the day where the locals shop.", vibe: "food", price: 15, durationHours: 1.5, timeOfDay: "morning" },
  { title: "City history museum", blurb: "Get the backstory before you explore.", vibe: "culture", price: 15, durationHours: 2, timeOfDay: "afternoon" },
  { title: "Golden hour viewpoint", blurb: "The best free view in town.", vibe: "chill", price: 0, durationHours: 1, timeOfDay: "evening" },
  { title: "Neighborhood food tour", blurb: "Five bites, five stories.", vibe: "food", price: 55, durationHours: 3, timeOfDay: "evening" },
  { title: "Live music night", blurb: "Find the bar with the best band.", vibe: "nightlife", price: 25, durationHours: 3, timeOfDay: "evening" },
  { title: "Half-day hike", blurb: "Trails just outside the city.", vibe: "outdoors", price: 20, durationHours: 4, timeOfDay: "morning" },
];

export function mockActivities(req: TripRequest): Activity[] {
  const dest = getPlace(req.destination);
  const pool = dest?.activities ?? GENERIC;
  const wanted = new Set(req.vibes);
  return pool
    .map((a, i) => ({ ...a, id: `act-${req.destination}-${i}` }))
    .sort((a, b) => Number(wanted.has(b.vibe)) - Number(wanted.has(a.vibe)));
}
