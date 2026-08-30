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
    moved: "{code} moved to {status}",
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

  /**
   * What a validator says when it refuses.
   *
   * Here rather than inside `validation.ts`, so the rule and the wording are
   * separable: the module decides *what is wrong*, the bundle decides how to
   * say it — and a second language translates these like everything else,
   * instead of finding a class of user-facing text that never went through
   * `t()`.
   */
  validation: {
    required: "This is required.",
    slugRequired: "A slug is required.",
    slugTooLong: "A slug can be at most {max} characters.",
    slugShape: "Use lower-case letters, numbers and single hyphens.",
    tooLongIn: "Too long in {languages} — at most {max} characters.",
    priceRequired: "Enter a price.",
    priceWhole: "A price must be a whole number.",
    priceNegative: "A price cannot be negative.",
    priceHuge: "That price looks wrong — check the number of zeros.",
    dayOfWeek: "Pick a day of the week.",
    timeShape: "Times are HH:MM, 24-hour.",
    hoursSame: "Opening and closing at the same time reads as open all day.",
    wholeMinutes: "Enter whole minutes.",
    prepMin: "At least {min} minute.",
    prepMax: "At most {max} minutes.",
    prepOrder: "The longest time cannot be shorter than the shortest.",
    distanceRequired: "Enter a distance.",
    bandTooSmall: "A band must cover some distance.",
    bandTooBig: "At most {max} km.",
    twoDecimals: "At most two decimal places.",
    bandDuplicate: "There is already a band ending at that distance.",
    valueRequired: "Enter a value.",
    discountNegative: "A discount cannot be negative.",
    percentageOver: "A percentage cannot be over 100.",
    windowReversed: "The promotion would end before it started.",
    imageType: "Images must be JPEG, PNG or WebP.",
    imageTooBig: "Images must be under {max} MB.",
    imageTooSmall: "At least {min}px on each side.",
    imageTooLarge: "At most {max}px on each side.",
    passwordShort:
      "Use at least {min} characters. Length is what makes it hard to guess.",
    passwordLong:
      "At most {max} bytes — anything past that is ignored, not extra.",
    passwordSpace: "Remove the leading or trailing space.",
    passwordEmail: "Do not put your email address in your password.",
    passwordCommon: "That contains a word an attacker would try first.",
  },

  /**
   * What the *database* refuses, said in the operator's words.
   *
   * A constraint violation arrives as English from Postgres. These are the ones
   * worth recognising; anything else falls through to the raw message, which is
   * ugly and true. A wrong-but-friendly translation of an unrecognised error
   * would be worse than an untranslated accurate one.
   */
  dbError: {
    duplicateSlug: "Another item in this shop already uses that name.",
    missingLanguage: "Every language needs a value before this can be saved.",
    priceNegative: "A price cannot be negative.",
    tooLong: "That is longer than the field allows.",
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
    // Named, like every other confirmation: see the note on `menu.added`.
    archived: "{name} archived",

    openTitle: "Open {name} to customers?",
    openBody: "It appears in the app straight away and can take orders.",
    openConfirm: "Open it",
    closeTitle: "Close {name} to customers?",
    closeBody:
      "It disappears from the app straight away and can take no new orders. Orders already placed are not affected.",
    closeConfirm: "Close it",
    featureTitle: "Feature {name}?",
    featureBody: "It is promoted on the app's home screen.",
    featureConfirm: "Feature it",
    unfeatureTitle: "Stop featuring {name}?",
    unfeatureBody:
      "It keeps trading; it just no longer appears in the promoted row on the home screen.",
    unfeatureConfirm: "Stop featuring",
    archiveTitle: "Archive this shop?",
    archiveBody:
      "It disappears from the app immediately. Its orders and menu are kept, and it can be brought back.",
    archiveConfirm: "Archive",
    archive: "Archive",
    truncated:
      "Showing the first 200 shops. Reordering and search still work, but the list is not complete.",
    openMenu: "Menu",
  },

  /**
   * Reordering, which is mostly announcements.
   *
   * A drag says what it is doing by moving things on screen. A keyboard move
   * has to say it out loud, so these are the whole of the feedback for anyone
   * not using a pointer — which is why they name the row and its new position
   * rather than saying "moved".
   */
  /**
   * Uploading a picture.
   *
   * The distinction these draw is the one the sign-in form draws: a refusal the
   * operator can do something about, versus one they cannot. "Not allowed"
   * means this account is not an operator — retrying will not help, and saying
   * so beats leaving them clicking.
   */
  images: {
    label: "Image",
    hint: "Shown in the app beside the name. JPEG, PNG or WebP.",
    choose: "Choose an image",
    drop: "Drop an image here, or",
    browse: "browse",
    paste: "You can also paste one.",
    replace: "Replace",
    remove: "Remove",
    uploading: "Uploading…",
    notSignedIn: "Your session has expired. Sign in again.",
    notAllowed: "This account is not allowed to upload images.",
    failed: "The upload did not finish. Nothing has been changed.",
  },

  /**
   * A shop's own settings, as opposed to what it sells.
   */
  store: {
    tab: "Details",
    name: "Shop name",
    nameHint: "What customers see at the top of the shop.",
    imageHint: "The picture on the shop's card in the app.",
    prepTitle: "Preparation time",
    prepWindow: "Kitchen takes",
    // Says what the number is *for*, which the label cannot: this is the range
    // the app quotes a customer before they order.
    prepHint: "The range the app quotes with the delivery estimate.",
    prepTo: "to",
    minutes: "minutes",
    locationTitle: "Location",
    pin: "Coordinates",
    pinHint:
      "Paste a Google Maps link, or right-click the shop in Maps and paste the coordinates it copies. Leave empty if you do not have it yet.",
    pinInvalid:
      "No location found in that. Paste a Google Maps link, or a pair like 33.8938, 35.5018.",
    // Named rather than lumped in with "invalid", because it has an obvious
    // next step and the operator has plainly pasted a real map link.
    pinShortened:
      "A shortened link does not carry the coordinates. Open it once in a browser and paste the full link it becomes.",
    // The consequence, not the omission. An operator who reads "no pin set"
    // has been told a field is empty; this tells them what it is costing.
    noPinWarning:
      "No pin, so deliveries from this shop are charged at the highest distance band — the app cannot work out how far away a customer is.",
    noPinYet: "No pin yet. Paste the coordinates above to see the shop here.",
    save: "Save changes",
    saved: "{name} saved",
  },

  /**
   * A shop's week.
   *
   * The days are named in full rather than abbreviated: the column is wide
   * enough, and "Tue" saves three characters at the cost of a second's reading
   * on a screen somebody visits twice a year.
   */
  hours: {
    tab: "Hours",
    sunday: "Sunday",
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    open: "Open",
    closed: "Closed",
    closedAllDay: "Closed all day",
    to: "to",
    time: "Time",
    // Named, because a closing time earlier than an opening one looks like a
    // mistake and is not — a kitchen open until two in the morning is ordinary.
    overnight: "Closes after midnight",
    copyToAll: "Give every open day {opens}–{closes}",
    incomplete: "Every open day needs an opening and a closing time.",
    save: "Save hours",
    saved: "Hours saved",
    failedTitle: "Could not load the hours",
    rightNow: "Right now",
    openNow: "Open",
    closedNow: "Closed",
    // The zone is named, because a time on screen is otherwise only an
    // assertion about whose clock it came from.
    beirutTime: "{time} in {zone}",
    theWeek: "The week",
    range: "{from}–{to}",
    unsaved:
      "This is what you are about to save. The app still has the old hours until you do.",
  },

  /**
   * The choices offered with a dish.
   *
   * The vocabulary is deliberately not the database's. A row stores `single` /
   * `multi` and a boolean; an operator checks "choose one, required" against
   * what the shop actually offers, and those are the same fact in the form a
   * person holds it in.
   */
  options: {
    title: "Options",
    hint: "Questions asked when this dish is ordered — a size, extras, something left out.",
    saveFirst: "Save this item first, then choose which options it offers.",
    none: "This shop has no option groups yet.",
    onThisItem: "Offered here",
    notOnThisItem: "Not offered",
    chooseOne: "Choose one",
    chooseAny: "Choose any",
    required: "Required",
    optional: "Optional",
    count: "{count} choices",
    free: "Free",
    addGroup: "New option group",
    groupTitle: "What is being asked",
    groupTitleHint: "The customer reads this above the choices.",
    howMany: "How many can be chosen",
    howManyHint: "A size is one answer; extras are usually several.",
    atMost: "At most",
    atMostHint: "Leave empty for no limit.",
    noLimit: "No limit",
    mustChoose: "Must the customer answer",
    mustChooseHint:
      "Required questions have to be answered before the dish can be added.",
    saveGroup: "Create group",
    optionName: "Choice",
    extraCost: "Adds",
    // Says the unit and that zero is a real answer, which a bare number field
    // cannot.
    extraCostHint: "Added to the item's price. Leave at 0 for a free choice.",
    addOption: "Add choice",
    retire: "Retire",
    retireGroup: "Retire this group",
    retireConfirm: "Retire",
    retireOptionTitle: "Retire {name}?",
    // Says what happens to history, because "delete" on something that appears
    // on past orders is the question an operator actually has.
    retireOptionBody:
      "Customers stop seeing it straight away. Orders that already included it keep it.",
    retireGroupTitle: "Retire {name}?",
    retireGroupBody:
      "It disappears from every dish that offers it, not just this one. Past orders keep what they included.",
    groupAdded: "{name} created",
    groupSaved: "{name} saved",
    groupArchived: "{name} retired",
  },

  reorder: {
    handle: "Reorder {name}",
    instructions:
      "Press Enter or Space to pick up, then arrow up and down to move. Enter or Space to drop, Escape to cancel.",
    grabbed: "{name} picked up. Position {position} of {count}.",
    movedTo: "{name}, position {position} of {count}.",
    dropped: "{name} dropped.",
    cancelled: "Move cancelled.",
    saved: "Order saved",
    failed: "Could not save the new order",
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
    /**
     * Confirmations name what they happened to.
     *
     * "Item archived" is a message about a category of thing. The operator
     * archived one particular item, usually while working down a list of
     * similar ones, and the question they have a second later is *which*.
     * A toast that cannot answer it is a toast they have to verify by
     * looking — at which point it has cost them more than it saved.
     *
     * It matters most when it goes wrong. Archiving the row below the one
     * you meant is an easy slip and an invisible one, and the name in the
     * toast is what catches it while the undo is still on screen.
     */
    added: "{name} added",
    archived: "{name} archived",
    archiveTitle: "Archive this item?",
    archiveBody:
      "It disappears from the app immediately. Past orders keep it, and it can be brought back.",
    archiveConfirm: "Archive",
    archive: "Archive",
    itemCount: "{count} items",
    search: "Search this menu",
    // Says where it looks. An operator who has just scrolled past an item and
    // cannot find it needs to know the search is not limited to what is drawn.
    searchHint:
      "Searches every item and section in this shop, in both languages.",
    searchResults: "{count} matching",
    searchNone: "Nothing in this shop matches {term}.",
    searchClear: "Clear search",
    // Marks a result as a heading rather than a dish. The two sit in one list
    // and a section's name can read exactly like an item's.
    sectionLabel: "Section",
    // Reordering is off while searching, and saying so beats a handle that
    // silently does nothing.
    searchNoDrag: "Clear the search to reorder.",

    // Turning an item on or off. Both directions ask, and they ask different
    // things: one publishes, the other withdraws.
    showTitle: "Show {name} to customers?",
    showBody: "It appears on the shop's menu straight away and can be ordered.",
    showConfirm: "Show it",
    hideTitle: "Hide {name} from customers?",
    hideBody:
      "It disappears from the shop's menu straight away. Orders already placed are not affected, and you can show it again at any time.",
    hideConfirm: "Hide it",

    // Sections. A section is the heading a customer scans before they read any
    // item under it, so what it is called is the menu's structure rather than
    // decoration.
    sections: "Sections",
    addSection: "Add a section",
    sectionTitle: "Section name",
    sectionTitleHint: "What customers see above the items in it.",
    sectionAdded: "{name} added",
    // The new name, not the old one: it is what the operator is looking at
    // in the list, and it confirms the edit landed as typed.
    sectionRenamed: "Renamed to {name}",
    sectionArchived: "{name} archived",
    renameSection: "Rename",
    sectionArchiveTitle: "Archive this section?",
    sectionArchiveBody:
      "It disappears from the app immediately. It can be brought back.",
    // The refusal an operator is most likely to meet, so it says the number and
    // what to do — not that the action was unavailable.
    sectionNotEmpty:
      "This section still holds {count} live item(s). Move or archive them first, or they would disappear from the app without being deleted.",
    sectionEmpty: "No items yet",
    saveSection: "Save",
    emptyTitle: "No menu yet",
    emptyBody: "Sections hold the items. This shop has none.",
    failedTitle: "Could not load the menu",
    failedBody: "The connection may have dropped. Nothing has been changed.",
    // The slug is derived from the English name until somebody edits it. Saying
    // so stops it looking like a field that ignores what you type.
    slugHint: "Used by imports. Filled in from the name.",
    formLabel: "Item details",
    visibility: "Visibility",
    // Every helper says something the field does not already say. A hint that
    // repeats the label is noise, and noise is what teaches people to stop
    // reading them.
    nameHint: "What a customer sees on the menu.",
    descriptionHint:
      "One line under the name. Leave empty if the name says it.",
    priceHint: "In the shop's currency, without separators.",
    liveHint: "Customers can see and order this.",
    hiddenHint: "Kept, but not shown in the app.",
    newItem: "New item",
    // Placeholders are examples, never labels. Each shows what a good answer
    // looks like for a field whose name is already above it.
    namePlaceholder: "Kibbeh plate",
    namePlaceholderAr: "صحن كبة",
    descriptionPlaceholder: "Baked lamb kibbeh, tahini, pickles",
    descriptionPlaceholderAr: "كبة لحم مشوية، طحينة، كبيس",
    pricePlaceholder: "380000",
    slugPlaceholder: "kibbeh-plate",
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
    // Says the rule before it is broken, not after.
    hint: "At least 12 characters. Length matters more than symbols.",
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
