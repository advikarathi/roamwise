// POST /api/plan  — streams the crew's progress as newline-delimited JSON (one PlanEvent per line).
import { planTrip } from "@/lib/agents/orchestrator";
import { readGuide } from "@/lib/guidesServer";
import { allow, CAPS, tooMany, visitor } from "@/lib/rateLimit";
import type { PlanEvent, TripRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!allow(`plan:${visitor(request)}`, CAPS.plansPerHour, 3_600_000)) return tooMany("You've planned a lot of trips in the last hour. Try again in a bit, or open a demo trip.");
  const req = (await request.json()) as TripRequest;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: PlanEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await planTrip(
          req,
          {
            duffelToken: process.env.DUFFEL_TOKEN || undefined,
            anthropicKey: process.env.ANTHROPIC_API_KEY || undefined,
            googleKey: process.env.GOOGLE_PLACES_API_KEY || undefined,
            pacing: true,
            loadGuide: readGuide,
          },
          emit,
        );
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
