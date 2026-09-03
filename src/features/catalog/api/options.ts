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
 * ## A question is offered on the items its links name
 *
 * `0074` gave every group one owner. `0094` reversed that, and its own note
 * says why: a size question is genuinely identical across twenty pizzas, and
 * one owner per group made that twenty questions to type and twenty edits to
 * reprice, with no way to confirm all twenty landed.
 *
 * There is still only **one kind** of group, which was `0074`'s other and
 * better objection — `0073` had two, and every screen had to explain which it
 * was showing. Where a question is offered is said by
 * `menu_item_option_group_links` and by nothing else: one link is a question on
 * one dish, twenty links is a common question.
 *
 * So there is no `menu_item_id`. Keeping one beside the links would be the same
 * fact in two places with the reader left to choose, which is what `0074` said
 * about the link table and was right about.
 *
 * ## Position is per link
 *
 * Where a question sits is a fact about *this dish*, so `sort_order` on the
 * link is what the screens read. The group's own `sort_order` is only the
 * default a new link copies.
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
  /** Where it sits on the item it was read for — from the link, not the group. */
  sortOrder: number;
  /** How many items ask it. One is a private question; more is a common one. */
  itemCount: number;
  options: ItemOption[];
};

const GROUP_COLUMNS = `id, title, mode, min_selections, max_selections,
   is_active, sort_order,
   menu_item_option_group_links ( count ),
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
  // Off the links, which is now the only place that says where a question is
  // offered. A common question counts once for each item asking it, which is
  // what the marker is about: whether *this dish* has anything set up.
  const { data, error } = await getClient()
    .from("menu_item_option_group_links")
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
 * The app filters to what is offered. This read does not, because it feeds two
 * screens: the Options tab, which lists what a dish still asks, and the Archive
 * tab, which lists what it stopped asking and puts it back.
 *
 * The Options screen filters to `is_active` itself. It used to show withdrawn
 * rows greyed out, on the reasoning that one which vanished could never be
 * brought back — true until the archive existed, and wrong now: it put the same
 * row in two places, one of which is a list whose whole job is to say what this
 * dish asks.
 *
 * The filter is deliberately **not** in this query. An `is_active` clause here
 * would make that screen right and leave the archive empty.
 */
export async function fetchItemOptionGroups(
  itemId: string,
): Promise<OptionGroup[]> {
  // From the links, so the order is this dish's own: `sort_order` on the link
  // is where the question sits *here*, and a common question is second on one
  // dish and fifth on another.
  const { data, error } = await getClient()
    .from("menu_item_option_group_links")
    .select(`sort_order, option_groups!inner ( ${GROUP_COLUMNS} )`)
    .eq("menu_item_id", itemId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not read the options: ${error.message}`);

  return (data ?? []).flatMap((link) => {
    const group = one(link.option_groups);
    if (!group) return [];
    // The link's position wins over the group's, which is only the default a
    // new link copies.
    return [toGroup({ ...group, sort_order: link.sort_order })];
  });
}

export type OptionGroupDraft = {
  storeId: string;
  /** The items it is asked on. One is a private question; more is a common one. */
  itemIds: string[];
  title: Localized;
  mode: OptionGroupMode;
  minSelections: number;
  maxSelections: number | null;
};

/**
 * Creates a question and offers it on the items named.
 *
 * Two writes, and they cannot be one: the links reference a group that does not
 * exist until the insert returns. The group goes first, so a failure to link
 * leaves a question nothing asks — visible on the Common questions tab as
 * "on 0 items" and fixable there — rather than links pointing at nothing.
 */
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
      // The default a new link copies — see `0094`. Where it actually sits is
      // the link's own `sort_order`.
      sort_order: sortOrder,
      // No `slug`: the trigger from migration 0071 derives it from the English
      // title and makes it unique within the shop.
    })
    .select("id")
    .single();

  if (error) throw new Error(friendly(error.message));

  const id = data.id as string;
  if (draft.itemIds.length > 0) await offerGroupOn(id, draft.itemIds, sortOrder);
  return id;
}

/**
 * Offers an existing question on more items.
 *
 * One insert for all of them, and `on conflict` is left to the unique index:
 * offering a question on an item that already asks it is not an error worth
 * raising, so the caller filters first and the index is the backstop.
 *
 * `sortOrder` is where it lands on each — the same position on every item,
 * because the alternative is asking the operator to place it twenty times.
 */
export async function offerGroupOn(
  groupId: string,
  itemIds: string[],
  sortOrder: number,
): Promise<void> {
  if (itemIds.length === 0) return;

  const { error } = await getClient()
    .from("menu_item_option_group_links")
    .upsert(
      itemIds.map((itemId) => ({
        option_group_id: groupId,
        menu_item_id: itemId,
        sort_order: sortOrder,
      })),
      { onConflict: "menu_item_id,option_group_id", ignoreDuplicates: true },
    );

  if (error) throw new Error(friendly(error.message));
}

/**
 * Stops offering a question on some items.
 *
 * **Not the same as withdrawing it.** `is_active` takes a question off every
 * item at once and is how it leaves the menu; this takes it off *these* items
 * and leaves it asked everywhere else. A common question that turned out to be
 * wrong for two dishes out of twenty is exactly this, and doing it by
 * withdrawing would take it off the other eighteen.
 *
 * Deleting the link is safe where deleting the group is not: nothing references
 * a link. Order history points at `item_options`, which is untouched.
 */
