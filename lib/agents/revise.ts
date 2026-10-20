// Change requests: "make it cheaper", "add a beach day", "nonstop only"…
// Each change wakes up only the agents it affects; everyone else keeps their work.
import type { AgentId, Emit, StayType, TripPlan, Vibe } from "../types";
import { getPlace } from "../destinations";
import { activitiesAgent } from "./activities";
import { allocate, budgetLines, chooseCore, explain } from "./budget";
import { pause, type AgentContext } from "./context";
import { staysAgent } from "./stays";

export type Change =
  | { kind: "cheaper" }
  | { kind: "fancier" }
  | { kind: "nonstop" }
  | { kind: "fastest" }
  | { kind: "addVibe"; vibe: Vibe }
  | { kind: "stayType"; stayType: StayType }
  | { kind: "budget"; amount: number };

const VIBE_WORDS: Record<Vibe, RegExp> = {
  beach: /beach|sea|ocean|swim|sand/,
  food: /food|eat|restaurant|dinner|lunch|brunch|cafe|café/,
  culture: /culture|museum|history|art|gallery/,
  nightlife: /night ?life|party|club|bar|drinks|dancing/,
  outdoors: /outdoor|hike|hiking|nature|adventure|day trip/,
  chill: /chill|relax|slow|spa|rest/,
};

/** Rule-based reading of a change request. Returns [] when nothing matched. */
export function parseChange(text: string): Change[] {
  const t = text.toLowerCase();
  const out: Change[] = [];
  const money = t.match(/\$?\s?(\d[\d,]{2,})/);
  if (money && /budget|\$|spend|total/.test(t)) out.push({ kind: "budget", amount: Number(money[1].replace(/,/g, "")) });
  else if (/cheap|less money|save|lower|budget|afford/.test(t)) out.push({ kind: "cheaper" });
  if (/fancy|fancier|nicer|luxur|upgrade|splurge|better (hotel|stay)/.test(t)) out.push({ kind: "fancier" });
  if (/non-?stop|direct|no (stops|layover)/.test(t)) out.push({ kind: "nonstop" });
  else if (/fast|quick|shortest/.test(t)) out.push({ kind: "fastest" });
  if (/\bhotel\b/.test(t) && !/apartment/.test(t)) out.push({ kind: "stayType", stayType: "hotel" });
  if (/apartment|airbnb|flat|kitchen/.test(t)) out.push({ kind: "stayType", stayType: "apartment" });
  for (const [vibe, re] of Object.entries(VIBE_WORDS) as [Vibe, RegExp][]) if (re.test(t)) out.push({ kind: "addVibe", vibe });
  return out;
}

const AFFECTS: Record<Change["kind"], AgentId[]> = {
  cheaper: ["budget", "flights", "stays", "activities"],
  fancier: ["stays", "budget"],
  nonstop: ["flights", "budget"],
  fastest: ["flights", "budget"],
  addVibe: ["activities", "budget"],
  stayType: ["stays", "budget"],
  budget: ["budget", "flights", "stays"],
};

export function affectedAgents(changes: Change[]): AgentId[] {
  return [...new Set(changes.flatMap((c) => AFFECTS[c.kind]))];
}

