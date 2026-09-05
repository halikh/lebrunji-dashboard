import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { getClient } from "@/lib/supabase/client";
import type { Localized } from "@/lib/validation";

import type { TagInk, TagTone } from "./tags";

/**
 * What the catalogue as a whole has put away.
 *
 * ## The shop archive is the same idea one level down
 *
 * `features/catalog/api/menu.ts` holds the archive for *one shop* — its
 * sections, its dishes, its withdrawn questions and choices. This is the tier
 * above: the shops themselves, and the three things that are true across all of
 * them at once. An operator who archives a shop and then wants it back has
 * nowhere to look otherwise, and the same was true of a category, a tag and a
 * promotion.
 *
 * ## Everything here is a `deleted_at`
 *
 * All four tables carry one — `stores`, `categories`, `menu_item_tags` (0077)
 * and `discounts` — so unlike the shop-level archive there is only one kind of
 * absence to show, and the word on screen is "archived" throughout.
 *
 * ## A shop remembers which category it belongs to
 *
 * `stores.category_id` is `not null`, so a shop always has one, and restoring a
 * shop into an archived category would put it on a shelf the app does not draw.
 * The same refusal the menu archive makes about a dish and its section, for the
 * same reason — see {@link restoreStore}.
 */

export type ArchivedStore = {
  id: string;
  name: Localized;
  imageUrl: string | null;
  archivedAt: string;
  categoryName: Localized;
  /** Whether the category it would return to is itself archived. */
  categoryArchived: boolean;
};

export type ArchivedCategory = {
  id: string;
  name: Localized;
  archivedAt: string;
};

export type ArchivedTag = {
  id: string;
  name: Localized;
  /** The palette role, so an archived tag is drawn as the chip it was. */
  tone: TagTone;
  /** Null for the tone's own — see `Tag.ink`. */
  ink: TagInk | null;
  /** Null for the tone's own colour — see `Tag.color`. */
  color: string | null;
  archivedAt: string;
};

export type ArchivedPromotion = {
  id: string;
  /** A promotion has no customer-facing name — the slug is the operator's. */
  slug: string;
  imageUrl: string | null;
  archivedAt: string;
};

export type CatalogueArchive = {
  stores: ArchivedStore[];
  categories: ArchivedCategory[];
  tags: ArchivedTag[];
  promotions: ArchivedPromotion[];
};

/**
 * Everything the catalogue has put away, in one read.
 *
 * Four queries in parallel rather than one join, for the reason the shop
 * archive gives: they are four questions about four unrelated tables, and the
 * join answering all of them would be a cross product to unpick in the browser.
 */
export async function fetchCatalogueArchive(): Promise<CatalogueArchive> {
  const client = getClient();

  const [stores, categories, tags, promotions] = await Promise.all([
    client
      .from("stores")
      .select(
        "id, name, image_url, deleted_at, categories!inner ( name, deleted_at )",
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    client
      .from("categories")
      .select("id, name, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    client
      .from("menu_item_tags")
      .select("id, name, tone, ink, color, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    client
      .from("discounts")
      .select("id, slug, image_url, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  for (const result of [stores, categories, tags, promotions]) {
    if (result.error) {
      throw new Error(`Could not read the archive: ${result.error.message}`);
    }
  }

  return {
    stores: (stores.data ?? []).map((row) => {
      const category = one(row.categories);
      return {
        id: row.id as string,
        name: (row.name as Localized) ?? {},
        imageUrl: (row.image_url as string | null) ?? null,
        archivedAt: row.deleted_at as string,
        categoryName: (category?.name as Localized) ?? {},
        categoryArchived: category?.deleted_at != null,
      };
    }),
    categories: (categories.data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as Localized) ?? {},
      archivedAt: row.deleted_at as string,
    })),
    tags: (tags.data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as Localized) ?? {},
      tone: (row.tone as TagTone) ?? "neutral",
      ink: (row.ink as TagInk | null) ?? null,
      color: (row.color as string | null) ?? null,
      archivedAt: row.deleted_at as string,
    })),
    promotions: (promotions.data ?? []).map((row) => ({
      id: row.id as string,
      slug: row.slug as string,
      imageUrl: (row.image_url as string | null) ?? null,
      archivedAt: row.deleted_at as string,
    })),
  };
}

/**
 * Puts a shop back in the catalogue.
 *
 * **Refuses when its category is archived.** `stores.category_id` is `not
 * null`, so the shop would come back onto a shelf neither the dashboard nor the
 * app draws — restored in the column and invisible everywhere, which is worse
 * than staying archived because nothing reports it. The category is read back
 * rather than trusted from the list on screen, which may be a minute old.
 */
export async function restoreStore(id: string): Promise<void> {
  const client = getClient();

  const { data, error: lookup } = await client
    .from("stores")
    .select("categories!inner ( name, deleted_at )")
    .eq("id", id)
    .single();

  if (lookup) throw new Error(lookup.message);

  const category = one(data?.categories);
  if (category?.deleted_at != null) {
    throw new Error(
      t("archive.categoryGoneFirst", {
        name: pickLocalized((category.name as Localized) ?? {}),
      }),
    );
  }

  await clearDeletedAt("stores", id);
}

/**
 * Puts a category back.
 *
 * Nothing to check. A category can only be archived once no live shop points at
 * it, so what comes back is a shelf with nothing on it — and its shops are
 * restored one at a time, which is the only honest order: some of them were
 * archived deliberately before the category was.
 */
export async function restoreCategory(id: string): Promise<void> {
  await clearDeletedAt("categories", id);
}

/** Puts a tag back in the vocabulary. Nothing references it that can break. */
export async function restoreTag(id: string): Promise<void> {
  await clearDeletedAt("menu_item_tags", id);
}

/**
 * Puts a promotion back.
 *
 * It returns **as it was**, dates included — which may well be a window that
 * has already closed. That is deliberate: silently moving `ends_at` forward
 * would be the dashboard deciding a discount should run again, and the operator
 * can see the dates on the row and change them.
 */
export async function restorePromotion(id: string): Promise<void> {
  await clearDeletedAt("discounts", id);
}

/**
 * The one write all four restores make.
 *
 * A shared helper rather than four near-identical functions: they differ only
 * in a table name, and four copies is four places for the column to be spelled
 * differently the day somebody adds a fifth.
 */
async function clearDeletedAt(table: string, id: string): Promise<void> {
  const { error } = await getClient()
    .from(table)
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * PostgREST hands an embedded to-one back as an object, and sometimes as an
 * array of one, depending on how it read the relationship. Both mean the same
 * thing here, and a caller should not have to know which it got.
 */
function one(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown>;
  if (value && typeof value === "object")
    return value as Record<string, unknown>;
  return undefined;
}
