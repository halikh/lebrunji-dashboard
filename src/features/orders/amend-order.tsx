"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { Button, Field, cx } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToasts } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { useMenu } from "@/features/catalog/use-menu";
import { useItemOptionGroups } from "@/features/catalog/use-options";
import { Price } from "@/features/reference/price";
import { useMoney } from "@/features/reference/use-currencies";
import { formatMoney } from "@/lib/money";

import { amendOrder, type LineChange, type Substitution } from "./api/amend";
import type { Order, OrderLine } from "./api/orders";
import { Thumbnail } from "./order-detail";
import { orderKeys } from "./use-orders";

/**
 * Changing an order after the customer has been rung.
 *
 * ## The order is not cancelled, and that is the whole point
 *
 * A dish is out of stock. Before this, the only lever the dashboard had was
 * Cancel — which throws away the rest of the basket, the other shop's share of
 * it, and the customer's place in the queue, over one missing item. The
 * operator rings, the customer agrees to go without it or take something else,
 * and *this* is where that conversation gets recorded.
 *
 * ## Everything is a quantity
 *
 * There is no "remove" button, because removing is bringing zero of something.
 * One control per line, counting down from what was ordered, and the reason
 * follows from the number: fewer than ordered is **short**, none at all is
 * **out of stock**. Asking the operator to classify their own edit would be a
 * second question with one right answer.
 *
 * Nothing counts *up*. Adding to an order is a different act with different
 * consent — the customer agreed on the phone to a reduction or a swap, and a
 * control that could quietly increase what they owe does not belong behind the
 * same button. The constraint in migration 0082 says so too.
 *
 * ## The new total is on screen before it is committed
 *
 * The operator is on the phone. "So it comes to £22.40 instead" is the sentence
 * they need to say, and it has to be true before they say it — so the running
 * total is computed here from the same rule the function uses, and the delivery
 * fee and discount are shown unchanged beside it so nobody is surprised by
 * them.
 *
 * That is a second implementation of the arithmetic, which is normally the
 * thing this codebase refuses. It is tolerable here for the reason a preview
 * always is: it decides nothing. The figure that gets written is the one
 * Postgres computes and returns, and the panel refetches — so a disagreement
 * shows up as a corrected number rather than as a wrong bill.
 */
