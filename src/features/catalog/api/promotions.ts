import { getClient } from "@/lib/supabase/client";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

/**
 * Promotions — the cards on the app's home screen, and what they take off a
 * bill.
 *
 * ## This file used to be called banners, and said so at length
 *
 * The old version wrote only the artwork, the window and the order, and
 * explained why: `place_order` hardcoded `v_discount bigint := 0` with the
 * comment *no discount engine yet*, so `kind`, `value`, `min_subtotal` and the
 * redemption caps were columns nothing read. Offering a "20% off" field would
 * have been offering a decision with no consequence, and the operator would
 * have found out from a customer's bill.
 *
 * **`0076_discount_engine.sql` built the engine**, so the reasoning that kept
 * those fields off the screen no longer holds. `discount_for_order()` decides
 * eligibility and amount, `place_order` asks it, and the redemption is written
 * in the same transaction as the order. The fields arrive with the engine,
 * exactly as the plan said they would, and the screen stops being called
 * banners.
 *
 * ## One discount per order
 *
 * No stacking. `is_exclusive` was dropped in `0053` because every discount
 * behaved as though it were exclusive, and nothing in the schema expresses how
 * two would combine. `priority` decides, lowest first, and a tie goes to the
 * larger amount — given two promotions the merchant ranked equally, the
 * customer gets the better one, which is the answer that never has to be
 * explained.
 *
 * So the drag order on this screen is not decoration: it is which promotion
 * wins when two apply.
 *
 * ## The unit `value` is in
 *
 * A **percent** for `percentage`, not basis points. `0001`'s comment says basis
 * points and `0066` then added `check (kind <> 'percentage' or value <= 100)` —
 * a constraint outranks a comment, and it is the constraint a save is refused
 * by. Minor units for `fixedAmount`. Ignored entirely for `freeDelivery`, where
 * the amount is whatever the delivery fee turned out to be.
 */

export type PromotionKind = "percentage" | "fixedAmount" | "freeDelivery";

export const PROMOTION_KINDS: PromotionKind[] = [
  "percentage",
  "fixedAmount",
  "freeDelivery",
];

/** What a scope row narrows the promotion to. Mirrors `discount_scope_type`. */
export type ScopeType = "order" | "store" | "category" | "menuItem";

export type Scope = {
  scopeType: ScopeType;
  /** Null for `order`, which is the whole basket. */
  targetId: string | null;
};

/**
 * The screens that advertise a promotion. Mirrors `discounts_placements_known`.
 *
 * Advertising, not eligibility: `discount_for_order` does not read this, so a
 * promotion placed nowhere still applies at checkout. An empty list is
 * therefore a real answer — a discount that is given without being announced.
 */
export const PLACEMENTS = ["home", "store", "cart"] as const;

export type Placement = (typeof PLACEMENTS)[number];

export type Promotion = {
  id: string;
  slug: string;
  /**
   * The card, per language, or null for a promotion with no artwork.
   *
   * Both locales or neither — the wording is baked into the picture (`0013`),
   * so one file cannot serve two languages. `0113` made this a translated
   * column like every other.
   */
  imageUrl: Localized | null;
  /** Where the card is shown. See `PLACEMENTS`. */
  placements: Placement[];
  /** ISO instants, or null for open-ended. */
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  /** Lower wins — the app orders ascending, and so does the engine. */
  priority: number;

  kind: PromotionKind;
  /** Percent, or minor units, or unused — see the file header. */
  value: number;
  minSubtotal: number | null;
  maxDiscount: number | null;
  maxRedemptionsPerUser: number | null;
  maxRedemptionsTotal: number | null;
  isFirstOrderOnly: boolean;

  scopes: Scope[];

  /**
   * How many times it has actually been given.
   *
   * Read with the row because it is the only thing on the screen that says
   * whether a promotion is *working*. A cap of 100 means nothing without it,
   * and a promotion nobody has redeemed in a fortnight is usually one whose
   * scope or minimum is wrong — which is invisible from the settings alone.
   */
  redeemed: number;
};

const COLUMNS = `id, slug, image_url, placements, starts_at, ends_at, is_active, priority,
   kind, value, min_subtotal, max_discount,
   max_redemptions_per_user, max_redemptions_total, is_first_order_only,
   discount_scopes ( scope_type, target_id ),
   discount_redemptions ( count )`;

