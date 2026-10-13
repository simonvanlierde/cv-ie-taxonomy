/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves project sites under /<repo>/; dev/preview stay at root.
  base: command === "build" ? "/cv-ie-taxonomy/" : "/",
  plugins: [
    react(),
    // transformers.js references its default (asyncify) ONNX runtime build, so
    // Vite emits it; realModels.ts points the runtime at the plain build instead,
    // and nothing ever loads this 27 MB file
    // The built page's content security policy. GitHub Pages cannot send headers,
    // so it is a <meta> tag, added at build only: the dev server injects inline
    // scripts. Scripts and workers come only from this site (blob: is the ONNX
    // runtime's factory and wasm needs 'wasm-unsafe-eval'); a reader's photo can
    // only be fetched by the page itself, and the only hosts it may contact are
    // the two that serve model data.
    {
      name: "content-security-policy",
      apply: "build",
      transformIndexHtml: () => [
        {
          tag: "meta",
          injectTo: "head-prepend",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: [
              "default-src 'self'",
              "script-src 'self' blob: 'wasm-unsafe-eval'",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        },
      ],
    },
    {
      name: "drop-unused-onnx-runtime",
      apply: "build",
      generateBundle(_, bundle) {
        for (const file of Object.keys(bundle)) {
          if (/ort-wasm-simd-threaded\.asyncify-.*\.wasm$/.test(file)) delete bundle[file];
        }
      },
    },
  ],
  // transformers.js is one lazy 540 kB chunk, loaded only when a reader runs a
  // real model; the page's own bundle stays near 330 kB
  build: { chunkSizeWarningLimit: 600 },
  test: {
    // Two projects, because two different things are worth proving.
    //
    // `unit` runs in jsdom: fast, and enough for everything that is our own
    // logic. `browser` runs the same library in real Chromium, and holds only
    // the handful of contracts jsdom cannot honour — the ones the platform
    // implements for us (a modal <dialog>'s focus restore, `inert` removing a
    // subtree from the a11y tree, the top layer's Esc precedence) and the ones
    // that need real layout (the container query behind the mobile seam).
    //
    // A test belongs in `browser` only if jsdom would make it a tautology.
    // Everything else stays in `unit`, where it costs milliseconds.
    // Off unless run with --coverage; CI uploads coverage/lcov.info to Codecov.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test-helpers.ts"],
      reporter: ["text", "lcov"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./src/test-setup.ts"],
          globals: false,
          // the first render of the whole island in jsdom is heavy, and on a
          // loaded machine it alone crossed the 5s default; that is a slow
          // test, not a broken one
          testTimeout: 15_000,
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./src/browser-setup.ts"],
          globals: false,
          testTimeout: 15_000,
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // the reduced-motion and forced-colours tests flip those media
            // queries on the real page
            commands: {
              emulateMedia: async (
                { page },
                media: { reducedMotion?: "reduce" | null; forcedColors?: "active" | null },
              ) => {
                await page.emulateMedia(media);
              },
            },
            // Chromium alone. These tests assert spec'd platform behaviour, not
            // engine quirks; a second engine would triple CI time to re-prove
            // the same spec. Add one when a real cross-engine bug turns up.
            instances: [
              {
                browser: "chromium",
                // Wider than the 1180px seam, so the desktop tree is the default
                // and only the seam test resizes away from it.
                viewport: { width: 1280, height: 900 },
              },
            ],
          },
        },
      },
    ],
  },
}));
