// POST /api/chat  { messages: [{role, content}], brief }  ->  { reply } | { fallback: true }
// The trip assistant. With ANTHROPIC_API_KEY it asks Claude, briefed on this exact trip.
// Without a key (or if the call fails) it answers { fallback: true } and the page uses the
// built-in answers in lib/chatLocal.ts instead.
import Anthropic from "@anthropic-ai/sdk";
import { allow, CAPS, visitor } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are Roamwise's trip assistant, chatting with a traveler about the trip they just planned.
The trip details below are the source of truth: flights, stay, prices, and the day-by-day schedule (including any edits they made).
Answer in a friendly, concise way: a few short sentences or a short list. Use plain text, no markdown headings or tables.
Use the trip details for anything about their plan. For general travel questions (customs, tipping, neighborhoods, safety, what to pack, local dishes) use your own knowledge of the destination, and say when something is worth double-checking (opening hours, visa rules, ticket prices change).
Never invent bookings, confirmation numbers, or exact prices that aren't in the trip details. Prices in the plan are estimates unless marked live.
To change the plan, tell them how: "Edit days" moves, removes or adds plans; "Ask the crew for a change" can make it cheaper, nonstop, fancier, or add a beach day; the fare tabs and "Show another stay" swap the flight or hotel.
If a question has nothing to do with travel or this trip, gently steer back to the trip.`;

// Server-side fallbacks (re-run on another model if one declines) work on these models.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

interface ChatTurn { role: "user" | "assistant"; content: string }

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  // No key, or this visitor is chatting a lot: answer from the plan instead (free).
  if (!key || !allow(`chat:${visitor(request)}`, CAPS.chatsPerHour, 3_600_000)) return Response.json({ fallback: true });

  let body: { messages?: ChatTurn[]; brief?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }

  // Keep the last few turns, alternating and starting with the traveler.
  const turns = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") return Response.json({ error: "Ask a question first." }, { status: 400 });

  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  const client = new Anthropic({ apiKey: key });
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      // Chat answers are short and quick; low effort keeps them fast and cheap.
      output_config: { effort: "low" },
      ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
      system: [
        { type: "text", text: SYSTEM },
        // The trip brief stays the same across a conversation, so cache it.
        { type: "text", text: `Trip details:\n${String(body.brief ?? "").slice(0, 30000)}`, cache_control: { type: "ephemeral" } },
      ],
      messages: turns,
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal") {
      return Response.json({ reply: "Sorry, I can't help with that one. Ask me anything about your trip!" });
    }
    const reply = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return reply ? Response.json({ reply }) : Response.json({ fallback: true });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) console.error("Chat: ANTHROPIC_API_KEY was rejected.");
    else if (err instanceof Anthropic.RateLimitError) console.error("Chat: rate limited by Anthropic.");
    else if (err instanceof Anthropic.APIError) console.error(`Chat: Anthropic API error ${err.status}: ${err.message}`);
    else console.error(err);
    return Response.json({ fallback: true });
  }
}
