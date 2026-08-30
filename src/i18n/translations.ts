/**
 * The dashboard's own strings.
 *
 * ## One language, built to take more
 *
 * The dashboard ships in English. But no screen contains a bare user-facing
 * string — every one reads through `t()`, exactly as the app does in
 * `src/i18n/translations.ts`. Adding a second language is then: add its code to
 * `Locale`, add its object below, and flip the shell to RTL if the script needs
 * it. A file to fill, rather than a sweep through forty components.
 *
 * That discipline is worth nothing if it decays, so an ESLint rule forbids
 * literal text in JSX. The cost of writing `t('orders.confirm')` today is a few
 * seconds; the cost of finding every string later is a week.
 *
 * ## This is not where content lives
 *
 * The distinction the app draws, and the test that settles it: **can a row
 * appear without a release?**
 *
 * - **This file** is chrome — buttons, headings, errors. It ships with the
 *   build, and a typo is caught at build time.
 * - **A `jsonb` column on the row** is content — store names, menu items,
 *   help topics. Those carry every language in one column and are edited *by*
 *   this dashboard, which is what `LocalizedField` is for.
 *
 * So the number of languages here and the number of languages in the
 * `languages` table are unrelated, and neither constrains the other.
 */

export type Locale = "en";

export const DEFAULT_LOCALE: Locale = "en";

const en = {
  common: {
    save: "Save",
    cancel: "Cancel",
    signOut: "Sign out",
    somethingWentWrong: "Something went wrong. Try again.",
    close: "Close",
    undo: "Undo",
    retry: "Try again",
    loading: "Loading",
    copied: "Copied",
  },

  nav: {
    label: "Sections",
    orders: "Orders",
    catalogue: "Catalogue",
    pricing: "Pricing",
    customers: "Customers",
    reports: "Reports",
    settings: "Settings",
    liveOrders: "orders needing attention",
    skipToContent: "Skip to content",
  },

  orders: {
    title: "Orders",
    searchPlaceholder: "Code, name or phone",
    all: "All",
    scopeLive: "Live",
    scopeToday: "Today",
    scopeAll: "All orders",
    // Says what the scope *is*, because "no orders" on a filtered view is
    // ambiguous — it could mean the shop is quiet or the filter is wrong.
    liveEmptyTitle: "Nothing needs you",
    liveEmptyBody:
      "Every order has been delivered or cancelled. New ones appear here the moment they are placed, and the dashboard chimes.",
    todayEmptyTitle: "Nothing today yet",
    todayEmptyBody: "No orders have been placed since midnight.",
    allEmptyTitle: "No orders",
    allEmptyBody: "Nothing has ever been placed.",
    emptyTitle: "Nothing waiting",
    emptyBody:
      "New orders appear here the moment they are placed, and the dashboard chimes. There is nothing to do right now.",
    noMatchTitle: "No orders match",
    noMatchBody:
      "Try the last few characters of the code, or clear the search.",
    failedTitle: "Could not load the queue",
    failedBody: "The connection may have dropped. Nothing has been changed.",
    // Named after the step rather than "Saved", so the toast says what the
    // queue now claims — which is the thing the operator would undo.
    moved: "Moved to {status}",
    arrived: "New order",
    incompleteSignup: "Signup not finished",
    live: "Live",
    keyboardMove: "move",
    keyboardAdvance: "advance",
    keyboardOpen: "receipt",
    keyboardSearch: "search",
    loadMore: "Load older orders",
    panelLabel: "Order detail",
    placed: "Placed",
    customer: "Customer",
    address: "Address",
    courierNote: "Note for the courier: ",
    items: "Items",
    subtotal: "Subtotal",
    delivery: "Delivery",
    discount: "Discount",
    total: "Total",
    payment: "Payment",
    cancel: "Cancel",
    cancelTitle: "Cancel this order?",
    // Terminal, and it reaches a person who is waiting. Says both.
    cancelBody:
      "The customer is told immediately, and this cannot be undone. Nothing else on the order changes.",
    cancelConfirm: "Cancel the order",
    detailFailed: "Could not load this order.",
    noPhone: "No phone number",
    copyPhone: "Copy phone number",
    copyCode: "Copy order code",
    // A multiplication sign, not the letter x — and a translated string rather
    // than a literal, because where the number sits relative to it is not
    // universal.
    quantity: "{count}×",
    locationLabel: "Where {name} is",
  },

  form: {
    optional: "optional",
    // Names the languages rather than saying "incomplete": the operator has
    // done most of the work, and what they need is which box is empty.
    stillNeeded: "Still needed in: {languages}",
  },

  catalogue: {
    title: "Catalogue",
    stores: "Stores",
    searchPlaceholder: "Search shops",
    active: "Live",
    inactive: "Hidden",
    featured: "Featured",
    // Not "no location" — the consequence is what the operator needs to know,
    // and it is money.
    noPin: "No pin — every delivery charged at the top band",
    prep: "{min}–{max} min",
    emptyTitle: "No shops yet",
    emptyBody: "A shop is where a menu lives. Add one to start.",
    noMatchTitle: "No shops match",
    noMatchBody: "Try part of the name, or clear the search.",
    failedTitle: "Could not load the catalogue",
    failedBody: "The connection may have dropped. Nothing has been changed.",
    archived: "Shop archived",
    archiveTitle: "Archive this shop?",
    archiveBody:
      "It disappears from the app immediately. Its orders and menu are kept, and it can be brought back.",
    archiveConfirm: "Archive",
    archive: "Archive",
    truncated:
      "Showing the first 200 shops. Reordering and search still work, but the list is not complete.",
    openMenu: "Menu",
  },

  menu: {
    title: "Menu",
    back: "All shops",
    addItem: "Add an item to {section}",
    name: "Name",
    description: "Description",
    slug: "Slug",
    price: "Price",
    live: "Live",
    hidden: "Hidden",
    save: "Save",
    saveAndAnother: "Save and add another",
    added: "Item added",
    archived: "Item archived",
    archiveTitle: "Archive this item?",
    archiveBody:
      "It disappears from the app immediately. Past orders keep it, and it can be brought back.",
    archiveConfirm: "Archive",
    archive: "Archive",
    itemCount: "{count} items",
    emptyTitle: "No menu yet",
    emptyBody: "Sections hold the items. This shop has none.",
    failedTitle: "Could not load the menu",
    failedBody: "The connection may have dropped. Nothing has been changed.",
    // The slug is derived from the English name until somebody edits it. Saying
    // so stops it looking like a field that ignores what you type.
    slugHint: "Used by imports. Filled in from the name.",
    formLabel: "Item details",
    newItem: "New item",
  },

  map: {
    noPin: "No location saved for this address.",
    openLarger: "Open in Google Maps",
  },

  confirm: {
    signOutTitle: "Sign out?",
    // Says what happens, not "are you sure". A question with no information in
    // it is the kind people learn to dismiss without reading.
    signOutBody:
      "You will stop receiving new-order alerts on this device until you sign back in.",
    signOutConfirm: "Sign out",
  },

  shell: {
    // Every section but the queue is unbuilt. Saying which phase it belongs to
    // is more use than "coming soon", which tells the operator nothing about
    // whether to wait or to go and use the SQL editor.
    notBuiltTitle: "Not built yet",
    notBuiltBody:
      "This section is on the plan, in phase {phase}, and has not been built.",
  },

  login: {
    title: "Sign in",
    subtitle: "Operations for Lebrunji.",
    email: "Email",
    password: "Password",
    rememberMe: "Keep me signed in on this device",
    submit: "Sign in",
    forgot: "Forgotten your password?",
    // Deliberately does not distinguish "no such account" from "wrong
    // password". The pair would tell anyone who asked which email addresses
    // are staff.
    failed: "That email and password do not match.",
    // Rate limiting *is* distinguished, and safely: it says nothing about
    // whether the account exists. Collapsing it into the message above was
    // actively harmful — it told someone who had been throttled that their
    // password was wrong, so they tried again, which extended the throttle.
    tooManyAttempts: "Too many attempts. Wait a minute and try again.",
    offline: "Cannot reach the server. Check your connection.",
  },

  forgotPassword: {
    title: "Reset your password",
    subtitle: "We will email you a link.",
    submit: "Send the link",
    backToLogin: "Back to sign in",
    // Shown whether or not the address exists, so the form cannot be used to
    // find out which addresses are staff.
    sent: "If that address has an account, a reset link is on its way.",
  },

  resetPassword: {
    title: "Choose a new password",
    password: "New password",
    confirm: "Confirm it",
    submit: "Save the password",
    mismatch: "Those two do not match.",
    tooShort: "Use at least 12 characters.",
    // The recovery link is single-use and time-limited, so this is a normal
    // thing to hit rather than an error worth alarming about.
    expired: "That link has expired. Ask for a new one.",
    done: "Saved. You can sign in with it now.",
  },
} as const;

