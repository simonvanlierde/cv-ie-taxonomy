import { useEffect, useId, useRef, useState } from "react";
import type { Scale } from "./data/types";
import { FAN_PHOTOS, REAL_MODELS, type Reading, type RealModel } from "./realModels";

type State =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; reading: Reading; ms: number }
  | { status: "error"; message: string };

/**
 * A scene's real-model mode: one photo, one model, run in the reader's browser.
 * The drawing stays illustrative; this sits beside it, folded away until asked
 * for, and every result says it is one photo, not validation.
 */
export function RealPhoto({
  scale,
  model = REAL_MODELS[scale],
}: {
  scale: Scale;
  model?: RealModel;
}) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <div className="cvt-real">
      <button
        type="button"
        className="cvt-real-toggle"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((v) => !v)}
      >
        Try a real model on one photo
      </button>
      <div id={panel} hidden={!open}>
        {open && <RealPhotoPanel scale={scale} model={model} />}
      </div>
    </div>
  );
}

function RealPhotoPanel({ scale, model }: { scale: Scale; model: RealModel }) {
  const fan = FAN_PHOTOS[scale]?.[0];
  const [own, setOwn] = useState<string | null>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const image = useRef<HTMLImageElement>(null);
  // the reader's photo is an object URL in this tab only; free it when replaced
  useEffect(() => () => (own ? URL.revokeObjectURL(own) : undefined), [own]);

  const src = own ?? fan?.src ?? null;
  // a new photo clears the last photo's result
  // biome-ignore lint/correctness/useExhaustiveDependencies: src is the trigger, not a value the effect reads
  useEffect(() => setState({ status: "idle" }), [src]);
  const run = async () => {
    const img = image.current;
    if (!img) return;
    setState({ status: "running" });
    const start = performance.now();
    try {
      const reading = await model.run(img);
      setState({ status: "done", reading, ms: Math.round(performance.now() - start) });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="cvt-real-panel">
      <p className="cvt-real-what">
        {model.name} will {model.task}. It runs in this browser and downloads {model.download}; your
        photo is not sent anywhere.
      </p>
      {src ? (
        <div className="cvt-real-photo">
          <img ref={image} src={src} alt={own ? "Your photo" : (fan?.alt ?? "")} />
          {state.status === "done" && state.reading.kind === "boxes" && (
            <div className="cvt-real-boxes" aria-hidden="true">
              {state.reading.boxes.map((b) => (
                <span
                  key={`${b.label}-${b.x}-${b.y}`}
                  style={{
                    left: `${b.x * 100}%`,
                    top: `${b.y * 100}%`,
                    width: `${b.w * 100}%`,
                    height: `${b.h * 100}%`,
                  }}
                >
                  <b>
                    {b.label} · {b.score.toFixed(2)}
                  </b>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="cvt-real-none">
          No photo of this fan has been taken yet. Try your own photo of a product instead.
        </p>
      )}
      <div className="cvt-real-controls">
        <label className="cvt-real-own">
          {own ? "Use another photo" : "Use your own photo"}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setOwn(URL.createObjectURL(file));
            }}
          />
        </label>
        {src && (
          <button type="button" onClick={run} disabled={state.status === "running"}>
            {state.status === "running" ? "Running…" : "Run the model"}
          </button>
        )}
      </div>
      <Result state={state} model={model} />
    </div>
  );
}

function Result({ state, model }: { state: State; model: RealModel }) {
  if (state.status === "error") {
    return (
      <p className="cvt-real-error" role="alert">
        The model could not run here: {state.message}
      </p>
    );
  }
  if (state.status !== "done") return null;
  const { reading, ms } = state;
  return (
    <div className="cvt-real-result" role="status">
      <p className="cvt-real-stamp">
        One photo, not validation · {model.name} · {(ms / 1000).toFixed(1)} s (a first run includes
        the download)
      </p>
      {reading.kind === "text" ? (
        <p>
          Read: <q>{reading.text || "nothing"}</q> (Tesseract&rsquo;s own confidence:{" "}
          {Math.round(reading.confidence)}%)
        </p>
      ) : reading.boxes.length === 0 ? (
        <p>It found nothing it was asked for.</p>
      ) : (
        <ul>
          {reading.boxes.map((b) => (
            <li key={`${b.label}-${b.x}-${b.y}`}>
              {b.label}, score {b.score.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
