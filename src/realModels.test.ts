import { realpathSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real runners, with both libraries mocked: what each scene asks for, where
 * the runtimes load from, and that a failed load can be retried. No weights are
 * downloaded.
 */
const detector = vi.fn();
const pipeline = vi.fn();
const env = { backends: { onnx: { wasm: {} as { wasmPaths?: unknown } } } };
vi.mock("@huggingface/transformers", () => ({ pipeline, env }));

const worker = { recognize: vi.fn(), terminate: vi.fn() };
const createWorker = vi.fn();
vi.mock("tesseract.js", () => ({ createWorker, OEM: { LSTM_ONLY: 1 } }));

/** realModels caches the detector in module state, so each test loads it fresh */
const load = async () => {
  vi.resetModules();
  return import("./realModels");
};
const image = () =>
  Object.assign(new Image(), { src: "blob:photo" }) as HTMLImageElement & { naturalWidth: number };

beforeEach(() => {
  vi.clearAllMocks();
  pipeline.mockResolvedValue(detector);
  detector.mockResolvedValue([]);
  createWorker.mockResolvedValue(worker);
  worker.recognize.mockResolvedValue({ data: { text: "  TYP 4212/A \n", confidence: 76 } });
});

describe("the real models", () => {
  it("loads nothing until a model runs", async () => {
    await load();
    expect(pipeline).not.toHaveBeenCalled();
    expect(createWorker).not.toHaveBeenCalled();
  });

  it("asks the detector for the parts in Component and the materials in Material", async () => {
    const { REAL_MODELS } = await load();
    await REAL_MODELS.Component.run(image());
    await REAL_MODELS.Material.run(image());
    expect(detector.mock.calls.map((c) => c[1])).toEqual([
      ["a fan blade", "an electric motor", "a fan grille", "a fan base"],
      ["steel", "plastic", "copper wire", "a circuit board"],
    ]);
    expect(detector.mock.calls[0]?.[0]).toBe("blob:photo");
    // one model serves both scenes, loaded once
    expect(pipeline).toHaveBeenCalledTimes(1);
  });

  it("loads the ONNX runtime from this site and the weights at a fixed commit", async () => {
    const { REAL_MODELS } = await load();
    await REAL_MODELS.Component.run(image());
    const paths = env.backends.onnx.wasm.wasmPaths as { mjs: string; wasm: string };
    for (const url of [paths.mjs, paths.wasm]) expect(url).not.toMatch(/^https?:/);
    expect(pipeline.mock.calls[0]?.[2]?.revision).toMatch(/^[0-9a-f]{40}$/);
  });

  it("lets a failed load be retried", async () => {
    const { REAL_MODELS } = await load();
    pipeline.mockRejectedValueOnce(new Error("offline"));
    await expect(REAL_MODELS.Component.run(image())).rejects.toThrow("offline");
    await REAL_MODELS.Component.run(image());
    expect(pipeline).toHaveBeenCalledTimes(2);
  });

  it("reads the label with Tesseract from this site, and always frees its worker", async () => {
    const { REAL_MODELS } = await load();
    await expect(REAL_MODELS.Product.run(image())).resolves.toEqual({
      kind: "text",
      text: "TYP 4212/A",
      confidence: 76,
    });
    const options = createWorker.mock.calls[0]?.[2];
    expect(options.cacheMethod).toBe("none");
    expect(options.workerPath).not.toMatch(/^https?:/);
    expect(options.corePath).not.toMatch(/^https?:/);
    expect(options.langPath).not.toMatch(/^https?:/);
    expect(detector).not.toHaveBeenCalled();

    worker.recognize.mockRejectedValueOnce(new Error("bad image"));
    await expect(REAL_MODELS.Product.run(image())).rejects.toThrow("bad image");
    expect(worker.terminate).toHaveBeenCalledTimes(2);
  });
});

describe("the runtimes this site serves", () => {
  // The site serves the ONNX runtime's wasm and Tesseract's core from the
  // top-level packages, while each library's own code comes from the copy it
  // depends on. pnpm keeps a package's dependencies beside it, so the two are
  // the same files only when the versions match.
  const real = (p: string) => realpathSync(join("node_modules", p));
  // the dependency as `pkg` itself resolves it: up out of the package's own name
  const beside = (pkg: string, dep: string) =>
    realpathSync(join(real(pkg), ...pkg.split("/").map(() => ".."), dep));

  it("serves the ONNX runtime transformers.js was built against", () => {
    expect(beside("@huggingface/transformers", "onnxruntime-web")).toBe(real("onnxruntime-web"));
  });

  it("serves the Tesseract core tesseract.js was built against", () => {
    expect(beside("tesseract.js", "tesseract.js-core")).toBe(real("tesseract.js-core"));
  });
});

describe("removing the downloads", () => {
  it("drops the loaded detector, so the next run downloads it again", async () => {
    const { REAL_MODELS, removeDownloads } = await load();
    await REAL_MODELS.Component.run(image());
    await removeDownloads();
    await REAL_MODELS.Component.run(image());
    expect(pipeline).toHaveBeenCalledTimes(2);
  });
});
