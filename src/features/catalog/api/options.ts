import { getClient } from "@/lib/supabase/client";
import type { Localized } from "@/lib/validation";

/**
 * Option groups: the choices attached to a dish.
 *
 * A group is a question — *what size?*, *anything extra?* — and its options are
 * the answers. `mode` says whether one answer is allowed or several, and
 * `is_required` whether the customer may skip it.
 *
 * ## Groups belong to the shop, not to the item
 *
 * "Add extras" is one group offered on twenty dishes, and editing it once is
 * the entire point of it being a row rather than a repeated list.
 * `menu_item_option_group_links` is what attaches it, and the dashboard's job
 * is mostly to manage that attachment rather than to make more groups.
 *
 * This is also why removing a group from an item is a **detach**, not a delete:
 * the operator means "not on this dish", and deleting the group would take it
 * off the other nineteen.
 *
 * ## Retiring, never deleting
 *
 * `order_line_options` references `item_options(id)` with no delete rule, so
 * the database refuses to delete an option that has ever been ordered — and the
 * receipt reads those rows live to name what somebody chose. Migration 0073
 * gave both tables a `deleted_at` for this reason. Nothing here hard-deletes.
 */

export type ItemOption = {
  id: string;
  name: Localized;
  /** Minor units, added to the item's price. Zero for a free choice. */
  price: number;
  sortOrder: number;
};

export type OptionGroupKind = "size" | "extra" | "removal" | "preparation";
export type OptionGroupMode = "single" | "multi";

export type OptionGroup = {
  id: string;
  title: Localized;
  kind: OptionGroupKind;
  mode: OptionGroupMode;
  isRequired: boolean;
  /** Only meaningful when `mode` is `multi`. Null means no ceiling. */
  maxSelections: number | null;
  sortOrder: number;
  options: ItemOption[];
};

/** Every live group in a shop, with its options. */
export async function fetchOptionGroups(
  storeId: string,
): Promise<OptionGroup[]> {
  const { data, error } = await getClient()
    .from("option_groups")
    .select(
      `id, title, kind, mode, is_required, max_selections, sort_order,
       item_options ( id, name, price, sort_order, deleted_at )`,
    )
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not read the options: ${error.message}`);

  return (data ?? []).map(toGroup);
}

/** The ids of the groups attached to one item. */
export async function fetchItemGroupIds(itemId: string): Promise<string[]> {
  const { data, error } = await getClient()
    .from("menu_item_option_group_links")
    .select("option_group_id")
    .eq("menu_item_id", itemId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.option_group_id as string);
}

/**
 * Attaches or detaches one group.
 *
 * One link at a time rather than a whole set, because that is how the operator
 * acts on it — a switch per group — and because a set-shaped write would have
 * to delete and re-insert links that were not touched, which for a table with
 * a unique constraint is a way to fail on the rows that were already right.
 *
 * `(menu_item_id, option_group_id)` is unique, so attaching twice is a conflict
 * rather than a duplicate; `ignoreDuplicates` makes a second attach the no-op
 * it should be, which matters when two tabs are open on the same dish.
 */
export async function setItemGroup(
  itemId: string,
  groupId: string,
  attached: boolean,
): Promise<void> {
  const client = getClient();

  if (attached) {
    const { error } = await client
      .from("menu_item_option_group_links")
      .upsert(
        { menu_item_id: itemId, option_group_id: groupId },
        { onConflict: "menu_item_id,option_group_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client
    .from("menu_item_option_group_links")
    .delete()
    .eq("menu_item_id", itemId)
    .eq("option_group_id", groupId);

  if (error) throw new Error(error.message);
}

export type OptionGroupDraft = {
  storeId: string;
  title: Localized;
  kind: OptionGroupKind;
  mode: OptionGroupMode;
  isRequired: boolean;
  maxSelections: number | null;
};

export async function createOptionGroup(
  draft: OptionGroupDraft,
  sortOrder: number,
): Promise<string> {
  const { data, error } = await getClient()
    .from("option_groups")
    .insert({
      store_id: draft.storeId,
      title: draft.title,
      kind: draft.kind,
      mode: draft.mode,
      is_required: draft.isRequired,
      // Meaningless on a single-choice group, and storing a number there would
      // be a fact nothing reads and everything has to ignore.
      max_selections: draft.mode === "multi" ? draft.maxSelections : null,
      sort_order: sortOrder,
      // No `slug`: the trigger from migration 0071 derives it from the English
      // title and makes it unique within the shop.
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateOptionGroup(
  id: string,
  patch: Partial<Omit<OptionGroupDraft, "storeId">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.mode !== undefined) {
    row.mode = patch.mode;
    // Cleared when a group stops taking several answers, so a ceiling cannot
    // linger on a question that now accepts exactly one.
    if (patch.mode === "single") row.max_selections = null;
  }
  if (patch.isRequired !== undefined) row.is_required = patch.isRequired;
  if (patch.maxSelections !== undefined && patch.mode !== "single") {
    row.max_selections = patch.maxSelections;
  }

  const { error } = await getClient()
    .from("option_groups")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Retires a group. Its links stay, and stop resolving to anything live. */
export async function archiveOptionGroup(id: string): Promise<void> {
  const { error } = await getClient()
    .from("option_groups")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createItemOption(
  groupId: string,
  name: Localized,
  price: number,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient().from("item_options").insert({
    option_group_id: groupId,
    name,
    price,
    sort_order: sortOrder,
  });
  if (error) throw new Error(error.message);
}

export async function updateItemOption(
  id: string,
  patch: { name?: Localized; price?: number; sortOrder?: number },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { error } = await getClient()
    .from("item_options")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function archiveItemOption(id: string): Promise<void> {
  const { error } = await getClient()
    .from("item_options")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

function toGroup(row: Record<string, unknown>): OptionGroup {
  return {
    id: row.id as string,
    title: (row.title as Localized) ?? {},
    kind: row.kind as OptionGroupKind,
    mode: row.mode as OptionGroupMode,
    isRequired: row.is_required as boolean,
    maxSelections: (row.max_selections as number | null) ?? null,
    sortOrder: row.sort_order as number,
    options: asArray(row.item_options)
      // Filtered here rather than in the query: a `deleted_at` filter on an
      // embedded table removes the *child*, so PostgREST would return a group
      // with its retired options missing and no way to tell that from a group
      // with none.
      .filter((option) => option.deleted_at === null)
      .map((option) => ({
        id: option.id as string,
        name: (option.name as Localized) ?? {},
        price: option.price as number,
        sortOrder: option.sort_order as number,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object")
    return [value as Record<string, unknown>];
  return [];
}
