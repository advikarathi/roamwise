// Live flights + stays from Duffel (https://duffel.com/docs). Used only when DUFFEL_TOKEN is set.
// Everything is parsed defensively: if Duffel returns something unexpected, the agent
// falls back to demo data instead of crashing the trip.
import type { FlightOption, StayOption, TripRequest } from "../types";
import { findAirport, getPlace } from "../destinations";

const BASE = "https://api.duffel.com";

async function duffel<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ data: body }),
  });
  if (!res.ok) throw new Error(`Duffel ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** "PT6H50M" -> 410 */
function isoMinutes(iso?: string): number {
  const m = iso?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const hhmm = (iso: string) => iso.slice(11, 16);

interface DuffelOffer {
  id: string;
  total_amount: string;
  owner?: { name?: string; iata_code?: string };
  slices: {
    duration?: string;
    segments: {
      departing_at: string;
      arriving_at: string;
      destination?: { iata_code?: string };
      marketing_carrier?: { iata_code?: string };
      marketing_carrier_flight_number?: string;
    }[];
  }[];
}

export async function duffelFlights(req: TripRequest, token: string): Promise<FlightOption[]> {
  const passengers = Array.from({ length: req.travelers }, () => ({ type: "adult" }));
  const json = await duffel<{ data: { offers: DuffelOffer[] } }>(
    "/air/offer_requests?return_offers=true&supplier_timeout=20000",
    {
      slices: [
        { origin: req.origin, destination: req.destination, departure_date: req.startDate },
        { origin: req.destination, destination: req.origin, departure_date: req.endDate },
      ],
      passengers,
      cabin_class: "economy",
      max_connections: 1,
    },
    token,
  );

  const offers = (json.data?.offers ?? []).filter((o) => o.slices?.[0]?.segments?.length);
  if (!offers.length) return [];

  const numbers = (slice: DuffelOffer["slices"][number]) => slice.segments
    .map((s) => (s.marketing_carrier?.iata_code && s.marketing_carrier_flight_number ? `${s.marketing_carrier.iata_code}${s.marketing_carrier_flight_number}` : ""))
    .filter(Boolean);

  const toOption = (o: DuffelOffer, label: FlightOption["label"]): FlightOption => {
    const out = o.slices[0];
    const first = out.segments[0];
    const last = out.segments[out.segments.length - 1];
    return {
      id: o.id,
      label,
      carrier: o.owner?.name ?? "Airline",
      origin: req.origin,
      destination: req.destination,
      departTime: hhmm(first.departing_at),
      arriveTime: hhmm(last.arriving_at),
      arriveNextDay: last.arriving_at.slice(0, 10) > first.departing_at.slice(0, 10),
      durationMinutes: isoMinutes(out.duration),
      stops: out.segments.length - 1,
      via: out.segments.length > 1 ? out.segments[0].destination?.iata_code : undefined,
      price: Math.round(Number(o.total_amount)),
      // Test tokens return practice data: real airline names on made-up flights and prices.
      sample: token.startsWith("duffel_test_") || undefined,
      carrierCode: o.owner?.iata_code,
      flightNumbers: numbers(out),
      returnFlightNumbers: o.slices[1] ? numbers(o.slices[1]) : undefined,
    };
  };

  const byPrice = [...offers].sort((a, b) => Number(a.total_amount) - Number(b.total_amount));
  const byTime = [...offers].sort((a, b) => isoMinutes(a.slices[0].duration) - isoMinutes(b.slices[0].duration));
  // "Best value" = lowest price + $25 per extra hour of travel.
  const score = (o: DuffelOffer) => Number(o.total_amount) + (isoMinutes(o.slices[0].duration) / 60) * 25;
  const byValue = [...offers].sort((a, b) => score(a) - score(b));

  const picks: FlightOption[] = [];
  const used = new Set<string>();
  for (const [o, label] of [[byPrice[0], "Cheapest"], [byValue[0], "Best value"], [byTime[0], "Fastest"]] as const) {
    if (used.has(o.id)) continue;
    used.add(o.id);
    picks.push(toOption(o, label));
  }
  return picks;
}

interface DuffelStayResult {
  id: string;
  cheapest_rate_total_amount?: string;
  accommodation?: {
    name?: string;
    location?: {
      address?: { line_one?: string; city_name?: string };
      geographic_coordinates?: { latitude: number; longitude: number };
    };
    amenities?: { description?: string }[];
    photos?: { url?: string }[];
    rating?: number | null;
    review_score?: number | null;
  };
}

const COLORS = ["#FFD23F", "#FF8FAB", "#7CD4FD", "#A3E635", "#FDBA74"];

export async function duffelStays(req: TripRequest, nights: number, token: string): Promise<StayOption[]> {
  const place = findAirport(req.destination);
  if (!place) return [];
  // Search around the city, not the airport (which can be 30 km out).
  const center = getPlace(req.destination)?.center ?? { lat: place.lat, lng: place.lng };
  const json = await duffel<{ data: { results: DuffelStayResult[] } }>(
    "/stays/search",
    {
      rooms: Math.max(1, Math.ceil(req.travelers / 2)),
      location: { radius: 5, geographic_coordinates: { latitude: center.lat, longitude: center.lng } },
      check_in_date: req.startDate,
      check_out_date: req.endDate,
      guests: Array.from({ length: req.travelers }, () => ({ type: "adult" })),
    },
    token,
  );

  return (json.data?.results ?? [])
    .filter((r) => r.cheapest_rate_total_amount)
    .sort((a, b) => Number(a.cheapest_rate_total_amount) - Number(b.cheapest_rate_total_amount))
    .slice(0, 3)
    .map((r, i) => {
      const total = Math.round(Number(r.cheapest_rate_total_amount));
      return {
        id: r.id,
        name: r.accommodation?.name ?? "Hotel",
        kind: "hotel" as const,
        neighborhood: r.accommodation?.location?.address?.line_one ?? place.city,
        nightlyPrice: Math.round(total / Math.max(1, nights)),
        totalPrice: total,
        perks: (r.accommodation?.amenities ?? []).slice(0, 3).map((a) => a.description ?? "").filter(Boolean),
        walkMinutes: 15,
        color: COLORS[i % COLORS.length],
        photo: r.accommodation?.photos?.find((x) => x.url)?.url,
        stars: r.accommodation?.rating ?? undefined,
        reviewScore: r.accommodation?.review_score ?? undefined,
        address: [r.accommodation?.location?.address?.line_one, r.accommodation?.location?.address?.city_name].filter(Boolean).join(", ") || undefined,
        lat: r.accommodation?.location?.geographic_coordinates?.latitude,
        lng: r.accommodation?.location?.geographic_coordinates?.longitude,
      };
    });
}
