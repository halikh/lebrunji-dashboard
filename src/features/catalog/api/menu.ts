import { getClient } from "@/lib/supabase/client";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { PAGE } from "@/lib/limits";
import { localizedOrNull, type Localized } from "@/lib/validation";

import { setItemTags } from "./tags";

/**
 * A store's menu: sections holding items.
 *
 * ## Why this reads the tables rather than `api_v1_store_menu`
 *
 * The app reads its menu through that function, and should — it is a versioned
 * contract so the tables underneath can move without breaking shipped binaries.
 *
 * This does not, for a reason that is the mirror of it: the function returns
 * the menu **as a customer sees it**. Inactive items are filtered out, text is
 * already resolved to one locale, and there is no `sort_order` to edit. The
 * dashboard needs the opposite — everything, in every language, with the
 * columns a merchant sets. It is the editor of the thing the contract exposes,
 * so it works against the thing itself.
 */

export type MenuItem = {
  id: string;
  sectionId: string;
  slug: string;
  name: Localized;
  description: Localized;
  /** Minor units. Integer, always — see `lib/money.ts`. */
  price: number;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  /**
   * The tags on this dish, as ids into the vocabulary.
   *
   * Ids rather than rows: a tag's name, colour and position are properties of
   * the vocabulary and change on the Tags tab, so holding a copy here would
   * mean a dish showing the name a tag had when the menu was last fetched.
   * `useTagVocabulary` is the one place those are read from.
   */
  tagIds: string[];
};

export type MenuSection = {
  id: string;
  slug: string;
  title: Localized;
  sortOrder: number;
  items: MenuItem[];
};

/**
 * One store's whole menu.
 *
 * Not paginated, and for the same reason the store list is not: it is ordered
 * by `sort_order`, which a merchant sets by dragging, and reordering across a
 * page boundary is not a gesture that exists. A menu is also a bounded thing —
 * a shop with two thousand items has a different problem.
 */
