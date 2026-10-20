// Shared trips for "plan with friends". Uses Upstash Redis when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set (free tier is plenty). Without them it keeps trips in
// memory, which works for local testing but resets whenever the server restarts.
import type { TripPlan } from "./types";

export interface Voter {
  name: string;
  decisions: Record<string, "keep" | "skip">;
}

export interface SharedTrip {
  id: string;
  plan: TripPlan;
  people: Voter[];
  updatedAt: number;
}

const memory = new Map<string, SharedTrip>();
const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL_SECONDS = 60 * 60 * 24 * 60; // trips expire after 60 days

async function redis(command: (string | number)[]) {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Trip store error ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

export async function getTrip(id: string): Promise<SharedTrip | null> {
  if (!URL_ || !TOKEN) return memory.get(id) ?? null;
  const raw = (await redis(["GET", `trip:${id}`])) as string | null;
  return raw ? (JSON.parse(raw) as SharedTrip) : null;
}

export async function putTrip(trip: SharedTrip): Promise<void> {
  if (!URL_ || !TOKEN) {
    memory.set(trip.id, trip);
    return;
  }
  await redis(["SET", `trip:${trip.id}`, JSON.stringify(trip), "EX", TTL_SECONDS]);
}

export function newTripId(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < 8; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

/** Merge one person's swipes into the trip, matching by name (case-insensitive). */
export function mergeVoter(trip: SharedTrip, voter: Voter): SharedTrip {
  const name = voter.name.trim().slice(0, 24) || "Friend";
  const others = trip.people.filter((p) => p.name.toLowerCase() !== name.toLowerCase());
  return { ...trip, people: [...others, { name, decisions: voter.decisions }], updatedAt: Date.now() };
}
