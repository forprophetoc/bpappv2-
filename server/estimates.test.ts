import { describe, expect, it } from "vitest";
import { nameToSlug } from "./db";

describe("nameToSlug", () => {
  it("converts a simple name to a slug", () => {
    expect(nameToSlug("Dylan")).toBe("dylan");
  });

  it("handles 'Last, First' format", () => {
    expect(nameToSlug("Sand Springs Development, Dylan")).toBe("sand-springs-development-dylan");
  });

  it("strips punctuation and commas", () => {
    expect(nameToSlug("O'Brien, Patrick")).toBe("obrien-patrick");
  });

  it("collapses multiple spaces and hyphens", () => {
    expect(nameToSlug("Fort  Myers  Beach")).toBe("fort-myers-beach");
  });

  it("trims leading and trailing whitespace", () => {
    expect(nameToSlug("  Cape Coral  ")).toBe("cape-coral");
  });

  it("lowercases everything", () => {
    expect(nameToSlug("NAPLES FL")).toBe("naples-fl");
  });
});

describe("estimates router (unit)", () => {
  it("nameToSlug produces URL-safe output", () => {
    const slug = nameToSlug("Sand Springs Development, Dylan");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug).not.toContain(" ");
    expect(slug).not.toContain(",");
    expect(slug).not.toContain("--");
  });
});
