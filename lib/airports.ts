// Every airport with scheduled passenger service (about 4,000, in 233 countries),
// from the public-domain OurAirports dataset. Rebuild with scripts/build-airports.mjs.
import data from "./data/airports.json";

export interface AirportInfo {
  code: string;
  name: string;
  city: string;
  countryCode: string;
  country: string;
  lat: number;
  lng: number;
  size: 1 | 2 | 3; // 3 = major international airport
}

// The dataset names the town an airport sits in, which isn't always the city people fly to.
const CITY_OVERRIDES: Record<string, string> = {
  NRT: "Tokyo", HND: "Tokyo", KIX: "Osaka", ITM: "Osaka", DPS: "Bali", KRK: "Kraków", LYS: "Lyon",
  MXP: "Milan", LIN: "Milan", BGY: "Milan", VRN: "Verona", TRN: "Turin", FLR: "Florence", GOA: "Genoa",
  EDI: "Edinburgh", BHX: "Birmingham", LBA: "Leeds", ADB: "Izmir", SKP: "Skopje", TZL: "Tuzla",
  MVD: "Montevideo", IAD: "Washington, D.C.", DCA: "Washington, D.C.", DFW: "Dallas", GRZ: "Graz",
  CEB: "Cebu", BSL: "Basel", RZE: "Rzeszów", ICN: "Seoul", GMP: "Seoul", ISB: "Islamabad",
  DXN: "Noida", BEN: "Benghazi", KNO: "Medan", OUD: "Oujda", ORN: "Oran", FUE: "Fuerteventura",
  LPA: "Gran Canaria", SID: "Sal", HEL: "Helsinki", FMO: "Münster", PAD: "Paderborn", HHN: "Frankfurt-Hahn",
  CVG: "Cincinnati", LIL: "Lille", AVV: "Melbourne (Avalon)", SPX: "Cairo", HBE: "Alexandria",
  EIS: "Tortola", STT: "St. Thomas", HNL: "Honolulu", OGG: "Maui", LIH: "Kauai", KOA: "Kona",
  VVO: "Vladivostok", ROR: "Palau", CDG: "Paris", ORY: "Paris", BVA: "Paris (Beauvais)", EZE: "Buenos Aires",
  BCN: "Barcelona", CTU: "Chengdu", TFU: "Chengdu", CAN: "Guangzhou", CSX: "Changsha", HAN: "Hanoi",
  HPH: "Haiphong", HAK: "Haikou", FOC: "Fuzhou", DLC: "Dalian", KHH: "Kaohsiung", CFU: "Corfu",
  IBZ: "Ibiza", FRA: "Frankfurt", CGN: "Cologne", HBA: "Hobart", TYS: "Knoxville", KUO: "Kuopio",
  CHC: "Christchurch", PLZ: "Port Elizabeth", LPB: "La Paz", MNI: "Montserrat", YNY: "Yangyang",
  EWR: "New York (Newark)", LGA: "New York", JFK: "New York", SVO: "Moscow", DME: "Moscow", VKO: "Moscow",
  IKA: "Tehran", KUL: "Kuala Lumpur", GHV: "Brașov", AGA: "Agadir", BJL: "Banjul", FNA: "Freetown",
  CGP: "Chattogram", DWC: "Dubai", KRS: "Kristiansand", GOI: "Goa", GOX: "Goa",
};

// Extra spellings people commonly type.
const EXTRA_KEYWORDS: Record<string, string> = {
  RAK: "Marrakech", KBP: "Kiev,Kyiv", PRG: "Praha", VIE: "Wien", MUC: "Munchen", CPH: "Kobenhavn", LIS: "Lisboa",
  WAW: "Warszawa", NAP: "Napoli", FLR: "Firenze", VCE: "Venezia", FCO: "Roma", CUZ: "Cuzco", DPS: "Denpasar",
};

// Airports the dataset ranks higher than they serve today (so searches favor the main airport).
const SIZE_OVERRIDES: Record<string, 1 | 2 | 3> = { DXN: 2 };

// Where flights for a city really go: a brand-new or low-service airport flies via the main one nearby.
const FLY_VIA: Record<string, string> = { DXN: "DEL" };

/** The airport to search flights for. Usually the same code; e.g. Noida (DXN) searches Delhi (DEL). */
export const flightAirport = (code: string) => FLY_VIA[code.toUpperCase()] ?? code.toUpperCase();

function cleanCity(raw: string): string {
  return raw.replace(/\s*\(.*?\)\s*/g, " ").split(/[,/]/)[0].trim();
}

type Row = [string, string, string, string, number, number, number, string?];
const COUNTRIES = data.countries as Record<string, string>;

const KEYWORDS = new Map<string, string>();

export const AIRPORTS: AirportInfo[] = (data.airports as Row[]).map(([code, name, city, cc, lat, lng, size, keywords]) => {
  const extra = [keywords, EXTRA_KEYWORDS[code]].filter(Boolean).join(",");
  if (extra) KEYWORDS.set(code, extra);
  return {
  code,
  name,
  city: CITY_OVERRIDES[code] ?? cleanCity(city),
  countryCode: cc,
  country: COUNTRIES[cc] ?? cc,
  lat,
  lng,
  size: SIZE_OVERRIDES[code] ?? (size as 1 | 2 | 3),
  };
});

const BY_CODE = new Map(AIRPORTS.map((a) => [a.code, a]));

export function getAirport(code: string): AirportInfo | undefined {
  return BY_CODE.get(code.toUpperCase());
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const FOLDED = AIRPORTS.map((a) => ({ a, city: fold(a.city), name: fold(a.name), country: fold(a.country), keywords: fold(KEYWORDS.get(a.code) ?? "") }));

/** Search by city, airport name, country or 3-letter code. Bigger airports rank first. */
export function searchAirports(query: string, limit = 8): AirportInfo[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const scored: { a: AirportInfo; score: number }[] = [];
  for (const f of FOLDED) {
    let score = 0;
    if (f.city === q) score = 100;
    else if (q.length === 3 && f.a.code.toLowerCase() === q) score = 90;
    else if (f.city.startsWith(q)) score = 60;
    else if (f.name.includes(q)) score = 40;
    else if (f.city.includes(q)) score = 30;
    else if (f.keywords.includes(q)) score = 25;
    else if (f.country.startsWith(q)) score = 15;
    if (score) scored.push({ a: f.a, score: score + f.a.size * 5 });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, limit).map((s) => s.a);
}
