import { expect, it } from "vitest";
import { REAL_MODELS } from "./realModels";

// No mocks: the worker, the wasm core and the English data are the ones the site
// serves, so a broken model path fails here and not in a reader's browser.
it("reads drawn text with the Tesseract files the site serves", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 160;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 600, 160);
  ctx.fillStyle = "#000";
  ctx.font = "bold 72px sans-serif";
  ctx.fillText("RATING 230V", 20, 100);
  const image = new Image();
  image.src = canvas.toDataURL("image/png");
  await image.decode();

  const reading = await REAL_MODELS.Product.run(image);

  expect(reading.kind).toBe("text");
  expect(reading.kind === "text" && reading.text.replace(/\s/g, "")).toMatch(/RATING/i);
}, 60_000);
