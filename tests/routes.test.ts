import { describe, expect, it } from "vitest";
import { airportTransfer, dayRoute, km, legFor } from "@/lib/routes";
import { act, stay } from "./fixtures";

describe("getting around", () => {
  it("measures distance between cities", () => {
    const lisbonToPorto = km({ lat: 38.7223, lng: -9.1393 }, { lat: 41.1579, lng: -8.6291 });
    expect(lisbonToPorto).toBeGreaterThan(270);
    expect(lisbonToPorto).toBeLessThan(280);
  });

  it("walks short hops and takes transit across town", () => {
    expect(legFor(0.8).mode).toBe("walk");
    expect(legFor(6).mode).toBe("transit");
    expect(legFor(40).mode).toBe("taxi");
  });

  it("routes the day from the stay, through each plan, and back", () => {
    const items = [act("a", { title: "Sé", lat: 38.7097, lng: -9.1334 }), act("b", { title: "Castle", lat: 38.7139, lng: -9.1335 })];
    const route = dayRoute(stay(), items, "Lisbon");
    expect(route.legs.map((l) => l.to)).toEqual(["Sé", "Castle", "Hotel Test"]);
    expect(route.legs.every((l) => l.mode === "walk")).toBe(true);
    expect(decodeURIComponent(route.mapsUrl)).toContain("waypoints=Sé, Lisbon|Castle, Lisbon");
    expect(route.mapsUrl).toContain("travelmode=walking");
  });

  it("still lists plans with no coordinates, without inventing times", () => {
    const route = dayRoute(stay(), [act("a")], "Lisbon");
    expect(route.legs[0].minutes).toBeUndefined();
  });

  it("estimates the airport transfer", () => {
    const t = airportTransfer({ code: "LIS", lat: 38.78, lng: -9.14 }, stay())!;
    expect(t.km).toBeGreaterThan(5);
    expect(t.taxiMinutes).toBeLessThan(t.transitMinutes);
  });
});
