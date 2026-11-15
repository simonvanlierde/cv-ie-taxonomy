import { flushSync } from "react-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (
    cb: () => void,
  ) => { ready?: Promise<unknown>; finished?: Promise<unknown> } | undefined;
};

/** Run a DOM mutation inside a view transition when supported and enabled;
 *  otherwise just run it. Keeps the morph a pure progressive enhancement. */
export function withViewTransition(run: () => void, enabled: boolean): void {
  const doc = document as ViewTransitionDocument;
  if (enabled && typeof doc.startViewTransition === "function") {
    // flushSync commits the state update *inside* the transition callback, so the
    // browser's after-snapshot sees the open panel; without it React batches the
    // setState past the snapshot and nothing morphs. Safe here: only ever called
    // from an event handler (openCell ← onClick), never during render.
    // The browser aborts the morph if, say, the viewport resizes, and rejects `ready`.
    // The update itself still ran, so there is nothing to recover.
    doc.startViewTransition(() => flushSync(run))?.ready?.catch(() => {});
  } else {
    run();
  }
}

/** Remove a style property only if it still holds the value this caller set: two
 *  transitions can share an element (a bay pressed mid-flight), and one's cleanup
 *  must not strip the other's name. */
export function unset(el: HTMLElement | null | undefined, prop: string, value: string): void {
  if (el?.style.getPropertyValue(prop) === value) el.style.removeProperty(prop);
}

/**
 * The closing move: each named cell's chip flies into its matrix cell. Each pair
 * shares one view-transition-name, on the chip for the old snapshot and on the
 * cell for the new one, so the browser animates the chip's box into the cell's.
 * Nothing else changes, so a browser without view transitions loses nothing.
 */
export function flyIntoMap(ids: readonly string[]): void {
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== "function") return;
  const pairs = ids.flatMap((id) => {
    const chip = document.getElementById(`cvt-co-${id}`);
    const cell = document.getElementById(`cvt-mx-${id}`);
    return chip && cell ? [{ chip, cell, name: `cvt-fly-${id}` }] : [];
  });
  if (pairs.length === 0) return;
  for (const p of pairs) {
    p.chip.style.setProperty("view-transition-name", p.name);
    // the class gives the flight its own timing (::view-transition-group in CSS)
    p.chip.style.setProperty("view-transition-class", "cvt-fly");
    p.cell.style.setProperty("view-transition-class", "cvt-fly");
  }
  const t = doc.startViewTransition(() => {
    for (const p of pairs) {
      p.chip.style.removeProperty("view-transition-name");
      p.cell.style.setProperty("view-transition-name", p.name);
    }
  });
  const clear = () => {
    for (const p of pairs) {
      unset(p.cell, "view-transition-name", p.name);
      unset(p.chip, "view-transition-class", "cvt-fly");
      unset(p.cell, "view-transition-class", "cvt-fly");
    }
  };
  // aborted or done, the names come off so the next open-cell morph is clean
  t?.ready?.catch(() => {});
  t?.finished?.then(clear, clear);
}

/**
 * The map's opening move, the reverse of the closing flight: the bay the reader
 * pressed morphs into the head of the detail it opens. One view-transition-name
 * sits on the bay for the old snapshot and on the detail's head for the new one,
 * and both come off when the transition ends or is aborted. The fan's chips are
 * not on screen at the map (the stage has unpinned), so the detail's head is the
 * label the bay becomes. Without the API, or under reduced motion, it just runs.
 */
/** The running morph's cleanup: a new morph ends the old one first, so two
 *  bays never carry the same name, and a superseded morph's late cleanup is a no-op. */
let endMorph: (() => void) | null = null;

export function morphBayIntoDetail(bay: HTMLElement | null, run: () => void): void {
  const doc = document as ViewTransitionDocument;
  if (
    !bay ||
    typeof doc.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    run();
    return;
  }
  endMorph?.();
  let head: HTMLElement | null = null;
  const root = document.documentElement;
  const clear = () => {
    if (endMorph !== clear) return;
    endMorph = null;
    root.classList.remove("cvt-bay-morphing");
    for (const el of [bay, head]) {
      unset(el, "view-transition-name", "cvt-bay");
      unset(el, "view-transition-class", "cvt-bay");
    }
  };
  endMorph = clear;
  bay.style.setProperty("view-transition-name", "cvt-bay");
  bay.style.setProperty("view-transition-class", "cvt-bay");
  // the page cuts over at once: only the bay moves, so nothing else is doubled mid-fade
  root.classList.add("cvt-bay-morphing");
  const t = doc.startViewTransition(() => {
    bay.style.removeProperty("view-transition-name");
    flushSync(run);
    head = document.querySelector<HTMLElement>(".cvt-inline-head");
    head?.style.setProperty("view-transition-name", "cvt-bay");
    head?.style.setProperty("view-transition-class", "cvt-bay");
  });
  if (!t) {
    clear();
    return;
  }
  t.ready?.catch(() => {});
  t.finished?.then(clear, clear);
}
