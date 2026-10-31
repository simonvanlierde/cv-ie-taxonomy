import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealPhoto } from "./RealPhoto";
import { type RealModel, toBoxes } from "./realModels";

/** a model that answers at once, so no weights are downloaded in a test */
const fake = (run: RealModel["run"]): RealModel => ({
  name: "Fake detector",
  task: "find the parts",
  download: "nothing",
  run,
});

// jsdom has no object URLs
beforeEach(() => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:photo-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

const photo = () => new File(["x"], "fan.jpg", { type: "image/jpeg" });

async function openWithPhoto(model: RealModel) {
  const user = userEvent.setup();
  const view = render(<RealPhoto scale="Component" model={model} />);
  await user.click(screen.getByRole("button", { name: /try your own photo/i }));
  await user.upload(screen.getByLabelText(/use your own photo/i), photo());
  return { user, view };
}

describe("real-model mode", () => {
  it("stays folded away, and runs nothing, until the reader asks", () => {
    const run = vi.fn();
    render(<RealPhoto scale="Component" model={fake(run)} />);
    expect(screen.getByRole("button", { name: /try your own photo/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("button", { name: /analyse photo/i })).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("offers the reader's own photo when no example is available", async () => {
    const user = userEvent.setup();
    render(<RealPhoto scale="Material" model={fake(vi.fn())} />);
    await user.click(screen.getByRole("button", { name: /try your own photo/i }));
    expect(screen.getByText(/no example photo is available/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/use your own photo/i)).toBeInTheDocument();
  });

  it("runs on the reader's photo and labels the result as one photo, not a test of reliability", async () => {
    const run = vi.fn(async () => ({
      kind: "boxes" as const,
      boxes: [{ label: "an electric motor", score: 0.42, x: 0.1, y: 0.2, w: 0.3, h: 0.3 }],
    }));
    const { user } = await openWithPhoto(fake(run));
    await user.click(screen.getByRole("button", { name: /analyse photo/i }));

    expect(run).toHaveBeenCalledWith(screen.getByAltText("Your photo"));
    const result = await screen.findByRole("status");
    expect(result).toHaveTextContent(/one photo, not a test of reliability · Fake detector/i);
    expect(within(result).getByRole("listitem")).toHaveTextContent("an electric motor, score 0.42");
  });

  it("says plainly when the model cannot run", async () => {
    const { user } = await openWithPhoto(
      fake(async () => {
        throw new Error("offline");
      }),
    );
    await user.click(screen.getByRole("button", { name: /analyse photo/i }));
    await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/offline/));
  });

  it("prints what Tesseract read with its confidence, and says when it read nothing", async () => {
    const run = vi
      .fn<RealModel["run"]>()
      .mockResolvedValueOnce({ kind: "text", text: "TYP 4212/A", confidence: 76.4 })
      .mockResolvedValueOnce({ kind: "text", text: "", confidence: 0 });
    const { user } = await openWithPhoto(fake(run));
    const button = screen.getByRole("button", { name: /analyse photo/i });
    await user.click(button);
    await vi.waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Read: TYP 4212/A (Tesseract’s own confidence: 76%)",
      ),
    );
    await user.click(button);
    await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Read: nothing"));
  });
});

describe("removing the downloaded models", () => {
  it("empties the model cache, and says so", async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal("caches", { delete: del });
    try {
      const user = userEvent.setup();
      render(<RealPhoto scale="Product" model={fake(vi.fn())} />);
      await user.click(screen.getByRole("button", { name: /try your own photo/i }));
      await user.click(screen.getByRole("button", { name: /remove OWL-ViT downloads/i }));
      expect(del).toHaveBeenCalledWith("transformers-cache");
      await vi.waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          /Saved OWL-ViT files have been removed/i,
        ),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("says plainly when the browser refuses", async () => {
    vi.stubGlobal("caches", { delete: vi.fn().mockRejectedValue(new Error("storage blocked")) });
    try {
      const user = userEvent.setup();
      render(<RealPhoto scale="Product" model={fake(vi.fn())} />);
      await user.click(screen.getByRole("button", { name: /try your own photo/i }));
      await user.click(screen.getByRole("button", { name: /remove OWL-ViT downloads/i }));
      await vi.waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          /Could not remove the saved OWL-ViT files: storage blocked/,
        ),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("a run belongs to its photo", () => {
  /** a model whose answer the test releases by hand */
  const deferred = () => {
    let release: (r: Awaited<ReturnType<RealModel["run"]>>) => void = () => {};
    const run = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<RealModel["run"]>>>((resolve) => {
          release = resolve;
        }),
    );
    return { run, release: (r: Awaited<ReturnType<RealModel["run"]>>) => release(r) };
  };
  const answer = { kind: "boxes" as const, boxes: [] };

  it("drops an answer that arrives after the reader chose another photo", async () => {
    const model = deferred();
    const { user } = await openWithPhoto(fake(model.run));
    await user.click(screen.getByRole("button", { name: /analyse photo/i }));
    await user.upload(screen.getByLabelText(/use another photo/i), photo());
    model.release(answer);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("drops a failure that arrives after the reader chose another photo", async () => {
    let fail: (e: Error) => void = () => {};
    const run = vi.fn(
      () =>
        new Promise<never>((_, reject) => {
          fail = reject;
        }),
    );
    const { user } = await openWithPhoto(fake(run));
    await user.click(screen.getByRole("button", { name: /analyse photo/i }));
    await user.upload(screen.getByLabelText(/use another photo/i), photo());
    fail(new Error("too late"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("starts one run however often Run is pressed while it is running, and keeps focus", async () => {
    const model = deferred();
    const { user } = await openWithPhoto(fake(model.run));
    const button = screen.getByRole("button", { name: /analyse photo/i });
    await user.click(button);
    await user.click(button);
    expect(model.run).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();
    model.release(answer);
    await vi.waitFor(() => expect(button).toHaveAttribute("aria-disabled", "false"));
  });

  it("removes nothing while a run is downloading, since the download would land after", async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal("caches", { delete: del });
    try {
      const model = deferred();
      const { user } = await openWithPhoto(fake(model.run));
      await user.click(screen.getByRole("button", { name: /analyse photo/i }));
      const remove = screen.getByRole("button", { name: /remove OWL-ViT downloads/i });
      expect(remove).toHaveAttribute("aria-disabled", "true");
      await user.click(remove);
      expect(del).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent(/running/i);
      model.release(answer);
      await vi.waitFor(() => expect(remove).toHaveAttribute("aria-disabled", "false"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("frees each photo's object URL when it is replaced, and the last on close", async () => {
    const { user, view } = await openWithPhoto(fake(vi.fn()));
    await user.upload(screen.getByLabelText(/use another photo/i), photo());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo-1");
    view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo-2");
  });
});

describe("toBoxes", () => {
  it("turns pixel boxes into fractions of the photo, best score first", () => {
    const boxes = toBoxes(
      [
        { label: "a", score: 0.2, box: { xmin: 0, ymin: 0, xmax: 50, ymax: 25 } },
        { label: "b", score: 0.9, box: { xmin: 100, ymin: 50, xmax: 200, ymax: 100 } },
      ],
      200,
      100,
    );
    expect(boxes).toEqual([
      { label: "b", score: 0.9, x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      { label: "a", score: 0.2, x: 0, y: 0, w: 0.25, h: 0.25 },
    ]);
  });
});
