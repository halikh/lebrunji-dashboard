"use client";

import { cx } from "@/components/ui";

import { useMoney } from "./use-currencies";

/**
 * An amount, said in both currencies.
 *
 * The shop prices in one currency and the customer may pay attention to the
 * other, so a figure on its own is only half an answer — the operator reading a
 * total back over the phone needs the one the customer is thinking in.
 *
 * ## Why the second line is quieter, and why it is second
 *
 * The first line is the amount **as it was set and recorded**. The second is
 * derived from a rate that moves, so it is display only: an order is recorded
 * in what it was priced and paid in, and a stored amount that drifted with the
 * rate would be a receipt that rewrites itself. Weight says which is which
 * without a label having to.
 *
 * ## Why it is one component
 *
 * The conversion was written twice before this — once for an order total, once
 * about to be written again for a menu row — and the second copy is where a
 * rounding rule or a missing-rate case starts to differ from the first. This is
 * the only place either decision is made.
 *
 * The secondary is **absent rather than approximate**: `convertTo` returns null
 * when a rate is missing or not yet loaded, and a converted figure that quietly
 * used a rate of 1 would be a number somebody might read out to a customer.
 */
export function Price({
  value,
  code,
  align = "start",
  className,
}: {
  /** Minor units, in `code`. */
  value: number;
  code: string;
  /** `end` in a column of figures, where the units digits should line up. */
  align?: "start" | "end";
  /** Type for the primary line. The secondary keeps its own, deliberately. */
  className?: string;
}) {
  const { format, convertTo, secondaryCode } = useMoney();

  const other = secondaryCode(code);
  const converted = other ? convertTo(value, code, other) : null;

  return (
    <span
      className={cx(
        "flex flex-col",
        align === "end" ? "items-end" : "items-start",
      )}
    >
      <span className={cx("tabular-nums", className)}>
        {format(value, code)}
      </span>
      {converted && (
        <span className="text-[12px] font-normal text-text-faint tabular-nums">
          {converted}
        </span>
      )}
    </span>
  );
}
