import { PAGE } from "@/lib/limits";
import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
import { digitsOf } from "@/lib/phone";
import { formatLocalized } from "@/lib/text-format";
import type { Localized } from "@/lib/validation";

import { createBranch } from "./branches";

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
  /**
   * Where the shop sits on the **customer's** home screen.
   *
   * The app reads it — `fetchStores` there ends `.order('sort_order')` — so
   * it is a merchandising decision, and nothing in this dashboard writes it.
   */
  sortOrder: number;
  /**
   * Where the shop sits in **this list**, and nowhere else — `0118`.
   *
   * A second order, because the two wants are genuinely different and one
   * column cannot hold both: dragging a shop to the top of the dashboard to
   * work on it would move it to the top of every customer's home screen.
   *
   * Zero on every row until the first drag, which is a tie broken by the
   * secondary key below.
   */
  adminSortOrder: number;
  /**
   * This shop’s own rate for the non-base currency — `0120`.
   *
   * Null is the ordinary case and means the platform’s rate, the one on the
   * Pricing screen. A number here is lira-per-dollar as *this shop* quotes it,
   * which two shops on the same street genuinely disagree about.
   *
   * **Display only.** A shop’s menu is already stored in the shop’s own
   * currency and `place_order` charges those figures directly, so nothing
   * billed is converted with this. What reads it is the app, when it writes a
   * price in the second currency for a customer to read. `0120` says why the
   * delivery ladder and fixed-amount discounts deliberately stay on the
   * platform’s rate.
   */
  exchangeRate: number | null;
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
  /**
   * The number an order actually reaches — the branch's, falling back to this
   * row's own.
   *
   * ## Why it is resolved in the query
   *
   * `0101` moved the number to `branches`, and the branch editor is the only
   * screen that writes one, so `whatsappPhone` above is null on every shop
   * created since. A header reading it said "No WhatsApp number" about a shop
   * whose number was on screen two tabs away.
   *
   * The first fix read the Branches tab from the shop's header — which made
   * every tab pay for a query only one of them is about, the exact shape this
   * catalogue is being moved away from. So it is an embed instead: one round
   * trip, on the query the header was already making.
   *
   * The *first* branch with a number, in the Branches tab's own order, so the
   * header and that tab name the same place. Null when no branch has one and
   * neither has the shop — which is a real state, and the one the list flags.
   */
  orderPhone: string | null;
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
/** The shops, and whether the cap above cut them short. */
export type StorePage = {
  stores: Store[];
  /** True when the cap was reached — see above. The UI says so. */
  truncated: boolean;
};

