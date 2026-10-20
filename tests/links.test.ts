import { describe, expect, it } from "vitest";
import { flightAirport } from "@/lib/airports";
import { flightLinks, stayLinks } from "@/lib/links";
import { flight, plan, stay } from "./fixtures";

const url = (links: { label: string; url: string }[], label: string) => decodeURIComponent(links.find((l) => l.label === label)?.url ?? "");

describe("booking links", () => {
  it("filters real nonstop fares by stops and airline", () => {
    const links = flightLinks(plan(), flight({ carrierCode: "TP", flightNumbers: ["TP218"] }));
    expect(url(links, "Google Flights")).toContain("nonstop on TAP Air Portugal");
    expect(url(links, "Kayak")).toContain("stops=0;airlines=TP");
    expect(links.some((l) => l.label === "Flight TP218 details")).toBe(true);
  });

  it("never applies a sample fare's made-up stops or airline", () => {
    const links = flightLinks(plan(), flight({ sample: true, carrier: "Bluebird Air" }));
    expect(url(links, "Google Flights")).not.toContain("nonstop");
    expect(url(links, "Google Flights")).not.toContain("Bluebird");
    expect(links.some((l) => l.label.startsWith("Flight "))).toBe(false);
  });

  it("searches the airport flights really use (Noida -> Delhi)", () => {
    expect(flightAirport("DXN")).toBe("DEL");
    expect(flightAirport("lis")).toBe("LIS");
  });

  it("checks in the day after an overnight flight lands", () => {
    expect(url(stayLinks(plan(), stay(), flight({ arriveNextDay: true })), "Booking.com")).toContain("checkin=2026-12-02");
  });
});
