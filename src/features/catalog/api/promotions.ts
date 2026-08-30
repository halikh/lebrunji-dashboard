import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";

/**
 * Promotional banners — the cards on the app's home screen.
 *
 * ## They are artwork, and that is the whole of it
 *
 * `src/features/catalog/api/offers.ts` in the app says it plainly: *the card is
 * the artwork alone — any wording belongs in the image.* So a banner is a
 * picture, a window in which it appears, and an order. There is no headline to
 * write and no link to point at: `0013` dropped the text columns and `0053`
 * dropped `link_value`, leaving `link_kind` naming a destination the schema can
 * no longer reach.
 *
 * ## They do **not** discount anything, and this file will not pretend they do
 *
 * The rows live in `discounts`, which carries `kind`, `value`, `min_subtotal`,
 * redemption caps and the rest of a discount engine's vocabulary. None of it is
 * read by anything: `place_order` hardcodes `v_discount bigint := 0` with the
 * comment *no discount engine yet*, and no coupon column exists anywhere in the
 * schema.
 *
 * So this reads and writes the columns that have an effect, and leaves the rest
 * untouched at their defaults. Putting a "20% off" field on the screen would be
 * offering a decision with no consequence — the same mistake as an uploader for
 * a picture nothing renders — and the operator would find out from a customer's
 * bill that it never applied.
 *
 * When the engine is built, those fields arrive with it and the screen stops
 * being called "banners".
 */

export type Banner = {
  id: string;
  slug: string;
  imageUrl: string | null;
  /** ISO instants, or null for open-ended. */
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  /** Lower shows first — the app orders ascending. */
  priority: number;
};

const COLUMNS = "id, slug, image_url, starts_at, ends_at, is_active, priority";

export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await getClient()
    .from("discounts")
    .select(COLUMNS)
    .is("deleted_at", null)
    .order("priority", { ascending: true });

  if (error) throw new Error(`Could not read the banners: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    imageUrl: (row.image_url as string | null) ?? null,
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    isActive: row.is_active as boolean,
    priority: row.priority as number,
  }));
}

export type BannerDraft = {
  /** The English name the slug is derived from. Never shown to a customer. */
  name: string;
  imageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

/**
 * Adds a banner.
 *
 * `discounts` has no jsonb text column, so `0071`'s slug trigger has nothing to
 * read and the slug is supplied. It is the operator's own label — a banner is
 * artwork, so this is the only handle they have on it in a list.
 *
 * `kind`, `value` and `priority` are the row's remaining `not null` columns
 * with no default. They are set to the values that mean "does nothing": a
 * percentage of zero, which is what the discount engine would apply if it
 * existed, and the end of the queue.
 */
export async function createBanner(
  draft: BannerDraft,
  priority: number,
): Promise<void> {
  const { error } = await getClient()
    .from("discounts")
    .insert({
      slug: slugify(draft.name),
      image_url: draft.imageUrl,
      starts_at: draft.startsAt,
      ends_at: draft.endsAt,
      is_active: draft.isActive,
      priority,
      kind: "percent",
      value: 0,
    });

  if (error) throw new Error(friendly(error.message));
}

export type BannerPatch = Partial<Omit<BannerDraft, "name">> & {
  priority?: number;
};

export async function updateBanner(
  id: string,
  patch: BannerPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  // `null` is a value for all three — no picture, no start, no end — so what is
  // tested is the key being absent, not the value.
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.startsAt !== undefined) row.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) row.ends_at = patch.endsAt;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.priority !== undefined) row.priority = patch.priority;

  const { error } = await getClient()
    .from("discounts")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/** Soft, like every lifecycle table here. `discount_redemptions` points at it. */
export async function archiveBanner(id: string): Promise<void> {
  const { error } = await getClient()
    .from("discounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

export async function setBannerOrder(
  updates: { id: string; priority: number }[],
): Promise<void> {
  if (updates.length === 0) return;

  const client = getClient();
  const results = await Promise.all(
    updates.map(({ id, priority }) =>
      client.from("discounts").update({ priority }).eq("id", id),
    ),
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) throw new Error(friendly(failure.error.message));
}

/**
 * Text to the shape `discounts_slug_shape` accepts.
 *
 * The same rule as `0071`'s `slugify`, in the one place a client still has to
 * do this: `discounts` has no jsonb name for the trigger to read. Kept short
 * and deliberately unclever — anything that survives is lower-case letters,
 * digits and single hyphens.
 */
function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58);
  // Never empty: the column is `not null` and the CHECK refuses a blank. A name
  // with no Latin letters falls back to something unique rather than failing.
  return slug || `banner-${Date.now().toString(36)}`;
}

function friendly(message: string): string {
  if (message.includes("window_ordered"))
    return t("promotions.windowBackwards");
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  return message;
}
