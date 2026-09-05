import { getClient } from "@/lib/supabase/client";

/**
 * What one branch does differently to the menu.
 *
 * ## Exceptions, not state
 *
 * The menu belongs to the store and every branch serves it. These rows record
 * only the places a branch *differs*, which is why both shapes below are sparse
 * and why the usual answer is "nothing here".
 *
 * That is the whole reason the schema is built this way (`0102`): opening a
 * branch writes nothing, adding a dish writes nothing, and a branch that does
 * what the brand does has no rows at all. A table of "visible, 12000" per
 * branch per item would have to be kept in step by triggers on both sides, and
 * its failure mode is the bad one — a new dish unpriced or invisible everywhere
 * until a backfill runs, with nothing on screen saying why.
 *
 * So absence means "the same as the brand", everywhere in this file. A cleared
 * price is a **deleted row**, not a row holding the brand price: storing the
 * brand price as an override would be a copy that stops tracking the original
 * the moment somebody changes it.
 */

export type BranchMenuOverrides = {
  /** Section ids this branch does not serve. */
  hiddenSections: Set<string>;
  /** Item ids this branch does not serve, in its own right. */
  hiddenItems: Set<string>;
  /** Option group ids this branch does not ask about. Takes its choices with it. */
  hiddenGroups: Set<string>;
  /** Individual choices this branch does not offer. */
  hiddenOptions: Set<string>;
  /** Item id → what this branch charges, where it differs. Minor units. */
  itemPrices: Map<string, number>;
  /** Option id → what this branch charges, where it differs. Minor units. */
  optionPrices: Map<string, number>;
};

export async function fetchBranchOverrides(
  branchId: string,
): Promise<BranchMenuOverrides> {
  const client = getClient();

  const [hidden, items, options] = await Promise.all([
    client
      .from("branch_menu_hidden")
      .select("menu_section_id, menu_item_id, option_group_id, item_option_id")
      .eq("branch_id", branchId),
    client
      .from("branch_item_prices")
      .select("menu_item_id, price")
      .eq("branch_id", branchId),
    client
      .from("branch_option_prices")
      .select("item_option_id, price")
      .eq("branch_id", branchId),
  ]);

  const failure = [hidden, items, options].find((one) => one.error);
  if (failure?.error) {
    throw new Error(
      `Could not read this branch's menu: ${failure.error.message}`,
    );
  }

  // One row carries exactly one of the four — `branch_menu_hidden_one_target`
  // refuses anything else — so this sorts them rather than choosing between
  // them.
  const hiddenSections = new Set<string>();
  const hiddenItems = new Set<string>();
  const hiddenGroups = new Set<string>();
  const hiddenOptions = new Set<string>();
  for (const row of hidden.data ?? []) {
    const section = row.menu_section_id as string | null;
    const item = row.menu_item_id as string | null;
    const group = row.option_group_id as string | null;
    const option = row.item_option_id as string | null;
    if (section) hiddenSections.add(section);
    if (item) hiddenItems.add(item);
    if (group) hiddenGroups.add(group);
    if (option) hiddenOptions.add(option);
  }

  return {
    hiddenSections,
    hiddenItems,
    hiddenGroups,
    hiddenOptions,
    itemPrices: new Map(
      (items.data ?? []).map((row) => [
        row.menu_item_id as string,
        row.price as number,
      ]),
    ),
    optionPrices: new Map(
      (options.data ?? []).map((row) => [
        row.item_option_id as string,
        row.price as number,
      ]),
    ),
  };
}

/**
 * Serves it, or does not.
 *
 * Hiding a **section** takes its items with it — `api_v1_branch_menu` checks
 * both columns on the item, so a breakfast menu withdrawn from one place is one
 * row rather than forty, and it stays one row when a dish is added to that
 * section tomorrow.
 */
export async function setSectionHidden(
  branchId: string,
  sectionId: string,
  hidden: boolean,
): Promise<void> {
  const client = getClient();

  const { error } = hidden
    ? await client
        .from("branch_menu_hidden")
        .insert({ branch_id: branchId, menu_section_id: sectionId })
    : await client
        .from("branch_menu_hidden")
        .delete()
        .eq("branch_id", branchId)
        .eq("menu_section_id", sectionId);

  if (error) throw new Error(error.message);
}

