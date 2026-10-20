import { describe, expect, it } from "vitest";
import { usdAmounts } from "@/lib/providers/wikivoyage";

describe("price parsing", () => {
  it("converts listed currencies to USD", () => {
    expect(usdAmounts("€12 adults, €7.5 concessions")).toEqual([13, 8]);
    expect(usdAmounts("¥1,200")).toEqual([8]);
  });

  it("treats free as zero", () => expect(usdAmounts("Free entry")).toEqual([0]));

  it("ignores group sizes, durations, times and years", () => {
    expect(usdAmounts("2-6 people, €40 per room")).toEqual([43]);
    expect(usdAmounts("Open 09:00-18:30, €10, renovated 2019")).toEqual([11]);
  });

  it("uses the country's currency when none is written", () => expect(usdAmounts("1500", 0.0067)).toEqual([10]));
});
