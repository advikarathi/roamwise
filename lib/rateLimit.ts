// Guards for a public deployment: per-visitor rate limits, and daily caps on paid API calls so a
// burst of traffic can't run up a bill. Counters live in memory, so on serverless hosting each
// instance counts separately; that's a soft cap, which is the point (stop runaway costs, not
// enforce exact quotas). For hard limits, move these counters to Redis/Upstash.

const hits = new Map<string, number[]>();

/** True if `key` has made fewer than `max` calls in the last `windowMs`; records this call if so. */
export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 20_000) hits.delete(hits.keys().next().value!); // keep memory bounded
  return true;
}

/** The caller's IP, as best we can tell behind a proxy. */
export function visitor(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

const daily = new Map<string, { day: string; count: number }>();

/** Daily budget for a paid API (e.g. "google-search"). Returns false once today's cap is used up. */
export function withinDailyCap(name: string, cap: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const entry = daily.get(name);
  const count = entry?.day === day ? entry.count : 0;
  if (count >= cap) return false;
  daily.set(name, { day, count: count + 1 });
  return true;
}

const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);
const env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};

/** Caps, overridable from the environment. */
export const CAPS = {
  googleSearchesPerDay: num(env.GOOGLE_DAILY_SEARCH_CAP, 400),
  googlePhotosPerDay: num(env.GOOGLE_DAILY_PHOTO_CAP, 3000),
  plansPerHour: num(env.PLANS_PER_HOUR_PER_VISITOR, 12),
  chatsPerHour: num(env.CHATS_PER_HOUR_PER_VISITOR, 40),
  photosPerHour: num(env.PHOTOS_PER_HOUR_PER_VISITOR, 400),
};

export const tooMany = (message: string) => Response.json({ error: message }, { status: 429 });
