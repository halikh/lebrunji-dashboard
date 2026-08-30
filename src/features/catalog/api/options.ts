import { t } from "@/i18n/translations";
import { getClient } from "@/lib/supabase/client";
import type { Localized } from "@/lib/validation";

/**
 * Option groups: the choices attached to a dish.
 *
 * A group is a question — *what size?*, *anything extra?* — and its options are
 * the answers.
 *
 * ## The shape is migration 0019's, not 0001's
 *
 * Worth saying because the first version of this file was written against the
 * original table and did not survive contact with the database. `0019` reshaped
 * it around what a merchant can actually author:
 *
 * - **`kind` is gone.** It was a four-value enum nothing ever read, and it made
 *   "Choose a sauce" impossible to insert — a `not null` enum constraining every
 *   future row to answer a question nobody asks.
 * - **`is_required` became `min_selections`.** A boolean says "at least one" and
 *   nothing else; a number says *choose exactly two*, which is the common case
 *   the boolean could not express. `0` is optional, `1` is what the boolean
 *   meant.
 * - **`is_active` is how a row is withdrawn.** `order_line_options` references
 *   `item_options(id)` with no delete rule, so an option that has been ordered
 *   once can never be deleted. The row stays, the history stays readable, and
 *   the option stops being offered. There is no `deleted_at` here and there
 *   should not be — two ways to say "gone" is two places to check.
 * - **`is_default`** says which answer a required group opens on. Before it,
 *   the app took whichever sorted first, which is a guess dressed as a decision.
 *
 * ## Every group belongs to exactly one dish
 *
 * There was briefly a second kind — a shop-wide group offered on many items —
 * and migration `0074` removed it. Sharing a group sounds like a saving and is
 * not, because what merchants share is the *shape* of a question, never its
 * answers: "Add extras" on a grill and "Add extras" on a dessert have the same
 * name and nothing else in common. A shared group is either edited into
 * something wrong for half the dishes offering it, or split by hand until it is
 * per-item anyway — while every screen has to explain which kind it is showing.
 *
 * So `menu_item_id` is `not null`, and the join table is gone: one-to-many
 * needs none, and keeping it would store the same fact twice for a reader to
 * choose between.
 */

export type ItemOption = {
  id: string;
  name: Localized;
  /** Minor units, added to the item's price. Zero for a free choice. */
  price: number;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
};

export type OptionGroupMode = "single" | "multi";

export type OptionGroup = {
  id: string;
  title: Localized;
  mode: OptionGroupMode;
  /** 0 means the customer may skip it. 1 is "required". Higher is a floor. */
  minSelections: number;
  /** Null means no ceiling. Never below `minSelections` — the CHECK refuses. */
  maxSelections: number | null;
  isActive: boolean;
  sortOrder: number;
  /** The dish this question is asked about. Never null. */
  itemId: string;
  options: ItemOption[];
};

const GROUP_COLUMNS = `id, title, mode, min_selections, max_selections,
   is_active, sort_order, menu_item_id,
   item_options ( id, name, price, is_active, is_default, sort_order )`;

/**
 * Which dishes in a shop have questions, and how many.
 *
 * One aggregate rather than a group list per item: the options screen needs to
 * mark every dish in a section that has nothing set up, and asking per row would
 * be a request per dish to answer a question about all of them.
 */
export async function fetchOptionCounts(
  storeId: string,
): Promise<Map<string, number>> {
  const { data, error } = await getClient()
    .from("option_groups")
    .select("menu_item_id, menu_items!inner(store_id)")
    .eq("menu_items.store_id", storeId);

  if (error) throw new Error(`Could not read the options: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.menu_item_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * One dish's groups, with their options — **including withdrawn ones**.
 *
 * The app filters to what is offered; this is the screen that *decides* what is
 * offered, so it has to show the rest. A withdrawn option that vanished from
 * here could never be brought back, and "where did the large size go" would
 * have no answer on the page that took it away.
 */
export async function fetchItemOptionGroups(
  itemId: string,
): Promise<OptionGroup[]> {
  const { data, error } = await getClient()
    .from("option_groups")
    .select(GROUP_COLUMNS)
    .eq("menu_item_id", itemId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not read the options: ${error.message}`);

  return (data ?? []).map(toGroup);
}

