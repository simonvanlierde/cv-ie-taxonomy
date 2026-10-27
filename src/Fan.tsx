import { type ReactNode, useId } from "react";
import { SCENE_DROP } from "./chapters";
import { cellById as cell, maturityName, taskName, VERDICT_LETTER } from "./data/taxonomy";
import type { Cell, Scale } from "./data/types";
import { type Chapter, type Frame, frameToViewBox, VIEW } from "./frames";
import { SCALE_VAR, SEG_VAR as SEG } from "./theme";
import { VerdictSwatch } from "./VerdictSwatch";

// Explode vectors at factor 1, a patent-style vertical explode: the front of
// the fan stacks upward with a slight stagger, the stand drops away below.
const V = {
  fg: [-28, -252], // front grille
  bl: [-15, -132], // blades
  rg: [6, -28], // rear grille
  mo: [38, 58], // motor
  nk: [12, 70], // neck
  ba: [16, 124], // base
} as const;

// Collapsed part centres (viewBox coords)
const C = {
  fan: [300, 400] as const, // grille/blade axis
  mo: [306, 412] as const,
  ba: [300, 671] as const,
};

/** Each scale's pose: explode `e` and drift `m`, both 0..1. The parts move
 *  between poses in CSS (the `--e` and `--m` properties, driven by the scenes'
 *  scroll timelines); the read-outs are drawn once, at their own scale's pose. */
const POSE: Record<Scale, { e: number; m: number }> = {
  Product: { e: 0, m: 0 },
  Component: { e: 1, m: 0 },
  Material: { e: 1, m: 1 },
};

/** CSS presence of each scale's scene, 0..1 (see `.cvt-sticky` in the stylesheet) */
const PRESENCE: Record<Scale, string> = {
  Product: "var(--pr-product)",
  Component: "var(--pr-component)",
  Material: "var(--pr-material)",
};

const PETAL =
  "M300 400 C318 390 332 372 336 342 C339 316 324 300 306 309 C290 318 283 352 287 384 Z";
const BLADES = [0, 120, 240]; // blade rotations about the hub (300 400)

// The read-out tags size their plates from the real advance of the mono face
// (0.616em per glyph), so a label can never outrun its own box; their <text>
// takes its font-size from the same constant. Labels stay within the shipped
// Overpass Mono subset (ASCII + · × Ø …), so every glyph really advances
// 0.616em — a symbol outside it would fall back to a differently-spaced face.
const MONO_ADVANCE = 0.616;
const TAG_FONT = 13;
const CHIP_FONT = 14.5;
const monoWidth = (label: string, fontSize: number) => label.length * fontSize * MONO_ADVANCE;

const TAG_H = 21; // class-tag plate height, sized to TAG_FONT

// The chip's box in viewBox units, estimated at its nominal 14.5-unit font: the
// camera frames a chip with it (chipFrame) and the tab ring tests its centre.
// The button itself is laid out by CSS (`.cvt-chips .cvt-co`), and its 13px
// floor makes it wider than this on a small figure.
const CHIP_TEXT_X = 54;
const CHIP_PAD_R = 12;
const CHIP_H = 34;
const chipWidth = (text: string) => CHIP_TEXT_X + monoWidth(text, CHIP_FONT) + CHIP_PAD_R;

// The desktop view rect, imported from frames.ts (it is also the camera's home
// frame): the viewBox string and both chip gutters derive from it, so a viewBox
// change really does move both columns. Right-hand chips grow leftwards from
// CHIP_RIGHT_EDGE, left-hand chips start at CHIP_LEFT_EDGE, so a longer label
// can never run off the canvas.
const CHIP_RIGHT_EDGE = VIEW.x + VIEW.w - 8;
const CHIP_LEFT_EDGE = VIEW.x + 10;

/** The twelve chips, one per taxonomy cell: where each sits and what it says.
 *  Left-gutter chips anchor to CHIP_LEFT_EDGE; right-gutter chips omit `x` and
 *  anchor their right edge to CHIP_RIGHT_EDGE. Static on purpose: the camera
 *  reads a chip's rect from here (`chipFrame`) so an enlargement can keep the
 *  chip that opened it in frame. Leader targets live in the render, where the
 *  part centres are. `id` is looked up through cellById at render, so a typo
 *  throws rather than drawing a blank chip. */
