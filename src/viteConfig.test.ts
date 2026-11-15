import { describe, expect, it } from "vitest";
import config, { contentSecurityPolicy } from "../vite.config";

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

describe("content security policy", () => {
  const content = String(contentSecurityPolicy.transformIndexHtml()[0]?.attrs.content);
  const directives = Object.fromEntries(
    content.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]),
  );
  const remote = (sources: string[]) => sources.filter((s) => /^https?:|^\*/.test(s));

  it("loads scripts only from this site", () => {
    expect(remote(directives["script-src"])).toEqual([]);
  });

  it("lets the page contact only the hosts that serve the detector's weights", () => {
    expect(remote(directives["connect-src"]).sort()).toEqual([
      "https://*.hf.co",
      "https://*.huggingface.co",
      "https://huggingface.co",
    ]);
  });
});
