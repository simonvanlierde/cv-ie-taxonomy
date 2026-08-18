import { type ReactNode, useState } from "react";
import { CellList, Hero, Outro } from "./CvTaxonomy";
import { CHAPTER_COPY } from "./chapters";
import { SCALES } from "./data/taxonomy";
import type { Cell, InfoType, Scale } from "./data/types";
import { Fan } from "./Fan";
import type { Frame } from "./frames";
import { SCALE_VAR } from "./theme";
import { plateauCentre } from "./timeline";
import { useCamera } from "./useCamera";

/** The fan's explode state per scale step: assembled → exploded → drifted, so
 *  stepping forward literally takes the fan apart. Pinned to each scale's
 *  presence-plateau centre, so these stay on-plateau if TIMELINE is retuned
 *  rather than drifting off a hand-tuned magic number. */
const STEP_P: Record<Scale, number> = {
  Product: plateauCentre("Product"),
  Component: plateauCentre("Component"),
  Material: plateauCentre("Material"),
};

/** Camera frame per fan-bearing step, hand-tuned like FRAMES: the intro holds
 *  the assembled silhouette, the product step pulls back for its dimension
 *  lines and OCR read-out, the explode steps take the full vertical stack.
 *  useCamera springs between them, so paging IS the camera move. */
const INTRO_FRAME: Frame = { x: 150, y: 130, w: 320, h: 640 }; // assembled, no overlays yet
const STEP_FRAMES: Frame[] = [
  INTRO_FRAME,
  { x: 105, y: 90, w: 470, h: 700 }, // product: dims, boxes and OCR in frame
  { x: 120, y: -25, w: 420, h: 920 }, // component: exploded stack
  { x: 130, y: -25, w: 400, h: 900 }, // material: drifted parts
];

// one stable empty set: the stepper has no info-type filter, and a fresh Set
// each render would defeat CellList's referential quiet
const NO_FILTER: Set<InfoType> = new Set();

/**
 * Mobile act one, paged instead of scrolled. Five steps — intro, the three
 * physical scales, then the full matrix — navigated by arrows. The fan owns the
 * whole screen; each step's prose and cells ride a peek sheet at the bottom
 * that scrolls internally, so text never crowds the stage. Cells still open
 * the shared modal via `onOpen`.
 */
export function MobileStepper({
  onOpen,
  reduceMotion,
  themeToggle,
}: {
  onOpen: (cell: Cell, focusId?: string) => void;
  reduceMotion: boolean;
  themeToggle: ReactNode;
}) {
  const [step, setStep] = useState(0);
  // The sheet folds down to its handle on the scale steps, leaving the fan
  // alone on stage. Sticky across steps by choice: a reader who chose the
  // fan-only view keeps it while paging. Intro and matrix always show theirs.
  const [collapsed, setCollapsed] = useState(false);
  const scale: Scale | null = step >= 1 && step <= 3 ? (SCALES[step - 1] ?? null) : null;
  const isMatrix = step === 4;
  const sheetCollapsed = collapsed && scale !== null;
  const labels = ["Intro", ...SCALES, "Matrix"];
  // paging morphs the camera between step frames (reduced motion cuts)
  const viewBox = useCamera(STEP_FRAMES[Math.min(step, 3)] ?? INTRO_FRAME, reduceMotion);

  return (
    <div className="cvt-stepper">
      <div className="cvt-stepper-top">
        <span className="cvt-hud-tag">illustrative read-outs: no model ran here</span>
        {themeToggle}
      </div>
      <div className="cvt-step" data-step={labels[step]} data-collapsed={sheetCollapsed}>
        {/* the fan is the full-screen backdrop on every step but the matrix,
            walking apart as you advance; the sheet floats over its lower third.
            Its overlay labels are the mobile tap targets for the cell modal. */}
        {!isMatrix && (
          <div className="cvt-step-stage">
            <Fan
              p={scale ? STEP_P[scale] : 0}
              focus={null}
              isDim={() => false}
              onSelect={onOpen}
              onHover={() => {}}
              reduceMotion={reduceMotion}
              compact
              viewBox={viewBox}
            />
          </div>
        )}

        {step === 0 && (
          <section className="cvt-step-body cvt-step-intro">
            <Hero />
          </section>
        )}

        {scale && (
          <section className="cvt-step-body" style={{ "--hue": SCALE_VAR[scale] }}>
            <button
              type="button"
              className="cvt-sheet-toggle"
              aria-expanded={!sheetCollapsed}
              aria-label={sheetCollapsed ? "Show this scale's text" : "Hide the text, show the fan"}
              onClick={() => setCollapsed((c) => !c)}
            />
            {!sheetCollapsed && (
              <>
                {/* The one kicker kept on purpose. Desktop names the current
                    scale in the chapter rail; the stepper has no rail, and the
                    chapter titles ("Pulled apart") never say which scale they
                    are, so this is the only wayfinding a phone reader gets. */}
                <p className="cvt-eyebrow">
                  <span className="cvt-dot" aria-hidden /> {scale} scale
                </p>
                <h2>{CHAPTER_COPY[scale].title}</h2>
                <p className="cvt-body">{CHAPTER_COPY[scale].body}</p>
                {/* no InfoFilter here: a four-row list needs no filtering, and the
                    chips only stole space from the fan — the desktop HUD keeps them */}
                <CellList scale={scale} activeInfo={NO_FILTER} onOpen={onOpen} />
              </>
            )}
          </section>
        )}

        {/* the matrix step is the desktop outro verbatim — thesis, explorable,
            caption legend and the text-table twin all come along */}
        {isMatrix && (
          <div className="cvt-step-body">
            <Outro />
          </div>
        )}
      </div>

      <nav className="cvt-stepper-nav" aria-label="Section navigation">
        <button
          type="button"
          className="cvt-stepper-btn"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <span aria-hidden>‹</span> Back
        </button>
        <ol className="cvt-stepper-dots" aria-hidden>
          {labels.map((label, i) => (
            <li key={label} data-active={i === step} />
          ))}
        </ol>
        <button
          type="button"
          className="cvt-stepper-btn cvt-stepper-next"
          onClick={() => setStep((s) => Math.min(4, s + 1))}
          disabled={step === 4}
        >
          {step === 0 ? "Start" : labels[Math.min(step + 1, labels.length - 1)]}{" "}
          <span aria-hidden>›</span>
        </button>
      </nav>
    </div>
  );
}
