import { describe, expect, it } from "vitest";
import { affectedAgents, parseChange } from "@/lib/agents/revise";

describe("change requests", () => {
  it("reads several changes from one sentence", () => {
    const kinds = parseChange("make it cheaper and nonstop please").map((c) => c.kind);
    expect(kinds).toEqual(expect.arrayContaining(["cheaper", "nonstop"]));
  });

  it("reads a new budget", () => {
    expect(parseChange("$2,000 budget")).toContainEqual({ kind: "budget", amount: 2000 });
  });

  it("wakes only the agents a change affects", () => {
    expect(affectedAgents([{ kind: "nonstop" }])).not.toContain("activities");
  });
});
