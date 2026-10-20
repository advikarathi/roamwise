// GET   /api/trips/:id               -> the shared trip
// PATCH /api/trips/:id  { name, decisions }  -> saves one person's swipes
// PUT   /api/trips/:id  { plan }      -> replaces the plan (after "ask the crew" changes)
import { getTrip, mergeVoter, putTrip, type Voter } from "@/lib/tripStore";
import type { TripPlan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const trip = await getTrip((await params).id);
  return trip ? Response.json(trip) : Response.json({ error: "Trip not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const trip = await getTrip((await params).id);
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  const voter = (await req.json()) as Voter;
  if (!voter?.name || typeof voter.decisions !== "object") return Response.json({ error: "Missing name or picks" }, { status: 400 });
  const next = mergeVoter(trip, voter);
  await putTrip(next);
  return Response.json(next);
}

export async function PUT(req: Request, { params }: Ctx) {
  const trip = await getTrip((await params).id);
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
  const { plan } = (await req.json()) as { plan: TripPlan };
  const next = { ...trip, plan, updatedAt: Date.now() };
  await putTrip(next);
  return Response.json(next);
}