export type OptionGroupDraft = {
  storeId: string;
  /** The dish it is asked about. Required — there is no other kind. */
  itemId: string;
  title: Localized;
  mode: OptionGroupMode;
  minSelections: number;
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
      mode: draft.mode,
      min_selections: draft.minSelections,
      // Meaningless on a single-choice group — the mode already says one — and
      // a number there would be a fact nothing reads and everything ignores.
      max_selections: draft.mode === "multi" ? draft.maxSelections : null,
      sort_order: sortOrder,
      menu_item_id: draft.itemId,
      // No `slug`: the trigger from migration 0071 derives it from the English
      // title and makes it unique within the shop.
    })
    .select("id")
    .single();

  if (error) throw new Error(friendly(error.message));
  return data.id as string;
}

export type OptionGroupPatch = Partial<Omit<OptionGroupDraft, "storeId">> & {
  isActive?: boolean;
};

export async function updateOptionGroup(
  id: string,
  patch: OptionGroupPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.minSelections !== undefined) {
    row.min_selections = patch.minSelections;
  }
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.mode !== undefined) {
    row.mode = patch.mode;
    // Cleared when a group stops taking several answers, so a ceiling cannot
    // linger on a question that now accepts exactly one.
    if (patch.mode === "single") row.max_selections = null;
  }
  if (patch.maxSelections !== undefined && patch.mode !== "single") {
    row.max_selections = patch.maxSelections;
  }

  const { error } = await getClient()
    .from("option_groups")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
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
  if (error) throw new Error(friendly(error.message));
}

export type ItemOptionPatch = {
  name?: Localized;
  price?: number;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
};

export async function updateItemOption(
  id: string,
  patch: ItemOptionPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { error } = await getClient()
    .from("item_options")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/**
 * Makes one option the group's default, and no others.
 *
 * Two writes, because "the default" is a property of the group expressed on its
 * rows, and nothing in the schema enforces that only one carries it. The clear
 * goes first: two defaults for a moment is a menu that opens on the wrong
 * choice, while none for a moment is a menu that opens on nothing — and the
 * app's own fallback covers the second.
 */
export async function setDefaultOption(
  groupId: string,
  optionId: string,
): Promise<void> {
  const client = getClient();

  const { error: cleared } = await client
    .from("item_options")
    .update({ is_default: false })
    .eq("option_group_id", groupId)
    .neq("id", optionId);
  if (cleared) throw new Error(cleared.message);

  const { error } = await client
    .from("item_options")
    .update({ is_default: true })
    .eq("id", optionId);
  if (error) throw new Error(error.message);
}

/**
 * Turns a constraint violation into a sentence the operator can act on.
 *
 * `option_groups_selection_range` is the one they will meet: a floor above the
 * ceiling is unsatisfiable, and the database says so in terms of a constraint
 * name rather than in terms of the two boxes on screen.
 */
function friendly(message: string): string {
  if (message.includes("selection_range")) return t("options.rangeImpossible");
  if (message.includes("_locales")) return t("dbError.missingLanguage");
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  return message;
}

function toGroup(row: Record<string, unknown>): OptionGroup {
  return {
    id: row.id as string,
    title: (row.title as Localized) ?? {},
    mode: row.mode as OptionGroupMode,
    minSelections: (row.min_selections as number) ?? 0,
    maxSelections: (row.max_selections as number | null) ?? null,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
    itemId: row.menu_item_id as string,
    options: asArray(row.item_options)
      .map((option) => ({
        id: option.id as string,
        name: (option.name as Localized) ?? {},
        price: option.price as number,
        isActive: option.is_active as boolean,
        isDefault: option.is_default as boolean,
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
