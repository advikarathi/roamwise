import type { Emit, FlightOption, TripRequest } from "../types";
import { flightAirport } from "../airports";
import { duffelFlights } from "../providers/duffel";
import { mockFlights } from "../providers/mock";
import { travelpayoutsFlights } from "../providers/travelpayouts";
import { pause, type AgentContext } from "./context";

/** Flights agent ("Skye"): searches round trips and shortlists cheapest / best value / fastest. */
export async function flightsAgent(trip: TripRequest, ctx: AgentContext, emit: Emit): Promise<FlightOption[]> {
  // Search the airports flights actually use (Noida -> Delhi), keeping the trip itself about the city.
  const req = { ...trip, origin: flightAirport(trip.origin), destination: flightAirport(trip.destination) };
  emit({ type: "status", agent: "flights", state: "working", message: `Checking every route out of ${req.origin}…` });
  await pause(ctx, 900);

  // Real data first: Duffel live (bookable), then Travelpayouts (real recent fares), then Duffel's
  // test sandbox (practice data), and only then estimated sample fares, which are labeled as such.
  const tryIt = async (run: () => Promise<FlightOption[]>) => { try { return await run(); } catch (err) { console.error(err); return []; } };
  const duffelLive = ctx.duffelToken && !ctx.duffelToken.startsWith("duffel_test_") ? ctx.duffelToken : undefined;
  const duffelTest = ctx.duffelToken?.startsWith("duffel_test_") ? ctx.duffelToken : undefined;
  let options: FlightOption[] = [];
  if (duffelLive) options = await tryIt(() => duffelFlights(req, duffelLive));
  if (!options.length && ctx.travelpayoutsToken) options = await tryIt(() => travelpayoutsFlights(req, ctx.travelpayoutsToken!, ctx.travelpayoutsMarker));
  if (!options.length && duffelTest) options = await tryIt(() => duffelFlights(req, duffelTest));
  if (!options.length) options = mockFlights(req);

  emit({ type: "status", agent: "flights", state: "working", message: "Comparing prices, stops and times…" });
  await pause(ctx, 900);

  if (!options.length) {
    emit({ type: "status", agent: "flights", state: "error", message: "No flights found for those dates." });
    return [];
  }
  const nonstop = options.find((o) => o.stops === 0);
  const best = nonstop ?? options[0];
  emit({
    type: "status",
    agent: "flights",
    state: "done",
    message: nonstop ? `Found a nonstop for $${best.price.toLocaleString()}!` : `Best I found: $${best.price.toLocaleString()} with 1 stop`,
  });
  return options;
}
