import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cells } from "./data/taxonomy";
import { Cite, REFERENCES, ReferenceList } from "./References";

const BY_KEY = new Map(REFERENCES.map((r) => [r.key, r]));

describe("references", () => {
  it("has an entry for every citation key in the taxonomy", () => {
    const used = new Set(cells.flatMap((c) => c.citations));
    for (const key of used) expect(BY_KEY.has(key), key).toBe(true);
  });

  it("carries no reference nothing cites (regenerate references.json)", () => {
    const used = new Set(cells.flatMap((c) => c.citations));
    for (const r of REFERENCES) expect(used.has(r.key), r.key).toBe(true);
  });

  it("renders every entry as APA: authors, year in parentheses, balanced italics", () => {
    for (const r of REFERENCES) {
      expect(r.apa, r.key).toMatch(/^[A-ZÁ-Ž][^(]+ \(\d{4}[a-z]?\)\. /);
      expect(r.apa.split("*").length % 2, r.key).toBe(1);
      expect(r.short, r.key).toMatch(/^\D+, \d{4}[a-z]?$/);
    }
  });

  it("disambiguates identical in-text forms (APA 8.19)", () => {
    const shorts = REFERENCES.map((r) => r.short);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  it("shows the in-text form on the chip and the full entry in its popover", () => {
    render(<Cite citeKey="sterkensProductLabelIdentification2023" />);
    expect(screen.getByRole("button", { name: "Sterkens et al., 2023" })).toBeInTheDocument();
    expect(screen.getByText(/Product label identification with OCR/)).toBeInTheDocument();
  });

  it("lists every reference with the cells it backs", () => {
    render(<ReferenceList />);
    expect(screen.getAllByRole("listitem")).toHaveLength(REFERENCES.length);
    // Sterkens is the product-identity source in Table S1
    expect(screen.getByText("Product · Identity")).toBeInTheDocument();
  });
});
