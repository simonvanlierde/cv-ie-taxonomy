import type { Scale } from "./data/types";

/**
 * Real-model mode: one model per scene, run in the reader's browser on one photo.
 * Each runs only after an explicit click, downloads its weights once (the
 * browser caches them), and sends no photo anywhere. The libraries load on
 * demand, so the page itself does not grow.
 */

/** A detection, as fractions of the photo's width and height. */
export type Box = { label: string; score: number; x: number; y: number; w: number; h: number };
export type Reading =
  | { kind: "boxes"; boxes: Box[] }
  | { kind: "text"; text: string; confidence: number };

export interface RealModel {
  /** the model as the reader sees it named */
  name: string;
  /** what it is asked to do, in plain words */
  task: string;
  /** what the first run downloads, said plainly */
  download: string;
  licence: string;
  run(image: HTMLImageElement): Promise<Reading>;
}

// OWL-ViT: an open-vocabulary detector built on CLIP, so the paper's zero-shot
// family; Google's weights, Apache-2.0. The onnx-community export, because the
// older Xenova one uses a Cast node this ONNX runtime cannot run. The first run
// fetches the quantised weights (149 MB), the tokenizer (2 MB) and the
// runtime's WebAssembly (13-27 MB by browser). One download serves both the
// parts and the materials scene.
const DETECTOR = "onnx-community/owlvit-base-patch32-ONNX";
type Detection = {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
};
type Detector = (image: string, labels: string[], o: { threshold: number }) => Promise<Detection[]>;
let detector: Promise<Detector> | null = null;

/** Detections in pixels → boxes as fractions of the photo, best first. */
export function toBoxes(found: Detection[], width: number, height: number): Box[] {
  return found
    .map(({ label, score, box }) => ({
      label,
      score,
      x: box.xmin / width,
      y: box.ymin / height,
      w: (box.xmax - box.xmin) / width,
      h: (box.ymax - box.ymin) / height,
    }))
    .sort((a, b) => b.score - a.score);
}

async function detect(image: HTMLImageElement, labels: string[]): Promise<Reading> {
  // a failed load (offline, a blocked CDN) is not cached: the next press retries
  detector ??= import("@huggingface/transformers")
    .then(({ pipeline }) => pipeline("zero-shot-object-detection", DETECTOR) as unknown as Detector)
    .catch((error) => {
      detector = null;
      throw error;
    });
  const found = await (await detector)(image.src, labels, { threshold: 0.1 });
  return { kind: "boxes", boxes: toBoxes(found, image.naturalWidth, image.naturalHeight) };
}

async function readText(image: HTMLImageElement): Promise<Reading> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(image);
    return { kind: "text", text: data.text.trim(), confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}

const owl = {
  name: "OWL-ViT (base, patch 32)",
  download: "about 170 MB the first time",
  licence: "Apache-2.0",
};

export const REAL_MODELS: Record<Scale, RealModel> = {
  Product: {
    name: "Tesseract 5 (tesseract.js), English",
    task: "read the text on the rating label",
    // the WebAssembly core (3.9 MB), English data (3.0 MB) and its worker
    download: "about 7 MB the first time",
    licence: "Apache-2.0",
    run: readText,
  },
  Component: {
    ...owl,
    task: "find the blades, the motor, the grilles and the base",
    run: (image) =>
      detect(image, ["a fan blade", "an electric motor", "a fan grille", "a fan base"]),
  },
  Material: {
    ...owl,
    task: "find steel, plastic, copper and circuit boards",
    run: (image) => detect(image, ["steel", "plastic", "copper wire", "a circuit board"]),
  },
};

/**
 * Photos of the paper's desk fan, per scene. None are taken yet; until they are,
 * each scene offers the reader's own photo instead. Each entry will pair a clean
 * shot with a worn one, so a good result is never shown without its field case.
 */
export const FAN_PHOTOS: Partial<Record<Scale, { src: string; alt: string; credit: string }[]>> =
  {};
