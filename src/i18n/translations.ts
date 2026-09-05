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
    drivers: "Drivers",
    reports: "Reports",
    settings: "Settings",
    account: "Your account",
    liveOrders: "orders needing attention",
    skipToContent: "Skip to content",
  },

  customers: {
    title: "Customers",
    search: "Search by name or phone number",
    failedTitle: "Could not load the customers",

    // The filter tabs. "Not active" covers two very different situations, and
    // collapsing them would hide the one that is reversible.
    tabAll: "All",
    tabActive: "Active",
    tabSuspended: "Suspended",
    tabClosed: "Closed",

    backToList: "All customers",
    // `{code}` is empty when the code did not survive the trip — the link still
    // says where it goes, which is more than a blank would.
    backToOrder: "Order {code}",
    tabOverview: "Overview",
    statsFailed: "Could not total their orders.",
    ordersFailed: "Could not load their orders.",
    promotionsFailed: "Could not load their promotions.",

    promotions: "Promotions used",
    noPromotions: "No promotion has ever come off one of their orders.",
    savedTotal: "Saved in total",
    // A redemption predating 0016's `label` column, or one written without
    // one. Naming it beats a blank row, which reads as a rendering fault.
    unnamedPromotion: "Unnamed promotion",

    summary: "Summary",
    tileOrders: "Orders",
    tileSpent: "Spent ({code})",
    tileSaved: "Saved ({code})",

    chartMonths: "Orders by month",
    chartMonthsMoney: "Spend by month ({code})",
    chartMonthsAria:
      "The last twelve months, oldest first. A flat bar is a month with no orders.",
    chartMonthTitle: "{month}: {orders} order(s)",
    chartMonthTitleMoney: "{month}: {orders} order(s), {amount}",
    chartWeekdays: "When they order",
    chartWeekdaysAria: "Orders per day of the week, in Beirut time.",
    tileFirst: "First order",
    tileLast: "Last order",
    never: "Never",
    // The cap is the assumption, made visible: quietly under-reporting a
    // lifetime figure is worse than saying it is a floor.
    statsTruncated:
      "This customer has more orders than these figures cover, so the totals are a minimum.",

    // `users.name = ''` is how the schema records "signed in, never finished
    // setup". Naming it makes it a status; a blank makes the row look broken.
    incomplete: "Signup not finished",

    joined: "Joined {when}",
    orderCount: "{count} order(s)",
    noOrders: "No orders yet",
    activeLabel: "Active",
    suspendedLabel: "Suspended",
    closedLabel: "Closed",

    emptyTitle: "No customers yet",
    emptyBody: "They appear here the first time somebody signs in on the app.",
    noneTitle: "Nobody matches that",
    noneBody: "Try part of the name, or the last few digits of the number.",

    contact: "Contact",
    copyPhone: "Copy phone number",
    addresses: "Addresses",
    noAddresses: "No addresses saved.",
    unlabelled: "Address",
    defaultAddress: "Default",
    // What the map draws when there is no pin, and the warning beside it. Two
    // strings because they say different things: one is the empty frame, the
    // other is the consequence.
    noPin: "No pin saved for this address",
    noPinWarning:
      "With no pin, delivery here is charged at the top band — the fee is an overcharge, not an estimate.",

    preferences: "Preferences",
    // In the header, where they qualify the account rather than being a
    // section somebody navigates to. Labelled inline, because two bare values
    // side by side would not say which is which.
    prefLanguage: "Reads the app in {value}",
    prefCurrency: "Prices shown in {value}",
    language: "Language",
    currency: "Currency",
    notSet: "Not set",
    // Null is a real answer, not a missing one — 0028 says so explicitly.
    shopsOwn: "Each shop's own",

    orders: "Orders",
    moreOrders:
      "Showing {shown} of {total}. The rest are on the orders screen.",

    suspend: "Suspend",
    suspendTitle: "Suspend {name}?",
    suspendBody:
      "They are signed out on every device and cannot sign back in until you lift it. Their account, orders and addresses are all kept.",
    suspendConfirm: "Suspend",
    suspended: "{name} suspended",

    reinstate: "Lift suspension",
    reinstateTitle: "Let {name} back in?",
    reinstateBody:
      "They can sign in again from the app. They are not signed in automatically — reopening the door is not walking them through it.",
    reinstateConfirm: "Lift it",
    reinstated: "{name} can sign in again",

    close: "Close account",
    closeTitle: "Close {name}'s account for good?",
    // The asymmetry is the whole reason this is separate from suspension, so
    // the dialog leads with it.
    closeBody:
      "This cannot be undone. {phone} is released, so if they sign up again they get a brand new account rather than this one back. Their past orders are kept, because an order is a financial record.",
    closeConfirm: "Close the account",
    closed: "{name}'s account is closed",
    closedNote:
      "This account was closed on {when}. The phone number has been released and it cannot be reopened.",

    // Refusals from the RPCs, as sentences.
    notPermitted: "Your account is not allowed to do that.",
    alreadyClosed:
      "That account has been closed. A closed account cannot be reopened.",
    gone: "That customer no longer exists.",
    isOperator:
      "That account belongs to an operator, so it cannot be closed from here.",
  },

  /**
   * Handing an order to a driver, over WhatsApp.
   *
   * These are the only strings in the product that leave it — they are read on
   * somebody else's phone, in a chat, by a person who has never seen the
   * dashboard. So they say the whole thing rather than relying on a column
   * heading: "Collect $12.40", not "Total".
   */
  dispatch: {
    // The button on the receipt, and the dialog it opens.
    open: "Notify",
    title: "Send {code}",
    blurb:
      "Opens WhatsApp with the order written out. Check the number before you send it.",
    send: "Send",
    opensWhatsApp:
      "Opens in WhatsApp. Nothing is sent until you press send there.",
    noDrivers: "No driver on the books yet.",
    addDriver: "Add one",

    heading: "New delivery — {code}",
    placed: "Ordered {when}",
    customer: "Customer: {name}",
    phone: "Phone: {phone}",
    address: "Address: {address}",
    map: "Map: {url}",
    note: "Note for you: {note}",
    from: "From {store}:",
    lineNote: "note: {note}",
    subtotal: "Items: {amount}",
    delivery: "Delivery: {amount}",
    discount: "Discount: -{amount}",
    // Cash on delivery is the only payment method, so the total *is* what the
    // driver collects. Saying "total" would leave them to work that out.
    collect: "Collect on delivery: {amount}",
    // The rate had not loaded, so no figure here would be trustworthy. Better
    // to say so than to send a number that might be wrong by a hundredfold.
    amountUnknown: "Amount: see the dashboard.",

    /*
     * The kitchen's ticket. Shorter than the driver's on purpose — see
     * `kitchenMessage`. No address, no phone, no money: a shop cooking one half
     * of an order has no reason to hold a customer record, and a total they
     * cannot collect is a number they might act on.
     */
    kitchenHeading: "New order — {code}",
    kitchenFor: "For: {name}",
    kitchenFooter: "Sent to {store}. Reply here if anything is unavailable.",
    kitchenSend: "Send",
    kitchenTitle: "Send {code} to the kitchen",
    kitchenBlurb:
      "Each shop gets only its own items. No address, no phone number and no total — the driver carries those.",
    kitchenNoNumber: "No WhatsApp number for this shop.",
    kitchenAddNumber: "Add one",
    kitchenTab: "Shops",
    driverTab: "Driver",
  },

  drivers: {
    title: "Drivers",
    blurb:
      "Who an order can be handed to. They never see the dashboard — the details go to them on WhatsApp.",
    search: "Search by name or number",
    tabAll: "All",
    // The wizard.
    stepDetails: "Who they are",
    stepHours: "When they work",
    next: "Next",
    back: "Back",
    finish: "Add driver",

    // The week. Whether somebody is taking orders is read from it rather than
    // switched by hand — see migration 0084.
    working: "Working",
    dayOff: "Day off",
    onShift: "Taking orders",
    offShift: "Off shift",
    // Shown only while an override is in force. Without it, an exception made
    // for one evening quietly becomes this driver's permanent state.
    followRota: "Back to their hours",
    overrideOn: "Taking orders tonight, outside their hours.",
    overrideOff: "Not taking orders tonight, inside their hours.",
    noWeek:
      "No working days set, so this driver is never offered for an order.",
    hoursTitle: "When they work",
    hoursSaved: "Hours saved",
    saveHours: "Save hours",
    discardHours: "Discard changes",

    // The profile.
    tabOverview: "Overview",
    tabShift: "Shift",

    tabActive: "Taking orders",
    tabOff: "Off shift",
    searchNone: "Nothing matches {term}",

    // The profile.
    edit: "Edit",
    copyPhone: "Copy the driver’s number",
    notFound: "No such driver.",
    backToList: "All drivers",
    profileHandovers: "Orders handed over",
    profileNone: "Nothing handed to them yet.",
    // Said plainly, because the screen would otherwise be read as a delivery
    // record. WhatsApp tells the dashboard nothing back — see migration 0083.
    profileCaveat:
      "This is when the chat was opened, not when the order arrived. The status is what says that.",
    handedAt: "Handed over {when}",
    statToday: "Today",
    statPerDay: "Average a day",
    statPerWeek: "Average a week",
    // The denominator, said out loud. An average over four days is a different
    // claim from one over four months.
    overDays: "over {count} days",
    statTotal: "Orders",
    statThisWeek: "This week",
    add: "New driver",
    name: "Name",
    namePlaceholder: "Ali",
    phone: "WhatsApp number",
    // The national part only — the +961 is drawn in the field, not typed into
    // it. No leading zero, because the trunk prefix is not part of the number
    // the code is joined onto.
    phonePlaceholder: "70123456",
    phoneHint: "The number the order is sent to.",
    active: "Taking orders",
    saved: "{name} saved",
    added: "{name} added",
    tabInactive: "Not active",
    inactive: "Not active",
    deactivate: "Deactivate",
    reactivate: "Bring back",
    deactivated: "{name} is no longer active",
    reactivated: "{name} is active again",
    // Says what actually happens, including the part that is not a deletion —
    // the history is the reason there is no delete here at all.
    deactivateTitle: "Deactivate {name}?",
    deactivateBody:
      "They stop being offered on orders. Nothing is deleted: the orders they carried keep their name, and their number is kept so bringing them back is one click.",
    deactivateConfirm: "Deactivate driver",
    archiveTitle: "Archive {name}?",
    archiveBody:
      "They stop appearing on orders. Their number is kept, so switching them back on later does not mean typing it again.",
    archiveConfirm: "Archive driver",
    duplicatePhone: "That number already belongs to another driver.",
    // No longer "with a country code": the code is not theirs to get wrong any
    // more, so the message is about the part they did type.
    badPhone: "That is not a full Lebanese number.",
    empty: "No drivers yet.",
  },

  /**
   * Changing an order the kitchen cannot fill as placed.
   *
   * The vocabulary is deliberately about *what is coming*, not about deleting.
   * An operator on the phone says "we can only send two" — not "I am removing a
   * unit" — and the screen should use the sentence they are already speaking.
   */
  amend: {
    open: "Something missing?",
    title: "Change {code}",
    blurb:
      "Ring the customer first. What you record here is what they agreed to — the order keeps its place and its delivery.",
    coming: "Coming",
    ordered: "of {count} ordered",
    instead: "Instead send",
    nothing: "Nothing",
    // Marked on the group rather than enforced here: the operator is reading
    // the questions down a phone, and a form that refused to save until every
    // required one was answered would stop them mid-call.
    optionRequired: "required",
    note: "What happened",
    noteHint:
      "For whoever reads this order next. The customer does not see it.",
    notePlaceholder: "Called Rana — no kibbeh left, took the sfiha instead",
    newTotal: "New total",
    // Said before it is committed, because it is the surprising part: the
    // customer's order shrank and their delivery fee did not.
    feesStand: "Delivery and any discount stay as they were.",
    confirm: "Save the change",
    done: "{code} updated",

    // On the receipt, once it has happened.
    changed: "Changed after ordering",
    outOfStock: "Out of stock — not coming",
    short: "Only {count} available",
    replacedBy: "Replaced",
    substituteFor: "Instead of {name}",
  },

  /**
   * What happened to an order after it was placed.
   *
   * Read rarely, and almost always because something has gone wrong — so the
   * wording is factual rather than reassuring. Somebody on this tab is
   * reconstructing events for a customer who is disputing them.
   */
  history: {
    tabDetails: "Details",
    // "Activity", not "Change history": it carries hand-overs as well as
    // amendments, and a name that only covers half of what is on a screen is
    // the reason somebody does not look there for the other half.
    tabHistory: "Activity",
    open: "Activity",
    amended: "Order changed",
    handedTo: "Handed to",
    // The same limit the driver's page states. WhatsApp tells the dashboard
    // nothing back — see migration 0083.
    caveat: "This is when the chat was opened, not when it arrived.",
    nothing: "Nothing has happened to this order since it was placed.",
  },

  /**
   * The settings that belong to the business rather than to a row.
   *
   * Each one says its *consequence*, not just its name. Moving the opening hour
   * moves what "today" means on the queue and in every report, and a label
   * reading "Opens at" alone would hide that behind a dropdown that looks like
   * a preference.
   */
  general: {
    tab: "General",
    saved: "Saved",

    clockTitle: "Times",
    clockLabel: "Clock",
    clockHint:
      "How times read across the dashboard and the app. Both show the same thing, so a total read down the phone matches the customer's screen.",
    clock24: "22:00",
    clock12: "10:00 PM",

    shiftTitle: "When you take orders",
    // The consequence, before the control rather than after it.
    shiftBlurb:
      "The opening hour is also where a day begins. “Today” on the queue and every day in the reports run from it — so a night that ends at 02:00 counts as one day’s trade rather than two half-nights.",
    opensAt: "Opens at",
    closesAt: "Closes at",
    saveShift: "Save hours",
    // Not a mistake to correct: a shop open past midnight is the ordinary case.
    overnight: "Open overnight, {open} to {close} the next day.",

    soundTitle: "New order sound",
    soundBlurb:
      "Plays when an order arrives, wherever you are in the dashboard.",
    soundChoose: "Choose an MP3",
    soundReplace: "Replace",
    soundPlay: "Play it",
    soundClear: "Use the built-in one",
    soundCustom: "Using your own sound",
    soundBuiltIn: "Using the built-in chime",
    soundLimits: "MP3, under {size} KB and {seconds} seconds",
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
    keyboardUndo: "undo the last move",
    keyboardSearch: "search",
    loadMore: "Load older orders",
    openPage: "Open the full page",
    backToQueue: "All orders",
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
    phone: "That is not a full Lebanese number.",
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
    // The sound. Says the shape of the answer, not just that the answer was
    // wrong: "an MP3" and "under 8 seconds" are both things somebody can act on.
    soundType: "That is not an MP3.",
    soundTooBig: "Sounds must be under {max} KB.",
    soundTooLong: "Sounds must be under {max} seconds.",
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
    // The signed URL outlived its fifteen minutes, or was altered on the way.
    // Both are fixed by asking for another one, which is what choosing the
    // file again does.
    linkExpired: "That upload link expired. Choose the file again.",
    notAllowed: "This account is not allowed to upload images.",
    failed: "The upload did not finish. Nothing has been changed.",
  },

  /**
   * A shop's own settings, as opposed to what it sells.
   */
  store: {
    // ---- adding one (the wizard) ------------------------------------------
    add: "New store",
    create: "Create the store",
    back: "Back",
    next: "Next",
    stepOf: "Step {step} of {total}",
    // Two or three words each: the strip is a map of what is coming, not a
    // second set of headings competing with the one on screen.
    shortName: "Name",
    shortPlacement: "Placement",
    shortLocation: "Location",
    shortTiming: "Timing",
    created: "{name} added — set up its menu next",

    stepName: "What is it called?",
    stepNameBlurb:
      "The name customers see, in each language, and the picture on its card.",
    stepPlacement: "Where does it belong, and what does it price in?",
    stepPlacementBlurb:
      "The category decides which tile customers find it under. The currency is what every price on its menu means.",
    stepLocation: "Where is it?",
    stepLocationBlurb:
      "Paste a Google Maps link or a pair of coordinates. This is what delivery is charged from.",
    stepTiming: "How long does it take, and is it open for business?",
    stepTimingBlurb:
      "The preparation window drives the delivery estimate a customer is shown.",

    category: "Category",
    categoryHint: "The tile customers find it under on the home screen.",
    pickCategory: "Choose a category",
    categoryRequired: "Every shop belongs to a category.",

    currency: "Currency",
    // Not a preference: changing it later reprices nothing — the numbers stay
    // and simply mean something else.
    currencyHint:
      "Every price on its menu is in this. Changing it later does not convert anything.",
    pickCurrency: "Choose a currency",
    currencyRequired: "A shop has to price in something.",

    /*
      Changing it after the fact — the details tab.

      The wizard's hint above was accurate about the *rule* and, until now,
      wrong about the world: there was no "later", because nothing on any screen
      could change it. There is now, and these say what it does.

      What it does is re-label. A price is minor units in a column with no
      currency of its own, so the digits stay and their meaning moves — and
      between USD and LBP that is a decimal-place shift as well as a rate, which
      is why the warning shows a real price both ways instead of explaining it.
      "The scale is different" is a sentence somebody can read and still not
      believe. "$15.00 will read as ل.ل1,500" is not.

      It also says how to undo it, in the same breath. Nothing is rewritten, so
      switching back is exact — and an operator who has just realised their
      mistake should not have to work that out while looking at a menu that has
      gone wrong.

      There is no confirmation dialog and no apply button of its own. The first
      attempt had both, and the apply button was a bug: the page carries one
      large Save, so the dropdown was changed, Save was pressed, every other
      field saved, and the currency snapped back. A field that ignores the
      page's Save is a field that does not work.
    */
    currencyTitle: "Currency",
    currencyEditHint:
      "What every price on this menu means. Changing it restates them all, so say which way below.",
    currencyMoved:
      "Every price in this shop will be rewritten. {before} is one of them — choose what should happen to it:",
    /*
      Two answers, each shown as what it does rather than what it is called.

      Describing the difference does not work. "Restate the digits" and "convert
      at the rate" are the same sentence to anybody who has not thought about
      minor units, and the operator has not — they picked the wrong currency and
      want it fixed. "$12.00 becomes ل.ل12" against "$12.00 becomes
      ل.ل1,076,400" needs no explaining, and the wrong one is unmistakable.
    */
    currencyKeep: "The prices are already right — only the currency was wrong",
    currencyConvert: "Convert them, so each item is worth what it was worth",
    currencyBecomes: "{before} becomes {after}",
    // Said once, quietly, under both. It applies whichever is chosen and it is
    // the one part that cannot be undone by switching back.
    currencyLossy:
      "Past orders are unaffected. Where the new currency has fewer decimals, anything after the decimal point is lost for good.",
    currencyChanged: "{name} now prices in {code}",

    prep: "Preparation time",
    prepMin: "Fastest, in minutes",
    prepMax: "Slowest, in minutes",
    prepBackwards: "The slowest time has to be at least the fastest one.",

    visibility: "Visibility",
    live: "Live",
    hidden: "Hidden",
    liveHint: "Customers can find and order from it straight away.",
    // Off by default on a new shop, and the hint says why rather than leaving
    // it to be discovered.
    hiddenHintNew:
      "Recommended for now — it has no menu or opening hours yet. Turn it on from the shops list when it is ready.",

    mapEmpty: "No pin yet — paste a link or coordinates above.",
    noDefaultCountry:
      "No default country is set up, so a shop cannot be created. That is a database seed, not a setting on this screen.",

    tab: "Details",
    name: "Shop name",
    nameHint: "What customers see at the top of the shop.",
    imageHint: "The picture on the shop's card in the app.",
    prepTitle: "Preparation time",
    whatsapp: "WhatsApp number",
    // Says what its absence costs, which is the part somebody skipping the
    // field cannot otherwise know.
    whatsappHint:
      "Where an order is sent so the kitchen can start. Without one this shop cannot be sent orders.",
    whatsappPlaceholder: "70123456",
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
  /**
   * The questions a dish asks when it is ordered.
   *
   * The vocabulary is deliberately not the database's. A row stores `single` /
   * `multi` and a number; an operator checks "choose one, required" against
   * what the shop actually offers, and those are the same fact in the form a
   * person holds it in.
   */
  /**
   * The tiles on the app's home screen.
   *
   * A category is what a customer picks before they pick a shop, so the list is
   * short, seen by everyone, and ordered by hand — which is why the order is
   * the thing this screen is really about.
   */
  categories: {
    tab: "Categories",
    add: "New category",
    name: "Name",
    kind: "Kind",
    kindHint: "Groups categories in the app. Set by migration, not here.",
    pickKind: "Choose a kind",
    kindRequired: "Every category belongs to a kind.",
    visibility: "Visibility",
    live: "Live",
    hidden: "Hidden",
    liveHint: "Customers see this tile on the home screen.",
    hiddenHint: "The tile is gone from the app. Its shops are unaffected.",
    featured: "Featured",
    featuredLabel: "Promotion",
    featuredHint: "Featured categories lead the home screen.",
    // The flag exists to switch off the exceptions — the ones that are booked
    // rather than browsed — so the hint says which those are.
    menuNav: "Menu tabs",
    menuNavHint:
      "Off for shops that are booked rather than browsed, whose menu is a handful of lines.",
    menuNavOn: "Shown",
    menuNavOff: "Hidden",
    save: "Save category",
    added: "{name} added",
    saved: "{name} saved",
    archived: "{name} archived",
    archive: "Archive",
    archiveTitle: "Archive {name}?",
    archiveBody:
      "The tile disappears from the app immediately. It can be brought back.",
    archiveConfirm: "Archive",
    // The refusal an operator is most likely to meet. `stores.category_id` is
    // not null and references this row, so it says the number and what to do.
    stillHasShops:
      "{count} shop(s) are still in this category. Move them first, or they would have nowhere to belong.",
    showTitle: "Show {name} to customers?",
    showBody: "The tile appears on the home screen straight away.",
    showConfirm: "Show it",
    hideTitle: "Hide {name} from customers?",
    hideBody:
      "The tile disappears from the home screen straight away. Its shops keep trading and can still be reached by search.",
    hideConfirm: "Hide it",
    featureTitle: "Feature {name}?",
    featureBody:
      "It leads the home screen, above the categories that are not featured.",
    featureConfirm: "Feature it",
    unfeatureTitle: "Stop featuring {name}?",
    unfeatureBody:
      "It keeps its place in the list; it just no longer leads the home screen.",
    unfeatureConfirm: "Stop featuring",
    search: "Search categories",
    searchHint: "Drag the tiles to change the order customers see them in.",
    // Reordering is off while filtered, and saying so beats a handle that
    // silently does nothing.
    // Stated always, not only once dragging has already stopped working:
    // a handle that does nothing is confusing at the moment it does
    // nothing, and the sentence only helps before that.
    reorderHint: "Drag the rows to reorder. Searching turns that off.",
    searchNone: "No category matches {term}.",
    formLabel: "Category details",
    failedTitle: "Could not load the categories",
  },

  tags: {
    tab: "Tags",
    blurb:
      "The chips an item can carry. One vocabulary for the whole app — a tag means the same thing on every menu, which is what makes it worth having instead of typing the word on each item.",
    add: "New tag",
    name: "Name",
    nameHint: "Short. It sits beside an item's name, not under it.",
    toneLabel: "Colour",
    toneHint:
      "Pick the chip, not the colour — each option shows what the tag will look like in the app.",
    tones: {
      neutral: "Plain",
      accent: "Green",
      yellow: "Yellow",
      active: "Coral",
      info: "Purple",
    },
    previewPlaceholder: "Your tag",
    visibility: "Visibility",
    live: "Live",
    hidden: "Hidden",
    liveHint: "Customers see this chip on every item that carries it.",
    hiddenHint:
      "The chip is gone from the app. The items keep it, so switching this back on restores it to all of them.",
    save: "Save tag",
    added: "{name} added",
    saved: "{name} saved",
    archived: "{name} archived",
    archive: "Archive",
    archiveTitle: "Archive {name}?",
    archiveBody:
      "The chip disappears from {count} item(s) immediately. Nothing else changes — the items keep the tag, so bringing it back restores it to all of them.",
    archiveConfirm: "Archive",
    // A count on the row is what turns "retire this" from a guess into a
    // decision. Zero is said in words rather than as "0 dishes", because
    // "unused" is the thing the operator is scanning for.
    unused: "Not on any item yet",
    usedBy: "On {count} item(s)",
    showTitle: "Show {name} to customers?",
    showBody:
      "The chip appears on all {count} item(s) that carry it, straight away.",
    showConfirm: "Show it",
    hideTitle: "Hide {name} from customers?",
    hideBody:
      "The chip disappears from all {count} item(s) straight away. They keep the tag, so this is reversible in one click.",
    hideConfirm: "Hide it",
    search: "Search tags",
    reorderHint: "Drag the rows to reorder. Searching turns that off.",
    searchNone: "No tag matches {term}.",
    formLabel: "Tag details",
    failedTitle: "Could not load the tags",
    // The order is a property of the vocabulary, not of a dish — worth saying,
    // because "why is Spicy first here" is otherwise a per-dish question.
    itemLabel: "Tags",
    itemHint:
      "The chips shown on this item. Their order comes from the Tags tab, so it is the same on every item.",
    itemPlaceholder: "Add a tag",
    itemNone: "No tags have been set up yet. Add some on the Tags tab.",
    unknownTone: "That is not a colour a tag can be drawn in.",
    alreadyOnDish: "This item already carries that tag.",
  },

  /**
   * The archive tab.
   *
   * Two mechanisms, two words, on purpose. A section or a dish is **archived**
   * — a `deleted_at`, soft because order lines reference it for ever. A
   * question or a choice is **withdrawn** — `is_active`, because those tables
   * have no `deleted_at` and migration 0019 says they should not. Calling both
   * "deleted" would be one word for two states that come back by different
   * routes.
   */
  archive: {
    tab: "Archive",
    title: "Put away",
    hint: "Nothing here is deleted — order history still points at all of it. Bring back what you need.",
    all: "All",
    sections: "Sections",
    items: "Items",
    groups: "Questions",
    options: "Choices",
    stores: "Shops",
    categories: "Categories",
    tags: "Tags",
    promotions: "Promotions",
    // Shown when a filter is on and its own set is empty — distinct from the
    // whole archive being empty, which is a different sentence and a different
    // mascot.
    noneOfThese: "Nothing archived of this kind",
    noneOfTheseBody: "Try another filter, or All.",
    // Says where it would return to, which is the fact that decides whether
    // pressing the button is safe.
    inSection: "in {name}",
    onDish: "on {name}",
    inQuestion: "{question} · {dish}",
    archivedOn: "Archived {when}",
    restore: "Bring back",
    /*
      Confirmations on every "Bring back".

      Each says what will *happen*, not "Are you sure?" — the component's own
      rule, and the reason is that a question with no information in it is the
      kind people learn to dismiss. What happens differs by kind, so there is a
      sentence per kind rather than one that has to be vague enough to cover a
      tag and a shop at once.
    */
    restoreTitle: "Bring {name} back?",
    restoreSection: "It appears on the menu again. Items archived inside it stay archived until you bring those back too.",
    restoreItem: "It appears on the menu again and customers can order it.",
    restoreGroup: "It is asked again whenever this item is ordered.",
    restoreOption: "It is offered again as an answer to this question.",
    restoreStore: "It appears in the app again and customers can order from it.",
    restoreCategory: "It appears in the app again, with whatever shops you bring back into it.",
    restoreTag: "It can be put on items again, and reappears on any that still carry it.",
    restorePromotion: "It runs again if its dates still allow — check them, because they come back exactly as they were.",
    restoreConfirm: "Bring it back",
    // The refusal. A dish restored into an archived section is listed by
    // neither the dashboard nor the app, so it is refused rather than mislaid.
    sectionGoneFirst: "Bring back {name} first — an item cannot return to an archived section.",
    // The same refusal one tier up: `stores.category_id` is not null, so a shop
    // restored into an archived category is on a shelf nothing draws.
    categoryGoneFirst: "Bring back {name} first — a shop cannot return to an archived category.",
    broughtBack: "{name} is back",
    // The catalogue-level archive, above the per-shop one.
    catalogueTitle: "Put away",
    catalogueHint: "Archived shops, categories, tags and promotions. Nothing here is deleted — bring back what you need.",
    catalogueEmptyBody: "Archived shops, categories, tags and promotions collect here.",
    inCategory: "in {name}",
    // A promotion has no customer-facing name, so the slug is the handle — the
    // same one the promotions list shows.
    promotionSlug: "{slug}",
    restored: "{name} is back on the menu",
    sectionRestored: "{name} is back",
    offered: "{name} is offered again",
    emptyTitle: "Nothing put away",
    emptyBody: "Archived sections and items, and withdrawn questions and choices, collect here.",
    failedTitle: "Could not load the archive",
  },

  /**
   * Bulk entry, shared by sections, items and choices.
   *
   * One namespace rather than three, because the strings are about the *format*
   * — columns, a bar, a line number — and the format is one thing. Three copies
   * would be three places for the separator to be described differently from
   * the way the parser reads it.
   */
  bulk: {
    hint: "One per line, columns separated by a vertical bar.",
    hintPriceOptional:
      "One per line, columns separated by a vertical bar. The price is last and can be left off — no price means free.",
    hintPriceRequired:
      "One per line, columns separated by a vertical bar, with the price last.",
    label: "Your list",
    sectionsTitle: "Several sections at once",
    itemsTitle: "Several items at once",
    choicesTitle: "Several choices at once",
    submit: "Add {count}",
    submitOne: "Add 1",
    nothing: "Nothing to add yet — type or paste a list above.",
    ready: "{count} ready to add",
    problems: "Fix these lines first",
    line: "Line {line}",
    columns: "Expected {expected} columns separated by | , found {found}.",
    nameMissing: "The {code} name is empty.",
    nameLong: "The {code} name is longer than {max} characters.",
    price: "The price is missing or is not a number.",
    priceRange: "That price is out of range.",
    duplicate: "\"{name}\" is already on line {first}.",
    addedSections: "{count} sections added",
    addedItems: "{count} items added",
    addedChoices: "{count} choices added",
  },

  /**
   * Common questions: one question asked on many items.
   *
   * `0094` restored the link table `0074` dropped, so a question is offered on
   * the items its links name. The vocabulary on screen follows that: a question
   * is **offered on** items rather than belonging to one, and taking it off
   * some items is not the same act as withdrawing it from the shop.
   *
   * Not `common` — that namespace is already the shell's Save/Cancel/Close, and
   * a second one silently shadowed it.
   */
  /**
   * The item-picker half of the Options tab.
   *
   * Its own namespace, kept after the Common options tab was folded into
   * Options: these strings are about *which items ask a question*, which is a
   * different subject from what a question is and how it is answered, and one
   * flat `options` namespace of sixty keys is harder to read than two of thirty.
   */
  commonOptions: {
    onItems: "{name} is on {count} items",
    onNoItems: "{name} is not on any item",
    // The count beside each question in the list.
    usedOn: "on {count} items",
    usedOnOne: "on 1 item",
    usedOnNone: "not asked anywhere",
    choices: "{count} choices",
    // Above the answers, because this is the screen where an edit is least
    // obviously not local — the whole point is that it is not.
    editsEverywhere:
      "Editing a choice here changes it on all {count} items asking this question.",
    // The exception to the sentence above, said in the same breath. Without it
    // "an edit changes all twenty" reads as a rule with no way round — which is
    // what sent operators off to build a second copy of the question for the
    // two dishes that needed it slightly different.
    exceptOffered:
      "Whether each choice is offered, and which one this item opens on, are set here for this item alone.",
    // Named, because "this item has its own default" without saying which one
    // is a state the operator would have to go and find.
    ownDefault: "This item opens on {name}.",
    // Not the same as pressing "Make default here" on whatever the question
    // currently opens on: a cleared item follows the shared answer the next
    // time it moves, and a pinned one silently stops.
    useSharedDefault: "Use the shared default",
    noChoices: "no choices yet",
    manage: "Choose items",
    withdrawnMark: "Withdrawn",
    withdrawnHint: "Withdrawn from the whole shop. Bring it back from the Archive tab.",
    // The picker.
    pickTitle: "Which items ask {name}?",
    pickHint: "Tick a whole section, or the items inside it. Items in different sections can be mixed.",
    pickAll: "Every item in this shop",
    pickNone: "Clear all",
    section: "{name}",
    // Says what Save will do, before it is pressed — an operator ticking a
    // section of thirteen wants the number, not to count the boxes.
    picked: "{count} items selected",
    pickedNone: "No items selected — the question will be asked nowhere.",
    save: "Save",
    // A dish that is archived cannot be ticked: the question would be asked on
    // something no menu shows.
    archivedItem: "archived",
  },

  /**
   * The units an item's price can be quoted in.
   *
   * Here rather than in a column, for the reason `0095` records: "kg" is "كغ"
   * in Arabic, so the word is chrome and belongs beside every other piece of
   * user-facing text. The *key* is what the database holds.
   */
  units: {
    kg: "kg",
    g: "g",
    l: "L",
    ml: "mL",
    piece: "piece",
    // The size under an item's name: "1 kg", "500 g".
    size: "{quantity} {unit}",
    // The comparison figure beside the price: "$12.00/kg".
    per: "{amount}/{unit}",
    // The editor.
    label: "Sold by",
    hint: "For anything priced by weight or volume. Leave the unit empty for an item sold as itself.",
    none: "No unit",
    quantity: "Amount",
    quantityHint: "How much of that unit one of these is — 1 kg, or 500 g.",
    quantityRequired: "Say how much, or clear the unit.",
    quantityPositive: "The amount must be more than zero.",
  },

  options: {
    tab: "Options",
    tabHint:
      "Every question this shop asks. Narrow to a section or one item to see only its own.",
    section: "Section",
    sectionHint: "Narrows the list of items below, and the questions on the right.",
    pickSection: "Choose a section",
    item: "Item",
    itemHint: "Shows only the questions this item asks. Clear it to see them all.",
    pickItem: "Choose an item",
    // The marker in the picker. A dish with no questions looks complete
    // everywhere else, so this is the only place it can be seen at a glance.
    noneSet: "no options yet",
    noQuestions: "Nothing here yet.",
    title: "Options",
    hint: "Questions asked when this item is ordered — a size, extras, something left out.",
    saveFirst: "Save this item first, then set up its options.",
    openFor: "Set up this item's options",
    chooseOne: "Choose one",
    chooseAny: "Choose any",
    required: "Required",
    optional: "Optional",
    count: "{count} choices",
    free: "Free",
    addGroup: "New question",
    groupTitle: "What is being asked",
    groupTitleHint: "The customer reads this above the choices.",
    howMany: "How many can be chosen",
    howManyHint: "A size is one answer; extras are usually several.",
    atMost: "At most",
    atMostHint: "Leave empty for no limit.",
    noLimit: "No limit",
    mustChoose: "Must the customer answer",
    mustChooseHint:
      "Required questions have to be answered before the item can be added.",
    saveGroup: "Create question",
    // Renaming a question and re-pricing a choice. Both were missing: every
    // other fact about a group was a switch that wrote as it was flicked,
    // while the two *text* facts — what is asked, and what an answer is
    // called and costs — could only be set at creation and never corrected.
    renameGroup: "Rename",
    saveTitle: "Save question",
    editChoice: "Edit",
    saveChoice: "Save choice",
    // Named, because a group has several rows of identical buttons.
    editChoiceLabel: "Edit {name}",
    optionName: "Choice",
    extraCost: "Adds",
    extraCostHint: "Added to the item's price. Leave at 0 for a free choice.",
    addOption: "Add choice",
    bulkAdd: "Paste a list",
    // Names the question, because a dish has several and the buttons are
    // otherwise identical down the page.
    addChoiceTo: "Add a choice to {name}",
    choices: "Choices",
    noChoices: "No choices yet. Add the first one below.",
    // Not the same state as having none, and the difference matters: told this
    // question was empty, an operator would re-add the choices it already has
    // — and the unique slug per group (0067) would refuse them with a message
    // about a constraint.
    allWithdrawn:
      "Every choice here is withdrawn. Bring them back from the Archive tab, or add new ones below.",
    // "Withdrawn", not "deleted". These rows are referenced by past orders
    // forever and are never removed; what changes is whether the shop still
    // offers them, and that is reversible.
    offeredGroup: "Offered",
    withdrawn: "Withdrawn",
    /*
      Both directions of the switch ask, and they ask different things.

      Withdrawing changes what a customer sees on a shop that is open and taking
      orders, and the failure is silent from this side: nothing looks wrong here,
      and what is discovered later is that a dish stopped selling because the
      size question vanished from it. Nobody undoes a mistake they did not
      notice — so the moment to catch it is before it happens, not after.

      Each direction also says where it goes, because withdrawing now *moves*
      the row to the Archive tab rather than leaving it greyed out here.
    */
    withdrawGroupTitle: "Withdraw {name}?",
    withdrawGroupBody:
      "Customers stop being asked it. It moves to the Archive tab, where you can bring it back.",
    withdrawGroupConfirm: "Withdraw it",
    offerGroupTitle: "Offer {name} again?",
    offerGroupBody: "Customers are asked it again whenever this item is ordered.",
    offerGroupConfirm: "Offer it",
    withdrawChoiceTitle: "Withdraw {name}?",
    withdrawChoiceBody:
      "Customers stop being able to pick it. It moves to the Archive tab, where you can bring it back.",
    withdrawChoiceConfirm: "Withdraw it",
    offerChoiceTitle: "Offer {name} again?",
    offerChoiceBody: "Customers can pick it again as an answer to this question.",
    offerChoiceConfirm: "Offer it",
    // Said once at the top of a dish's questions, so the absence of the
    // withdrawn ones is a fact on screen rather than something to work out.
    withdrawnElsewhere:
      "Withdrawn questions and choices are on the Archive tab.",
    isDefault: "Default",
    makeDefault: "Make default",
    /*
      The per-item pair, and why the words differ from the two above them.

      "Withdrawn" is the shop saying it has stopped doing Large — on every dish,
      and the row moves to the Archive tab. "Not here" is this dish saying it
      never had one, while the other nineteen carry on offering it. Same choice,
      two different sentences, so two different words: calling both of them
      "Withdrawn" would make the smaller act look like the larger one.

      "Default here" likewise. A question opens on one answer, and until 0096
      that answer was the same on all twenty dishes asking it — including the
      two with no Large to open on.
    */
    offeredHere: "Offered here",
    notHere: "Not here",
    defaultHere: "Default here",
    makeDefaultHere: "Make default here",
    failedTitle: "Could not load the options",
    groupAdded: "{name} created",
    // The one constraint an operator can actually hit: a floor above the
    // ceiling is unsatisfiable, and the database says so by constraint name.
    rangeImpossible:
      "At least cannot be more than At most — nobody could satisfy that.",
  },

  /**
   * The two numbers that price every order.
   *
   * Both are read by `delivery_quote` on every basket, and both are the kind of
   * setting whose mistakes are invisible: a wrong rate misprices the whole
   * catalogue without breaking anything, and a wrong top band silently changes
   * where the business delivers.
   */
  pricing: {
    title: "Pricing",

    rateTitle: "Exchange rate",
    rateBody:
      "Every price the app shows in the second currency is worked out from this number.",
    rateNow: "Right now",
    // The whole equation, so it can be read aloud and checked. Assembling it
    // out of JSX would put "1" and "=" in the markup, which is exactly the kind
    // of stray literal the lint rule exists to catch — and the two halves of a
    // sentence a second language would want to reorder.
    rateLine: "1 {base} = {amount} {other}",
    // `0028` stores `rate_updated_at` precisely so this can be said: a rate
    // with no date is a rumour.
    rateAsOf: "Set {when}",
    rateLabel: "{code} per unit",
    rateHint: "How many {other} one {base} is worth.",
    rateSave: "Change the rate",
    ratePositive: "A rate has to be more than zero.",
    rateSaved: "{code} rate updated",
    rateMissing: "No second currency is set up.",

    // What the rate does to real amounts. A rate is an abstraction until it is
    // multiplied by something a merchant recognises.
    whatItMeans: "What that means",
    whatItMeansHint:
      "The same amounts at the rate you have, and at the one you are typing.",
    amount: "Amount",
    atCurrent: "Now",
    atNew: "After",
    rateConfirmTitle: "Change the rate?",
    // The arithmetic, not a reassurance. An operator can check a worked example
    // against what they expected; they cannot check a bare number.
    rateConfirmBody:
      "{sample}. Every price the app shows in that currency changes with it, straight away.",
    rateConfirmAction: "Change it",

    ladderTitle: "Delivery ladder",
    ladderBody:
      "What delivery costs by distance. Each row is the top of a band, and the largest is also how far you deliver.",
    // Said out loud because it used not to be true, and the failure was silent:
    // an unconverted fee on a shop pricing in another currency is delivery for
    // roughly nothing.
    ladderCurrency:
      "Priced in {code}. A shop that prices in another currency charges the converted amount, at the rate you set on the Exchange rate tab.",
    upTo: "Up to (km)",
    fee: "Fee",
    minor:
      "In the smallest unit of {code} — 100 is one whole unit when it has two decimal places.",
    isRadius: "Delivery radius",
    // What the label means, in consequences. Two of them, and neither is
    // visible anywhere else in the dashboard.
    radiusMeans:
      "You do not deliver past {km} km. An order this far, or one whose distance cannot be worked out, is charged this fee.",
    addBand: "Add a band",
    remove: "Remove",
    removeConfirm: "Remove it",
    // Removing the top row is not removing a price — it is shrinking where the
    // business delivers, and nothing else on the screen would say so.
    removeTopTitle: "Remove the {km} km band?",
    removeTopBody:
      "It is the largest, so it is also the delivery radius. Removing it means you no longer deliver past {next} km, and anything further is out of range.",
    ladderSave: "Save the ladder",
    ladderSaved: "Delivery ladder saved",
    discard: "Discard changes",
    bandDistancePositive: "Every band needs a distance greater than zero.",
    bandAmountNegative: "A fee cannot be negative.",
    bandDuplicate:
      "Two bands share a distance. Each one is the top of its own.",
    unsavedBand: "Not saved yet",

    // The ladder read back. A table is right for setting prices and wrong for
    // checking them: "what does someone four kilometres away pay" is the
    // question, and reading it off a table means scanning for the first ceiling
    // above four and hoping there is no gap.
    tryTitle: "Try a distance",
    tryHint:
      "What a customer this far away is charged, by the ladder on the left.",
    tryLabel: "Distance (km)",
    tryBand: "Charged by the band up to {km} km.",
    // Out of range is a different answer from expensive: there is no delivery
    // at all, and saying "the top fee" would be wrong in a way that costs an
    // order.
    tryOutOfRange:
      "Out of range. You do not deliver past {km} km, so this order could not be placed.",
    tryNoBands: "Add a band and this will price it.",
    tryUnsaved:
      "Pricing the ladder as you have edited it. Save to make it real.",
  },

  /**
   * The cards on the app's home screen.
   *
   * Called banners rather than discounts, deliberately. The rows live in
   * `discounts` and that table carries a whole discount engine's vocabulary,
   * but `place_order` hardcodes a discount of zero and no coupon column exists.
   * A screen that offered a percentage would be offering a decision with no
   * consequence, and the operator would find out from a customer's bill.
   */
  promotions: {
    tab: "Promotions",
    add: "New promotion",
    name: "Reference",
    nameHint:
      "Your own label for it, never shown to a customer. Cannot be changed later.",
    nameRequired: "Give it a name so you can find it again.",
    imageHint: "The card as it appears on the home screen. Wide, not square.",

    search: "Search promotions",
    // The slug is the only text a promotion has: 0013 dropped the label,
    // headline and note columns because the card is artwork. Worth saying, or
    // the operator searches for wording that lives inside a picture.
    searchHint:
      "Searches the reference you gave each promotion — the card itself is artwork, so there is no wording to search.",
    reorderHint: "Drag the rows to reorder. Searching turns that off.",
    searchNone: "No promotion matches {term}.",

    // ---- what it takes off -------------------------------------------------
    discountSection: "The discount",
    kind: "Kind",
    kindHint: "What comes off the bill.",
    kinds: {
      percentage: "Percentage off",
      fixedAmount: "Amount off",
      freeDelivery: "Free delivery",
    },
    kindNotes: {
      percentage: "of the food",
      fixedAmount: "off the food",
      freeDelivery: "whatever the fee is",
    },
    percentLabel: "Percentage",
    percentHint:
      "Of the food only — a promotion should not quietly pay the courier.",
    percentTooBig: "A percentage over 100 would pay the customer.",
    amountLabel: "Amount off",
    // The real hazard, said plainly. `discounts` has no currency column, so the
    // number is compared against whatever the order happens to be priced in.
    amountHint:
      "In {code}, without separators — the line below shows what it comes to. A shop pricing in another currency takes off the converted amount, at the rate you set on the Pricing screen.",
    valueRequired: "Say how much comes off.",
    valueOutOfRange: "That amount is outside what a discount can be.",
    minSubtotal: "Minimum spend",
    minSubtotalHint:
      "In {code}. Below this the promotion does not apply — and it is compared after conversion, so it means the same amount of money whatever a shop prices in. Leave empty for no minimum.",
    noMinimum: "No minimum",
    maxDiscount: "Most it can take off",
    maxDiscountHint:
      "In {code}. A ceiling on the percentage, so a large basket cannot run away with it. Leave empty for none.",
    noCeiling: "No ceiling",

    // ---- who gets it -------------------------------------------------------
    whoSection: "Who gets it",
    appliesTo: "Applies to",
    appliesToHint:
      "Narrowing it means the basket has to contain something matching. The discount still comes off the whole subtotal.",
    scopes: {
      order: "Every order",
      store: "Orders from certain shops",
      category: "Orders from certain categories",
      menuItem: "Orders containing certain items",
    },
    // Hand-written SQL can attach scopes of several types at once. The form
    // cannot show that, so it says so and refuses to touch them.
    scopesMixed:
      "This promotion was set up with several kinds of scope at once, which this form cannot show. Saving will leave its scopes exactly as they are.",
    targetsRequired:
      "Choose at least one, or set this back to Every order — a narrowed promotion with nothing chosen applies to everything.",
    pickShops: "Shops",
    pickShopsPlaceholder: "Add a shop",
    pickCategories: "Categories",
    pickCategoriesPlaceholder: "Add a category",
    // The shop, asked before the dishes. A dozen shops sell a "Hummus", so a
    // catalogue-wide dish search returns near-identical names told apart only
    // by a shop in grey — and the wrong pick attaches the promotion to another
    // merchant's dish.
    pickDishShop: "Which shop",
    pickDishShopPlaceholder: "Choose a shop",
    pickShopFirst: "Choose a shop first.",
    pickDishes: "Items",
    pickDishesHint:
      "The shop's name is shown beside each, so two items with the same name are told apart.",
    pickDishesPlaceholder: "Search for an item",
    typeToFindDishes: "Start typing to find an item.",
    noDishes: "No item matches {term}.",
    firstOrderLabel: "New customers",
    firstOrderHint:
      "Only for somebody who has never ordered before. Cancelled orders count — it is about who they are, not about what survived.",
    firstOrderOn: "First order only",
    firstOrderOff: "Anyone",
    perUser: "Times one customer can use it",
    perUserHint: "Leave empty for no limit.",
    totalCap: "Times it can be used in total",
    totalCapHint: "Leave empty for no limit.",
    totalCapHintUsed: "Used {count} time(s) so far. Leave empty for no limit.",
    noLimit: "No limit",
    capsPositive:
      "A limit of zero would switch it off — leave it empty instead.",

    // ---- when --------------------------------------------------------------
    whenSection: "When",
    startsAt: "Starts",
    startsHint: "Leave empty to start as soon as it is switched on.",
    endsAt: "Ends",
    endsHint: "Leave empty to run until you switch it off.",
    windowBackwards: "The end has to come after the start.",
    noDate: "No date",
    inZone: "{zone}",
    visibility: "Visibility",
    visibilityHint:
      "A promotion shows only when it is on and inside its dates.",
    live: "Live",
    hidden: "Hidden",
    noArtwork: "No artwork",
    save: "Save promotion",
    added: "{name} added",
    saved: "{name} saved",
    archived: "{name} archived",
    archive: "Archive",
    archiveTitle: "Archive {name}?",
    archiveBody:
      "The card disappears from the app immediately and it stops discounting anything. It can be brought back.",
    archiveConfirm: "Archive",
    thisBanner: "this promotion",

    // ---- summaries ---------------------------------------------------------
    previewLabel: "In the app",
    preview: "{summary}",
    summaryPercent: "{value}% off the food",
    summaryFixed: "{amount} off the food",
    summaryFreeDelivery: "Free delivery",
    summaryOver: "over {amount}",
    summaryFirstOrder: "first order only",
    summaryScoped: "{count} scope(s)",
    summaryIncomplete: "No amount set yet",
    redeemed: "{count} used",
    redeemedOf: "{count} of {cap} used",

    // The window in words. A promotion can be switched on and invisible, which
    // is the state worth naming: nothing else on screen would say so.
    always: "Runs until you switch it off",
    between: "{from} to {to}",
    until: "Until {to}",
    from: "From {from}",
    startsOn: "Switched on, but does not start until {when}",
    ended: "Switched on, but its dates have passed",

    showTitle: "Show {name} on the home screen?",
    showBody:
      "It appears straight away, as long as today is inside its dates — and it starts coming off bills.",
    showConfirm: "Show it",
    hideTitle: "Hide {name}?",
    hideBody:
      "The card disappears from the home screen straight away and it stops discounting anything.",
    hideConfirm: "Hide it",
    formLabel: "Promotion details",
  },

  reports: {
    title: "Overview",

    // Deliberately not date-filtered: an order still unconfirmed from Tuesday
    // is not Tuesday's business, it is the most urgent thing on the screen.
    needsYou: "Needs you now",
    needsYouNote: "Every order still waiting, whatever day it arrived",
    countsFailed: "Could not count the open orders.",

    performance: "How we are doing",
    range7: "7 days",
    range30: "30 days",
    range90: "90 days",
    rangeClear: "Back to presets",

    exportLabel: "Export",
    exportChoose: "Choose a format",
    exporting: "Preparing…",
    rangePlaceholder: "Pick a date range",
    export: {
      csv: "CSV",
      xlsx: "Excel",
      pdf: "PDF",
    },
    // The browser's own print dialogue is what writes the PDF — see `export.ts`
    // on why, and this is the one way it can fail that is worth explaining.
    printBlocked:
      "Your browser blocked the print window. Allow pop-ups for this site and try again.",

    sheetSummary: "Summary",
    sheetDaily: "By day",
    sheetItems: "What sells",
    sheetStores: "Shops",
    sheetHours: "When we are busy",
    colMetric: "Figure",
    colValue: "Value",
    // The stored integer, so a spreadsheet can compute — labelled so nobody
    // reads it as the amount.
    colRaw: "Raw (minor units)",
    colDay: "Day",
    colOrders: "Orders",
    colRevenue: "Revenue",
    colItem: "Item",
    colStore: "Shop",
    colQuantity: "Sold",
    colWeekday: "Day",
    colHour: "Hour",
    colCancelled: "Cancelled",
    rangeNote: "{from} to {to}, Beirut time",
    failedTitle: "Could not load the figures",
    nothingYet: "Nothing in this range yet.",

    tileRevenue: "Revenue",
    tileOrders: "Orders",
    tileAverage: "Average order",
    tileDelivery: "Delivery fees",
    // A percentage against zero is infinite and means "we started", so it is
    // named rather than computed.
    fromNothing: "up from nothing",
    flat: "no change",
    discountsGiven: "Promotions cost",
    cancelled: "{count} cancelled",

    chartRevenue: "Revenue by day",
    chartRevenueAria:
      "Revenue for each day in the range, with the previous period behind it.",
    chartRevenueTitle: "{day}: {orders} order(s), {amount}",
    ghostNote: "The grey bars are the period before this one.",

    chartHours: "When we are busy",
    chartHoursAria:
      "Orders by hour of the day and day of the week, in Beirut time.",

    chartItems: "What sells",
    chartItemsAria: "The ten items sold most often in this range.",
    sold: "{count} sold",

    chartStores: "Which shops earn",
    chartStoresAria: "The ten shops by revenue in this range.",

    chartFunnel: "Where orders stand",
    chartFunnelAria:
      "How many shop portions are at each step, including cancelled ones.",

    chartBands: "What each delivery band collected",
    chartBandsAria: "Delivery fees collected, by distance band.",
    bandLabel: "Up to {km} km",
  },

  account: {
    title: "Your account",
    blurb:
      "Your own sign-in. Both changes ask for your current password — a signed-in session is exactly what an unattended laptop already has, so it cannot be the proof for a change that outlives it.",
    tabPassword: "Password",
    tabEmail: "Email",
    signedInAs: "Signed in as",
    failed: "Could not read your account.",

    currentPassword: "Current password",
    currentHint: "Proves it is you, and not a session somebody walked up to.",
    currentRequired: "Enter your current password.",
    wrongPassword: "That is not your current password.",

    passwordTitle: "Change your password",
    passwordBlurb:
      "You stay signed in on this device. Other devices are signed out, because the tokens they hold were issued to the old password.",
    newPassword: "New password",
    newPasswordHint: "At least {min} characters. Length beats punctuation.",
    confirmPassword: "New password again",
    confirmMismatch: "The two do not match.",
    changePassword: "Change password",
    passwordChanged: "Your password is changed",

    emailTitle: "Change your email",
    // The honest description: it does not change until the link is followed.
    emailBlurb:
      "This is where password-reset links go. We send a confirmation to the new address first, and nothing changes until you follow it — so keep the old inbox until you have.",
    newEmail: "New email",
    newEmailHint: "You will need to open a link sent to this address.",
    emailInvalid: "That does not look like an email address.",
    changeEmail: "Send the confirmation",
    emailPending:
      "Check the new inbox — the change lands when you follow the link",
  },

  content: {
    title: "Settings",
    tabHelp: "Help",
    tabLegal: "Legal",
    tabPayments: "Payments",
    tabSteps: "Order steps",
    failed: "Could not load this. Try again.",
    searchHelp: "Search questions",
    searchLegal: "Search this document",
    reorderHint: "Drag the rows to reorder. Searching turns that off.",
    searchNone: "Nothing matches {term}.",
    save: "Save",
    saved: "{name} saved",
    added: "{name} added",
    removed: "{name} removed",
    remove: "Remove",
    removeConfirm: "Remove",
    visibility: "Visibility",
    live: "Live",
    hidden: "Hidden",
    liveHint: "Customers can see this in the app.",
    hiddenHint: "It is gone from the app. Nothing else changes.",

    // ---- help --------------------------------------------------------------
    helpBlurb:
      "The questions and answers in the app's help screen. Drag to change the order customers read them in.",
    addTopic: "New question",
    topicForm: "Help topic",
    group: "Group",
    // `group_name` is stored per topic and the app groups by `group_slug`, so a
    // name edited on one row would split the group. Choosing from what exists
    // is what keeps that from happening by accident.
    groupHint:
      "The heading it sits under. Pick an existing one — a new heading is a migration, so groups stay a short, deliberate list.",
    pickGroup: "Choose a group",
    groupRequired: "Every question sits under a heading.",
    question: "Question",
    answer: "Answer",
    showTitle: "Show {name} in the app?",
    showBody: "Customers see it in the help screen straight away.",
    showConfirm: "Show it",
    hideTitle: "Hide {name}?",
    hideBody: "It disappears from the help screen straight away.",
    hideConfirm: "Hide it",
    removeTopicTitle: "Remove {name}?",
    // Unlike every catalogue row, this is a real delete: `help_topics` has no
    // `deleted_at`, so there is nothing to bring back.
    removeTopicBody:
      "This cannot be undone — a help topic is deleted outright rather than archived. Hide it instead if you might want it back.",

    // ---- legal -------------------------------------------------------------
    legalBlurb:
      "The privacy policy and terms, section by section. The order is the document, so dragging a section rewrites it.",
    document: {
      privacy: "Privacy policy",
      terms: "Terms of service",
    },
    addSection: "New section",
    sectionForm: "Document section",
    sectionTitle: "Heading",
    sectionBody: "Text",
    removeSectionTitle: "Remove {name}?",
    removeSectionBody:
      "This cannot be undone — the section is deleted outright rather than archived.",

    // ---- payments ----------------------------------------------------------
    // There is one row and no gateway anywhere in the codebase, so the tab
    // renames what is there rather than offering to add anything.
    // Says why there is nothing to switch. A screen with one row and no
    // controls invites "is this broken"; a sentence answers it once.
    paymentsBlurb:
      "How customers pay. There is one method and no payment gateway in this product, so you can rename it and describe it — there is nothing to turn on or off. Switching it off would stop every checkout in the app, so the database refuses that too.",
    methodName: "Name",
    methodDetail: "Description",
    enabled: "Accepted",
    disabled: "Not accepted",
    enableTitle: "Accept {name} again?",
    enableBody: "Customers can choose it at checkout straight away.",
    enableConfirm: "Accept it",
    disableTitle: "Stop accepting {name}?",
    // Not a presentation change: it is the only way to pay.
    disableBody:
      "This is the only payment method, so turning it off leaves customers with no way to check out.",
    disableConfirm: "Stop accepting it",

    // ---- order steps -------------------------------------------------------
    stepsBlurb:
      "What a customer is told at each step of an order. The steps themselves — which comes first, which ends an order — are set by migration, because changing them changes how the business runs rather than how it reads.",
    stepName: "Name",
    timelineTitle: "Timeline heading",
    timelineDetail: "Timeline detail",
    step: "Step {at}",
    offPath: "Ends the order",
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
    searchClear: "Clear",
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
    // The bulk route, beside the one-at-a-time button in both places.
    bulkSections: "Paste sections",
    bulkItems: "Paste items",
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

  /**
   * Leaving a form with work still in it.
   *
   * "Discard changes", not "OK" — the last thing read before clicking is what
   * it does, which is the same rule `ConfirmButton` follows. The body says what
   * is at stake rather than asking "are you sure", because a question with no
   * information in it is one people learn to dismiss.
   */
  unsaved: {
    title: "Leave without saving?",
    body: "This form has changes that have not been saved. Leaving now discards them.",
    stay: "Keep editing",
    discard: "Discard changes",
  },

  confirm: {
    signOutTitle: "Sign out?",
    // Says what happens, not "are you sure". A question with no information in
    // it is the kind people learn to dismiss without reading.
    signOutBody:
      "You will stop receiving new-order alerts on this device until you sign back in.",
    // The same question with the part that actually costs something first.
    // Signing out of a machine is recoverable; the half-finished menu edit
    // behind the dialog is not.
    signOutBodyUnsaved:
      "You have unsaved changes, and signing out discards them. You will also stop receiving new-order alerts on this device until you sign back in.",
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
    // An example, per the rule every other field here follows — a placeholder
    // that repeats the label is noise, and noise is what teaches people to
    // stop reading them.
    emailPlaceholder: "you@lebrunji.com",
    // Not an example. A password field is the one place a specimen value would
    // be a suggestion, so this is the *shape* of the input instead: masked, and
    // saying nothing about what to type.
    passwordPlaceholder: "••••••••••••",
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
