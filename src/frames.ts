// Camera frames in Fan viewBox coordinates. VIEW is the whole desktop canvas and
// the home frame; each cell frame zooms toward the part its read-out points at.
// These are hand-tuned starting rects (like the callout positions in Fan.tsx) —
// fine-tune visually in Task 3. Chips are only clickable at their chapter's
// plateau, so a plateau-state frame tracks the part closely enough.

export type Frame = { x: number; y: number; w: number; h: number };

export const VIEW: Frame = { x: -250, y: -25, w: 1070, h: 950 };
export const HOME_FRAME: Frame = VIEW;

export const frameToViewBox = (f: Frame) => `${f.x} ${f.y} ${f.w} ${f.h}`;

/** Keep a frame within `bounds`: shrink to fit, then slide inside. */
export const clampFrame = (f: Frame, bounds: Frame): Frame => {
  const w = Math.min(f.w, bounds.w);
  const h = Math.min(f.h, bounds.h);
  const x = Math.min(Math.max(f.x, bounds.x), bounds.x + bounds.w - w);
  const y = Math.min(Math.max(f.y, bounds.y), bounds.y + bounds.h - h);
  return { x, y, w, h };
};

// Product chapter: fan assembled around [300,400]. Component: exploded. Material:
// drifted. One frame per cell id in taxonomy.json.
export const FRAMES: Record<string, Frame> = {
  "product-identity": { x: 150, y: 560, w: 320, h: 240 },
  "product-quantity": { x: 120, y: 200, w: 380, h: 520 },
  "product-structure": { x: 120, y: 200, w: 380, h: 520 },
  "product-condition": { x: 150, y: 590, w: 320, h: 200 },
  "component-identity": { x: 160, y: 180, w: 340, h: 380 },
  "component-structure": { x: 180, y: 220, w: 340, h: 320 },
  "component-quantity": { x: 200, y: 360, w: 300, h: 260 },
  "component-condition": { x: 200, y: 360, w: 300, h: 260 },
  "material-identity": { x: 150, y: 120, w: 360, h: 560 },
  "material-quantity": { x: 150, y: 120, w: 360, h: 560 },
  "material-structure": { x: 150, y: 120, w: 360, h: 560 },
  "material-condition": { x: 220, y: 360, w: 300, h: 280 },
};