export async function fetchStores(
  options: { search?: string | null } = {},
): Promise<StorePage> {
  // `PAGE.cap` — the shared number, and the shared argument. This function is
  // where it was first written down; the categories, tags, branches and menu
  // reads all point back here.
  const limit = PAGE.cap;

  let query = getClient()
    .from("stores")
    .select(
      `id, slug, name, image_url, category_id, currency_code, is_active, is_featured,
       sort_order, admin_sort_order, exchange_rate,
       latitude, longitude, prep_min_minutes, prep_max_minutes,
       whatsapp_phone,
       categories ( name ),
       branches ( whatsapp_phone, sort_order, created_at, deleted_at )`,
    )
    .is("deleted_at", null)
    // `0118`'s column, not the app's. An operator dragging a row here is
    // putting the shop they are working on where they can find it; the
    // customer's order is a different decision and stays where it was.
    .order("admin_sort_order", { ascending: true })
    // The tiebreak, and it does real work: every row is zero until the first
    // drag, so without it the whole catalogue would come back in whatever
    // order the planner chose — and a list that reshuffles between visits is
    // one nobody can find anything in twice.
    .order("id", { ascending: true })
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
       sort_order, admin_sort_order, exchange_rate,
       latitude, longitude, prep_min_minutes, prep_max_minutes,
       whatsapp_phone,
       categories ( name ),
       branches ( whatsapp_phone, sort_order, created_at, deleted_at )`,
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
 * A shop created here gets a branch of its own from `0121`'s trigger, copied
 * from these very columns, so the two rows carry the same number and the same
 * pin on the day a shop is made. Refusing both here means neither can be the
 * one that slipped through: the form writes the store, the trigger copies it,
 * and a blank on this row would be a blank on that one.
 */
function requireTradeable(draft: {
  whatsappPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): void {
  if (
    draft.whatsappPhone !== undefined &&
    !digitsOf(draft.whatsappPhone ?? "")
  ) {
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
   * Whether the shop leads the home screen.
   *
   * The form asks now. It used to be hard-coded false here on the argument that
   * featuring is a claim made to every customer and belongs to the confirmed
   * switch on the shops list — which is a good argument about the *default* and
   * a bad one about the field existing at all. An operator adding a shop they
   * have just agreed a promotion for should not have to add it, leave, find it
   * in the list and flick a second switch.
   *
   * It still defaults to off, and it is still beside Visibility, which also
   * defaults to off: a shop with no menu, no hours and no pin is not one to put
   * at the top of the home screen.
   */
  isFeatured: boolean;
  /**
   * This shop's own rate for the non-base currency — `0120`.
   *
   * Null is the ordinary case and means the platform's, which is what a shop
   * added without a word about rates should follow. The form asks anyway: a
   * shop is usually signed up in the same conversation that settles what its
   * dollar is worth, and making that a second visit to a second screen is how
   * it gets forgotten.
   */
  exchangeRate: number | null;
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
 * `is_featured` is no longer among them: the form asks, and defaults it off.
 * See `StoreDraft.isFeatured` for why it stopped being hard-coded.
 *
 * ## It is created hidden, and unfeatured, by default
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
      is_featured: draft.isFeatured,
      exchange_rate: draft.exchangeRate,
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error) throw new Error(friendly(error.message));

  const id = data.id as string;
  await ensureFirstBranch(id, draft);
  return id;
}

/**
 * The branch a new shop cannot trade without, if the database has not already
 * made it.
 *
 * ## Why this exists at all
 *
 * `0121` puts a trigger on `stores` that writes the first branch in the same
 * transaction as the shop, which is where the rule belongs: a branch is what
 * makes a shop orderable, and an invariant that only holds when one client
 * remembers to write two rows is not an invariant.
 *
 * This is the belt to that pair of braces, and it is here because of what
 * happened without it. `0101` split the brand from the place and backfilled a
 * branch for every shop that existed **at the time**, with a plain insert that
 * ran once. Nothing kept it true afterwards, and nothing noticed for twenty
 * migrations: every shop created since came up with an empty Branches tab, no
 * hours to set, and no branch for `api_v1_branch_menu` to quote from.
 *
 * So the check is cheap and it is made where the mistake was made. If the
 * trigger is there — the ordinary case, and the only case on a database that is
 * up to date — this is one `select` returning one row and nothing else happens.
 *
 * ## Why a failure here is not the create failing
 *
 * The shop is already written. Throwing would report a failure for something
 * that in fact succeeded, and the obvious response to that is to fill the form
 * in again — which makes a second shop. A shop with no branch is recoverable in
 * a way a duplicate is not: the Branches tab is on screen, empty, with a New
 * branch button on it.
 */
async function ensureFirstBranch(
  storeId: string,
  draft: StoreDraft,
): Promise<void> {
  try {
    const { data, error } = await getClient()
      .from("branches")
      .select("id")
      .eq("store_id", storeId)
      .is("deleted_at", null)
      .limit(1);

    if (error || (data && data.length > 0)) return;

    await createBranch(
      storeId,
      {
        // The shop's own name, as `0101` and `0121` both copy it. Renaming it
        // to "Hamra" is the operator's first job on a shop that turns out to be
        // a chain.
        name: draft.name,
        latitude: draft.latitude,
        longitude: draft.longitude,
        prepMinMinutes: draft.prepMinMinutes,
        prepMaxMinutes: draft.prepMaxMinutes,
        // `?? null` because the store's own is optional and a branch's is not
        // a `string | undefined`. `createBranch` refuses an empty one anyway —
        // the form asks for it, so this is a type gap rather than a real state.
        whatsappPhone: draft.whatsappPhone ?? null,
        // Null on both, which is the live reference to the shop's rather than a
        // copy of them — see the note on `Branch`. A copy made here would be a
        // branch that stopped following the brand before anybody had opened it.
        imageUrl: null,
        currencyCode: null,
        isActive: draft.isActive,
      },
      0,
    );
  } catch {
    // Deliberately swallowed — see the note above.
  }
}

export type StorePatch = {
  name?: Localized;
  /**
   * What kind of shop this is — `categories.id`.
   *
   * Editable, unlike the currency below. It was settable only in the wizard,
   * which meant a shop filed under the wrong category on the day it was created
   * stayed there: the only fix was to delete it and add it again, losing the
   * menu with it. Nothing is denominated in a category, so moving one is a
   * column write like the name.
   */
  categoryId?: string;
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
  /**
   * Null is a value here — it is how a shop is put back on the platform’s
   * rate — so the check below is for the key being absent, not the value being
   * falsy.
   */
  exchangeRate?: number | null;
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
  if (patch.name !== undefined)
    row.name = formatLocalized(patch.name, NAME_FORMAT);
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.isFeatured !== undefined) row.is_featured = patch.isFeatured;
  if (patch.exchangeRate !== undefined) {
    row.exchange_rate = patch.exchangeRate;
  }
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
    adminSortOrder: (row.admin_sort_order as number | null) ?? 0,
    // `numeric` arrives as a string from PostgREST — exact there, and parsed
    // once here so no screen compares "95000" to 95000.
    exchangeRate:
      row.exchange_rate == null ? null : Number(row.exchange_rate),
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    whatsappPhone: (row.whatsapp_phone as string | null) ?? null,
    orderPhone: orderPhone(row),
    prepMinMinutes: row.prep_min_minutes as number,
    prepMaxMinutes: row.prep_max_minutes as number,
  };
}

/**
 * The number orders reach — see `Store.orderPhone`.
 *
 * ## The ordering is the Branches tab's, restated
 *
 * `sort_order` then `created_at`, because an embed comes back in whatever order
 * PostgREST felt like and "the first branch" has to mean the same thing on both
 * screens. A header naming a different place from the tab below it is worse
 * than one naming none.
 *
 * ## The archived are skipped, not filtered in the query
 *
 * A `deleted_at` filter on an *embedded* table removes the child rather than
 * the parent, so a shop whose only branch was archived would come back looking
 * like a shop with no branches at all — the same trap `fetchMenu` documents.
 * Asked for and dropped here instead.
 */
function orderPhone(row: Record<string, unknown>): string | null {
  const branches = Array.isArray(row.branches)
    ? (row.branches as Record<string, unknown>[])
    : row.branches
      ? [row.branches as Record<string, unknown>]
      : [];

  const live = branches
    .filter((one) => one.deleted_at == null)
    .sort((a, b) => {
      const order = Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      if (order !== 0) return order;
      return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
    });

  const fromBranch = live.find(
    (one) => typeof one.whatsapp_phone === "string" && one.whatsapp_phone,
  );

  return (
    (fromBranch?.whatsapp_phone as string | undefined) ??
    (row.whatsapp_phone as string | null) ??
    null
  );
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

/**
 * Writes a new position to each shop that moved.
 *
 * ## Why `admin_sort_order` and not `sort_order`
 *
 * Because they answer different questions. `sort_order` decides what a customer
 * sees first on the home screen — a merchandising decision the app reads and
 * nothing here writes. This one decides where a row sits in *this* list, which
 * is an operator putting the shop they are working on where they can find it.
 *
 * Migration `0118` added the second column for exactly this: one column would
 * mean dragging a row up here to work on it also moved it to the top of every
 * customer's home screen.
 *
 * ## Several requests rather than one
 *
 * The same trade `setMenuOrder` documents. There is no bulk update in
 * PostgREST that sets a *different* value per row, and the alternatives are a
 * stored procedure or an upsert that would have to carry every other column of
 * every row — which is how a reorder silently reverts a name somebody changed
 * in another tab. Only the rows whose position actually changed are sent, so a
 * drag of one row into the row above it is two requests, not forty.
 *
 * They are not atomic, and that is survivable here in a way it would not be for
 * money: a half-applied reorder is a list in a slightly odd order, which the
 * next drag fixes. The optimistic update is rolled back on the first failure so
 * the screen does not claim an order the database refused.
 */
export async function setStoreOrder(
  updates: { id: string; sortOrder: number }[],
): Promise<void> {
  if (updates.length === 0) return;

  const client = getClient();
  const results = await Promise.all(
    updates.map(({ id, sortOrder }) =>
      client
        .from("stores")
        .update({ admin_sort_order: sortOrder })
        .eq("id", id),
    ),
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) throw new Error(friendly(failure.error.message));
}

/** Turns a constraint violation into a sentence the operator can act on. */
function friendly(message: string): string {
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  if (message.includes("_locales")) return t("dbError.missingLanguage");
  if (message.includes("_len")) return t("dbError.tooLong");
  if (message.includes("prep")) return t("store.prepBackwards");
  return message;
}
