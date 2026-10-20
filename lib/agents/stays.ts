import type { Emit, StayOption, TripRequest } from "../types";
import { getPlace } from "../destinations";
import { duffelStays } from "../providers/duffel";
import { googleStays } from "../providers/google";
import { mockStays } from "../providers/mock";
import { photoFor } from "../providers/places";
import { cityListings, commonsPhotosByName, commonsThumb, listingStays, wikidataImages } from "../providers/wikivoyage";
import { pause, type AgentContext } from "./context";

const SHOW = 9;

/** A spread of real stays around the target price: the closest matches, plus cheaper and pricier ones to compare. */
function pickSpread(stays: StayOption[], target: number): StayOption[] {
  const central = stays.slice(0, 30); // already sorted by walk to the center
  const byFit = [...central].sort((a, b) => Math.abs(a.totalPrice - target) - Math.abs(b.totalPrice - target));
  const picks = new Set(byFit.slice(0, 5));
  for (const s of [...central].sort((a, b) => a.totalPrice - b.totalPrice)) if (picks.size < SHOW - 2 && s.totalPrice < target) picks.add(s);
  for (const s of [...central].sort((a, b) => b.totalPrice - a.totalPrice)) if (picks.size < SHOW && s.totalPrice > target) picks.add(s);
  for (const s of byFit) if (picks.size < SHOW) picks.add(s);
  return [...picks].sort((a, b) => Math.abs(a.totalPrice - target) - Math.abs(b.totalPrice - target));
}

/** Stays agent ("Nest"): real hotels and apartments, from Duffel when there's a key and the
 *  city's travel guide otherwise. Made-up samples only if both come up empty. */
export async function staysAgent(
  req: TripRequest,
  nights: number,
  stayTarget: number,
  ctx: AgentContext,
  emit: Emit,
  center?: Promise<{ lat: number; lng: number } | undefined> | { lat: number; lng: number },
): Promise<StayOption[]> {
  const dest = getPlace(req.destination);
  const city = dest?.city ?? req.destination;
  const kind = req.stayType === "either" ? "places to stay" : `${req.stayType}s`;
  emit({ type: "status", agent: "stays", state: "working", message: `Reading the ${city} travel guide for ${kind}…` });
  await pause(ctx, 900);

  let options: StayOption[] = [];
  if (ctx.duffelToken && req.stayType !== "apartment") {
    try {
      options = await duffelStays(req, nights, ctx.duffelToken);
    } catch (err) {
      console.error(err);
    }
  }
  const guide = await ctx.loadGuide?.(req.destination);
  // Google Places: real hotels with photos and ratings (prices are estimates).
  if (!options.length && dest && ctx.googleKey) {
    const typical = req.stayType === "apartment" ? dest.apartmentNightly : dest.hotelNightly;
    const found = await googleStays(req, nights, dest.city, ctx.googleKey, typical, (await center) ?? guide?.center);
    if (found.length >= 3) options = pickSpread(found, stayTarget);
  }
  if (!options.length && dest) {
    const listings = guide?.listings ?? await cityListings(dest.city, dest.country);
    const typical = req.stayType === "apartment" ? dest.apartmentNightly : dest.hotelNightly;
    const all = listingStays(listings, req, nights, dest.country, typical, await center);
    if (all.length >= 3) {
      options = pickSpread(all, stayTarget);
      emit({ type: "status", agent: "stays", state: "working", message: `Found ${all.length} real places to stay. Comparing prices…` });
    }
  }
  if (!options.length) options = mockStays(req, nights);

  // Photos: the place's own when it has one, otherwise its neighborhood, labelled as such.
  if (guide) {
    // Pre-built guide: photos were found and checked when it was built. No network calls here.
    options = options.map((o) => ({ ...o, photo: o.photo ?? guide.photos[o.name], areaPhoto: guide.photos[`area:${o.neighborhood}`] ?? guide.photos[`area:${city}`] }));
    emit({ type: "status", agent: "stays", state: "working", message: `Keeping it near ${stayTarget.toLocaleString()} for ${nights} nights…` });
    await pause(ctx, 700);
    const best = [...options].sort((a, b) => Math.abs(a.totalPrice - stayTarget) - Math.abs(b.totalPrice - stayTarget))[0];
    emit({ type: "status", agent: "stays", state: "done", message: best ? `Love ${best.name} in ${best.neighborhood}.` : "No stays found." });
    return options;
  }
  const ids = options.filter((o) => !o.photo && o.wikidataId).map((o) => o.wikidataId!);
  const own = ids.length ? await wikidataImages(ids) : new Map<string, string>();
  options = options.map((o) => (o.wikidataId && own.has(o.wikidataId) ? { ...o, photo: commonsThumb(own.get(o.wikidataId)!) } : o));
  const unnamed = options.filter((o) => !o.photo && !o.id.startsWith("stay-")).map((o) => o.name);
  const byName = unnamed.length ? await commonsPhotosByName(unnamed, city) : new Map<string, string>();
  options = options.map((o) => (!o.photo && byName.has(o.name) ? { ...o, photo: commonsThumb(byName.get(o.name)!) } : o));
  const areas = [...new Set(options.filter((o) => !o.photo).map((o) => o.neighborhood))];
  const photos = new Map(await Promise.all(areas.map(async (h) => [h, await photoFor(h === city ? city : `${h} ${city}`)] as const)));
  options = options.map((o) => (o.photo ? o : { ...o, areaPhoto: photos.get(o.neighborhood) }));

  emit({ type: "status", agent: "stays", state: "working", message: `Keeping it near $${stayTarget.toLocaleString()} for ${nights} nights…` });
  await pause(ctx, 700);

  const top = [...options].sort((a, b) => Math.abs(a.totalPrice - stayTarget) - Math.abs(b.totalPrice - stayTarget))[0];
  emit({ type: "status", agent: "stays", state: "done", message: top ? `Love ${top.name} in ${top.neighborhood}.` : "No stays found." });
  return options;
}