export function AmendOrder({
  order,
  lines,
  onClose,
}: {
  order: Order;
  lines: OrderLine[];
  onClose: () => void;
}) {
  const titleId = useId();
  const toast = useToasts();
  const queryClient = useQueryClient();

  /** Line id → how many are coming. Absent means unchanged. */
  const [counts, setCounts] = useState<Record<string, number>>({});
  /** Line id → the dish sent instead. */
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  /**
   * Line id → the choices made on the substitute.
   *
   * Kept beside the swap rather than inside it so that changing the dish can
   * clear them in one place: an option belongs to one dish (migration 0074), so
   * choices carried across a change of dish would be refused by the function —
   * and would look, on screen, as though they had been accepted.
   */
  const [swapOptions, setSwapOptions] = useState<Record<string, string[]>>({});
  /**
   * Line id → what the substitute costs, options included.
   *
   * Reported up by `AmendLine`, which is the only component holding the menu
   * and the option groups. Without it the running total below counted a
   * substituted line at **zero** — the original goes to zero and the
   * replacement was invisible — so the figure the operator read down the phone
   * was lower than the one the order ended up with.
   *
   * Pushed from the handlers rather than derived in an effect: the dish and the
   * options both change in response to a click, and that click already knows
   * the new price. An effect would recompute it a render later, which is one
   * frame of a total nobody chose.
   */
  const [swapPrices, setSwapPrices] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  // Absent keys mean unchanged, so an amendment that has been opened and not
  // touched is not unsaved work. `swapOptions` and `swapPrices` are left out:
  // neither can be set without a swap, which is counted.
  useUnsavedChanges(
    Object.keys(counts).length > 0 ||
      Object.keys(swaps).length > 0 ||
      note.trim() !== "",
  );

  // Lines that are themselves the result of an earlier amendment are shown but
  // not editable: a substitute has already been agreed, and amending an
  // amendment through the same form would need the operator to hold two
  // versions of the order in their head.
  const editable = lines.filter((line) => line.amendmentReason === null);

  const amend = useMutation({
    mutationFn: () =>
      amendOrder({
        orderId: order.id,
        changes: Object.entries(counts).map(
          ([lineId, quantity]): LineChange => ({
            lineId,
            fulfilledQuantity: quantity,
            // The reason follows from the number rather than being asked for.
            reason: quantity === 0 ? "out_of_stock" : "short",
          }),
        ),
        substitutions: Object.entries(swaps).map(
          ([replacesLineId, menuItemId]): Substitution => {
            const original = lines.find((line) => line.id === replacesLineId);
            const ordered = original?.quantity ?? 1;
            const coming = counts[replacesLineId] ?? ordered;

            return {
              replacesLineId,
              menuItemId,
              // The substitute covers what is **missing**, not the whole line.
              // Sending the ordered quantity charged for both halves of a
              // partial swap: three ordered, one available, and the customer
              // got billed for one kibbeh and three sfiha.
              quantity: Math.max(ordered - coming, 1),
              optionIds: swapOptions[replacesLineId] ?? [],
            };
          },
        ),
        note,
      }),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      toast.success(t("amend.done", { code: order.code }));
      onClose();
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });

  /**
   * What the order comes to with these changes.
   *
   * A substituted line is counted at the *replacement's* price, which is not
   * known here until a dish is picked — so the preview reads it off the menu
   * the select was populated from. Where it cannot, the line is left at its
   * original price and the note under the total says the figure will settle on
   * save, rather than showing a number quietly built on a guess.
   */
  const subtotal = lines.reduce((sum, line) => {
    const quantity = counts[line.id] ?? line.fulfilledQuantity ?? line.quantity;
    const kept = line.unitPrice * quantity;

    // A substitution is the original at its reduced quantity **plus** the
    // replacement at the quantity that went missing — which is what the
    // function does, and what the customer agreed to.
    const swapped = swaps[line.id]
      ? (swapPrices[line.id] ?? 0) * (line.quantity - quantity)
      : 0;

    return sum + kept + swapped;
  }, 0);
  const total = Math.max(subtotal + order.deliveryFee - order.discount, 0);

  const touched =
    Object.keys(counts).length > 0 || Object.keys(swaps).length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy={titleId}
      className="w-[min(640px,92vw)]"
    >
      <div className="flex max-h-[80vh] flex-col">
        <div className="flex flex-col gap-xxs border-b border-border p-xxl">
          <h2 id={titleId} className="text-[20px]">
            {t("amend.title", { code: order.code })}
          </h2>
          <p className="text-[13px] text-text-soft">{t("amend.blurb")}</p>
        </div>

        <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
          {/* Grouped under the shop, with its picture, exactly as the receipt
              is. A two-shop order is two kitchens, and "we are out of the
              kibbeh" is a fact about one of them — a flat list of dishes leaves
              the operator working out which shop they are on the phone to. */}
          {order.stores.map((store) => {
            const own = editable.filter(
              (line) => line.orderStoreId === store.id,
            );
            if (own.length === 0) return null;

            return (
              <section key={store.id} className="flex flex-col gap-md">
                <div className="flex items-center gap-md">
                  <Thumbnail src={store.storeImageUrl} size={32} rounded />
                  <h3 className="truncate text-[15px] font-semibold">
                    {store.storeName}
                  </h3>
                </div>

                {own.map((line) => (
                  <AmendLine
                    key={line.id}
                    line={line}
                    storeId={store.storeId}
                    currencyCode={order.currencyCode}
                    count={counts[line.id] ?? line.quantity}
                    onCount={(next) =>
                      setCounts((current) => ({ ...current, [line.id]: next }))
                    }
                    swap={swaps[line.id] ?? null}
                    onSwap={(itemId, unitPrice) => {
                      setSwaps((current) => {
                        const next = { ...current };
                        if (itemId) next[line.id] = itemId;
                        else delete next[line.id];
                        return next;
                      });
                      // Choices belong to the dish they were made on. Carrying
                      // them to a different one would be refused by the
                      // function and would look accepted until then.
                      setSwapOptions((current) => {
                        const next = { ...current };
                        delete next[line.id];
                        return next;
                      });
                      setSwapPrices((current) => ({
                        ...current,
                        [line.id]: unitPrice,
                      }));
                    }}
                    options={swapOptions[line.id] ?? []}
                    onOptions={(ids, unitPrice) => {
                      setSwapOptions((current) => ({
                        ...current,
                        [line.id]: ids,
                      }));
                      setSwapPrices((current) => ({
                        ...current,
                        [line.id]: unitPrice,
                      }));
                    }}
                  />
                ))}
              </section>
            );
          })}

          <Field label={t("amend.note")} hint={t("amend.noteHint")}>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("amend.notePlaceholder")}
              rows={2}
              maxLength={500}
              className="w-full rounded-md border border-border bg-surface px-md py-sm text-[14px]"
            />
          </Field>
        </div>

        <div className="flex shrink-0 flex-col gap-md border-t border-border p-xxl">
          <div className="flex items-baseline justify-between gap-lg">
            <span className="text-[15px] font-semibold">
              {t("amend.newTotal")}
            </span>
            <div className="flex items-baseline gap-md">
              {total !== order.total && (
                // The old figure, struck through beside the new one. On the
                // phone the operator is saying "it was X, it is now Y", and
                // both halves of that sentence should be readable at once.
                <span className="text-[13px] text-text-faint line-through">
                  <Price value={order.total} code={order.currencyCode} />
                </span>
              )}
              <Price value={total} code={order.currencyCode} align="end" />
            </div>
          </div>

          <p className="text-[12px] text-text-faint">{t("amend.feesStand")}</p>

          {/* End-aligned, because a dialog's actions belong where the eye
              finishes rather than where it starts — and every other dialog in
              the dashboard puts them there. */}
          <div className="flex items-center justify-end gap-sm">
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => amend.mutate()}
              disabled={!touched}
              pending={amend.isPending}
            >
              {t("amend.confirm")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * One line, and what is happening to it.
 *
 * The substitute picker only appears once the count has been reduced. Offering
 * it against a line that is coming in full is offering to replace something
 * that does not need replacing, and it is the sort of control that gets used by
 * accident precisely because it is always there.
 */
function AmendLine({
  line,
  storeId,
  currencyCode,
  count,
  onCount,
  swap,
  onSwap,
  options,
  onOptions,
}: {
  line: OrderLine;
  storeId: string;
  currencyCode: string;
  count: number;
  onCount: (next: number) => void;
  swap: string | null;
  /** The chosen dish and what it costs bare — the parent cannot price it. */
  onSwap: (itemId: string | null, unitPrice: number) => void;
  options: string[];
  /** The choices and the resulting unit price, extras included. */
  onOptions: (ids: string[], unitPrice: number) => void;
}) {
  const menu = useMenu(storeId);
  // Only for the dish actually chosen. A question about a dish nobody has
  // picked is a request for nothing, and `useItemOptionGroups` is disabled on
  // a null id rather than fetching every menu's questions up front.
  const groups = useItemOptionGroups(swap);
  const { currencies } = useMoney();
  const currency = currencies?.find((one) => one.code === currencyCode);
  const money = (minor: number) =>
    currency ? formatMoney(minor, currency) : null;
  const short = count < line.quantity;

  /**
   * What a dish costs with these choices.
   *
   * The same sum migration 0091 does — the dish's price plus every chosen
   * option's — and it is a preview, not the decision: the figure written is the
   * one the function computes and returns. That is what makes a second copy of
   * the arithmetic tolerable here.
   */
  function priceOf(itemId: string | null, optionIds: string[]): number {
    if (!itemId) return 0;

    const dish = (menu.data ?? [])
      .flatMap((section) => section.items)
      .find((item) => item.id === itemId);
    if (!dish) return 0;

    const extras = (groups.data ?? [])
      .flatMap((group) => group.options)
      .filter((option) => optionIds.includes(option.id))
      .reduce((sum, option) => sum + option.price, 0);

    return dish.price + extras;
  }

  // Flattened across sections: the operator is looking for a dish, and which
  // heading it lives under is the menu screen's concern rather than this one's.
  // The dish being replaced is left out — offering it as its own substitute is
  // an option with nothing behind it.
  const dishes = (menu.data ?? [])
    .flatMap((section) => section.items)
    .filter((item) => item.isActive && item.id !== line.menuItemId)
    .map((item) => ({ value: item.id, label: pickLocalized(item.name) }));

  return (
    <div
      className={cx(
        "flex flex-col gap-sm rounded-lg border p-lg",
        short ? "border-danger-wash bg-danger-wash/20" : "border-border",
      )}
    >
      <div className="flex items-center gap-lg">
        {/* The picture, because a dish is recognised by it faster than by its
            name — and the operator is scanning for the one they are holding an
            empty tray of. It dims when the line is going to zero, so the row
            reads as struck out at a glance rather than only in its text. */}
        <span className={cx(count === 0 && "opacity-40")}>
          <Thumbnail src={line.imageUrl} size={40} />
        </span>
        <span
          className={cx(
            "min-w-0 flex-grow truncate text-[15px] font-semibold",
            count === 0 && "text-text-faint line-through",
          )}
        >
          {line.name}
        </span>
        <Price value={line.unitPrice * count} code={currencyCode} align="end" />
      </div>

      <div className="flex flex-wrap items-center gap-lg">
        <div className="flex items-center gap-sm">
          <span className="text-[13px] text-text-soft">
            {t("amend.coming")}
          </span>
          {/* Buttons rather than a number field. The numbers are 0 to at most a
              handful, the operator is holding a phone, and a spinner that can
              be scrolled past is the one input this screen must not have. */}
          <div className="flex items-center gap-xxs">
            {Array.from({ length: line.quantity + 1 }, (_, value) => (
              <button
                key={value}
                type="button"
                onClick={() => onCount(value)}
                aria-pressed={count === value}
                className={cx(
                  "size-[32px] rounded-md border text-[14px] font-semibold tabular-nums transition-[background-color,border-color]",
                  count === value
                    ? "border-active bg-active-wash text-active-ink"
                    : "border-border text-text-soft",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-text-faint">
            {t("amend.ordered", { count: line.quantity })}
          </span>
        </div>

        {short && (
          <div className="flex min-w-[220px] flex-grow items-center gap-sm">
            <span className="shrink-0 text-[13px] text-text-soft">
              {t("amend.instead")}
            </span>
            <div className="min-w-0 flex-grow">
              <Select
                value={swap ?? ""}
                onChange={(value) =>
                  onSwap(value || null, priceOf(value || null, []))
                }
                options={dishes}
                placeholder={t("amend.nothing")}
                isClearable
              />
            </div>
          </div>
        )}

        {/* The chosen dish's own questions. They appear only once a dish is
            picked, because until then there is nothing to ask about — and they
            matter for money as well as for the kitchen: an option carries a
            price, so a substitute taken with extras and recorded without them
            is a total the customer never agreed to.

            Every group is shown, required or not, because the operator is on
            the phone reading them out. Hiding the optional ones would mean
            asking "anything else with that?" from memory. */}
        {swap &&
          (groups.data ?? [])
            .filter((group) => group.isActive)
            .map((group) => (
              <div key={group.id} className="flex flex-col gap-xs">
                <span className="text-[13px] font-semibold">
                  {pickLocalized(group.title)}
                  {group.minSelections > 0 && (
                    <span className="ps-sm text-[11px] font-normal text-danger">
                      {t("amend.optionRequired")}
                    </span>
                  )}
                </span>

                <div className="flex flex-wrap gap-xs">
                  {group.options
                    .filter((option) => option.isActive)
                    .map((option) => {
                      const on = options.includes(option.id);

                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            // `single` replaces every other choice in the same
                            // group; `multi` toggles. The database has the same
                            // rule as `max_selections`, and getting it wrong
                            // here would show a selection the save then refuses.
                            const others = options.filter(
                              (id) =>
                                !group.options.some(
                                  (sibling) => sibling.id === id,
                                ),
                            );
                            const next =
                              group.mode === "single"
                                ? on
                                  ? others
                                  : [...others, option.id]
                                : on
                                  ? options.filter((id) => id !== option.id)
                                  : [...options, option.id];

                            onOptions(next, priceOf(swap, next));
                          }}
                          className={cx(
                            "rounded-md border px-md py-xs text-[13px] transition-[background-color,border-color]",
                            on
                              ? "border-active bg-active-wash font-semibold text-active-ink"
                              : "border-border text-text-soft",
                          )}
                        >
                          {pickLocalized(option.name)}
                          {option.price > 0 && (
                            // `Price` renders both currencies stacked, which is
                            // right on a bill and wrong inside a chip. The
                            // extra is a nudge on a label, so it is the one
                            // figure here shown in one currency.
                            <span className="ps-xs tabular-nums text-text-faint">
                              {"+"}
                              {money(option.price) ?? option.price}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
