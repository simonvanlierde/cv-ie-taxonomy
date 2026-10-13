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
  licence: "none",
  run,
});

// jsdom has no object URLs
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

async function openWithPhoto(model: RealModel) {
  const user = userEvent.setup();
  render(<RealPhoto scale="Component" model={model} />);
  await user.click(screen.getByRole("button", { name: /try a real model on one photo/i }));
  await user.upload(
    screen.getByLabelText(/use your own photo/i),
    new File(["x"], "fan.jpg", { type: "image/jpeg" }),
  );
  return user;
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
    const user = await openWithPhoto(fake(run));
    await user.click(screen.getByRole("button", { name: /run the model/i }));

    expect(run).toHaveBeenCalledWith(screen.getByAltText("Your photo"));
    const result = await screen.findByRole("status");
    expect(result).toHaveTextContent(/one photo, not validation · Fake detector/i);
    expect(within(result).getByRole("listitem")).toHaveTextContent("an electric motor, score 0.42");
  });

  it("says plainly when the model cannot run", async () => {
    const user = await openWithPhoto(
      fake(async () => {
        throw new Error("offline");
      }),
    );
    await user.click(screen.getByRole("button", { name: /run the model/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The model could not run here: offline",
    );
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
