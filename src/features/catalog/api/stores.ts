import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
import { digitsOf } from "@/lib/phone";
import { formatLocalized } from "@/lib/text-format";
import type { Localized } from "@/lib/validation";

/**
 * Stores — the shops a customer browses.
 *
 * As with orders, the shapes here are the dashboard's rather than the
 * database's: column names stay in this file, so a rename is one edit.
 */

export type Store = {
  id: string;
  slug: string;
  name: Localized;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  currencyCode: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  /**
   * Where the shop is.
   *
   * Null until a merchant drops the pin, and that is not cosmetic: with no pin
   * `delivery_quote` cannot work out a distance, and `delivery_fee_for_km`
   * charges an unknown distance at the **top band**. So an unpinned store
   * silently overcharges every customer, which is why the list flags it.
   */
  latitude: number | null;
  longitude: number | null;
  prepMinMinutes: number;
  prepMaxMinutes: number;
  /**
   * Where an order is sent to this kitchen — digits, no `+`, as `wa.me` wants.
   *
   * Null is ordinary: the catalogue is set up before every merchant has been
   * asked for one. It is what makes the dashboard hide the send control for a
   * shop rather than offering one that opens an empty chat.
   */
  whatsappPhone: string | null;
};

/**
 * Every store, in the merchant's own order.
 *
 * **Not paginated, deliberately** — the one list in the dashboard that is not.
 * Two reasons, and both have to hold or this becomes a bug:
 *
 * 1. The order is `sort_order`, which a merchant sets by dragging. Reordering
 *    across a page boundary is not a thing anybody can do, so a paged list
 *    would break the feature it is sorted for.
 * 2. A marketplace has tens of shops, not thousands. `limit` below is not
 *    decoration: it is the assumption, made checkable. If it is ever hit, this
 *    needs a virtualised list and a different reordering gesture — and the
 *    caller is told rather than silently shown a truncated catalogue.
 */
