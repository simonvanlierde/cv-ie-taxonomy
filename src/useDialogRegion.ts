import { type RefObject, useEffect, useRef } from "react";

/**
 * The behaviour `<dialog>` used to give us, for a region that lives in the
 * layout instead of floating over it.
 *
 * The detail is an enlargement drawn on the same sheet: it takes the narrative
 * column's place rather than covering the drawing, so it cannot be a `<dialog>`,
 * which is always in the top layer. That means the three things the element
 * handled natively are ours now — initial focus, a focus trap, and returning
 * focus to whatever opened it — and unlike the native versions they are ours to
 * test.
 *
 * Esc closes. Tab and Shift+Tab cycle inside the region. Focus goes in on open
 * and back to the opener on close, including when the opener has been re-rendered
 * in the meantime, which is why the caller passes an id rather than a node.
 */
const FOCUSABLE = [
  "a[href]",
  // biome-ignore lint/security/noSecrets: a CSS selector, not a credential
  "button:not([disabled])",
  "input",
  "select",
  "textarea",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useDialogRegion({
  open,
  onClose,
  returnFocusTo,
}: {
  open: boolean;
  onClose: () => void;
  /** element id to restore focus to on close; null falls back to the body */
  returnFocusTo: string | null;
}): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement>(null);
  // read inside the cleanup, so a re-render between open and close cannot
  // strand the restore on a stale id
  const returnTo = useRef(returnFocusTo);
  returnTo.current = returnFocusTo;

  useEffect(() => {
    const region = ref.current;
    if (!open || !region) return;

    // focus the region itself rather than its first control: a screen reader
    // then announces the detail's name and role before any button in it
    region.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [...region.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        region.focus();
        return;
      }
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      // the region itself is in the tab ring as its own first stop
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === region)) {
        e.preventDefault();
        last.focus();
      }
    };

    // The Tab handler only guards the region's own two boundaries, which is
    // enough while focus starts inside. It is not enough on its own: anything
    // outside that is still focusable — a matrix cell, a footer link, a click
    // anywhere — puts focus outside, and from there Tab walks the page freely
    // with the region still claiming aria-modal. `<dialog>` prevented that by
    // construction; this is the replacement. focusin catches every route in,
    // pointer and keyboard alike.
    const onFocusIn = (e: FocusEvent) => {
      if (region.contains(e.target as Node)) return;
      region.focus();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const opener = returnTo.current ? document.getElementById(returnTo.current) : null;
      // Restore when focus was ours to give back: either still inside the region,
      // or already dropped to <body> because the region has just been removed
      // from the DOM. If the reader has moved focus somewhere else entirely,
      // leave them there. The opener is looked up by id, not held as a node,
      // because on desktop the detail replaces the column the opener lives in,
      // so the element that opened this is a different node by the time it
      // comes back.
      const wasOurs =
        region.contains(document.activeElement) || document.activeElement === document.body;
      if (wasOurs) (opener ?? document.body).focus?.();
    };
  }, [open, onClose]);

  return ref;
}
