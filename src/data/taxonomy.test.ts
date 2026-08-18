import { describe, expect, it } from "vitest";
import { runsOf } from "../rubricMarks";
import { cellAt, cells, INFO_TYPES, SCALES, taxonomy, VERDICT_LETTER } from "./taxonomy";
import type { SourceStatus, Verdict } from "./types";

const VERDICTS: Verdict[] = [
  "Strong",
  "Partial",
  "Emerging-but-narrow",
  "Plausible-but-unvalidated",
  "Absent",
];
const SOURCE_STATUSES: SourceStatus[] = ["Published", "Preprint", "Mixed", "n/a"];
// bibtex-style key: lowercase author, CamelCase title words, 4-digit year, optional a/b suffix
const CITE_KEY = /^[a-z][A-Za-z0-9]*\d{4}[a-z]?$/;

// every verdict the JSON asserts: top-level cells *and* compound sub-verdicts
const allMaturities = cells.flatMap((c) => [
  c.maturity,
  ...(c.subVerdicts?.map((s) => s.maturity) ?? []),
]);

describe("taxonomy data layer (mirrors Paper 2 Table S2)", () => {
  it("covers the full 3x4 grid exactly once", () => {
    expect(SCALES.length * INFO_TYPES.length).toBe(12);
    expect(cells).toHaveLength(12);
    for (const scale of SCALES) {
      for (const info of INFO_TYPES) {
        const matches = cells.filter((c) => c.scale === scale && c.informationType === info);
        expect(matches, `${scale}·${info}`).toHaveLength(1);
      }
    }
  });

  it("every verdict (cell and sub-verdict) is one of the paper's five rubric levels", () => {
    for (const m of allMaturities) expect(VERDICTS).toContain(m);
  });

  it("no cell or sub-verdict claims Strong (the paper's finding: nothing reaches Strong under EoL capture)", () => {
    expect(allMaturities).not.toContain("Strong");
  });

  it("every sourceStatus is one of the four allowed values (the citation-gate depends on the exact string)", () => {
    for (const c of cells) expect(SOURCE_STATUSES, c.id).toContain(c.sourceStatus);
  });

  it("the letter map is the source-of-truth legend, not a hand-kept duplicate", () => {
    for (const m of taxonomy.meta.maturityLevels) expect(VERDICT_LETTER[m.verdict]).toBe(m.letter);
  });

  it("the two Structure cells at Product and Material scale are structurally empty", () => {
    expect(cellAt("Product", "Structure")?.structurallyEmpty).toBe(true);
    expect(cellAt("Material", "Structure")?.structurallyEmpty).toBe(true);
  });

  it("Component·Structure carries both sub-verdicts (detect/seg Partial, BoC relations Emerging-but-narrow)", () => {
    const c = cellAt("Component", "Structure");
    expect(c?.subVerdicts?.map((s) => s.maturity)).toEqual(["Partial", "Emerging-but-narrow"]);
  });

  it("Material·Quantity is Absent (derived)", () => {
    expect(cellAt("Material", "Quantity")?.maturity).toBe("Absent");
  });

  it("every populated cell has rubric marks and at least one well-formed citation key", () => {
    for (const c of cells) {
      expect(c.rubricMarks, c.id).toBeTruthy();
      if (!c.structurallyEmpty && c.sourceStatus !== "n/a") {
        expect(c.citations.length, c.id).toBeGreaterThan(0);
      }
      for (const key of c.citations) expect(key, `${c.id}: "${key}"`).toMatch(CITE_KEY);
    }
  });

  it("every non-empty cell's rubricMarks parse into at least one run (a malformed ladder string parses to none)", () => {
    for (const c of cells) {
      if (c.structurallyEmpty) continue;
      expect(runsOf(c).length, `${c.id}: "${c.rubricMarks}"`).toBeGreaterThan(0);
    }
  });

  it("exposes the five-level maturity legend", () => {
    expect(taxonomy.meta.maturityLevels.map((m) => m.verdict)).toEqual(VERDICTS);
  });
});
