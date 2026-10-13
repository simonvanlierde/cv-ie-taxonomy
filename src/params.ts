/** Demo-shell URL params. Kept out of main.tsx so they can be tested. */

import type { Chapter } from "./frames";

/** The five scenes in reading order: `?scene=0` is the opening, `?scene=4` the map. */
export const SCENES: readonly Chapter[] = ["hero", "Product", "Component", "Material", "outro"];

/** `?scene=2` pins the page to a scene for screenshots. Anything but a whole
 *  number 0–4 is ignored, so a typo leaves the page scrolling normally. */
export function parseScene(raw: string | null): Chapter | undefined {
  if (raw === null || !/^[0-4]$/.test(raw.trim())) return undefined;
  return SCENES[Number(raw)];
}
