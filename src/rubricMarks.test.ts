import { describe, expect, it } from "vitest";
import { cells, splitOf } from "./data/taxonomy";
import { cellGapTexts, gapsOf, runsOf } from "./rubricMarks";

const byId = (id: string) => {
  const c = cells.find((x) => x.id === id);
  if (!c) throw new Error(`no cell ${id}`);
  return c;
};

describe("rubric marks", () => {
  it("reads the three printed marks off a plain row", () => {
    expect(runsOf(byId("product-identity"))).toEqual([
      {
        label: null,
        evidence: "B",
        basis: "measured",
        capture: "fail",
        deployed: "pass",
        completes: false,
      },
    ]);
  });

  it("ignores the prose some rows carry after the marks", () => {
    const [run] = runsOf(byId("material-identity"));
    expect(run?.evidence).toBe("B");
    expect(run?.basis).toBe("inferred");
    expect(run?.label).toBeNull();
  });

  it("splits a compound row into its two named sub-runs", () => {
    const runs = runsOf(byId("component-structure"));
    expect(runs.map((r) => r.label)).toEqual(["detect/seg", "relations"]);
    expect(runs.map((r) => r.evidence)).toEqual(["B", "N"]);
  });

  it("reads the derived row's dash as an evidence mark", () => {
    const [run] = runsOf(byId("material-quantity"));
    expect(run?.evidence).toBe("–");
    expect(run?.capture).toBe("fail");
  });

  it("yields nothing for a structurally-empty cell, which prints no gates", () => {
    expect(runsOf(byId("product-structure"))).toEqual([]);
  });

  // the whole point of the drawing: no cell's run reaches the far electrode
  it("finds no completed run anywhere in the taxonomy", () => {
    const completed = cells.flatMap(runsOf).filter((r) => r.completes);
    expect(completed).toEqual([]);
  });
});

describe("edge cases", () => {
  it("keeps a run whole when its note contains a semicolon", () => {
    const cell = { ...byId("product-quantity"), rubricMarks: "B · ✗ᵃ · ✗ (was; N · ✓ · ✓)" };
    expect(runsOf(cell)).toHaveLength(1);
  });

  it("orders a split stronger-first whatever the data order", () => {
    const base = byId("component-structure");
    const reversed = { ...base, subVerdicts: [...(base.subVerdicts ?? [])].reverse() };
    expect(splitOf(reversed)).toEqual(["Partial", "Emerging-but-narrow"]);
  });
});

// Every row's gap kinds as the paper states them (§3.2.1–3.2.3 and Table 2), in
// the paper's own order. A change to the marks or the stored kinds that moves
// any row away from the paper fails here.
const PAPER_GAPS: Record<string, string[][]> = {
  "product-identity": [["field:measured"]],
  "product-quantity": [["field:untested"]],
  "product-structure": [],
  "product-condition": [["ontology", "field:untested"]],
  "component-identity": [["field:inferred"]],
  "component-quantity": [["field:untested"]],
  "component-structure": [["field:inferred"], ["ontology", "field:untested"]],
  "component-condition": [["ontology"]],
  "material-identity": [["method", "field:inferred"]],
  "material-quantity": [["derived"]],
  "material-structure": [],
  "material-condition": [["ontology"]],
};

describe("gap kinds", () => {
  it.each(Object.entries(PAPER_GAPS))("%s carries the paper's gaps", (id, expected) => {
    const got = gapsOf(byId(id)).map((row) =>
      row.gaps.map((g) => (g.kind === "field" ? `field:${g.basis}` : g.kind)),
    );
    expect(got).toEqual(expected);
  });
});

describe("the matrix's gap words", () => {
  it("joins a compound cell's field gaps into one phrase, after the other kinds", () => {
    expect(cellGapTexts(byId("component-structure"))).toEqual([
      "no shared taxonomy yet",
      "likely short or not tried on field photos",
    ]);
    expect(cellGapTexts(byId("product-identity"))).toEqual(["fell short on field photos"]);
    expect(cellGapTexts(byId("product-structure"))).toEqual([]);
    // the paper's method gap is only the composition a camera cannot see
    expect(cellGapTexts(byId("material-identity"))).toEqual([
      "no method for what's hidden",
      "likely short on field photos",
    ]);
  });
});
