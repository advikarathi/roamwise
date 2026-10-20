// Small, hand-made trip data shared by the tests.
import type { Activity, FlightOption, StayOption, TripPlan, TripRequest } from "@/lib/types";

export const req: TripRequest = {
  origin: "BOS", destination: "LIS", startDate: "2026-12-01", endDate: "2026-12-05",
  travelers: 2, budget: 3000, vibes: ["food", "culture"], stayType: "either",
};

export const act = (id: string, over: Partial<Activity> = {}): Activity => ({
  id, title: `Plan ${id}`, blurb: "A thing to do.", vibe: "culture", price: 10, durationHours: 2, timeOfDay: "afternoon", ...over,
});

export const flight = (over: Partial<FlightOption> = {}): FlightOption => ({
  id: "f1", label: "Best value", carrier: "TAP Air Portugal", origin: "BOS", destination: "LIS",
  departTime: "18:40", arriveTime: "06:30", arriveNextDay: true, durationMinutes: 410, stops: 0, price: 900, ...over,
});

export const stay = (over: Partial<StayOption> = {}): StayOption => ({
  id: "s1", name: "Hotel Test", kind: "hotel", neighborhood: "Baixa", nightlyPrice: 150, totalPrice: 600,
  perks: [], walkMinutes: 5, color: "#fff", lat: 38.7139, lng: -9.1394, ...over,
});

export const plan = (over: Partial<TripPlan> = {}): TripPlan => ({
  request: req, destinationName: "Lisbon", country: "Portugal", nights: 4,
  flights: [flight()], selectedFlightId: "f1", stays: [stay()], selectedStayId: "s1",
  activities: [], suggestedActivityIds: [], transitEstimate: 80, budget: [], source: "demo", ...over,
});
