import { describe, expect, it } from "vitest";
import { parseProgress } from "./params";

describe("?p= scroll pin", () => {
  it("passes a finite value through", () => {
    expect(parseProgress("0.5")).toBe(0.5);
    expect(parseProgress("0")).toBe(0);
    expect(parseProgress("1")).toBe(1);
  });

  it("clamps to the 0..1 the timeline is defined on", () => {
    expect(parseProgress("-3")).toBe(0);
    expect(parseProgress("42")).toBe(1);
  });

  it("rejects anything non-finite, rather than letting NaN blank the fan", () => {
    // Number("abc") is NaN, and `NaN ?? scrollP` keeps the NaN — the bug this guards.
    for (const raw of ["abc", "", "0.5x", "NaN", "Infinity", "-Infinity"]) {
      expect(parseProgress(raw), `?p=${raw}`).toBeUndefined();
    }
  });

  it("is absent when the param is absent", () => {
    expect(parseProgress(null)).toBeUndefined();
  });
});
