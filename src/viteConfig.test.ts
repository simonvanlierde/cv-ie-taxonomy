import { afterEach, describe, expect, it } from "vitest";
import config, { contentSecurityPolicy } from "../vite.config";

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

describe("content security policy", () => {
  const content = String(contentSecurityPolicy.transformIndexHtml()[0]?.attrs.content);
  const directives = Object.fromEntries(
    content.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]),
  );
  const remote = (sources: string[]) => sources.filter((s) => /^https?:|^\*/.test(s));

  it("loads scripts only from this site, with no inline script or eval", () => {
    // blob: is the ONNX runtime's factory; wasm needs 'wasm-unsafe-eval'
    expect(directives["script-src"]).toEqual(["'self'", "blob:", "'wasm-unsafe-eval'"]);
  });

  it("falls back to this site and blocks plugins and base rewrites", () => {
    expect(directives["default-src"]).toEqual(["'self'"]);
    expect(directives["object-src"]).toEqual(["'none'"]);
    expect(directives["base-uri"]).toEqual(["'self'"]);
  });

  it("lets the page contact only the hosts that serve the detector's weights", () => {
    expect(remote(directives["connect-src"]).sort()).toEqual([
      "https://*.hf.co",
      "https://*.huggingface.co",
      "https://huggingface.co",
    ]);
  });
});
