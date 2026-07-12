import { type ReactNode, useState } from "react";
import { CellList, Hero, Outro } from "./CvTaxonomy";
import { CHAPTER_COPY } from "./chapters";
import { SCALES } from "./data/taxonomy";
import type { Cell, InfoType, Scale } from "./data/types";
import { Fan } from "./Fan";
import { SCALE_VAR } from "./theme";
import { plateauCentre } from "./timeline";

/** The fan's explode state per scale step: assembled → exploded → drifted, so
 *  stepping forward literally takes the fan apart. Pinned to each scale's
 *  presence-plateau centre, so these stay on-plateau if TIMELINE is retuned
 *  rather than drifting off a hand-tuned magic number. */
const STEP_P: Record<Scale, number> = {
  Product: plateauCentre("Product"),
  Component: plateauCentre("Component"),
  Material: plateauCentre("Material"),
};

// one stable empty set: the stepper has no info-type filter, and a fresh Set
// each render would defeat CellList's referential quiet
const NO_FILTER: Set<InfoType> = new Set();

/**
 * Mobile act one, paged instead of scrolled. Five steps — intro, the three
 * physical scales, then the full matrix — navigated by arrows, so the fan and
 * the prose never crowd one screen the way the sticky scrub did. Cells still
 * open the shared modal via `onOpen`.
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
  const scale: Scale | null = step >= 1 && step <= 3 ? (SCALES[step - 1] ?? null) : null;
  const isMatrix = step === 4;
  const labels = ["Intro", ...SCALES, "Matrix"];

  return (
    <div className="cvt-stepper">
      <div className="cvt-stepper-top">
        <span className="cvt-hud-tag">overlays illustrative, not model output</span>
        {themeToggle}
      </div>
      <div className="cvt-step" data-step={labels[step]}>
        {/* the fan rides every step but the matrix, walking apart as you advance */}
        {!isMatrix && (
          <div className="cvt-step-stage">
            <Fan
              p={scale ? STEP_P[scale] : 0}
              focus={null}
              isDim={() => false}
              onSelect={() => {}}
              onHover={() => {}}
              reduceMotion={reduceMotion}
              compact
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
            <p className="cvt-eyebrow">
              <span className="cvt-dot" aria-hidden /> {scale} scale
            </p>
            <h2>{CHAPTER_COPY[scale].title}</h2>
            <p className="cvt-body">{CHAPTER_COPY[scale].body}</p>
            {/* no InfoFilter here: a four-row list needs no filtering, and the
                chips only stole space from the fan — the desktop HUD keeps them */}
            <CellList scale={scale} activeInfo={NO_FILTER} onOpen={onOpen} />
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
