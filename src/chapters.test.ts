import { describe, expect, it } from "vitest";
import { CHAPTER_COPY } from "./chapters";
import { cells, SCALES } from "./data/taxonomy";

/**
 * The chapter prose quotes the paper's figures. taxonomy.json is the source of
 * truth, so a figure in the prose that is not in the
 * JSON is either invented or has drifted from a corrected verdict. Either way
 * it must not ship: this is the one place the viz makes an unhedged claim.
 */

/** every percentage in a string: "95.7%", "~82%", "39.7%" → "95.7", "82", "39.7" */
const percentages = (text: string) =>
  [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((m) => m[1])
    .filter((v): v is string => v !== undefined);

describe("chapter prose is backed by taxonomy.json", () => {
  it.each(SCALES)("every percentage in the %s chapter appears in that scale's notes", (scale) => {
    const notes = cells
      .filter((c) => c.scale === scale)
      .map((c) => c.maturityNote)
      .join(" ");

    for (const figure of percentages(CHAPTER_COPY[scale].body)) {
      expect(notes, `${scale} chapter cites ${figure}%, absent from taxonomy.json`).toContain(
        `${figure}%`,
      );
    }
  });

  it("the Product chapter cites the label-read collapse, not a rounded version of it", () => {
    // 95.7 → 39.7 is the paper's clean-to-field penalty; 96 → 40 would be a
    // second, unsourced set of numbers.
    expect(CHAPTER_COPY.Product.body).toContain("95.7%");
    expect(CHAPTER_COPY.Product.body).toContain("39.7%");
  });

  it("every chapter has a title and a non-empty body", () => {
    for (const scale of SCALES) {
      expect(CHAPTER_COPY[scale].title).toBeTruthy();
      expect(CHAPTER_COPY[scale].body.length).toBeGreaterThan(80);
    }
  });
});
