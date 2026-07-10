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

/** The grid is complete (every scale × information type), so a miss means
 *  taxonomy.json drifted from its axes — see taxonomy.test.ts. */
export function cellAt(scale: Scale, info: InfoType): Cell {
  const cell = cells.find((c) => c.scale === scale && c.informationType === info);
  if (!cell) throw new Error(`no cell for ${scale} × ${info}`);
  return cell;
}

const BY_ID = new Map(cells.map((c) => [c.id, c]));

/** Look a cell up by its JSON id ("product-identity", …). The fan addresses its
 *  overlays this way; an unknown id is a typo, not a runtime condition. */
export function cellById(id: string): Cell {
  const cell = BY_ID.get(id);
  if (!cell) throw new Error(`no cell with id ${id}`);
  return cell;
}

export function maturityLevel(verdict: Verdict) {
  const level = taxonomy.meta.maturityLevels.find((m) => m.verdict === verdict);
  if (!level) throw new Error(`no maturity level for verdict ${verdict}`);
  return level;
}
