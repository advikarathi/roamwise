// Orchestrator: runs the crew in order.
//   1. Budget agent splits the money.
//   2. Flights + stays agents search in parallel.
//   3. Activities agent plans around the chosen stay.
//   4. Budget agent picks the final combo and rebalances.
import type { Emit, TripPlan, TripRequest } from "../types";
import { getPlace } from "../destinations";
import { getAirport } from "../airports";
import { geocodeCity } from "../providers/places";
import { activitiesAgent } from "./activities";
import { allocate, budgetLines, chooseActivities, chooseCore, explain, transitEstimate } from "./budget";
import { nightsBetween, pause, type AgentContext } from "./context";
import { flightsAgent } from "./flights";
import { staysAgent } from "./stays";

export async function planTrip(req: TripRequest, ctx: AgentContext, emit: Emit): Promise<TripPlan | null> {
  const dest = getPlace(req.destination);
  const nights = nightsBetween(req.startDate, req.endDate);
  const targets = allocate(req.budget);
  const transit = transitEstimate(nights, req.travelers);

  emit({ type: "status", agent: "budget", state: "working", message: `Splitting $${req.budget.toLocaleString()} across the crew…` });
  emit({ type: "status", agent: "activities", state: "waiting", message: "Waiting to see where you're staying" });
  await pause(ctx, 700);
  emit({
    type: "status",
    agent: "budget",
    state: "waiting",
    message: `$${targets.flights.toLocaleString()} for flights, $${targets.stay.toLocaleString()} for the stay, $${(targets.activities + targets.transit).toLocaleString()} for fun`,
  });

  // Featured cities know their center; anywhere else, look it up (the airport can be far out of town).
  const airport = getAirport(req.destination);
  const guide = await ctx.loadGuide?.(req.destination);
  const findCenter = dest?.center ?? guide?.center
    ? Promise.resolve(dest?.center ?? guide!.center)
    : (dest ? geocodeCity(dest.city, dest.country) : Promise.resolve(undefined))
        .then((c) => c ?? (airport ? { lat: airport.lat, lng: airport.lng } : undefined));
  const [flights, stays, center] = await Promise.all([
    flightsAgent(req, ctx, emit),
    staysAgent(req, nights, targets.stay, ctx, emit, findCenter),
    findCenter,
  ]);
  if (!flights.length || !stays.length) {
    emit({ type: "error", message: "The crew couldn't find enough options. Try other dates or a bigger budget." });
    return null;
  }

  const core = chooseCore(req, flights, stays, transit);
  const activities = await activitiesAgent(req, core.stay.neighborhood, targets.activities, ctx, emit, center);

  emit({ type: "status", agent: "budget", state: "working", message: "Checking the math…" });
  await pause(ctx, 800);
  const moneyLeft = req.budget - core.flight.price - core.stay.totalPrice - transit;
  const suggested = chooseActivities(req, activities, Math.max(0, moneyLeft), nights);
  const lines = budgetLines(req, core.flight, core.stay, activities.filter((a) => suggested.includes(a.id)), transit);
  const total = lines.reduce((s, l) => s + l.actual, 0);
  emit({
    type: "status",
    agent: "budget",
    state: "done",
    message: total <= req.budget ? `All in for $${total.toLocaleString()}. $${(req.budget - total).toLocaleString()} to spare!` : `$${(total - req.budget).toLocaleString()} over. I flagged it.`,
  });

  const plan: TripPlan = {
    request: req,
    destinationName: dest?.city ?? req.destination,
    country: dest?.country ?? "",
    nights,
    flights,
    selectedFlightId: core.flight.id,
    stays,
    selectedStayId: core.stay.id,
    activities,
    suggestedActivityIds: suggested,
    transitEstimate: transit,
    budget: lines,
    budgetNote: explain(lines, req.budget),
    source: ctx.duffelToken || ctx.anthropicKey ? "live" : "demo",
    center,
  };
  emit({ type: "plan", plan });
  return plan;
}
