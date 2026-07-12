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

// relative luminance and contrast ratio, WCAG 2.x — shared by every test that
// holds a palette to a floor (verdictRamp.test.ts, theme.test.ts)
const channel = (hex: string, at: number) => {
  const v = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const luminance = (hex: string) =>
  0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);

export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  const [lo, hi] = x < y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
};

/** Strict frame lookup for tests: throws on an unknown id (so a typo fails loudly)
 *  and returns a definite Frame, so tests need no non-null assertion under
 *  noUncheckedIndexedAccess. Production uses `FRAMES[id] ?? HOME_FRAME` instead. */
export function frameOf(id: string): Frame {
  const frame = FRAMES[id];
  if (!frame) throw new Error(`no camera frame for cell id: ${id}`);
  return frame;
}
