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
    body: "Whole products are where vision comes closest to use: read the rating label, look the product up. Label reading can be trialled now, if a person verifies each value. Model numbers were read from 95.7% of label-visible images taken for professional repair, but from 39.7% at a recycler's intake. Size from one camera stays a rough estimate. The deciding question, is this worth repairing?, has been answered one product class at a time: laptop covers grade at 86.7% on a conveyor with ambient light blocked, and nothing has been tested on the photos a contributor would actually take.",
  },
  Component: {
    title: "Pulled apart",
    body: "Opened up, the fan can be searched: vision finds and counts parts like blades and motors, once tuned on similar products. What it can't yet do is say how parts connect: the methods that try cover only jointed household objects and toy vehicles, and their map of connections falls from ~82% to ~39% on a new dataset of the same kinds.",
  },
  Material: {
    title: "Down to matter",
    body: "Can a camera tell steel from plastic? Often, under controlled conditions; far less reliably once the lighting shifts, even in the lab. Weight is estimated, not measured: one-photo mass methods are tested only on circuit boards, catalog objects and smart-bin items, and otherwise mass is computed from estimated shape, guessed material and a density from a table, so every small error multiplies. The drawing has been fading on purpose: the picture blurs as the evidence thins.",
  },
};