export async function setItemHidden(
  branchId: string,
  itemId: string,
  hidden: boolean,
): Promise<void> {
  const client = getClient();

  const { error } = hidden
    ? await client
        .from("branch_menu_hidden")
        .insert({ branch_id: branchId, menu_item_id: itemId })
    : await client
        .from("branch_menu_hidden")
        .delete()
        .eq("branch_id", branchId)
        .eq("menu_item_id", itemId);

  if (error) throw new Error(error.message);
}

/**
 * A question this branch does not ask, or a choice it does not offer.
 *
 * Hiding a **group** takes its choices with it, the same way hiding a section
 * takes its dishes: one row withdraws "Choose a size" and every size under it,
 * and it stays one row when a size is added tomorrow.
 */
export async function setGroupHidden(
  branchId: string,
  groupId: string,
  hidden: boolean,
): Promise<void> {
  const client = getClient();

  const { error } = hidden
    ? await client
        .from("branch_menu_hidden")
        .insert({ branch_id: branchId, option_group_id: groupId })
    : await client
        .from("branch_menu_hidden")
        .delete()
        .eq("branch_id", branchId)
        .eq("option_group_id", groupId);

  if (error) throw new Error(error.message);
}

export async function setOptionHidden(
  branchId: string,
  optionId: string,
  hidden: boolean,
): Promise<void> {
  const client = getClient();

  const { error } = hidden
    ? await client
        .from("branch_menu_hidden")
        .insert({ branch_id: branchId, item_option_id: optionId })
    : await client
        .from("branch_menu_hidden")
        .delete()
        .eq("branch_id", branchId)
        .eq("item_option_id", optionId);

  if (error) throw new Error(error.message);
}

/**
 * What this branch charges, or nothing.
 *
 * `null` **deletes the row** rather than writing the brand price into it. The
 * two look identical the moment they are set and stop being identical the
 * moment the brand price changes: a stored copy would quietly hold last
 * month's number at one branch while every other branch followed the menu.
 *
 * An upsert rather than insert-or-update, because the primary key is the pair
 * and a second edit of the same price is the ordinary case.
 */
export async function setItemPrice(
  branchId: string,
  itemId: string,
  price: number | null,
): Promise<void> {
  const client = getClient();

  const { error } =
    price === null
      ? await client
          .from("branch_item_prices")
          .delete()
          .eq("branch_id", branchId)
          .eq("menu_item_id", itemId)
      : await client.from("branch_item_prices").upsert(
          {
            branch_id: branchId,
            menu_item_id: itemId,
            price,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "branch_id,menu_item_id" },
        );

  if (error) throw new Error(error.message);
}

export async function setOptionPrice(
  branchId: string,
  optionId: string,
  price: number | null,
): Promise<void> {
  const client = getClient();

  const { error } =
    price === null
      ? await client
          .from("branch_option_prices")
          .delete()
          .eq("branch_id", branchId)
          .eq("item_option_id", optionId)
      : await client.from("branch_option_prices").upsert(
          {
            branch_id: branchId,
            item_option_id: optionId,
            price,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "branch_id,item_option_id" },
        );

  if (error) throw new Error(error.message);
}

/**
 * Makes one branch charge what another charges.
 *
 * ## Why the whole thing is one server call
 *
 * A menu is a hundred dishes and their choices. Done from here that is a
 * hundred round trips, each of which can fail on its own — and a half-copied
 * price list is worse than an uncopied one, because it looks finished.
 * `copy_branch_prices` (0107) does it in one statement inside one transaction:
 * it lands whole or not at all.
 *
 * ## What it copies is the *effective* price
 *
 * Where the source branch overrides, the target gets that number. Where the
 * source charges the brand price, the target's override is **removed** rather
 * than set to today's brand price — otherwise the two would agree the moment it
 * ran and drift apart the next time the menu changed, with the target silently
 * holding a stale number.
 *
 * Choices travel with their dish: a branch dearer on the burger is dearer on
 * the extra cheese, and copying half of that is how the difference is found at
 * the till.
 *
 * Scope narrows by section or by item; neither means the whole menu. Returns
 * how many dishes now match, so the screen can say what happened.
 */
export async function copyBranchPrices(input: {
  fromBranchId: string;
  toBranchId: string;
  sectionId?: string | null;
  itemId?: string | null;
}): Promise<number> {
  const { data, error } = await getClient().rpc("copy_branch_prices", {
    p_from_branch: input.fromBranchId,
    p_to_branch: input.toBranchId,
    p_menu_section_id: input.sectionId ?? undefined,
    p_menu_item_id: input.itemId ?? undefined,
  });

  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
