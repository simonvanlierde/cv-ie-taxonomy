import { cells, VERDICT_LETTER } from "./data/taxonomy";
import type { Cell } from "./data/types";
import { SCALE_HUE, TIMELINE } from "./theme";
import { VerdictSwatch } from "./VerdictSwatch";

// ---- scroll → animation mapping -----------------------------------------------
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const seg = (p: number, a: number, b: number) => smoothstep(clamp01((p - a) / (b - a)));

// cells by id ("product-identity", …): the JSON ids are the keys
const CELL = new Map(cells.map((c) => [c.id, c]));
const cell = (id: string) => CELL.get(id)!;

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

// Pseudo-depth per part (front positive) for the parallax under the page tilt
const Z = { fg: 3, bl: 2, rg: 1, mo: 0.5, nk: 0, ba: 0 } as const;

const PETAL =
  "M300 400 C318 390 332 372 336 342 C339 316 324 300 306 309 C290 318 283 352 287 384 Z";
const BLADES = [0, 120, 240]; // blade rotations about the hub (300 400)

// Instance-segmentation palette (illustrative CV output, not maturity/scale)
const SEG = {
  fg: "#facc15", // front grille: yellow
  bl: "#22d3ee", // blades: cyan
  rg: "#a78bfa", // rear grille: violet
  mo: "#fb923c", // motor: orange
  nk: "#f472b6", // neck: pink
  ba: "#34d399", // base: green
} as const;

// ---- CV-annotation primitives -----------------------------------------------------
/** YOLO-style class tag: solid colour box, dark text */
function Tag({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  const w = label.length * 6.4 + 10;
  return (
    <g className="ov-tag" transform={`translate(${x} ${y})`}>
      <rect width={w} height="18" rx="2" fill={color} />
      <text x="5" y="13">
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
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
}) {
  return (
    <g className="ov-bbox" style={{ ["--c" as string]: color }}>
      <rect className="ov-bbox-r" x={x} y={y} width={w} height={h} />
      <Tag x={x} y={y - 18} label={label} color={color} />
    </g>
  );
}

function DimV({ x, y1, y2, label }: { x: number; y1: number; y2: number; label: string }) {
  return (
    <g className="ov-dim">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 5} y1={y1} x2={x + 5} y2={y1} />
      <line x1={x - 5} y1={y2} x2={x + 5} y2={y2} />
      <text transform={`translate(${x + 14} ${(y1 + y2) / 2}) rotate(90)`} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function DimH({ y, x1, x2, label }: { y: number; x1: number; x2: number; label: string }) {
  return (
    <g className="ov-dim">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 5} x2={x1} y2={y + 5} />
      <line x1={x2} y1={y - 5} x2={x2} y2={y + 5} />
      <text x={(x1 + x2) / 2} y={y - 8} textAnchor="middle">
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
        key={i}
        x1={cx + r0 * Math.cos(a)}
        y1={cy + r0 * Math.sin(a)}
        x2={cx + r1 * Math.cos(a)}
        y2={cy + r1 * Math.sin(a)}
      />
    );
  });

