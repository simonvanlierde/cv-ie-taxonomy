import { type ReactNode, useState } from "react";
import { CHAPTER_COPY } from "./chapters";
import { cellAt, INFO_TYPES, SCALES, taxonomy, VERDICT_LETTER } from "./data/taxonomy";
import type { Cell, Scale } from "./data/types";
import { Explorable } from "./Explorable";
import { Fan } from "./Fan";
import { SCALE_HUE, type Theme } from "./theme";
import { TIMELINE } from "./timeline";
import { VerdictSwatch } from "./VerdictSwatch";

/** The fan's explode state per scale step: assembled → exploded → drifted, so
 *  stepping forward literally takes the fan apart. Derived as the centre of each
 *  scale's presence plateau, so these stay on-plateau if TIMELINE is retuned
 *  rather than drifting off a hand-tuned magic number. */
const plateauCentre = (scale: Scale) => {
  const [, plateauStart, plateauEnd] = TIMELINE.presence[scale];
  return (plateauStart + plateauEnd) / 2;
};
const STEP_P: Record<Scale, number> = {
  Product: plateauCentre("Product"),
  Component: plateauCentre("Component"),
  Material: plateauCentre("Material"),
};

/**
 * Mobile act one, paged instead of scrolled. Five steps — intro, the three
 * physical scales, then the full matrix — navigated by arrows, so the fan and
 * the prose never crowd one screen the way the sticky scrub did. Cells still
 * open the shared modal via `onOpen`.
 */
export function MobileStepper({
  onOpen,
  reduceMotion,
  theme,
  onToggleTheme,
  themeIcon,
}: {
  onOpen: (cell: Cell, focusId?: string) => void;
  reduceMotion: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  themeIcon: ReactNode;
}) {
  const [step, setStep] = useState(0);
  const scale: Scale | null = step >= 1 && step <= 3 ? (SCALES[step - 1] ?? null) : null;
  const isMatrix = step === 4;
  const labels = ["Intro", ...SCALES, "Matrix"];

  return (
    <div className="cvt-stepper">
      <div className="cvt-stepper-top">
        <span className="cvt-hud-tag">overlays illustrative, not model output</span>
        <button
          type="button"
          className="cvt-theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {themeIcon}
        </button>
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
            <p className="cvt-eyebrow">Paper 2 · interactive supplement</p>
            <h1 className="cvt-title">
              What can a machine
              <br />
              actually see?
            </h1>
            <p className="cvt-sub">
              An end-of-life desk fan, taken apart by the twelve tasks computer vision is asked to
              do in industrial ecology. Every verdict is the paper's own (
              <span className="cvt-cite">Table&nbsp;S1</span>), shown by{" "}
              <em>ink weight and letter</em>, never colour.
            </p>
            <ul className="cvt-legendline" aria-label="Maturity legend">
              {taxonomy.meta.maturityLevels.map((m) => (
                <li key={m.verdict} title={m.gloss}>
                  <VerdictSwatch verdict={m.verdict} size={18} />
                  <span>
                    <b>{m.letter}</b> {m.verdict}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {scale && (
          <section className="cvt-step-body" style={{ "--hue": SCALE_HUE[scale] }}>
            <p className="cvt-eyebrow">
              <span className="cvt-dot" aria-hidden /> {scale} scale
            </p>
            <h2>{CHAPTER_COPY[scale].title}</h2>
            <p className="cvt-body">{CHAPTER_COPY[scale].body}</p>
            <div className="cvt-mgroup">
              {INFO_TYPES.map((info) => {
                const cell = cellAt(scale, info);
                const hid = `cvt-m-${cell.id}`;
                return (
                  <button
                    key={cell.id}
                    id={hid}
                    type="button"
                    className="cvt-mcell"
                    data-ghost={!!cell.structurallyEmpty}
                    onClick={() => onOpen(cell, hid)}
                  >
                    <VerdictSwatch verdict={cell.maturity} size={20} />
                    <span className="cvt-mcell-info">{info}</span>
                    <span className="cvt-mcell-task">
                      {cell.structurallyEmpty
                        ? "resolved at component scale"
                        : cell.task.split(/[,;]/)[0]}
                    </span>
                    <b>{VERDICT_LETTER[cell.maturity]}</b>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {isMatrix && (
          <section className="cvt-step-body" id="cvt-matrix" aria-label="Full taxonomy matrix">
            <p className="cvt-eyebrow">The full matrix</p>
            <h2 className="cvt-step-thesis">
              Read against its own rubric, the map is largely negative: no task-level cell reaches
              Strong under end-of-life capture.
            </h2>
            <Explorable />
          </section>
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
          {step === 3 ? "Matrix" : step === 0 ? "Start" : labels[step + 1]}{" "}
          <span aria-hidden>›</span>
        </button>
      </nav>
    </div>
  );
}
