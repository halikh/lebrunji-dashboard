import { PAGE } from "@/lib/limits";
import { likeAny, searchTerm } from "@/lib/search";
import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
import { isTagName, tagName } from "@/lib/text-format";
import type { Localized } from "@/lib/validation";

/**
 * Menu item tags — the chips on a dish. "Popular", "Spicy", "New".
 *
 * ## Why this screen exists at all
 *
 * Migration `0058` deleted tags outright, and it was right to: they were three
 * rows seeded by a migration, pointing at translation keys nobody could edit.
 * There was no way to add "Vegan", rename one, or retire one. A vocabulary
 * nobody can add to is decoration.
 *
 * `0077` brings them back **because this screen is what was missing.** That is
 * the whole justification, and it is worth being honest about: the feature was
 * not wrong, the tooling was absent.
 *
 * ## Tags are shared, and options are not
 *
 * `0074` gave every option group exactly one owning dish, on the grounds that
 * what merchants share is the *shape* of a question and never its answers. Tags
 * go the other way, and the contrast is the reason both are right: "Spicy"
 * means the same thing on every dish in the app. That sameness is the only
 * reason to have a vocabulary rather than free text — free text is how a menu
 * ends up carrying "Spicy", "spicy" and "SPICY" with no way to find them
 * together.
 *
 * ## An icon and a word, and no colour
 *
 * A tag used to carry a palette role, then an ink, then any colour at all
 * (`0077`, `0112`, `0114`), and for a while its name had to open with an emoji.
 * All of that is gone. A tag is now an uploaded icon (`icon_url`, required)
 * followed by its name in plain heading type — see `tag-chip.tsx` — and the
 * name is letters and single spaces only (`menu_item_tags_name_letters`): the
 * picture is the icon's job, so the words carry no pictures, digits or
 * punctuation of their own.
 */

export type Tag = {
  id: string;
  slug: string;
  name: Localized;
  /**
   * The tag's icon, drawn small before its name.
   *
   * Required by `menu_item_tags_icon_required` on every insert and update of a
   * live tag. Nullable here only because that check is `not valid`: a tag made
   * before it may still arrive without one, and the editor has to be able to
   * open it to add one. Such a tag is drawn as its name alone.
   */
  iconUrl: string | null;
  isActive: boolean;
  /**
   * How many live dishes carry it.
   *
   * Read with the row rather than on demand, because it is what makes retiring
   * one an informed decision: "Archive Spicy" and "Archive Spicy, which is on
   * 34 dishes" are different questions, and only the second one can be
   * answered.
   */
  usedBy: number;
};

const COLUMNS = `id, slug, name, icon_url, is_active,
   menu_item_tag_links ( count )`;

/**
 * Every tag, or the ones matching a term.
 *
 * The term goes into the query, never into a filter over rows already here —
 * the rule every list in this dashboard follows. Both languages, because an
 * operator who knows the chip as حار must find it by typing حار.
 *
 * ## Newest first, since nobody curates the order any more
 *
 * The list used to come back in `sort_order`, which the operator set by
 * dragging. That went with `0100`: the app shows two or three chips on one
 * dish and never the vocabulary end to end, so arranging fifty tags was careful
 * work whose result was never visible anywhere.
 *
 * `created_at desc` rather than alphabetical, because of why this screen gets
 * opened. It is almost always a tag just added — to check how the chip reads,
 * check its icon, correct the Arabic — and that row is then the first one rather
 * than one to go looking for. A vocabulary is also searched more than it is
 * browsed, and the box above handles that.
 *
 * Still not paginated. A tag vocabulary is bounded by what fits on a chip row;
 * a shop with two hundred tags has a different problem, and it is not one
 * paging would fix.
 */
