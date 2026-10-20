"use client";
// Browser-side photo lookup for ideas that arrived without one (say the server was rate-limited).
// Runs only for the card on screen, from the visitor's own connection, and remembers answers.
import { useEffect, useState } from "react";
import type { Activity } from "./types";

// Same rule as the server: logos, maps and diagrams aren't photos of the place.
const NOT_A_PHOTO = /\.svg|logo|\bmap\b|_map|map_|mapa|karte|locator|location|flag|coat_of_arms|bras[aã]o|escudo|wappen|emblem|seal_of|signature|diagram|icon|model_of|\bplan\b|poster/i;

const seen = new Map<string, Promise<{ image?: string; url?: string }>>();

const STOP = new Set("hotel hotels hostel the and by of de da do das dos del la le les el los spa restaurant restaurante cafe bar inn house casa suites rooms".split(" "));
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A Commons photo whose file title contains every distinctive word of the place's name (and ideally the city). */
function byName(name: string, city: string) {
  const key = `name:${name}|${city}`;
  if (!seen.has(key)) {
    const cityWords = fold(city).split(/[^a-z0-9]+/).filter(Boolean);
    const words = [...new Set(fold(name).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w) && !cityWords.includes(w)))];
    if (!words.length) return Promise.resolve({});
    const q = words.map((w) => `intitle:"${w}"`).join(" ");
    const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*"
      + `&list=search&srnamespace=6&srlimit=8&srsearch=${encodeURIComponent(q)}`;
    seen.set(key, fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const files: string[] = (j?.query?.search ?? []).map((s: { title: string }) => s.title.replace(/^File:/, ""))
          .filter((f: string) => /\.(jpe?g|png|webp)$/i.test(f) && !NOT_A_PHOTO.test(f) && !/menu|\bsign\b|flyer/i.test(f));
        const hit = files.find((f) => cityWords.every((w) => fold(f).includes(w))) ?? (words.length >= 3 ? files[0] : undefined); // "Mercure Centro" exists in every city
        return hit ? { image: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(hit.replace(/ /g, "_"))}?width=800` } : {};
      })
      .catch(() => ({})));
  }
  return seen.get(key)!;
}

function lookup(a: Activity) {
  if (a.photoCity) return byName(a.title, a.photoCity);
  // Only ideas that point at a specific article; never a free-text guess.
  const byId = a.id.startsWith("wiki-") ? `pageids=${a.id.slice(5)}`
    : a.wiki && !a.wiki.startsWith("File:") ? `titles=${encodeURIComponent(a.wiki)}` : null;
  if (!byId) return Promise.resolve({});
  if (!seen.has(byId)) {
    const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1"
      + `&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=800&${byId}`;
    seen.set(byId, fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = j?.query?.pages?.[0];
        const src: string | undefined = p?.thumbnail?.source;
        const ok = src && !NOT_A_PHOTO.test(decodeURIComponent(src.split("/").pop() ?? ""));
        return { image: ok ? src : undefined, url: p?.fullurl };
      })
      .catch(() => ({})));
  }
  return seen.get(byId)!;
}

/** The idea's photo and "read more" link, fetching them if the plan didn't include them. */
export function usePhoto(a: Activity) {
  const [found, setFound] = useState<{ image?: string; url?: string }>({});
  useEffect(() => {
    if (a.image) return;
    let live = true;
    lookup(a).then((r) => live && setFound(r));
    return () => { live = false; };
  }, [a]);
  return { image: a.image ?? found.image, infoUrl: a.infoUrl ?? found.url };
}
