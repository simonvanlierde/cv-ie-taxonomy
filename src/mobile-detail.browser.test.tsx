import { render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { CvTaxonomy } from "./CvTaxonomy";
import { cellById, cells, maturityName, taskName } from "./data/taxonomy";
import { METHODS, REFERENCES } from "./References";

const dialog = () => screen.getByRole("dialog");
const button = (name: string) => within(dialog()).getByRole("button", { name });
const rect = (selector: string) =>
  (document.querySelector(selector) as HTMLElement).getBoundingClientRect();

async function scrollTextIntoSheet(element: HTMLElement) {
  await document.fonts.ready;
  const range = document.createRange();
  range.selectNodeContents(element);
  const count = range.getClientRects().length;
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const line = range.getClientRects()[i];
    if (!line) throw new Error("A text line disappeared while scrolling");
    const sheet = dialog();
    sheet.scrollTop += line.top - sheet.getBoundingClientRect().top - 16;
    await vi.waitFor(() => {
      const visible = range.getClientRects()[i];
      if (!visible) throw new Error("A text line disappeared while scrolling");
      const bounds = sheet.getBoundingClientRect();
      expect(visible.top).toBeGreaterThanOrEqual(bounds.top);
      expect(visible.bottom).toBeLessThanOrEqual(bounds.bottom);
      const hit = document.elementFromPoint(
        visible.left + visible.width / 2,
        visible.top + visible.height / 2,
      );
      expect(element.contains(hit)).toBe(true);
    });
  }
}

async function press(name: string, input: "pointer" | "keyboard") {
  const control = button(name);
  if (input === "pointer") await userEvent.click(control);
  else {
    control.focus();
    await userEvent.keyboard("{Enter}");
  }
  return control;
}

async function open(id = "product-identity", width = 390, height = 844) {
  await page.viewport(width, height);
  await commands.emulateMedia({ reducedMotion: "reduce" });
  render(<CvTaxonomy debugChapter={cellById(id).scale} />);
  const opener = await vi.waitFor(() => {
    const el = document.getElementById(`cvt-m-${id}`);
    expect(el).not.toBeNull();
    return el as HTMLElement;
  });
  opener.scrollIntoView({ block: "center" });
  opener.focus();
  await userEvent.keyboard("{Enter}");
  await vi.waitFor(() => expect(dialog()).toHaveFocus());
  return opener;
}

afterEach(async () => {
  document.documentElement.style.fontSize = "";
  await commands.emulateMedia({ reducedMotion: null });
  await page.viewport(1280, 900);
});

