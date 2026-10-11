import { describe, expect, it } from "vitest";
import { parseScene } from "./params";

describe("?scene= pin", () => {
  it("maps 0–4 to the scenes in reading order", () => {
    expect(parseScene("0")).toBe("hero");
    expect(parseScene("2")).toBe("Component");
    expect(parseScene("4")).toBe("outro");
  });

  it("ignores anything else, rather than pinning a scene that does not exist", () => {
    for (const raw of ["", "5", "-1", "1.5", "abc", "02x"]) {
      expect(parseScene(raw), `?scene=${raw}`).toBeUndefined();
    }
    expect(parseScene(null)).toBeUndefined();
  });
});
