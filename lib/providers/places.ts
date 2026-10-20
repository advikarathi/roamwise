// Real places for any city, free and keyless, so this runs in demo mode too.
//   Nominatim (OpenStreetMap) finds the city center.
//   Wikipedia's geosearch lists articles near it; each one's short description
//   ("Fortified tower in Lisbon, Portugal") tells us what kind of place it is,
//   and 30-day page views tell us how well known it is.
import type { Activity, Vibe } from "../types";

const env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};

// Wikimedia gives far more room to clients that say who they are and how to reach them
// (https://meta.wikimedia.org/wiki/User-Agent_policy). Set WIKIMEDIA_CONTACT to an email or URL.
// Browsers send their own User-Agent, and adding one there forces a CORS preflight.
// Read per request, so scripts that load .env after importing this still send the contact.
const ua = (): Record<string, string> => typeof window === "undefined"
  ? { "User-Agent": `Roamwise/1.0 (travel planner${env.WIKIMEDIA_CONTACT ? `; ${env.WIKIMEDIA_CONTACT}` : ""})` }
  : {};

// Wikimedia throttles bursts, so: one request at a time with a small gap, answers cached for a day,
// and identical requests in flight share one fetch.
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const DAY = 86_400_000;
const GAP_MS = Number(env.WIKIMEDIA_GAP_MS ?? 120);
let queue: Promise<void> = Promise.resolve();
function slot<T>(run: () => Promise<T>): Promise<T> {
  const turn = queue.then(run);
  queue = turn.then(() => new Promise<void>((r) => setTimeout(r, GAP_MS)), () => new Promise<void>((r) => setTimeout(r, GAP_MS)));
  return turn;
}

export function getJson<T>(url: string, ms: number): Promise<T | undefined> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < DAY) return Promise.resolve(hit.data as T);
  if (!inflight.has(url)) inflight.set(url, fetchWithRetry<T>(url, ms).finally(() => inflight.delete(url)));
  return inflight.get(url) as Promise<T | undefined>;
}

// Circuit breaker: after a run of "too many requests" from a site, leave it alone for a while
// instead of hammering it (which only extends the block).
const strikes = new Map<string, number[]>(); // times of recent 429s per site
const restUntil = new Map<string, number>();
const hostOf = (url: string) => { try { return new URL(url).host; } catch { return url; } };

async function fetchWithRetry<T>(url: string, ms: number): Promise<T | undefined> {
  const host = hostOf(url);
  // "Too many requests": wait as long as the server asks (or 1s, 2s, 4s), then try again.
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((restUntil.get(host) ?? 0) > Date.now()) return undefined;
    const res = await slot(() => fetchJson<T>(url, ms));
    if (res.data !== undefined) {
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
      cache.set(url, { at: Date.now(), data: res.data });
      return res.data;
    }
    if (res.status !== 429 && res.status !== 503) return undefined;
    const recent = [...(strikes.get(host) ?? []), Date.now()].filter((t) => Date.now() - t < 60_000);
    strikes.set(host, recent);
    if (recent.length >= 6) { restUntil.set(host, Date.now() + 10 * 60_000); strikes.delete(host); return undefined; }
    await new Promise((r) => setTimeout(r, Math.min(8000, res.retryAfter ? res.retryAfter * 1000 : 1000 * 2 ** attempt)));
  }
  return undefined;
}

async function fetchJson<T>(url: string, ms: number): Promise<{ status: number; data?: T; retryAfter?: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: ua(), signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return { status: res.status, retryAfter: Number(res.headers.get("retry-after")) || undefined };
    const data = (await res.json()) as T & { error?: { code?: string } };
    // MediaWiki often reports throttling as HTTP 200 with an "error" body. That's a failure, not data:
    // never cache it, and retry it like a 429.
    if (data && typeof data === "object" && "error" in data) {
      return { status: /ratelimit|maxlag|too ?many/i.test(String(data.error?.code)) ? 429 : 500 };
    }
    return { status: res.status, data };
  } catch {
    return { status: 0 };
  } finally {
    clearTimeout(t);
  }
}

