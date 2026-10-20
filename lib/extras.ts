// Free, keyless data the trip board pulls in the browser:
//   - a city photo from Wikipedia
//   - weather from Open-Meteo (forecast if the trip is close, otherwise last year's weather on the same dates)
// Both fail quietly: the board simply shows its built-in look instead.

export interface CityPhoto {
  url: string;
  pageTitle: string;
  pageUrl: string;
}

export async function fetchCityPhoto(city: string, country: string): Promise<CityPhoto | null> {
  for (const title of [city, `${city}, ${country}`]) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (!res.ok) continue;
      const j = (await res.json()) as {
        type?: string;
        title?: string;
        originalimage?: { source: string; width: number; height: number };
        thumbnail?: { source: string };
        content_urls?: { desktop?: { page?: string } };
      };
      const img = j.originalimage && j.originalimage.width > j.originalimage.height ? j.originalimage.source : j.thumbnail?.source;
      if (j.type === "disambiguation" || !img || /flag|coat_of_arms|map|locator|svg$/i.test(img)) continue;
      return { url: img, pageTitle: j.title ?? title, pageUrl: j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` };
    } catch {
      return null; // offline or blocked
    }
  }
  return null;
}

export interface DayWeather {
  date: string; // YYYY-MM-DD (trip date)
  highF: number;
  lowF: number;
  rainMm: number;
  code: number; // WMO weather code
}

export interface TripWeather {
  source: "forecast" | "last-year" | "estimate";
  days: DayWeather[];
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function shiftYear(iso: string, years: number) {
  return `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`;
}

export async function fetchWeather(lat: number, lng: number, start: string, end: string): Promise<TripWeather> {
  const daysAhead = (new Date(`${start}T00:00:00Z`).getTime() - Date.now()) / 86_400_000;
  const params = "daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&temperature_unit=fahrenheit&timezone=auto";
  try {
    if (daysAhead < 14) {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&${params}&start_date=${start}&end_date=${end}`);
      if (r.ok) return { source: "forecast", days: toDays(await r.json(), 0) };
    } else {
      const r = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&${params}&start_date=${shiftYear(start, -1)}&end_date=${shiftYear(end, -1)}`,
      );
      if (r.ok) return { source: "last-year", days: toDays(await r.json(), 1) };
    }
  } catch {
    /* fall through to the estimate */
  }
  return estimateWeather(lat, start, end);
}

interface MeteoJson {
  daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; weather_code: number[] };
}

function toDays(j: MeteoJson, yearShift: number): DayWeather[] {
  const d = j.daily;
  if (!d) return [];
  return d.time.map((t, i) => ({
    date: shiftYear(t, yearShift),
    highF: Math.round(d.temperature_2m_max[i]),
    lowF: Math.round(d.temperature_2m_min[i]),
    rainMm: Math.round((d.precipitation_sum[i] ?? 0) * 10) / 10,
    code: d.weather_code[i] ?? 0,
  }));
}

/** Rough seasonal estimate from latitude and month, used only when the weather service can't be reached. */
export function estimateWeather(lat: number, start: string, end: string): TripWeather {
  const days: DayWeather[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const month = Number(date.slice(5, 7));
    const north = lat >= 0;
    const summeriness = Math.cos(((month - (north ? 7 : 1)) / 12) * 2 * Math.PI); // 1 = midsummer, -1 = midwinter
    const absLat = Math.abs(lat);
    const yearly = 90 - absLat * 0.6; // average daily high, warmer near the equator
    const swing = Math.min(25, absLat * 0.4); // summer-to-winter difference
    const high = Math.round(yearly + (summeriness * swing) / 2);
    // No rain guesses: without real data every day shows as "mixed".
    days.push({ date, highF: high, lowF: high - 14, rainMm: 0, code: 2 });
  }
  return { source: "estimate", days };
}

export function weatherKind(code: number, rainMm: number): "sun" | "cloud" | "rain" | "snow" | "storm" {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (rainMm >= 2 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 2) return "cloud";
  return "sun";
}

export const isWetDay = (d: DayWeather) => ["rain", "storm", "snow"].includes(weatherKind(d.code, d.rainMm));
