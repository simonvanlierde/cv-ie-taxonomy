import { FRAMES, type Frame } from "./frames";

/** Strict frame lookup for tests: throws on an unknown id (so a typo fails loudly)
 *  and returns a definite Frame, so tests need no non-null assertion under
 *  noUncheckedIndexedAccess. Production uses `FRAMES[id] ?? HOME_FRAME` instead. */
export function frameOf(id: string): Frame {
  const frame = FRAMES[id];
  if (!frame) throw new Error(`no camera frame for cell id: ${id}`);
  return frame;
}
