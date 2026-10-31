import { useEffect, useId, useRef, useState } from "react";
import type { Scale } from "./data/types";
import {
  FAN_PHOTOS,
  REAL_MODELS,
  type Reading,
  type RealModel,
  removeDownloads,
} from "./realModels";

type State =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; reading: Reading; ms: number }
  | { status: "error"; message: string }
  | { status: "removed" };

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
        Try your own photo
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
  // Each run is tied to the photo it started on: a new photo, or a second run,
  // makes an earlier run's answer stale, and a stale answer is dropped rather
  // than drawn over the wrong photo.
  const runId = useRef(0);
  const choose = (file: File) => {
    runId.current += 1;
    setState({ status: "idle" });
    setOwn(URL.createObjectURL(file));
  };
  const run = async () => {
    const img = image.current;
    if (!img || state.status === "running") return;
    const id = ++runId.current;
    setState({ status: "running" });
    const start = performance.now();
    try {
      const reading = await model.run(img);
      if (id !== runId.current) return;
      setState({ status: "done", reading, ms: Math.round(performance.now() - start) });
    } catch (error) {
      if (id !== runId.current) return;
      setState({
        status: "error",
        message: `Could not analyse the photo: ${error instanceof Error ? error.message : String(error)}. Try again or choose another photo.`,
      });
    }
  };

  return (
    <div className="cvt-real-panel">
      <p className="cvt-real-what">
        {model.name} will {model.task}. It runs in this browser. The first run downloads{" "}
        {model.download}. Your browser keeps the files for next time. Your photo is not sent
        anywhere. <a href={`${import.meta.env.BASE_URL}privacy.html`}>Privacy</a>
      </p>
      {src ? (
        <div className="cvt-real-photo">
          <img ref={image} src={src} alt={own ? "Your photo" : (fan?.alt ?? "")} />
          {state.status === "done" && state.reading.kind === "boxes" && (
            <div className="cvt-real-boxes" aria-hidden="true">
              {state.reading.boxes.map((b, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: each reading replaces the whole list, never reorders it; two boxes can share a label and position
                  key={i}
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
          No example photo is available. Choose a photo of a product to try this tool.
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
              if (file) choose(file);
            }}
          />
        </label>
        {src && (
          // aria-disabled, not disabled: a disabled button drops the focus it holds
          <button type="button" onClick={run} aria-disabled={state.status === "running"}>
            Analyse photo
          </button>
        )}
        <button
          type="button"
          // a download still running would write its files back after the delete
          aria-disabled={state.status === "running"}
          onClick={async () => {
            if (state.status === "running") return;
            try {
              await removeDownloads();
              setState({ status: "removed" });
            } catch (error) {
              setState({
                status: "error",
                message: `Could not remove the saved OWL-ViT files: ${error instanceof Error ? error.message : String(error)}. Try clearing this site’s data in your browser settings.`,
              });
            }
          }}
        >
          Remove OWL-ViT downloads
        </button>
      </div>
      <Result state={state} model={model} />
    </div>
  );
}

/** The status region is always there, so what lands in it is announced. */
function Result({ state, model }: { state: State; model: RealModel }) {
  return (
    <div className="cvt-real-result" role="status">
      {state.status === "running" && <p>Running {model.name}…</p>}
      {state.status === "error" && <p className="cvt-real-error">{state.message}</p>}
      {state.status === "done" && <Answer state={state} model={model} />}
      {state.status === "removed" && (
        <p>
          Saved OWL-ViT files have been removed. Other files may remain in your browser&rsquo;s
          normal cache.
        </p>
      )}
    </div>
  );
}

function Answer({
  state: { reading, ms },
  model,
}: {
  state: Extract<State, { status: "done" }>;
  model: RealModel;
}) {
  return (
    <>
      <p className="cvt-real-stamp">
        One photo, not a test of reliability · {model.name} · {(ms / 1000).toFixed(1)} s (a first
        run includes the download)
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
          {reading.boxes.map((b, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: as for the boxes drawn on the photo
            <li key={i}>
              {b.label}, score {b.score.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
