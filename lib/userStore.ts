// Trips saved to a signed-in user's account. Stored in Upstash Redis (one hash per user) when
// UPSTASH_REDIS_REST_URL/TOKEN are set; in memory otherwise (fine locally, resets on restart).
import type { PlannerEdits } from "@/components/trip/Itinerary";
import type { TripPlan } from "./types";

export interface AccountTripSummary {
  id: string;
  code: string;
  city: string;
  country: string;
  color: string;
  startDate: string;
  endDate: string;
  total: number;
  savedAt: number;
}

export interface AccountTrip extends AccountTripSummary {
  plan: TripPlan;
  keeps: string[];
  edits: PlannerEdits;
}

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const memory = new Map<string, Map<string, string>>();
const MAX_TRIPS = 50;

async function redis(command: (string | number)[]): Promise<unknown> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`User store error ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

const key = (uid: string) => `user:${uid}:trips`;
const summary = ({ plan: _p, keeps: _k, edits: _e, ...s }: AccountTrip): AccountTripSummary => s;

export async function listTrips(uid: string): Promise<AccountTripSummary[]> {
  let values: string[];
  if (!URL_ || !TOKEN) values = [...(memory.get(uid)?.values() ?? [])];
  else values = ((await redis(["HVALS", key(uid)])) as string[] | null) ?? [];
  return values.map((v) => summary(JSON.parse(v) as AccountTrip)).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getTrip(uid: string, id: string): Promise<AccountTrip | null> {
  const raw = !URL_ || !TOKEN ? memory.get(uid)?.get(id) : ((await redis(["HGET", key(uid), id])) as string | null);
  return raw ? (JSON.parse(raw) as AccountTrip) : null;
}

/** Saves (or replaces) a trip. Returns false if the account already holds the maximum. */
export async function saveTrip(uid: string, trip: AccountTrip): Promise<boolean> {
  const existing = await listTrips(uid);
  if (existing.length >= MAX_TRIPS && !existing.some((t) => t.id === trip.id)) return false;
  const value = JSON.stringify(trip);
  if (!URL_ || !TOKEN) {
    if (!memory.has(uid)) memory.set(uid, new Map());
    memory.get(uid)!.set(trip.id, value);
  } else {
    await redis(["HSET", key(uid), trip.id, value]);
  }
  return true;
}

export async function deleteTrip(uid: string, id: string): Promise<void> {
  if (!URL_ || !TOKEN) memory.get(uid)?.delete(id);
  else await redis(["HDEL", key(uid), id]);
}

/** One trip per destination and start date, so re-saving updates it instead of duplicating. */
export const tripIdFor = (code: string, startDate: string) => `${code.toUpperCase()}-${startDate}`.replace(/[^A-Z0-9-]/g, "");