export const CHIP_LAYOUT: {
  id: string;
  x?: number;
  y: number;
  text: string;
  strike?: boolean;
}[] = [
  // product (assembled fan)
  { id: "product-identity", x: CHIP_LEFT_EDGE, y: 770, text: "OCR + db-match ok" },
  { id: "product-quantity", y: 430, text: "H ~ 430 · Ø ~ 300" },
  { id: "product-condition", x: CHIP_LEFT_EDGE, y: 580, text: "wear? (narrow class)" },
  // clear of the HUD's scale indicator, which owns the bottom-left corner
  { id: "product-structure", x: CHIP_LEFT_EDGE, y: 676, text: "structure -> component" },
  // component (exploded fan)
  { id: "component-identity", x: CHIP_LEFT_EDGE, y: 140, text: "detect > 6 parts" },
  { id: "component-structure", y: 300, text: "segment · attached-to? E" },
  { id: "component-quantity", x: CHIP_LEFT_EDGE, y: 560, text: "dims > motor ~ 135 mm" },
  { id: "component-condition", x: CHIP_LEFT_EDGE, y: 690, text: "bearing wear? (unvalidated)" },
  // material (drifted parts)
  { id: "material-identity", y: 170, text: "steel · ABS · Cu · PCB" },
  { id: "material-quantity", x: CHIP_LEFT_EDGE, y: 140, text: "mass (derived only)", strike: true },
  // the left gutter, under the mass chip: in the right gutter it sat on the
  // drifted motor's corrosion tag
  { id: "material-structure", x: CHIP_LEFT_EDGE, y: 250, text: "structure -> component" },
  { id: "material-condition", y: 640, text: "corrosion? (unvalidated)" },
];

/** A chip's plate as a frame in viewBox units, or null for an unknown id. The
 *  camera unions this with the cell's part frame, so the enlargement never
 *  crops the read-out the reader clicked. */
export function chipFrame(id: string): Frame | null {
  const c = CHIP_LAYOUT.find((k) => k.id === id);
  if (!c) return null;
  const w = chipWidth(c.text);
  return { x: c.x ?? CHIP_RIGHT_EDGE - w, y: c.y - 23, w, h: CHIP_H };
}

const OCR_TEXT = 'OCR > "TYP 4212/A"';
const OCR_W = monoWidth(OCR_TEXT, TAG_FONT) + 10;

// ---- CV-annotation primitives -----------------------------------------------------
// `s` scales the read-out type and plates: 1 on desktop; >1 on the compact fan,
// where the same viewBox units render at roughly half the pixels. The tags are
// never controls: the phone opens cells from each scene's cell list.

const tagWidth = (label: string, s = 1) => monoWidth(label, TAG_FONT * s) + 10 * s;

/** YOLO-style class tag: solid colour box, dark text */
function Tag({
  x,
  y,
  label,
  color,
  s = 1,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  s?: number;
}) {
  const w = tagWidth(label, s);
  return (
    <g className="ov-tag" transform={`translate(${x} ${y})`}>
      <rect width={w} height={TAG_H * s} rx="2" fill={color} />
      <text x={5 * s} y={15 * s} fontSize={TAG_FONT * s}>
        {label}
      </text>
    </g>
  );
}

/** Detection bounding box with its class tag attached top-left */
function BBox({
  x,
  y,
  w,
  h,
  label,
  color,
  s = 1,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  s?: number;
}) {
  return (
    <g className="ov-bbox" style={{ "--c": color }}>
      <rect className="ov-bbox-r" x={x} y={y} width={w} height={h} />
      <Tag x={x} y={y - TAG_H * s} label={label} color={color} s={s} />
    </g>
  );
}

/**
 * One cell's CV annotations, painted on the fan.
 *
 * Every number these draw is illustrative, not a model result, so the svg that
 * holds them is hidden from the accessibility tree. Fading a group to opacity 0
 * does not remove it, and a screen reader would otherwise read every chapter's
 * read-outs at once, out of order. The chips carry the real, sourced content.
 * Opacity is the scene's presence (CSS) times `focus`, which isolates the
 * hovered or selected cell.
 */
