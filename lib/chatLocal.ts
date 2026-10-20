// Answers common trip questions straight from the plan, with no AI call. Used when there's no
// Anthropic key, or if the AI is unavailable, so the assistant always says something useful.
import { isWetDay } from "./extras";
import { activityMap, mapsDirections } from "./links";
import type { TripSnapshot } from "./tripText";
import type { Activity } from "./types";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const list = (xs: Activity[], travelers: number) =>
  xs.map((a) => `• ${a.title}${a.price ? ` (${money(a.price * travelers)})` : " (free)"}`).join("\n");

export function localAnswer(question: string, s: TripSnapshot): string {
  const q = question.toLowerCase();
  const { plan, flight, stay, schedule } = s;
  const r = plan.request;
  const scheduled = schedule.flat();
  const everything = [...scheduled, ...s.otherIdeas];
  const has = (re: RegExp) => re.test(q);

  // "What's on day 3?" / "first day" / "last day"
  const dayNum = q.match(/day\s*(\d+)/)?.[1];
  const which = dayNum ? Number(dayNum) - 1 : has(/first day|arriv/) ? 0 : has(/last day|final day|leav/) ? schedule.length - 1 : -1;
  if (which >= 0 && which < schedule.length && !has(/flight|plane/)) {
    const day = schedule[which];
    return day.length
      ? `Day ${which + 1}:\n${list(day, r.travelers)}\n\nWant to change it? Tap "Edit days" to move or remove plans.`
      : `Day ${which + 1} is free so far. Swipe right on a few ideas, or tap "Edit days" to add your own.`;
  }
  if (has(/\b(hi|hello|hey|hola)\b/) && q.length < 20) {
    return `Hi! Ask me anything about your ${plan.destinationName} trip: your days, flight, hotel, budget, weather or what to eat.`;
  }
  if (has(/flight|fly|plane|airline|depart|land|airport/) && !has(/get (from|to)|transfer|taxi|train|bus/)) {
    return `You're flying ${flight.carrier}: ${flight.origin} at ${flight.departTime} → ${flight.destination} at ${flight.arriveTime}${flight.arriveNextDay ? " the next day" : ""}, ${flight.stops === 0 ? "nonstop" : `with a stop in ${flight.via}`}. It's ${money(flight.price)} round trip for ${r.travelers === 1 ? "you" : `all ${r.travelers} of you`}.`;
  }
  if (has(/hotel|stay|room|apartment|check.?in|where.*sleep|accommodation/)) {
    return `You're staying at ${stay.name} in ${stay.neighborhood}${stay.address ? ` (${stay.address})` : ""}: ${money(stay.nightlyPrice)} a night, ${money(stay.totalPrice)} total.${stay.rating ? ` It's rated ${stay.rating} on Google.` : ""} Tap "Show another stay" to compare ${plan.stays.length - 1} other options.`;
  }
  if (has(/budget|cost|total|spend|price|expensive|afford|cheap|money|over/)) {
    const over = s.total - r.budget;
    const breakdown = s.lines.map((l) => `• ${l.category}: ${money(l.actual)}`).join("\n");
    const free = everything.filter((a) => a.price === 0).slice(0, 4);
    return `${over > 0 ? `You're ${money(over)} over your ${money(r.budget)} budget.` : `You're at ${money(s.total)}, ${money(-over)} under budget.`}\n${breakdown}${over > 0 ? `\n\nTo save: try "Make it cheaper", pick the Cheapest fare, or swap in free plans like:\n${list(free, r.travelers)}` : ""}`;
  }
  if (has(/weather|rain|hot|cold|temperature|pack|wear|umbrella/)) {
    const days = s.weather ?? [];
    if (!days.length) return "The forecast isn't out yet for your dates. Check back closer to the trip; I'll flag rainy days and move outdoor plans.";
    const wet = days.filter(isWetDay).length;
    const hi = Math.max(...days.map((d) => d.highF)), lo = Math.min(...days.map((d) => d.lowF));
    return `Expect highs up to ${hi}°F and lows around ${lo}°F.${wet ? ` ${wet} day${wet > 1 ? "s look" : " looks"} rainy, so pack an umbrella; I've kept outdoor plans off those days where I could.` : " It looks mostly dry."} Pack layers and comfortable walking shoes.`;
  }
  if (has(/indoor|rainy day|if it rains/)) {
    const indoor = everything.filter((a) => a.indoor).slice(0, 6);
    return indoor.length ? `Good rainy-day picks:\n${list(indoor, r.travelers)}` : "I don't have indoor picks for this city yet; museums and food markets are usually safe bets.";
  }
  if (has(/eat|food|restaurant|dinner|lunch|breakfast|hungry|cuisine|dish/)) {
    const onPlan = scheduled.filter((a) => a.vibe === "food");
    const more = s.otherIdeas.filter((a) => a.vibe === "food").slice(0, 5);
    return `${onPlan.length ? `Food on your plan:\n${list(onPlan, r.travelers)}\n\n` : ""}${more.length ? `More to try:\n${list(more, r.travelers)}` : "Swipe through the Food filter in Things to do for more."}`;
  }
  if (has(/night|bar|drink|club|party|music/)) {
    const nights = everything.filter((a) => a.vibe === "nightlife").slice(0, 6);
    return nights.length ? `For a night out:\n${list(nights, r.travelers)}` : "No nightlife picks yet. Try asking the crew for \"more nightlife\".";
  }
  if (has(/free|no cost/)) {
    const free = everything.filter((a) => a.price === 0).slice(0, 8);
    return free.length ? `Free things to do:\n${list(free, r.travelers)}` : "Everything on the list has a small cost, but walking the old town and city viewpoints are usually free.";
  }
  if (has(/get (from|to|around)|transport|taxi|uber|train|metro|bus|transfer/)) {
    return `From the airport to ${stay.name}, here are transit directions: ${mapsDirections(`${r.destination} airport`, `${stay.name}, ${plan.destinationName}`)}\nI've set aside ${money(plan.transitEstimate)} for getting around.`;
  }
  // A place they named?
  const named = everything.find((a) => q.includes(a.title.toLowerCase().slice(0, 14)));
  if (named) {
    return `${named.title}: ${named.blurb}${named.price ? ` About ${money(named.price)} per person.` : " Free."}${named.address ? `\n${named.address}` : ""}\nMap: ${activityMap(plan, named)}`;
  }
  return `I can help with your days, flight, hotel, budget, weather, food, nightlife and getting around in ${plan.destinationName}. Try "What's on day 2?" or "Where should we eat?"`;
}