// ---- interactive info chip (the control) --------------------------------------------
function Callout({
  cell,
  x,
  y,
  text,
  lead,
  leadEdge = "right",
  strike,
  opacity,
  selected,
  onSelect,
  onHover,
}: {
  cell: Cell;
  x: number;
  y: number;
  text: string;
  lead?: readonly [number, number];
  leadEdge?: "right" | "left" | "top";
  strike?: boolean;
  opacity: number;
  selected: boolean;
  onSelect: (cell: Cell, focusId: string) => void;
  onHover: (cell: Cell | null) => void;
}) {
  const letter = VERDICT_LETTER[cell.maturity];
  const w = 50 + text.length * 7.2 + 10;
  const hid = `cvt-co-${cell.id}`;
  const active = opacity > 0.5;
  const start: [number, number] =
    leadEdge === "right" ? [w, -5] : leadEdge === "left" ? [0, -5] : [w / 2, -20];
  return (
    <g
      id={hid}
      className="cvt-co"
      data-ghost={!!cell.structurallyEmpty}
      data-selected={selected}
      role="button"
      tabIndex={active ? 0 : -1}
      aria-label={`${cell.scale} · ${cell.informationType}: ${cell.task}. Maturity: ${cell.maturity}. Open details.`}
      aria-hidden={!active}
      transform={`translate(${x} ${y})`}
      style={{
        opacity,
        pointerEvents: active ? undefined : "none",
        ["--hue" as string]: SCALE_HUE[cell.scale],
      }}
      onClick={() => onSelect(cell, hid)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(cell, hid);
        }
      }}
      onMouseEnter={() => onHover(cell)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(cell)}
      onBlur={() => onHover(null)}
    >
      {lead && (
        <line className="ov-leader" x1={start[0]} y1={start[1]} x2={lead[0] - x} y2={lead[1] - y} />
      )}
      <rect className="cvt-co-bg" x="0" y="-20" width={w} height="30" rx="7" />
      <VerdictSwatch verdict={cell.maturity} size={18} x={8} y={-15} />
      <text className="cvt-co-letter" x="32" y="1">
        {letter}
      </text>
      <text className="cvt-co-text" x="50" y="0">
        {text}
      </text>
      {strike && <line className="ov-strike" x1="48" y1="-5" x2={w - 8} y2="-5" />}
    </g>
  );
}

