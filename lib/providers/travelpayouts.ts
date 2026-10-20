// Real flights from Travelpayouts (Aviasales Data API): actual fares travelers found on Aviasales in
// the last ~48 hours, with the real airline, flight number, departure time, stops and a link that
// opens that exact fare. Free with a Travelpayouts account (TRAVELPAYOUTS_TOKEN). Server only.
// Docs: https://support.travelpayouts.com/hc/en-us/articles/203956163
import type { FlightOption, TripRequest } from "../types";
import { airlineName } from "../data/airlines";

interface Ticket {
  origin: string;
  destination: string;
  origin_airport?: string;
  destination_airport?: string;
  price: number; // per adult, in the requested currency
  airline: string; // IATA code
  flight_number: string | number;
  departure_at: string; // ISO 8601, local time at the departure airport
  return_at?: string;
  transfers: number;
  return_transfers?: number;
  duration?: number; // minutes, both ways
  duration_to?: number; // minutes, outbound
  link?: string; // path on aviasales.com that opens this fare
}

const hhmm = (iso: string) => iso.slice(11, 16);

async function search(req: TripRequest, token: string): Promise<Ticket[]> {
  const params = new URLSearchParams({
    origin: req.origin,
    destination: req.destination,
    departure_at: req.startDate,
    return_at: req.endDate,
    one_way: "false",
    currency: "usd",
    sorting: "price",
    unique: "false",
    limit: "30",
  });
  const res = await fetch(`https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`, {
    headers: { "X-Access-Token": token, "Accept-Encoding": "gzip, deflate" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Travelpayouts ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { success?: boolean; data?: Ticket[]; error?: string };
  if (json.success === false) throw new Error(`Travelpayouts: ${json.error ?? "request failed"}`);
  // Only fares on exactly the trip's dates: a cheaper fare on another day isn't this trip.
  return (json.data ?? []).filter((t) => t.departure_at?.slice(0, 10) === req.startDate && (!t.return_at || t.return_at.slice(0, 10) === req.endDate));
}

/** Up to three real fares for the trip's exact dates: cheapest, best value and fastest. */
export async function travelpayoutsFlights(req: TripRequest, token: string, marker?: string): Promise<FlightOption[]> {
  const tickets = (await search(req, token)).filter((t) => t.price > 0 && t.airline && t.departure_at);
  if (!tickets.length) return [];

  const minutes = (t: Ticket) => t.duration_to ?? (t.duration ? Math.round(t.duration / 2) : 0);
  const toOption = (t: Ticket, label: FlightOption["label"]): FlightOption => {
    const code = t.airline.toUpperCase();
    const link = t.link ? `https://www.aviasales.com${t.link}${marker ? `${t.link.includes("?") ? "&" : "?"}marker=${encodeURIComponent(marker)}` : ""}` : undefined;
    return {
      id: `tp-${code}${t.flight_number}-${t.departure_at}`,
      label,
      carrier: airlineName(code),
      origin: (t.origin_airport ?? t.origin ?? req.origin).toUpperCase(),
      destination: (t.destination_airport ?? t.destination ?? req.destination).toUpperCase(),
      departTime: hhmm(t.departure_at),
      // The API gives the duration but not the arrival time zone, so we don't guess a landing time.
      arriveTime: "",
      arriveNextDay: false,
      durationMinutes: minutes(t),
      stops: t.transfers,
      price: Math.round(t.price * req.travelers),
      bookingUrl: link,
      carrierCode: code,
      flightNumbers: [`${code}${t.flight_number}`],
      recentFare: true,
    };
  };

  const byPrice = [...tickets].sort((a, b) => a.price - b.price);
  const timed = tickets.filter((t) => minutes(t) > 0);
  const byTime = [...timed].sort((a, b) => minutes(a) - minutes(b));
  // "Best value" = price plus $25 per hour of travel, per adult.
  const byValue = [...(timed.length ? timed : tickets)].sort((a, b) => (a.price + (minutes(a) / 60) * 25) - (b.price + (minutes(b) / 60) * 25));

  const picks: FlightOption[] = [];
  const used = new Set<Ticket>();
  for (const [t, label] of [[byPrice[0], "Cheapest"], [byValue[0], "Best value"], [byTime[0], "Fastest"]] as const) {
    if (!t || used.has(t)) continue;
    used.add(t);
    picks.push(toOption(t, label));
  }
  return picks;
}