/** Every locale's shape, taken from the one that is complete. */
type Strings = typeof en;

const bundles: Record<Locale, Strings> = { en };

/** Dotted key into the bundle — `login.submit`. */
type Path<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Path<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Path<Strings>;

/** Values substituted into a string's `{placeholders}`. */
export type Params = Record<string, string | number>;

/**
 * Looks a key up, and fills in its placeholders.
 *
 * Returns the key itself when it is missing, rather than an empty string: a
 * screen showing `orders.advnace` is obviously broken, and a screen showing
 * nothing is a bug someone has to hunt for.
 *
 * ## Why interpolation rather than concatenation
 *
 * `t('list.showing') + count + t('list.of')` reads fine in English and is
 * unbuildable in most other languages, where the number does not sit in the
 * same place and the words around it change with it. A placeholder keeps the
 * whole sentence in one string, which is the unit a translator can actually
 * work with — and it is why the lint rule refuses literal text in JSX even for
 * a fragment as small as a bracketed phase number.
 *
 * An unmatched placeholder is left as it is, so a missing parameter shows up as
 * `{phase}` on screen rather than as a blank that nobody notices.
 */
export function t(
  key: TranslationKey,
  params?: Params,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const parts = key.split(".");
  let value: unknown = bundles[locale];
  for (const part of parts) {
    if (typeof value !== "object" || value === null) return key;
    value = (value as Record<string, unknown>)[part];
  }
  if (typeof value !== "string") return key;
  if (!params) return value;

  return value.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
