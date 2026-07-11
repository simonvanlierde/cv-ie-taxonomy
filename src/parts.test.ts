import { describe, expect, it } from "vitest";
import { cells } from "./data/taxonomy";
import { PART_OF_CELL, type PartKey } from "./parts";

const KEYS: PartKey[] = ["fg", "bl", "rg", "mo", "nk", "ba"];

describe("PART_OF_CELL", () => {
  it("maps every taxonomy cell to a (possibly empty) list of valid part keys", () => {
    for (const c of cells) {
      const parts = PART_OF_CELL[c.id];
      expect(parts, `parts for ${c.id}`).toBeDefined();
      for (const p of parts ?? []) expect(KEYS).toContain(p);
    }
  });
});
