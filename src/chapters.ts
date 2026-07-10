import type { Scale } from "./data/types";

/**
 * The narrative rail's prose, one chapter per physical scale.
 *
 * Unlike the fan overlays, this prose is NOT illustrative — every figure in it
 * is a claim the paper makes. So each percentage must appear verbatim in the
 * corresponding cell's `maturityNote` in taxonomy.json, which is the source of
 * truth; `chapters.test.ts` enforces exactly that. Round a figure for readability
 * and the test fails, which is the point: the JSON moves first, then this file.
 */
export const CHAPTER_COPY: Record<Scale, { title: string; body: string }> = {
  Product: {
    title: "One product, seen whole",
    body: "Identity is the workhorse: read the rating label, match a database. 95.7% of labels read in professional repair, 39.7% at the recycler. Geometry from a single view stays approximate, and “worth repairing?” is a verdict no benchmark yet validates.",
  },
  Component: {
    title: "Pulled apart",
    body: "Detection and segmentation can name and count parts, after domain tuning. The gap is relations: which part attaches to which (the bill of components) holds ~82% in-domain and collapses to ~39% out-of-distribution.",
  },
  Material: {
    title: "Down to matter",
    body: "Surface material ID works under controlled light and fails under field shift. Mass and volume are never seen, only derived (geometry × material class × density prior), and every error compounds.",
  },
};
