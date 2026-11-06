import { describe, expect, it } from "vitest";

import { movedCount, previewCopy } from "./copy-prices";

const items = [
  { id: "a", name: "Burger", shopPrice: 500 },
  { id: "b", name: "Fries", shopPrice: 200 },
  { id: "c", name: "Salad", shopPrice: 300 },
  { id: "d", name: "Soup", shopPrice: 250 },
];

describe("previewCopy", () => {
  it("sorts dishes into changing, going back and already the same", () => {
    const preview = previewCopy({
      items,
      questions: [],
      // a: source's own price; b: source follows the shop, target does not;
      // c: both follow the shop; d: both the same own price.
      source: {
        itemPrices: new Map([
          ["a", 600],
          ["d", 260],
        ]),
        optionPrices: new Map(),
      },
      target: {
        itemPrices: new Map([
          ["b", 220],
          ["d", 260],
        ]),
        optionPrices: new Map(),
      },
    });

    expect(preview.dishesChange).toBe(1);
    expect(preview.dishesBack).toBe(1);
    expect(preview.same).toBe(2);
    expect(preview.dishes).toEqual([
      { id: "a", name: "Burger", from: 500, to: 600, backToShop: false },
      { id: "b", name: "Fries", from: 220, to: 200, backToShop: true },
    ]);
    expect(movedCount(preview)).toBe(2);
  });

  it("takes only the choices of questions asked by a dish in scope, once", () => {
    const preview = previewCopy({
      items: [items[0]],
      questions: [
        // Asked on the burger and elsewhere: in scope, counted once.
        { itemIds: ["a", "z"], choices: [{ id: "x" }, { id: "y" }] },
        { itemIds: ["a"], choices: [{ id: "x" }] },
        // Not asked on anything in scope.
        { itemIds: ["z"], choices: [{ id: "w" }] },
      ],
      source: {
        itemPrices: new Map(),
        optionPrices: new Map([
          ["x", 50],
          ["w", 70],
        ]),
      },
      target: {
        itemPrices: new Map(),
        optionPrices: new Map([["y", 40]]),
      },
    });

    expect(preview.choicesChange).toBe(1);
    expect(preview.choicesBack).toBe(1);
    // The burger itself, both following the shop.
    expect(preview.same).toBe(1);
    expect(movedCount(preview)).toBe(2);
  });

  it("says nothing moves when the two already agree", () => {
    const side = {
      itemPrices: new Map([["a", 600]]),
      optionPrices: new Map(),
    };
    const preview = previewCopy({
      items,
      questions: [],
      source: side,
      target: side,
    });
    expect(movedCount(preview)).toBe(0);
    expect(preview.same).toBe(4);
  });
});
