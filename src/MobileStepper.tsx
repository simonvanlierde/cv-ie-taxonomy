import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { CellList, Hero, IllustrativeDisclosure, MaturityKey, Outro } from "./CvTaxonomy";
import { CHAPTER_COPY } from "./chapters";
import { SCALES } from "./data/taxonomy";
import type { Cell, Scale } from "./data/types";
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
  step,
  setStep,
  collapsed,
  setCollapsed,
  inert = false,
}: {
  onOpen: (cell: Cell, focusId?: string) => void;
  reduceMotion: boolean;
  /** Where the reader is, owned by the parent: the layout seam unmounts this
   *  whole component on a resize, and a reader mid-read must not restart. */
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  /** The sheet folds down to its handle on the scale steps, leaving the fan
   *  alone on stage. Sticky across steps by choice: a reader who chose the
   *  fan-only view keeps it while paging. Intro and matrix always show theirs.
   *  Parent-owned for the same reason as `step`. */
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  /** true while the modal detail sheet covers this, which must take it out of
   *  the accessibility tree — a browse cursor ignores a focus trap */
  inert?: boolean;
}) {
  const [introExpanded, setIntroExpanded] = useState(false);
  const scale: Scale | null = step >= 1 && step <= 3 ? (SCALES[step - 1] ?? null) : null;
  const isMatrix = step === 4;
  const sheetCollapsed = collapsed && scale !== null;
  const labels = ["Intro", ...SCALES, "Matrix"];
  // paging morphs the camera between step frames (reduced motion cuts)
  const viewBox = useCamera(STEP_FRAMES[Math.min(step, 3)] ?? INTRO_FRAME, reduceMotion);

  return (
    <div className="cvt-stepper" inert={inert}>
      <div className="cvt-stepper-top">
        <IllustrativeDisclosure />
      </div>
      <div
        className="cvt-step"
        data-step={labels[step]}
        data-collapsed={sheetCollapsed}
        data-intro-expanded={step === 0 && introExpanded}
      >
        {/* the fan is the full-screen backdrop on every step but the matrix,
            walking apart as you advance; the sheet floats over its lower third.
            Its overlay labels are the mobile tap targets for the cell modal. */}
        {!isMatrix && (
          <div className="cvt-step-stage">
            <Fan
              p={scale ? STEP_P[scale] : 0}
              focus={null}
              onSelect={onOpen}
              onHover={() => {}}
              reduceMotion={reduceMotion}
              compact
              viewBox={viewBox}
            />
          </div>
        )}

        {step === 0 && (
          <section className="cvt-step-body cvt-step-intro" id="cvt-start" tabIndex={-1}>
            <Hero
              expanded={introExpanded}
              detailsId="cvt-intro-more"
              disclosureControl={
                <button
                  type="button"
                  className="cvt-intro-toggle"
                  aria-expanded={introExpanded}
                  aria-controls="cvt-intro-more"
                  onClick={() => setIntroExpanded((expanded) => !expanded)}
                >
                  {introExpanded ? "Show less" : "How to read this"}
                  <span aria-hidden>{introExpanded ? "−" : "+"}</span>
                </button>
              }
            />
          </section>
        )}

        {scale && (
          <section className="cvt-step-body" style={{ "--hue": SCALE_VAR[scale] }}>
            {/* Folded, the sheet still says which scale it holds — a bare
                handle over a full-screen fan gives a reader arriving on the step
                nothing to open, and the four cells behind it are the controls.
                The title sits inside the control so the whole strip is the tap
                target, and the accessible name carries it too. */}
            <button
              type="button"
              className="cvt-sheet-toggle"
              aria-expanded={!sheetCollapsed}
              aria-label={
                sheetCollapsed
                  ? `Show the text for ${CHAPTER_COPY[scale].title}`
                  : "Hide the text, show the fan"
              }
              onClick={() => setCollapsed((c) => !c)}
            >
              {sheetCollapsed && (
                <span className="cvt-sheet-toggle-title">{CHAPTER_COPY[scale].title}</span>
              )}
            </button>
            {!sheetCollapsed && (
              <>
                <h2>{CHAPTER_COPY[scale].title}</h2>
                <MaturityKey />
                {/* the cells before the prose: on a phone the sheet peeks a
                    third of the screen, and the four rows are the controls —
                    under the paragraph they sat below its fold with nothing
                    to say they were there */}
                <CellList scale={scale} onOpen={onOpen} />
                <p className="cvt-step-context-cue" aria-hidden="true">
                  Context below ↓
                </p>
                <p className="cvt-body">{CHAPTER_COPY[scale].body}</p>
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
        {step > 0 ? (
          <button
            type="button"
            className="cvt-stepper-btn"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <span aria-hidden>‹</span> Back
          </button>
        ) : (
          <span className="cvt-stepper-spacer" />
        )}
        <div className="cvt-stepper-progress">
          <p className="cvt-stepper-status" role="status" aria-live="polite" aria-atomic="true">
            {labels[step]} · {step + 1}/{labels.length}
          </p>
          <ol className="cvt-stepper-dots" aria-hidden="true">
            {labels.map((label, i) => (
              <li key={label} data-active={i === step} />
            ))}
          </ol>
        </div>
        {/* named for where it goes; on the last step there is nowhere to go, so
            it leaves the bar rather than sitting there disabled under the name
            of the step the reader is already on */}
        {step < 4 ? (
          <button
            type="button"
            className="cvt-stepper-btn cvt-stepper-next"
            onClick={() => setStep((s) => Math.min(4, s + 1))}
          >
            {step === 0 ? "Start" : labels[step + 1]} <span aria-hidden>›</span>
          </button>
        ) : (
          <span className="cvt-stepper-spacer" />
        )}
      </nav>
    </div>
  );
}