export async function fetchMenu(storeId: string): Promise<MenuSection[]> {
  const { data, error } = await getClient()
    .from("menu_sections")
    .select(
      `id, slug, title, sort_order,
       menu_items ( id, menu_section_id, slug, name, description, price,
                    image_url, is_active, sort_order, deleted_at,
                    menu_item_tag_links ( menu_item_tag_id ) )`,
    )
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not read the menu: ${error.message}`);

  return (data ?? []).map((section) => ({
    id: section.id as string,
    slug: section.slug as string,
    title: (section.title as Localized) ?? {},
    sortOrder: section.sort_order as number,
    items: asArray(section.menu_items)
      // Filtered here rather than in the query: a `deleted_at` filter on an
      // embedded table removes the *child*, and PostgREST would happily return
      // a section with its archived items missing and no way to tell that from
      // a section with none.
      .filter((item) => item.deleted_at === null)
      .map(toItem)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

/**
 * Items matching a term, across the **whole** shop.
 *
 * ## Why this is a query and not a filter
 *
 * `fetchMenu` returns every section with its items, so filtering in the browser
 * would find the same rows today and be a habit that is wrong everywhere else:
 * on any list that pages, a client-side filter searches *what has been
 * downloaded*, and quietly cannot find the row on page four. A search that can
 * only find what you can already see is not a search.
 *
 * So it asks the database, and it asks about the columns a person would search
 * by. `->>` reaches inside the jsonb, and both languages are searched because
 * an operator who knows an item as كبة should find it by typing كبة.
 *
 * ## Why it comes back flat
 *
 * Results are items, not sections: what "Charcoal" matches is three dishes, and
 * grouping three results under three headings is chrome around nothing. It also
 * makes the mode change honest — a searched list cannot be dragged, because a
 * position within a set of matches is not a position in the menu.
 */
export type MenuMatches = {
  sections: { id: string; title: Localized; itemCount: number }[];
  items: MenuItem[];
};

/**
 * Everything in a shop that matches, sections as well as items.
 *
 * A menu is two kinds of thing and somebody searching "mezze" may want either —
 * the heading, to rename or archive it, or the dishes filed under it. Returning
 * only items means the section is unreachable by name, and the operator scrolls
 * the whole menu looking for a word the search box has already been told.
 *
 * The two queries go together rather than in sequence: they are independent,
 * and one round trip of latency is enough for one keystroke.
 */
export async function searchMenu(
  storeId: string,
  term: string,
): Promise<MenuMatches> {
  const [sections, items] = await Promise.all([
    searchMenuSections(storeId, term),
    searchMenuItems(storeId, term),
  ]);

  // A matching section brings its items with it.
  //
  // "Mezze" matching a heading means the operator meant that part of the menu,
  // and answering with the heading alone makes them clear the search and go
  // hunting for the very thing they asked about. So the items filed under a
  // matched section are pulled in as well.
  //
  // Merged rather than appended, because a dish can match on its own name *and*
  // sit in a matched section — "Hummus Beiruti" under "Cold mezze", searched
  // for "mezze" — and listing it twice would look like two dishes with the same
  // name, which is a real thing a menu can have.
  const extra = sections.length
    ? await itemsInSections(sections.map((section) => section.id))
    : [];

  const seen = new Set(items.map((item) => item.id));
  for (const item of extra) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }

  return { sections, items };
}

async function itemsInSections(sectionIds: string[]): Promise<MenuItem[]> {
  const { data, error } = await getClient()
    .from("menu_items")
    .select(
      `id, menu_section_id, slug, name, description, price,
       image_url, is_active, sort_order,
       menu_item_tag_links ( menu_item_tag_id )`,
    )
    .in("menu_section_id", sectionIds)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(PAGE.size);

  if (error) throw new Error(`Could not search the menu: ${error.message}`);
  return (data ?? []).map(toItem);
}

async function searchMenuSections(
  storeId: string,
  term: string,
): Promise<MenuMatches["sections"]> {
  const like = `%${term.trim()}%`;

  const { data, error } = await getClient()
    .from("menu_sections")
    // The count comes back with the row, because a heading on its own says
    // nothing about whether it is the one you meant — "Cold mezze, 6 items" is
    // recognisable in a way "Cold mezze" is not.
    .select("id, title, menu_items(count)")
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .or(
      [
        `title->>en.ilike.${like}`,
        `title->>ar.ilike.${like}`,
        `slug.ilike.${like}`,
      ].join(","),
    )
    .order("sort_order", { ascending: true })
    .limit(PAGE.size);

  if (error) throw new Error(`Could not search the menu: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as Localized) ?? {},
    itemCount: countOf(row.menu_items),
  }));
}

/** PostgREST returns an aggregate embed as `[{ count }]`, or nothing at all. */
function countOf(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  const first = value[0] as { count?: number } | undefined;
  return first?.count ?? 0;
}

async function searchMenuItems(
  storeId: string,
  term: string,
): Promise<MenuItem[]> {
  const like = `%${term.trim()}%`;

  const { data, error } = await getClient()
    .from("menu_items")
    .select(
      `id, menu_section_id, slug, name, description, price,
       image_url, is_active, sort_order,
       menu_item_tag_links ( menu_item_tag_id )`,
    )
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .or(
      [
        `name->>en.ilike.${like}`,
        `name->>ar.ilike.${like}`,
        `description->>en.ilike.${like}`,
        `slug.ilike.${like}`,
      ].join(","),
    )
    .order("sort_order", { ascending: true })
    .limit(PAGE.size);

  if (error) throw new Error(`Could not search the menu: ${error.message}`);

  return (data ?? []).map(toItem);
}

export type MenuItemDraft = {
  storeId: string;
  sectionId: string;
  name: Localized;
  description: Localized;
  price: number;
  isActive: boolean;
  imageUrl: string | null;
  /** Ids from the tag vocabulary. Empty is a valid answer, not a missing one. */
  tagIds: string[];
};

