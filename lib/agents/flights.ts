import type { Emit, FlightOption, TripRequest } from "../types";
import { flightAirport } from "../airports";
import { duffelFlights } from "../providers/duffel";
import { mockFlights } from "../providers/mock";
import { pause, type AgentContext } from "./context";

/** Flights agent ("Skye"): searches round trips and shortlists cheapest / best value / fastest. */
export async function flightsAgent(trip: TripRequest, ctx: AgentContext, emit: Emit): Promise<FlightOption[]> {
  // Search the airports flights actually use (Noida -> Delhi), keeping the trip itself about the city.
  const req = { ...trip, origin: flightAirport(trip.origin), destination: flightAirport(trip.destination) };
  emit({ type: "status", agent: "flights", state: "working", message: `Checking every route out of ${req.origin}…` });
  await pause(ctx, 900);

  let options: FlightOption[] = [];
  if (ctx.duffelToken) {
    try {
      options = await duffelFlights(req, ctx.duffelToken);
    } catch (err) {
      console.error(err);
    }
  }
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