export async function fetchStores(
  options: { search?: string | null } = {},
): Promise<{
  stores: Store[];
  /** True when the cap was reached — see above. The UI says so. */
  truncated: boolean;
}> {
  const limit = 200;

  let query = getClient()
    .from("stores")
    .select(
      `id, slug, name, image_url, category_id, currency_code, is_active, is_featured,
       sort_order, latitude, longitude, prep_min_minutes, prep_max_minutes,
       whatsapp_phone,
       categories ( name )`,
    )
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(limit + 1);

  if (options.search) {
    // `search_text` is the trigram-indexed, normalised name maintained by the
    // trigger from migration 0012 — the same column the app's own store search
    // uses, so the dashboard finds a shop by whatever the customer would type.
    query = query.ilike("search_text", `%${normalise(options.search)}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not read stores: ${error.message}`);

  const rows = data ?? [];
  const truncated = rows.length > limit;

  return {
    stores: rows.slice(0, limit).map(toStore),
    truncated,
  };
}

/** One store, for a screen that is about that store. */
export async function fetchStore(id: string): Promise<Store> {
  const { data, error } = await getClient()
    .from("stores")
    .select(
      `id, slug, name, image_url, category_id, currency_code, is_active, is_featured,
       sort_order, latitude, longitude, prep_min_minutes, prep_max_minutes,
       whatsapp_phone,
       categories ( name )`,
    )
    .eq("id", id)
    .single();

  if (error) throw new Error(`Could not read the shop: ${error.message}`);
  return toStore(data);
}

/*
 * The house style, applied here as well as in the field.
 *
 * Not a duplicate of the form's rule — a second layer under it. `LocalizedField`
 * formats as somebody types, which is the half that makes the rule *visible*;
 * this is the half that makes it *true*. Bulk paste, the wizard, a future
 * import and any screen written next all arrive here, and a rule enforced only
 * by a component is a rule the next component does not have.
 *
 * See `lib/text-format.ts` for what the formats are and why.
 */
const NAME_FORMAT = "upper" as const;

/**
 * The two answers a shop cannot trade without — the same pair, and the same
 * reasoning, as `requireTradeable` in `api/branches.ts`.
 *
 * A shop created by the wizard gets a branch of its own from `0101`'s trigger,
 * so in practice these two rows carry the same number and the same pin on the
 * day a shop is made. Refusing both here means neither can be the one that
 * slipped through: the wizard writes the store, the trigger copies it, and a
 * blank on this row would be a blank on that one.
 */
function requireTradeable(draft: {
  whatsappPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): void {
  if (draft.whatsappPhone !== undefined && !digitsOf(draft.whatsappPhone ?? "")) {
    throw new Error(t("branches.whatsappRequired"));
  }
  if (
    (draft.latitude !== undefined || draft.longitude !== undefined) &&
    (draft.latitude == null || draft.longitude == null)
  ) {
    throw new Error(t("branches.pinRequired"));
  }
}

export type StoreDraft = {
  name: Localized;
  categoryId: string;
  currencyCode: string;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  prepMinMinutes: number;
  prepMaxMinutes: number;
  isActive: boolean;
  /**
   * Where an order is sent to the kitchen. Digits, no `+`, as `wa.me` takes it.
   *
   * The wizard now asks for it, on the step that already covers how an order
   * reaches this kitchen — so the usual case is a shop that arrives with its
   * number rather than one that has to be gone back to.
   *
   * Still optional, and that is not an oversight: a catalogue is often built
   * before every merchant has been asked for a number, and making it required
   * would be a step with no answer. Null is ordinary, and it is what makes the
   * dashboard hide the send control for that shop rather than offering one that
   * opens an empty chat. It can be filled in later on the details tab.
   */
  whatsappPhone?: string | null;
};

/**
 * The country a new shop belongs to.
 *
 * `stores.country_id` is `not null` with no default, so an insert has to supply
 * one — and the wizard deliberately does not ask. `countries` is reference data
 * with one row, added by migration, carrying `is_default` behind the
 * `countries_single_default` partial unique index; asking an operator to pick
 * from a list of one is a step that only ever has one answer.
 *
 * It is read rather than hardcoded, so the day a second country is seeded this
 * becomes a real question in one place instead of a wrong constant in another.
 *
 * **Only the id.** `0001` gave this table `default_currency_code` and
 * `default_language_code`, and `0027` dropped both — so a country no longer
 * carries a currency to seed a shop with, and asking for one here is a request
 * for a column that does not exist. The wizard seeds its currency from
 * `currencies` instead, which is where the answer actually lives.
 */
export async function fetchDefaultCountry(): Promise<{ id: string }> {
  const { data, error } = await getClient()
    .from("countries")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(t("store.noDefaultCountry"));

  return { id: data.id as string };
}

/**
 * Adds a shop, and returns its id so the caller can go straight to its menu.
 *
 * ## What the wizard does not ask for
 *
 * - **`slug`** — `0071`'s trigger derives it from the English name inside the
 *   insert's own transaction, which is the only way to make it unique without
 *   racing another tab.
 * - **`country_id`** — see `fetchDefaultCountry` above.
 * - **`sort_order`** — the end of the list. Where a shop goes is a question the
 *   caller can answer and the database cannot, and "last" is the only answer
 *   that does not silently reorder somebody else's catalogue.
 * - **`is_featured`** — always false. Featuring is a claim made to every
 *   customer on the home screen, and it belongs to the deliberate, confirmed
 *   switch on the list rather than to a checkbox on a creation form somebody is
 *   filling in for the first time.
 *
 * ## It is created hidden by default
 *
 * A shop with no menu, no hours and no pin is not a shop a customer should be
 * able to find. The wizard offers the switch and defaults it off, so going live
 * is something the operator does once the shop is actually set up — rather than
 * something they have to remember to undo.
 */
export async function createStore(
  draft: StoreDraft,
  countryId: string,
  sortOrder: number,
): Promise<string> {
  requireTradeable(draft);

  const { data, error } = await getClient()
    .from("stores")
    .insert({
      // Shops are shouted. See `NAME_FORMAT` below.
      name: formatLocalized(draft.name, NAME_FORMAT),
      category_id: draft.categoryId,
      country_id: countryId,
      currency_code: draft.currencyCode,
      image_url: draft.imageUrl,
      // Both or neither. Half a pin is a row that passes every constraint and
      // means nothing.
      latitude: draft.latitude,
      longitude: draft.longitude,
      whatsapp_phone: draft.whatsappPhone
        ? digitsOf(draft.whatsappPhone)
        : null,
      prep_min_minutes: draft.prepMinMinutes,
      prep_max_minutes: draft.prepMaxMinutes,
      is_active: draft.isActive,
      is_featured: false,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error) throw new Error(friendly(error.message));
  return data.id as string;
}

export type StorePatch = {
  name?: Localized;
  /*
   * No `currencyCode`, and that is the point.
   *
   * It was here briefly, as a plain column write, and it was wrong by a factor
   * of a hundred. Prices are minor units in columns with no currency of their
   * own, so moving the shop moves the meaning of every one of them: `$12.00` is
   * the integer `1200`, and LBP has no decimal places, so the same row reads as
   * `ل.ل1,200` — not the `ل.ل12` the operator meant.
   *
   * Changing it is therefore a rewrite of the whole catalogue, and it belongs
   * in one transaction: see {@link setStoreCurrency}. Migration `0097` also
   * refuses a bare `currency_code` update at the database, so this is not a
   * convention anybody can drift away from.
   */
  /** Blank clears it. See `updateStore` on why that is null and not "". */
  whatsappPhone?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
  prepMinMinutes?: number;
  prepMaxMinutes?: number;
  /**
   * Both together, or neither.
   *
   * Half a pin is not a location — a latitude with no longitude is a row that
   * passes every constraint and means nothing, and `delivery_quote` would treat
   * it exactly as it treats no pin at all, which is to charge the top band. The
   * form clears or sets them as a pair.
   */
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * Changes one store.
 *
 * A direct update rather than an RPC: unlike an order's status, there is no
 * column here that staff must not touch — migration 0063 grants the whole row,
 * and the CHECK constraints from 0066 are the backstop. So the narrower gate an
 * RPC would provide has nothing to narrow.
 */
export async function updateStore(
  id: string,
  patch: StorePatch,
): Promise<void> {
  requireTradeable(patch);

  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = formatLocalized(patch.name, NAME_FORMAT);
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.isFeatured !== undefined) row.is_featured = patch.isFeatured;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  // `null` is a value for these three — it is how a picture or a pin is
  // removed — so what is tested is the key being absent, not the value.
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl;
  if (patch.latitude !== undefined) row.latitude = patch.latitude;
  if (patch.longitude !== undefined) row.longitude = patch.longitude;
  if (patch.whatsappPhone !== undefined) {
    // Normalised on the way in, once, so no screen strips punctuation on the
    // way out — the same rule `couriers.phone` follows. Blank clears it rather
    // than storing an empty string, which the CHECK would refuse anyway.
    const digits = patch.whatsappPhone ? digitsOf(patch.whatsappPhone) : "";
    row.whatsapp_phone = digits || null;
  }
  if (patch.prepMinMinutes !== undefined) {
    row.prep_min_minutes = patch.prepMinMinutes;
  }
  if (patch.prepMaxMinutes !== undefined) {
    row.prep_max_minutes = patch.prepMaxMinutes;
  }

  const { error } = await getClient().from("stores").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

/** What restating a shop's prices is *for* — see {@link setStoreCurrency}. */
export type CurrencyChangeMode = "keep" | "convert";

/**
 * Moves a shop to another currency and restates every live price it has.
 *
 * ## Why this is an RPC and not a column write
 *
 * The column alone would be a lie. `menu_items.price` and `item_options.price`
 * carry no currency, so the shop's row is the only thing that says what they
 * mean — and USD keeps two decimal places where LBP keeps none, so `$12.00`
 * (stored `1200`) becomes `ل.ل1,200` by doing nothing at all. The operator who
 * picked the wrong currency and typed `12` meaning twelve lira gets 1,200.
 *
 * So the prices move with it, and they must all move or none of them: a menu
 * with its dishes restated and its choices not is worse than either currency,
 * and it is exactly what a loop of updates leaves behind on a dropped
 * connection. `api_v1_set_store_currency` (migration 0097) does it in one
 * transaction, and a trigger there refuses the bare column write so this cannot
 * be bypassed by the next person to write a store form.
 *
 * ## The two modes are not variations on each other
 *
 * - `keep` — the digits are already right and only the label was wrong.
 *   `1200` → `12`.
 * - `convert` — the dish must go on being worth what it was worth.
 *   `1200` → `1076400`.
 *
 * They differ by the exchange rate, so there is no sensible default and the
 * caller says which. {@link restatePrice} is the same arithmetic in TypeScript,
 * used to show the operator both outcomes before either happens.
 *
 * Order history is untouched — `orders.currency_code` is a snapshot of what was
 * actually charged, and a receipt that changes later is not a receipt.
 */
export async function setStoreCurrency(
  storeId: string,
  currencyCode: string,
  mode: CurrencyChangeMode,
): Promise<void> {
  const { error } = await getClient().rpc("api_v1_set_store_currency", {
    p_store_id: storeId,
    p_currency_code: currencyCode,
    p_mode: mode,
  });

  if (error) throw new Error(error.message);
}

/**
 * Archives a store.
 *
 * Soft, always. `deleted_at` is what every lifecycle table in this schema uses,
 * and the reason is visible in the data: orders reference stores, so a hard
 * delete would either fail on the foreign key or take the order history with
 * it. Archiving keeps the record of what was sold and removes the shop from the
 * storefront, which is what "delete this store" actually means.
 */
export async function archiveStore(id: string): Promise<void> {
  const { error } = await getClient()
    .from("stores")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

function toStore(row: Record<string, unknown>): Store {
  const category = Array.isArray(row.categories)
    ? row.categories[0]
    : row.categories;

  return {
    id: row.id as string,
    slug: row.slug as string,
    name: (row.name as Localized) ?? {},
    imageUrl: (row.image_url as string | null) ?? null,
    categoryId: row.category_id as string,
    categoryName: pick((category as Record<string, unknown> | null)?.name),
    currencyCode: row.currency_code as string,
    isActive: row.is_active as boolean,
    isFeatured: row.is_featured as boolean,
    sortOrder: row.sort_order as number,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    whatsappPhone: (row.whatsapp_phone as string | null) ?? null,
    prepMinMinutes: row.prep_min_minutes as number,
    prepMaxMinutes: row.prep_max_minutes as number,
  };
}

/** One readable string out of a translated column, for a label. */
function pick(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const candidate of [record.en, ...Object.values(record)]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
}

/**
 * The same normalisation `store_search_text` applies.
 *
 * Lower case and collapsed whitespace — matching what the trigger stored, so a
 * search for "Aurora  Bakery" finds the row it wrote as "aurora bakery".
 */
function normalise(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Turns a constraint violation into a sentence the operator can act on. */
function friendly(message: string): string {
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  if (message.includes("_locales")) return t("dbError.missingLanguage");
  if (message.includes("_len")) return t("dbError.tooLong");
  if (message.includes("prep")) return t("store.prepBackwards");
  return message;
}
