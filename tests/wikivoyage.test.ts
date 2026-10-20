import { describe, expect, it } from "vitest";
import { listingActivities, listingStays, parseListings } from "@/lib/providers/wikivoyage";
import { req } from "./fixtures";

const wikitext = `
==See==
* {{see | name=Palácio da Bolsa | lat=41.141 | long=-8.615 | price=€12 adults | wikidata=Q1371109
| content=It was built in the 19th century and has a spectacular [[Arab Room]]. }}
* {{see | name=Wine Festival | content=An annual festival held every December with tastings. }}
==Sleep==
===Budget===
* {{sleep | name=Happy Hostel | price=Dorms €15 | content=Friendly hostel with bunk beds. }}
* {{sleep | name=Casa Azul | lat=41.15 | long=-8.61 | content=Small guesthouse with breakfast and a terrace. }}
===Splurge===
* {{sleep | name=The Grand Palace Hotel | content=Five-star hotel in a restored palace. }}
`;

describe("Wikivoyage listings", () => {
  const listings = parseListings(wikitext, "Porto", "Porto");

  it("reads names, plain-text descriptions, prices, coordinates and Wikidata ids", () => {
    const bolsa = listings.find((l) => l.name === "Palácio da Bolsa")!;
    expect(bolsa.type).toBe("see");
    expect(bolsa.content).toContain("Arab Room"); // [[link]] markup removed
    expect(bolsa.content).not.toContain("[[");
    expect(bolsa.lat).toBeCloseTo(41.141);
    expect(bolsa.wikidata).toBe("Q1371109");
  });

  it("takes each hotel's price tier from the heading above it", () => {
    expect(listings.find((l) => l.name === "Casa Azul")?.tier).toBe("budget");
    expect(listings.find((l) => l.name === "The Grand Palace Hotel")?.tier).toBe("splurge");
  });

  it("skips festivals (they only happen on certain dates)", () => {
    const acts = listingActivities(listings, "Portugal");
    expect(acts.map((a) => a.title)).toEqual(["Palácio da Bolsa"]);
    expect(acts[0].price).toBe(13);
  });

  it("skips hostels and prices splurge hotels above budget ones", () => {
    const stays = listingStays(listings, req, 4, "Portugal", 120);
    expect(stays.map((s) => s.name)).not.toContain("Happy Hostel");
    const azul = stays.find((s) => s.name === "Casa Azul")!;
    const grand = stays.find((s) => s.name === "The Grand Palace Hotel")!;
    expect(grand.nightlyPrice).toBeGreaterThan(azul.nightlyPrice * 2);
    expect(azul.perks).toEqual(expect.arrayContaining(["Breakfast", "Terrace"]));
  });
});
