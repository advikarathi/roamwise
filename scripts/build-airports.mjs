// Rebuilds lib/data/airports.json from the public-domain OurAirports dataset.
// Usage:
//   curl -LO https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv
//   curl -LO https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/countries.csv
//   node scripts/build-airports.mjs airports.csv countries.csv
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [airportsCsv, countriesCsv] = process.argv.slice(2);
if (!airportsCsv || !countriesCsv) {
  console.error("Usage: node scripts/build-airports.mjs airports.csv countries.csv");
  process.exit(1);
}

/** Minimal CSV parser that handles quoted fields with commas and doubled quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const countries = Object.fromEntries(parseCsv(readFileSync(countriesCsv, "utf8")).map((c) => [c.code, c.name]));
const SIZE = { large_airport: 3, medium_airport: 2, small_airport: 1 };

const airports = parseCsv(readFileSync(airportsCsv, "utf8"))
  .filter((a) => a.scheduled_service === "yes" && /^[A-Z]{3}$/.test(a.iata_code) && SIZE[a.type])
  .map((a) => [
    a.iata_code,
    a.name,
    a.municipality || a.name,
    a.iso_country,
    Math.round(Number(a.latitude_deg) * 100) / 100,
    Math.round(Number(a.longitude_deg) * 100) / 100,
    SIZE[a.type],
    // Alternate names people search for (e.g. "Marrakech"), trimmed to keep the file small.
    a.keywords.split(",").map((k) => k.trim()).filter((k) => k && !/^[A-Z0-9]{3,4}$/.test(k)).slice(0, 3).join(","),
  ])
  .sort((a, b) => b[6] - a[6] || a[2].localeCompare(b[2]));

const usedCountries = Object.fromEntries([...new Set(airports.map((a) => a[3]))].map((c) => [c, countries[c] ?? c]));

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "data");
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, "airports.json"),
  JSON.stringify({
    source: "OurAirports (public domain), https://ourairports.com/data/",
    fields: ["iata", "name", "city", "country", "lat", "lng", "size", "keywords"],
    countries: usedCountries,
    airports,
  }),
);
console.log(`Wrote ${airports.length} airports in ${Object.keys(usedCountries).length} countries`);