export async function revisePlan(plan: TripPlan, changes: Change[], ctx: AgentContext, emit: Emit): Promise<TripPlan> {
  let next: TripPlan = { ...plan, request: { ...plan.request } };
  const req = next.request;
  const place = getPlace(req.destination);
  const say = (agent: AgentId, state: "working" | "done", message: string) => emit({ type: "status", agent, state, message });

  for (const c of changes) {
    if (c.kind === "budget") {
      req.budget = c.amount;
      say("budget", "working", `New budget: $${c.amount.toLocaleString()}. Re-splitting…`);
      await pause(ctx, 600);
      const core = chooseCore(req, next.flights, next.stays, next.transitEstimate);
      next.selectedFlightId = core.flight.id;
      next.selectedStayId = core.stay.id;
      say("flights", "done", `Best fit now: ${core.flight.label.toLowerCase()} fare, $${core.flight.price.toLocaleString()}`);
      say("stays", "done", `Best fit now: ${core.stay.name}`);
    }

    if (c.kind === "cheaper") {
      say("budget", "working", "Hunting for savings…");
      await pause(ctx, 500);
      const cheapestFlight = [...next.flights].sort((a, b) => a.price - b.price)[0];
      next.selectedFlightId = cheapestFlight.id;
      say("flights", "done", `Switched to the ${cheapestFlight.label.toLowerCase()} fare: $${cheapestFlight.price.toLocaleString()}`);
      const cheapestStay = [...next.stays].sort((a, b) => a.totalPrice - b.totalPrice)[0];
      next.selectedStayId = cheapestStay.id;
      say("stays", "done", `${cheapestStay.name} for $${cheapestStay.totalPrice.toLocaleString()}`);
      next.activities = [...next.activities].sort((a, b) => a.price - b.price);
      next.suggestedActivityIds = next.activities.filter((a) => a.price <= 15).map((a) => a.id);
      say("activities", "done", "Moved the free and cheap ideas to the top");
    }

    if (c.kind === "nonstop" || c.kind === "fastest") {
      say("flights", "working", c.kind === "nonstop" ? "Looking for nonstops…" : "Looking for the quickest route…");
      await pause(ctx, 700);
      const pool = c.kind === "nonstop" ? next.flights.filter((f) => f.stops === 0) : next.flights;
      const pick = [...pool].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
      if (pick) {
        next.selectedFlightId = pick.id;
        say("flights", "done", `${pick.stops === 0 ? "Nonstop" : "Quickest"}: ${Math.floor(pick.durationMinutes / 60)}h for $${pick.price.toLocaleString()}`);
      } else {
        say("flights", "done", "No nonstops on this route, so I kept the quickest connection.");
      }
    }

    if (c.kind === "fancier" || c.kind === "stayType") {
      if (c.kind === "stayType") req.stayType = c.stayType;
      const target = Math.round(allocate(req.budget).stay * (c.kind === "fancier" ? 1.4 : 1));
      const stays = await staysAgent(req, next.nights, target, ctx, emit, next.center);
      const sorted = [...stays].sort((a, b) => b.totalPrice - a.totalPrice);
      const pick = c.kind === "fancier" ? sorted[0] : sorted.sort((a, b) => Math.abs(a.totalPrice - target) - Math.abs(b.totalPrice - target))[0];
      next = { ...next, stays, selectedStayId: pick.id };
      say("stays", "done", c.kind === "fancier" ? `Upgraded you to ${pick.name}` : `Found you ${req.stayType === "hotel" ? "a hotel" : "an apartment"}: ${pick.name}`);
    }

    if (c.kind === "addVibe") {
      if (!req.vibes.includes(c.vibe)) req.vibes = [...req.vibes, c.vibe];
      const stay = next.stays.find((s) => s.id === next.selectedStayId);
      const fresh = await activitiesAgent(req, stay?.neighborhood ?? place?.city ?? "town", allocate(req.budget).activities, ctx, emit, next.center);
      const known = new Set(next.activities.map((a) => a.title));
      const added = fresh.filter((a) => !known.has(a.title));
      const matching = [...added, ...next.activities].sort((a, b) => Number(b.vibe === c.vibe) - Number(a.vibe === c.vibe));
      next.activities = matching;
      const count = matching.filter((a) => a.vibe === c.vibe).length;
      say("activities", "done", count ? `Put ${count} ${c.vibe} ${count === 1 ? "idea" : "ideas"} at the top of your deck` : `Couldn't find more ${c.vibe} ideas here`);
    }
  }

  const flight = next.flights.find((f) => f.id === next.selectedFlightId);
  const stay = next.stays.find((s) => s.id === next.selectedStayId);
  next.budget = budgetLines(req, flight, stay, [], next.transitEstimate);
  next.budgetNote = explain(next.budget, req.budget);
  const total = next.budget.reduce((s, l) => s + l.actual, 0);
  say("budget", "done", total <= req.budget ? `Flights and stay now $${(total - next.transitEstimate).toLocaleString()}` : `Still $${(total - req.budget).toLocaleString()} over`);
  emit({ type: "plan", plan: next });
  return next;
}

/** Ask Claude to turn free text into changes, for requests the rules don't catch. */
// Free-text change requests the rules above miss are read by Claude: see claudeParseChange in lib/providers/claude.ts.
