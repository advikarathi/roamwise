// Budget agent: splits the budget up front, then picks the combination of options
// that fits, moving money between categories when one comes in over target.
import type { Activity, BudgetLine, FlightOption, StayOption, TripRequest } from "../types";

export const SPLIT = { flights: 0.4, stay: 0.42, activities: 0.14, transit: 0.04 } as const;

export function allocate(budget: number) {
  return {
    flights: Math.round(budget * SPLIT.flights),
    stay: Math.round(budget * SPLIT.stay),
    activities: Math.round(budget * SPLIT.activities),
    transit: Math.round(budget * SPLIT.transit),
  };
}

export function transitEstimate(nights: number, travelers: number): number {
  return Math.round((nights + 1) * 9 * travelers);
}

/** Pick the flight + stay pair that fits best, preferring "Best value" flights. */
export function chooseCore(req: TripRequest, flights: FlightOption[], stays: StayOption[], transit: number) {
  const targets = allocate(req.budget);
  const flightOrder = [...flights].sort((a, b) => {
    const rank = (f: FlightOption) => (f.label === "Best value" ? 0 : f.label === "Cheapest" ? 1 : 2);
    return rank(a) - rank(b);
  });
  const reserve = targets.activities + transit; // keep money for fun

  for (const f of flightOrder) {
    const affordableStays = stays
      .filter((s) => f.price + s.totalPrice + reserve <= req.budget)
      .sort((a, b) => Math.abs(a.totalPrice - targets.stay) - Math.abs(b.totalPrice - targets.stay));
    if (affordableStays.length) return { flight: f, stay: affordableStays[0], fits: true };
  }
  // Nothing fits: cheapest of each and flag it.
  const cheapestFlight = [...flights].sort((a, b) => a.price - b.price)[0];
  const cheapestStay = [...stays].sort((a, b) => a.totalPrice - b.totalPrice)[0];
  return { flight: cheapestFlight, stay: cheapestStay, fits: false };
}

/** Default activity picks: best vibe matches that fit what's left. */
export function chooseActivities(req: TripRequest, activities: Activity[], moneyLeft: number, nights: number): string[] {
  const picks: string[] = [];
  let spent = 0;
  const maxCount = Math.min(activities.length, nights * 2);
  for (const a of activities) {
    const cost = a.price * req.travelers;
    if (picks.length >= maxCount) break;
    if (spent + cost <= moneyLeft) {
      picks.push(a.id);
      spent += cost;
    }
  }
  return picks;
}

export function budgetLines(
  req: TripRequest,
  flight: FlightOption | undefined,
  stay: StayOption | undefined,
  activities: Activity[],
  transit: number,
): BudgetLine[] {
  const t = allocate(req.budget);
  return [
    { category: "flights", target: t.flights, actual: flight?.price ?? 0 },
    { category: "stay", target: t.stay, actual: stay?.totalPrice ?? 0 },
    { category: "activities", target: t.activities, actual: activities.reduce((s, a) => s + a.price * req.travelers, 0) },
    { category: "transit", target: t.transit, actual: transit },
  ];
}

export function explain(lines: BudgetLine[], budget: number): string {
  const total = lines.reduce((s, l) => s + l.actual, 0);
  const over = lines.filter((l) => l.actual > l.target);
  const under = lines.filter((l) => l.actual < l.target);
  if (total > budget) return `This trip is $${total - budget} over budget. Try the cheapest flight or a cheaper stay.`;
  if (over.length && under.length) {
    const o = over[0];
    const u = under.sort((a, b) => b.target - b.actual - (a.target - a.actual))[0];
    return `${cap(o.category)} came in $${o.actual - o.target} over target, so I moved money from ${u.category}, which came in $${u.target - u.actual} under.`;
  }
  return `Everything fits, with $${budget - total} to spare.`;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
