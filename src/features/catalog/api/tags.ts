import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
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
 * ## `tone` is a role, not a colour
 *
 * The column holds a palette role and the screen decides what it looks like.
 * The app does the same, from its own tokens, so one tag reads as the product
 * in both places and re-tuning the palette needs no data migration. There is no
 * colour picker here for the same reason there is no hex literal in a
 * component.
 */

/** The palette roles a tag may be drawn in. Mirrors `menu_item_tags_tone_known`. */
export const TAG_TONES = [
  "neutral",
  "accent",
  "yellow",
  "active",
  "info",
] as const;

export type TagTone = (typeof TAG_TONES)[number];

export type Tag = {
  id: string;
  slug: string;
  name: Localized;
  tone: TagTone;
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

const COLUMNS = `id, slug, name, tone, is_active,
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
 * fix its tone, correct the Arabic — and that row is then the first one rather
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

  const term = search?.trim();
  if (term) {
    const like = `%${term}%`;
    query = query.or(
      [
        `name->>en.ilike.${like}`,
        `name->>ar.ilike.${like}`,
        `slug.ilike.${like}`,
      ].join(","),
    );
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw new Error(`Could not read the tags: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: (row.name as Localized) ?? {},
    tone: (row.tone as TagTone) ?? "neutral",
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

export type TagDraft = {
  name: Localized;
  tone: TagTone;
  isActive: boolean;
};

export async function createTag(draft: TagDraft): Promise<void> {
  const { error } = await getClient().from("menu_item_tags").insert({
    name: draft.name,
    tone: draft.tone,
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
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.tone !== undefined) row.tone = patch.tone;
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
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  if (message.includes("_locales")) return t("dbError.missingLanguage");
  if (message.includes("_len")) return t("dbError.tooLong");
  if (message.includes("tone_known")) return t("tags.unknownTone");
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
