import type { Activity, Emit, TripRequest, Vibe } from "../types";
import { getPlace } from "../destinations";
import { claudeActivities } from "../providers/claude";
import { googleActivities, googleFillPhotos } from "../providers/google";
import { mockActivities } from "../providers/mock";
import { attachPhotos, placeActivities } from "../providers/places";
import { cityListings, listingActivities } from "../providers/wikivoyage";
import { pause, type AgentContext } from "./context";

const MAX_IDEAS = 70;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function km(a: Activity, b: Activity) {
  if (a.lat === undefined || b.lat === undefined || a.lng === undefined || b.lng === undefined) return Infinity;
  const x = (b.lng - a.lng) * 111.32 * Math.cos((a.lat * Math.PI) / 180);
  const y = (b.lat - a.lat) * 110.57;
  return Math.hypot(x, y);
}

/** Keep the first of any near-duplicates: same name, same Wikipedia article, or a place within ~150 m. */
function dedupe(lists: Activity[][]): Activity[] {
  const out: Activity[] = [];
  const names = new Set<string>();
  for (const list of lists) {
    for (const a of list) {
      const keys = [fold(a.title), a.wiki ? fold(a.wiki) : ""].filter(Boolean);
      if (keys.some((k) => names.has(k))) continue;
      // Same sight under another name ("Tile museum" vs "Museu Nacional do Azulejo"). Restaurants can be neighbors, so not those.
      const sight = a.vibe !== "food" && a.vibe !== "nightlife";
      if (sight && !a.id.startsWith("act-") && out.some((b) => b.vibe === a.vibe && km(a, b) < 0.12)) continue;
      keys.forEach((k) => names.add(k));
      out.push(a);
    }
  }
  return out;
}

/** Interleave vibes so the deck doesn't show ten museums in a row. The traveler's vibes get two turns per round. */
function mix(items: Activity[], wanted: Vibe[]): Activity[] {
  const queues = new Map<Vibe, Activity[]>();
  for (const a of items) queues.set(a.vibe, [...(queues.get(a.vibe) ?? []), a]);
  const order = [...queues.keys()].sort((a, b) => Number(wanted.includes(b)) - Number(wanted.includes(a)));
  const out: Activity[] = [];
  while (out.length < items.length) {
    for (const v of order) {
      const q = queues.get(v)!;
      for (let turn = 0; turn < (wanted.includes(v) ? 2 : 1) && q.length; turn++) out.push(q.shift()!);
    }
  }
  return out;
}

/** Activities agent ("Juno"): waits for the stay so plans are walkable, then builds a deck of ideas
 *  from three places at once: Claude (if there's a key), hand-picked ideas, and real places nearby. */
export async function activitiesAgent(
  req: TripRequest,
  neighborhood: string,
  activityBudget: number,
  ctx: AgentContext,
  emit: Emit,
  center?: { lat: number; lng: number },
): Promise<Activity[]> {
  const dest = getPlace(req.destination);
  const city = dest?.city ?? req.destination;
  const vibeText = req.vibes.length ? req.vibes.slice(0, 2).join(" + ") : "a bit of everything";
  emit({ type: "status", agent: "activities", state: "working", message: `Looking for ${vibeText} near ${neighborhood}…` });

  const fromClaude = ctx.anthropicKey
    ? claudeActivities(req, city, neighborhood, activityBudget / req.travelers, ctx.anthropicKey).catch((err) => { console.error(err); return []; })
    : Promise.resolve<Activity[]>([]);
  const built = await ctx.loadGuide?.(req.destination);
  const nearby = built ? Promise.resolve(built.places) : center ? placeActivities(center, city) : Promise.resolve<Activity[]>([]);
  // The travel guide's See / Do / Eat / Drink listings: pre-built for popular cities, fetched live otherwise.
  const guide = built ? Promise.resolve(listingActivities(built.listings, built.country))
    : dest ? cityListings(dest.city, dest.country).then((ls) => listingActivities(ls, dest.country)) : Promise.resolve<Activity[]>([]);
  const fromGoogle = ctx.googleKey ? googleActivities(city, ctx.googleKey, center ?? built?.center) : Promise.resolve<Activity[]>([]);
  const [ai, places, guided, popular] = await Promise.all([fromClaude, nearby, guide, fromGoogle, pause(ctx, 1200)]);

  emit({ type: "status", agent: "activities", state: "working", message: `Found ${popular.length + guided.length + places.length} real places around ${city}. Grabbing photos…` });

  // Order of trust: Claude's picks, our hand-written ideas (featured cities), the travel guide, then popular places
  // nearby. Generic templates ("Cooking class") only fill in when a city has very little else.
  const handPicked = dest?.featured ? mockActivities(req) : [];
  const real = dedupe([ai, handPicked, popular, guided, places]);
  const merged = real.length >= 15 ? real : dedupe([real, mockActivities(req)]);
  const deck = mix(merged, req.vibes).slice(0, MAX_IDEAS);
  // Pre-built guides carry checked photos; elsewhere we look them up now.
  const withPhotos = built
    ? deck.map((a) => {
        const image = a.image ?? built.photos[a.title];
        return image ? { ...a, image } : a.id.startsWith("wv-") ? { ...a, photoCity: city } : a;
      })
    : await attachPhotos(deck, city);
  // With a Google key, cards still missing a photo (often restaurants) get one from Google.
  const ideas = ctx.googleKey ? await googleFillPhotos(withPhotos, city, ctx.googleKey, center ?? built?.center) : withPhotos;

  emit({ type: "status", agent: "activities", state: "done", message: `Dealt you ${ideas.length} ideas to swipe through.` });
  return ideas;
}
