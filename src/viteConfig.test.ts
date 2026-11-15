import { afterEach, describe, expect, it } from "vitest";
import config from "../vite.config";

type ConfigFn = (env: { command: "build" | "serve"; mode: string; isPreview?: boolean }) => {
  base: string;
  build: { outDir: string };
};
const resolve = config as unknown as ConfigFn;

describe("vite base path", () => {
  afterEach(() => {
    delete process.env.VITE_BASE_PATH;
  });

  it("serves the local preview under the production path", () => {
    expect(resolve({ command: "serve", mode: "production", isPreview: true }).base).toBe(
      "/cv-ie-taxonomy/",
    );
  });

  it("keeps the dev server at the root", () => {
    expect(resolve({ command: "serve", mode: "development" }).base).toBe("/");
  });

  it("builds pull request previews at the hostname root", () => {
    process.env.VITE_BASE_PATH = "/";
    const preview = resolve({ command: "build", mode: "production" });

    expect(preview.base).toBe("/");
    expect(preview.build.outDir).toBe("dist");
  });

  it("nests production files under the public route", () => {
    expect(resolve({ command: "build", mode: "production" }).build.outDir).toBe(
      "dist/cv-ie-taxonomy",
    );
  });
});