function Layer({ scale, focus, children }: { scale: Scale; focus: number; children: ReactNode }) {
  return (
    <g className="ov-layer" style={{ opacity: `calc(${PRESENCE[scale]} * ${focus})` }}>
      {children}
    </g>
  );
}

function DimV({
  x,
  y1,
  y2,
  label,
  s = 1,
}: {
  x: number;
  y1: number;
  y2: number;
  label: string;
  s?: number;
}) {
  return (
    <g className="ov-dim">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 5} y1={y1} x2={x + 5} y2={y1} />
      <line x1={x - 5} y1={y2} x2={x + 5} y2={y2} />
      <text
        transform={`translate(${x + 14 * s} ${(y1 + y2) / 2}) rotate(90)`}
        textAnchor="middle"
        fontSize={TAG_FONT * s}
      >
        {label}
      </text>
    </g>
  );
}

function DimH({
  y,
  x1,
  x2,
  label,
  s = 1,
}: {
  y: number;
  x1: number;
  x2: number;
  label: string;
  s?: number;
}) {
  return (
    <g className="ov-dim">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 5} x2={x1} y2={y + 5} />
      <line x1={x2} y1={y - 5} x2={x2} y2={y + 5} />
      <text x={(x1 + x2) / 2} y={y - 8 * s} textAnchor="middle" fontSize={TAG_FONT * s}>
        {label}
      </text>
    </g>
  );
}

const spokes = (n: number, r0: number, r1: number, cx = 300, cy = 400) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return (
      <line
        key={a}
        x1={cx + r0 * Math.cos(a)}
        y1={cy + r0 * Math.sin(a)}
        x2={cx + r1 * Math.cos(a)}
        y2={cy + r1 * Math.sin(a)}
      />
    );
  });

// ---- interactive info chip (the control) --------------------------------------------
/** a viewBox x or y as a percentage of the drawing's box */
const pctX = (x: number) => `${((x - VIEW.x) / VIEW.w) * 100}%`;
const pctY = (y: number) => `${((y - VIEW.y) / VIEW.h) * 100}%`;

/**
 * One cell's chip: a real button laid over the drawing at its viewBox position,
 * so its text keeps a 13px floor however small the figure gets (see `.cvt-co`).
 * Left-gutter chips anchor their left edge at `x`; right-gutter chips omit `x`
 * and anchor their right edge to CHIP_RIGHT_EDGE.
 */
function Callout({
  cell,
  x,
  y,
  text,
  strike,
  dim,
  active,
  selected,
  frame,
  onSelect,
  onHover,
}: {
  cell: Cell;
  x?: number;
  /** the chip's text baseline in viewBox units; the plate is centred 6 above it */
  y: number;
  text: string;
  strike?: boolean;
  /** 1, or less while a sibling has focus; times the scene's presence (CSS) */
  dim: number;
  /** operable: this chip's chapter is on stage.
   *  Deliberately NOT derived from the dimming — a chip dimmed merely because a
   *  sibling has focus is still visible, so it must stay focusable and announced. */
  active: boolean;
  selected: boolean;
  /** the camera's target while a detail is open; null when the camera is home */
  frame: Frame | null;
  onSelect: (cell: Cell, focusId: string) => void;
  onHover: (cell: Cell | null) => void;
}) {
  const letter = VERDICT_LETTER[cell.maturity];
  // The zoom frames are tighter than the chip ring by construction, so while a
  // detail is open most sibling chips sit outside the drawing's frame. A chip the
  // reader cannot see is not a tab stop. Its visible fragment stays clickable, so
  // it stays in the accessibility tree; the selected chip stays focusable so focus
  // has its opener to return to on close. Centre test, not bbox: a chip half in
  // frame is still a control.
  const plate = chipFrame(cell.id);
  if (!plate) throw new Error(`no chip layout for ${cell.id}`);
  const cx = plate.x + plate.w / 2;
  const cy = plate.y + plate.h / 2;
  const inFrame =
    !frame ||
    (cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h);
  const hid = `cvt-co-${cell.id}`;
  return (
    <button
      type="button"
      id={hid}
      className="cvt-co"
      data-ghost={!!cell.structurallyEmpty}
      data-selected={selected}
      // another scene's chip is faded out: neither seen, operable nor announced
      inert={!active}
      tabIndex={selected || inFrame ? 0 : -1}
      // starts with what the chip shows, so a voice user can say what they see
      aria-label={`${letter} ${text}. ${cell.scale} · ${cell.informationType}: ${taskName(cell)}. Maturity: ${maturityName(cell)}. Open details.`}
      style={{
        top: pctY(y - 6),
        ...(x === undefined
          ? { right: `${((VIEW.x + VIEW.w - CHIP_RIGHT_EDGE) / VIEW.w) * 100}%` }
          : { left: pctX(x) }),
        // the plate stays opaque over its leader; a sibling's dimming fades only
        // what is on the plate (`--dim` in CSS)
        opacity: PRESENCE[cell.scale],
        "--dim": dim,
        "--hue": SCALE_VAR[cell.scale],
      }}
      onClick={() => onSelect(cell, hid)}
      onMouseEnter={() => onHover(cell)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(cell)}
      onBlur={() => onHover(null)}
    >
      <VerdictSwatch verdict={cell.maturity} />
      <b className="cvt-co-letter">{letter}</b>
      {/* a flex gap in layout, a space in the text, so it reads as the name does */}{" "}
      <span className="cvt-co-text" data-strike={strike || undefined}>
        {text}
      </span>
    </button>
  );
}

