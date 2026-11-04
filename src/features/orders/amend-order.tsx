"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { Button, Field, cx } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToasts } from "@/components/ui/toast";
import {
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { useMenu } from "@/features/catalog/use-menu";
import { useItemOptionGroups } from "@/features/catalog/use-options";
import { Price } from "@/features/reference/price";
import { unitLabel } from "@/lib/unit-label";
import { itemUnit, linePrice } from "@/lib/units";

import {
  amendOrder,
  previewAmendment,
  type Amendment,
  type LineChange,
  type Substitution,
} from "./api/amend";
import { countAmendments } from "./api/history";
import {
  placeName,
  roundingOf,
  type Order,
  type OrderLine,
} from "./api/orders";
import { OrderRefusal } from "./api/refusal";
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
 * they need to say, and it has to be true before they say it — so every change
 * is sent to `api_v1_preview_amendment` (`0233`), which runs the amendment and
 * rolls it back. The figure on screen is the one Save will write.
 *
 * It used to be worked out here, as a second copy of the arithmetic, on the
 * grounds that a preview decides nothing. It decided what the customer was
 * told: a substitute at the brand's price in the shop's currency, added to an
 * order in another one, so a $5 dish read as 500 LBP (QA-012). Branch prices,
 * conversion at the shop's rate and `line_price` all live in the function, and
 * a copy here only follows them until the next migration.
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
  const [note, setNote] = useState("");
  const guarded = useGuardedAction();

  /**
   * The total this form was opened against, held for the life of the form.
   *
   * State, not the prop: realtime refetches the order under an open form, and
   * a prop would quietly move the baseline to whatever somebody else saved —
   * which is the very change `p_expected_total` exists to catch.
   */
  const [openedAt] = useState(order.total);

  /**
   * How many amendments the order had when this form opened — the version
   * `p_expected_amendments` checks (`0175`). The total alone cannot be the
   * check: two different amendments can round to the same lira total.
   *
   * Read fresh (`gcTime: 0`, so a reopened form never starts from the last
   * one's figure) and then frozen in state the first time it arrives, for the
   * same reason as `openedAt` — realtime invalidates everything under
   * `orders`, and a refetch must not move the baseline. Adjusted during render
   * rather than in an effect, so there is no frame where the count is known
   * and the form does not hold it.
   */
  const seen = useQuery({
    queryKey: [...orderKeys.amendments(order.id), "count"],
    queryFn: () => countAmendments(order.id),
    gcTime: 0,
  });
  const [amendmentsAtOpen, setAmendmentsAtOpen] = useState<number | null>(null);
  if (amendmentsAtOpen === null && seen.data !== undefined) {
    setAmendmentsAtOpen(seen.data);
  }

  // Absent keys mean unchanged, so an amendment that has been opened and not
  // touched is not unsaved work. `swapOptions` is left out: it cannot be set
  // without a swap, which is counted.
  useUnsavedChanges(
    Object.keys(counts).length > 0 ||
      Object.keys(swaps).length > 0 ||
      note.trim() !== "",
  );

  // Lines that are themselves the result of an earlier amendment are shown but
  // not editable: a substitute has already been agreed, and amending an
  // amendment through the same form would need the operator to hold two
  // versions of the order in their head.
  //
  // Nor is a line that already has a substitute (`0175`): the function refuses
  // any change to it with LINEX, because a count set on it beside its
  // replacement would charge for both. Known by the substitute pointing back
  // at it, since its own reason is the operator's ("out of stock"), not
  // "replaced".
  const editable = lines.filter(
    (line) =>
      line.amendmentReason === null &&
      !lines.some((other) => other.replacesLineId === line.id),
  );

  // One description of the change, for the preview and the save alike — so
  // the total read out is the total of exactly what gets saved.
  const amendment: Amendment = {
    orderId: order.id,
    changes: Object.entries(counts).map(([lineId, quantity]): LineChange => ({
      lineId,
      fulfilledQuantity: quantity,
      // The reason follows from the number rather than being asked for.
      reason: quantity === 0 ? "out_of_stock" : "short",
    })),
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
    expectedTotal: openedAt,
    // Null only when the count could not be read; the total check then
    // stands alone, as it did before `0175`.
    expectedAmendments: amendmentsAtOpen,
  };

  const touched =
    Object.keys(counts).length > 0 || Object.keys(swaps).length > 0;

  /**
   * What the order comes to with these changes, from the function itself.
   *
   * Keyed on the change, so each click asks once and going back to an earlier
   * state is answered from cache. The last answer stays on screen, dimmed,
   * while the next is fetched — a total that blinks out on every press is
   * one the operator cannot read from. Not retried: a refusal is an answer.
   *
   * Waits for the amendment count, so the preview checks the same version the
   * save will — and is refused `MOVED` the moment somebody else saves, which
   * realtime makes it ask again about.
   */
  const preview = useQuery({
    queryKey: [
      ...orderKeys.amendments(order.id),
      "preview",
      amendment.changes,
      amendment.substitutions,
      openedAt,
      amendmentsAtOpen,
    ],
    queryFn: () => previewAmendment(amendment),
    enabled: touched && !seen.isPending,
    placeholderData: (previous) => previous,
    retry: false,
    gcTime: 0,
  });

  const amend = useMutation({
    mutationFn: () => amendOrder({ ...amendment, note }),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      toast.success(t("amend.done", { code: order.code }));
      onClose();
    },
    onError: (error) => {
      // Whatever the refusal, the receipt behind this form may be out of date
      // — refetch it, so what the operator reads next is the order as it is.
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
      // The refusals that mean *this form* is stale: somebody else amended
      // it (`MOVED`), a line here was already replaced (`LINEX`), or it has
      // left the kitchen (`check_violation`). Saving again from the same form
      // would be refused the same way, so it closes and the operator reopens
      // it on the order as it now stands. Anything else — a dropped
      // connection — leaves it open to retry.
      if (
        error instanceof OrderRefusal &&
        (error.code === "MOVED" ||
          error.code === "LINEX" ||
          error.code === "23514")
      ) {
        onClose();
      }
    },
  });

  // Untouched, the order as it stands. Touched, the function's answer — and
  // nothing until there is one: a figure for a change it has not priced is
  // the guess this form used to read out.
  const figures = touched ? preview.data : order;
  const total = figures?.total ?? null;
  const rounding = figures ? roundingOf(figures) : 0;
  // Behind the change on screen: still asking, or the last answer refused.
  const stale = touched && (preview.isFetching || preview.isError);

  return (
    <Modal
      open
      onClose={guarded(onClose)}
      labelledBy={titleId}
      width={640}
      flush
    >
      {/* `dvh` on a phone, where `vh` is the height with the address bar
          gone and a dialog sized to it runs its footer under the bar. Less
          the UA's margin, so the body scrolls inside and the dialog itself
          never does. */}
      <div className="flex max-h-[calc(100dvh-6rem)] flex-col md:max-h-[80vh]">
        <div className="flex flex-col gap-xxs border-b border-border p-lg pe-[60px] md:p-xxl md:pe-[60px]">
          <h2 id={titleId} className="text-[20px]">
            {t("amend.title", { code: order.code })}
          </h2>
          <p className="text-[13px] text-text-soft">{t("amend.blurb")}</p>
        </div>

        <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto scroll-hint p-lg md:p-xxl">
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
                  <Thumbnail
                    src={store.storeImageUrl}
                    size={32}
                    rounded
                    name={store.storeName}
                  />
                  <h3 className="truncate text-[15px] font-semibold">
                    {placeName(store)}
                  </h3>
                </div>

                {own.map((line) => (
                  <AmendLine
                    key={line.id}
                    line={line}
                    storeId={store.storeId}
                    currencyCode={order.currencyCode}
                    shopRate={order.shopRate}
                    count={counts[line.id] ?? line.quantity}
                    onCount={(next) =>
                      setCounts((current) => ({ ...current, [line.id]: next }))
                    }
                    swap={swaps[line.id] ?? null}
                    onSwap={(itemId) => {
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
                    }}
                    options={swapOptions[line.id] ?? []}
                    onOptions={(ids) =>
                      setSwapOptions((current) => ({
                        ...current,
                        [line.id]: ids,
                      }))
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
              className="w-full rounded-md border border-line bg-cream px-md py-sm text-[14px] focus:bg-field-focus"
            />
          </Field>
        </div>

        <div className="flex shrink-0 flex-col gap-md border-t border-border p-lg md:p-xxl">
          {/* The receipt's rounding line, so the new total reads as the lines
              plus the cash step rather than as a figure that does not add
              up. Only once something is changed — before that, the receipt
              behind the form already shows it. */}
          {touched && rounding !== 0 && (
            <div className="flex items-baseline justify-between gap-lg text-[13px] text-text-soft">
              <span>{t("orders.rounding")}</span>
              <Price
                value={rounding}
                code={order.currencyCode}
                shopRate={order.shopRate}
                align="end"
              />
            </div>
          )}
          <div className="flex items-baseline justify-between gap-lg">
            <span className="text-[15px] font-semibold">
              {t("amend.newTotal")}
            </span>
            <div
              className={cx(
                "flex items-baseline gap-md transition-opacity",
                stale && "opacity-40",
              )}
              aria-busy={preview.isFetching}
            >
              {touched && total !== null && total !== order.total && (
                // The old figure, struck through beside the new one. On the
                // phone the operator is saying "it was X, it is now Y", and
                // both halves of that sentence should be readable at once.
                <span className="text-[13px] text-text-faint line-through">
                  <Price
                    value={order.total}
                    code={order.currencyCode}
                    shopRate={order.shopRate}
                  />
                </span>
              )}
              {total === null ? (
                <span className="text-[13px] text-text-faint">
                  {t("amend.pricing")}
                </span>
              ) : (
                <Price
                  value={total}
                  code={order.currencyCode}
                  shopRate={order.shopRate}
                  align="end"
                />
              )}
            </div>
          </div>

          {/* The function's refusal, in the operator's words — the same one
              Save would get, shown while there is still time to change the
              form rather than after pressing it. */}
          {touched && preview.isError && (
            <p role="alert" className="text-[13px] text-danger">
              {preview.error.message}
            </p>
          )}

          <p className="text-[12px] text-text-faint">{t("amend.feesStand")}</p>

          {/* End-aligned, because a dialog's actions belong where the eye
              finishes rather than where it starts — and every other dialog in
              the dashboard puts them there. */}
          <div className="flex items-center justify-end gap-sm">
            <Button variant="secondary" onClick={guarded(onClose)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => amend.mutate()}
              // Not until the amendment count is in: saving without it would
              // drop back to the total check this form is meant to outgrow.
              // Nor while the total is still being asked for — Save is what
              // the operator presses after reading it out. A refused preview
              // leaves Save on, so its refusal closes a stale form as before.
              disabled={!touched || seen.isPending || preview.isFetching}
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
  shopRate,
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
  /** The rate this order reads at — see `Order.shopRate`. */
  shopRate: number | null;
  count: number;
  onCount: (next: number) => void;
  swap: string | null;
  onSwap: (itemId: string | null) => void;
  options: string[];
  onOptions: (ids: string[]) => void;
}) {
  const menu = useMenu(storeId);
  // Only for the dish actually chosen. A question about a dish nobody has
  // picked is a request for nothing, and `useItemOptionGroups` is disabled on
  // a null id rather than fetching every menu's questions up front.
  const groups = useItemOptionGroups(swap);
  const short = count < line.quantity;

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
        short ? "border-warning bg-warning-wash/60" : "border-border",
      )}
    >
      <div className="flex items-center gap-lg">
        {/* The picture, because a dish is recognised by it faster than by its
            name — and the operator is scanning for the one they are holding an
            empty tray of. It dims when the line is going to zero, so the row
            reads as struck out at a glance rather than only in its text. */}
        <span className={cx(count === 0 && "opacity-40")}>
          <Thumbnail src={line.imageUrl} size={40} name={line.name} />
        </span>
        <span
          className={cx(
            "min-w-0 flex-grow truncate text-[15px] font-semibold",
            count === 0 && "text-text-faint line-through",
          )}
        >
          {line.name}
        </span>
        <Price
          value={linePrice(
            line.unitPrice,
            line.optionsPrice,
            itemUnit(line),
            count,
          )}
          code={currencyCode}
          shopRate={shopRate}
          align="end"
        />
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
                  "h-[32px] rounded-md border text-[14px] font-semibold tabular-nums transition-[background-color,border-color]",
                  // A square for a count, wider for an amount: "1.5 kg" does
                  // not fit a 32px box, and since `0122` the amount is what
                  // the operator is agreeing to on the phone — the press
                  // number behind it is an implementation detail of the
                  // stepper the customer used.
                  itemUnit(line)?.step == null
                    ? "w-[32px]"
                    : "min-w-[32px] px-sm",
                  count === value
                    ? "border-active bg-active-wash text-active-ink"
                    : "border-border text-text-soft",
                )}
              >
                {/* Zero is none of it, whatever the unit — "0 kg" is a
                    quantity nobody says, and the button beside it is "1 kg". */}
                {value === 0 ? 0 : unitLabel(line, value)}
              </button>
            ))}
          </div>
          <span className="text-[12px] text-text-faint">
            {t("amend.ordered", { count: unitLabel(line, line.quantity) })}
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
                    <span className="ps-sm text-[11px] font-normal text-text-faint">
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

                            onOptions(next);
                          }}
                          className={cx(
                            "rounded-md border px-md py-xs text-[13px] transition-[background-color,border-color]",
                            on
                              ? "border-active bg-active-wash font-semibold text-active-ink"
                              : "border-border text-text-soft",
                          )}
                        >
                          {/* No price on the chip. The catalogue's figure is
                              the brand's, in the shop's currency — not what
                              this branch charges, nor in the order's money —
                              and printing it here was QA-012 in small. The
                              new total moves with every press instead. */}
                          {pickLocalized(option.name)}
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
