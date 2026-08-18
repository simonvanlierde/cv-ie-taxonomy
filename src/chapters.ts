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
    body: "Whole products are where vision already earns its keep: read the rating label, look the product up. In a repair shop 95.7% of labels read correctly; on a recycler's line, 39.7%. Size from one camera stays a rough estimate. The deciding question, is this worth repairing?, has been answered one product class at a time: laptop covers grade at 86.7% on a lit rig, and nothing has been tested on the photos a contributor would actually take.",
  },
  Component: {
    title: "Pulled apart",
    body: "Opened up, the fan can be searched: vision finds and counts parts like blades and motors, once tuned on similar products. What it can't yet do is say how parts connect: that map holds ~82% on familiar products and drops to ~39% on unseen ones.",
  },
  Material: {
    title: "Down to matter",
    body: "Can a camera tell steel from plastic? Often, in a lab; far less reliably under a recycling plant's mixed lighting. And no camera weighs anything: mass is computed from estimated shape, guessed material and a density from a table, so every small error multiplies. The drawing has been fading on purpose: the picture blurs as the evidence thins.",
  },
};
