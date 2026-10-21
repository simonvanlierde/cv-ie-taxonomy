import ortMjs from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import ortWasm from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import tesseractWorker from "tesseract.js/dist/worker.min.js?url";
import tesseractCore from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url";
import type { Scale } from "./data/types";

// Both libraries would load their runtime code and data from jsDelivr. These URLs
// point them at copies built into the site instead; only the detector's weights
// come from elsewhere (Hugging Face).

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
  /** what the first run downloads and from where, said plainly */
  download: string;
  run(image: HTMLImageElement): Promise<Reading>;
}

// OWL-ViT: an open-vocabulary detector built on CLIP, so the paper's zero-shot
// family; Google's weights, Apache-2.0. The onnx-community export, because the
// older Xenova one uses a Cast node this ONNX runtime cannot run. The first run
// fetches the quantised weights (149 MB), the tokenizer (3.5 MB) and the
// runtime's WebAssembly (14 MB, served by this site). One download serves both
// the parts and the materials scene.
const DETECTOR = "onnx-community/owlvit-base-patch32-ONNX";
// a fixed commit, so the weights, and the size quoted to the reader, cannot change under us
// biome-ignore lint/security/noSecrets: a public Hugging Face commit id, not a secret
const DETECTOR_REVISION = "4cba1467c378f89779ae66c7eff8f0f64985a0e3";
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
    .then(({ env, pipeline }) => {
      // the plain SIMD build: this page runs the WASM backend only, and this build
      // runs in every browser that has WebAssembly SIMD
      if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm };
      return pipeline("zero-shot-object-detection", DETECTOR, {
        revision: DETECTOR_REVISION,
      }) as unknown as Detector;
    })
    .catch((error) => {
      detector = null;
      throw error;
    });
  const found = await (await detector)(image.src, labels, { threshold: 0.1 });
  return { kind: "boxes", boxes: toBoxes(found, image.naturalWidth, image.naturalHeight) };
}

async function readText(image: HTMLImageElement): Promise<Reading> {
  const { createWorker, OEM } = await import("tesseract.js");
  // langPath: the English data, served under a fixed name by vite.config.ts.
  // Do not pass it as `[{ code, data }]`: tesseract.js 7 then fails to load the language in the browser.
  // cacheMethod "none" keeps it out of IndexedDB, leaving only the browser's normal file cache
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    langPath: `${import.meta.env.BASE_URL}tesseract`,
    workerPath: tesseractWorker,
    corePath: tesseractCore,
    workerBlobURL: false,
    cacheMethod: "none",
  });
  try {
    const { data } = await worker.recognize(image);
    return { kind: "text", text: data.text.trim(), confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}

const owl = {
  name: "OWL-ViT (base, patch 32)",
  download:
    "about 165 MB: the model from Hugging Face, a US company, through its Amazon CloudFront servers, and the rest from this site. Hugging Face sees your IP address and browser, as any website does",
};

export const REAL_MODELS: Record<Scale, RealModel> = {
  Product: {
    name: "Tesseract 5 (tesseract.js), English",
    task: "read the text on the rating label",
    // the WebAssembly core (3.9 MB), English data (2.8 MB) and its worker
    download: "about 7 MB, all from this site",
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
 * Removes the detector's files from this browser: transformers.js keeps the
 * weights and its runtime in the Cache Storage "transformers-cache". The model
 * loaded in this tab is dropped too, so the next run downloads it again.
 * Callers must not call this while a model is loading: the download would write
 * its files back after the delete.
 */
export async function removeDownloads(): Promise<void> {
  detector = null;
  if (typeof caches !== "undefined") await caches.delete("transformers-cache");
}

/**
 * Photos of the paper's desk fan, per scene. None are taken yet; until they are,
 * each scene offers the reader's own photo instead. Each entry will pair a clean
 * shot with a worn one, so a good result is never shown without its field case.
 */
export const FAN_PHOTOS: Partial<Record<Scale, { src: string; alt: string }[]>> = {};
