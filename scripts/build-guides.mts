// Builds public/guides/<CODE>.json for popular destinations: Wikivoyage listings, well-known places,
// and a checked photo for as many places, hotels and neighborhoods as we can find.
// Run: npm run guides:build            (all cities; re-running fills in photos that were missed)
//      npm run guides:build -- LIS OPO  (just these)
// It's deliberately slow (one request at a time with a gap) to stay within Wikimedia's limits.
// Pick up WIKIMEDIA_CONTACT etc. (Next loads these itself; a plain script has to.)
for (const f of [".env.local", ".env"]) { try { process.loadEnvFile(f); } catch { /* not there */ } }
process.env.WIKIMEDIA_GAP_MS ??= "2500";

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPlace } from "../lib/destinations";
import type { Guide } from "../lib/guides";
import { mockActivities } from "../lib/providers/mock";
import { attachPhotos, geocodeCity, photoFor, placeActivities } from "../lib/providers/places";
import { cityListings, commonsPhotosByName, commonsThumb, listingActivities, wikidataImages, wikidataPhotosByName } from "../lib/providers/wikivoyage";
import type { TripRequest } from "../lib/types";

const CITIES = (
  "LIS MEX CDG BCN HND MSY KEF SJU " + // featured
  "OPO FCO LHR JFK AMS BER PRG VIE BUD ATH IST DUB EDI MAD SVQ NCE FLR VCE NAP MXP CPH " +
  "BKK SIN HKG ICN KIX TPE SYD MEL CPT RAK DXB YYZ YVR YUL SFO LAX ORD MIA BOS SEA CUN CTG LIM CUZ EZE GIG HAN SGN AUS"
).split(" ");

const outDir = path.join(process.cwd(), "public", "guides");
const exists = (p: string) => access(p).then(() => true, () => false);

async function build(code: string): Promise<string> {
  const place = getPlace(code);
  if (!place) return "unknown airport";
  const city = place.city;
  const center = place.center ?? (await geocodeCity(city, place.country));

  const listings = await cityListings(city, place.country);
  if (listings.length < 10) return `only ${listings.length} listings, skipped`;
  // Keep photos from earlier runs; this run only looks for the missing ones.
  const file = path.join(outDir, `${code}.json`);
  const prev = (await exists(file)) ? (JSON.parse(await readFile(file, "utf8")) as Guide) : undefined;
  const photos: Record<string, string> = { ...prev?.photos };
  const need = (names: string[]) => names.filter((n) => !photos[n]);

  // Hotels first (they matter most): their own Wikidata photo, else Commons by name.
  const sleeps = listings.filter((l) => l.type === "sleep");
  const own = await wikidataImages(sleeps.filter((l) => l.wikidata && !photos[l.name]).map((l) => l.wikidata!));
  for (const l of sleeps) {
    if (photos[l.name]) continue;
    if (l.image) photos[l.name] = commonsThumb(l.image);
    else if (l.wikidata && own.has(l.wikidata)) photos[l.name] = commonsThumb(own.get(l.wikidata)!);
  }
  // Then Wikidata by name, accepted only when the item's coordinates match the hotel's address.
  for (const [name, f] of await wikidataPhotosByName(sleeps.filter((l) => !photos[l.name]))) photos[name] = commonsThumb(f);
  for (const [name, f] of await commonsPhotosByName(need(sleeps.map((l) => l.name)), city)) photos[name] = commonsThumb(f);

  // Neighborhood photos, for stays without their own.
  for (const d of new Set(listings.map((l) => l.district))) {
    if (photos[`area:${d}`]) continue;
    const src = await photoFor(d === city ? city : `${d} ${city}`);
    if (src) photos[`area:${d}`] = src;
  }

  // Hand-written ideas (featured cities).
  if (place.featured) {
    const req = { destination: code, vibes: [] } as unknown as TripRequest;
    const hand = mockActivities(req).filter((a) => !photos[a.title]);
    for (const a of await attachPhotos(hand, city)) if (a.image) photos[a.title] = a.image;
  }

  // Things to do from the guide: Wikidata / exact-article photos, then Commons by name.
  const all = listingActivities(listings, place.country);
  const acts = await attachPhotos(all.filter((a) => !photos[a.title]), city);
  for (const a of acts) if (a.image) photos[a.title] = a.image;
  for (const [name, f] of await commonsPhotosByName(need(all.map((a) => a.title)).slice(0, 60), city)) photos[name] = commonsThumb(f);

  // Well-known places nearby, with photos and article blurbs (reuse the last good set).
  const fresh = center ? await attachPhotos(await placeActivities(center, city), city) : [];
  const places = fresh.filter((a) => a.image).length >= (prev?.places.filter((a) => a.image).length ?? 0) ? fresh : prev!.places;

  const guide: Guide = { code, city, country: place.country, center, builtAt: new Date().toISOString(), listings, places, photos };
  await writeFile(file, JSON.stringify(guide));
  const things = all.length, withPhoto = all.filter((a) => photos[a.title]).length;
  const hotels = sleeps.length, hotelPhotos = sleeps.filter((l) => photos[l.name]).length;
  return `${things} things to do (${withPhoto} with photos), ${hotels} stays (${hotelPhotos} with photos), ${places.length} landmarks`;
}

// Count responses per site so throttling shows up in the log instead of as quietly missing photos.
const stats: Record<string, number> = {};
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const host = new URL(String(input)).host.split(".").slice(-2, -1)[0];
  const res = await realFetch(input, init);
  const key = `${host}:${res.status}`;
  stats[key] = (stats[key] ?? 0) + 1;
  return res;
}) as typeof fetch;
const flushStats = () => { const s = JSON.stringify(stats); for (const k of Object.keys(stats)) delete stats[k]; return s; };

await mkdir(outDir, { recursive: true });
const only = process.argv.slice(2).map((c) => c.toUpperCase());
for (const code of only.length ? only : CITIES) {
  const t = Date.now();
  try {
    console.log(`${code}: ${await build(code)} [${Math.round((Date.now() - t) / 1000)}s] ${flushStats()}`);
  } catch (err) {
    console.log(`${code}: failed (${(err as Error).message})`);
  }
}