/** Where each scene's drop stands: its top-left corner and height, in viewBox
 *  units, clear of the scene's chips and read-outs. */
const DROP_AT: Partial<Record<Scale, { x: number; y: number; h: number }>> = {
  Product: { x: -95, y: 230, h: 290 },
  Component: { x: 470, y: 420, h: 280 },
};

/** "~82%" → 0.82 */
const share = (pct: string) => Number.parseFloat(pct.replace("~", "")) / 100;

/**
 * A scene's claim drawn on the fan: a 0–100% scale with the share that worked
 * before and after, and the lost share hatched between them. The claim is the
 * scene's heading too, so this is hidden from assistive tech.
 */
function Drop({ scale }: { scale: Scale }) {
  const d = SCENE_DROP[scale];
  const at = DROP_AT[scale];
  if (!d || !at) return null;
  return (
    <div
      className="cvt-drop"
      aria-hidden="true"
      style={{
        left: pctX(at.x),
        top: pctY(at.y),
        height: `${(at.h / VIEW.h) * 100}%`,
        opacity: PRESENCE[scale],
        "--from": share(d.from),
        "--to": share(d.to),
        "--hue": SCALE_VAR[scale],
      }}
    >
      <span className="cvt-drop-mark" style={{ "--v": share(d.from) }}>
        <b>{d.from}</b> {d.fromLabel}
      </span>
      <span className="cvt-drop-mark" style={{ "--v": share(d.to) }}>
        <b>{d.to}</b> {d.toLabel}
      </span>
    </div>
  );
}

// ---- the fan --------------------------------------------------------------------------

// each part's primary silhouette, defined once and reused by the part, its
// segmentation mask and its material tint (they must stay pixel-aligned)
const nkR = { x: 288, y: 480, width: 24, height: 180, rx: 8 };
const baR = { x: 205, y: 650, width: 190, height: 42, rx: 14 };
const moR = { x: 251, y: 376, width: 110, height: 72, rx: 16 };
const rgRing = { cx: 300, cy: 400, r: 116 };
const fgRing = { cx: 300, cy: 400, r: 122 };
const O = [300, 440] as const; // the assembled fan's scale origin

/** Where the parts are at a pose, in viewBox units: the read-outs and leaders
 *  for a scale are drawn against its own pose's geometry. */
function geometry(scale: Scale, compact: boolean) {
  const { e, m } = POSE[scale];
  const k = e + 0.1 * m;
  // the assembled fan fills the canvas headroom; eases to 1 as the stack needs it
  const s = compact ? 1 : 1.3 - 0.3 * e;
  const sx = (x: number) => (x - O[0]) * s + O[0];
  const sy = (y: number) => (y - O[1]) * s + O[1];
  const cc = (base: readonly [number, number], v: readonly [number, number]) =>
    [sx(base[0] + v[0] * k), sy(base[1] + v[1] * k)] as const;
  return {
    k,
    s,
    sx,
    sy,
    blC: cc(C.fan, V.bl),
    fgC: cc(C.fan, V.fg),
    rgC: cc(C.fan, V.rg),
    moC: cc(C.mo, V.mo),
    baC: cc(C.ba, V.ba),
  };
}

