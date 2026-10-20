// Real hotels and real things to do for any city, from Wikivoyage (the free travel guide).
// Every city guide has See / Do / Eat / Drink / Sleep listings written by travelers, with
// a description, address, coordinates and usually a price. Big cities split them across
// district pages ("Lisbon/Alfama"), so we read those too. Free and keyless.
import type { Activity, StayOption, TripRequest, Vibe } from "../types";
import { getJson } from "./places";

const API = "https://en.wikivoyage.org/w/api.php?action=query&format=json&formatversion=2&origin=*";

export interface Listing {
  type: "see" | "do" | "eat" | "drink" | "sleep";
  name: string;
  content: string;
  district: string;
  tier?: "budget" | "mid" | "splurge"; // from the section heading the listing sits under
  price?: string;
  url?: string;
  address?: string;
  lat?: number;
  lng?: number;
  wikidata?: string;
  image?: string; // Commons file name
  page: string;
}

// ---------- wikitext parsing ----------

/** Split "a|b=[[x|y]]|c" on top-level pipes only. */
function splitParams(body: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth++; cur += two; i++; continue; }
    if ((two === "}}" || two === "]]") && depth > 0) { depth--; cur += two; i++; continue; }
    if (body[i] === "|" && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  out.push(cur);
  return out;
}

