import { describe, expect, it } from "vitest";
import { CHAPTER_COPY, FIELD_SPLIT, SCENE_DROP } from "./chapters";
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

    const { title, body } = CHAPTER_COPY[scale];
    for (const figure of percentages(`${title} ${body}`)) {
      expect(notes, `${scale} chapter cites ${figure}%, absent from taxonomy.json`).toContain(
        `${figure}%`,
      );
    }
  });

  it("draws a drop for the Product and Component scenes only", () => {
    expect(Object.keys(SCENE_DROP).sort()).toEqual(["Component", "Product"]);
  });

  it.each(["Product", "Component"] as const)(
    "every figure the %s scene draws appears in its notes",
    (scale) => {
      const drop = SCENE_DROP[scale];
      if (!drop) throw new Error(`no drop for ${scale}`);
      const notes = cells
        .filter((c) => c.scale === scale)
        .map((c) => c.maturityNote)
        .join(" ");
      expect(notes).toContain(drop.from);
      expect(notes).toContain(drop.to);
    },
  );

  it("the Product chapter cites the label-read collapse, not a rounded version of it", () => {
    // 95.7 → 39.7 is the paper's repair-to-recycler drop; 96 → 40 would be a
    // second, unsourced set of numbers.
    expect(CHAPTER_COPY.Product.title).toContain("95.7%");
    expect(CHAPTER_COPY.Product.title).toContain("39.7%");
  });

  it("every chapter has a title and a non-empty body", () => {
    for (const scale of SCALES) {
      expect(CHAPTER_COPY[scale].title).toBeTruthy();
      expect(CHAPTER_COPY[scale].body.length).toBeGreaterThan(80);
    }
  });
});

describe("the map's field split", () => {
  it("states the article's 1 measured / 3 inferred / 4 untested split of eight field-bound rows", () => {
    expect(FIELD_SPLIT).toContain("Eight of the eleven assessments have a method to test.");
    expect(FIELD_SPLIT).toContain("falls short in one assessment (product identity)");
    expect(FIELD_SPLIT).toContain(
      "is judged from indirect evidence in three, and has not been tested in four.",
    );
    expect(FIELD_SPLIT).toMatch(/field photos/i);
  });
});
