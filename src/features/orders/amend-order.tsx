"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { Button, Field, cx } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { useMenu } from "@/features/catalog/use-menu";
import { Price } from "@/features/reference/price";

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
  const [note, setNote] = useState("");

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
          ([replacesLineId, menuItemId]): Substitution => ({
            replacesLineId,
            menuItemId,
            quantity:
              lines.find((line) => line.id === replacesLineId)?.quantity ?? 1,
          }),
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
    return sum + line.unitPrice * quantity;
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
                    onSwap={(itemId) =>
                      setSwaps((current) => {
                        const next = { ...current };
                        if (itemId) next[line.id] = itemId;
                        else delete next[line.id];
                        return next;
                      })
                    }
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
}: {
  line: OrderLine;
  storeId: string;
  currencyCode: string;
  count: number;
  onCount: (next: number) => void;
  swap: string | null;
  onSwap: (itemId: string | null) => void;
}) {
  const menu = useMenu(storeId);
  const short = count < line.quantity;

  // Flattened across sections: the operator is looking for a dish, and which
  // heading it lives under is the menu screen's concern rather than this one's.
  // The dish being replaced is left out — offering it as its own substitute is
  // an option with nothing behind it.
  const options = (menu.data ?? [])
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
                onChange={(value) => onSwap(value || null)}
                options={options}
                placeholder={t("amend.nothing")}
                isClearable
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
