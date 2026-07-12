import { FRAMES, type Frame } from "./frames";

/** jsdom ships no matchMedia; one stub shape serves every test — only which
 *  queries match varies. (Restore is handled by test-setup's afterEach.) */
export const matchMediaStub = (matches: (query: string) => boolean) =>
  ((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

/** Strict frame lookup for tests: throws on an unknown id (so a typo fails loudly)
 *  and returns a definite Frame, so tests need no non-null assertion under
 *  noUncheckedIndexedAccess. Production uses `FRAMES[id] ?? HOME_FRAME` instead. */
export function frameOf(id: string): Frame {
  const frame = FRAMES[id];
  if (!frame) throw new Error(`no camera frame for cell id: ${id}`);
  return frame;
}
