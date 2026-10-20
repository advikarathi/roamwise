// The trip as text: a brief for the chatbot, and the email version (plain text + HTML).
// Both read the same schedule the traveler sees, including their own edits.
import type { DayWeather } from "./extras";
import { activityMap, flightLinks, stayLinks } from "./links";
import type { Activity, BudgetLine, FlightOption, StayOption, TripPlan } from "./types";
import { dayLabel } from "@/components/trip/Itinerary";

export interface TripSnapshot {
  plan: TripPlan;
  flight: FlightOption;
  stay: StayOption;
  schedule: Activity[][];
  lines: BudgetLine[];
  total: number;
  weather?: DayWeather[];
  /** Ideas still in the deck that aren't on the schedule (so the bot can suggest swaps). */
  otherIdeas: Activity[];
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const hours = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
const LABEL: Record<BudgetLine["category"], string> = { flights: "Flights", stay: "Stay", activities: "Things to do", transit: "Getting around" };

function dayTitle(s: TripSnapshot, i: number) {
  const offset = s.flight.arriveNextDay ? 1 : 0;
  const { weekday, date } = dayLabel(s.plan.request.startDate, i + offset);
  const note = i === 0 ? " (arrival)" : i === s.schedule.length - 1 && i > 0 ? " (fly home)" : "";
  return `Day ${i + 1}, ${weekday} ${date}${note}`;
}

/** Everything the chatbot needs to answer questions about this trip, as compact plain text. */
export function tripBrief(s: TripSnapshot): string {
  const { plan, flight, stay } = s;
  const r = plan.request;
  const out: string[] = [];
  out.push(`Trip: ${r.travelers} traveler(s) from ${r.origin} to ${plan.destinationName}${plan.country ? `, ${plan.country}` : ""}, ${r.startDate} to ${r.endDate} (${plan.nights} nights). Budget ${money(r.budget)}, current total ${money(s.total)}.`);
  out.push(`Vibes: ${r.vibes.join(", ") || "anything"}. Prices are ${plan.source === "live" ? "live where available" : "estimates"}.`);
  out.push(`Flight: ${flight.carrier}, ${flight.origin} ${flight.departTime} -> ${flight.destination} ${flight.arriveTime}${flight.arriveNextDay ? " (+1 day)" : ""}, ${flight.stops === 0 ? "nonstop" : `${flight.stops} stop via ${flight.via}`}, ${hours(flight.durationMinutes)}, ${money(flight.price)} round trip for everyone.`);
  out.push(`Other fares: ${plan.flights.filter((f) => f.id !== flight.id).map((f) => `${f.label} ${money(f.price)} (${f.stops === 0 ? "nonstop" : `${f.stops} stop`})`).join("; ") || "none"}.`);
  out.push(`Stay: ${stay.name} (${stay.kind}) in ${stay.neighborhood}${stay.address ? `, ${stay.address}` : ""}. ${money(stay.nightlyPrice)}/night, ${money(stay.totalPrice)} total${stay.priceListed === false ? " (estimate)" : ""}.${stay.rating ? ` Google rating ${stay.rating} from ${stay.ratingCount} reviews.` : ""}${stay.perks.length ? ` Perks: ${stay.perks.join(", ")}.` : ""}${stay.blurb ? ` ${stay.blurb}` : ""}`);
  out.push(`Other stays: ${plan.stays.filter((x) => x.id !== stay.id).map((x) => `${x.name} ${money(x.totalPrice)}`).join("; ") || "none"}.`);
  out.push(`Budget: ${s.lines.map((l) => `${LABEL[l.category]} ${money(l.actual)} of ${money(l.target)}`).join("; ")}.`);
  out.push("Schedule:");
  s.schedule.forEach((day, i) => {
    const w = s.weather?.find((d) => d.date === dayDate(s, i));
    out.push(`  ${dayTitle(s, i)}${w ? ` - weather high ${w.highF}F, rain ${w.rainMm}mm` : ""}:`);
    if (!day.length) out.push("    free day");
    for (const a of day) {
      out.push(`    - ${a.title} [${a.vibe}, ${a.timeOfDay}, ~${a.durationHours}h, ${a.price ? `${money(a.price)} per person` : "free"}${a.indoor ? ", indoor" : ""}]${a.address ? ` at ${a.address}` : ""}${a.rating ? ` (Google ${a.rating})` : ""}: ${a.blurb}`);
    }
  });
  if (s.otherIdeas.length) {
    out.push(`Other ideas not on the schedule: ${s.otherIdeas.slice(0, 30).map((a) => `${a.title} (${a.vibe}, ${a.price ? money(a.price) : "free"})`).join("; ")}.`);
  }
  return out.join("\n");
}

function dayDate(s: TripSnapshot, i: number) {
  const d = new Date(`${s.plan.request.startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i + (s.flight.arriveNextDay ? 1 : 0));
  return d.toISOString().slice(0, 10);
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The plan as an email: subject, plain text (for mail apps) and HTML (for sending). */
export function planEmail(s: TripSnapshot, origin: string) {
  const { plan, flight, stay } = s;
  const r = plan.request;
  const subject = `Your ${plan.destinationName} trip: ${r.startDate} to ${r.endDate}`;
  const book = (links: { label: string; url: string }[]) => links.filter((l) => !/maps/i.test(l.label)).slice(0, 2);

  const text: string[] = [
    subject, "",
    `${r.travelers} traveler(s), ${plan.nights} nights. Total ${money(s.total)} of a ${money(r.budget)} budget.`, "",
    "FLIGHT",
    `${flight.carrier}: ${flight.origin} ${flight.departTime} -> ${flight.destination} ${flight.arriveTime}${flight.arriveNextDay ? " (+1)" : ""}, ${flight.stops === 0 ? "nonstop" : `via ${flight.via}`}. ${money(flight.price)} round trip.`,
    ...book(flightLinks(plan, flight)).map((l) => `  Book: ${l.label} ${l.url}`), "",
    "STAY",
    `${stay.name}, ${stay.neighborhood}. ${money(stay.totalPrice)} for ${plan.nights} nights.`,
    ...book(stayLinks(plan, stay, flight)).map((l) => `  Book: ${l.label} ${l.url}`), "",
    "YOUR DAYS",
  ];
  s.schedule.forEach((day, i) => {
    text.push(dayTitle(s, i));
    if (!day.length) text.push("  Free day to wander");
    for (const a of day) text.push(`  - ${a.title}${a.price ? ` (${money(a.price * r.travelers)})` : ""}  ${activityMap(plan, a)}`);
  });
  text.push("", `Planned with Roamwise ${origin}`);

  const row = (a: Activity) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #e6ecf8;vertical-align:top;width:64px">
      ${a.image && /^https?:/.test(a.image) ? `<img src="${esc(a.image)}" width="56" height="56" style="border-radius:10px;object-fit:cover;display:block" alt="">` : ""}
    </td><td style="padding:8px 0 8px 10px;border-bottom:1px solid #e6ecf8;vertical-align:top">
      <div style="font-weight:700">${esc(a.title)}</div>
      <div style="color:#4a4f86;font-size:13px">${esc(a.blurb).slice(0, 160)}</div>
      <a href="${esc(activityMap(plan, a))}" style="font-size:13px;color:#3d7bff">Map</a>
    </td><td style="padding:8px 0;border-bottom:1px solid #e6ecf8;vertical-align:top;text-align:right;font-weight:700;white-space:nowrap">
      ${a.price ? money(a.price * r.travelers) : "Free"}
    </td></tr>`;
  const links = (ls: { label: string; url: string }[]) => ls.map((l) => `<a href="${esc(l.url)}" style="display:inline-block;margin:4px 6px 0 0;padding:6px 12px;border:2px solid #1b1f5e;border-radius:999px;color:#1b1f5e;text-decoration:none;font-weight:700;font-size:13px">${esc(l.label)}</a>`).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#e6f0ff;font-family:Arial,Helvetica,sans-serif;color:#1b1f5e">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="font-weight:800;font-size:20px">Roamwise</div>
    <h1 style="font-size:32px;margin:12px 0 4px">${esc(plan.destinationName)}</h1>
    <div style="color:#4a4f86">${esc(r.startDate)} to ${esc(r.endDate)} · ${plan.nights} nights · ${r.travelers} traveler(s)</div>
    <div style="margin-top:8px;font-weight:700">Total ${money(s.total)} of your ${money(r.budget)} budget</div>
    <div style="background:#fff;border:2px solid #1b1f5e;border-radius:16px;padding:16px;margin-top:20px">
      <div style="font-weight:800;font-size:18px">Flight</div>
      <div style="margin-top:6px">${esc(flight.carrier)}: <b>${flight.origin}</b> ${flight.departTime} → <b>${flight.destination}</b> ${flight.arriveTime}${flight.arriveNextDay ? " (+1)" : ""}, ${flight.stops === 0 ? "nonstop" : `via ${esc(flight.via ?? "")}`}</div>
      <div style="font-weight:700;margin-top:4px">${money(flight.price)} round trip</div>
      ${links(book(flightLinks(plan, flight)))}
    </div>
    <div style="background:#fff;border:2px solid #1b1f5e;border-radius:16px;padding:16px;margin-top:16px">
      <div style="font-weight:800;font-size:18px">Stay</div>
      <div style="margin-top:6px;font-weight:700">${esc(stay.name)}</div>
      <div style="color:#4a4f86">${esc(stay.neighborhood)}${stay.address ? ` · ${esc(stay.address)}` : ""}</div>
      <div style="font-weight:700;margin-top:4px">${money(stay.totalPrice)} for ${plan.nights} nights</div>
      ${links(book(stayLinks(plan, stay, flight)))}
    </div>
    ${s.schedule.map((day, i) => `
    <div style="background:#fff;border:2px solid #1b1f5e;border-radius:16px;padding:16px;margin-top:16px">
      <div style="font-weight:800;font-size:18px">${esc(dayTitle(s, i))}</div>
      ${day.length ? `<table style="width:100%;border-collapse:collapse;margin-top:6px">${day.map(row).join("")}</table>` : `<div style="color:#4a4f86;margin-top:6px">Free day to wander</div>`}
    </div>`).join("")}
    <div style="text-align:center;color:#4a4f86;font-size:12px;margin-top:20px">Planned with <a href="${esc(origin)}" style="color:#3d7bff">Roamwise</a>. Prices are estimates; check the booking links for today's rates.</div>
  </div></body></html>`;

  return { subject, text: text.join("\n"), html };
}
