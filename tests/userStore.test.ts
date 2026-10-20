import { describe, expect, it } from "vitest";
import { deleteTrip, getTrip, listTrips, saveTrip, tripIdFor, type AccountTrip } from "@/lib/userStore";
import { plan } from "./fixtures";

// No Upstash env in tests, so this runs against the in-memory store with the same code paths.
const trip = (over: Partial<AccountTrip> = {}): AccountTrip => ({
  id: tripIdFor("LIS", "2026-12-01"), code: "LIS", city: "Lisbon", country: "Portugal", color: "#f00",
  startDate: "2026-12-01", endDate: "2026-12-05", total: 2500, savedAt: 1, plan: plan(),
  keeps: ["a", "b"], edits: { layout: [["a"], ["b"]], dropped: [], custom: [] }, ...over,
});

describe("account trips", () => {
  it("saves, lists (as summaries), reopens in full, and deletes", async () => {
    await saveTrip("github:1", trip());
    const list = await listTrips("github:1");
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("plan"); // the list stays light
    const full = await getTrip("github:1", list[0].id);
    expect(full?.keeps).toEqual(["a", "b"]);
    expect(full?.edits.layout).toEqual([["a"], ["b"]]);
    await deleteTrip("github:1", list[0].id);
    expect(await listTrips("github:1")).toEqual([]);
  });

  it("keeps each user's trips separate", async () => {
    await saveTrip("github:2", trip());
    expect(await listTrips("google:3")).toEqual([]);
  });

  it("re-saving the same destination and dates updates instead of duplicating", async () => {
    await saveTrip("github:4", trip({ total: 1000 }));
    await saveTrip("github:4", trip({ total: 1200, savedAt: 2 }));
    const list = await listTrips("github:4");
    expect(list).toHaveLength(1);
    expect(list[0].total).toBe(1200);
  });

  it("caps an account at 50 trips", async () => {
    for (let i = 0; i < 50; i++) await saveTrip("github:5", trip({ id: `T${i}` }));
    expect(await saveTrip("github:5", trip({ id: "T50" }))).toBe(false);
    expect(await saveTrip("github:5", trip({ id: "T3", total: 9 }))).toBe(true); // updating is fine
  });
});