/**
 * Every promotion, or the ones matching a term.
 *
 * The term goes into the query rather than filtering rows already here — the
 * rule every list in this dashboard follows, and the reason is that a
 * client-side filter searches what has been *downloaded*, which is a habit that
 * is silently wrong on any list that pages.
 *
 * **The searchable text is the slug, and only the slug.** That is not an
 * oversight: `0013` dropped `label_key`, `headline_key` and `note_key`, so a
 * promotion has no name a customer sees — the card is artwork and any wording
 * is in the image. The slug is the operator's own label and the only handle
 * they have on a picture in a list, which is exactly why the form asks for one.
 */
export async function fetchPromotions(
  search?: string | null,
): Promise<Promotion[]> {
  let query = getClient()
    .from("discounts")
    .select(COLUMNS)
    .is("deleted_at", null);

  const term = search?.trim();
  if (term) {
    query = query.ilike("slug", `%${term}%`);
  }

  const { data, error } = await query.order("priority", { ascending: true });

  if (error) throw new Error(`Could not read the promotions: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    imageUrl: (row.image_url as Localized | null) ?? null,
    placements: ((row.placements as Placement[] | null) ?? []).filter(
      (one): one is Placement => (PLACEMENTS as readonly string[]).includes(one),
    ),
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    isActive: row.is_active as boolean,
    priority: row.priority as number,

    kind: row.kind as PromotionKind,
    value: row.value as number,
    minSubtotal: (row.min_subtotal as number | null) ?? null,
    maxDiscount: (row.max_discount as number | null) ?? null,
    maxRedemptionsPerUser:
      (row.max_redemptions_per_user as number | null) ?? null,
    maxRedemptionsTotal: (row.max_redemptions_total as number | null) ?? null,
    isFirstOrderOnly: Boolean(row.is_first_order_only),

    scopes: asArray(row.discount_scopes).map((scope) => ({
      scopeType: scope.scope_type as ScopeType,
      targetId: (scope.target_id as string | null) ?? null,
    })),

    redeemed: countOf(row.discount_redemptions),
  }));
}

export type PromotionDraft = {
  /** The English label the slug is derived from. Never shown to a customer. */
  name: string;
  /** Both languages, or null for no card at all. See `Promotion.imageUrl`. */
  imageUrl: Localized | null;
  placements: Placement[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;

  kind: PromotionKind;
  value: number;
  minSubtotal: number | null;
  maxDiscount: number | null;
  maxRedemptionsPerUser: number | null;
  maxRedemptionsTotal: number | null;
  isFirstOrderOnly: boolean;

  /**
   * The scope rows to write, replacing whatever is there.
   *
   * `null` means "leave them alone" — the form passes that when it is editing a
   * promotion whose scopes it could not represent. Empty is a real answer and
   * means order-wide: `discount_for_order` treats an unscoped promotion as
   * applying to everything, which is the only reading that is not a silent
   * no-op.
   */
  scopes: Scope[] | null;
};

/**
 * Adds a promotion.
 *
 * `discounts` has no jsonb text column, so `0071`'s slug trigger has nothing to
 * read and the slug is supplied here. That makes this the one place in the
 * dashboard a client generates a key, and the collision is handled by the
 * unique index refusing it rather than by checking first — checking and then
 * inserting is two round trips with a gap, and the gap is where two tabs both
 * decide `ramadan-2026` is free.
 */
export async function createPromotion(
  draft: PromotionDraft,
  priority: number,
): Promise<void> {
  const { data, error } = await getClient()
    .from("discounts")
    .insert({
      slug: slugify(draft.name),
      image_url: draft.imageUrl,
      placements: draft.placements,
      starts_at: draft.startsAt,
      ends_at: draft.endsAt,
      is_active: draft.isActive,
      priority,
      ...moneyColumns(draft),
    })
    .select("id")
    .single();

  if (error) throw new Error(friendly(error.message));

  // An empty list on a create writes nothing and means the same thing — no
  // scope rows is order-wide. `null` is the separate case: leave them alone.
  if (draft.scopes && draft.scopes.length > 0) {
    await writeScopes(data.id as string, draft.scopes);
  }
}

export type PromotionPatch = Partial<Omit<PromotionDraft, "name">> & {
  priority?: number;
};

export async function updatePromotion(
  id: string,
  patch: PromotionPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  // `null` is a value for all of these — no picture, no start, no cap — so what
  // is tested is the key being absent, not the value being falsy.
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.placements !== undefined) row.placements = patch.placements;
  if (patch.startsAt !== undefined) row.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) row.ends_at = patch.endsAt;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.value !== undefined) row.value = valueFor(patch.kind, patch.value);
  if (patch.minSubtotal !== undefined) row.min_subtotal = patch.minSubtotal;
  if (patch.maxDiscount !== undefined) row.max_discount = patch.maxDiscount;
  if (patch.maxRedemptionsPerUser !== undefined) {
    row.max_redemptions_per_user = patch.maxRedemptionsPerUser;
  }
  if (patch.maxRedemptionsTotal !== undefined) {
    row.max_redemptions_total = patch.maxRedemptionsTotal;
  }
  if (patch.isFirstOrderOnly !== undefined) {
    row.is_first_order_only = patch.isFirstOrderOnly;
  }

  // A patch may be scopes only, or a reorder with nothing else — an empty row
  // is a valid update with nothing to write rather than a bug.
  if (Object.keys(row).length > 0) {
    const { error } = await getClient()
      .from("discounts")
      .update(row)
      .eq("id", id);
    if (error) throw new Error(friendly(error.message));
  }

  // After the row, deliberately. A failure here leaves the promotion saved with
  // its old scopes — visible, and fixable. The other order would leave scopes
  // pointing at settings that were never written.
  if (patch.scopes) await writeScopes(id, patch.scopes);
}

/**
 * Puts a promotion's scopes exactly where the form says they should be.
 *
 * ## Why it reads first rather than clearing and re-inserting
 *
 * Clearing first is one request shorter and wrong in a way that only appears on
 * a bad connection: an empty `discount_scopes` means **order-wide**, so a
 * promotion caught between the delete and the insert is not broken — it is
 * briefly applying to *everything*. A 30%-off meant for one shop, live across
 * the whole catalogue, is the most expensive failure this screen can have, and
 * it would be invisible until the day's takings came in.
 *
 * Reading first and writing only the difference makes every failure case a
 * subset of the intent instead: nothing to remove is no request, nothing to add
 * is no request, and a half-applied change is narrower than asked for rather
 * than wider. It is also idempotent, which matters because saving a form twice
 * is something people do.
 *
 * The key is the pair, not the id: `0067` made
 * `(discount_id, scope_type, target_id)` unique with `nulls not distinct`, so
 * two "whole order" rows cannot both exist and a scope is identified by what it
 * says rather than by which row happens to say it.
 */
async function writeScopes(
  discountId: string,
  scopes: readonly Scope[],
): Promise<void> {
  const client = getClient();

  const { data, error } = await client
    .from("discount_scopes")
    .select("id, scope_type, target_id")
    .eq("discount_id", discountId);
  if (error) throw new Error(friendly(error.message));

  const existing = asArray(data).map((row) => ({
    id: row.id as string,
    key: keyOf({
      scopeType: row.scope_type as ScopeType,
      targetId: (row.target_id as string | null) ?? null,
    }),
  }));

  const wanted = new Map(scopes.map((scope) => [keyOf(scope), scope]));
  const held = new Set(existing.map((row) => row.key));

  const removeIds = existing
    .filter((row) => !wanted.has(row.key))
    .map((row) => row.id);
  const added = [...wanted.entries()]
    .filter(([key]) => !held.has(key))
    .map(([, scope]) => scope);

  if (removeIds.length > 0) {
    const { error: removeError } = await client
      .from("discount_scopes")
      .delete()
      .in("id", removeIds);
    if (removeError) throw new Error(friendly(removeError.message));
  }

  if (added.length > 0) {
    const { error: addError } = await client.from("discount_scopes").insert(
      added.map((scope) => ({
        discount_id: discountId,
        scope_type: scope.scopeType,
        target_id: scope.targetId,
      })),
    );
    if (addError) throw new Error(friendly(addError.message));
  }
}

/** What makes two scope rows the same scope — the pair, never the row id. */
function keyOf(scope: Scope): string {
  return `${scope.scopeType}:${scope.targetId ?? ""}`;
}

/** Soft, like every lifecycle table here. `discount_redemptions` points at it. */
export async function archivePromotion(id: string): Promise<void> {
  const { error } = await getClient()
    .from("discounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

export async function setPromotionOrder(
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

// ---------------------------------------------------------------------------
// Scope targets
// ---------------------------------------------------------------------------

export type ScopeTarget = {
  id: string;
  /** Which shop's menu it is on. Absent on rows read without it. */
  storeId?: string;
  label: string;
};

/**
 * Dishes matching a term, within one shop — for the async picker.
 *
 * Async because this is the one unbounded set on the screen. Shops and
 * categories are tens of rows and load whole; dishes are the case that gets
 * worse as the business grows, which is the wrong direction for a control to
 * move in.
 *
 * The shop's name rides along in the label, because "Kibbeh plate" on its own
 * is ambiguous the moment two shops sell one — and choosing the wrong one is a
 * discount applied at the wrong restaurant, which nothing on the screen would
 * afterwards reveal.
 */
export async function searchDishes(
  term: string,
  /**
   * Which shop to look in. Required by the form rather than optional here.
   *
   * Searching every menu in the catalogue was the original behaviour and it is
   * wrong in a way that only shows up on a real catalogue: a dozen shops sell
   * something called "Hummus", so the operator gets a list of near-identical
   * names distinguished only by a shop in grey after them — and picking the
   * wrong one attaches a promotion to another merchant's dish, which nothing
   * downstream would question.
   *
   * Narrowing by shop first turns that into a short list of things that can
   * only mean one dish. It is the same move the options tab makes: a section,
   * then a dish, because forty becomes six before anything is chosen.
   */
  storeId: string,
): Promise<ScopeTarget[]> {
  const cleaned = term.trim();

  let query = getClient()
    .from("menu_items")
    .select("id, name, stores!inner ( name, deleted_at )")
    .eq("store_id", storeId)
    .is("deleted_at", null)
    .is("stores.deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(50);

  if (cleaned) {
    const like = `%${cleaned}%`;
    query = query.or(
      [`name->>en.ilike.${like}`, `name->>ar.ilike.${like}`].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not search dishes: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: dishLabel(row),
  }));
}

/**
 * The dishes behind a set of stored ids.
 *
 * The async picker holds whole options rather than ids, because there is no
 * list to look a label up in — so opening a promotion that is scoped to three
 * dishes has to fetch those three by id or render three blank chips.
 *
 * An id that no longer resolves — a dish archived since — simply does not come
 * back, and the form shows one chip fewer. The scope row is left where it is
 * until the operator saves, at which point they have seen what they are
 * saving.
 */
export async function fetchDishesByIds(
  ids: readonly string[],
): Promise<ScopeTarget[]> {
  if (ids.length === 0) return [];

  const { data, error } = await getClient()
    .from("menu_items")
    .select("id, store_id, name, stores ( name )")
    .in("id", ids as string[]);

  if (error) throw new Error(`Could not read dishes: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    // Carried so the form can reopen on the right shop's menu. Which shop the
    // dishes came from is derivable from the dishes themselves, so it is not
    // stored on the promotion — this is where it is derived.
    storeId: row.store_id as string,
    label: dishLabel(row),
  }));
}

