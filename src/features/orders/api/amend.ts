import { getClient } from "@/lib/supabase/client";

/**
 * Changing an order that has already been placed.
 *
 * Something is out of stock, or there are two left and three were ordered, or
 * the shop offers something else instead. Before migration `0082` the only
 * thing the dashboard could do about that was cancel — which is the one outcome
 * nobody wanted, and which the operator would then have to explain.
 *
 * ## Nothing here decides anything
 *
 * The whole change goes to `api_v1_amend_order` as one payload, and Postgres
 * recomputes the totals. That is not squeamishness about arithmetic: an
 * amendment is a removal *and* an insertion *and* three sums, and a client that
 * did any of it would be a second place where an order's total is decided —
 * which is how a receipt and a bill end up disagreeing about the same order.
 *
 * The delivery fee and the discount deliberately do not move. The reasoning is
 * on the migration, and it belongs there because it is a rule about money
 * rather than about a screen: the van still drives, and a promotion the
 * customer earned is not taken back because the kitchen ran out.
 */

/** Why a line differs from what was ordered. */
export type AmendmentReason =
  /** None left; the line is not coming at all. */
  | "out_of_stock"
  /** Some left, fewer than were asked for. */
  | "short"
  /** Swapped out; a substitute line points back at this one. */
  | "replaced"
  /** The line that arrived instead. */
  | "substitute";

export type LineChange = {
  lineId: string;
  /** How many are actually coming. `0` is "none of them". */
  fulfilledQuantity: number;
  reason: Exclude<AmendmentReason, "replaced" | "substitute">;
};

export type Substitution = {
  /** The line that is not coming. */
  replacesLineId: string;
  /** What is coming instead, priced at today's menu price. */
  menuItemId: string;
  quantity: number;
};

export type AmendedTotals = {
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
};

export async function amendOrder(input: {
  orderId: string;
  changes: LineChange[];
  substitutions: Substitution[];
  note: string;
}): Promise<AmendedTotals> {
  const { data, error } = await getClient()
    .rpc("api_v1_amend_order", {
      p_order_id: input.orderId,
      p_changes: {
        lines: input.changes.map((change) => ({
          line_id: change.lineId,
          fulfilled_quantity: change.fulfilledQuantity,
          reason: change.reason,
        })),
        substitutes: input.substitutions.map((swap) => ({
          replaces_line_id: swap.replacesLineId,
          menu_item_id: swap.menuItemId,
          quantity: swap.quantity,
        })),
      },
      p_note: input.note,
    })
    .single();

  if (error) throw new Error(error.message);

  const row = data as Record<string, unknown>;
  return {
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    discount: Number(row.discount),
    total: Number(row.total),
  };
}

export type Amendment = {
  id: string;
  note: string | null;
  previousTotal: number;
  newTotal: number;
  createdAt: string;
};

/**
 * What has already been changed on this order, newest first.
 *
 * Read separately from the order rather than embedded in it, because the queue
 * fetches hundreds of orders and almost none of them have one. A join that is
 * empty for 99% of rows is a column of nulls carried down the wire all day.
 */
export async function fetchAmendments(orderId: string): Promise<Amendment[]> {
  const { data, error } = await getClient()
    .from("order_amendments")
    .select("id, note, previous_total, new_total, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not read the changes: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    note: row.note as string | null,
    previousTotal: Number(row.previous_total),
    newTotal: Number(row.new_total),
    createdAt: row.created_at as string,
  }));
}