export async function fetchTags(search?: string | null): Promise<Tag[]> {
  let query = getClient()
    .from("menu_item_tags")
    .select(COLUMNS)
    .is("deleted_at", null);

  // Quoted — see `lib/search.ts`. A tag named "Hot, spicy" would otherwise
  // break the filter it is interpolated into.
  const term = searchTerm(search);
  if (term) query = query.or(likeAny(["name->>en", "name->>ar", "slug"], term));

  const { data, error } = await query
    .order("created_at", { ascending: false })
    // A vocabulary is bounded by what fits on a chip row, and the note above
    // says why paging would not help a shop that has outgrown that. The cap is
    // that assumption made checkable rather than assumed.
    .limit(PAGE.cap);

  if (error) throw new Error(`Could not read the tags: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: (row.name as Localized) ?? {},
    iconUrl: (row.icon_url as string | null) ?? null,
    isActive: row.is_active as boolean,
    usedBy: countOf(row.menu_item_tag_links),
  }));
}

/**
 * PostgREST returns an aggregate embed as `[{ count: n }]`, and as `[]` when
 * there is nothing to count — so the empty case is an absent row rather than a
 * zero. Read defensively: a shape mismatch here would render "undefined dishes"
 * in a confirmation, which is worse than a wrong number because it looks like
 * the screen is broken rather than like the data is.
 */
function countOf(value: unknown): number {
  if (Array.isArray(value)) {
    const first = value[0] as { count?: number } | undefined;
    return first?.count ?? 0;
  }
  if (value && typeof value === "object") {
    return (value as { count?: number }).count ?? 0;
  }
  return 0;
}

/*
 * The two rules on a tag, applied here as well as in the form.
 *
 * The form's copy is what makes them visible while somebody types; this copy
 * is what makes them true. A rule enforced only by one editor is a rule the
 * next screen written does not have.
 */

/**
 * Refuses a tag name that is anything but letters and single spaces, naming
 * the language that breaks the rule.
 *
 * The same set `menu_item_tags_name_letters` checks — see `TAG_WORD` in
 * `lib/text-format.ts`, which has to match it character for character. Every
 * language separately; a blank optional language is not this function's
 * business (the `_locales` check and `validateLocalizedText` own that).
 */
function requireLetters(name: Localized): void {
  const bad = Object.entries(name)
    .filter(([, text]) => text.trim().length > 0 && !isTagName(text))
    .map(([code]) => code);

  if (bad.length > 0) {
    throw new Error(t("tags.lettersOnly", { language: bad.join(", ") }));
  }
}

/**
 * Refuses a tag with no icon, before `menu_item_tags_icon_required` has to.
 *
 * Blank counts as missing because the check trims. Archiving never comes
 * through here, and the constraint lets any tag be archived, icon or not.
 */
function requireIcon(iconUrl: string | null | undefined): void {
  if (!iconUrl || iconUrl.trim() === "") {
    throw new Error(t("tags.iconRequired"));
  }
}

/**
 * A name as it is stored: each language trimmed, with single spaces between
 * words. Case is left exactly as typed.
 */
function tidy(name: Localized): Localized {
  return Object.fromEntries(
    Object.entries(name).map(([code, text]) => [code, tagName(text)]),
  );
}

export type TagDraft = {
  name: Localized;
  /** Required — see `Tag.iconUrl`. */
  iconUrl: string | null;
  isActive: boolean;
};

export async function createTag(draft: TagDraft): Promise<void> {
  const name = tidy(draft.name);
  requireLetters(name);
  requireIcon(draft.iconUrl);

  const { error } = await getClient().from("menu_item_tags").insert({
    name,
    icon_url: draft.iconUrl,
    is_active: draft.isActive,
    // No `slug`: `0071`'s trigger derives one from the English name
    // inside the insert's own transaction, which is the only way to make it
    // unique without racing another tab.
  });

  if (error) throw new Error(friendly(error.message));
}

export type TagPatch = Partial<TagDraft>;

export async function updateTag(id: string, patch: TagPatch): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = tidy(patch.name);
    requireLetters(name);
    row.name = name;
  }
  // Present means "set it to this", so an empty one is a request to clear a
  // required field. Absent means "leave it" — and a legacy tag with no icon is
  // still refused by the database on any update (a switch on the list
  // included), which `friendly` turns into the same sentence.
  if (patch.iconUrl !== undefined) {
    requireIcon(patch.iconUrl);
    row.icon_url = patch.iconUrl;
  }
  if (patch.isActive !== undefined) row.is_active = patch.isActive;

  const { error } = await getClient()
    .from("menu_item_tags")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/**
 * Retires a tag.
 *
 * Soft, and the links are left alone — which is the whole design of it. A
 * retired tag stops appearing on every phone at once, because
 * `api_v1_store_menu` filters on `deleted_at` server-side. But the forty dishes
 * that carried it still carry it, so bringing it back is one click rather than
 * forty.
 *
 * The `on delete cascade` on the links only ever fires on a *permanent*
 * removal, which nothing in this dashboard performs.
 *
 * Unlike a category, this does not refuse while it is in use. Nothing breaks:
 * `menu_items` does not reference a tag, so retiring one takes a chip off some
 * dishes and changes nothing else. What the operator gets instead is the count,
 * in the confirmation, before they decide.
 */
export async function archiveTag(id: string): Promise<void> {
  const { error } = await getClient()
    .from("menu_item_tags")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(friendly(error.message));
}

/**
 * Puts a dish's tags exactly where the form says they should be.
 *
 * ## Why it reads first rather than deleting everything and re-inserting
 *
 * Delete-then-insert is one line shorter and wrong in a way that only shows up
 * on a bad connection: the two are separate requests, so a failure between them
 * leaves the dish with **no** tags — not the tags it had, and not the ones the
 * operator chose. The operator sees "could not save", presses Save again, and
 * by then the form's own state is the only remaining record of what was there.
 *
 * Reading first and writing only the difference means the failure cases are all
 * survivable: nothing to remove is no request, nothing to add is no request,
 * and a half-applied change is a subset of the intent rather than an empty set.
 * It is also idempotent, which matters because saving a form twice is something
 * people do.
 */
export async function setItemTags(
  itemId: string,
  tagIds: readonly string[],
): Promise<void> {
  const client = getClient();

  const { data, error } = await client
    .from("menu_item_tag_links")
    .select("menu_item_tag_id")
    .eq("menu_item_id", itemId);

  if (error) throw new Error(friendly(error.message));

  const before = new Set(
    (data ?? []).map((row) => row.menu_item_tag_id as string),
  );
  const after = new Set(tagIds);

  const removed = [...before].filter((id) => !after.has(id));
  const added = [...after].filter((id) => !before.has(id));

  if (removed.length > 0) {
    const { error: removeError } = await client
      .from("menu_item_tag_links")
      .delete()
      .eq("menu_item_id", itemId)
      .in("menu_item_tag_id", removed);
    if (removeError) throw new Error(friendly(removeError.message));
  }

  if (added.length > 0) {
    const { error: addError } = await client.from("menu_item_tag_links").insert(
      added.map((tagId) => ({
        menu_item_id: itemId,
        menu_item_tag_id: tagId,
      })),
    );
    if (addError) throw new Error(friendly(addError.message));
  }
}

function friendly(message: string): string {
  // First: the names are specific, and `slug` and `_len` are loose substrings.
  if (message.includes("menu_item_tags_icon_required")) {
    return t("tags.iconRequired");
  }
  if (message.includes("menu_item_tags_name_letters")) {
    return t("tags.lettersOnlyAny");
  }
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  if (message.includes("_locales")) return t("dbError.missingLanguage");
  if (message.includes("_len")) return t("dbError.tooLong");
  // A dish already carrying the tag. Reached only by two tabs saving the same
  // item at once, and the right answer is that the intended state is the state:
  // the link exists, which is what was asked for.
  if (
    message.includes("menu_item_tag_links_menu_item_id_menu_item_tag_id_key")
  ) {
    return t("tags.alreadyOnDish");
  }
  return message;
}