/**
 * Adds an item.
 *
 * `sort_order` is computed here rather than defaulted, because the column has
 * no default and "where it goes" is a question the caller can answer and the
 * database cannot: a new item belongs at the end of the section it was added
 * to.
 */
export async function createMenuItem(
  draft: MenuItemDraft,
  sortOrder: number,
): Promise<void> {
  const { data, error } = await getClient()
    .from("menu_items")
    .insert({
      store_id: draft.storeId,
      menu_section_id: draft.sectionId,
      // No `slug`. The trigger from migration 0070 derives it from the English
      // name and makes it unique inside the shop — which a client cannot do
      // without racing another tab.
      name: draft.name,
      // Null when blank, never `{}` — see `localizedOrNull`. A description
      // is optional and the constraint accepts an absent one; it does not
      // accept an object with a locale missing.
      description: localizedOrNull(draft.description),
      price: draft.price,
      is_active: draft.isActive,
      image_url: draft.imageUrl,
      sort_order: sortOrder,
    })
    // The id comes back because the links need something to point at. It is
    // also the reason the tags are a second request: `menu_item_tag_links`
    // references a row that does not exist until this one returns.
    .select("id")
    .single();

  if (error) throw new Error(friendly(error.message));

  // A dish saved with no tags is the common case and costs nothing here.
  if (draft.tagIds.length > 0) {
    await setItemTags(data.id as string, draft.tagIds);
  }
}

/**
 * Adds several items to one section.
 *
 * **One insert, not a loop.** Eleven inserts is eleven round trips and eleven
 * chances to stop halfway, and a half-written list is the worst outcome here:
 * the operator cannot re-paste without duplicating whatever landed. A single
 * statement writes every row or none.
 *
 * No description, no picture, no tags. Those are per-item judgements made while
 * looking at the item, and asking for them in a pasted list would make the
 * format wide enough that nobody would use it. The names and the prices are
 * what a menu *is*; the rest is editing afterwards.
 *
 * `sortOrder` is where the first one lands and the rest follow it, in the order
 * they were typed — which is what keeps a pasted menu in menu order rather than
 * in whatever order the database returns.
 */
export async function createMenuItems(
  storeId: string,
  sectionId: string,
  items: { name: Localized; price: number }[],
  sortOrder: number,
): Promise<void> {
  if (items.length === 0) return;

  const { error } = await getClient()
    .from("menu_items")
    .insert(
      items.map((item, index) => ({
        store_id: storeId,
        menu_section_id: sectionId,
        name: item.name,
        // Absent, not empty. `localizedOrNull`'s rule: the constraint accepts a
        // missing description and refuses an object with a locale missing.
        description: null,
        price: item.price,
        is_active: true,
        image_url: null,
        sort_order: sortOrder + index,
        // No `slug`: the trigger from `0070` derives one per row from the
        // English name and makes it unique in the shop — which is also what
        // refuses a pasted name that already exists, in one place rather than
        // in a check this would have to keep in step.
      })),
    );

  if (error) throw new Error(friendly(error.message));
}

export type MenuItemPatch = Partial<
  Omit<MenuItemDraft, "storeId" | "sectionId">
> & {
  sortOrder?: number;
};

export async function updateMenuItem(
  id: string,
  patch: MenuItemPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined)
    row.description = localizedOrNull(patch.description);
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  // `null` is a value here — it is how a picture is removed — so the check is
  // for the key being absent, not for the value being falsy.
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  // A patch may be tags only — a reorder is not, and neither is a switch — so
  // an empty row is a valid update with nothing to write rather than a bug.
  if (Object.keys(row).length > 0) {
    const { error } = await getClient()
      .from("menu_items")
      .update(row)
      .eq("id", id);
    if (error) throw new Error(friendly(error.message));
  }

  // After the row, deliberately. If the links fail, the dish is saved and its
  // tags are stale — which the operator can see and fix. The other order would
  // leave tags pointing at a dish whose name and price were never written.
  if (patch.tagIds !== undefined) {
    await setItemTags(id, patch.tagIds);
  }
}

