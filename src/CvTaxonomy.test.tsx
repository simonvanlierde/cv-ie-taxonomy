import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CvTaxonomy, withViewTransition } from "./CvTaxonomy";
import { cellById } from "./data/taxonomy";
import { frameToViewBox, VIEW } from "./frames";
import { frameOf, matchMediaStub } from "./test-helpers";
import { plateauCentre } from "./timeline";

/**
 * The detail is an enlargement drawn on the sheet, not a <dialog>: on desktop it
 * takes the narrative column's place rather than floating over the drawing. That
 * means the focus trap, Esc and focus return are the component's own (see
 * useDialogRegion), so unlike the native versions they can actually be asserted
 * here rather than taken on trust.
 */

/** the mobile list renders a button per cell, id `cvt-m-<cellId>`; use it as the trigger */
const trigger = (cellId: string) => document.getElementById(`cvt-m-${cellId}`) as HTMLElement;

describe("detail on the sheet (desktop)", () => {
  const detail = () => screen.findByRole("complementary", { name: /component · identity/i });

  it("opens on a cell click, and shows that cell's verdict", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    await user.click(trigger("component-identity"));

    const region = await detail();
    expect(within(region).getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("moves focus into the detail when it opens", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    await user.click(trigger("component-identity"));
    expect(await detail()).toHaveFocus();
  });

  it("does not trap focus: the sheet it is drawn on stays usable", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    await user.click(trigger("component-identity"));
    const region = await detail();

    // Deliberate. An enlargement drawn ON the sheet is not modal: the drawing,
    // the filters and the other eleven cells are still there, and the obvious
    // next thing a reader does is look at another cell. Trapping made the fan's
    // own callouts — the controls — unreachable while a detail was open.
    const outside = document.querySelector<HTMLElement>(".cvt-footer a");
    outside?.focus();
    expect(region.contains(document.activeElement)).toBe(false);
    expect(outside).toHaveFocus();
  });

  it("ignores Esc while focus is elsewhere on the sheet: two details can be open at once, and one keypress must not close both", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    await user.click(trigger("component-identity"));
    await detail();
    document.querySelector<HTMLElement>(".cvt-footer a")?.focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("closes on Esc, landing focus back on the cell that opened it", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

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
    render(<CvTaxonomy />);

    await user.click(trigger("material-identity"));
    const region = await screen.findByRole("complementary", { name: /material · identity/i });

    await user.click(within(region).getByRole("button", { name: /close details/i }));

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("deep-links straight into a cell's detail via initialCell", async () => {
    const cell = cellById("material-quantity");
    render(<CvTaxonomy initialCell={cell.id} />);

    const region = await screen.findByRole("complementary", { name: /material · quantity/i });
    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent(cell.task);
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

  it("pulls focus back when something outside it takes focus", async () => {
    mobile();
    render(<CvTaxonomy initialCell="component-identity" />);
    const dialog = await screen.findByRole("dialog");

    document.querySelector<HTMLElement>(".cvt-footer a")?.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});

describe("theme has a single owner", () => {
  it("follows the host prop, and keeps following it when the host changes it", () => {
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

  it("lets the in-page toggle beat the host prop", async () => {
    const user = userEvent.setup();
    const { container } = render(<CvTaxonomy theme="light" />);

    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));

    expect(container.querySelector(".cvt")).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});

describe("the illustrative caveat", () => {
  // the per-layer aria-hidden sweep lives in Fan.test.tsx, next to the component
  // that owns the layers; this is the integration-level half of that guarantee
  it("is rendered alongside the mock overlays", () => {
    render(<CvTaxonomy />);
    expect(screen.getByText(/illustrative read-outs: no model ran here/i)).toBeInTheDocument();
  });
});

// Force reduced motion ON (so the camera cuts instantly and is deterministic),
// everything else OFF (desktop). Restore is handled by the shared afterEach.
function forceReducedMotion() {
  window.matchMedia = matchMediaStub((query) => query.includes("prefers-reduced-motion"));
}

describe("camera framing (desktop)", () => {
  it("starts framed on the whole fan", () => {
    forceReducedMotion();
    const { container } = render(<CvTaxonomy />);
    const fan = container.querySelector(".cvt-fan:not(.cvt-fan-compact)") as SVGSVGElement;
    expect(fan).toHaveAttribute("viewBox", frameToViewBox(VIEW));
  });

  it("zooms to a cell's frame when its panel opens, and back home on close", async () => {
    forceReducedMotion();
    const user = userEvent.setup();
    // the zoom holds while the reader is in the cell's own chapter
    const { container } = render(<CvTaxonomy debugProgress={plateauCentre("Component")} />);
    const fan = () => container.querySelector(".cvt-fan:not(.cvt-fan-compact)") as SVGSVGElement;

    await user.click(trigger("component-quantity"));
    await screen.findByRole("complementary");
    expect(fan()).toHaveAttribute("viewBox", frameToViewBox(frameOf("component-quantity")));

    await user.keyboard("{Escape}");
    expect(fan()).toHaveAttribute("viewBox", frameToViewBox(VIEW));
  });

  it("pulls the camera home once the reader scrolls on to another chapter", async () => {
    forceReducedMotion();
    const user = userEvent.setup();
    const { container, rerender } = render(
      <CvTaxonomy debugProgress={plateauCentre("Component")} />,
    );
    const fan = () => container.querySelector(".cvt-fan:not(.cvt-fan-compact)") as SVGSVGElement;
    await user.click(trigger("component-quantity"));
    await screen.findByRole("complementary");
    expect(fan()).toHaveAttribute("viewBox", frameToViewBox(frameOf("component-quantity")));

    // the sheet is not locked: the next chapter arrives under the docked detail,
    // and its frame would point at parts that have since drifted
    rerender(<CvTaxonomy debugProgress={plateauCentre("Material")} />);
    expect(fan()).toHaveAttribute("viewBox", frameToViewBox(VIEW));
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("frames the fan on a cell opened via the initialCell deep link", () => {
    forceReducedMotion();
    const { container } = render(
      <CvTaxonomy initialCell="material-condition" debugProgress={plateauCentre("Material")} />,
    );
    const fan = container.querySelector(".cvt-fan:not(.cvt-fan-compact)") as SVGSVGElement;
    expect(fan).toHaveAttribute("viewBox", frameToViewBox(frameOf("material-condition")));
  });
});

describe("body scroll lock", () => {
  it("leaves the sheet scrollable under a desktop detail: non-modal in ARIA, non-modal in behaviour", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);
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
    const failure = within(dialog).getByText(/where it breaks/i);
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
      render(<CvTaxonomy />);
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
    const rail = screen.getByLabelText("Physical scale chapters");
    for (const scale of ["Product", "Component", "Material"]) {
      expect(within(rail).getByRole("button", { name: scale })).toBeInTheDocument();
    }
    expect(within(rail).getByRole("link", { name: /the map/i })).toHaveAttribute(
      "href",
      "#cvt-matrix",
    );
  });

  it("scrolls to a scale's plateau when its stop is activated", async () => {
    window.matchMedia = matchMediaStub(() => false);
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    // jsdom lays everything out at zero, so give the narrative a scrollable span
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(5000);
    render(<CvTaxonomy />);
    const rail = screen.getByLabelText("Physical scale chapters");
    await userEvent.click(within(rail).getByRole("button", { name: "Material" }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
