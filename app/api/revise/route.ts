// POST /api/revise  { plan, text } — streams the affected agents' progress, then the updated plan.
import { parseChange, revisePlan } from "@/lib/agents/revise";
import { claudeParseChange } from "@/lib/providers/claude";
import { readGuide } from "@/lib/guidesServer";
import { allow, CAPS, tooMany, visitor } from "@/lib/rateLimit";
import type { PlanEvent, TripPlan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!allow(`plan:${visitor(request)}`, CAPS.plansPerHour * 2, 3_600_000)) return tooMany("That's a lot of changes in an hour. Try again in a bit.");
  const { plan, text } = (await request.json()) as { plan: TripPlan; text: string };
  const encoder = new TextEncoder();
  const key = process.env.ANTHROPIC_API_KEY || undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: PlanEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        let changes = parseChange(text);
        if (!changes.length && key) changes = await claudeParseChange(text, key);
        if (!changes.length) {
          emit({ type: "error", message: `The crew didn't catch that. Try "cheaper", "nonstop", "fancier stay" or "add a beach day".` });
        } else {
          await revisePlan(plan, changes, { duffelToken: process.env.DUFFEL_TOKEN || undefined, anthropicKey: key, googleKey: process.env.GOOGLE_PLACES_API_KEY || undefined, travelpayoutsToken: process.env.TRAVELPAYOUTS_TOKEN || undefined, travelpayoutsMarker: process.env.TRAVELPAYOUTS_MARKER || undefined, pacing: true, loadGuide: readGuide }, emit);
        }
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Couldn't update the trip." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
