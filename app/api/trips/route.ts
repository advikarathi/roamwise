// POST /api/trips  { plan, people } -> { id }   Creates a shareable trip.
import { newTripId, putTrip, type Voter } from "@/lib/tripStore";
import type { TripPlan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { plan, people } = (await request.json()) as { plan: TripPlan; people: Voter[] };
  if (!plan?.request) return Response.json({ error: "Missing trip" }, { status: 400 });
  const id = newTripId();
  await putTrip({ id, plan, people: (people ?? []).slice(0, 12), updatedAt: Date.now() });
  return Response.json({ id });
}
