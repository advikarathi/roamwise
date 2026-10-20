import type { GuideLoader } from "../guides";

export interface AgentContext {
  duffelToken?: string;
  anthropicKey?: string;
  /** Google Places (New) key: real photos, ratings and reviews. Server only. */
  googleKey?: string;
  /** Reads a pre-built city guide (disk on the server, a static file in the browser). */
  loadGuide?: GuideLoader;
  /** Add small pauses so the crew animation is readable in demo mode. */
  pacing: boolean;
}

export function pause(ctx: AgentContext, ms: number) {
  if (!ctx.pacing) return Promise.resolve();
  return new Promise<void>((r) => setTimeout(r, ms * (0.8 + Math.random() * 0.4)));
}

export function nightsBetween(start: string, end: string): number {
  const ms = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}
