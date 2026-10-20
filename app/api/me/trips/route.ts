// GET  /api/me/trips          -> the signed-in user's saved trips (summaries)
// POST /api/me/trips {trip}   -> save or update one (the whole plan, kept ideas and day edits)
import { authEnabled, currentUserId } from "@/auth";
import { allow } from "@/lib/rateLimit";
import { listTrips, saveTrip, tripIdFor, type AccountTrip } from "@/lib/userStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!authEnabled) return Response.json({ enabled: false, trips: [] });
  const uid = await currentUserId();
  if (!uid) return Response.json({ error: "Sign in to see your trips." }, { status: 401 });
  return Response.json({ enabled: true, trips: await listTrips(uid) });
}

export async function POST(request: Request) {
  const uid = await currentUserId();
  if (!uid) return Response.json({ error: "Sign in to save trips to your account." }, { status: 401 });
  if (!allow(`save:${uid}`, 60, 3_600_000)) return Response.json({ error: "Too many saves. Try again in a bit." }, { status: 429 });

  let body: Partial<AccountTrip>;
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const plan = body.plan;
  if (!plan?.request?.destination || !plan.request.startDate) return Response.json({ error: "Missing trip" }, { status: 400 });
  if (JSON.stringify(body).length > 800_000) return Response.json({ error: "Trip too large" }, { status: 413 });

  const trip: AccountTrip = {
    id: tripIdFor(plan.request.destination, plan.request.startDate),
    code: String(body.code ?? plan.request.destination).slice(0, 4),
    city: String(body.city ?? plan.destinationName).slice(0, 80),
    country: String(body.country ?? plan.country ?? "").slice(0, 80),
    color: String(body.color ?? "#3d7bff").slice(0, 16),
    startDate: plan.request.startDate,
    endDate: plan.request.endDate,
    total: Math.round(Number(body.total) || 0),
    savedAt: Date.now(),
    plan,
    keeps: (body.keeps ?? []).filter((k): k is string => typeof k === "string").slice(0, 200),
    edits: body.edits ?? { layout: null, dropped: [], custom: [] },
  };
  if (!(await saveTrip(uid, trip))) return Response.json({ error: "Your account is full (50 trips). Delete one to save more." }, { status: 409 });
  return Response.json({ saved: true, id: trip.id });
}
