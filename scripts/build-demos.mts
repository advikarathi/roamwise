// Builds public/demos/<CODE>.json: complete, ready-to-show trips for the "Try a demo trip" buttons.
// They use only the bundled city guides (free Wikipedia/Wikivoyage photos), never paid APIs,
// so a recruiter clicking around costs nothing and never hits a rate limit.
// Run: npm run demos:build
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { planTrip } from "../lib/agents/orchestrator";
import { readGuide } from "../lib/guidesServer";
import type { TripPlan, TripRequest, Vibe } from "../lib/types";

export interface DemoTrip {
  plan: TripPlan;
  /** Ideas already swiped right, so the itinerary, map and budget are filled in. */
  keeps: string[];
}

const DEMOS: { code: string; origin: string; nights: number; travelers: number; budget: number; vibes: Vibe[] }[] = [
  { code: "LIS", origin: "JFK", nights: 5, travelers: 2, budget: 3600, vibes: ["food", "culture", "nightlife"] },
  { code: "HND", origin: "SFO", nights: 6, travelers: 2, budget: 6000, vibes: ["food", "culture"] },
  { code: "CDG", origin: "BOS", nights: 4, travelers: 2, budget: 4200, vibes: ["food", "culture", "chill"] },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const outDir = path.join(process.cwd(), "public", "demos");
await mkdir(outDir, { recursive: true });

for (const d of DEMOS) {
  // Dates are placeholders; the app moves them a few weeks ahead of whenever the demo is opened.
  const start = new Date(Date.UTC(2027, 3, 10));
  const end = new Date(start.getTime() + d.nights * 86_400_000);
  const req: TripRequest = { origin: d.origin, destination: d.code, startDate: iso(start), endDate: iso(end), travelers: d.travelers, budget: d.budget, vibes: d.vibes, stayType: "either" };
  const plan = await planTrip(req, { pacing: false, loadGuide: readGuide }, () => {});
  if (!plan) { console.log(`${d.code}: planning failed`); continue; }

  // Keep the crew's picks plus a few more with photos, so every day has something good on it.
  const withPhoto = plan.activities.filter((a) => a.image);
  const keeps = [...new Set([...plan.suggestedActivityIds, ...withPhoto.slice(0, d.nights * 2).map((a) => a.id)])].slice(0, d.nights * 2 + 2);
  const demo: DemoTrip = { plan: { ...plan, source: "demo" }, keeps };
  await writeFile(path.join(outDir, `${d.code}.json`), JSON.stringify(demo));
  console.log(`${d.code}: ${plan.activities.length} ideas (${withPhoto.length} with photos), ${keeps.length} kept, stay ${plan.stays.find((s) => s.id === plan.selectedStayId)?.name}`);
}
