import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
import { digitsOf } from "@/lib/phone";
import type { Localized } from "@/lib/validation";

/**
 * Branches — the places a shop trades from.
 *
 * ## What lives here rather than on the store
 *
 * The store is the brand: its name, its picture, its category, its currency,
 * and its whole menu. A branch is a *place*, and it owns exactly the things
 * that are true of a place and not of a brand — where it is, how long its
 * kitchen takes, which number its orders go to, when it opens, and whether it
 * is trading at all.
 *
 * The test, if a new field ever has to be sorted: would changing it at one
 * address be wrong at another? A price is (see `branch_item_prices`); a picture
 * of the logo is not.
 *
 * ## Every store has at least one
 *
 * Migration `0101` gave every existing shop a branch called after itself,
 * holding the pin and the phone and the hours that shop already had. So there
 * is no "shop with no branches" state to design around: the list is never
 * empty, and a shop that has never been thought about as a chain simply has one
 * row in it.
 *
 * As elsewhere, the shapes here are the dashboard's rather than the database's
 * — column names stay in this file, so a rename is one edit.
 */

export type Branch = {
  id: string;
  storeId: string;
  slug: string;
  /** "Hamra", "Jounieh" — the place, not the brand. The brand is on the store. */
  name: Localized;
  /**
   * Where this branch is.
   *
   * Null until somebody drops the pin, and that is not cosmetic: with no pin
   * `delivery_quote_for_branch` cannot work out a distance, and
   * `delivery_fee_for_km` charges an unknown distance at the **top band**. An
   * unpinned branch silently overcharges every customer it serves.
   */
  latitude: number | null;
  longitude: number | null;
  prepMinMinutes: number;
  prepMaxMinutes: number;
  /** Where an order reaches this kitchen — digits, no `+`, as `wa.me` wants. */
  whatsappPhone: string | null;
  isActive: boolean;
  sortOrder: number;
};

const COLUMNS = `id, store_id, slug, name, latitude, longitude,
  prep_min_minutes, prep_max_minutes, whatsapp_phone, is_active, sort_order`;

function toBranch(row: Record<string, unknown>): Branch {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    slug: row.slug as string,
    name: (row.name as Localized) ?? {},
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    prepMinMinutes: row.prep_min_minutes as number,
    prepMaxMinutes: row.prep_max_minutes as number,
    whatsappPhone: (row.whatsapp_phone as string | null) ?? null,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
  };
}

/**
 * Every branch of one shop, in the order they were arranged.
 *
 * Archived ones are left out. A branch that has closed keeps its rows — the
 * orders it took still point at it, and an order whose branch had vanished
 * would be an order from nowhere.
 */
export async function fetchBranches(storeId: string): Promise<Branch[]> {
  const { data, error } = await getClient()
    .from("branches")
    .select(COLUMNS)
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not read the branches: ${error.message}`);
  return (data ?? []).map((row) => toBranch(row as Record<string, unknown>));
}

export type BranchDraft = {
  name: Localized;
  latitude: number | null;
  longitude: number | null;
  prepMinMinutes: number;
  prepMaxMinutes: number;
  whatsappPhone: string | null;
  isActive: boolean;
};

export async function createBranch(
  storeId: string,
  draft: BranchDraft,
  sortOrder: number,
): Promise<string> {
  const { data, error } = await getClient()
    .from("branches")
    .insert({
      store_id: storeId,
      name: draft.name,
      // Both or neither — half a pin passes every column check and means
      // nothing. `branches_pin_whole` refuses it; this keeps the refusal from
      // being the first anybody hears of it.
      latitude: draft.latitude,
      longitude: draft.longitude,
      prep_min_minutes: draft.prepMinMinutes,
      prep_max_minutes: draft.prepMaxMinutes,
      whatsapp_phone: draft.whatsappPhone
        ? digitsOf(draft.whatsappPhone)
        : null,
      is_active: draft.isActive,
      sort_order: sortOrder,
      // No `slug`: derived from the English name by the same trigger every
      // other catalogue row uses, inside the insert's own transaction — the
      // only way to make it unique without racing another tab.
    })
    .select("id")
    .single();

  if (error) throw new Error(friendly(error.message));
  return (data as { id: string }).id;
}

export type BranchPatch = Partial<BranchDraft>;

export async function updateBranch(
  id: string,
  patch: BranchPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.latitude !== undefined) row.latitude = patch.latitude;
  if (patch.longitude !== undefined) row.longitude = patch.longitude;
  if (patch.prepMinMinutes !== undefined)
    row.prep_min_minutes = patch.prepMinMinutes;
  if (patch.prepMaxMinutes !== undefined)
    row.prep_max_minutes = patch.prepMaxMinutes;
  if (patch.whatsappPhone !== undefined) {
    const digits = patch.whatsappPhone ? digitsOf(patch.whatsappPhone) : "";
    row.whatsapp_phone = digits || null;
  }
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  row.updated_at = new Date().toISOString();

  const { error } = await getClient().from("branches").update(row).eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/**
 * Closes a branch.
 *
 * Soft, like everything else here, and for a sharper reason than usual: the
 * orders it took point at it, and `order_stores.branch_id` is what tells the
 * kitchen which address a historical order went to. A hard delete would either
 * be refused by the foreign key or take the history with it.
 *
 * A closed branch stops appearing in the app and stops being orderable. Its
 * price overrides and its hidden-item rows stay, so reopening it is one click
 * rather than setting the whole place up again.
 */
export async function archiveBranch(id: string): Promise<void> {
  const { error } = await getClient()
    .from("branches")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(friendly(error.message));
}

/**
 * The last branch cannot be closed.
 *
 * A store with no branches is a shop with no address: it would still be listed,
 * still have a menu, and have nowhere for an order to go. Asked here rather
 * than left to a constraint because the answer is a sentence, not an error
 * code — and because the button should be able to say so before it is pressed.
 */
export async function countLiveBranches(storeId: string): Promise<number> {
  const { count, error } = await getClient()
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .is("deleted_at", null);

  if (error) throw new Error(`Could not count the branches: ${error.message}`);
  return count ?? 0;
}

function friendly(message: string): string {
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  if (message.includes("_locales")) return t("dbError.missingLanguage");
  if (message.includes("_len")) return t("dbError.tooLong");
  if (message.includes("prep")) return t("store.prepBackwards");
  if (message.includes("whatsapp")) return t("validation.phone");
  if (message.includes("pin_whole")) return t("branches.pinHalf");
  return message;
}
