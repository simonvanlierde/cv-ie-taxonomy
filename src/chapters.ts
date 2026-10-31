import { cells } from "./data/taxonomy";
import type { Scale } from "./data/types";
import { runsOf } from "./rubricMarks";

/**
 * The narrative rail's prose, one chapter per physical scale. The title is the
 * chapter's one claim.
 *
 * Unlike the fan overlays, this prose is NOT illustrative — every figure in it
 * is a claim the paper makes. So each percentage must appear verbatim in the
 * corresponding cell's `maturityNote` in taxonomy.json, which is the source of
 * truth; `chapters.test.ts` enforces exactly that. Round a figure for readability
 * and the test fails, which is the point: the JSON moves first, then this file.
 */
export const CHAPTER_COPY: Record<Scale, { title: string; body: string }> = {
  Product: {
    title: "Label reading drops from 95.7% at repair to 39.7% at the recycler.",
    body: "A model number can link a used appliance to information in a product database. But a worn, dirty or badly angled label is harder to read. Both figures count photos in which a label was visible. They come from washing-machine studies by one research group, including repair photos taken by customers on their phones. This is the closest task to routine use. A person still needs to check each result.",
  },
  Component: {
    title: "To take a product apart, we need to know how its parts are attached.",
    body: "Software can find and outline parts in teardown photos taken in a lab or on a fixed camera rig. Tests in working repair shops are still missing. Connections need a different kind of evidence: agreed labels for attachment types and photos showing which parts connect. The review found neither. Methods that infer joints have been tried on jointed household objects and toy vehicles. Their accuracy falls from ~82% to ~39% on new objects of the same kinds.",
  },
  Material: {
    title: "A photo shows the surface. Recovery depends on what lies underneath, too.",
    body: "Under controlled conditions, software can often recognise a material on the surface of a part. A colour photo cannot reveal hidden layers, interiors or alloy composition. The review found no method for measuring that hidden composition. Material weight is estimated from shape, material type and a typical density. An error in any of those estimates affects the answer.",
  },
};

/** The drop a scale scene draws on the fan as a measuring scale, from its claim.
 *  Like the prose, every figure must appear in that scale's cell notes
 *  (chapters.test.ts). */
export const SCENE_DROP: Partial<
  Record<Scale, { from: string; fromLabel: string; to: string; toLabel: string }>
> = {
  Product: { from: "95.7%", fromLabel: "repair photos", to: "39.7%", toLabel: "at the recycler" },
  Component: { from: "~82%", fromLabel: "familiar objects", to: "~39%", toLabel: "new objects" },
};

export const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
const NUMBER_WORD = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** The field-gate split, counted from the marks rather than typed: of the rows
 *  where a method exists (evidence B or N), how many have their field
 *  performance measured, inferred, or untested. */
export const FIELD_SPLIT = (() => {
  const withMethod = cells.flatMap((c) =>
    runsOf(c)
      .filter((r) => r.evidence === "B" || r.evidence === "N")
      .map((r) => ({ cell: c, run: r })),
  );
  const n = (basis: string) => NUMBER_WORD[withMethod.filter((m) => m.run.basis === basis).length];
  const measured = withMethod
    .filter((m) => m.run.basis === "measured")
    .map((m) => `${m.cell.scale} ${m.cell.informationType}`.toLowerCase())
    .join(", ");
  const rows = cells.reduce(
    (sum, c) => sum + (c.structurallyEmpty ? 0 : (c.subVerdicts?.length ?? 1)),
    0,
  );
  const have = `${cap(NUMBER_WORD[withMethod.length])} of the ${NUMBER_WORD[rows]} assessments have a method to test.`;
  const capture =
    "Field photos are ordinary pictures taken during repair, collection or recycling.";
  return `${have} ${capture} Performance falls short in ${n("measured")} assessment (${measured}), is judged from indirect evidence in ${n("inferred")}, and has not been tested in ${n("untested")}.`;
})();
