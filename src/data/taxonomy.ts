import raw from "./taxonomy.json";
import type { Cell, InfoType, Scale, Taxonomy, Verdict } from "./types";

export const taxonomy = raw as Taxonomy;
export const cells = taxonomy.cells;

export const SCALES = taxonomy.meta.axes.scale;
export const INFO_TYPES = taxonomy.meta.axes.informationType;

/** Short letter shown inside a hotspot for each verdict (texture carries the rest).
 *  Derived from the source-of-truth maturity legend, never hand-maintained, so a
 *  letter can only change by changing taxonomy.json. */
export const VERDICT_LETTER = Object.fromEntries(
  taxonomy.meta.maturityLevels.map((m) => [m.verdict, m.letter]),
) as Record<Verdict, string>;

export function cellAt(scale: Scale, info: InfoType): Cell | undefined {
  return cells.find((c) => c.scale === scale && c.informationType === info);
}