function dishLabel(row: Record<string, unknown>): string {
  const store = asArray(row.stores)[0];
  const dish = pickLocalized((row.name as Localized) ?? {});
  const shop = store ? pickLocalized((store.name as Localized) ?? {}) : "";
  return shop ? `${dish} — ${shop}` : dish;
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * The discount columns, on a create.
 *
 * Split out so `createPromotion` and `updatePromotion` cannot drift on what
 * `value` means for each kind — which is the sort of thing that would be wrong
 * on one path only, and therefore wrong on whichever of the two nobody tested.
 */
function moneyColumns(draft: PromotionDraft): Record<string, unknown> {
  return {
    kind: draft.kind,
    value: valueFor(draft.kind, draft.value),
    min_subtotal: draft.minSubtotal,
    max_discount: draft.maxDiscount,
    max_redemptions_per_user: draft.maxRedemptionsPerUser,
    max_redemptions_total: draft.maxRedemptionsTotal,
    is_first_order_only: draft.isFirstOrderOnly,
  };
}

/**
 * `value`, made safe for the kind it belongs to.
 *
 * `freeDelivery` ignores it — the amount is whatever the delivery fee was — but
 * the column is `not null`, so it is written as zero rather than left at
 * whatever number the operator had typed into a field that has since been
 * hidden. A stale value in an unread column is the kind of thing that becomes a
 * bug the day somebody switches the kind back.
 */
function valueFor(kind: PromotionKind | undefined, value: number): number {
  return kind === "freeDelivery" ? 0 : value;
}

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

function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object")
    return [value as Record<string, unknown>];
  return [];
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
  return slug || `promotion-${Date.now().toString(36)}`;
}

function friendly(message: string): string {
  if (message.includes("window_ordered"))
    return t("promotions.windowBackwards");
  if (message.includes("value_sane")) return t("promotions.valueOutOfRange");
  if (message.includes("caps_positive")) return t("promotions.capsPositive");
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  return message;
}
