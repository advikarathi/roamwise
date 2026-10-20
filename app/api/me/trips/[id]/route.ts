// GET /api/me/trips/<id> -> one saved trip in full;  DELETE -> remove it.
import { currentUserId } from "@/auth";
import { deleteTrip, getTrip } from "@/lib/userStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUserId();
  if (!uid) return Response.json({ error: "Sign in first." }, { status: 401 });
  const trip = await getTrip(uid, (await params).id);
  return trip ? Response.json(trip) : Response.json({ error: "Trip not found" }, { status: 404 });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUserId();
  if (!uid) return Response.json({ error: "Sign in first." }, { status: 401 });
  await deleteTrip(uid, (await params).id);
  return Response.json({ deleted: true });
}
