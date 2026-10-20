import { describe, expect, it } from "vitest";
import { NO_EDITS, scheduleFor } from "@/components/trip/Itinerary";
import { act } from "./fixtures";

const ids = (grid: { id: string }[][]) => grid.map((d) => d.map((a) => a.id));
const dates = ["2026-12-01", "2026-12-02", "2026-12-03"];

describe("day plan", () => {
  const kept = [act("a", { timeOfDay: "morning" }), act("b"), act("c", { timeOfDay: "evening" }), act("d")];

  it("places every kept plan exactly once", () => {
    const grid = scheduleFor(kept, 3, [], NO_EDITS, dates);
    expect(ids(grid).flat().sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("follows the traveler's layout once they move things", () => {
    const grid = scheduleFor(kept, 3, [], { layout: [["d"], ["c", "b"], ["a"]], dropped: [], custom: [] }, dates);
    expect(ids(grid)).toEqual([["d"], ["c", "b"], ["a"]]);
  });

  it("keeps removed plans off and adds custom ones", () => {
    const custom = act("custom-1", { title: "Dinner with Ana" });
    const grid = scheduleFor(kept, 3, [], { layout: [["a", "custom-1"], ["b"], ["c"]], dropped: ["d"], custom: [custom] }, dates);
    expect(ids(grid)).toEqual([["a", "custom-1"], ["b"], ["c"]]);
  });

  it("puts newly kept plans on the lightest day", () => {
    const grid = scheduleFor(kept, 3, [], { layout: [["a", "b"], ["c"], []], dropped: [], custom: [] }, dates);
    expect(ids(grid)[2]).toContain("d");
  });

  it("pins dated events to their day, in time-of-day order", () => {
    const event = act("ev-1", { date: "2026-12-02", timeOfDay: "evening" });
    const grid = scheduleFor([...kept, event], 3, [], NO_EDITS, dates);
    expect(ids(grid)[1]).toContain("ev-1");
    expect(ids(grid)[1].at(-1)).toBe("ev-1");
  });
});
