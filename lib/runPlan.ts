// Client side: starts a plan (or a change) and calls onEvent for every update from the crew.
// mode "server" uses the Next.js API routes; mode "local" runs the same agents in the
// browser with demo data (used for the static preview).
import { planTrip } from "./agents/orchestrator";
import { parseChange, revisePlan } from "./agents/revise";
import { fetchGuide } from "./guides";
import type { PlanEvent, TripPlan, TripRequest } from "./types";

export type RunMode = "server" | "local";

async function stream(url: string, body: unknown, onEvent: (e: PlanEvent) => void) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    // Our routes explain errors (e.g. the hourly limit) as JSON; show that when there is one.
    const detail = await res.json().then((j: { error?: string }) => j.error, () => undefined);
    onEvent({ type: "error", message: detail ?? `Server error (${res.status})` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as PlanEvent);
  }
}

export async function runPlan(req: TripRequest, mode: RunMode, onEvent: (e: PlanEvent) => void) {
  if (mode === "local") {
    await planTrip(req, { pacing: true, loadGuide: fetchGuide }, onEvent);
    return;
  }
  await stream("/api/plan", req, onEvent);
}

export async function runRevise(plan: TripPlan, text: string, mode: RunMode, onEvent: (e: PlanEvent) => void) {
  if (mode === "local") {
    const changes = parseChange(text);
    if (!changes.length) {
      onEvent({ type: "error", message: `The crew didn't catch that. Try "cheaper", "nonstop", "fancier stay" or "add a beach day".` });
      return;
    }
    await revisePlan(plan, changes, { pacing: true, loadGuide: fetchGuide }, onEvent);
    return;
  }
  await stream("/api/revise", { plan, text }, onEvent);
}