/** Wikitext to plain text: links become their label, templates and markup go. */
export function plain(s: string): string {
  return s
    .replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/\S+\]/g, "")
    .replace(/\{\{(?:[^{}]|\{\{[^{}]*\}\})*\}\}/g, (t) => {
      // Keep the readable bit of small inline templates like {{w|Fado}} or {{EUR|12}}.
      const parts = t.slice(2, -2).split("|");
      return parts.length > 1 && parts[parts.length - 1].length < 40 ? parts.slice(1).join(" ") : "";
    })
    .replace(/'{2,}/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TIERS: [RegExp, Listing["tier"]][] = [[/budget|cheap/i, "budget"], [/mid-?range|moderate/i, "mid"], [/splurge|luxury|expensive|high-end/i, "splurge"]];

export function parseListings(wikitext: string, page: string, district: string): Listing[] {
  const out: Listing[] = [];
  const re = /\{\{\s*(see|do|eat|drink|sleep|listing)\s*\|/gi;
  // Remember which heading each listing falls under, for Budget / Mid-range / Splurge.
  const headings = [...wikitext.matchAll(/^={2,4}\s*([^=\n]+?)\s*={2,4}\s*$/gm)].map((m) => ({ at: m.index ?? 0, text: m[1] }));
  let m: RegExpExecArray | null;
  while ((m = re.exec(wikitext))) {
    // Find the matching closing braces.
    let depth = 0, end = -1;
    for (let i = m.index; i < wikitext.length - 1; i++) {
      if (wikitext.startsWith("{{", i)) { depth++; i++; }
      else if (wikitext.startsWith("}}", i)) { depth--; i++; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) break;
    const body = wikitext.slice(m.index + 2, end - 2);
    const params: Record<string, string> = {};
    for (const p of splitParams(body).slice(1)) {
      const eq = p.indexOf("=");
      if (eq > 0) params[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
    }
    const type = (m[1].toLowerCase() === "listing" ? params.type?.toLowerCase() : m[1].toLowerCase()) as Listing["type"];
    if (!["see", "do", "eat", "drink", "sleep"].includes(type)) continue;
    const name = plain(params.name ?? "");
    const content = plain(params.content ?? params.description ?? "");
    if (!name || name.length > 60) continue;
    const heading = [...headings].reverse().find((h) => h.at < m!.index)?.text ?? "";
    const lat = Number(params.lat), lng = Number(params.long ?? params.lon);
    out.push({
      type, name, content, district, page,
      tier: TIERS.find(([r]) => r.test(heading))?.[1],
      price: plain(params.price ?? "") || undefined,
      url: /^https?:\/\//.test(params.url ?? "") ? params.url : undefined,
      address: plain(params.address ?? "") || undefined,
      lat: Number.isFinite(lat) && params.lat ? lat : undefined,
      lng: Number.isFinite(lng) && (params.long || params.lon) ? lng : undefined,
      wikidata: /^Q\d+$/.test(params.wikidata ?? "") ? params.wikidata : undefined,
      image: params.image ? params.image.replace(/^(File|Image):/i, "") : undefined,
    });
    re.lastIndex = end;
  }
  return out;
}

// ---------- fetching ----------

interface RevPage { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }

const contentOf = (p?: RevPage) => p?.revisions?.[0]?.slots?.main?.content ?? "";
const isDisambig = (t: string) => /\{\{\s*(disamb|disambig)/i.test(t);

// Where Wikivoyage's article title differs from the city name we use.
const GUIDE_TITLES: Record<string, string> = { "New York": "New York City", "Bali": "Ubud", "Ho Chi Minh City": "Ho Chi Minh City", "Washington": "Washington, D.C." };

/** All listings for a city: the main guide plus its district pages. Empty on failure. */
export async function cityListings(cityName: string, country: string): Promise<Listing[]> {
  const city = GUIDE_TITLES[cityName] ?? cityName;
  // Try "City" and "City (Country)" together; take whichever is a real guide.
  const first = await getJson<{ query?: { pages: RevPage[]; redirects?: { from: string; to: string }[] } }>(
    `${API}&redirects=1&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(`${city}|${city} (${country})`)}`, 9000,
  );
  const pages = (first?.query?.pages ?? []).filter((p) => !p.missing && contentOf(p) && !isDisambig(contentOf(p)));
  const main = pages.find((p) => p.title.startsWith(`${city} (`)) ?? pages[0];
  if (!main) return [];

  const listings = parseListings(contentOf(main), main.title, city);

  // District pages hold most listings in big cities.
  const subs = await getJson<{ query?: { allpages: { title: string }[] } }>(
    `${API}&list=allpages&apfilterredir=nonredirects&aplimit=20&apprefix=${encodeURIComponent(`${main.title}/`)}`, 6000,
  );
  const districts = (subs?.query?.allpages ?? []).map((p) => p.title).slice(0, 10);
  if (districts.length) {
    const j = await getJson<{ query?: { pages: RevPage[] } }>(
      `${API}&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(districts.join("|"))}`, 12000,
    );
    for (const p of j?.query?.pages ?? []) {
      listings.push(...parseListings(contentOf(p), p.title, p.title.split("/").pop()!.replace(/_/g, " ")));
    }
  }
  return listings;
}

/** Photos for listings that point at Wikidata, via each item's main image (P18). */
export async function wikidataImages(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const j = await getJson<{ entities?: Record<string, { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }> }>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims&ids=${batch.join("|")}`, 9000,
    );
    for (const [id, e] of Object.entries(j?.entities ?? {})) {
      const file = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (file) out.set(id, file);
    }
  }
  return out;
}

export const commonsThumb = (file: string, width = 800) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${width}`;

// ---------- prices ----------

// Rough USD rates; good enough for estimates.
const FX: [RegExp, number][] = [
  [/€|eur\b/i, 1.08], [/£|gbp\b/i, 1.27], [/¥|jpy\b|yen/i, 0.0067], [/mx\$|mxn\b|pesos?/i, 0.055],
  [/isk\b|kr\b|krónur/i, 0.0072], [/chf\b/i, 1.12], [/a\$|aud\b/i, 0.66], [/c\$|cad\b/i, 0.73],
  [/₹|inr\b|rs\.?/i, 0.012], [/฿|thb\b|baht/i, 0.028], [/zł|pln\b/i, 0.25], [/kč|czk\b/i, 0.043],
  [/ft\b|huf\b/i, 0.0027], [/r\$|brl\b/i, 0.18], [/₩|krw\b/i, 0.00073], [/dkk\b/i, 0.145], [/sek\b/i, 0.095], [/nok\b/i, 0.093],
  [/us\$|usd\b|\$/i, 1],
];

/** All amounts in a price string, in USD. "Dorm €15, double €60" -> [16, 65]. */
export function usdAmounts(price: string | undefined, fallbackRate = 1): number[] {
  if (!price) return [];
  if (/^\s*free\b/i.test(price)) return [0];
  const rate = FX.find(([r]) => r.test(price))?.[1] ?? fallbackRate;
  const cleaned = price
    .replace(/(\d)[,.](\d{3})\b/g, "$1$2")
    // Numbers that aren't money: group sizes, durations, ages, times.
    .replace(/\d+\s*(?:-|–|to)?\s*\d*\s*(?:people|persons?|pax|players|guests|hours?|hrs?|h\b|min(?:ute)?s?|km|years?|yrs?|nights?|days?|am|pm)\b/gi, " ")
    .replace(/\d{1,2}:\d{2}/g, " ");
  return [...cleaned.matchAll(/\d+(?:\.\d+)?/g)]
    .map((x) => Number(x[0]))
    .filter((n) => n > 0 && n < 100000 && !(n >= 1900 && n <= 2100 && Number.isInteger(n)))
    .map((n) => Math.round(n * rate));
}

const COUNTRY_RATE: Record<string, number> = {
  Portugal: 1.08, Spain: 1.08, France: 1.08, Italy: 1.08, Germany: 1.08, Netherlands: 1.08, Greece: 1.08, Austria: 1.08, Ireland: 1.08, Belgium: 1.08,
  Japan: 0.0067, Mexico: 0.055, Iceland: 0.0072, "United Kingdom": 1.27, Thailand: 0.028, India: 0.012, "South Korea": 0.00073,
};
export const rateFor = (country: string) => COUNTRY_RATE[country] ?? 1;

// ---------- turning listings into the app's shapes ----------

const has = (s: string, r: RegExp) => r.test(s);

function firstSentences(text: string, max = 220) {
  const s = text.match(new RegExp(`^.{30,${max}}?[.!?](\\s|$)`))?.[0]?.trim() ?? text;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** See / Do / Eat / Drink listings as swipeable ideas. Listings without a description are skipped. */
export function listingActivities(listings: Listing[], country: string): Activity[] {
  const rate = rateFor(country);
  const out: (Activity & { score: number })[] = [];
  const seen = new Set<string>();
  for (const l of listings) {
    if (l.type === "sleep" || l.content.length < 25 || seen.has(slug(l.name))) continue;
    seen.add(slug(l.name));
    const text = `${l.name} ${l.content}`;
    // Festivals and annual events only happen on certain dates; we can't promise them.
    if (has(text, /festival|\bannual|\bfiesta|\bfestas?\b|held (every|each|in)|takes place (every|each|in)/i)) continue;
    const amounts = usdAmounts(l.price, rate);
    let vibe: Vibe = "culture", price = 0, hours = 1.5, when: Activity["timeOfDay"] = "afternoon", indoor = false;

    if (l.type === "eat") {
      vibe = "food"; indoor = true; hours = 1.5;
      price = amounts.length ? amounts[0] : l.tier === "splurge" ? 60 : l.tier === "budget" ? 12 : 25;
      when = has(text, /breakfast|bakery|pastr|caf[eé]|coffee|brunch/i) ? "morning" : l.tier === "splurge" || has(text, /dinner|tasting menu/i) ? "evening" : "afternoon";
    } else if (l.type === "drink") {
      const cafe = has(text, /caf[eé]|coffee|tea ?house|tea room/i) && !has(text, /cocktail|beer|wine bar|club/i);
      vibe = cafe ? "chill" : "nightlife"; indoor = true; hours = cafe ? 1 : 2.5;
      when = cafe ? "morning" : "evening";
      price = amounts.length ? amounts[0] : cafe ? 6 : 18;
    } else if (l.type === "see") {
      if (has(text, /\bbeach|praia|playa|plage/i)) { vibe = "beach"; hours = 3; }
      else if (has(text, /\bmarket|mercado|mercat|food hall/i)) { vibe = "food"; hours = 1.5; when = "morning"; }
      else if (has(text, /viewpoint|miradouro|mirador|lookout|panoram/i)) { vibe = "chill"; hours = 1; when = "evening"; }
      else if (has(text, /\bpark\b|garden|jardim|jardín|forest|lake/i)) { vibe = "outdoors"; hours = 2; when = "morning"; }
      else { indoor = has(text, /museum|gallery|church|cathedral|palace|interior/i); hours = has(text, /museum|gallery/i) ? 2 : 1; when = has(text, /museum/i) ? "afternoon" : "morning"; }
      price = amounts.length ? amounts[0] : has(text, /museum|gallery|palace|castle/i) ? 12 : 0;
    } else {
      if (has(text, /beach|surf|swim|snorkel|dive|diving/i)) { vibe = "beach"; hours = 3; }
      else if (has(text, /cruise|boat|sail|river trip|ferry/i)) { vibe = "chill"; hours = 2; }
      else if (has(text, /concert|fado|jazz|club|show|theat|opera|cabaret|live music|nightlife/i)) { vibe = "nightlife"; when = "evening"; hours = 2.5; indoor = true; }
      else if (has(text, /spa|bath|onsen|sauna|massage|hot spring/i)) { vibe = "chill"; hours = 2; indoor = true; }
      else if (has(text, /cooking|food tour|tasting|wine|market/i)) { vibe = "food"; hours = 3; }
      else if (has(text, /hike|hiking|trail|kayak|bike|cycl|climb|boat|sail|cruise|park|tour/i)) { vibe = has(text, /tour|cruise|boat/i) && !has(text, /hike|kayak|bike/i) ? "culture" : "outdoors"; hours = 3; when = "morning"; }
      else { vibe = "outdoors"; hours = 2; }
      price = amounts.length ? amounts[0] : 25;
    }

    out.push({
      id: `wv-${slug(l.name)}`,
      title: l.name,
      blurb: firstSentences(l.content),
      vibe, price, durationHours: hours, timeOfDay: when, indoor,
      ...(l.lat !== undefined && l.lng !== undefined ? { lat: l.lat, lng: l.lng } : {}),
      infoUrl: l.url ?? `https://en.wikivoyage.org/wiki/${encodeURIComponent(l.page.replace(/ /g, "_"))}`,
      ...(l.image ? { image: commonsThumb(l.image) } : {}),
      ...(l.wikidata ? { wikidataId: l.wikidata } : {}),
      address: l.address,
      // No popularity data here, so: notable (has a Wikidata entry), has a photo, well described.
      score: (l.wikidata ? 3 : 0) + (l.image ? 1 : 0) + Math.min(l.content.length / 120, 2) + (l.lat !== undefined ? 0.5 : 0),
    });
  }
  return out.sort((a, b) => b.score - a.score).map(({ score: _score, ...a }) => a);
}

const PERK_WORDS: [RegExp, string][] = [
  [/breakfast/i, "Breakfast"], [/rooftop/i, "Rooftop"], [/pool/i, "Pool"], [/\bview/i, "Views"], [/kitchen/i, "Kitchen"],
  [/terrace|balcon/i, "Terrace"], [/\bspa\b/i, "Spa"], [/\bbar\b/i, "Bar"], [/garden/i, "Garden"], [/wi-?fi/i, "Wi-Fi"],
  [/air[- ]?con/i, "Air con"], [/parking/i, "Parking"], [/gym|fitness/i, "Gym"], [/historic|century|palace/i, "Historic building"],
];
const COLORS = ["#FFD23F", "#FF8FAB", "#7CD4FD", "#A3E635", "#FDBA74"];

/** Sleep listings as stays, priced from the guide when it lists a price and estimated from the tier otherwise. */
export function listingStays(
  listings: Listing[], req: TripRequest, nights: number, country: string, typicalNightly: number, center?: { lat: number; lng: number },
): StayOption[] {
  const rate = rateFor(country);
  const rooms = Math.max(1, Math.ceil(req.travelers / 2));
  const stays: StayOption[] = [];
  for (const l of listings) {
    if (l.type !== "sleep") continue;
    const text = `${l.name} ${l.content}`;
    const apartment = has(text, /apartment|apartamento|\bflat\b|self-catering|aparthotel|holiday rental/i);
    if (req.stayType === "apartment" && !apartment) continue;
    if (req.stayType === "hotel" && apartment) continue;
    // Hostels are dorm beds; not what people booking a trip planner expect to see.
    if (has(l.name, /hostel|backpacker/i) || has(l.price ?? "", /dorm|\bbeds?\b/i)) continue;

    // Prefer the price next to "double"/"room"; else the middle of whatever range is listed.
    const near = l.price?.match(/(double|twin|room|private)[^0-9]{0,15}([^,;]*)/i);
    const amounts = usdAmounts(near ? `${l.price!.match(/[€£¥$]|[A-Z]{3}/)?.[0] ?? ""}${near[2]}` : l.price, rate).filter((n) => n >= 25 && n <= 3000); // below that it's a dorm bed or a typo
    // No price? Guess the tier from the heading, the price wording, or how the guide describes it.
    const tierFactor =
      l.tier === "budget" || has(`${l.price ?? ""} ${text}`, /\bcheap\b|budget|pens[aã]o|pension|guest ?house|hospedes|residencial|b&b|bed (and|&) breakfast|one-star|two-star|[12]-star/i) ? 0.6
      : l.tier === "splurge" || has(`${l.price ?? ""} ${text}`, /expensive|luxur|five-star|5-star|palace|palácio|grand hotel|ritz|four seasons/i) ? 2.1
      : has(text, /four-star|4-star/i) ? 1.35
      : has(text, /three-star|3-star/i) ? 0.9
      : 1;
    const listed = amounts.length ? Math.round((Math.min(...amounts) + Math.max(...amounts)) / 2) : 0;
    // Estimates vary a little per hotel (stable, from the name) so a page of them doesn't all read "$263".
    const wiggle = 0.88 + (([...l.name].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0) % 25) / 100;
    // Guide prices can be years old; never show less than a realistic floor for the city.
    const nightly = Math.round(Math.max(listed || typicalNightly * tierFactor * wiggle, typicalNightly * 0.45) * rooms);

    const km = center && l.lat !== undefined && l.lng !== undefined
      ? Math.hypot((l.lng - center.lng) * 111.32 * Math.cos((center.lat * Math.PI) / 180), (l.lat - center.lat) * 110.57)
      : undefined;
    stays.push({
      id: `wv-stay-${slug(l.name)}`,
      name: l.name,
      kind: apartment ? "apartment" : "hotel",
      neighborhood: l.district,
      nightlyPrice: nightly,
      totalPrice: nightly * nights,
      perks: PERK_WORDS.filter(([r]) => r.test(text)).map(([, p]) => p).slice(0, 4),
      walkMinutes: km !== undefined ? Math.max(3, Math.round((km / 4.8) * 60)) : 15,
      color: COLORS[stays.length % COLORS.length],
      address: l.address,
      website: l.url,
      blurb: firstSentences(l.content, 200),
      priceListed: listed > 0,
      ...(l.lat !== undefined && l.lng !== undefined ? { lat: l.lat, lng: l.lng } : {}),
      ...(l.image ? { photo: commonsThumb(l.image) } : {}),
      ...(l.wikidata ? { wikidataId: l.wikidata } : {}),
    });
  }
  // Closest to the center first, so we show places that are handy for sightseeing.
  return stays.sort((a, b) => a.walkMinutes - b.walkMinutes);
}

// ---------- photos by name ----------

const STOP = new Set("hotel hotels hostel the and by of de da do das dos del la le les el los spa restaurant restaurante cafe bar inn house casa suites apartments rooms boutique".split(" "));
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Commons photos for named places ("Café Majestic", "Hotel Infante Sagres"). Searches file titles for every
 *  distinctive word of the name, so we don't show some other café; prefers files that also name the city. */
export async function commonsPhotosByName(names: string[], city: string): Promise<Map<string, string>> {
  const cityWords = fold(city).split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = (n: string) => [...new Set(fold(n).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t) && !cityWords.includes(t)))];
  const out = new Map<string, string>();
  await Promise.all(names.map(async (n) => {
    const need = tokens(n);
    if (!need.length) return;
    const q = need.map((w) => `intitle:"${w}"`).join(" ").normalize("NFC");
    const j = await getJson<{ query?: { search: { title: string }[] } }>(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&list=search&srnamespace=6&srlimit=8&srsearch=${encodeURIComponent(q)}`, 8000,
    );
    const files = (j?.query?.search ?? []).map((s) => s.title.replace(/^File:/, ""))
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !/logo|map|plan|menu|\bsign\b|poster|flyer/i.test(f));
    const inCity = files.find((f) => cityWords.every((w) => fold(f).includes(w)));
    // Without the city in the title, only trust a match on three or more distinctive words ("Mercure Centro" is in every city).
    const hit = inCity ?? (need.length >= 3 ? files[0] : undefined);
    if (hit) out.set(n, hit);
  }));
  return out;
}

/** Photos for named places via Wikidata: search the name, then accept an item only if it has a photo
 *  (P18) and its coordinates (P625) are within ~1.5 km of where the guide puts the place. */
export async function wikidataPhotosByName(items: { name: string; lat?: number; lng?: number }[]): Promise<Map<string, string>> {
  const located = items.filter((i) => i.lat !== undefined && i.lng !== undefined);
  const candidates = new Map<string, string[]>();
  for (const i of located) {
    const j = await getJson<{ search?: { id: string }[] }>(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*&language=en&uselang=en&type=item&limit=5&search=${encodeURIComponent(i.name)}`, 8000,
    );
    const ids = (j?.search ?? []).map((s) => s.id);
    if (ids.length) candidates.set(i.name, ids);
  }
  const allIds = [...new Set([...candidates.values()].flat())];
  type Claims = { P18?: { mainsnak?: { datavalue?: { value?: string } } }[]; P625?: { mainsnak?: { datavalue?: { value?: { latitude: number; longitude: number } } } }[] };
  const facts = new Map<string, { file?: string; lat?: number; lng?: number }>();
  for (let k = 0; k < allIds.length; k += 50) {
    const j = await getJson<{ entities?: Record<string, { claims?: Claims }> }>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims&ids=${allIds.slice(k, k + 50).join("|")}`, 9000,
    );
    for (const [id, e] of Object.entries(j?.entities ?? {})) {
      const pos = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      facts.set(id, { file: e.claims?.P18?.[0]?.mainsnak?.datavalue?.value, lat: pos?.latitude, lng: pos?.longitude });
    }
  }
  const out = new Map<string, string>();
  for (const i of located) {
    for (const id of candidates.get(i.name) ?? []) {
      const f = facts.get(id);
      if (!f?.file || f.lat === undefined || f.lng === undefined) continue;
      const km = Math.hypot((f.lng - i.lng!) * 111.32 * Math.cos((i.lat! * Math.PI) / 180), (f.lat - i.lat!) * 110.57);
      if (km <= 1.5 && !/logo|map|\.svg/i.test(f.file)) { out.set(i.name, f.file); break; }
    }
  }
  return out;
}
