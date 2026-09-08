import { type RefObject, useEffect, useRef } from "react";

/**
 * The behaviour `<dialog>` used to give us, for a detail region — with modality
 * as a parameter, because it is a property of the layout rather than of the act.
 *
 * A detail drawn ON the sheet is not modal: the drawing, the filters and the
 * other cells are all still there and still usable, and trapping focus inside
 * the enlargement would stop the reader doing the obvious next thing, which is
 * look at another cell. The callouts are the controls; a modal detail makes the
 * controls unreachable. A detail that *covers* the sheet — the mobile bottom
 * sheet — is modal, because the content behind it is genuinely gone.
 *
 * Both get Esc and focus return. Only the covering one traps.
 *
 * Focus goes in on open and back to the opener on close, including when the
 * opener has been re-rendered in the meantime, which is why the caller passes an
 * id rather than a node.
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

function hasOpenPopover(region: HTMLElement): boolean {
  try {
    return region.querySelector(":popover-open") !== null;
  } catch {
    // an engine without the pseudo-class has no popovers to protect
    return false;
  }
}

export function useDialogRegion({
  open,
  onClose,
  returnFocusTo,
  modal = false,
}: {
  open: boolean;
  onClose: () => void;
  /** element id to restore focus to on close; null falls back to the body */
  returnFocusTo: string | null;
  /** true only when the region covers what it belongs to (the mobile sheet) */
  modal?: boolean;
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
        // Esc is scoped to the region, not the document: two details can be
        // open at once on the sheet, and one keypress must not close both. An
        // open popover inside the region (a citation) is nearer than the region
        // and takes the keypress itself; the detail underneath stays.
        if (!region.contains(document.activeElement) || hasOpenPopover(region)) return;
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modal) return;
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

    // A trap needs both halves: the Tab handler guards the region's own edges,
    // and this catches every other route out — a click, a programmatic focus,
    // anything focusable after the region in DOM order. `<dialog>` prevented
    // that class of escape by construction. Modal regions only.
    const onFocusIn = (e: FocusEvent) => {
      if (region.contains(e.target as Node)) return;
      region.focus();
    };

    // A press on the sheet outside the region closes it, as a light dismiss does.
    // A press on a control is that control's business — a sibling callout swaps
    // the detail, a chapter stop navigates — so those are left alone; a popover
    // inside the region (a citation) is in the top layer and takes its own press.
    // Scoped like Esc, and for the same reason: two details can be open at once
    // on the sheet, and one press must close only the one the reader is in.
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!region.contains(document.activeElement)) return;
      if (!target || region.contains(target) || hasOpenPopover(region)) return;
      if (
        target.closest(
          'button, a, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
        )
      )
        return;
      onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    if (modal) document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      const opener = returnTo.current ? document.getElementById(returnTo.current) : null;
      // a callout that has since left the stage is tabindex -1 and aria-hidden;
      // focusing it would put a screen reader on nothing
      const operable = opener && opener.getAttribute("tabindex") !== "-1";
      // Restore when focus was ours to give back: either still inside the region,
      // or already dropped to <body> because the region has just been removed
      // from the DOM. If the reader has moved focus somewhere else entirely,
      // leave them there. The opener is looked up by id, not held as a node,
      // because on desktop the detail replaces the column the opener lives in,
      // so the element that opened this is a different node by the time it
      // comes back.
      const wasOurs =
        region.contains(document.activeElement) || document.activeElement === document.body;
      // preventScroll: the opener is where the reader already was; a chip that
      // sits partly under the chapter rail must not tug the page — and with it
      // the scroll timeline — on its way back
      if (wasOurs) ((operable && opener) || document.body).focus?.({ preventScroll: true });
    };
  }, [open, onClose, modal]);

  return ref;
}
