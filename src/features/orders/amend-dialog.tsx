"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Info } from "lucide-react";
import { useState } from "react";

import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Textarea,
  Thumb,
  cx,
  useToasts,
} from "@/components/ui";
import { Select } from "@/components/ui/select";
import {
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { useMenu } from "@/features/catalog/use-menu";
import { useItemOptionGroups } from "@/features/catalog/use-options";
import { Price } from "@/features/reference/price";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
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
import { roundingOf, type Order, type OrderLine } from "./api/orders";
import { PlaceName } from "./place";
import { OrderRefusal } from "./api/refusal";
import { orderKeys } from "./use-orders";

/**
 * Changing an order after the customer has been rung.
 *
 * ## The order is not cancelled, and that is the whole point
 *
 * A dish is out of stock. Cancel would throw away the rest of the basket, the
 * other shop's share and the customer's place in the queue over one missing
 * item. The operator rings, the customer agrees to go without it or take
 * something else, and this is where that conversation is recorded.
 *
 * ## Everything is a quantity
 *
 * No "remove" button: removing is bringing zero. One control per line counting
 * down from what was ordered, and the reason follows from the number — fewer
 * is **short**, none is **out of stock**. Nothing counts *up*: adding to an
 * order is a different act with different consent, and migration 0082 says so.
 *
 * ## The new total is the database's, and it is on screen before Save
 *
 * The operator is on the phone saying "so it comes to X instead", and X has to
 * be true. Every change is sent to `api_v1_preview_amendment` (`0233`), which
 * runs the amendment and rolls it back — branch prices, conversion at the
 * shop's rate and `line_price` all live there. Working it out here was QA-012:
 * a substitute at the brand's price in the wrong currency, read down the phone.
 *
 * Save then asks once more, with the before and after side by side and the
 * changes listed — the customer is charged the new figure.
 */
export function AmendDialog({
  order,
  lines,
  onClose,
}: {
  order: Order;
  lines: OrderLine[];
  onClose: () => void;
}) {
  const toast = useToasts();
  const queryClient = useQueryClient();
  const guarded = useGuardedAction();

  /** Line id → how many are coming. Absent means unchanged. */
  const [counts, setCounts] = useState<Record<string, number>>({});
  /** Line id → the dish sent instead, and its name for the summary. */
  const [swaps, setSwaps] = useState<
    Record<string, { id: string; name: string }>
  >({});
  /**
   * Line id → the choices made on the substitute. Beside the swap rather than
   * inside it, so changing the dish clears them in one place: an option
   * belongs to one dish (0074), and choices carried across would be refused.
   */
  const [swapOptions, setSwapOptions] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  /**
   * The total this form was opened against, held for the life of the form.
   * State, not the prop: realtime refetches the order under an open form, and
   * a prop would quietly move the baseline to whatever somebody else saved —
   * the very change `p_expected_total` exists to catch.
   */
  const [openedAt] = useState(order.total);

  /**
   * How many amendments the order had when this form opened — the version
   * `p_expected_amendments` checks (`0175`); two amendments can round to the
   * same lira total. Read fresh (`gcTime: 0`) and frozen the first time it
   * arrives, adjusted during render so no frame has it known but not held.
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

  const touched =
    Object.keys(counts).length > 0 || Object.keys(swaps).length > 0;
  // `swapOptions` is left out: it cannot be set without a swap.
  useUnsavedChanges(touched || note.trim() !== "");

  // A line that is itself an earlier amendment's result is shown on the
  // receipt but not offered here; nor is a line that already has a substitute
  // (0175) — the function refuses it (LINEX), since a count beside its
  // replacement would charge for both.
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
      reason: quantity === 0 ? "out_of_stock" : "short",
    })),
    substitutions: Object.entries(swaps).map(
      ([replacesLineId, swap]): Substitution => {
        const original = lines.find((line) => line.id === replacesLineId);
        const ordered = original?.quantity ?? 1;
        const coming = counts[replacesLineId] ?? ordered;
        return {
          replacesLineId,
          menuItemId: swap.id,
          // The substitute covers what is **missing**, not the whole line —
          // sending the ordered quantity billed both halves of a partial swap.
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

  /**
   * What the order comes to with these changes, from the function itself.
   * Keyed on the change, so going back to an earlier state is answered from
   * cache; the last answer stays on screen, dimmed, while the next is fetched.
   * Not retried — a refusal is an answer. Waits for the amendment count so it
   * checks the same version the save will.
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
      // Whatever the refusal, the receipt behind this form may be out of date.
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
      // The refusals that mean *this form* is stale: somebody else amended it
      // (`MOVED`), a line was already replaced (`LINEX`), or it has left the
      // kitchen (`23514`). Saving again would be refused the same way, so it
      // closes; anything else — a dropped connection — stays open to retry.
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
  // nothing until there is one: a figure for an unpriced change is a guess.
  const figures = touched ? preview.data : order;
  const total = figures?.total ?? null;
  const rounding = figures ? roundingOf(figures) : 0;
  const stale = touched && (preview.isFetching || preview.isError);

  // Not until the amendment count is in, nor while the total is still being
  // asked for — Save is pressed after reading it out. A refused preview
  // leaves Save on, so its refusal closes a stale form as before.
  const canSave = touched && !seen.isPending && !preview.isFetching;

  /** What is changing, line by line, for the confirmation. */
  const summary = editable.flatMap((line) => {
    const count = counts[line.id];
    const swap = swaps[line.id];
    const out: string[] = [];
    if (count !== undefined && count !== line.quantity) {
      out.push(
        count === 0
          ? t("amend.summaryNone", { name: line.name })
          : t("amend.summaryShort", {
              name: line.name,
              from: unitLabel(line, line.quantity),
              to: unitLabel(line, count),
            }),
      );
    }
    if (swap) {
      out.push(
        t("amend.summarySwap", { name: swap.name, original: line.name }),
      );
    }
    return out;
  });

  const close = guarded(onClose);

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      title={t("amend.title", { code: order.code })}
      description={t("amend.blurb")}
      size="lg"
      footer={
        <>
          <div className="flex basis-full flex-col gap-2 pb-1">
            <Totals
              order={order}
              before={order.total}
              after={touched ? total : null}
              stale={stale}
              pending={preview.isFetching}
            />
            {touched && rounding !== 0 && (
              // The receipt's rounding line, so the new total reads as the
              // lines plus the cash step rather than a figure that does not
              // add up.
              <div className="flex items-baseline justify-between gap-4 text-[12.5px] text-ink-3">
                <span>{t("orders.rounding")}</span>
                <Price
                  value={rounding}
                  code={order.currencyCode}
                  shopRate={order.shopRate}
                  align="end"
                />
              </div>
            )}
            {touched && preview.isError && (
              // The refusal Save would get, while the form can still change.
              <p
                role="alert"
                className="flex items-start gap-1.5 text-[13px] text-danger-ink"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {preview.error.message}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <Info className="size-3.5 shrink-0" />
              {t("amend.feesStand")}
            </p>
          </div>
          <Button variant="secondary" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!canSave}
            pending={amend.isPending}
            onClick={() => setConfirming(true)}
          >
            {t("amend.review")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {editable.length === 0 && (
          <p className="rounded-md border border-line bg-subtle px-3 py-2.5 text-[13px] text-ink-2">
            {t("amend.nothingLeft")}
          </p>
        )}

        {/* Grouped under the shop, as the receipt is. "We are out of the
            kibbeh" is a fact about one kitchen, and a flat list leaves the
            operator working out which shop they are on the phone to. */}
        {order.stores.map((store) => {
          const own = editable.filter((line) => line.orderStoreId === store.id);
          if (own.length === 0) return null;

          return (
            <section key={store.id} className="flex flex-col gap-2.5">
              <h3 className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
                <Thumb src={store.storeImageUrl} size={24} alt="" />
                <PlaceName store={store} />
              </h3>
              {own.map((line) => (
                <AmendLine
                  key={line.id}
                  line={line}
                  storeId={store.storeId}
                  currencyCode={order.currencyCode}
                  shopRate={order.shopRate}
                  count={counts[line.id] ?? line.quantity}
                  onCount={(next) => {
                    const full = next >= line.quantity;
                    setCounts((current) => {
                      const updated = { ...current };
                      // Back to what was ordered is no change at all — so
                      // the form is not dirty, and nothing is sent for it.
                      if (full) delete updated[line.id];
                      else updated[line.id] = next;
                      return updated;
                    });
                    // Nothing missing, nothing to substitute: the picker is
                    // gone, and a swap left behind it would still be charged.
                    if (full) {
                      setSwaps((current) => {
                        const updated = { ...current };
                        delete updated[line.id];
                        return updated;
                      });
                      setSwapOptions((current) => {
                        const updated = { ...current };
                        delete updated[line.id];
                        return updated;
                      });
                    }
                  }}
                  swap={swaps[line.id]?.id ?? null}
                  onSwap={(dish) => {
                    setSwaps((current) => {
                      const next = { ...current };
                      if (dish) next[line.id] = dish;
                      else delete next[line.id];
                      return next;
                    });
                    // Choices belong to the dish they were made on.
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

        {editable.length > 0 && (
          <Field
            label={t("amend.note")}
            hint={t("amend.noteHint")}
            optional={t("form.optional")}
          >
            {(props) => (
              <Textarea
                {...props}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("amend.notePlaceholder")}
                rows={2}
                maxLength={500}
              />
            )}
          </Field>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("amend.confirmTitle", { code: order.code })}
        description={t("amend.confirmBody")}
        confirmLabel={t("amend.confirm")}
        cancelLabel={t("amend.keepEditing")}
        onConfirm={async () => {
          try {
            await amend.mutateAsync();
          } catch {
            // Said by the mutation's own toast; a stale form has closed.
          }
        }}
      >
        <div className="flex flex-col gap-3">
          {summary.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 ps-5 text-[13.5px] text-ink">
              {summary.map((one) => (
                <li key={one}>{one}</li>
              ))}
            </ul>
          )}
          <Totals
            order={order}
            before={order.total}
            after={total}
            stale={false}
            pending={false}
          />
        </div>
      </ConfirmDialog>
    </Dialog>
  );
}

/**
 * Was → now, with the difference. The operator is saying "it was X, it is now
 * Y", and both halves of that sentence have to be readable at once.
 */
function Totals({
  order,
  before,
  after,
  stale,
  pending,
}: {
  order: Order;
  before: number;
  after: number | null;
  stale: boolean;
  pending: boolean;
}) {
  const money = (value: number, className?: string) => (
    <Price
      value={value}
      code={order.currencyCode}
      shopRate={order.shopRate}
      className={className}
    />
  );
  const difference = after === null ? null : after - before;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[12px] font-medium text-ink-3">
          {t("amend.before")}
        </span>
        {money(
          before,
          cx(
            "text-[15px] font-medium",
            after !== null && after !== before
              ? "text-ink-3 line-through"
              : "text-ink",
          ),
        )}
      </div>
      <ArrowRight aria-hidden className="size-4 text-ink-4 rtl:rotate-180" />
      <div
        className={cx(
          "flex min-w-0 flex-col items-end gap-0.5 text-end transition-opacity",
          stale && "opacity-40",
        )}
        aria-busy={pending || undefined}
        aria-live="polite"
      >
        <span className="text-[12px] font-medium text-ink-3">
          {t("amend.newTotal")}
        </span>
        {after === null ? (
          <span className="text-[13.5px] text-ink-3">
            {pending ? t("amend.pricing") : t("amend.unchanged")}
          </span>
        ) : (
          <>
            {money(after, "text-[18px] font-semibold text-ink")}
            {difference !== null && difference !== 0 && (
              <span
                className={cx(
                  "text-[12.5px] font-medium",
                  difference < 0 ? "text-success-ink" : "text-warning-ink",
                )}
              >
                {money(difference)}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One line, and what is happening to it.
 *
 * The substitute picker appears only once the count is reduced: offering to
 * replace a line coming in full is the sort of control used by accident
 * precisely because it is always there.
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
  onSwap: (dish: { id: string; name: string } | null) => void;
  options: string[];
  onOptions: (ids: string[]) => void;
}) {
  const menu = useMenu(storeId);
  // Only for the dish actually chosen; disabled on a null id.
  const groups = useItemOptionGroups(swap);
  const short = count < line.quantity;
  const counted = itemUnit(line)?.step == null;

  // Flattened across sections — the operator is looking for a dish, not a
  // heading — without the dish being replaced, which is no substitute.
  const dishes = (menu.data ?? [])
    .flatMap((section) => section.items)
    .filter((item) => item.isActive && item.id !== line.menuItemId)
    .map((item) => ({ value: item.id, label: pickLocalized(item.name) }));

  return (
    <div
      className={cx(
        "flex flex-col gap-3 rounded-lg border p-3.5 transition-colors",
        short ? "border-warning/40 bg-warning-soft/60" : "border-line",
      )}
    >
      <div className="flex items-center gap-3">
        {/* The picture, because a dish is recognised by it faster than by its
            name. It dims when the line goes to zero. */}
        <Thumb
          src={line.imageUrl}
          size={40}
          alt=""
          className={cx(count === 0 && "opacity-40")}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cx(
              "truncate text-[14px] font-medium text-ink",
              count === 0 && "text-ink-4 line-through",
            )}
          >
            {line.name}
          </span>
          {(line.options.length > 0 || line.note) && (
            <span className="truncate text-[12.5px] text-ink-3">
              {[...line.options, line.note].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
        <Price
          // `linePrice` counts at least one; none coming costs nothing (`0269`).
          value={
            count > 0
              ? linePrice(
                  line.unitPrice,
                  line.optionsPrice,
                  itemUnit(line),
                  count,
                )
              : 0
          }
          code={currencyCode}
          shopRate={shopRate}
          align="end"
          className="text-[13.5px] font-medium text-ink"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-ink-2">
            {t("amend.coming")}
          </span>
          {/* Buttons rather than a number field: the numbers are 0 to a
              handful, the operator is holding a phone, and a spinner that can
              be scrolled past is the one input this screen must not have. */}
          <div
            role="radiogroup"
            aria-label={t("amend.coming")}
            className="inline-flex flex-wrap rounded-md border border-line bg-hover p-0.5"
          >
            {Array.from({ length: line.quantity + 1 }, (_, value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={count === value}
                onClick={() => onCount(value)}
                className={cx(
                  "h-7 rounded-[5px] text-[13px] font-medium tabular-nums transition-colors",
                  // A square for a count, wider for an amount (0122).
                  counted ? "w-8" : "min-w-8 px-2",
                  count === value
                    ? value < line.quantity
                      ? "bg-surface text-warning-ink shadow-xs"
                      : "bg-surface text-ink shadow-xs"
                    : "text-ink-3 hover:text-ink",
                )}
              >
                {/* Zero is none of it, whatever the unit. */}
                {value === 0 ? 0 : unitLabel(line, value)}
              </button>
            ))}
          </div>
          <span className="text-[12.5px] text-ink-3">
            {t("amend.ordered", { count: unitLabel(line, line.quantity) })}
          </span>
        </div>

        {short && (
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <span className="shrink-0 text-[13px] font-medium text-ink-2">
              {t("amend.instead")}
            </span>
            {/* No swap is the empty value: the placeholder, and what the
                clear button goes back to. */}
            <Select
              aria-label={t("amend.instead")}
              className="min-w-0 flex-1"
              value={swap ?? ""}
              disabled={menu.isPending}
              isClearable
              placeholder={
                menu.isPending ? t("common.loading") : t("amend.nothing")
              }
              onChange={(id) => {
                const dish = dishes.find((one) => one.value === id);
                onSwap(dish ? { id: dish.value, name: dish.label } : null);
              }}
              options={dishes}
            />
          </div>
        )}
      </div>

      {/* The chosen dish's own questions. They matter for money as well as the
          kitchen: an option carries a price, so a substitute recorded without
          its extras is a total the customer never agreed to. Every group is
          shown, required or not — the operator is reading them out. */}
      {swap &&
        (groups.data ?? [])
          .filter((group) => group.isActive)
          .map((group) => (
            <div key={group.id} className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink">
                {pickLocalized(group.title)}
                {group.minSelections > 0 && (
                  <span className="ps-2 text-[12px] font-normal text-ink-3">
                    {t("amend.optionRequired")}
                  </span>
                )}
              </span>
              <div className="flex flex-wrap gap-1.5">
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
                          // `single` replaces the group's other choice;
                          // `multi` toggles — the database's own rule.
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
                          "h-7 rounded-full border px-3 text-[12.5px] transition-colors",
                          on
                            ? "border-accent bg-accent-soft font-medium text-accent-ink"
                            : "border-line-strong bg-surface text-ink-2 hover:bg-hover",
                        )}
                      >
                        {/* No price on the chip: the catalogue's figure is the
                            brand's, not this branch's nor in the order's money
                            — QA-012 in small. The total moves instead. */}
                        {pickLocalized(option.name)}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
    </div>
  );
}
