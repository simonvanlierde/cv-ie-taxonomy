// Camera frames in Fan viewBox coordinates. VIEW is the whole desktop canvas and
// the home frame; each cell frame zooms toward the part its read-out points at.
// These are hand-tuned rects, like the callout positions in Fan.tsx: retune them
// by eye, against the rendered fan. Chips are only clickable at their chapter's
// plateau, so a plateau-state frame tracks the part closely enough.

export type Frame = { x: number; y: number; w: number; h: number };

// The drawing occupies roughly x 120..520, y 100..800. The frame is kept close
// around it so the fan commands the sheet: a wider frame spends the viewport on
// empty gutters and renders the product small, which is the opposite of what a
// teardown sheet is for.
// y starts at 20, not 40: the exploded front grille rises to y ≈ 26, and a
// home frame that began below it cropped the top of the drawing at every zoom.
export const VIEW: Frame = { x: -120, y: 20, w: 800, h: 850 };
export const HOME_FRAME: Frame = VIEW;

export const frameToViewBox = (f: Frame) => `${f.x} ${f.y} ${f.w} ${f.h}`;

/** The smallest frame holding both, grown by `pad` on every side. */
export const unionFrame = (a: Frame, b: Frame, pad = 0): Frame => {
  const x = Math.min(a.x, b.x) - pad;
  const y = Math.min(a.y, b.y) - pad;
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) + pad - x,
    h: Math.max(a.y + a.h, b.y + b.h) + pad - y,
  };
};

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
  // wide enough for the OCR read-out, which hangs right of the rating label and
  // was being cut mid-string by the detail's edge on the ?cell= entry
  "product-identity": { x: 130, y: 540, w: 440, h: 300 },
  "product-quantity": { x: 120, y: 200, w: 380, h: 520 },
  "product-structure": { x: 120, y: 200, w: 380, h: 520 },
  "product-condition": { x: 150, y: 590, w: 320, h: 200 },
  "component-identity": { x: 160, y: 180, w: 340, h: 380 },
  "component-structure": { x: 180, y: 220, w: 340, h: 320 },
  "component-quantity": { x: 200, y: 360, w: 300, h: 260 },
  // wider than the quantity frame above: the anomaly tag hangs ~190 units left
  // of the motor centre and the blob rides its left edge — both stay in frame
  "component-condition": { x: 140, y: 340, w: 380, h: 320 },
  "material-identity": { x: 150, y: 120, w: 360, h: 560 },
  "material-quantity": { x: 150, y: 120, w: 360, h: 560 },
  "material-structure": { x: 150, y: 120, w: 360, h: 560 },
  // the corrosion tag extends right of the drifted motor; keep its full width
  "material-condition": { x: 180, y: 340, w: 380, h: 320 },
};
