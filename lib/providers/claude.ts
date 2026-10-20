// Claude calls used while planning: extra activity ideas for the deck, and reading free-text change
// requests ("make it cheaper"). Used only when ANTHROPIC_API_KEY is set; any failure returns [] and
// the app carries on with its other sources.
//
// The SDK and zod are imported inside each function: this module is also bundled into the in-browser
// preview build, and a top-level import would ship the SDK to every visitor for nothing.
import type { Activity, TripRequest, Vibe } from "../types";
import type { Change } from "../agents/revise";

const VIBES = ["food", "culture", "beach", "nightlife", "outdoors", "chill"] as const satisfies readonly Vibe[];

/** The model for every Claude call in the app. Override with ANTHROPIC_MODEL. */
export const claudeModel = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

async function sdk(apiKey: string, timeout: number) {
  const [{ default: Anthropic }, { zodOutputFormat }, { z }] = await Promise.all([
    import("@anthropic-ai/sdk"), import("@anthropic-ai/sdk/helpers/zod"), import("zod"),
  ]);
  return { client: new Anthropic({ apiKey, timeout, maxRetries: 1 }), zodOutputFormat, z };
}

/** 30 specific, real things to do. Structured output guarantees the shape, so there's no JSON to
 *  fish out of prose. Planning waits on this, so it runs at low effort with a 40 s ceiling. */
export async function claudeActivities(
  req: TripRequest, cityName: string, neighborhood: string, maxPerPerson: number, apiKey: string,
): Promise<Activity[]> {
  const { client, zodOutputFormat, z } = await sdk(apiKey, 40_000);
  const Ideas = z.object({
    ideas: z.array(z.object({
      title: z.string().describe("max 6 words"),
      blurb: z.string().describe("max 14 words, casual and specific"),
      vibe: z.enum(VIBES),
      price: z.number().describe("USD per person"),
      durationHours: z.number(),
      timeOfDay: z.enum(["morning", "afternoon", "evening"]),
      indoor: z.boolean().describe("true if it works on a rainy day"),
      lat: z.number(),
      lng: z.number(),
      wiki: z.string().describe("exact title of the English Wikipedia article for this place or dish, or empty"),
    })),
  });

  const response = await client.messages.parse({
    model: claudeModel(),
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(Ideas) },
    messages: [{
      role: "user",
      content: `You're the activities agent in a travel planner. Suggest 30 things to do in ${cityName} for a trip from ${req.startDate} to ${req.endDate}.
The traveler is staying in ${neighborhood}. Their vibes: ${req.vibes.join(", ") || "anything"}.
Spread the ideas across all of these vibes, leaning toward theirs: ${VIBES.join(", ")}.
Mix famous sights with local favorites, specific restaurants and dishes, nights out, day trips and a few free options. Use real, specific places, not generic ideas.
Most ideas should cost well under $${Math.round(Math.max(20, maxPerPerson / 4))} per person. Coordinates can be approximate.`,
    }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) return [];
  return response.parsed_output.ideas.map((a, i) => ({
    id: `ai-${i}`,
    title: a.title,
    blurb: a.blurb,
    vibe: a.vibe,
    price: Math.max(0, Math.round(a.price)),
    durationHours: a.durationHours || 2,
    timeOfDay: a.timeOfDay,
    indoor: a.indoor,
    ...(Number.isFinite(a.lat) && Number.isFinite(a.lng) && (a.lat || a.lng) ? { lat: a.lat, lng: a.lng } : {}),
    ...(a.wiki ? { wiki: a.wiki } : {}),
  }));
}

/** Turns a change request the simple rules didn't catch into structured changes. */
export async function claudeParseChange(text: string, apiKey: string): Promise<Change[]> {
  try {
    const { client, zodOutputFormat, z } = await sdk(apiKey, 20_000);
    const Changes = z.object({
      changes: z.array(z.object({
        kind: z.enum(["cheaper", "fancier", "nonstop", "fastest", "addVibe", "stayType", "budget"]),
        vibe: z.enum(VIBES).nullable().describe("only for addVibe"),
        stayType: z.enum(["hotel", "apartment"]).nullable().describe("only for stayType"),
        amount: z.number().nullable().describe("total trip budget in USD, only for budget"),
      })),
    });
    const response = await client.messages.parse({
      model: claudeModel(),
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(Changes) },
      messages: [{
        role: "user",
        content: `A traveler asked to change their trip plan: "${text}"
Map it to the changes it asks for. Use an empty list if nothing fits.
cheaper / fancier: price level of the trip or stay. nonstop / fastest: the flight. addVibe: more of a kind of activity.
stayType: switch between hotel and apartment. budget: a new total budget.`,
      }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return [];
    return response.parsed_output.changes.flatMap((c): Change[] => {
      if (c.kind === "addVibe") return c.vibe ? [{ kind: "addVibe", vibe: c.vibe }] : [];
      if (c.kind === "stayType") return c.stayType ? [{ kind: "stayType", stayType: c.stayType }] : [];
      if (c.kind === "budget") return c.amount && c.amount > 0 ? [{ kind: "budget", amount: Math.round(c.amount) }] : [];
      return [{ kind: c.kind }];
    });
  } catch (err) {
    console.error(err);
    return [];
  }
}
