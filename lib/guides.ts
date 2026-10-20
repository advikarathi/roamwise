// Pre-built city guides, so popular destinations plan instantly with photos and make no
// Wikimedia API calls at all (only the image files load, from Wikimedia's image servers).
// Built by `npm run guides:build` into public/guides/<CODE>.json.
import type { Activity } from "./types";
import type { Listing } from "./providers/wikivoyage";

export interface Guide {
  code: string;
  city: string;
  country: string;
  center?: { lat: number; lng: number };
  builtAt: string;
  /** Wikivoyage See / Do / Eat / Drink / Sleep listings. */
  listings: Listing[];
  /** Well-known places nearby (Wikipedia geosearch), already with photos and blurbs. */
  places: Activity[];
  /** Verified photo URL per place name: listings, hotels and hand-written ideas. */
  photos: Record<string, string>;
}

export type GuideLoader = (code: string) => Promise<Guide | undefined>;

/** Browser loader: the guides are static files. */
const fetched = new Map<string, Promise<Guide | undefined>>();
export const fetchGuide: GuideLoader = (code) => {
  const key = code.toUpperCase();
  if (!fetched.has(key)) {
    fetched.set(key, fetch(`/guides/${key}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<Guide>) : undefined))
      .catch(() => undefined));
  }
  return fetched.get(key)!;
};
