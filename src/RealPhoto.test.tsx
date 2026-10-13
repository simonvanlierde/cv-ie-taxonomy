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
  await user.click(screen.getByRole("button", { name: /try a real model on one photo/i }));
  await user.upload(screen.getByLabelText(/use your own photo/i), photo());
  return { user, view };
}

describe("real-model mode", () => {
  it("stays folded away, and runs nothing, until the reader asks", () => {
    const run = vi.fn();
    render(<RealPhoto scale="Component" model={fake(run)} />);
    expect(screen.getByRole("button", { name: /try a real model/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("button", { name: /run the model/i })).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it("says no photo of the fan exists yet, and offers the reader's own", async () => {
    const user = userEvent.setup();
    render(<RealPhoto scale="Material" model={fake(vi.fn())} />);
    await user.click(screen.getByRole("button", { name: /try a real model/i }));
    expect(screen.getByText(/no photo of this fan has been taken yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/use your own photo/i)).toBeInTheDocument();
  });

  it("runs on the reader's photo and labels the result as one photo, not validation", async () => {
    const run = vi.fn(async () => ({
      kind: "boxes" as const,
      boxes: [{ label: "an electric motor", score: 0.42, x: 0.1, y: 0.2, w: 0.3, h: 0.3 }],
    }));
    const { user } = await openWithPhoto(fake(run));
    await user.click(screen.getByRole("button", { name: /run the model/i }));

    expect(run).toHaveBeenCalledWith(screen.getByAltText("Your photo"));
    const result = await screen.findByRole("status");
    expect(result).toHaveTextContent(/one photo, not validation · Fake detector/i);
    expect(within(result).getByRole("listitem")).toHaveTextContent("an electric motor, score 0.42");
  });

  it("says plainly when the model cannot run", async () => {
    const { user } = await openWithPhoto(
      fake(async () => {
        throw new Error("offline");
      }),
    );
    await user.click(screen.getByRole("button", { name: /run the model/i }));
    await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/offline/));
  });
});

describe("removing the downloaded models", () => {
  it("empties the model cache and Tesseract's store, and says so", async () => {
    const del = vi.fn(async () => true);
    vi.stubGlobal("caches", { delete: del });
    const request = {} as { onsuccess?: () => void };
    const deleteDatabase = vi.fn(() => {
      queueMicrotask(() => request.onsuccess?.());
      return request;
    });
    vi.stubGlobal("indexedDB", { deleteDatabase });
    try {
      const user = userEvent.setup();
      render(<RealPhoto scale="Product" model={fake(vi.fn())} />);
      await user.click(screen.getByRole("button", { name: /try a real model/i }));
      await user.click(screen.getByRole("button", { name: /remove downloaded models/i }));
      expect(del).toHaveBeenCalledWith("transformers-cache");
      expect(deleteDatabase).toHaveBeenCalledWith("keyval-store");
      await vi.waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(/removed from this browser/i),
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
    await user.click(screen.getByRole("button", { name: /run the model/i }));
    await user.upload(screen.getByLabelText(/use another photo/i), photo());
    model.release(answer);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("starts one run however often Run is pressed while it is running, and keeps focus", async () => {
    const model = deferred();
    const { user } = await openWithPhoto(fake(model.run));
    const button = screen.getByRole("button", { name: /run the model/i });
    await user.click(button);
    await user.click(button);
    expect(model.run).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();
    model.release(answer);
    await vi.waitFor(() => expect(button).toHaveAttribute("aria-disabled", "false"));
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