/** A part's explode vector, handed to CSS, which moves it by `--e` and `--m`. */
const partStyle = (v: readonly [number, number]) => ({ "--vx": v[0], "--vy": v[1] });

export function Fan({
  chapter,
  focus,
  onSelect,
  onHover,
  reduceMotion,
  compact = false,
  frame = null,
}: {
  /** the scene the reader is in: gates which chips are operable */
  chapter: Chapter;
  /** hovered/selected cell: isolates its overlay annotations */
  focus: Cell | null;
  onSelect: (cell: Cell, focusId: string) => void;
  onHover: (cell: Cell | null) => void;
  reduceMotion: boolean;
  /** phone: fan and annotations, no floating chips (the text carries the cells) */
  compact?: boolean;
  /** the camera's target frame while a detail is open. Chips outside it are not
   *  tab stops. */
  frame?: Frame | null;
}) {
  // scoped, so a second Fan on the page cannot steal this one's clip path
  const ocrClip = useId();

  const P = geometry("Product", compact);
  const Cg = geometry("Component", compact);
  const M = geometry("Material", compact);

  // Operability tracks the chapter, never the focus dimming: a chip faded because
  // a sibling is hovered is still on screen, so it stays tabbable.
  const interactive = (c: Cell) => chapter === c.scale;
  // 0.7 keeps a dimmed chip's text above 4.5:1 on both grounds
  const chipDim = (c: Cell) => (focus && focus.id !== c.id ? 0.7 : 1);
  // annotations: isolated on hover/focus, a step below full otherwise
  const deco = (id: string, base = 0.85) => (focus ? (focus.id === id ? 1 : 0.05) : base);

  const co = (id: string) => {
    const c = cell(id);
    return {
      cell: c,
      dim: chipDim(c),
      active: interactive(c),
      selected: focus?.id === c.id,
      frame,
      onSelect,
      onHover,
    };
  };

  // a worn fan shouldn't spin merrily: hovering a Condition cell stops it, and it
  // stops once the parts come apart
  const spinning =
    !compact &&
    !reduceMotion &&
    (chapter === "hero" || chapter === "Product") &&
    focus?.informationType !== "Condition";
  const segO = `calc(${PRESENCE.Component} * ${deco("component-structure", 0.6)})`;
  const matO = `calc(${PRESENCE.Material} * ${deco("material-identity", 0.7)})`;

  // On the phone the read-outs grow: same viewBox units, roughly half the pixels.
  const ts = compact ? 1.6 : 1;
  // the phone's taller "anomaly?" tag reaches down to the OCR read-out; drop it clear
  const ocrY = P.sy(728) + (ts - 1) * 30;

  // Leader targets per chip, read off each scale's part centres; the chips' own
  // positions and labels are static (CHIP_LAYOUT), so the camera can know a
  // chip's rect without rendering the fan.
  const LEADS: Record<string, readonly [number, number]> = {
    "product-identity": [P.sx(196), P.sy(737)],
    "product-quantity": [P.sx(500) + 14, P.sy(400)],
    "product-condition": [P.baC[0] - 92 * P.s, P.baC[1] + 12 * P.s],
    "component-identity": [Cg.blC[0] - 106, Cg.blC[1] - 112],
    "component-structure": [Cg.rgC[0] + 100, Cg.rgC[1] - 52],
    "component-quantity": [Cg.moC[0] - 64, Cg.moC[1] + 62],
    "component-condition": [Cg.moC[0] - 76, Cg.moC[1] + 44],
    "material-identity": [M.fgC[0] + 30, M.fgC[1] - 52],
    "material-condition": [M.moC[0] + 130, M.moC[1] - 36],
  };

  const viewBox = compact ? "120 -25 420 910" : frameToViewBox(VIEW);
  // Two drawings on one box: the parts, which blur as the evidence thins, and the
  // read-outs and chips over them, which stay sharp. The machine goes on
  // reporting confident boxes over a picture it can see less and less of.
  return (
    <figure
      className={compact ? "cvt-fan cvt-fan-compact" : "cvt-fan"}
      aria-label={
        compact
          ? "Exploding desk fan with simulated computer-vision read-outs"
          : "Exploding desk fan; the computer-vision read-outs around it open task details"
      }
    >
      <svg
        className="cvt-fan-parts"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* ---- parts (painter's order: back to front), scaled about the centre.
               Each part carries its own segmentation mask + material tint so the
               annotations ride the explode. ---- */}
        <g className="fan-parts">
          <g className="fan-part" style={partStyle(V.nk)}>
            <rect {...nkR} />
            <rect className="ov-segfill" {...nkR} style={{ opacity: segO, "--c": SEG.nk }} />
            <rect className="mat-tint mat-steel" {...nkR} style={{ opacity: matO }} />
          </g>

          <g className="fan-part" style={partStyle(V.ba)}>
            <rect {...baR} />
            <rect x="222" y="692" width="30" height="6" rx="3" />
            <rect x="348" y="692" width="30" height="6" rx="3" />
            <circle className="fan-dot" cx="232" cy="671" r="4" />
            <circle className="fan-dot" cx="250" cy="671" r="4" />
            {/* rating label: the OCR target */}
            <g className="fan-label">
              <rect x="336" y="660" width="44" height="16" rx="2" />
              <line x1="340" y1="665" x2="374" y2="665" />
              <line x1="340" y1="670" x2="366" y2="670" />
            </g>
            <rect className="ov-segfill" {...baR} style={{ opacity: segO, "--c": SEG.ba }} />
            <rect className="mat-tint mat-pcb" {...baR} style={{ opacity: matO }} />
          </g>

          <g className="fan-part" style={partStyle(V.mo)}>
            <rect {...moR} />
            {Array.from({ length: 6 }, (_, i) => 296 + i * 9).map((x) => (
              <line key={x} className="fan-winding" x1={x} y1="384" x2={x} y2="440" />
            ))}
            <circle cx="262" cy="412" r="8" />
            <rect className="ov-segfill" {...moR} style={{ opacity: segO, "--c": SEG.mo }} />
            <rect className="mat-tint mat-cu" {...moR} style={{ opacity: matO }} />
          </g>

          <g className="fan-part" style={partStyle(V.rg)}>
            <circle {...rgRing} className="fan-ring" />
            <circle cx="300" cy="400" r="60" className="fan-ring-thin" />
            <g className="fan-spokes">{spokes(8, 18, 114)}</g>
            <circle
              className="ov-segfill"
              {...rgRing}
              style={{ opacity: `calc(${segO} * 0.6)`, "--c": SEG.rg }}
            />
            <circle className="mat-tint mat-steel" {...rgRing} style={{ opacity: matO }} />
          </g>

          <g className="fan-part" style={partStyle(V.bl)}>
            <g className="fan-spin" data-spin={spinning}>
              {[
                { cls: "fan-petal", style: undefined },
                { cls: "ov-segfill", style: { opacity: segO, "--c": SEG.bl } },
                { cls: "mat-tint mat-abs", style: { opacity: matO } },
              ].map((layer) =>
                BLADES.map((a) => (
                  <path
                    key={`${layer.cls}-${a}`}
                    d={PETAL}
                    transform={`rotate(${a} 300 400)`}
                    className={layer.cls}
                    style={layer.style}
                  />
                )),
              )}
            </g>
            <circle cx="300" cy="400" r="20" className="fan-hub" />
          </g>

          <g className="fan-part" style={partStyle(V.fg)}>
            <circle {...fgRing} className="fan-ring" />
            <circle cx="300" cy="400" r="84" className="fan-ring-thin" />
            <circle cx="300" cy="400" r="46" className="fan-ring-thin" />
            <g className="fan-spokes">{spokes(12, 16, 120)}</g>
            <circle cx="300" cy="400" r="15" className="fan-hub" />
            <circle
              className="ov-segfill"
              {...fgRing}
              style={{ opacity: `calc(${segO} * 0.5)`, "--c": SEG.fg }}
            />
            <circle className="mat-tint mat-steel" {...fgRing} style={{ opacity: matO }} />
          </g>
        </g>
      </svg>

      <svg
        className="cvt-fan-marks"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* ---- CV annotations painted on the product. Every read-out here is a
               mock, so the whole svg is out of the accessibility tree. ---- */}
        {/* product · identity: whole-object detection box + OCR read-out on the label */}
        <Layer scale="Product" focus={deco("product-identity")}>
          <BBox
            x={P.sx(150)}
            y={P.fgC[1] - 132 * P.s}
            w={P.sx(455) - P.sx(150)}
            h={P.baC[1] + 40 * P.s - (P.fgC[1] - 132 * P.s)}
            label="desk_fan · 0.94"
            color={SCALE_VAR.Product}
            s={ts}
          />
          <rect
            className="ov-bbox-r"
            style={{ "--c": SCALE_VAR.Product }}
            x={P.sx(332)}
            y={P.sy(656)}
            width={52 * P.s}
            height={24 * P.s}
          />
          <line className="ov-leader" x1={P.sx(358)} y1={P.sy(682)} x2={P.sx(320)} y2={ocrY + 8} />
          {/* OCR read-out types itself when the chapter arrives */}
          <g
            className="ov-tag ov-ocr"
            data-active={chapter === "Product"}
            transform={`translate(${P.sx(196)} ${ocrY})`}
            style={{ "--ocr-w": `${OCR_W * ts}px`, "--ocr-caret": `${(OCR_W - 11) * ts}px` }}
          >
            <clipPath id={ocrClip}>
              <rect className="ov-ocr-reveal" x="0" y="0" width={OCR_W * ts} height={TAG_H * ts} />
            </clipPath>
            <rect width={OCR_W * ts} height={TAG_H * ts} rx="2" fill={SCALE_VAR.Product} />
            <g clipPath={`url(#${ocrClip})`}>
              <text x={5 * ts} y={15 * ts} fontSize={TAG_FONT * ts}>
                {OCR_TEXT}
              </text>
            </g>
            <rect className="ov-caret" y={4 * ts} width={7 * ts} height={14 * ts} />
          </g>
        </Layer>
        <Layer scale="Product" focus={deco("product-quantity")}>
          <DimV
            x={P.sx(500)}
            y1={P.fgC[1] - 122 * P.s}
            y2={P.baC[1] + 26 * P.s}
            label="~ 430 mm"
            s={ts}
          />
          <DimH
            /* the phone's grown desk_fan tag reaches higher; keep the diameter
               line above it rather than through it */
            y={P.fgC[1] - 140 * P.s - (ts - 1) * 60}
            x1={P.fgC[0] - 122 * P.s}
            x2={P.fgC[0] + 122 * P.s}
            label="Ø ~ 300 mm"
            s={ts}
          />
        </Layer>
        <Layer scale="Product" focus={deco("product-condition")}>
          <ellipse
            className="ov-blob"
            cx={P.baC[0] - 60 * P.s}
            cy={P.baC[1] + 2 * P.s}
            rx={24 * P.s}
            ry={12 * P.s}
          />
          <Tag
            x={P.baC[0] - 90 * P.s}
            y={P.baC[1] + 20 * P.s}
            label="anomaly? · 0.4"
            color={SEG.warn}
            s={ts}
          />
        </Layer>

        {/* component · identity: YOLO-style boxes with class tags */}
        <Layer scale="Component" focus={deco("component-identity")}>
          <BBox
            x={Cg.blC[0] - 106}
            y={Cg.blC[1] - 104}
            w={212}
            h={208}
            label="blade ×3 · 0.91"
            color={SEG.bl}
            s={ts}
          />
          <BBox
            x={Cg.moC[0] - 62}
            y={Cg.moC[1] - 42}
            w={124}
            h={84}
            label="motor · 0.87"
            color={SEG.mo}
            s={ts}
          />
        </Layer>
        {/* component · structure: instance masks (on the parts) + relation queries */}
        <Layer scale="Component" focus={deco("component-structure")}>
          <path
            className="ov-rel"
            d={`M ${Cg.moC[0] - 40} ${Cg.moC[1] - 10} Q ${(Cg.moC[0] + Cg.blC[0]) / 2 + 60} ${(Cg.moC[1] + Cg.blC[1]) / 2 - 40} ${Cg.blC[0] + 44} ${Cg.blC[1] + 24}`}
          />
          <path
            className="ov-rel"
            d={`M ${Cg.blC[0] + 30} ${Cg.blC[1] - 60} Q ${(Cg.blC[0] + Cg.fgC[0]) / 2 + 80} ${(Cg.blC[1] + Cg.fgC[1]) / 2} ${Cg.fgC[0] + 90} ${Cg.fgC[1] + 70}`}
          />
          {/* below the structure chip's plate, which it sat half under; the chip's
              leader still lands on the tag's top edge */}
          <Tag x={Cg.rgC[0] + 96} y={Cg.rgC[1] - 50} label="attached-to?" color={SEG.rg} s={ts} />
        </Layer>
        <Layer scale="Component" focus={deco("component-quantity")}>
          {/* the larger phone label grows upward into the motor box; drop the
              line by the growth so the text clears the box (bottom at moC + 42) */}
          <DimH
            y={Cg.moC[1] + 64 + (ts - 1) * 20}
            x1={Cg.moC[0] - 62}
            x2={Cg.moC[0] + 62}
            label="~ 135 mm"
            s={ts}
          />
        </Layer>
        <Layer scale="Component" focus={deco("component-condition")}>
          <ellipse className="ov-blob" cx={Cg.moC[0] - 40} cy={Cg.moC[1] + 18} rx="18" ry="12" />
          {/* right edge 6 units clear of the motor box's left edge (moC − 62), at
              either tag scale */}
          <Tag
            x={Cg.moC[0] - 68 - tagWidth("anomaly? · 0.6", ts)}
            y={Cg.moC[1] + 2}
            label="anomaly? · 0.6"
            color={SEG.warn}
            s={ts}
          />
        </Layer>

        {/* material · identity: material tags on the tinted parts */}
        <Layer scale="Material" focus={deco("material-identity")}>
          <Tag
            x={M.fgC[0] - 20}
            y={M.fgC[1] - 60}
            label="steel"
            color="var(--cvt-tag-steel)"
            s={ts}
          />
          <Tag x={M.blC[0] - 96} y={M.blC[1] + 26} label="ABS" color="var(--cvt-tag-abs)" s={ts} />
          <Tag x={M.moC[0] + 8} y={M.moC[1] - 6} label="Cu" color="var(--cvt-tag-cu)" s={ts} />
          <Tag x={M.baC[0] - 20} y={M.baC[1] - 8} label="PCB" color="var(--cvt-tag-pcb)" s={ts} />
        </Layer>
        <Layer scale="Material" focus={deco("material-condition")}>
          <ellipse className="ov-blob" cx={M.moC[0] + 42} cy={M.moC[1] - 24} rx="16" ry="11" />
          <Tag
            x={M.moC[0] + 62}
            y={M.moC[1] - 44}
            label="corrosion? · 0.3"
            color={SEG.warn}
            s={ts}
          />
        </Layer>

        {/* each chip's leader runs from its part to the chip's anchored edge,
            under the chip's opaque plate, so it meets the chip wherever the
            plate ends at the chip's font size */}
        {compact
          ? null
          : CHIP_LAYOUT.map(({ id, x, y }) => {
              const lead = LEADS[id];
              if (!lead) return null;
              const c = cell(id);
              return (
                <line
                  key={id}
                  className="ov-leader"
                  x1={lead[0]}
                  y1={lead[1]}
                  x2={x ?? CHIP_RIGHT_EDGE - 4}
                  y2={y - 6}
                  style={{ opacity: PRESENCE[c.scale] }}
                />
              );
            })}
      </svg>

      {/* ---- the chips (the controls), one scene at a time ---- */}
      {compact ? null : (
        <div className="cvt-chips">
          {(Object.keys(DROP_AT) as Scale[]).map((s) => (
            <Drop key={s} scale={s} />
          ))}
          {CHIP_LAYOUT.map(({ id, ...chip }) => (
            <Callout key={id} {...co(id)} {...chip} />
          ))}
        </div>
      )}
    </figure>
  );
}
