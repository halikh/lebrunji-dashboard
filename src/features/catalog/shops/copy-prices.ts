/**
 * What copying one branch's prices onto another would do, worked out before it
 * is done.
 *
 * Mirrors `copy_branch_prices` (`0107`, `0229`) rather than guessing at it: for
 * every dish in scope the target ends up with the source's override, or none
 * where the source has none — and the choices of the questions those dishes ask
 * follow by the same rule. So the preview compares *overrides*, not effective
 * prices: a target override equal to the shop's price still "goes back to the
 * shop's price", because after the copy it follows the menu again.
 *
 * Pure, so the sentence the dialog shows is tested rather than trusted.
 */

export type PriceSide = {
  /** Item id → this branch's own price, where it has one. Minor units. */
  itemPrices: ReadonlyMap<string, number>;
  /** Option id → this branch's own price, where it has one. Minor units. */
  optionPrices: ReadonlyMap<string, number>;
};

export type ScopeItem = { id: string; name: string; shopPrice: number };

/** A question's choices and the dishes asking it — `StoreQuestion`'s shape. */
export type ScopeQuestion = {
  itemIds: readonly string[];
  choices: readonly { id: string }[];
};

export type PriceChange = {
  id: string;
  name: string;
  /** What the target charges now: its own price, or the shop's. */
  from: number;
  /** What it will charge after the copy. */
  to: number;
  /** The target stops having a price of its own. */
  backToShop: boolean;
};

export type CopyPreview = {
  /** Dishes taking the source's own price. */
  dishesChange: number;
  /** Choices taking the source's own price. */
  choicesChange: number;
  /** Dishes and choices going back to the shop's price. */
  dishesBack: number;
  choicesBack: number;
  /** Dishes and choices that already match. */
  same: number;
  /** Every dish whose price moves, in the order given. */
  dishes: PriceChange[];
};

type Outcome = "same" | "change" | "back";

function outcome(
  before: number | undefined,
  after: number | undefined,
): Outcome {
  if (before === after) return "same";
  return after === undefined ? "back" : "change";
}

export function previewCopy({
  items,
  questions,
  source,
  target,
}: {
  /** The dishes in scope: the whole menu, or one section's. */
  items: readonly ScopeItem[];
  questions: readonly ScopeQuestion[];
  source: PriceSide;
  target: PriceSide;
}): CopyPreview {
  const preview: CopyPreview = {
    dishesChange: 0,
    choicesChange: 0,
    dishesBack: 0,
    choicesBack: 0,
    same: 0,
    dishes: [],
  };

  for (const item of items) {
    const before = target.itemPrices.get(item.id);
    const after = source.itemPrices.get(item.id);
    const result = outcome(before, after);
    if (result === "same") {
      preview.same += 1;
      continue;
    }
    if (result === "back") preview.dishesBack += 1;
    else preview.dishesChange += 1;
    preview.dishes.push({
      id: item.id,
      name: item.name,
      from: before ?? item.shopPrice,
      to: after ?? item.shopPrice,
      backToShop: result === "back",
    });
  }

  // A choice belongs to one question, but a question is asked on many dishes:
  // counted once, if any dish in scope asks it — as the RPC's `in` does.
  const inScope = new Set(items.map((item) => item.id));
  const choices = new Set<string>();
  for (const question of questions) {
    if (!question.itemIds.some((id) => inScope.has(id))) continue;
    for (const choice of question.choices) choices.add(choice.id);
  }
  for (const id of choices) {
    const result = outcome(
      target.optionPrices.get(id),
      source.optionPrices.get(id),
    );
    if (result === "same") preview.same += 1;
    else if (result === "back") preview.choicesBack += 1;
    else preview.choicesChange += 1;
  }

  return preview;
}

/** How many prices the copy would actually move. */
export function movedCount(preview: CopyPreview): number {
  return (
    preview.dishesChange +
    preview.choicesChange +
    preview.dishesBack +
    preview.choicesBack
  );
}
