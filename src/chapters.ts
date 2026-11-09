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
    title:
      "In one washing-machine study, label reading dropped from 95.7% at repair to 39.7% at the recycler.",
    body: "A model number can link a used appliance to a product database. Worn, dirty or badly angled labels are harder to read. Software recognised model numbers in 446 of 466 repair photos and 306 of 771 recycler photos. Only photos with a visible model number counted. Some character errors were allowed, so a person must check the exact model number before selecting a database record. Customers took the repair photos on their phones. The people, cameras and brand mix differed between sites, so the comparison does not isolate the cause of the drop. The collection-site pilots came from the same research group; independent confirmation is still missing. Label reading can be trialled now with this check.",
  },
  Component: {
    title: "To take a product apart, we need to know how its parts are attached.",
    body: "In one study of teardown photos taken in a lab, software could find and outline parts, but it needs adjusting for each new setting. Tests in working repair shops are still missing. For disassembling consumer products in general, the review found no shared way to label attachments linked to photos, or general image dataset of those connections. Existing demonstrations cover jointed household objects and toy vehicles. In one study of jointed household objects, all the connections between parts were correctly identified in ~82% of cases on one dataset and ~39% on an unseen dataset. That tests whether it works on unfamiliar examples, not performance on repair-shop photos.",
  },
  Material: {
    title: "A photo shows the surface. Recovery depends on what lies underneath, too.",
    body: "Under controlled conditions, software can often recognise a material on the surface of a part. A colour photo cannot reveal hidden layers, interiors or alloy composition. The review found no method for measuring that hidden composition. Material weight is estimated from shape, material type and a typical density. An error in any of those estimates affects the answer.",
  },
};

/** The drop a scale scene draws on the fan as a measuring scale, from its claim.
 *  Every percentage must appear in that scale's cell notes (chapters.test.ts).
 *  Label-reading counts come from the cited study's Table 3. */
export const SCENE_DROP: Partial<
  Record<
    Scale,
    {
      from: string;
      fromLabel: string;
      fromCount?: string;
      to: string;
      toLabel: string;
      toCount?: string;
    }
  >
> = {
  // Counts: Sterkens et al. (2023), Table 3, doi:10.1111/jiec.13279.
  // Only photos with a visible model number enter these denominators.
  Product: {
    from: "95.7%",
    fromLabel: "repair photos",
    fromCount: "446 of 466 photos",
    to: "39.7%",
    toLabel: "at the recycler",
    toCount: "306 of 771 photos",
  },
  Component: { from: "~82%", fromLabel: "first dataset", to: "~39%", toLabel: "unseen dataset" },
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
