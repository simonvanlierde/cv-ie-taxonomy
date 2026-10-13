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
    title: "Reading the label works on 95.7% of repair photos, but on only 39.7% at the recycler.",
    body: "This is where cameras come closest to real use: read the rating label, then look the product up. The repair photos were taken by customers on their own phones, and all the numbers come from one research group working on washing machines. Label reading can be tried now, as long as a person checks each value.",
  },
  Component: {
    title:
      "Cameras can find the parts in the lab. Nobody has yet worked out how to describe how the parts are fastened together.",
    body: "Finding and outlining parts has only been tested on teardowns photographed in a lab or on a fixed rig, so the next step is a trial in a real workshop. For how parts attach, there is no agreed list of fastener types linked to photos, and no photo collection that marks which part is attached to which. The few methods that try handle only jointed household objects and toy vehicles, and their accuracy falls from ~82% to ~39% on new objects of the same kinds.",
  },
  Material: {
    title: "A camera sees the surface, not what’s underneath. Weight is estimated, not measured.",
    body: "Under controlled conditions, a camera can often name the material on the outside of a part. What lies underneath, such as insides, coatings and alloys, it cannot see, and no method for it exists yet. Weight is worked out from an estimated shape, a guessed material and a density from a table, so every small error adds up. The drawing fades on purpose: the picture blurs as the evidence thins.",
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
  const have = `${cap(NUMBER_WORD[withMethod.length])} of the ${NUMBER_WORD[rows]} verdicts have a method.`;
  const capture =
    "The open question is how well it works on field photos: ordinary photos taken by the people who repair, collect or recycle products.";
  return `${have} ${capture} That performance is measured to fall short for ${n("measured")} (${measured}). It is inferred from neighbouring fields, or from tests of models not trained for the task, for ${n("inferred")}, and untested for ${n("untested")}.`;
})();