describe("mobile compact evidence", () => {
  it.each([
    [390, 844],
    [844, 390],
  ])("expands and collapses at %i × %i without losing place", async (w, h) => {
    const opener = await open("product-identity", w, h);
    const scroll = window.scrollY;
    const entry = history.state.cvtDetail;
    expect(
      within(dialog()).getByRole("heading", { name: taskName(cellById("product-identity")) }),
    ).toBeVisible();
    expect(within(dialog()).getByText(/Partial/)).toBeVisible();
    expect(within(dialog()).getByText("Where it fails")).toBeVisible();
    expect(within(dialog()).queryByText("Why this verdict")).toBeNull();
    expect(dialog().querySelector(".cvt-cite-chip")).toBeNull();
    await vi.waitFor(() => {
      const figure = rect(".cvt-sticky");
      const detail = dialog().getBoundingClientRect();
      expect(figure.height).toBeGreaterThan(100);
      expect(w < h ? figure.bottom <= detail.top + 1 : figure.right <= detail.left + 1).toBe(true);
    });
    await userEvent.click(button("Read evidence"));
    expect(within(dialog()).getByText("Why this verdict")).toBeVisible();
    expect(dialog().querySelector(".cvt-cite-chip")).not.toBeNull();
    expect(button("Back to compact")).toHaveFocus();
    await userEvent.click(button("Back to compact"));
    await vi.waitFor(() => expect(button("Read evidence")).toHaveFocus());
    expect(within(dialog()).queryByText("Why this verdict")).toBeNull();
    expect(history.state.cvtDetail).toBe(entry);
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener).toHaveFocus();
    expect(window.scrollY).toBe(scroll);
  });

  it("keeps navigation, verdicts, source overlays and focus synchronized through the whole scale", async () => {
    await open("component-identity");
    const ring = cells.filter((c) => c.scale === "Component");
    const entry = history.state.cvtDetail;
    await userEvent.click(button("Read evidence"));
    for (const cell of [...ring.slice(1), ...ring.slice(0, 1)]) {
      await userEvent.click(button("Next cell"));
      await vi.waitFor(() =>
        expect(dialog()).toHaveAccessibleName(`${cell.scale} · ${cell.informationType}`),
      );
      expect(dialog()).toHaveFocus();
      expect(within(dialog()).getByText(new RegExp(maturityName(cell)))).toBeVisible();
      expect(document.querySelector(".cvt-scroll")).toHaveAttribute("data-cell", cell.id);
      expect(within(dialog()).getByText("Why this verdict")).toBeInTheDocument();
    }
    await userEvent.click(button("Previous cell"));
    expect(dialog()).toHaveAccessibleName("Component · Condition");
    expect(history.state.cvtDetail).toBe(entry);
    await userEvent.click(button("Close details"));
    await vi.waitFor(() =>
      expect(document.getElementById("cvt-m-component-condition")).toHaveFocus(),
    );
  });

  it.each([
    ["product-structure", 390, 844],
    ["material-structure", 390, 844],
    ["component-structure", 390, 844],
    ["material-condition", 390, 844],
    ["product-identity", 844, 390],
    ["component-structure", 844, 390],
  ] as const)(
    "preserves the complete compact content for %s at larger text (%i × %i)",
    async (id, width, height) => {
      document.documentElement.style.fontSize = "24px";
      await open(id, width, height);
      const cell = cellById(id);
      expect(within(dialog()).getByRole("heading", { name: taskName(cell) })).toBeVisible();
      expect(
        within(dialog()).getByText(
          cell.structurallyEmpty ? "Not applicable" : new RegExp(maturityName(cell)),
        ),
      ).toBeVisible();
      if (cell.failureMode) expect(dialog().textContent).toContain(cell.failureMode);
      expect(within(dialog()).queryByText("How to use the result")).toBeNull();
      const detail = dialog();
      expect(detail.scrollWidth).toBeLessThanOrEqual(detail.clientWidth);
      const verdictEnd = detail.querySelector<HTMLElement>(".cvt-subverdicts li:last-child");
      if (verdictEnd) await scrollTextIntoSheet(verdictEnd);
      if (cell.failureMode) {
        const failure = within(detail).getByText("Where it fails")
          .nextElementSibling as HTMLElement;
        await scrollTextIntoSheet(failure);
        expect(failure.textContent).toBe(cell.failureMode);
        if (cell.subVerdicts) expect(detail.scrollTop).toBeGreaterThan(0);
      }
      await userEvent.click(button("Read evidence"));
      expect(button("Back to compact")).toBeVisible();
      if (cell.failureMode) {
        await scrollTextIntoSheet(
          within(dialog()).getByText("Where it fails").nextElementSibling as HTMLElement,
        );
      }
      await userEvent.click(button("Back to compact"));
      await vi.waitFor(() => expect(button("Read evidence")).toHaveFocus());
      if (cell.failureMode) {
        await scrollTextIntoSheet(
          within(dialog()).getByText("Where it fails").nextElementSibling as HTMLElement,
        );
      }
      await userEvent.click(button("Close details"));
      await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(document.getElementById(`cvt-m-${id}`)).toHaveFocus();
    },
  );

  it("keeps compact navigation and the source overlays in agreement, including an empty cell", async () => {
    await open();
    const overlays = [...document.querySelectorAll<SVGElement>(".ov-layer")];
    await vi.waitFor(() =>
      expect(Number(getComputedStyle(overlays[0] as SVGElement).opacity)).toBeCloseTo(1),
    );
    await userEvent.click(button("Next cell"));
    expect(dialog()).toHaveAccessibleName("Product · Quantity");
    await vi.waitFor(() =>
      expect(Number(getComputedStyle(overlays[0] as SVGElement).opacity)).toBeCloseTo(0.05),
    );
    expect(Number(getComputedStyle(overlays[1] as SVGElement).opacity)).toBeCloseTo(1);
    await userEvent.click(button("Next cell"));
    expect(dialog()).toHaveAccessibleName("Product · Structure");
    expect(within(dialog()).getByText("Not applicable")).toBeVisible();
    expect(within(dialog()).queryByText("Why this cell has no rating")).toBeNull();
    await userEvent.click(button("Read evidence"));
    expect(within(dialog()).getByText(cellById("product-structure").maturityNote)).toBeVisible();
    await userEvent.click(button("Previous cell"));
    expect(dialog()).toHaveAccessibleName("Product · Quantity");
    await userEvent.click(button("Back to compact"));
    await userEvent.click(button("Close details"));
    expect(document.getElementById("cvt-m-product-quantity")).toHaveFocus();
  });

  it("applies both presses during rapid navigation with motion enabled", async () => {
    await open();
    await commands.emulateMedia({ reducedMotion: null });
    await userEvent.dblClick(button("Next cell"));
    await vi.waitFor(() => expect(dialog()).toHaveAccessibleName("Product · Structure"));
    expect(within(dialog()).getByText("Not applicable")).toBeVisible();
  });

  it("keeps selection and focus through mobile and desktop transitions", async () => {
    await open("component-condition");
    await userEvent.click(button("Read evidence"));
    await page.viewport(1280, 900);
    const desktop = await screen.findByRole("complementary", { name: "Component · Condition" });
    await vi.waitFor(() => expect(desktop).toHaveFocus());
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(document.querySelector(".cvt-scroll")).not.toHaveAttribute("inert");
    await userEvent.click(within(desktop).getByRole("button", { name: "Close details" }));
    expect(document.getElementById("cvt-co-component-condition")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("complementary", { name: "Component · Condition" });
    await page.viewport(390, 844);
    await vi.waitFor(() => expect(dialog()).toHaveFocus());
    expect(button("Read evidence")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() =>
      expect(document.getElementById("cvt-m-component-condition")).toHaveFocus(),
    );
    const other = document.getElementById("cvt-m-component-quantity") as HTMLElement;
    other.focus({ preventScroll: true });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(other).toHaveFocus();
  });

  it("keeps one history entry through expand, navigation, Back and Forward", async () => {
    await open();
    const length = history.length;
    const entry = history.state.cvtDetail;
    await userEvent.click(button("Read evidence"));
    await userEvent.click(button("Next cell"));
    expect(history.length).toBe(length);
    history.back();
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.getElementById("cvt-m-product-quantity")).toHaveFocus();
    history.forward();
    await vi.waitFor(() => expect(history.state.cvtDetail).toBe(entry));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(dialog()).toHaveFocus());
    expect(button("Read evidence")).toBeVisible();
    expect(history.length).toBe(length);
  });

  it("opens a deep-linked empty cell compactly and keeps its scale visible", async () => {
    await page.viewport(390, 844);
    render(<CvTaxonomy initialCell="material-structure" />);
    await vi.waitFor(() => expect(dialog()).toHaveFocus());
    expect(document.querySelector(".cvt-scroll")).toHaveAttribute("data-chapter", "Material");
    expect(within(dialog()).getByText("Not applicable")).toBeVisible();
    await userEvent.click(button("Close details"));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.getElementById("cvt-m-material-structure")).toHaveFocus();
  });

  it.each(["pointer", "keyboard"] as const)(
    "retains the evidence toggle on %s activation without later stealing focus",
    async (input) => {
      await open();
      const region = dialog();
      for (const name of ["Read evidence", "Back to compact"]) {
        const toggle = await press(name, input);
        expect(dialog()).toBe(region);
        expect(toggle).toHaveFocus();
        const next = button("Next cell");
        next.focus();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        expect(next).toHaveFocus();
      }
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it.each([
    [320, 568, "pointer"],
    [320, 568, "keyboard"],
    [844, 390, "pointer"],
    [844, 390, "keyboard"],
  ] as const)(
    "reaches the longest caveat at %i × %i with larger text and %s controls",
    async (width, height, input) => {
      document.documentElement.style.fontSize = "24px";
      await open("material-identity", width, height);
      const cell = cellById("material-identity");
      const region = dialog();
      const failure = () =>
        within(region).getByText("Where it fails").nextElementSibling as HTMLElement;
      expect(failure().textContent).toBe(cell.failureMode);
      expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth);
      await scrollTextIntoSheet(failure());
      expect(region.scrollTop).toBeGreaterThan(0);
      expect(region.scrollHeight).toBeGreaterThan(region.clientHeight);
      expect(within(region).queryByRole("button", { name: "TrashNet" })).toBeNull();
      const toggle = await press("Read evidence", input);
      expect(toggle).toHaveFocus();
      await scrollTextIntoSheet(failure());
      for (const name of ["TrashNet", "MultiWaste"]) {
        const method = within(failure()).getByRole("button", { name });
        if (input === "pointer") await userEvent.click(method);
        else {
          method.focus();
          await userEvent.keyboard("{Enter}");
        }
        const popover = document.querySelector(".cvt-cite-pop:popover-open") as HTMLElement;
        const ref = REFERENCES.find((r) => r.key === METHODS.find((m) => m.name === name)?.key);
        expect(ref).toBeDefined();
        expect(within(popover).getByRole("link")).toHaveAttribute("href", ref?.url);
        expect(popover.querySelector(".cvt-cite-apa")?.textContent).toBe(
          ref?.apa.replaceAll("*", ""),
        );
        await userEvent.keyboard("{Escape}");
        expect(dialog()).toBe(region);
      }
      expect(await press("Back to compact", input)).toHaveFocus();
      await scrollTextIntoSheet(failure());
      await press("Close details", input);
      await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(document.getElementById("cvt-m-material-identity")).toHaveFocus();
    },
  );

  it("passes axe in both compact and expanded states", async () => {
    await open("component-structure");
    for (const expanded of [false, true]) {
      if (expanded) await userEvent.click(button("Read evidence"));
      const result = await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
      });
      expect(result.violations.map((v) => v.id)).toEqual([]);
    }
  });
});
