import { describe, expect, it } from "vitest";
import { localAnswer } from "@/lib/chatLocal";
import type { TripSnapshot } from "@/lib/tripText";
import { act, flight, plan, stay } from "./fixtures";

const snap: TripSnapshot = {
  plan: plan(), flight: flight(), stay: stay(),
  schedule: [[act("a", { title: "Tile museum" })], [act("b", { title: "Seafood dinner", vibe: "food", price: 40 })]],
  lines: [{ category: "flights", target: 1200, actual: 900 }, { category: "stay", target: 1260, actual: 600 }],
  total: 1500,
  otherIdeas: [act("c", { title: "Fado night", vibe: "nightlife" })],
};

describe("built-in chat answers", () => {
  it("answers what's on a given day", () => expect(localAnswer("what's on day 2?", snap)).toContain("Seafood dinner"));
  it("answers flight questions", () => expect(localAnswer("when do we land?", snap)).toContain("TAP Air Portugal"));
  it("answers budget questions", () => expect(localAnswer("are we over budget?", snap)).toContain("under budget"));
  it("suggests nightlife from the wider deck", () => expect(localAnswer("any bars?", snap)).toContain("Fado night"));
});