/** Soft, like everything with a `deleted_at`: order lines reference items. */
export async function archiveMenuItem(id: string): Promise<void> {
  const { error } = await getClient()
    .from("menu_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export type MenuSectionDraft = {
  storeId: string;
  title: Localized;
};

/**
 * Adds a section.
 *
 * No `slug`, for the same reason an item has none: the trigger from migration
 * 0071 derives it from the English title and makes it unique inside the shop,
 * which a client cannot do without racing another tab.
 */
export async function createMenuSection(
  draft: MenuSectionDraft,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient().from("menu_sections").insert({
    store_id: draft.storeId,
    title: draft.title,
    sort_order: sortOrder,
  });

  if (error) throw new Error(friendly(error.message));
}

export async function updateMenuSection(
  id: string,
  patch: { title?: Localized },
): Promise<void> {
  const { error } = await getClient()
    .from("menu_sections")
    .update({ title: patch.title })
    .eq("id", id);

  if (error) throw new Error(friendly(error.message));
}

/**
 * Adds several sections at once.
 *
 * The same bargain as `createMenuItems`, one level up: one insert, order
 * preserved from the order they were typed, and the slug left to the trigger
 * from `0071`. A shop's sections are the headings on its printed menu and they
 * are known all at once, which is exactly the shape bulk entry is for.
 */
export async function createMenuSections(
  storeId: string,
  titles: Localized[],
  sortOrder: number,
): Promise<void> {
  if (titles.length === 0) return;

  const { error } = await getClient()
    .from("menu_sections")
    .insert(
      titles.map((title, index) => ({
        store_id: storeId,
        title,
        sort_order: sortOrder + index,
      })),
    );

  if (error) throw new Error(friendly(error.message));
}

/**
 * Archives an empty section.
 *
 * **Only an empty one**, and the check is repeated in the database (migration
 * 0072) rather than living here alone. Soft delete does not cascade — the
 * items would keep their `deleted_at` of null while their section had one — and
 * an item in an archived section is in a place neither the dashboard nor the
 * app will show it. It has not been deleted; it has been mislaid, which is
 * worse, because nothing reports it.
 *
 * So the items move first. The count is read back rather than assumed from the
 * list on screen, which may be a minute old.
 */
export async function archiveMenuSection(id: string): Promise<void> {
  const client = getClient();

  const { count, error: countError } = await client
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("menu_section_id", id)
    .is("deleted_at", null);

  if (countError) throw new Error(countError.message);
  if (count && count > 0) {
    throw new Error(t("menu.sectionNotEmpty", { count }));
  }

  const { error } = await client
    .from("menu_sections")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(friendly(error.message));
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

export type SortUpdate = { id: string; sortOrder: number };

/**
 * The rows in a new order, and the smallest set of writes that gets them there.
 *
 * Positions are rewritten as 0…n rather than shuffled, so the stored order is
 * always the order on screen and never a set of gaps a later insert has to find
 * room in.
 *
 * ## Why only the rows that moved
 *
 * Dragging one row past two others changes three positions, not the whole list.
 * Writing every row would make a menu of forty items cost forty requests for a
 * change to three of them — and each of those requests is one more chance for
 * the half-applied state this cannot make atomic.
 *
 * ## Why this is a function rather than two loops in the screen
 *
 * Sections and items reorder identically, and the second copy of "which rows
 * changed" is where an off-by-one lives: it produces a list that looks right
 * until the page is reloaded, because the rows nobody wrote are still carrying
 * their old `sort_order` and only the server knows.
 *
 * An id in `ids` that names no row is skipped rather than throwing, and skipped
 * without leaving a gap behind it. It means the list moved under the drag, and
 * the refetch that follows is what settles it — refusing here would turn a
 * stale preview into an error dialog.
 */
export function applyOrder<T extends { id: string; sortOrder: number }>(
  rows: T[],
  ids: string[],
): { next: T[]; updates: SortUpdate[] } {
  // Two steps, and the order of them matters. Numbering while filtering lets a
  // skipped id consume a position, so one unknown id in the middle leaves a
  // hole at that index and shifts everything below it by one — a list that is
  // in the right order and numbered wrong, which is the failure this whole
  // function exists to avoid.
  const next = ids
    .flatMap((id) => {
      const row = rows.find((candidate) => candidate.id === id);
      return row ? [row] : [];
    })
    .map((row, index) => ({ ...row, sortOrder: index }));

  const updates = next.flatMap((row) => {
    const before = rows.find((candidate) => candidate.id === row.id);
    return before && before.sortOrder === row.sortOrder
      ? []
      : [{ id: row.id, sortOrder: row.sortOrder }];
  });

  return { next, updates };
}

/**
 * Writes a new `sort_order` to each row that needs one.
 *
 * ## Why several requests rather than one
 *
 * PostgREST's bulk upsert is an `insert … on conflict do update`, so it has to
 * satisfy the insert first — every not-null column of every row, for a write
 * that means to touch one integer. The alternative is an RPC, and a
 * `security definer` function taking a table name is a wider hole than this
 * fixes.
 *
 * ## Why that is acceptable here, stated rather than assumed
 *
 * The writes are not atomic, so a dropped connection can leave the list half
 * reordered. Three things make that a nuisance instead of a fault:
 *
 * - **`sort_order` is presentation.** A half-applied order shows the rows in an
 *   odd sequence. It does not lose a row, mis-price one, or affect an order
 *   already placed.
 * - **It is idempotent.** The desired positions are absolute, not relative, so
 *   the same call can simply be made again — and the next drag rewrites them
 *   anyway.
 * - **The list is refetched either way**, on success and on failure. Whatever
 *   actually landed is what the operator sees, so the screen is never a more
 *   optimistic story than the database.
 *
 * Only the rows whose position actually changed are written, which is usually
 * the handful between where a row was and where it went.
 */
export async function setSortOrder(
  table: "menu_items" | "menu_sections",
  updates: SortUpdate[],
): Promise<void> {
  if (updates.length === 0) return;

  const client = getClient();
  const results = await Promise.all(
    updates.map(({ id, sortOrder }) =>
      client.from(table).update({ sort_order: sortOrder }).eq("id", id),
    ),
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) throw new Error(friendly(failure.error.message));
}

/**
 * Turns a constraint violation into a sentence the operator can act on.
 *
 * The form checks these first and this should rarely be seen — but "rarely" is
 * not "never": a second tab, a stale list, an imported row. When it happens the
 * operator gets what to do rather than `menu_items_store_id_slug_key`.
 *
 * The constraint names are from migrations 0066 and 0067, and they are matched
 * loosely on purpose: a renamed constraint should degrade to the raw message,
 * not to a wrong explanation.
 */
function friendly(message: string): string {
  if (message.includes("slug_live_idx") || message.includes("store_id_slug")) {
    return t("dbError.duplicateSlug");
  }
  if (message.includes("_locales")) return t("dbError.missingLanguage");
  if (message.includes("price_positive")) return t("dbError.priceNegative");
  if (message.includes("_len")) return t("dbError.tooLong");

  // Unrecognised. The raw Postgres message is ugly and *true*; a friendly
  // translation of an error nobody has read would be worse — it would say
  // something confident about a failure it does not understand.
  return message;
}

function toItem(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as string,
    sectionId: row.menu_section_id as string,
    slug: row.slug as string,
    name: (row.name as Localized) ?? {},
    description: (row.description as Localized) ?? {},
    price: row.price as number,
    imageUrl: (row.image_url as string | null) ?? null,
    isActive: row.is_active as boolean,
    sortOrder: row.sort_order as number,
    // An embed with nothing in it comes back as `[]`, so an untagged dish and
    // a dish whose links were not asked for look identical here. Every read
    // that reaches `toItem` selects them, which is what makes the empty array
    // mean "no tags" rather than "not loaded".
    tagIds: asArray(row.menu_item_tag_links).map(
      (link) => link.menu_item_tag_id as string,
    ),
  };
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object")
    return [value as Record<string, unknown>];
  return [];
}

// ---------------------------------------------------------------------------
// The archive
// ---------------------------------------------------------------------------

/**
 * What a shop has put away.
 *
 * ## Why this needs a screen at all
 *
 * Archiving is soft everywhere in this product — order lines reference items
 * for ever, so a row is never removed — and until now the *only* consequence of
 * that was invisible. A section or a dish left the menu and there was nowhere
 * it went: no list of it, no way back, and no answer to "where did Signature
 * plates go" beyond re-creating it under a name the slug index would then
 * refuse. A soft delete with no view of what it holds is a hard delete that
 * costs storage.
 *
 * ## Withdrawn options are in here too, and they are a different mechanism
 *
 * `option_groups` and `item_options` have no `deleted_at` — migration 0019 is
 * explicit that `is_active` is how they are withdrawn, and that two ways to say
 * "gone" would be two places to check. So the archive reads two kinds of
 * absence and says so on screen rather than flattening them into one word: a
 * dish is *archived*, a choice is *withdrawn*, and only one of those can be
 * undone from the tab it normally lives on.
 */
export type ArchivedSection = {
  id: string;
  title: Localized;
  archivedAt: string;
};

export type ArchivedItem = {
  id: string;
  name: Localized;
  price: number;
  imageUrl: string | null;
  archivedAt: string;
  sectionTitle: Localized;
  /** Whether the section it would return to is itself archived. */
  sectionArchived: boolean;
};

export type WithdrawnGroup = {
  id: string;
  title: Localized;
  /** One of the items it is asked on — the row says "and N others". */
  itemName: Localized;
  /** How many items ask it. Zero is possible and is worth showing. */
  itemCount: number;
};

export type WithdrawnOption = {
  id: string;
  name: Localized;
  price: number;
  groupTitle: Localized;
  itemName: Localized;
  itemCount: number;
};

export type Archive = {
  sections: ArchivedSection[];
  items: ArchivedItem[];
  groups: WithdrawnGroup[];
  options: WithdrawnOption[];
};

/**
 * Everything one shop has put away, in one read.
 *
 * Four queries rather than one join: they are four different questions about
 * three tables, and the join that answered all of them at once would return a
 * row per option per group per item and be un-picked apart in the browser.
 * They run together, so it is one round trip's worth of waiting.
 *
 * **Archived items carry their section's state**, because it decides whether
 * they can come back: restoring a dish into an archived section is the mislaid
 * state `archiveMenuSection` exists to prevent, and the screen has to be able
 * to say so before the operator presses the button rather than after.
 */
export async function fetchArchive(storeId: string): Promise<Archive> {
  const client = getClient();

  const [sections, items, groups, options] = await Promise.all([
    client
      .from("menu_sections")
      .select("id, title, deleted_at")
      .eq("store_id", storeId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    client
      .from("menu_items")
      .select(
        "id, name, price, image_url, deleted_at, menu_sections!inner ( title, deleted_at )",
      )
      .eq("store_id", storeId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    // Scoped by the group's own `store_id` rather than through an item, since
    // `0094` there is no owning item to join to — and a withdrawn question that
    // is asked on nothing would drop out of an inner join to the links, which
    // is exactly the row most in need of being listed here.
    client
      .from("option_groups")
      .select(
        `id, title, is_active,
         menu_item_option_group_links ( menu_items ( name ) )`,
      )
      .eq("store_id", storeId)
      .eq("is_active", false),

    client
      .from("item_options")
      .select(
        `id, name, price, is_active,
         option_groups!inner ( title, store_id,
           menu_item_option_group_links ( menu_items ( name ) ) )`,
      )
      .eq("option_groups.store_id", storeId)
      .eq("is_active", false),
  ]);

  for (const result of [sections, items, groups, options]) {
    if (result.error) {
      throw new Error(`Could not read the archive: ${result.error.message}`);
    }
  }

  return {
    sections: (sections.data ?? []).map((row) => ({
      id: row.id as string,
      title: (row.title as Localized) ?? {},
      archivedAt: row.deleted_at as string,
    })),
    items: (items.data ?? []).map((row) => {
      const section = one(row.menu_sections);
      return {
        id: row.id as string,
        name: (row.name as Localized) ?? {},
        price: row.price as number,
        imageUrl: (row.image_url as string | null) ?? null,
        archivedAt: row.deleted_at as string,
        sectionTitle: (section?.title as Localized) ?? {},
        sectionArchived: section?.deleted_at != null,
      };
    }),
    groups: (groups.data ?? []).map((row) => ({
      id: row.id as string,
      title: (row.title as Localized) ?? {},
      itemName: firstItemName(row.menu_item_option_group_links),
      itemCount: asArray(row.menu_item_option_group_links).length,
    })),
    options: (options.data ?? []).map((row) => {
      const group = one(row.option_groups);
      return {
        id: row.id as string,
        name: (row.name as Localized) ?? {},
        price: row.price as number,
        groupTitle: (group?.title as Localized) ?? {},
        itemName: firstItemName(group?.menu_item_option_group_links),
        itemCount: asArray(group?.menu_item_option_group_links).length,
      };
    }),
  };
}

/**
 * Puts a dish back on the menu.
 *
 * **Refuses when its section is archived**, and the check is here rather than
 * only in the screen: a restored dish in an archived section has a `deleted_at`
 * of null inside a section that does not, so neither the dashboard nor the app
 * would list it. It has not been restored; it has been mislaid — the same
 * failure `archiveMenuSection` guards from the other direction, and the reason
 * that function moves items out before it archives anything.
 *
 * The section is read back rather than trusted from the list on screen, which
 * may be a minute old.
 */
export async function restoreMenuItem(id: string): Promise<void> {
  const client = getClient();

  const { data, error: lookup } = await client
    .from("menu_items")
    .select("menu_sections!inner ( title, deleted_at )")
    .eq("id", id)
    .single();

  if (lookup) throw new Error(lookup.message);

  const section = one(data?.menu_sections);
  if (section?.deleted_at != null) {
    throw new Error(
      t("archive.sectionGoneFirst", {
        name: pickLocalized((section.title as Localized) ?? {}),
      }),
    );
  }

  const { error } = await client
    .from("menu_items")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw new Error(friendly(error.message));
}

/**
 * Puts a section back.
 *
 * Nothing to check: a section can only be archived once it is empty of live
 * items, so the one that comes back is the one that went away. Its dishes are
 * restored individually, which is also the only honest order — some of them
 * were archived on purpose before the section was.
 */
export async function restoreMenuSection(id: string): Promise<void> {
  const { error } = await getClient()
    .from("menu_sections")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw new Error(friendly(error.message));
}

/**
 * PostgREST hands an embedded to-one back as an object, and sometimes as an
 * array of one — which of the two depends on how it read the relationship.
 * Both mean the same thing here, and a screen should not have to know which it
 * got.
 */
/**
 * The name of one item a question is asked on, for a row that has room for one.
 *
 * A common question is asked on many and the row says "and N others" beside
 * this; a question asked on none — every link removed, the group kept — gives
 * an empty name, which the screen renders as its own state rather than as a
 * blank.
 */
function firstItemName(links: unknown): Localized {
  const item = one(asArray(links)[0]?.menu_items);
  return (item?.name as Localized) ?? {};
}

function one(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown>;
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return undefined;
}
