/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves project sites under /<repo>/; dev/preview stay at root.
  base: command === "build" ? "/cv-ie-taxonomy/" : "/",
  plugins: [react()],
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
            // Chromium alone. These tests assert spec'd platform behaviour, not
            // engine quirks; a second engine would triple CI time to re-prove
            // the same spec. Add one when a real cross-engine bug turns up.
            instances: [
              {
                browser: "chromium",
                // Wider than the 881px seam, so the desktop tree is the default
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
