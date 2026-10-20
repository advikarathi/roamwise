import { describe, expect, it } from "vitest";
import { allocate, budgetLines, chooseCore } from "@/lib/agents/budget";
import { act, flight, req, stay } from "./fixtures";

describe("budget agent", () => {
  it("splits the budget into targets that add up to the total", () => {
    const t = allocate(3000);
    expect(t.flights + t.stay + t.activities + t.transit).toBe(3000);
    expect(t.flights).toBe(1200);
  });

  it("picks a flight and stay that fit, keeping money back for activities", () => {
    const flights = [flight({ id: "cheap", label: "Cheapest", price: 700 }), flight({ id: "best", price: 1000 })];
    const stays = [stay({ id: "lux", totalPrice: 2500 }), stay({ id: "ok", totalPrice: 1200 })];
    const pick = chooseCore(req, flights, stays, 100);
    expect(pick.fits).toBe(true);
    expect(pick.stay.id).toBe("ok"); // the luxury stay can't fit with any flight
  });

  it("flags it when nothing fits, offering the cheapest of each", () => {
    const pick = chooseCore({ ...req, budget: 500 }, [flight({ price: 900 })], [stay({ totalPrice: 600 })], 50);
    expect(pick.fits).toBe(false);
  });

  it("charges activities per traveler", () => {
    const lines = budgetLines(req, flight(), stay(), [act("a", { price: 20 })], 0);
    expect(lines.find((l) => l.category === "activities")?.actual).toBe(40);
  });
});
