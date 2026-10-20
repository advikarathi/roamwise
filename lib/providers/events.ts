// Events agent: what's on in the city during the trip (concerts, festivals, exhibitions, matches,
// markets), found with Claude's web search. Server only; needs ANTHROPIC_API_KEY.
//
// Claude searches with the server-side web_search tool, then hands back results by calling our
// `save_events` tool. That tool is `strict`, so its input always matches the schema: the results
// arrive as data, with a source link for each event.
import type Anthropic from "@anthropic-ai/sdk";
import { claudeModel } from "./claude";
import type { Activity, Vibe } from "../types";

const VIBES: Vibe[] = ["food", "culture", "beach", "nightlife", "outdoors", "chill"];

export interface TripEvent {
  title: string;
  date: string; // YYYY-MM-DD, within the trip
  blurb: string;
  venue: string;
  vibe: Vibe;
  price: number; // USD per person, best guess (0 if free)
  timeOfDay: "morning" | "afternoon" | "evening";
  url: string; // where it was found / tickets
}

const SAVE_EVENTS: Anthropic.Tool = {
  name: "save_events",
  description: "Save the events you found. Call this exactly once, after searching.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["events"],
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "date", "blurb", "venue", "vibe", "price", "timeOfDay", "url"],
          properties: {
            title: { type: "string", description: "Event name, max 8 words" },
            date: { type: "string", description: "YYYY-MM-DD; one date within the trip (first day it's on, if it runs several days)" },
            blurb: { type: "string", description: "Max 18 words: what it is and why it's worth going" },
            venue: { type: "string" },
            vibe: { type: "string", enum: VIBES },
            price: { type: "number", description: "USD per person, best estimate; 0 if free" },
            timeOfDay: { type: "string", enum: ["morning", "afternoon", "evening"] },
            url: { type: "string", description: "The page where you found it (official or ticket page preferred)" },
          },
        },
      },
    },
  },
};

const cache = new Map<string, { at: number; events: TripEvent[] }>();

export async function findEvents(city: string, country: string, startDate: string, endDate: string, apiKey: string): Promise<TripEvent[]> {
  const id = `${city}|${startDate}|${endDate}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 86_400_000) return hit.events;

  const { default: AnthropicSDK } = await import("@anthropic-ai/sdk");
  const client = new AnthropicSDK({ apiKey, timeout: 90_000, maxRetries: 1 });
  const messages: Anthropic.MessageParam[] = [{
    role: "user",
    content: `A traveler is in ${city}, ${country} from ${startDate} to ${endDate}. Find what's on that they could go to:
concerts and gigs, festivals, seasonal events (e.g. Christmas markets, holiday light shows), exhibitions,
theatre, dance and opera, sports matches, food and wine events.

How to search:
- Try the city's "what's on" / events guides and the month (e.g. "${city} events ${new Date(`${startDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}"), big venues' calendars, and seasonal events for those dates.
- Include multi-day events (festivals, markets, exhibitions) that are running during the trip; use the first trip date they're on.

Rules:
- Only events you found on the web that happen on a date between ${startDate} and ${endDate}. Skip permanent attractions.
- The url must be the event's own page (official site, venue page or ticket page), not a search or listing page.
- Aim for 8-12 of the most worthwhile, mixing kinds.
Then call save_events once with what you found (an empty list if nothing fits).`,
  }];

  // Web search runs server-side; long searches can pause (pause_turn) and are resumed by re-sending.
  for (let turn = 0; turn < 4; turn++) {
    const response = await client.messages.create({
      model: claudeModel(),
      max_tokens: 16000,
      // Runs after the trip is on screen, so it can take its time to search properly.
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }, SAVE_EVENTS],
      messages,
    });
    if (process.env.EVENTS_DEBUG) console.log(`[events] turn ${turn}: stop=${response.stop_reason}`, response.content.map((b) => b.type === "tool_use" ? `tool_use:${b.name} ${JSON.stringify(b.input).slice(0, 400)}` : b.type).join(" | "));
    if (response.stop_reason === "refusal") return [];
    const save = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "save_events");
    if (save) {
      const events = clean((save.input as { events?: TripEvent[] }).events ?? [], startDate, endDate);
      cache.set(id, { at: Date.now(), events });
      return events;
    }
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  return [];
}

/** Keep only well-formed events inside the trip, one per title. */
function clean(events: TripEvent[], startDate: string, endDate: string): TripEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    const key = e.title.toLowerCase();
    if (seen.has(key) || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || e.date < startDate || e.date > endDate) return false;
    if (!/^https?:\/\//.test(e.url) || !VIBES.includes(e.vibe)) return false;
    seen.add(key);
    return true;
  });
}

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Events as deck cards, pinned to their date. */
export function eventActivities(events: TripEvent[]): Activity[] {
  return events.map((e) => ({
    id: `ev-${slug(e.title)}-${e.date}`,
    title: e.title,
    blurb: `${new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${e.venue}. ${e.blurb}`,
    vibe: e.vibe,
    price: Math.max(0, Math.round(e.price)),
    durationHours: 2.5,
    timeOfDay: e.timeOfDay,
    indoor: e.vibe === "culture" || e.vibe === "nightlife",
    infoUrl: e.url,
    date: e.date,
    address: e.venue,
  }));
}
