import { describe, expect, it } from "vitest";

import { isBackdropClick } from "./modal";

// A dialog centred on a 1280×800 screen.
const box = { left: 430, right: 850, top: 200, bottom: 600 };
const dialog = {} as EventTarget;
const button = {} as EventTarget;

describe("isBackdropClick", () => {
  it("closes for a click on the backdrop", () => {
    expect(
      isBackdropClick(
        { target: dialog, currentTarget: dialog, clientX: 100, clientY: 100 },
        box,
      ),
    ).toBe(true);
  });

  it("stays open for a button pressed with Enter, which reports 0,0", () => {
    // QA-022: the coordinates are outside the box, and only the target says
    // the click came from inside.
    expect(
      isBackdropClick(
        { target: button, currentTarget: dialog, clientX: 0, clientY: 0 },
        box,
      ),
    ).toBe(false);
  });

  it("stays open for a click on the dialog's own padding", () => {
    expect(
      isBackdropClick(
        { target: dialog, currentTarget: dialog, clientX: 440, clientY: 210 },
        box,
      ),
    ).toBe(false);
  });
});
