import { getClient } from "@/lib/supabase/client";

/**
 * What has happened to an order since it was placed.
 *
 * Two separate records, and they answer different questions:
 *
 * - **Amendments** (`order_amendments`, migration 0082) — what the operator
 *   changed after ringing the customer, and what the total was either side.
 * - **Hand-overs** (`order_dispatches`, migration 0083) — which driver was
 *   given it, and when. Narrowly: when a chat was *opened* about it. See that
 *   migration on why nothing stronger can be claimed.
 *
 * Read here rather than embedded in the order, because the queue fetches
 * hundreds of orders and almost none of them have either. A join that is empty
 * for 99% of rows is a column of nulls carried down the wire all day.
 *
 * They are deliberately *not* merged into one timeline in this file. The screen
 * interleaves them by time, but a function that returned a union of two shapes
 * would push the discrimination into every caller — and the two are stored
 * apart because they are different facts, not two spellings of one.
 */

export type Amendment = {
  id: string;
  note: string | null;
  previousTotal: number;
  newTotal: number;
  createdAt: string;
};

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

export type Handover = {
  id: string;
  dispatchedAt: string;
  courierId: string;
  courierName: string;
};

/**
 * Who this order was handed to, newest first.
 *
 * More than one row is normal rather than exceptional — a shift ends, a message
 * goes to the wrong person and is re-sent — which is why `0083` is a table and
 * not a column on `orders`. The screen shows them all, because the case where
 * somebody is looking is exactly the case where the *first* one matters.
 */
export async function fetchHandovers(orderId: string): Promise<Handover[]> {
  const { data, error } = await getClient()
    .from("order_dispatches")
    .select("id, dispatched_at, courier_id, couriers ( name )")
    .eq("order_id", orderId)
    .order("dispatched_at", { ascending: false });

  if (error) throw new Error(`Could not read the handovers: ${error.message}`);

  return (data ?? []).map((row) => {
    const courier = Array.isArray(row.couriers)
      ? row.couriers[0]
      : row.couriers;
    return {
      id: row.id as string,
      dispatchedAt: row.dispatched_at as string,
      courierId: row.courier_id as string,
      courierName:
        ((courier as { name?: string } | null)?.name as string) ?? "",
    };
  });
}
