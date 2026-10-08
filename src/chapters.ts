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
    body: "With the whole product, vision comes closest to use: read the rating label, then look the product up. Label reading can be trialled now, if a person checks each value. Model numbers were read from 95.7% of label-visible images taken for professional repair. At a recycler's intake, that fell to 39.7%. Size from one camera stays a rough estimate. The key question is whether the product is worth repairing. So far it has been answered one product class at a time. Laptop covers are graded at 86.7% on a conveyor with ambient light blocked. Nothing has been tested on the photos a contributor would actually take.",
  },
  Component: {
    title: "Pulled apart",
    body: "Once the fan is opened up, vision can find and count parts like blades and motors. That works after tuning on similar products. What it can't yet do is say how the parts connect. The methods that try cover only jointed household objects and toy vehicles. Their map of connections falls from ~82% to ~39% on a new dataset of the same kinds.",
  },
  Material: {
    title: "Down to matter",
    body: "Can a camera tell steel from plastic? Often, under controlled conditions. It is far less reliable once the lighting shifts, even in the lab. Weight is estimated, not measured. One-photo mass methods are tested only on circuit boards, catalog objects and smart-bin items. Otherwise, mass is computed from estimated shape, guessed material and a density from a table. Every small error multiplies. The drawing has been fading on purpose: the picture blurs as the evidence thins.",
  },
};
