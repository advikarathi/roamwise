// POST /api/email  { to, subject, html, text }  ->  { sent: true } | { fallback: true } | { error }
// Sends the trip plan through Resend (https://resend.com) when RESEND_API_KEY is set.
// Without a key it answers { fallback: true }, and the page opens the traveler's own mail app instead.
import { allow, visitor } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// A little protection against someone using this endpoint to spam: a few sends per address and visitor per hour.
const allowed = (key: string) => allow(`email:${key}`, 5, 3_600_000);

export async function POST(request: Request) {
  let body: { to?: string; subject?: string; html?: string; text?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "Bad request" }, { status: 400 }); }

  const to = String(body.to ?? "").trim().toLowerCase();
  if (!EMAIL.test(to)) return Response.json({ error: "That email address doesn't look right." }, { status: 400 });
  const key = process.env.RESEND_API_KEY;
  if (!key) return Response.json({ fallback: true });

  const ip = visitor(request);
  if (!allowed(to) || !allowed(`ip:${ip}`)) return Response.json({ error: "That's a lot of emails. Try again in a bit." }, { status: 429 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Resend's shared test sender works without a domain, but only delivers to your own Resend
      // account's address. Verify a domain in Resend and set RESEND_FROM to send to anyone.
      from: process.env.RESEND_FROM || "Roamwise <onboarding@resend.dev>",
      to: [to],
      subject: String(body.subject ?? "Your trip plan").slice(0, 200),
      html: String(body.html ?? "").slice(0, 400_000),
      text: String(body.text ?? "").slice(0, 100_000),
    }),
  });
  if (!res.ok) {
    console.error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return Response.json({ error: "Couldn't send the email right now. Try the mail app option instead." }, { status: 502 });
  }
  return Response.json({ sent: true });
}
