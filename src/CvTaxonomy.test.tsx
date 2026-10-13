import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CvTaxonomy, cameraTransform, frameFor, Outro, withViewTransition } from "./CvTaxonomy";
import { cellById } from "./data/taxonomy";
import { CHAPTER_FRAMES, VIEW } from "./frames";
import { matchMediaStub } from "./test-helpers";

/**
 * The detail is an enlargement drawn on the sheet, not a <dialog>: on desktop it
 * takes the narrative column's place rather than floating over the drawing. That
 * means the focus trap, Esc and focus return are the component's own (see
 * useDialogRegion), so unlike the native versions they can actually be asserted
 * here rather than taken on trust.
 */

/** the fan's callout chips are the desktop controls, id `cvt-co-<cellId>`; a chip is
 *  operable only while its scale's scene is on stage, so tests that click one
 *  pin that scene via `debugChapter` */
const trigger = (cellId: string) => document.getElementById(`cvt-co-${cellId}`) as HTMLElement;

describe("detail on the sheet (desktop)", () => {
  const detail = () => screen.findByRole("complementary", { name: /component · identity/i });

  it("opens on a cell click, and shows that cell's verdict", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Component" />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    await user.click(trigger("component-identity"));

    const region = await detail();
    expect(within(region).getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(within(region).getByText(/no model run/i)).toBeInTheDocument();
  });

  it("moves focus into the detail when it opens", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Component" />);

    await user.click(trigger("component-identity"));
    expect(await detail()).toHaveFocus();
  });

  it("does not trap focus: the sheet it is drawn on stays usable", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Component" />);

    await user.click(trigger("component-identity"));
    const region = await detail();

    // Deliberate. An enlargement drawn ON the sheet is not modal: the drawing,
    // the other eleven cells are still there, and the obvious
    // next thing a reader does is look at another cell. Trapping made the fan's
    // own callouts — the controls — unreachable while a detail was open.
    const outside = document.querySelector<HTMLElement>(".cvt-footer a");
    outside?.focus();
    expect(region.contains(document.activeElement)).toBe(false);
    expect(outside).toHaveFocus();
  });

  it("ignores Esc while focus is elsewhere on the sheet: two details can be open at once, and one keypress must not close both", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Component" />);

    await user.click(trigger("component-identity"));
    await detail();
    document.querySelector<HTMLElement>(".cvt-footer a")?.focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("closes on Esc, landing focus back on the cell that opened it", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Component" />);

    await user.click(trigger("component-identity"));
    await detail();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    // by id, not by node: the detail replaces the column the opener lives in,
    // so the element that comes back is a different node
    expect(trigger("component-identity")).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("closes on the detail's own close button", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Material" />);

    await user.click(trigger("material-identity"));
    const region = await screen.findByRole("complementary", { name: /material · identity/i });

    await user.click(within(region).getByRole("button", { name: /close details/i }));

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("steps to a sibling cell of the same chapter on ArrowRight while the detail has focus", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Material" />);

    await user.click(trigger("material-identity"));
    const region = await screen.findByRole("complementary", { name: /material · identity/i });
    expect(region).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(
      await screen.findByRole("complementary", { name: /material · quantity/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: /material · identity/i })).toBeNull();
  });

  it("closes on the browser's Back", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Material" />);

    await user.click(trigger("material-identity"));
    await screen.findByRole("complementary", { name: /material · identity/i });
    const entry = history.state?.cvtDetail;
    expect(entry).toBeTruthy();

    await act(async () => {
      history.back();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(history.state?.cvtDetail).not.toBe(entry);
  });

  it("keeps one history entry however many details are opened and closed with ×", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Material" />);
    const lengths: number[] = [];

    for (let i = 0; i < 3; i++) {
      await user.click(trigger("material-identity"));
      const region = await screen.findByRole("complementary", { name: /material · identity/i });
      await user.click(within(region).getByRole("button", { name: /close details/i }));
      lengths.push(history.length);
    }

    expect(new Set(lengths).size).toBe(1);
  });

  it("closes on a press on the sheet outside it, but not on a press on a control", async () => {
    const user = userEvent.setup();
    const { container } = render(<CvTaxonomy debugChapter="Material" />);

    await user.click(trigger("material-identity"));
    const region = await screen.findByRole("complementary", { name: /material · identity/i });

    // a control outside is that control's business: a chapter stop navigates
    const chapters = screen.getByRole("navigation", { name: "Scenes" });
    await user.click(within(chapters).getByRole("button", { name: /^component$/i }));
    expect(screen.getByRole("complementary")).toBeInTheDocument();

    // open ground on the sheet dismisses the detail the reader is in — the press
    // is scoped to whichever region holds focus, so put focus back first (the
    // toggle above took it), as clicking into the detail would
    region.focus();
    await user.click(container.querySelector(".cvt-outro h2") as HTMLElement);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("dismisses only the detail that owns focus when two are open", async () => {
    // Act one's docked detail and act two's inline one can be open together, so
    // a background press must be scoped the way Esc is: one press, one close.
    const user = userEvent.setup();
    const { container } = render(<CvTaxonomy debugChapter="Material" />);

    await user.click(trigger("material-identity"));
    await screen.findByRole("complementary", { name: /material · identity/i });
    await user.click(document.getElementById("cvt-mx-component-quantity") as HTMLElement);
    await screen.findByRole("complementary", { name: /component · quantity/i });

    await user.click(container.querySelector(".cvt-outro h2") as HTMLElement);

    expect(screen.queryByRole("complementary", { name: /component · quantity/i })).toBeNull();
    expect(screen.getByRole("complementary", { name: /material · identity/i })).toBeInTheDocument();
  });

  it("deep-links straight into a cell's detail via initialCell", async () => {
    const cell = cellById("material-quantity");
    render(<CvTaxonomy initialCell={cell.id} />);

    const region = await screen.findByRole("complementary", { name: /material · quantity/i });
    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent(cell.task);
    expect(within(region).getByText(/simulated read-outs/i)).toBeInTheDocument();
  });

  it("defines EoL before source copy uses the abbreviation", async () => {
    render(<CvTaxonomy initialCell="product-identity" debugChapter="Product" />);

    const region = await screen.findByRole("complementary", { name: /product · identity/i });
    expect(region.querySelector(".cvt-term-note")).toHaveTextContent(
      /End-of-life \(EoL\) capture means photos of products after use/i,
    );
  });

  it("offers a deep-link return to the start", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<CvTaxonomy initialCell="material-quantity" />);

    const region = await screen.findByRole("complementary", { name: /material · quantity/i });
    await user.click(within(region).getByRole("button", { name: "Back to start" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    scrollTo.mockRestore();
  });

  it("lands focus on the deep-linked cell's own callout when its detail closes", async () => {
    // a deep link has no opener to return to; the cell's chip stands in, and
    // the link has scrolled its chapter on stage so the chip is operable
    const user = userEvent.setup();
    render(<CvTaxonomy initialCell="material-quantity" debugChapter="Material" />);
    const region = await screen.findByRole("complementary", { name: /material · quantity/i });
    region.focus();
    await user.keyboard("{Escape}");
    expect(trigger("material-quantity")).toHaveFocus();
  });

  it("ignores an initialCell that names no cell, rather than throwing", () => {
    render(<CvTaxonomy initialCell="not-a-cell" />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});

describe("detail as a sheet (mobile)", () => {
  // Modality follows the layout, not the act: the mobile detail covers the
  // drawing it belongs to, so unlike the desktop one it is a real modal.
  const mobile = () => {
    window.matchMedia = matchMediaStub((q) => q.includes("max-width"));
  };

  it("is a modal dialog, and keeps Tab inside itself", async () => {
    mobile();
    const user = userEvent.setup();
    render(<CvTaxonomy initialCell="component-identity" />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    for (let i = 0; i < 12; i++) await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("lists each scene's cells as buttons, since the phone's fan has no chips", async () => {
    mobile();
    const user = userEvent.setup();
    const { container } = render(<CvTaxonomy />);
    expect(container.querySelector(".cvt-co")).toBeNull();

    const product = container.querySelector("#cvt-ch-Product") as HTMLElement;
    await user.click(within(product).getByRole("button", { name: /^Product · Identity/ }));
    expect(await screen.findByRole("dialog", { name: /product · identity/i })).toBeInTheDocument();
  });

  it("takes the scenes behind it out of the accessibility tree while it is open", async () => {
    // The trap only catches Tab and focus; a browse cursor walks the DOM. `inert`
    // is what actually removes the scenes' controls from behind the sheet.
    mobile();
    const user = userEvent.setup();
    const { container } = render(<CvTaxonomy initialCell="component-identity" />);
    const scenes = container.querySelector(".cvt-scroll") as HTMLElement;

    const dialog = await screen.findByRole("dialog");
    expect(scenes).toHaveAttribute("inert");

    await user.click(within(dialog).getByRole("button", { name: /close details/i }));
    expect(scenes).not.toHaveAttribute("inert");
  });

  it("pulls focus back when something outside it takes focus", async () => {
    mobile();
    render(<CvTaxonomy initialCell="component-identity" />);
    const dialog = await screen.findByRole("dialog");

    document.querySelector<HTMLElement>(".cvt-footer a")?.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe("theme has a single owner", () => {
  it("follows the theme prop, and keeps following it when it changes", () => {
    const { container, rerender } = render(<CvTaxonomy theme="light" />);
    const island = () => container.querySelector(".cvt");

    expect(island()).toHaveAttribute("data-theme", "light");

    // seeding state from the prop froze it at mount: the island never followed
    rerender(<CvTaxonomy theme="dark" />);
    expect(island()).toHaveAttribute("data-theme", "dark");
  });

  it("stamps an explicit theme on <html>, so the page behind the island matches", () => {
    render(<CvTaxonomy theme="dark" />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("leaves the host document alone when no theme is forced", () => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";

    render(<CvTaxonomy />);

    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(document.documentElement.style.colorScheme).toBe("");
  });

  it("restores the host document on unmount", () => {
    document.documentElement.removeAttribute("data-theme");
    const { unmount } = render(<CvTaxonomy theme="dark" />);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    unmount();
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  // There is no in-page theme control: `?theme=` wins, and without it the OS
  // decides.
  it("offers no theme control", () => {
    render(<CvTaxonomy theme="light" />);
    expect(screen.queryByRole("button", { name: /theme/i })).not.toBeInTheDocument();
  });
});

// Force reduced motion ON (so the camera cuts instantly and is deterministic),
// everything else OFF (desktop). Restore is handled by the shared afterEach.
function forceReducedMotion() {
  window.matchMedia = matchMediaStub((query) => query.includes("prefers-reduced-motion"));
}

/** the camera, as the transform it sets on the drawing's box */
const camera = (container: HTMLElement) =>
  (container.querySelector(".cvt-cam") as HTMLElement).style.transform;

describe("camera framing (desktop)", () => {
  // The camera holds the chapter's own frame, not the envelope of every chapter:
  // the hero's fan is assembled and unannotated, so VIEW drew it small inside a
  // frame sized for parts that have not moved yet.
  it("starts framed on the product itself, not on the whole envelope", async () => {
    forceReducedMotion();
    const { container } = render(<CvTaxonomy />);
    await waitFor(() => expect(camera(container)).toBe(cameraTransform(CHAPTER_FRAMES.hero)));
  });

  it("zooms to a cell's frame when its panel opens, and back home on close", async () => {
    forceReducedMotion();
    const user = userEvent.setup();
    // the zoom holds while the reader is in the cell's own chapter
    const { container } = render(<CvTaxonomy debugChapter="Component" />);

    await user.click(trigger("component-quantity"));
    await screen.findByRole("complementary");
    await waitFor(() =>
      expect(camera(container)).toBe(cameraTransform(frameFor("component-quantity"))),
    );

    await user.keyboard("{Escape}");
    expect(camera(container)).toBe(cameraTransform(CHAPTER_FRAMES.Component));
  });

  it("pulls the camera home once the reader scrolls on to another chapter", async () => {
    forceReducedMotion();
    const user = userEvent.setup();
    const { container, rerender } = render(<CvTaxonomy debugChapter="Component" />);
    await user.click(trigger("component-quantity"));
    await screen.findByRole("complementary");
    await waitFor(() =>
      expect(camera(container)).toBe(cameraTransform(frameFor("component-quantity"))),
    );

    // the sheet is not locked: the next chapter arrives under the docked detail,
    // and its frame would point at parts that have since drifted
    rerender(<CvTaxonomy debugChapter="Material" />);
    expect(camera(container)).toBe(cameraTransform(CHAPTER_FRAMES.Material));
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("mounts a deep link with the camera at home, then dives to the part", async () => {
    const { container } = render(
      <CvTaxonomy initialCell="material-condition" debugChapter="Material" />,
    );
    expect(camera(container)).toBe(cameraTransform(VIEW));
    await waitFor(() =>
      expect(camera(container)).toBe(cameraTransform(frameFor("material-condition"))),
    );
  });

  it("frames the fan on a cell opened via the initialCell deep link", async () => {
    forceReducedMotion();
    const { container } = render(
      <CvTaxonomy initialCell="material-condition" debugChapter="Material" />,
    );
    await waitFor(() =>
      expect(camera(container)).toBe(cameraTransform(frameFor("material-condition"))),
    );
  });
});

describe("body scroll lock", () => {
  it("leaves the sheet scrollable under a desktop detail: non-modal in ARIA, non-modal in behaviour", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy debugChapter="Component" />);
    await user.click(trigger("component-identity"));
    await screen.findByRole("complementary");
    expect(document.body.style.overflow).toBe("");
  });

  it("locks the page under the mobile sheet, which covers it, and restores it on close", async () => {
    window.matchMedia = matchMediaStub((q) => q.includes("max-width"));
    const user = userEvent.setup();
    render(<CvTaxonomy initialCell="component-identity" />);
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("");
  });
});

describe("panel progressive disclosure", () => {
  it("shows the failure mode up front and tucks rubric marks into a closed details", async () => {
    render(<CvTaxonomy initialCell="component-structure" />);
    const dialog = await screen.findByRole("complementary");

    // primary: failure mode is not inside the collapsible
    const failure = within(dialog).getByText(/where it fails/i);
    expect(failure.closest("details")).toBeNull();

    // secondary: rubric marks live inside a closed <details>
    const rubric = within(dialog).getByText(/rubric marks \(/i);
    const details = rubric.closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
  });
});

describe("withViewTransition", () => {
  it("runs the callback directly when the API is unavailable", () => {
    let ran = false;
    withViewTransition(() => {
      ran = true;
    }, true);
    expect(ran).toBe(true);
  });

  it("swallows an aborted transition instead of leaving a rejected promise", async () => {
    // The browser aborts a transition when, say, the viewport resizes mid-morph,
    // and rejects its `ready` promise. The panel still opens, so that is not an error.
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    (
      document as unknown as { startViewTransition?: (cb: () => void) => unknown }
    ).startViewTransition = (cb) => {
      cb();
      return { ready: Promise.reject(new DOMException("aborted", "InvalidStateError")) };
    };
    try {
      withViewTransition(() => {}, true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      (document as unknown as { startViewTransition?: unknown }).startViewTransition = undefined;
    }
  });

  it("runs the update through startViewTransition when the API exists", async () => {
    // openCell passes !reduceMotion, so the API path needs motion ON. The default
    // matchMedia stub (restored after every test) already returns matches:false.
    const calls: Array<() => void> = [];
    (
      document as unknown as { startViewTransition?: (cb: () => void) => void }
    ).startViewTransition = (cb) => {
      calls.push(cb);
      cb();
      return undefined as never;
    };
    try {
      const user = userEvent.setup();
      render(<CvTaxonomy debugChapter="Component" />);
      await user.click(trigger("component-identity"));
      expect(await screen.findByRole("complementary")).toBeInTheDocument();
      expect(calls.length).toBeGreaterThan(0);
    } finally {
      (document as unknown as { startViewTransition?: unknown }).startViewTransition = undefined;
    }
  });
});

describe("per-cell share", () => {
  it("copies a deep link to this cell to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    // user-event's setup() installs its own clipboard stub, so the mock must be
    // defined after that (and jsdom's navigator.clipboard is a getter-only
    // accessor, so it must be redefined rather than assigned).
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.assign(navigator, { share: undefined });

    render(<CvTaxonomy initialCell="material-condition" />);
    const dialog = await screen.findByRole("complementary");
    await user.click(within(dialog).getByRole("button", { name: /copy link/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("?cell=material-condition"));
  });
});

describe("container-driven layout", () => {
  it("switches to the compact fan when the container is narrow", () => {
    const callbacks: Array<(entries: unknown) => void> = [];
    class RO {
      cb: (entries: unknown) => void;
      constructor(cb: (entries: unknown) => void) {
        this.cb = cb;
        callbacks.push(cb);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    const savedRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
    try {
      const { container } = render(<CvTaxonomy />);
      // desktop by default (no measurement / wide fallback)
      // simulate the observer reporting a 390px container
      const root = container.querySelector(".cvt") as HTMLElement;
      // React 19 batches this state update into a microtask since it's dispatched
      // outside a React-managed event; act() flushes it before the assertion below.
      act(() => {
        for (const cb of callbacks) cb([{ contentRect: { width: 390 }, target: root }]);
      });
      expect(container.querySelector(".cvt-fan-compact")).toBeInTheDocument();
    } finally {
      globalThis.ResizeObserver = savedRO;
    }
  });
});

describe("the chapter rail is navigation, not decoration", () => {
  // The fan's chips are gated to their chapter's plateau, so without an operable
  // rail a desktop keyboard user cannot reach the Component or Material cells at
  // all: only scrolling brings them on stage.
  it("gives every scale a real control, and the closing figure a link", () => {
    window.matchMedia = matchMediaStub(() => false); // desktop
    render(<CvTaxonomy />);
    const rail = screen.getByRole("navigation", { name: "Scenes" });
    for (const scale of ["Product", "Component", "Material"]) {
      expect(within(rail).getByRole("button", { name: scale })).toBeInTheDocument();
    }
    expect(within(rail).getByRole("link", { name: /the map/i })).toHaveAttribute(
      "href",
      "#cvt-matrix",
    );
  });

  it("marks the current scene, the map included", () => {
    window.matchMedia = matchMediaStub(() => false);
    render(<CvTaxonomy debugChapter="outro" />);
    const rail = screen.getByRole("navigation", { name: "Scenes" });
    expect(within(rail).getByRole("link", { name: /the map/i })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(within(rail).getByRole("button", { name: "Material" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("scrolls to a scale's scene when its stop is activated", async () => {
    window.matchMedia = matchMediaStub(() => false);
    // jsdom has no scrollIntoView
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    try {
      render(<CvTaxonomy />);
      const rail = screen.getByRole("navigation", { name: "Scenes" });
      await userEvent.click(within(rail).getByRole("button", { name: "Material" }));
      expect(scrolled.at(-1)).toHaveAttribute("id", "cvt-ch-Material");
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe("the plain-table twin", () => {
  // The only native <dialog> left on the sheet, and the sole consumer of the
  // showModal/close emulation in test-setup — so its contract is asserted here
  // rather than assumed.
  it("opens on its own control, closes, and hands focus back to it", async () => {
    const user = userEvent.setup();
    const { container } = render(<Outro />);
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    expect(dialog.hasAttribute("open")).toBe(false);

    const opener = screen.getByRole("button", { name: /plain table/i });
    await user.click(opener);
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(within(dialog).getByRole("table")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /close table view/i }));
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(opener).toHaveFocus();
  });

  it("closes on Esc", async () => {
    const user = userEvent.setup();
    const { container } = render(<Outro />);
    const dialog = container.querySelector("dialog") as HTMLDialogElement;

    await user.click(screen.getByRole("button", { name: /plain table/i }));
    await user.keyboard("{Escape}");

    expect(dialog.hasAttribute("open")).toBe(false);
  });
});
