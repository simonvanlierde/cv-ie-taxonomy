import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cellAt, cells } from "./data/taxonomy";
import { Cite, CitedProse, METHODS, REFERENCES } from "./References";

const BY_KEY = new Map(REFERENCES.map((r) => [r.key, r]));

describe("references", () => {
  it("has an entry for every citation key in the taxonomy", () => {
    const used = new Set(cells.flatMap((c) => c.citations));
    for (const key of used) expect(BY_KEY.has(key), key).toBe(true);
  });

  it("carries no reference nothing cites (regenerate references.json)", () => {
    // a reference earns its place by backing a cell's verdict, or by being the
    // paper that introduced a model the prose names (Table S4)
    const used = new Set([...cells.flatMap((c) => c.citations), ...METHODS.map((m) => m.key)]);
    for (const r of REFERENCES) expect(used.has(r.key), r.key).toBe(true);
  });

  it("resolves every named model to a reference in the library", () => {
    const byKey = new Map(REFERENCES.map((r) => [r.key, r]));
    for (const m of METHODS) expect(byKey.has(m.key), m.name).toBe(true);
  });

  it("renders every entry as APA: authors, year in parentheses, balanced italics", () => {
    for (const r of REFERENCES) {
      expect(r.apa, r.key).toMatch(/^[A-ZÁ-Ž][^(]+ \(\d{4}[a-z]?\)\. /);
      expect(r.apa.split("*").length % 2, r.key).toBe(1);
      expect(r.short, r.key).toMatch(/^\D+, \d{4}[a-z]?$/);
    }
  });

  it("keeps in-text forms unique (APA 8.17–8.20 disambiguation)", () => {
    const shorts = REFERENCES.map((r) => r.short);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  it("opens the full APA entry and its source link from the in-text chip", () => {
    render(<Cite citeKey="sterkensProductLabelIdentification2023" />);
    const chip = screen.getByRole("button", { name: "Sterkens et al., 2023" });
    // jsdom keeps a closed [popover] out of the accessibility tree (as browsers
    // do), so the popover's content is asserted on the element itself
    const pop = document.getElementById(chip.getAttribute("popovertarget") as string);
    expect(pop).toHaveAttribute("popover");
    expect(pop).toHaveTextContent(/Product label identification with OCR/);
    const link = pop?.querySelector("a");
    expect(link).toHaveAttribute("href", "https://doi.org/10.1111/jiec.13279");
    expect(link).toHaveTextContent("doi.org/10.1111/jiec.13279");
  });

  it("never surfaces a citation key to the reader", () => {
    render(
      <>
        {REFERENCES.map((r) => (
          <Cite key={r.key} citeKey={r.key} />
        ))}
      </>,
    );
    expect(screen.queryByText(/@\w/)).toBeNull();
  });
});

describe("CitedProse", () => {
  it("links every inline author–year mention in every cell's example", () => {
    for (const cell of cells) {
      if (!cell.example || cell.citations.length === 0) continue;
      const { unmount } = render(<CitedProse text={cell.example} citeKeys={cell.citations} />);
      const chipped = screen.getAllByRole("button").map((b) => b.textContent);
      const mentions = cell.example.match(/[A-Z][\w'’-]+(?: et al\.| & [A-Z][\w'’-]+)?,? \d{4}/g);
      for (const mention of mentions ?? []) expect(chipped, cell.id).toContain(mention);
      unmount();
    }
  });

  it("links a named model whose paper the cell's own citations do not include", () => {
    // Table S1's Product · Condition row does not cite WinCLIP or AnomalyCLIP;
    // Table S4 attributes both, so the names are still one click from their paper
    const cell = cellAt("Product", "Condition");
    render(<CitedProse text={cell.methodFamily ?? ""} citeKeys={cell.citations} />);
    for (const name of ["WinCLIP", "AnomalyCLIP"]) {
      const chip = screen.getByRole("button", { name });
      const pop = document.getElementById(chip.getAttribute("popovertarget") as string);
      expect(pop, name).toHaveTextContent(name);
    }
  });

  it("does not link a model name twice over its own citation", () => {
    // "(Li et al. 2024, MaterialSeg3D)" — one paper, one link
    const cell = cellAt("Material", "Condition");
    render(<CitedProse text={cell.example ?? ""} citeKeys={cell.citations} />);
    const chips = screen.getAllByRole("button").map((b) => b.textContent);
    expect(chips).toEqual(["Li et al. 2024"]);
  });

  it("keeps a chip on each model name when two share one paper", () => {
    // "~90% TrashNet -> ~40% MultiWaste" — two datasets, one source, two lookups
    const cell = cellAt("Material", "Identity");
    render(<CitedProse text={cell.failureMode ?? ""} citeKeys={cell.citations} />);
    const chips = screen.getAllByRole("button").map((b) => b.textContent);
    expect(chips).toEqual(["TrashNet", "MultiWaste"]);
  });

  it("maps two same-named mentions to distinct references, in citation order", () => {
    // component-condition cites two different "Liu et al. 2025" papers
    const cell = cellAt("Component", "Condition");
    render(<CitedProse text={cell.example ?? ""} citeKeys={cell.citations} />);
    const chips = screen.getAllByRole("button");
    const popApa = (chip: HTMLElement | undefined) =>
      chip && document.getElementById(chip.getAttribute("popovertarget") as string)?.textContent;
    expect(chips).toHaveLength(2);
    expect(popApa(chips[0])).not.toBe(popApa(chips[1]));
    expect(popApa(chips[0])).toMatch(/RAISE/i);
  });

  it("still links a mention whose year the library disagrees with (stale preprint date)", () => {
    // the text says "Drehwald 2023" (ICCV), the library still holds the 2022 arXiv record
    const cell = cellAt("Material", "Identity");
    render(<CitedProse text={cell.example ?? ""} citeKeys={cell.citations} />);
    expect(screen.getByRole("button", { name: "Drehwald 2023" })).toBeInTheDocument();
  });
});
