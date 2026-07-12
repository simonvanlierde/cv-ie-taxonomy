// jest-dom's matchers (toBeInTheDocument, toHaveAttribute, …), typed for Vitest.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { matchMediaStub } from "./test-helpers";

// `globals: false`, so Testing Library cannot register its own auto-cleanup:
// without this, renders pile up in document.body across tests.
afterEach(cleanup);

// jsdom ships no matchMedia; the theme/motion/breakpoint hooks all reach for it.
const defaultMatchMedia = matchMediaStub(() => false);
window.matchMedia = defaultMatchMedia;

// tests that override matchMedia (e.g. to force reduced motion) must not leak
// that override into the next test, so restore the default after each one —
// after cleanup, so unmount effects still see whatever the test set.
afterEach(() => {
  window.matchMedia = defaultMatchMedia;
});

/**
 * jsdom 29 ships HTMLDialogElement but none of its methods (show, showModal,
 * close) and none of its behaviour. The detail panel is a native <dialog>, so
 * without this the tests cannot even mount it.
 *
 * What follows emulates the spec's *modal* contract: `open` reflects state,
 * Esc cancels, and focus returns on close to whatever was focused when the
 * dialog opened. That last part is what the browser does for us in production.
 *
 * So be clear about what the tests below can and cannot prove: they verify OUR
 * half of the contract — that CvTaxonomy focuses the trigger *before* calling
 * showModal, so the browser has the right element to return focus to — and they
 * take the browser's half on trust. Real focus return is only observable in a
 * real engine; if that ever needs proving, this wants Vitest browser mode, not
 * a better polyfill.
 */
if (!HTMLDialogElement.prototype.showModal) {
  const openerOf = new WeakMap<HTMLDialogElement, Element | null>();
  const escapeOf = new WeakMap<HTMLDialogElement, (event: KeyboardEvent) => void>();

  const open = (dialog: HTMLDialogElement, modal: boolean) => {
    if (dialog.hasAttribute("open")) return;
    dialog.setAttribute("open", "");
    if (!modal) return;

    openerOf.set(dialog, document.activeElement);

    // A real modal traps focus, so Esc always reaches the dialog. Here focus is
    // still on the trigger (the component focuses it before showModal), so listen
    // on the document or the key never arrives.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dialog.hasAttribute("open")) return;
      event.preventDefault();
      if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
    };
    escapeOf.set(dialog, onEscape);
    document.addEventListener("keydown", onEscape);
  };

  HTMLDialogElement.prototype.show = function show() {
    open(this, false);
  };

  HTMLDialogElement.prototype.showModal = function showModal() {
    open(this, true);
  };

  HTMLDialogElement.prototype.close = function close(returnValue?: string) {
    if (!this.hasAttribute("open")) return;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.removeAttribute("open");

    const onEscape = escapeOf.get(this);
    if (onEscape) document.removeEventListener("keydown", onEscape);
    escapeOf.delete(this);

    // the spec's focus restore, which is the browser's job in production
    const opener = openerOf.get(this);
    openerOf.delete(this);
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();

    this.dispatchEvent(new Event("close"));
  };
}
