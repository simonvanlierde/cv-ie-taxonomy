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
    body: "Whole products are where vision already earns its keep: read the rating label, look the product up. In a repair shop, 95.7% of labels read correctly; on a recycler's line that falls to 39.7%. Size from a single camera stays a rough estimate. The question that decides everything, is this worth repairing?, has only been answered for one product class at a time: laptop covers grade at 86.7% on a lit rig, and nothing has been tested on the photos a contributor would actually take.",
  },
  Component: {
    title: "Pulled apart",
    body: "Opened up, the fan can be searched: vision can find and count parts like blades and motors, once tuned on similar products. What it can't yet do is say how parts connect. That map of what-attaches-to-what holds ~82% on familiar products and drops to ~39% on ones it hasn't seen before.",
  },
  Material: {
    title: "Down to matter",
    body: "Can a camera tell steel from plastic? Often, in a lab; far less reliably under the mixed lighting of a real recycling plant. And no camera weighs anything: mass is always computed from estimated shape, guessed material, and a density looked up in a table, so every small error multiplies.",
  },
};