/** City center from Nominatim. Undefined if the lookup fails. */
export async function geocodeCity(city: string, country: string): Promise<{ lat: number; lng: number } | undefined> {
  const q = `https://nominatim.openstreetmap.org/search?format=json&limit=1&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;
  const r = (await getJson<{ lat: string; lon: string }[]>(q, 5000))?.[0];
  return r ? { lat: Number(r.lat), lng: Number(r.lon) } : undefined;
}

interface Kind {
  test: RegExp;
  vibe: Vibe;
  price: number;
  hours: number;
  when: Activity["timeOfDay"];
  indoor: boolean;
  tip: string;
  cap: number; // most of this kind in one deck
}

// Things that have a Wikipedia article but aren't somewhere you'd visit.
const NOT_A_PLACE = /municipalit|district|parish|county|province|regime|kingdom|republic|empire|dynasty|airport|station|metro|railway (line|accident)|accident|disaster|battle|siege|war\b|company|retailer|broadcast|police|force|army|federation|association|school|universit|institute|college|hospital|conference|summit|festival\b.*\d{4}|fair\b|politician|footballer|businessman|bank\b|ministry|embassy|office\b|headquarters|former|demolished|destroyed|defunct|proposed|planned|hotel|road\b|highway|motorway|roundabout|tunnel|census|village in|town in|city in|capital (and|of)|electoral|constituency|newspaper|organi[sz]ation|band\b|film|album|song|novel|tram line|bus\b|residence of|apartment|office building|skyscraper|residential|club\b|team\b|league|convention|diocese|patriarchate|foundation|research|human settlement|^town$|planning area|gymnasium|tallest building|complex$|residence|chain\b|system\b|shopping mall|parliament|court\b/i;

const KINDS: Kind[] = [
  { test: /aquarium|oceanarium/i, vibe: "chill", price: 25, hours: 2, when: "afternoon", indoor: true, tip: "Great on a hot or rainy day.", cap: 2 },
  { test: /\bzoo\b|safari|wildlife park/i, vibe: "outdoors", price: 25, hours: 3, when: "morning", indoor: false, tip: "Plan half a day.", cap: 2 },
  { test: /theme park|amusement park|water park/i, vibe: "outdoors", price: 55, hours: 6, when: "morning", indoor: false, tip: "A full, loud, fun day out.", cap: 2 },
  { test: /museum|gallery|exhibition|planetarium|science cent/i, vibe: "culture", price: 15, hours: 2, when: "afternoon", indoor: true, tip: "Go early on a weekday to skip the lines.", cap: 10 },
  { test: /market|food hall/i, vibe: "food", price: 15, hours: 1.5, when: "morning", indoor: false, tip: "Go hungry and graze.", cap: 4 },
  { test: /opera|theat(re|er)|concert hall|music venue|jazz|cabaret|philharmonic|auditorium/i, vibe: "nightlife", price: 40, hours: 2.5, when: "evening", indoor: true, tip: "Check what's on while you're in town.", cap: 4 },
  { test: /stadium|arena\b|bullring/i, vibe: "nightlife", price: 50, hours: 3, when: "evening", indoor: false, tip: "Catch a game or a gig if one's on.", cap: 1 },
  { test: /\bbeach|\bcove\b|\bbay\b/i, vibe: "beach", price: 0, hours: 3, when: "afternoon", indoor: false, tip: "Towel, swim, snack, repeat.", cap: 5 },
  { test: /botanic|garden|park\b|forest|nature reserve|national park/i, vibe: "outdoors", price: 0, hours: 2, when: "morning", indoor: false, tip: "Good for a slow walk or a picnic.", cap: 5 },
  { test: /viewpoint|lookout|observation|belvedere|miradouro|mirador/i, vibe: "chill", price: 0, hours: 1, when: "evening", indoor: false, tip: "Come for golden hour.", cap: 4 },
  { test: /\b(hill|mountain|peak|volcano|lake|waterfall|cliff|island)\b/i, vibe: "outdoors", price: 0, hours: 3, when: "morning", indoor: false, tip: "Bring water and good shoes.", cap: 4 },
  { test: /castle|fort\b|fortress|fortified|citadel|palace|ruins|archaeolog|amphitheat|aqueduct/i, vibe: "culture", price: 12, hours: 2, when: "morning", indoor: false, tip: "Climb up for the views.", cap: 8 },
  { test: /tower|monument|memorial|arch\b|obelisk|statue|landmark|lighthouse/i, vibe: "culture", price: 5, hours: 1, when: "afternoon", indoor: false, tip: "Quick stop, great photos.", cap: 6 },
  { test: /cathedral|basilica|church|monastery|abbey|convent|temple|shrine|mosque|synagogue|pagoda/i, vibe: "culture", price: 0, hours: 1, when: "morning", indoor: true, tip: "Step inside, it's often free.", cap: 6 },
  { test: /funicular|cable car|elevator|gondola|lift\b|ferris wheel/i, vibe: "chill", price: 6, hours: 0.5, when: "afternoon", indoor: false, tip: "A short ride with a view.", cap: 2 },
  { test: /bridge|promenade|waterfront|pier|harbou?r|canal/i, vibe: "chill", price: 0, hours: 1, when: "evening", indoor: false, tip: "Nice for a sunset stroll.", cap: 3 },
  { test: /neighbo(u)?rhood|quarter|old town|historic cent|bairro/i, vibe: "culture", price: 0, hours: 2, when: "afternoon", indoor: false, tip: "Wander with no plan.", cap: 5 },
  { test: /square|plaza|piazza|boulevard|avenue|shopping street|pedestrian/i, vibe: "chill", price: 0, hours: 1, when: "afternoon", indoor: false, tip: "Grab a coffee and people-watch.", cap: 3 },
  { test: /bookstore|bookshop|library/i, vibe: "chill", price: 0, hours: 1, when: "afternoon", indoor: true, tip: "Browse and find a souvenir.", cap: 2 },
  { test: /restaurant|caf[eé]|bakery|pastry|brewery|winery|vineyard|distillery/i, vibe: "food", price: 20, hours: 1.5, when: "afternoon", indoor: true, tip: "A local institution.", cap: 4 },
  { test: /\bbar\b|pub\b|nightclub|club\b/i, vibe: "nightlife", price: 25, hours: 3, when: "evening", indoor: true, tip: "Gets going late.", cap: 3 },
];

/** "Fortified tower in Lisbon, Portugal" -> "Fortified tower". */
const shortDesc = (d: string) => {
  const s = d.replace(/\s+(located |situated )?in\s+.*$/i, "").replace(/,.*$/, "").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

interface WikiPage {
  pageid: number;
  title: string;
  description?: string;
  coordinates?: { lat: number; lon: number }[];
  pageviews?: Record<string, number | null>;
}

/** Well-known things to do near a point, ready for the deck. Empty on any failure. */
export async function placeActivities(center: { lat: number; lng: number }, city: string, max = 40): Promise<Activity[]> {
  const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*"
    + `&generator=geosearch&ggscoord=${center.lat}|${center.lng}&ggsradius=10000&ggslimit=500`
    + "&prop=description|coordinates|pageviews&pvipdays=30&colimit=500";
  const pages = (await getJson<{ query?: { pages: WikiPage[] } }>(url, 8000))?.query?.pages ?? [];

  const cityRe = new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const scored = pages
    .map((p) => ({ p, views: Object.values(p.pageviews ?? {}).reduce<number>((s, v) => s + (v ?? 0), 0) }))
    .filter(({ p }) => p.description && p.coordinates?.length && !cityRe.test(p.title) && p.title.length <= 48)
    .sort((a, b) => b.views - a.views);

  const used = new Map<Kind, number>();
  const out: Activity[] = [];
  for (const { p } of scored) {
    // Judge by what it is, not where it is: "Church in Setúbal District" is a church.
    const what = shortDesc(p.description!);
    if (NOT_A_PLACE.test(what)) continue;
    // The description decides; the title is only a fallback ("Capitol Hill" is a neighborhood, not a hike).
    const kind = KINDS.find((x) => x.test.test(what)) ?? KINDS.find((x) => x.test.test(p.title));
    if (!kind) continue;
    const n = used.get(kind) ?? 0;
    if (n >= kind.cap) continue;
    used.set(kind, n + 1);
    const title = p.title.replace(/\s*\([^)]*\)$/, ""); // "Igreja de São Domingos (Lisbon)" -> "Igreja de São Domingos"
    out.push({
      id: `wiki-${p.pageid}`,
      title,
      blurb: `${what}. ${kind.tip}`,
      vibe: kind.vibe,
      price: kind.price,
      durationHours: kind.hours,
      timeOfDay: kind.when,
      indoor: kind.indoor,
      lat: p.coordinates![0].lat,
      lng: p.coordinates![0].lon,
    });
    if (out.length >= max) break;
  }
  return out;
}

interface DetailPage {
  pageid?: number;
  title: string;
  missing?: boolean;
  thumbnail?: { source: string };
  extract?: string;
  fullurl?: string;
}

const wikiApi = (props: string) => "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1"
  + `&prop=${props}&inprop=url&piprop=thumbnail&pithumbsize=800`;

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** First sentence or two of the article, trimmed to fit on a card. */
function cardText(extract: string | undefined) {
  if (!extract) return undefined;
  const clean = extract.replace(/\s*\([^()]*\)/g, "").replace(/\s+/g, " ").trim();
  const first = clean.match(/^.{40,220}?[.!?](\s|$)/)?.[0]?.trim() ?? clean;
  return first.length > 220 ? `${first.slice(0, 217).trimEnd()}…` : first;
}

// Lead images that aren't photos of the place: logos, maps, flags, diagrams, scale models.
const NOT_A_PHOTO = /\.svg|logo|\bmap\b|_map|map_|mapa|karte|locator|location|flag|coat_of_arms|coat-of-arms|bras[aã]o|escudo|wappen|emblem|seal_of|signature|diagram|icon|model_of|plan_of|\bplan\b|chart|poster|banner/i;
const isPhoto = (url?: string) => !!url && !NOT_A_PHOTO.test(decodeURIComponent(url.split("/").pop() ?? ""));

/** Give every idea a real photo and a "read more" link where we can find an accurate one.
 *  Sources, most specific first: an exact Commons file, the place's own Wikidata image, its Wikipedia article.
 *  Places found by geosearch also swap their template blurb for the article's opening line. */
export async function attachPhotos(items: Activity[], city = ""): Promise<Activity[]> {
  const { commonsThumb, wikidataImages } = await import("./wikivoyage");
  const byPage = new Map<number, DetailPage>();
  const byTitle = new Map<string, DetailPage>();

  // Sights from the travel guide with no Wikidata entry: try a Wikipedia article with exactly that name.
  // (Not restaurants or bars, whose names collide with unrelated articles.)
  const withTitles = items.map((a) =>
    !a.wiki && !a.image && !a.wikidataId && a.id.startsWith("wv-") && a.vibe !== "food" && a.vibe !== "nightlife" ? { ...a, wiki: a.title } : a);

  const pageIds = withTitles.map((a) => a.id.startsWith("wiki-") ? Number(a.id.slice(5)) : NaN).filter(Number.isFinite);
  const titles = [...new Set(withTitles.filter((a) => a.wiki && !a.wiki.startsWith("File:") && !a.image).map((a) => a.wiki!))];
  const qids = [...new Set(withTitles.filter((a) => a.wikidataId && !a.image).map((a) => a.wikidataId!))];

  const jobs: Promise<unknown>[] = [];
  // Extracts come back for at most 20 pages per request.
  for (const ids of chunk(pageIds, 20)) {
    jobs.push(getJson<{ query?: { pages: DetailPage[] } }>(
      `${wikiApi("pageimages|info|extracts")}&exintro=1&explaintext=1&exlimit=20&pilimit=20&pageids=${ids.join("|")}`, 8000,
    ).then((j) => { for (const p of j?.query?.pages ?? []) if (p.pageid) byPage.set(p.pageid, p); }));
  }
  for (const ts of chunk(titles, 50)) {
    jobs.push(getJson<{ query?: { pages: DetailPage[]; normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] } }>(
      `${wikiApi("pageimages|info")}&pilimit=50&titles=${encodeURIComponent(ts.join("|"))}`, 8000,
    ).then((j) => {
      const q = j?.query;
      if (!q) return;
      const pages = new Map(q.pages.filter((p) => !p.missing).map((p) => [p.title, p]));
      const hop = (t: string, list?: { from: string; to: string }[]) => list?.find((x) => x.from === t)?.to ?? t;
      for (const t of ts) {
        const page = pages.get(hop(hop(t, q.normalized), q.redirects));
        if (page) byTitle.set(t, page);
      }
    }));
  }
  const wd = qids.length ? wikidataImages(qids) : Promise.resolve(new Map<string, string>());
  jobs.push(wd);
  await Promise.all(jobs);
  const wdImages = await wd;

  const result = withTitles.map((a, i) => {
    const original = items[i];
    if (a.image) return original;
    if (a.wiki?.startsWith("File:")) return { ...original, image: commonsThumb(a.wiki.slice(5)) };
    if (a.wikidataId && wdImages.has(a.wikidataId)) {
      const file = wdImages.get(a.wikidataId)!;
      if (isPhoto(file)) return { ...original, image: commonsThumb(file) };
    }
    const page = a.id.startsWith("wiki-") ? byPage.get(Number(a.id.slice(5))) : a.wiki ? byTitle.get(a.wiki) : undefined;
    if (!page) return original;
    const text = a.id.startsWith("wiki-") ? cardText(page.extract) : undefined;
    const image = isPhoto(page.thumbnail?.source) ? page.thumbnail!.source : undefined;
    return { ...original, image, infoUrl: original.infoUrl ?? page.fullurl, blurb: text ?? original.blurb };
  });
  // Guide places still without a photo (mostly restaurants and bars) get searched by name in the browser,
  // one card at a time as they come up, so a plan doesn't fire dozens of requests at once.
  return result.map((a) => (!a.image && a.id.startsWith("wv-") && city ? { ...a, photoCity: city } : a));
}

/** Lead photo of the best Wikipedia match for a search, e.g. "Alfama Lisbon". */
export async function photoFor(query: string): Promise<string | undefined> {
  const url = `${wikiApi("pageimages")}&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(query)}`;
  const j = await getJson<{ query?: { pages: DetailPage[] } }>(url, 6000);
  const src = j?.query?.pages?.[0]?.thumbnail?.source;
  return isPhoto(src) ? src : undefined;
}
