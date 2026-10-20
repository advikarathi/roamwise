// POST /api/events  { city, country, startDate, endDate }  ->  { events: Activity[] } | { events: [], reason }
// What's on during the trip, found with Claude's web search (lib/providers/events.ts).
import { eventActivities, findEvents } from "@/lib/providers/events";
import { allow, visitor, withinDailyCap } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // web search can take a while

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAILY_CAP = Number(process.env.EVENTS_DAILY_CAP ?? 150);

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ events: [], reason: "off" });
  let body: { city?: string; country?: string; startDate?: string; endDate?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }
  const city = String(body.city ?? "").slice(0, 80), country = String(body.country ?? "").slice(0, 80);
  if (!city || !ISO.test(body.startDate ?? "") || !ISO.test(body.endDate ?? "")) return Response.json({ error: "Bad request" }, { status: 400 });
  // Each search costs money: a few per visitor per hour, and a daily ceiling for the whole site.
  if (!allow(`events:${visitor(request)}`, 8, 3_600_000) || !withinDailyCap("events", DAILY_CAP)) return Response.json({ events: [], reason: "limit" });
  try {
    const events = await findEvents(city, country, body.startDate!, body.endDate!, key);
    return Response.json({ events: eventActivities(events) });
  } catch (err) {
    console.error("Events:", err instanceof Error ? err.message : err);
    return Response.json({ events: [], reason: "error" });
  }
}
