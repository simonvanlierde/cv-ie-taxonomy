import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CvTaxonomy, withViewTransition } from "./CvTaxonomy";
import { cellById } from "./data/taxonomy";
import { frameToViewBox, VIEW } from "./frames";
import { frameOf } from "./test-helpers";

/**
 * The detail panel is a native <dialog>: it owns the focus trap, Esc and focus
 * return, and the component only drives open/close. That contract is the thing
 * worth testing — it is what a keyboard or screen-reader user actually meets.
 * (matchMedia and <dialog> shims live in test-setup.ts.)
 */

/** the mobile list renders a button per cell, id `cvt-m-<cellId>`; use it as the trigger */
const trigger = (cellId: string) => document.getElementById(`cvt-m-${cellId}`) as HTMLElement;

describe("detail panel", () => {
  it("opens on a cell click, and shows that cell's verdict", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger("component-identity"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { level: 2 })).toBeInTheDocument();
    expect(dialog).toHaveAttribute("open");
  });

  it("focuses the opening cell before showing the modal, so focus can return to it", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    const opener = trigger("component-identity");
    await user.click(opener);
    await screen.findByRole("dialog");

    // This is the component's half of the focus-return contract: the browser
    // restores focus to whatever was focused when showModal ran, so that element
    // must be the trigger and not <body>. (The restore itself is the engine's
    // job; under jsdom it is emulated — see test-setup.ts.)
    expect(opener).toHaveFocus();
  });

  it("closes on Esc, landing focus back on the cell that opened it", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    const opener = trigger("component-identity");
    await user.click(opener);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("closes on the panel's own close button", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);

    await user.click(trigger("material-identity"));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: /close details/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deep-links straight into a cell's panel via initialCell", async () => {
    const cell = cellById("material-quantity");
    render(<CvTaxonomy initialCell={cell.id} />);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { level: 2 })).toHaveTextContent(cell.task);
  });

  it("ignores an initialCell that names no cell, rather than throwing", () => {
    render(<CvTaxonomy initialCell="not-a-cell" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
    expect(screen.getByText(/overlays illustrative, not model output/i)).toBeInTheDocument();
  });
});

// Force reduced motion ON (so the camera cuts instantly and is deterministic),
// everything else OFF (desktop). Restore is handled by the shared afterEach.
function forceReducedMotion() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
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
    const { container } = render(<CvTaxonomy />);
    const fan = () => container.querySelector(".cvt-fan:not(.cvt-fan-compact)") as SVGSVGElement;

    await user.click(trigger("component-quantity"));
    await screen.findByRole("dialog");
    expect(fan()).toHaveAttribute("viewBox", frameToViewBox(frameOf("component-quantity")));

    await user.keyboard("{Escape}");
    expect(fan()).toHaveAttribute("viewBox", frameToViewBox(VIEW));
  });

  it("frames the fan on a cell opened via the initialCell deep link", () => {
    forceReducedMotion();
    const { container } = render(<CvTaxonomy initialCell="material-condition" />);
    const fan = container.querySelector(".cvt-fan:not(.cvt-fan-compact)") as SVGSVGElement;
    expect(fan).toHaveAttribute("viewBox", frameToViewBox(frameOf("material-condition")));
  });
});

describe("body scroll lock", () => {
  it("locks body scroll while the panel is open and restores it on close", async () => {
    const user = userEvent.setup();
    render(<CvTaxonomy />);
    expect(document.body.style.overflow).toBe("");

    await user.click(trigger("component-identity"));
    await screen.findByRole("dialog");
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("");
  });
});

describe("panel progressive disclosure", () => {
  it("shows the failure mode up front and tucks rubric marks into a closed details", async () => {
    render(<CvTaxonomy initialCell="component-structure" />);
    const dialog = await screen.findByRole("dialog");

    // primary: failure mode is not inside the collapsible
    const failure = within(dialog).getByText(/dominant failure mode/i);
    expect(failure.closest("details")).toBeNull();

    // secondary: rubric marks live inside a closed <details>
    const rubric = within(dialog).getByText(/rubric marks/i);
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
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
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
    const dialog = await screen.findByRole("dialog");
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
