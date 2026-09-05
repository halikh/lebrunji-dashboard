/**
 * Every number that constrains input, declared once.
 *
 * ## This file is a mirror, not the authority
 *
 * The authority is Postgres. `supabase/migrations/0066_input_limits.sql` in the
 * app repo carries a CHECK constraint for each value below, and the constraint
 * is what actually holds — for this dashboard, for an imported spreadsheet, for
 * a hand-written PostgREST request, and for whatever is written next year.
 *
 * That is the rule migration 0045 states and this project follows: **three
 * layers, three jobs.** The form explains *why* — it is the only layer that
 * can. The function decides. The constraint is the backstop under both,
 * describing rows that must not exist whatever wrote them.
 *
 * So why have the numbers here at all? Because a form that submits and *then*
 * reports `violates check constraint "menu_items_name_len"` is a bad form. The
 * point of this file is a good message, not a second gate.
 *
 * ## Two sources of truth are only tolerable when something proves they agree
 *
 * `npm run check:limits` reads the constraints back out of `pg_constraint` on
 * the linked database and fails if any value here disagrees. Change a number
 * here and that check fails until the migration follows, and vice versa. Without
 * it this file would drift within a month and be actively misleading — a form
 * confidently permitting something the database refuses.
 */

/** Text lengths, per locale. A translated column is checked value by value. */
export const TEXT = {
  /** Store, category, item, option — anything with a short display name. */
  name: 80,
  /** `menu_items.description`. */
  description: 500,
  /** `menu_sections.title`, `option_groups.title`. */
  title: 80,
  /**
   * `menu_item_tags.name` — a chip beside a dish's name on a phone.
   *
   * Far shorter than a name, and it has to be: the chip sits *next to* the
   * thing it qualifies, so anything long stops being a label and starts taking
   * the dish's own line. Twenty-four is already wider than most dish names.
   */
  tag: 24,
  /** `order_statuses.name` — appears on a timeline dot. */
  statusName: 40,
  statusTimelineTitle: 80,
  statusTimelineDetail: 200,
  paymentMethodName: 60,
  paymentMethodDetail: 200,
  helpGroupName: 80,
  helpQuestion: 200,
  helpAnswer: 4000,
  policyTitle: 160,
  policyBody: 20000,
  addressKindName: 40,
  languageName: 40,
  countryName: 80,
  /** `users.name` — the customer's own, shown but not edited here. */
  customerName: 60,
  /** `orders.courier_note`, `order_lines.note`, `cart_lines.note`. */
  note: 200,
  slug: 64,
} as const;

/**
 * A slug is typed by hand and appears in no URL a customer sees — but it is the
 * key an import file joins on, so its shape matters more than it looks.
 * Lower case, digits, single hyphens, no leading or trailing hyphen.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Money, in **minor units** — piastres, not pounds. Everything in this schema
 * is `bigint` minor units and nothing is ever a float.
 *
 * The ceiling is not a database constraint; it is a typo guard. There is no
 * legitimate menu item priced at ten million, and the cost of asking "did you
 * mean this?" is far below the cost of it going out on a storefront.
 */
export const MONEY = {
  min: 0,
  /** A fat-finger ceiling for a single item or option, in minor units. */
  maxUnitPrice: 100_000_000,
} as const;

export const SORT_ORDER = { min: 0, max: 32_767 } as const;

/** `stores.prep_min_minutes` / `prep_max_minutes` — they drive the quoted ETA. */
export const PREP_MINUTES = { min: 1, max: 240 } as const;

/**
 * `delivery_rates` is a ladder keyed on `up_to_km`, and **the largest row
 * doubles as the delivery radius** — past it, nothing is deliverable. The
 * column is `numeric(5,2)`, so 999.99 is the true ceiling.
 */
export const DELIVERY = { minKm: 0.01, maxKm: 999.99 } as const;

/** Percentage discounts. A value over 100 pays the customer to order. */
export const DISCOUNT = { minValue: 0, maxPercentage: 100 } as const;

/** `store_hours.day_of_week`, Sunday-first, matching `extract(dow …)`. */
export const DAY_OF_WEEK = { min: 0, max: 6 } as const;

/**
 * Images. Checked in the browser before upload rather than after, because the
 * alternative is an operator watching a four-megabyte photograph upload and
 * then being told it was too big.
 */
export const IMAGE = {
  maxBytes: 5 * 1024 * 1024,
  minPixels: 200,
  maxPixels: 4000,
  /** Decided from magic bytes, never from the browser's claimed MIME type. */
  types: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

/**
 * The new-order sound.
 *
 * ## Why a megabyte and not five
 *
 * This plays when an order arrives, on a dashboard that may have been open for
 * hours — so it is fetched once and held. A chime is a second or two of audio;
 * an MP3 of that is tens of kilobytes, and anything approaching a megabyte is
 * somebody uploading a song by mistake. The cap is generous enough not to
 * refuse a real chime and small enough that the mistake is caught here rather
 * than by an operator wondering why the tab is using 40 MB.
 *
 * ## And why seconds are capped too
 *
 * A three-minute file would play over the next four orders. The check is on
 * *duration*, decoded in the browser before anything is sent, because a short
 * file and a long one can be the same size — bitrate decides — so a byte limit
 * alone would let a long quiet recording through.
 */
export const SOUND = {
  maxBytes: 1024 * 1024,
  maxSeconds: 8,
  /** Decided from magic bytes, never from the browser's claimed MIME type. */
  types: ["audio/mpeg"] as const,
} as const;

export const PAGE = {
  /** Rows per page in a list. */
  size: 50,
  /** A hand-edited `?page=` beyond this is refused rather than scanned. */
  maxRows: 50 * 40,
} as const;

export const SEARCH = { minTerm: 2, maxTerm: 64 } as const;

/**
 * The operator's password.
 *
 * Unlike everything else in this file, there is no CHECK constraint behind
 * this — a password never reaches a table. The enforcing copy lives in the
 * Supabase project's password policy (Authentication → Policies), because that
 * is the layer the auth endpoint actually goes through, and the auth endpoint
 * is reachable without this app. What is here is the layer that can *explain*.
 *
 * Set the project policy to match these numbers, or the two will disagree and
 * the operator will be refused by the server after passing the form.
 *
 * ## Length, not character classes
 *
 * No "must contain a symbol" rule. Composition rules are the classic example of
 * a policy that measurably makes passwords worse: they push people to
 * `Password1!` — which satisfies every class and is guessed instantly — and
 * they refuse long passphrases that are far stronger. Length is what actually
 * costs an attacker, so length is what is asked for.
 *
 * `max` exists because bcrypt silently truncates past 72 bytes; refusing is
 * better than accepting a password whose tail does nothing.
 */
export const PASSWORD = { min: 12, max: 72 } as const;
