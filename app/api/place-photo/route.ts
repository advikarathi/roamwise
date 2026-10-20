// GET /api/place-photo?ref=places/<id>/photos/<id>  — redirects to a Google Places photo.
// Keeps the API key on the server; the page only ever sees this URL.
import { resolvePhoto } from "@/lib/providers/google";
import { allow, CAPS, visitor, withinDailyCap } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Google's photo links last a while; remember them so repeat views don't cost another call.
const resolved = new Map<string, { at: number; url: string }>();
const HOUR = 3_600_000;

export async function GET(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  if (!key || !/^places\/[\w-]+\/photos\/[\w-]+$/.test(ref)) return new Response("Not found", { status: 404 });

  const hit = resolved.get(ref);
  let url = hit && Date.now() - hit.at < HOUR ? hit.url : undefined;
  if (!url) {
    // Each new photo is a paid Google call: cap per visitor and per day.
    if (!allow(`photo:${visitor(request)}`, CAPS.photosPerHour, 3_600_000) || !withinDailyCap("google-photo", CAPS.googlePhotosPerDay)) {
      return new Response("Photo limit reached", { status: 429 });
    }
    url = await resolvePhoto(ref, key).catch(() => undefined);
    if (!url) return new Response("Photo unavailable", { status: 502 });
    if (resolved.size > 2000) resolved.delete(resolved.keys().next().value!);
    resolved.set(ref, { at: Date.now(), url });
  }
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "public, max-age=3000" } });
}
