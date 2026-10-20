// Google Places (New): real photos, ratings and reviews for hotels, restaurants and sights.
// Used only when GOOGLE_PLACES_API_KEY is set (and under the daily cap in lib/rateLimit.ts), and only on the server (the key never reaches the browser).
// Photos are served through /api/place-photo so the page never sees the key either.
// https://developers.google.com/maps/documentation/places/web-service/text-search
import { CAPS, withinDailyCap } from "../rateLimit";
import type { Activity, StayOption, TripRequest, Vibe } from "../types";

interface GPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  editorialSummary?: { text: string };
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  photos?: { name: string; authorAttributions?: { displayName?: string }[] }[];
}

const FIELDS = [
  "id", "displayName", "formattedAddress", "location", "rating", "userRatingCount", "priceLevel", "websiteUri",
  "googleMapsUri", "editorialSummary", "primaryTypeDisplayName", "types", "photos",
].map((f) => `places.${f}`).join(",");

// One day per query: the same city's hotels don't change minute to minute, and every call costs money.
const cache = new Map<string, { at: number; places: GPlace[] }>();

async function textSearch(query: string, key: string, center?: { lat: number; lng: number }): Promise<GPlace[]> {
  const id = `${query}|${center?.lat.toFixed(2)},${center?.lng.toFixed(2)}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 86_400_000) return hit.places;
  // Daily spending cap: past it, the app falls back to the free bundled guides.
  if (!withinDailyCap("google-search", CAPS.googleSearchesPerDay)) return [];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({
        textQuery: query,
        pageSize: 20,
        languageCode: "en",
        ...(center ? { locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 15000 } } } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`Google Places ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return [];
    }
    const places = ((await res.json()) as { places?: GPlace[] }).places ?? [];
    cache.set(id, { at: Date.now(), places });
    return places;
  } catch (err) {
    console.error(err);
    return [];
  }
}

const photoUrl = (p: GPlace) => (p.photos?.[0] ? `/api/place-photo?ref=${encodeURIComponent(p.photos[0].name)}` : undefined);
const credit = (p: GPlace) => p.photos?.[0]?.authorAttributions?.[0]?.displayName;
const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PRICE: Record<string, number> = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 12, PRICE_LEVEL_MODERATE: 25, PRICE_LEVEL_EXPENSIVE: 50, PRICE_LEVEL_VERY_EXPENSIVE: 90 };

function summary(p: GPlace) {
  if (p.editorialSummary?.text) return p.editorialSummary.text;
  const kind = p.primaryTypeDisplayName?.text ?? "Popular spot";
  return p.userRatingCount ? `${kind} loved by visitors: ${p.rating?.toFixed(1)} stars from ${p.userRatingCount.toLocaleString()} Google reviews.` : kind;
}

interface Category { query: (city: string) => string; vibe: Vibe; price: number; hours: number; when: Activity["timeOfDay"]; indoor: boolean; take: number }

const CATEGORIES: Category[] = [
  { query: (c) => `top tourist attractions in ${c}`, vibe: "culture", price: 12, hours: 2, when: "morning", indoor: false, take: 14 },
  { query: (c) => `best restaurants in ${c}`, vibe: "food", price: 30, hours: 1.5, when: "evening", indoor: true, take: 10 },
  { query: (c) => `famous local food and markets in ${c}`, vibe: "food", price: 15, hours: 1.5, when: "afternoon", indoor: false, take: 6 },
  { query: (c) => `best cafes and bakeries in ${c}`, vibe: "chill", price: 8, hours: 1, when: "morning", indoor: true, take: 6 },
  { query: (c) => `best bars and live music in ${c}`, vibe: "nightlife", price: 20, hours: 2.5, when: "evening", indoor: true, take: 8 },
  { query: (c) => `museums in ${c}`, vibe: "culture", price: 15, hours: 2, when: "afternoon", indoor: true, take: 8 },
  { query: (c) => `parks gardens and viewpoints in ${c}`, vibe: "outdoors", price: 0, hours: 1.5, when: "afternoon", indoor: false, take: 6 },
  { query: (c) => `beaches near ${c}`, vibe: "beach", price: 0, hours: 3, when: "afternoon", indoor: false, take: 4 },
];

/** Popular, well-reviewed places across every vibe, each with a real photo. */
export async function googleActivities(city: string, key: string, center?: { lat: number; lng: number }): Promise<Activity[]> {
  const lists = await Promise.all(CATEGORIES.map((c) => textSearch(c.query(city), key, center).then((ps) => ({ c, ps }))));
  const seen = new Set<string>();
  const out: Activity[] = [];
  for (const { c, ps } of lists) {
    // Well-reviewed first; skip places with only a handful of reviews.
    const ranked = ps.filter((p) => p.displayName && (p.userRatingCount ?? 0) >= 50 && (p.rating ?? 0) >= 4)
      .sort((a, b) => (b.userRatingCount ?? 0) * (b.rating ?? 0) - (a.userRatingCount ?? 0) * (a.rating ?? 0));
    let taken = 0;
    for (const p of ranked) {
      if (taken >= c.take || seen.has(p.id)) continue;
      seen.add(p.id);
      taken++;
      const isMuseum = p.types?.includes("museum");
      out.push({
        id: `g-${slug(p.displayName!.text)}`,
        title: p.displayName!.text,
        blurb: summary(p),
        vibe: c.vibe === "culture" && p.types?.some((t) => t === "park" || t === "beach") ? "outdoors" : c.vibe,
        price: p.priceLevel ? PRICE[p.priceLevel] ?? c.price : isMuseum ? 15 : p.types?.includes("park") ? 0 : c.price,
        durationHours: c.hours,
        timeOfDay: c.when,
        indoor: c.indoor || !!isMuseum,
        ...(p.location ? { lat: p.location.latitude, lng: p.location.longitude } : {}),
        image: photoUrl(p),
        imageCredit: credit(p),
        infoUrl: p.websiteUri ?? p.googleMapsUri,
        address: p.formattedAddress,
        rating: p.rating,
        ratingCount: p.userRatingCount,
      });
    }
  }
  return out;
}

