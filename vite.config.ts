/// <reference types="vitest/config" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // GitHub Pages serves project sites under /<repo>/; dev/preview stay at root.
  base: command === "build" ? "/cv-ie-taxonomy/" : "/",
  plugins: [react()],
  test: {
    // jsdom, not node: the interaction layer (the dialog's open/close, focus
    // return and Esc) is the part of this viz worth testing, and it needs a DOM.
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    globals: false,
    // the first render of the whole island in jsdom is heavy, and on a loaded
    // machine it alone crossed the 5s default; that is a slow test, not a broken one
    testTimeout: 15_000,
  },
}));
