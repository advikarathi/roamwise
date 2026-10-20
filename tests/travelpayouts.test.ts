import { afterEach, describe, expect, it, vi } from "vitest";
import { flightLinks } from "@/lib/links";
import { travelpayoutsFlights } from "@/lib/providers/travelpayouts";
import { plan, req } from "./fixtures";

const ticket = (over: Record<string, unknown>) => ({
  origin: "BOS", destination: "LIS", price: 450, airline: "TP", flight_number: 218, transfers: 0,
  departure_at: "2026-12-01T18:40:00-05:00", return_at: "2026-12-05T11:00:00+00:00", duration_to: 410, duration: 860,
  link: "/search/BOS0112LIS05121?t=TP17646321001764667800000410BOSLIS_abc", ...over,
});

function respond(data: unknown[]) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data, currency: "usd" }), { status: 200 })));
}

afterEach(() => vi.unstubAllGlobals());

describe("Travelpayouts real fares", () => {
  it("keeps only fares on the trip's exact dates", async () => {
    respond([ticket({}), ticket({ departure_at: "2026-12-02T18:40:00-05:00", price: 300 })]);
    const flights = await travelpayoutsFlights(req, "token");
    expect(flights).toHaveLength(1);
    expect(flights[0].price).toBe(900); // $450 per adult x 2 travelers
  });

  it("carries the real airline, flight number and an exact-fare link, and never guesses the landing time", async () => {
    respond([ticket({})]);
    const [f] = await travelpayoutsFlights(req, "token", "12345");
    expect(f.carrier).toBe("TAP Air Portugal");
    expect(f.flightNumbers).toEqual(["TP218"]);
    expect(f.departTime).toBe("18:40");
    expect(f.arriveTime).toBe("");
    expect(f.recentFare).toBe(true);
    expect(f.bookingUrl).toBe("https://www.aviasales.com/search/BOS0112LIS05121?t=TP17646321001764667800000410BOSLIS_abc&marker=12345");
    const links = flightLinks(plan(), f);
    expect(links[0].label).toBe("This exact fare (Aviasales)");
  });

  it("labels cheapest, best value and fastest from different fares", async () => {
    respond([
      ticket({ price: 400, transfers: 1, duration_to: 900, flight_number: 1 }),
      ticket({ price: 700, transfers: 0, duration_to: 400, flight_number: 2 }), // fastest, but pricey
      ticket({ price: 460, transfers: 1, duration_to: 600, flight_number: 3 }),
    ]);
    const flights = await travelpayoutsFlights(req, "token");
    expect(flights.map((f) => `${f.label}:${f.flightNumbers?.[0]}`)).toEqual(["Cheapest:TP1", "Best value:TP3", "Fastest:TP2"]);
  });

  it("returns nothing when no one has searched those dates recently", async () => {
    respond([]);
    expect(await travelpayoutsFlights(req, "token")).toEqual([]);
  });
});