// ---- the fan --------------------------------------------------------------------------
export function Fan({
  p,
  focus,
  isDim,
  onSelect,
  onHover,
  reduceMotion,
  compact = false,
}: {
  /** global scroll progress 0..1 */
  p: number;
  /** hovered/selected cell: isolates its overlay annotations */
  focus: Cell | null;
  /** info-type filter gate */
  isDim: (cell: Cell) => boolean;
  onSelect: (cell: Cell, focusId: string) => void;
  onHover: (cell: Cell | null) => void;
  reduceMotion: boolean;
  /** mobile: fan + annotations, no floating chips */
  compact?: boolean;
}) {
  const e = seg(p, TIMELINE.explode[0], TIMELINE.explode[1]);
  const m = seg(p, TIMELINE.drift[0], TIMELINE.drift[1]);
  const k = e + 0.1 * m;
  // assembled fan fills the canvas headroom; eases to 1 as the stack needs it
  const s = compact ? 1 : 1.3 - 0.3 * e;
  const O = [300, 440] as const; // scale origin
  const sx = (x: number) => (x - O[0]) * s + O[0];
  const sy = (y: number) => (y - O[1]) * s + O[1];

  // chapter presence per scale, faded in/out with scroll
  const win = (w: readonly number[]) => seg(p, w[0], w[1]) * (1 - seg(p, w[2], w[3]));
  const presence: Record<Cell["scale"], number> = {
    Product: win(TIMELINE.presence.Product),
    Component: win(TIMELINE.presence.Component),
    Material: win(TIMELINE.presence.Material),
  };

  // pseudo-3D: the whole sheet tilts with scroll (flat at hero/outro, max
  // mid-explode); exploded parts get a small depth parallax so the stack
  // reads as layered, not flat
  const ry = compact ? 0 : 6 * Math.sin(p * Math.PI); // degrees
  const par = (z: number) => z * ry * 1.8 * k; // px shift, only when exploded

  const at = (v: readonly [number, number], z = 0) => `translate(${v[0] * k + par(z)} ${v[1] * k})`;
  const cc = (base: readonly [number, number], v: readonly [number, number], z = 0) =>
    [sx(base[0] + v[0] * k) + par(z), sy(base[1] + v[1] * k)] as const;

  const blC = cc(C.fan, V.bl, Z.bl);
  const fgC = cc(C.fan, V.fg, Z.fg);
  const rgC = cc(C.fan, V.rg, Z.rg);
  const moC = cc(C.mo, V.mo, Z.mo);
  const baC = cc(C.ba, V.ba, Z.ba);

  // chip opacity: chapter presence × filter/focus factors
  const chip = (c: Cell) =>
    presence[c.scale] * (isDim(c) ? 0.15 : focus && focus.id !== c.id ? 0.45 : 1);
  // annotation opacity: strong when its chapter is active, isolated on hover/focus
  const deco = (c: Cell, base = 0.85) =>
    presence[c.scale] * (isDim(c) ? 0 : focus ? (focus.id === c.id ? 1 : 0.05) : base);

  const co = (id: string) => ({
    cell: cell(id),
    opacity: chip(cell(id)),
    selected: focus?.id === cell(id).id,
    onSelect,
    onHover,
  });

  // a worn fan shouldn't spin merrily: hovering a Condition cell stops it
  const spinning = !compact && !reduceMotion && e < 0.15 && focus?.informationType !== "Condition";
  const segO = deco(cell("component-structure"), 0.6);
  const matO = deco(cell("material-identity"), 0.7);

  // each part's primary silhouette, defined once and reused by the part, its
  // segmentation mask and its material tint (they must stay pixel-aligned)
  const nkR = { x: 288, y: 480, width: 24, height: 180, rx: 8 };
  const baR = { x: 205, y: 650, width: 190, height: 42, rx: 14 };
  const moR = { x: 251, y: 376, width: 110, height: 72, rx: 16 };
  const rgRing = { cx: 300, cy: 400, r: 116 };
  const fgRing = { cx: 300, cy: 400, r: 122 };

  return (
    <svg
      className={compact ? "cvt-fan cvt-fan-compact" : "cvt-fan"}
      viewBox={compact ? "120 -40 420 910" : "-250 -25 1070 950"}
      role="group"
      aria-label="Exploding desk fan; the computer-vision read-outs around it open task details"
      preserveAspectRatio="xMidYMid meet"
      style={
        compact ? undefined : { transform: `perspective(1200px) rotateX(1.2deg) rotateY(${ry}deg)` }
      }
    >
      {/* ---- parts (painter's order: back to front), scaled about the centre.
             Each part carries its own segmentation mask + material tint so the
             annotations ride the explode. ---- */}
      <g transform={`translate(${O[0] * (1 - s)} ${O[1] * (1 - s)}) scale(${s})`}>
        <g className="fan-part" transform={at(V.nk, Z.nk)}>
          <rect {...nkR} />
          <rect
            className="ov-segfill"
            {...nkR}
            style={{ opacity: segO, ["--c" as string]: SEG.nk }}
          />
          <rect className="mat-tint mat-steel" {...nkR} style={{ opacity: matO }} />
        </g>

        <g className="fan-part" transform={at(V.ba, Z.ba)}>
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
          <rect
            className="ov-segfill"
            {...baR}
            style={{ opacity: segO, ["--c" as string]: SEG.ba }}
          />
          <rect className="mat-tint mat-pcb" {...baR} style={{ opacity: matO }} />
        </g>

        <g className="fan-part" transform={at(V.mo, Z.mo)}>
          <rect {...moR} />
          {Array.from({ length: 6 }, (_, i) => (
            <line
              key={i}
              className="fan-winding"
              x1={296 + i * 9}
              y1="384"
              x2={296 + i * 9}
              y2="440"
            />
          ))}
          <circle cx="262" cy="412" r="8" />
          <rect
            className="ov-segfill"
            {...moR}
            style={{ opacity: segO, ["--c" as string]: SEG.mo }}
          />
          <rect className="mat-tint mat-cu" {...moR} style={{ opacity: matO }} />
        </g>

        <g className="fan-part" transform={at(V.rg, Z.rg)}>
          <circle {...rgRing} className="fan-ring" />
          <circle cx="300" cy="400" r="60" className="fan-ring-thin" />
          <g className="fan-spokes">{spokes(8, 18, 114)}</g>
          <circle
            className="ov-segfill"
            {...rgRing}
            style={{ opacity: segO * 0.6, ["--c" as string]: SEG.rg }}
          />
          <circle className="mat-tint mat-steel" {...rgRing} style={{ opacity: matO }} />
        </g>

        <g className="fan-part" transform={at(V.bl, Z.bl)}>
          <g className="fan-spin" data-spin={spinning}>
            {[
              { cls: "fan-petal", style: undefined },
              { cls: "ov-segfill", style: { opacity: segO, ["--c" as string]: SEG.bl } },
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

        <g className="fan-part" transform={at(V.fg, Z.fg)}>
          <circle {...fgRing} className="fan-ring" />
          <circle cx="300" cy="400" r="84" className="fan-ring-thin" />
          <circle cx="300" cy="400" r="46" className="fan-ring-thin" />
          <g className="fan-spokes">{spokes(12, 16, 120)}</g>
          <circle cx="300" cy="400" r="15" className="fan-hub" />
          <circle
            className="ov-segfill"
            {...fgRing}
            style={{ opacity: segO * 0.5, ["--c" as string]: SEG.fg }}
          />
          <circle className="mat-tint mat-steel" {...fgRing} style={{ opacity: matO }} />
        </g>
      </g>

      {/* ---- CV annotations painted on the product ---- */}
      {/* product · identity: whole-object detection box + OCR read-out on the label */}
      <g className="ov-layer" style={{ opacity: deco(cell("product-identity")) }}>
        <BBox
          x={sx(150)}
          y={fgC[1] - 132 * s}
          w={sx(455) - sx(150)}
          h={baC[1] + 40 * s - (fgC[1] - 132 * s)}
          label="desk_fan · 0.94"
          color={SCALE_HUE.Product}
        />
        <rect
          className="ov-bbox-r"
          style={{ ["--c" as string]: SCALE_HUE.Product }}
          x={sx(332 + 16 * k)}
          y={sy(656 + 124 * k)}
          width={52 * s}
          height={24 * s}
        />
        <line
          className="ov-leader"
          x1={sx(358 + 16 * k)}
          y1={sy(682 + 124 * k)}
          x2={sx(320)}
          y2={sy(736)}
        />
        {/* OCR read-out types itself when the chapter arrives */}
        <g
          className="ov-tag ov-ocr"
          data-active={presence.Product > 0.5}
          transform={`translate(${sx(196)} ${sy(728)})`}
        >
          <clipPath id="cvt-ocr-clip">
            <rect className="ov-ocr-reveal" x="0" y="0" width="125" height="18" />
          </clipPath>
          <rect width="125" height="18" rx="2" fill={SCALE_HUE.Product} />
          <g clipPath="url(#cvt-ocr-clip)">
            <text x="5" y="13">
              OCR ▸ "TYP 4212/A"
            </text>
          </g>
          <rect className="ov-caret" y="3" width="6" height="12" />
        </g>
      </g>
      <g className="ov-layer" style={{ opacity: deco(cell("product-quantity")) }}>
        <DimV x={sx(500)} y1={fgC[1] - 122 * s} y2={baC[1] + 26 * s} label="≈ 430 mm" />
        <DimH y={fgC[1] - 140 * s} x1={fgC[0] - 122 * s} x2={fgC[0] + 122 * s} label="⌀ ≈ 300 mm" />
      </g>
      <g className="ov-layer" style={{ opacity: deco(cell("product-condition")) }}>
        <ellipse
          className="ov-blob"
          cx={baC[0] - 60 * s}
          cy={baC[1] + 2 * s}
          rx={24 * s}
          ry={12 * s}
        />
        <Tag x={baC[0] - 90 * s} y={baC[1] + 20 * s} label="anomaly? · 0.4" color="#ffb454" />
      </g>

      {/* component · identity: YOLO-style boxes with class tags */}
      <g className="ov-layer" style={{ opacity: deco(cell("component-identity")) }}>
        <BBox
          x={blC[0] - 106}
          y={blC[1] - 104}
          w={212}
          h={208}
          label="blade ×3 · 0.91"
          color={SEG.bl}
        />
        <BBox x={moC[0] - 62} y={moC[1] - 42} w={124} h={84} label="motor · 0.87" color={SEG.mo} />
      </g>
      {/* component · structure: instance masks (on the parts) + relation queries */}
      <g className="ov-layer" style={{ opacity: deco(cell("component-structure")) }}>
        <path
          className="ov-rel"
          d={`M ${moC[0] - 40} ${moC[1] - 10} Q ${(moC[0] + blC[0]) / 2 + 60} ${(moC[1] + blC[1]) / 2 - 40} ${blC[0] + 44} ${blC[1] + 24}`}
        />
        <path
          className="ov-rel"
          d={`M ${blC[0] + 30} ${blC[1] - 60} Q ${(blC[0] + fgC[0]) / 2 + 80} ${(blC[1] + fgC[1]) / 2} ${fgC[0] + 90} ${fgC[1] + 70}`}
        />
        <Tag x={rgC[0] + 96} y={rgC[1] - 66} label="attached-to?" color={SEG.rg} />
      </g>
      <g className="ov-layer" style={{ opacity: deco(cell("component-quantity")) }}>
        <DimH y={moC[1] + 64} x1={moC[0] - 62} x2={moC[0] + 62} label="≈ 135 mm" />
      </g>
      <g className="ov-layer" style={{ opacity: deco(cell("component-condition")) }}>
        <ellipse className="ov-blob" cx={moC[0] - 40} cy={moC[1] + 18} rx="18" ry="12" />
        <Tag x={moC[0] - 168} y={moC[1] + 2} label="anomaly? · 0.6" color="#ffb454" />
      </g>

      {/* material · identity: material tags on the tinted parts */}
      <g className="ov-layer" style={{ opacity: deco(cell("material-identity")) }}>
        <Tag x={fgC[0] - 20} y={fgC[1] - 60} label="steel" color="#9ba7b0" />
        <Tag x={blC[0] - 96} y={blC[1] + 26} label="ABS" color="#8b97a3" />
        <Tag x={moC[0] + 8} y={moC[1] - 6} label="Cu" color="#b87333" />
        <Tag x={baC[0] - 20} y={baC[1] - 8} label="PCB" color="#2e7d4f" />
      </g>
      <g className="ov-layer" style={{ opacity: deco(cell("material-condition")) }}>
        <ellipse className="ov-blob" cx={moC[0] + 42} cy={moC[1] - 24} rx="16" ry="11" />
        <Tag x={moC[0] + 62} y={moC[1] - 44} label="corrosion? · 0.3" color="#ffb454" />
      </g>

      {compact ? null : (
        <>
          {/* ---- floating info chips (the controls), one chapter at a time ---- */}
          {/* product (assembled fan) */}
          <Callout
            {...co("product-identity")}
            x={-240}
            y={770}
            text="OCR + db-match ✓"
            lead={[sx(196), sy(737)]}
          />
          <Callout
            {...co("product-quantity")}
            x={600}
            y={430}
            text="H ≈ 430 · ⌀ ≈ 300"
            leadEdge="left"
            lead={[sx(500) + 14, sy(400)]}
          />
          <Callout
            {...co("product-condition")}
            x={-240}
            y={580}
            text="wear? (unvalidated)"
            lead={[baC[0] - 92 * s, baC[1] + 12 * s]}
          />
          <Callout {...co("product-structure")} x={-240} y={870} text="structure → component" />

          {/* component (exploded fan) */}
          <Callout
            {...co("component-identity")}
            x={-245}
            y={140}
            text="detect ▸ 6 parts"
            lead={[blC[0] - 106, blC[1] - 112]}
          />
          <Callout
            {...co("component-structure")}
            x={570}
            y={300}
            text="segment · attached-to? E"
            leadEdge="left"
            lead={[rgC[0] + 100, rgC[1] - 52]}
          />
          <Callout
            {...co("component-quantity")}
            x={-245}
            y={560}
            text="dims ▸ motor ≈ 135 mm"
            lead={[moC[0] - 64, moC[1] + 62]}
          />
          <Callout
            {...co("component-condition")}
            x={-245}
            y={690}
            text="brush wear? (unvalidated)"
            lead={[moC[0] - 76, moC[1] + 44]}
          />

          {/* material (drifted parts) */}
          <Callout
            {...co("material-identity")}
            x={570}
            y={170}
            text="steel · ABS · Cu · PCB"
            leadEdge="left"
            lead={[fgC[0] + 30, fgC[1] - 52]}
          />
          <Callout
            {...co("material-quantity")}
            x={-245}
            y={140}
            text="mass (derived only)"
            strike
          />
          <Callout {...co("material-structure")} x={570} y={470} text="structure → component" />
          <Callout
            {...co("material-condition")}
            x={570}
            y={640}
            text="corrosion? (unvalidated)"
            leadEdge="left"
            lead={[moC[0] + 130, moC[1] - 36]}
          />
        </>
      )}
    </svg>
  );
}