/** Real hotels (or apartments) with photos and Google ratings. Google doesn't give hotel prices,
 *  so the price is an estimate from how upscale the place reads, marked as such in the UI. */
export async function googleStays(
  req: TripRequest, nights: number, city: string, key: string, typicalNightly: number, center?: { lat: number; lng: number },
): Promise<StayOption[]> {
  const query = req.stayType === "apartment" ? `serviced apartments and aparthotels in ${city}` : `best hotels in ${city} city center`;
  const places = (await textSearch(query, key, center)).filter((p) => p.displayName && (p.userRatingCount ?? 0) >= 30);
  const rooms = Math.max(1, Math.ceil(req.travelers / 2));
  const COLORS = ["#FFD23F", "#FF8FAB", "#7CD4FD", "#A3E635", "#FDBA74"];
  return places.slice(0, 12).map((p, i) => {
    const name = p.displayName!.text;
    const text = `${name} ${p.editorialSummary?.text ?? ""}`;
    // No prices from Google for hotels, so read the tier from the name. Top luxury brands cost many times
    // a typical room; showing them at mid-range prices would be badly wrong.
    const factor = /bulgari|bvlgari|armani|aman\b|rosewood|peninsula|st\.? regis|waldorf|park hyatt|ritz|four seasons|mandarin oriental|belmond|six senses|cheval blanc|raffles|oetker|dorchester|savoy|claridge/i.test(text) ? 5
      : /palace|luxury|grand hotel|five|5-star|resort|edition\b|w hotel|kempinski|sofitel|intercontinental|conrad|fairmont|jw marriott/i.test(text) ? 2.4
      : /hostel|budget|ibis|inn\b|guest ?house|pension|b&b|easyhotel|motel/i.test(text) ? 0.6
      : (p.rating ?? 4) >= 4.6 ? 1.3 : 1;
    const wiggle = 0.9 + ((p.id.charCodeAt(p.id.length - 1) + i) % 20) / 100;
    const nightly = Math.round(typicalNightly * factor * wiggle * rooms);
    const km = center && p.location
      ? Math.hypot((p.location.longitude - center.lng) * 111.32 * Math.cos((center.lat * Math.PI) / 180), (p.location.latitude - center.lat) * 110.57)
      : undefined;
    return {
      id: `g-stay-${slug(name)}`,
      name,
      kind: req.stayType === "apartment" || /apartment|suites|residence/i.test(name) ? "apartment" as const : "hotel" as const,
      neighborhood: p.formattedAddress?.split(",").slice(-3, -2)[0]?.trim() || city,
      nightlyPrice: nightly,
      totalPrice: nightly * nights,
      perks: [],
      walkMinutes: km !== undefined ? Math.max(3, Math.round((km / 4.8) * 60)) : 15,
      color: COLORS[i % COLORS.length],
      photo: photoUrl(p),
      imageCredit: credit(p),
      address: p.formattedAddress,
      website: p.websiteUri,
      blurb: p.editorialSummary?.text,
      priceListed: false,
      rating: p.rating,
      ratingCount: p.userRatingCount,
      ...(p.location ? { lat: p.location.latitude, lng: p.location.longitude } : {}),
    };
  });
}

/** Turns a photo reference into a short-lived image URL. Called by /api/place-photo only. */
export async function resolvePhoto(ref: string, key: string): Promise<string | undefined> {
  const res = await fetch(`https://places.googleapis.com/v1/${ref}/media?maxWidthPx=800&skipHttpRedirect=true&key=${encodeURIComponent(key)}`, { cache: "no-store" });
  if (!res.ok) return undefined;
  return ((await res.json()) as { photoUri?: string }).photoUri;
}

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const STOP = new Set("the and of de da do di del la le el at in on for with your local best restaurant restaurante ristorante cafe bar trattoria osteria taverna hotel night day trip tour crawl tasting feast walk class".split(" "));

/** Fill in photos (and ratings) for ideas that came without one, by looking each up on Google.
 *  Named places must share a distinctive word with Google's match, so we never show a different
 *  restaurant under Biffi's name. Ideas like "Seafood feast at a cervejaria" get a real, well-rated
 *  example and say whose photo it is. */
export async function googleFillPhotos(items: Activity[], city: string, key: string, center?: { lat: number; lng: number }, max = 15): Promise<Activity[]> {
  const missing = items.filter((a) => !a.image).slice(0, max);
  const found = new Map<string, Partial<Activity>>();
  await Promise.all(missing.map(async (a) => {
    const named = !a.id.startsWith("act-"); // guide/Wikipedia places have proper names; hand-written ideas don't
    const places = await textSearch(`${a.title} ${city}`, key, center);
    const words = fold(a.title).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w) && !fold(city).includes(w));
    // Every match must share a real word with the idea ("cervejaria" ≠ "cevicheria").
    const match = places.find((p) => p.photos?.length && p.displayName
      && words.length > 0 && words.some((w) => fold(p.displayName!.text).includes(w)));
    if (!match) return;
    found.set(a.id, {
      image: photoUrl(match),
      imageCredit: named ? credit(match) : `${match.displayName!.text}${credit(match) ? ` · ${credit(match)}` : ""}`,
      ...(named && match.rating ? { rating: match.rating, ratingCount: match.userRatingCount } : {}),
    });
  }));
  return items.map((a) => (found.has(a.id) ? { ...a, ...found.get(a.id), photoCity: undefined } : a));
}
