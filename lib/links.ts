// Outbound links: Google Maps for every place, plus search pages on booking sites
// prefilled with the trip's dates and travelers. Nothing here books anything; it
// hands the traveler off with the search already typed in.
import type { Activity, FlightOption, StayOption, TripPlan } from "./types";

export interface OutLink {
  label: string;
  url: string;
}

const enc = encodeURIComponent;

export const mapsSearch = (query: string) => `https://www.google.com/maps/search/?api=1&query=${enc(query)}`;

export const mapsDirections = (from: string, to: string, mode: "transit" | "walking" | "driving" = "transit") =>
  `https://www.google.com/maps/dir/?api=1&origin=${enc(from)}&destination=${enc(to)}&travelmode=${mode}`;

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Check-in is the day you land, which is the day after departure on overnight flights. */
export function stayDates(plan: TripPlan, flight?: FlightOption) {
  const req = plan.request;
  return { checkin: flight?.arriveNextDay ? addDays(req.startDate, 1) : req.startDate, checkout: req.endDate };
}

const where = (plan: TripPlan) => [plan.destinationName, plan.country].filter(Boolean).join(", ");

/** Sample stays (ids "stay-…") have made-up names, so search their neighborhood instead. */
const isReal = (stay: StayOption) => !stay.id.startsWith("stay-");
function stayQuery(plan: TripPlan, stay: StayOption) {
  return isReal(stay) ? `${stay.name}, ${stay.address ?? plan.destinationName}` : `${stay.neighborhood}, ${plan.destinationName}`;
}

export function cityMap(plan: TripPlan) {
  return mapsSearch(where(plan));
}

export function stayMap(plan: TripPlan, stay: StayOption) {
  return mapsSearch(isReal(stay) ? stayQuery(plan, stay) : `${stay.kind === "hotel" ? "hotels" : "apartments"} in ${stayQuery(plan, stay)}`);
}

export function activityMap(plan: TripPlan, a: Activity) {
  return mapsSearch(`${a.title}, ${plan.destinationName}`);
}

export function flightLinks(plan: TripPlan, f: FlightOption): OutLink[] {
  const { startDate, endDate, travelers } = plan.request;
  // The flight's own airports: a trip to Noida flies into Delhi (DEL).
  const origin = f.origin || plan.request.origin, destination = f.destination || plan.request.destination;
  // Only real fares say how many stops a route really has; a sample fare's "nonstop" could filter out every real flight.
  const nonstop = f.stops === 0 && !f.sample;
  const yymmdd = (iso: string) => iso.slice(2).replace(/-/g, "");
  // A real flight narrows the search to its airline, so the selected flight sits at the top of the results.
  // Sample fares have made-up airlines, so those searches match the dates, travelers and stops only.
  const airline = !f.sample && f.carrier && f.carrier !== "Airline" ? f.carrier : undefined;
  const gq = `Flights from ${origin} to ${destination} on ${startDate} through ${endDate} for ${travelers} adult${travelers > 1 ? "s" : ""}${nonstop ? " nonstop" : ""}${airline ? ` on ${airline}` : ""}`;
  const kayakFilters = [nonstop ? "stops=0" : "", !f.sample && f.carrierCode ? `airlines=${f.carrierCode}` : ""].filter(Boolean).join(";");
  const flightNo = !f.sample ? f.flightNumbers?.[0] : undefined;
  return [
    ...(f.bookingUrl ? [{ label: f.recentFare ? "This exact fare (Aviasales)" : "Book this fare", url: f.bookingUrl }] : []),
    { label: "Google Flights", url: `https://www.google.com/travel/flights?q=${enc(gq)}` },
    {
      label: "Kayak",
      url: `https://www.kayak.com/flights/${origin}-${destination}/${startDate}/${endDate}/${travelers}adults?sort=bestflight_a${kayakFilters ? `&fs=${enc(kayakFilters)}` : ""}`,
    },
    {
      label: "Skyscanner",
      url: `https://www.skyscanner.com/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${yymmdd(startDate)}/${yymmdd(endDate)}/?adultsv2=${travelers}${nonstop ? "&preferdirects=true" : ""}`,
    },
    // Google's flight-status card shows that exact flight's schedule and terminal.
    ...(flightNo ? [{ label: `Flight ${flightNo} details`, url: `https://www.google.com/search?q=${enc(`${flightNo} flight ${startDate}`)}` }] : []),
  ];
}

export function stayLinks(plan: TripPlan, stay: StayOption, flight?: FlightOption): OutLink[] {
  const { checkin, checkout } = stayDates(plan, flight);
  const adults = plan.request.travelers;
  const rooms = Math.max(1, Math.ceil(adults / 2));
  const q = stayQuery(plan, stay);
  const links: OutLink[] = [];
  if (stay.bookingUrl) links.push({ label: "Book this stay", url: stay.bookingUrl });
  if (stay.website) links.push({ label: "Hotel website", url: stay.website });
  links.push({
    label: "Booking.com",
    url: `https://www.booking.com/searchresults.html?ss=${enc(q)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=${rooms}&group_children=0`,
  });
  if (stay.kind === "apartment") {
    const slug = [stay.neighborhood, plan.destinationName, plan.country].filter(Boolean).join("--").replace(/\s+/g, "-");
    links.push({ label: "Airbnb", url: `https://www.airbnb.com/s/${enc(slug)}/homes?checkin=${checkin}&checkout=${checkout}&adults=${adults}` });
  } else {
    links.push({ label: "Google Hotels", url: `https://www.google.com/travel/search?q=${enc(`hotels in ${q}`)}` });
  }
  links.push({ label: "Google Maps", url: stayMap(plan, stay) });
  return links;
}

export function activityLinks(plan: TripPlan, a: Activity): OutLink[] {
  const links: OutLink[] = [{ label: "Map", url: activityMap(plan, a) }];
  if (a.price > 0) links.push({ label: "Tickets", url: `https://www.getyourguide.com/s/?q=${enc(`${a.title} ${plan.destinationName}`)}` });
  return links;
}

/** The bits people forget: getting from the airport, a car, and the city itself. */
export function extraLinks(plan: TripPlan, stay: StayOption, flight?: FlightOption): OutLink[] {
  const { checkin, checkout } = stayDates(plan, flight);
  const dest = plan.request.destination;
  return [
    { label: "Airport to your stay", url: mapsDirections(`${dest} airport`, stayQuery(plan, stay), "transit") },
    { label: "Rent a car", url: `https://www.kayak.com/cars/${dest}/${checkin}/${checkout}` },
    { label: `${plan.destinationName} on Google Maps`, url: cityMap(plan) },
    { label: "Things to do (Viator)", url: `https://www.viator.com/searchResults/all?text=${enc(plan.destinationName)}` },
  ];
}
