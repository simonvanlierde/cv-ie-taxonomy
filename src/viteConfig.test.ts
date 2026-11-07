import { describe, expect, it } from "vitest";
import config from "../vite.config";

type ConfigFn = (env: { command: "build" | "serve"; mode: string; isPreview?: boolean }) => {
  base: string;
};
const resolve = config as unknown as ConfigFn;

describe("vite base path", () => {
  it("serves the preview of the production build under the Pages path", () => {
    expect(resolve({ command: "serve", mode: "production", isPreview: true }).base).toBe(
      "/cv-ie-taxonomy/",
    );
  });

  it("keeps the dev server at the root", () => {
    expect(resolve({ command: "serve", mode: "development" }).base).toBe("/");
  });
});
