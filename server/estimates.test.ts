import { describe, expect, it } from "vitest";
import { nameToSlug } from "./db";

/** Helper: today's date as MMDD */
function todayDateSuffix(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${mm}${dd}`;
}

describe("nameToSlug", () => {
  const ds = todayDateSuffix();

  it("produces company-customer-MMDD slug", () => {
    expect(nameToSlug("John Jones", "John", "Jones", "See Towing")).toBe(
      `see-towing-john-jones-${ds}`
    );
  });

  it("falls back to full name when first/last not provided", () => {
    expect(nameToSlug("Dylan", undefined, undefined, "BathPros")).toBe(
      `bathpros-dylan-${ds}`
    );
  });

  it("works without company name", () => {
    expect(nameToSlug("Dylan", "Dylan", "Jones")).toBe(`dylan-jones-${ds}`);
  });

  it("strips punctuation", () => {
    expect(nameToSlug("O'Brien Patrick", "Patrick", "O'Brien", "Bob's Co")).toBe(
      `bobs-co-patrick-obrien-${ds}`
    );
  });

  it("collapses multiple spaces and hyphens", () => {
    expect(nameToSlug("Fort  Myers  Beach", undefined, undefined, "My  Company")).toBe(
      `my-company-fort-myers-beach-${ds}`
    );
  });

  it("trims leading and trailing whitespace", () => {
    expect(nameToSlug("  Cape Coral  ", undefined, undefined, "  Test Co  ")).toBe(
      `test-co-cape-coral-${ds}`
    );
  });

  it("lowercases everything", () => {
    expect(nameToSlug("NAPLES FL", "NAPLES", "FL", "BIG CO")).toBe(
      `big-co-naples-fl-${ds}`
    );
  });
});

describe("estimates router (unit)", () => {
  it("nameToSlug produces URL-safe output with no double hyphens", () => {
    const slug = nameToSlug("Sand Springs Development, Dylan", undefined, undefined, "My Company");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug).not.toContain(" ");
    expect(slug).not.toContain(",");
    expect(slug).not.toContain("--");
  });

  it("slug ends with 4-digit MMDD only", () => {
    const slug = nameToSlug("John Smith", "John", "Smith", "Acme");
    expect(slug).toMatch(/-\d{4}$/);
  });
});