export async function stopOfferingGroupOn(
  groupId: string,
  itemIds: string[],
): Promise<void> {
  if (itemIds.length === 0) return;

  const { error } = await getClient()
    .from("menu_item_option_group_links")
    .delete()
    .eq("option_group_id", groupId)
    .in("menu_item_id", itemIds);

  if (error) throw new Error(friendly(error.message));
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

/**
 * Adds several choices at once.
 *
 * **One insert, not a loop.** A loop of six inserts is six round trips and six
 * chances to stop halfway — and a half-inserted list is the worst outcome
 * available here, because the operator cannot re-paste it without duplicating
 * whatever landed. A single statement either writes every row or writes none.
 *
 * `sortOrder` is the position the first one takes; the rest follow it, in the
 * order they were typed. That is what makes a pasted list keep its order, which
 * for sizes is the difference between small-medium-large and an alphabetical
 * accident.
 */
export async function createItemOptions(
  groupId: string,
  choices: { name: Localized; price: number }[],
  sortOrder: number,
): Promise<void> {
  if (choices.length === 0) return;

  const { error } = await getClient()
    .from("item_options")
    .insert(
      choices.map((choice, index) => ({
        option_group_id: groupId,
        name: choice.name,
        price: choice.price,
        sort_order: sortOrder + index,
      })),
    );

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
    // PostgREST returns an aggregate embed as `[{ count: n }]`. Zero when a
    // question is asked nowhere — which is a real state, not a bug: a group
    // whose links were all removed is still a question, still editable, and
    // still says so on the Common questions tab.
    itemCount: (asArray(row.menu_item_option_group_links)[0]?.count as number) ?? 0,
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

/**
 * PostgREST hands a to-one embed back as an object, and sometimes as an array
 * of one, depending on how it read the relationship. Both mean the same here.
 */
function one(value: unknown): Record<string, unknown> | undefined {
  return asArray(value)[0];
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object")
    return [value as Record<string, unknown>];
  return [];
}

// ---------------------------------------------------------------------------
// Questions across a whole shop
// ---------------------------------------------------------------------------

/**
 * Every question a shop has, with the items it is asked on.
 *
 * ## Why this read exists next to `fetchItemOptionGroups`
 *
 * That one answers "what does this dish ask", which is the Options tab's
 * question and is per item. This answers "what does this shop ask, and where" —
 * which only became a question worth asking when `0094` let a group be offered
 * on many items. Before it, the two reads would have returned the same rows
 * with the same shape and one of them would have been deleted.
 *
 * It returns the item **ids**, not their names. The names live on the menu,
 * which the picker already has loaded to draw its sections — holding a second
 * copy here would mean a question showing the name an item had when this query
 * last ran.
 *
 * Withdrawn questions come back too. A common question withdrawn from the whole
 * shop still has to be findable, and the Archive tab is where it is brought
 * back; this screen marks it rather than hiding it, because "why is Choose a
 * size not on anything" needs an answer on the page that would otherwise be
 * silent about it.
 */
export type StoreQuestion = {
  id: string;
  title: Localized;
  mode: OptionGroupMode;
  minSelections: number;
  maxSelections: number | null;
  isActive: boolean;
  /**
   * Its answers, withdrawn ones included.
   *
   * The whole point of a common question is that its *choices* are common too —
   * "Small, Medium, Large at +0/+1.50/+3" is the thing being shared, and a
   * screen that showed only the title would be asking somebody to trust that
   * twenty items got the right three prices. Withdrawn ones come back marked,
   * for the reason `fetchItemOptionGroups` gives: this read also has to be able
   * to show what stopped being offered.
   */
  choices: ItemOption[];
  /** The items asking it. Empty is a real state: a question offered nowhere. */
  itemIds: string[];
};

export async function fetchStoreQuestions(
  storeId: string,
): Promise<StoreQuestion[]> {
  const { data, error } = await getClient()
    .from("option_groups")
    .select(
      `id, title, mode, min_selections, max_selections, is_active, sort_order,
       menu_item_option_group_links ( menu_item_id ),
       item_options ( id, name, price, is_active, is_default, sort_order )`,
    )
    .eq("store_id", storeId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not read the questions: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as Localized) ?? {},
    mode: row.mode as OptionGroupMode,
    minSelections: (row.min_selections as number) ?? 0,
    maxSelections: (row.max_selections as number | null) ?? null,
    isActive: row.is_active as boolean,
    choices: asArray(row.item_options)
      .map((option) => ({
        id: option.id as string,
        name: (option.name as Localized) ?? {},
        price: option.price as number,
        isActive: option.is_active as boolean,
        isDefault: option.is_default as boolean,
        sortOrder: option.sort_order as number,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    itemIds: asArray(row.menu_item_option_group_links).map(
      (link) => link.menu_item_id as string,
    ),
  }));
}

/**
 * Sets exactly which items ask a question.
 *
 * The caller hands the whole list it wants, not a pair of add/remove lists, and
 * the diff is worked out here. That is the difference between a picker whose
 * Save means "this is the answer" and one whose Save means "apply these
 * changes" — the second is what leaves an operator wondering whether unticking
 * a box did anything.
 *
 * Removals go first. Two links for a moment is a question asked twice on one
 * dish, which nothing in the schema forbids and the sheet would render twice;
 * none for a moment is a dish that briefly stops asking, which is the same
 * thing the operator is deliberately doing to some of them anyway.
 */
export async function setQuestionItems(
  groupId: string,
  itemIds: string[],
  current: string[],
  sortOrder: number,
): Promise<void> {
  const wanted = new Set(itemIds);
  const had = new Set(current);

  await stopOfferingGroupOn(
    groupId,
    current.filter((id) => !wanted.has(id)),
  );
  await offerGroupOn(
    groupId,
    itemIds.filter((id) => !had.has(id)),
    sortOrder,
  );
}
