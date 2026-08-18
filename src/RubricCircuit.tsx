import type { Cell } from "./data/types";
import { basisText, evidenceText, type Run, runsOf } from "./rubricMarks";

/**
 * The rubric drawn as a run that completes or breaks.
 *
 * A verdict is the highest rung a cell clears on a ladder of three marks, which
 * is a chain: evidence, then capture, then deployment. Printed as `B · ✗ᵘ · ✗`
 * it needs a key; drawn as a run with a break in it, it reads directly — and the
 * paper's central finding becomes visible one cell at a time, because no run
 * anywhere on the sheet reaches the far electrode.
 */
export function RubricCircuit({ cell }: { cell: Cell }) {
  const runs = runsOf(cell);
  if (runs.length === 0) return null;
  return (
    <div className="cvt-circuits">
      {runs.map((run) => (
        <RunLine key={run.label ?? cell.id} run={run} />
      ))}
    </div>
  );
}

function RunLine({ run }: { run: Run }) {
  // the chain dies at its first failure; everything past that carries nothing,
  // which is exactly what the ladder means by "the binding limit"
  const evidenceCarries = run.evidence === "B";
  const captureCarries = evidenceCarries && run.capture === "pass";
  const deployedCarries = captureCarries && run.deployed === "pass";

  return (
    <div className="cvt-circuit">
      {run.label && <p className="cvt-circuit-sub">{run.label}</p>}
      <div className="cvt-circuit-run">
        <span className="cvt-circuit-node" aria-hidden />
        <Seg
          state={evidenceCarries ? "carries" : "breaks"}
          mark={run.evidence}
          text={evidenceText(run.evidence)}
        />
        <Seg
          state={!evidenceCarries ? "dead" : captureCarries ? "carries" : "breaks"}
          mark={run.capture === "pass" ? "✓" : "✗"}
          text={
            run.capture === "pass"
              ? "survives end-of-life capture"
              : (basisText(run.basis) ?? "fails end-of-life capture")
          }
        />
        <Seg
          state={!captureCarries ? "dead" : deployedCarries ? "carries" : "breaks"}
          mark={run.deployed === "pass" ? "✓" : "✗"}
          text={run.deployed === "pass" ? "deployed on the task" : "no deployed precedent"}
        />
        <span className="cvt-circuit-node" data-live={run.completes} aria-hidden />
      </div>
    </div>
  );
}

function Seg({
  state,
  mark,
  text,
}: {
  state: "carries" | "breaks" | "dead";
  mark: string;
  text: string;
}) {
  return (
    <span className="cvt-circuit-seg" data-state={state}>
      <span className="cvt-circuit-line" aria-hidden />
      <b>{mark}</b>
      <em>{text}</em>
    </span>
  );
}
