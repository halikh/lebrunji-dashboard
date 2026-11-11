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
 *
 * ## The Arabic here is not the dashboard's
 *
 * `ar` holds only what a driver or a shop reads on WhatsApp (`dispatch.ts`,
 * user, 2026-11-08). The operator's screens stay in English, so nothing but
 * those messages asks for it. A key `ar` does not have falls back to `en`.
 */

export type Locale = "en" | "ar";

export const DEFAULT_LOCALE: Locale = "en";

const en = {
  common: {
    save: "Save",
    cancel: "Cancel",
    /**
     * The cue at the foot of a pane that has more in it — see `ScrollCues`.
     *
     * "More below" rather than "Scroll down": it says what is true, where an
     * instruction says what to do about it, and the operator may well be about
     * to use the wheel rather than press this. It is also two words, which is
     * as much as fits over a list without becoming part of it.
     */
    scrollMore: "More below",
    /**
     * Its twin at the top edge, once a pane is far enough down to make
     * getting back a chore — see `FAR` in `ScrollCues`.
     *
     * Names the destination rather than the direction: "Up" would leave open
     * how far, and this one goes all the way.
     */
    scrollTop: "Back to top",
    signOut: "Sign out",
    search: "Search",
    clear: "Clear",
    edit: "Edit",
    delete: "Delete",
    add: "Add",
    back: "Back",
    more: "More",
    viewAll: "View all",
    somethingWentWrong: "Something went wrong. Try again.",
    close: "Close",
    /** The drag handle on a side panel's edge, for a screen reader. */
    resize: "Resize panel",
    undo: "Undo",
    retry: "Try again",
    /** A read failed — not the same as the thing not existing. */
    loadFailed: "Could not load this.",
    loadFailedBody:
      "The connection may have dropped. Nothing has been changed.",
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
    earnings: "Earnings",
    todo: "To do",
    settings: "Settings",
    account: "Your account",
    liveOrders: "orders needing attention",
    skipToContent: "Skip to content",
  },

  todo: {
    title: "To do",
    blurb:
      "What the catalogue and the drivers are still missing. Each row opens the place where it is fixed.",
    hoursTitle: "Shops without opening hours",
    // Urgent, and said so: no hours reads as open around the clock (`0170`),
    // so these shops take orders at hours nobody is there to cook them.
    hoursBody:
      "Urgent: a shop with no hours is open around the clock in the app, so customers can order from it at any hour, even at night.",
    hoursNone: "No hours set",
    hoursBranches: "{count} of {total} branches have no hours: {names}",
    hoursDone: "Every shop has its opening hours.",
    setHours: "Set hours",
    // 0280: a driver is offered only inside our ordering hours, so a week
    // that runs past them says something that will not happen.
    driversTitle: "Drivers whose hours don't fit ours",
    driversBody:
      "Drivers take orders only while we are open. Hours outside ours never count, so set their week inside our hours. A driver with no hours is never offered.",
    driversDone: "Every driver's hours sit inside ours.",
    driverNoHours: "No hours set",
    driverNever: "All their hours are outside ours, so they are never offered",
    driverDays: "Runs past our hours on {days}",
    fixDriverHours: "Fix hours",
    nextDriver: "fix the hours for {name}",
    addressTitle: "Branches without an address",
    addressBody:
      "Every branch needs one before launch: the app prints it under the shop's name.",
    addressDone: "Every branch has its address.",
    addAddress: "Add address",
    // 0262, two checks (user, 2026-11-08): a shop on commission needs its
    // rate, and every dish of a shop on markup needs our markup.
    commissionTitle: "Shops on commission without a rate",
    commissionBody:
      "Commission is chosen, or nothing is, and no rate is entered. We earn nothing on their orders, and the driver pays the shop the full amount.",
    commissionDone: "Every shop on commission has its rate.",
    setCommission: "Set the rate",
    markupTitle: "Dishes on markup without our markup",
    markupBody:
      "The shop is on markup, but these dishes have no price from the shop and markup yet, so we keep nothing on them.",
    markupDone: "Every dish of a shop on markup has its markup.",
    setMarkup: "Add markup",
    storeImagesTitle: "Shops without a picture",
    storeImagesBody: "The picture is the shop's card in the app.",
    storeImagesDone: "Every shop has a picture.",
    itemImagesTitle: "Dishes without a picture",
    itemImagesBody: "Grouped by shop, so a whole menu can be done in one go.",
    itemImagesDone: "Every dish has a picture.",
    addPicture: "Add picture",
    items: "{count} dishes",
    itemsOne: "1 dish",
    hidden: "Hidden",
    search: "Search shops, dishes or branches",
    noMatch: "Nothing here matches the search.",
    failed: "Could not load this list.",
    truncated:
      "Only the first part of this list is shown. Fix these and the rest will appear.",
    // The badge on the one group that costs something today, not at launch.
    urgent: "Urgent",
    done: "Done",
    allDoneTitle: "Nothing left to do",
    allDoneBody:
      "Every shop has its hours, every driver works inside ours, every shop on commission its rate, every dish on markup its markup, every branch its address, and everything has a picture.",
    // The line under the header: the whole job in one sentence, so the page
    // answers "how much is left" before anything is opened.
    remaining: "{count} things left to fix",
    remainingOne: "1 thing left to fix",
    show: "Show",
    hide: "Hide",
    // The setup-guide card (2026-11): progress by group, and one next step.
    progress: "{done} of {total} done",
    progressLabel: "Catalogue checklist progress",
    nextUp: "Next:",
    startNext: "Start",
    nextHours: "set the opening hours for {name}",
    nextAddress: "add the address for {name}",
    nextCommission: "set the commission rate for {name}",
    nextMarkup: "add our markup to {name} ({shop})",
    nextStoreImage: "add a picture for {name}",
    nextItemImage: "add a picture for {name} ({shop})",
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
    tabIncomplete: "Signup not finished",

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
    // Closing an account erases its name and number; the row stays for its
    // orders.
    closedAccount: "Closed account",
    phoneErased: "Erased on closing",

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
    defaultAddress: "Selected",
    addressPhone: "Phone at this address",
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

    // ---- the redesigned list and profile (lebrunji-admin) -------------------
    blurb:
      "Everyone who has signed in on the app. Search by name or number to find the person on the phone.",
    failedBody: "Check your connection and try again.",
    emptySuspendedTitle: "Nobody is suspended",
    emptySuspendedBody:
      "Suspending someone from their profile signs them out until you lift it.",
    emptyClosedTitle: "No closed accounts",
    emptyClosedBody:
      "Accounts closed from here, or by the customer in the app, are listed here with their orders.",
    emptyIncompleteTitle: "Everyone has finished signing up",
    emptyIncompleteBody:
      "Someone who verified their number but never entered a name shows up here.",
    colCustomer: "Customer",
    colPhone: "Phone",
    colOrders: "Orders",
    colLastOrder: "Last order",
    colJoined: "Joined",
    colStatus: "Status",
    colActions: "Actions",
    actionsFor: "Actions for {name}",
    profileFailedTitle: "Could not load this customer",
    profileFailedBody:
      "The link may be old, or the connection dropped. Try again, or go back to the list.",
    recentOrders: "Recent orders",
    seeAllOrders: "See all {count}",
    ordersBlurb:
      "Newest first. Click an order to read its receipt without leaving this page.",
    noOrdersBody: "Their orders appear here as soon as they place one.",
    noAddressesBody:
      "Addresses are added by the customer in the app, at checkout or in their profile.",
    promotionsBlurb:
      "Each discount that came off one of their orders, under the name it had at the time.",
    chartWeekdaysHint: "In the business time zone, Monday first.",
    colOrder: "Order",
    colPlaced: "Placed",
    colDeliveredTo: "Delivered to",
    colTotal: "Total",
    colPromotion: "Promotion",
    colDate: "Date",
    colSaved: "Saved",
    openOrder: "Open order {code}",
    // The best-in-class pass (2026-11): list footer and the two-column profile.
    shownCount: "{count} shown",
    shownOf: "{shown} of {total}",
    tileAverage: "Average order ({code})",
    lastOrderAgo: "Last ordered {when}",
    call: "Call",
    otherAddresses: "Other addresses ({count})",
    accountTitle: "Account",
    statusLabel: "Status",
    joinedLabel: "Joined",
    ordersCount: "Orders ({count})",
    firstOrderOn: "First order {when}",
    weekdayShort: {
      sun: "Sun",
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
      sat: "Sat",
    },
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
    // Drivers exist, but none is inside their working hours right now.
    noDriversOnShift: "No driver is on shift right now.",
    seeDrivers: "See their hours",

    // The first two lines are what the WhatsApp notification shows: the
    // code, and the shape of the trip.
    heading: "New delivery {code}",
    tripOne: "1 pickup, then the customer",
    tripMany: "{count} pickups, then the customer",
    placed: "Ordered {when}",
    // Kept for the cancellation message.
    customer: "Customer: {name}",
    phone: "Phone: {phone}",
    map: "Map: {url}",
    note: "Customer's note: {note}",
    // Every stop is numbered, pickups first and the door last, so the
    // message reads as the trip.
    stopPickup: "Stop {n} · Pick up at {store}",
    stopDeliver: "Stop {n} · Deliver to {name}",
    // What the driver hands the shop at the pickup.
    payShop: "Pay the shop: {amount}",
    // A commission shop's bag, added up, before the commission comes off
    // it — only when there is more than one line to add.
    bag: "Items: {amount}",
    // What the platform keeps of a commission pickup, said before what the
    // shop is paid so the shop sees why it is less than the bag (`0262`).
    // Markup is never said: the lines are already at the shop's own prices.
    commission: "Less {percent}% commission: −{amount}",
    lineNote: "Note: {note}",
    // A fixed-size item ordered more than once: "2 × Rice (500 g each)". The
    // shop packs two 500 g bags, not one of a kilo.
    packEach: "{size} each",
    // The customer's bill on one line: "Items $8.43 + delivery $2.65".
    subtotal: "Items {amount}",
    delivery: "delivery {amount}",
    discount: "discount {amount}",
    // Cash on delivery is the only payment method, so the total *is* what the
    // driver collects. Saying "total" would leave them to work that out.
    collect: "Collect from the customer: {amount}",
    // What the driver holds once every shop is paid and the customer has
    // paid them — the figure the operator settles with them.
    cashLeft: "Left with you after paying the shops: {amount}",
    // The rate had not loaded, so no figure here would be trustworthy. Better
    // to say so than to send a number that might be wrong by a hundredfold.
    amountUnknown: "Amount: see the dashboard.",

    /*
     * The kitchen's ticket. Shorter than the driver's on purpose — see
     * `kitchenMessage`. No address, no phone, no money: a shop cooking one half
     * of an order has no reason to hold a customer record, and a total they
     * cannot collect is a number they might act on.
     */
    kitchenHeading: "New order {code}",
    kitchenFor: "Name on the bag: {name}",
    // The driver pays the shop at the pickup (user, 2026-11-07), so the shop
    // is told it will be paid then — without the figure, see `kitchenMessage`.
    kitchenFooter:
      "Our driver will collect it and pay you at pickup. If anything is out of stock, reply here before you start.",
    kitchenSend: "Send",
    kitchenTitle: "Send {code} to the kitchen",
    kitchenBlurb:
      "Each shop gets only its own items. No address, no phone number and no total — the driver carries those.",
    kitchenNoNumber: "No WhatsApp number for this shop.",
    kitchenAddNumber: "Add one",
    kitchenTab: "Shops",
    kitchenAll: "Notify all shops ({count})",
    kitchenRest: "Notify the other {count}",
    kitchenBlocked:
      "Your browser blocked the other chats as pop-ups. Click the blocked pop-up icon at the right of the address bar, choose “Always allow pop-ups”, then press the button again. You only do this once.",
    kitchenAllDone: "All chats opened",
    popupHelpTitle: "How to open all chats in one click",
    popupStep1: "In a new Chrome tab, navigate to",
    popupStep2: "Under “Allowed to send pop-ups and use redirects”, click Add.",
    popupStep3: "Enter this dashboard’s address and click Add:",
    popupStep4: "Come back to this tab and refresh the page.",
    popupNote:
      "Once per computer, for each dashboard address. Nothing is sent until you press Send in each chat.",
    // Chrome will not let a web page open a chrome:// address, so the link
    // copies it instead, and says where to put it.
    popupCopied: "Copied — paste it into a new tab’s address bar",
    popupCopyAddress: "Copy this dashboard’s address",
    kitchenSent: "Opened",
    driverTab: "Driver",

    // The dialog's three steps, in the order they happen.
    stepKitchen: "Tell the kitchen",
    stepDriver: "Choose a driver",
    stepDriverHint: "Only drivers on shift right now are listed.",
    stepPreview: "Check the message and send",
    previewTo: "To {name}, {phone}",
    chooseFirst: "Choose a driver to see the message they will get.",
    sendTo: "Send to {name}",
    // On the row of the driver who already has the order.
    holderBadge: "Has it",
    showMessage: "Message",
    hideMessage: "Hide",
    copyMessage: "Copy the message",
    popupCopySettings: "Copy the settings address",

    // A lira total the server rounded to its cash step (0173), so the lines
    // above the amount to collect add up to it.
    rounding: "rounding {amount}",
    // The same figure in the other currency, on the same line after it.
    collectOther: "or {amount}",

    // Who has it already, at the top of the driver list.
    alreadyWith: "Already with {name} since {when}",
    // On the current holder's own row: re-opens the chat, records nothing.
    sendAgain: "Send again",
    reassignTitle: "Hand it to {name} instead?",
    reassignBody:
      "{name} has this order and its address in their messages already. Tell them it is off once you have sent it on.",
    someoneElse: "Another driver",
    reassignBack: "Back",
    reassignConfirm: "Hand it to {name}",
    // The record landed but the browser would not open a window for the chat.
    openChat: "Open the chat with {name}",
    finished: "This order is finished — there is nothing to hand to a driver.",

    // Refusals from api_v1_dispatch_order (0173).
    alreadyDelivered: "This order has already been delivered.",
    alreadyTaken: "Somebody has just handed this order to another driver.",
    driverGone: "That driver is no longer on the books. Choose somebody else.",

    // Standing a driver down when an order they hold is cancelled.
    tellDriver: "Tell {name}",
    cancelHeading: "Cancelled — {code}",
    cancelBody:
      "This order has been cancelled. Please do not collect or deliver it. Sorry for the trouble.",
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
    // The switch ends when our hours next turn (0280), and says when.
    overrideOnUntil:
      "Taking orders until {time}, whatever their hours say. Then back to their hours.",
    overrideOffUntil:
      "Not taking orders until {time}, whatever their hours say. Then back to their hours.",
    noWeek:
      "No working days set, so this driver is never offered for an order.",
    hoursTitle: "When they work",
    // The editor's side column: the week read back, and what it adds up to.
    weekTitle: "Their week",
    weekTotals: "{days} working day(s), {hours} hours a week",
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

    // The rebuilt screens (2026-11).
    failed: "Could not load the drivers.",
    emptyBody:
      "Add the people who carry orders. Each one is offered on the order screen while they are on shift.",
    noneBody: "Try part of the name, or the last few digits of the number.",
    emptyActive: "Nobody is taking orders right now.",
    emptyActiveBody:
      "Drivers appear here while they are inside their hours, or switched on for tonight.",
    emptyOff: "Everyone on the books is taking orders.",
    emptyInactive: "Nobody has been deactivated.",
    rowActions: "Actions for {name}",
    rotaNote: "Following their hours.",
    notFoundBody: "They may have been removed, or the link is wrong.",
    newBlurb:
      "A name, the WhatsApp number orders are sent to, and the hours they work.",
    editBlurb:
      "Changes apply straight away: the order screen offers drivers by these hours.",
    detailsTitle: "Details",
    detailsBlurb:
      "The name the team knows them by, and the number the order goes to on WhatsApp.",
    nameRequired: "Enter their name.",
    hoursBlurb:
      "They are offered on orders only inside these hours, in the business time zone. A shift may run past midnight. For a one-off evening, use the switch on their page instead of changing the week.",
    nowTitle: "Right now",
    nowBlurb:
      "Whether the order screen offers them for an order at this moment.",
    weekBlurb: "The week read back. Check it against what they told you.",
    editHours: "Edit hours",
    hoursSheetBlurb:
      "Switch a day off to leave them out that day. Saving replaces the whole week.",
    handoversBlurb: "The latest orders sent to them, newest first.",
    colOrder: "Order",
    colHanded: "Handed over",
    colStatus: "Status",
    colDelivery: "Delivery fee",
    // The order's total less our commission, then the commission: the two
    // add up to what the customer paid.
    colWithoutCommission: "Order (without commission)",
    colCommission: "Our commission",
    // What the driver hands in to us: our commission plus the delivery fee the
    // customer paid — none on a free delivery.
    colToCollect: "Total",
    totalsRow: "Totals",
    totalsSkipped: "Cancelled orders not counted",
    // Free delivery from a promotion (0203): the customer paid no fee, so the
    // driver collected none and hands none in. The fee stays on screen, struck
    // through, because it is what the promotion cost us.
    freeDeliveryHint:
      "A promotion made delivery free. The customer paid none of the {fee} fee, so it is not in Total.",
    // A row kept on the first driver's page after the order was reassigned.
    movedTo: "Handed on to {name}",
    rangeToday: "Today ({count})",
    rangeAll: "All ({count})",
    noneToday: "Nothing handed to them today yet.",
    timeLabel: "{day}, {which}",
    inactiveNote:
      "Deactivated: they are not offered on orders. Bring them back to put them on the rota again.",
    // The roster's shift line (Onfleet/Tookan style).
    onUntil: "Until {time}",
    nextShift: "Next shift {day} {time}",
    nextShiftToday: "Starts today {time}",
    noHours: "No hours set",
    overruled: "Overruled tonight",
    overruledUntil: "Overruled until {time}",
    // A week with no minute inside our ordering hours: never offered (0280).
    outsideOurHours: "Hours are outside ours",
    // On a day in the hours grid that runs past our ordering hours (0280).
    pastOurHours: "Past our hours ({open}–{close})",
    whatsapp: "Message on WhatsApp",
    shownCount: "{count} driver(s)",
    groupOn: "Taking orders ({count})",
    groupOff: "Off shift ({count})",
    statsTitle: "Hand-overs",
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
    // In place of the total while the database works out the first one (0233).
    pricing: "Working it out…",
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

    // Refusals from api_v1_amend_order (0173). Each one closes the form,
    // because saving again from it would be refused the same way.
    changedElsewhere:
      "Somebody else changed this order while you had it open. It has been reloaded — open it again to make your change.",
    lineAlreadyChanged:
      "One of these lines was already replaced by an earlier change. The order has been reloaded — open it again.",
    // 0184: a substitute is held to the basket's caps.
    tooMany: "A substitute can be at most 50 of one dish.",
    tooHeavy: "A substitute can be at most {amount} of one dish.",
    noRate:
      "The exchange rate this order needs is missing. Set it under Pricing, then try again.",
    tooLate:
      "This order can no longer be changed — it is on its way, delivered or cancelled.",

    // The before/after under the form, and the question Save asks.
    before: "Was",
    unchanged: "Set what is coming",
    review: "Review the change",
    keepEditing: "Keep editing",
    confirmTitle: "Save the change to {code}?",
    confirmBody:
      "The customer is charged the new total. Make sure they agreed to it on the phone.",
    summaryNone: "{name} — not coming",
    summaryShort: "{name} — {to} instead of {from}",
    summarySwap: "{name} sent instead of {original}",
    // Every line is already the result of an earlier change.
    nothingLeft:
      "Every line has already been changed once. There is nothing left to change here.",
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
    tabReceipt: "Receipt",
    title: "Activity",
    description: "Changes and hand-overs, newest first.",
    now: "Now",
    // Status moves are not stored one by one — only where the order stands.
    statusNote:
      "Where the order stands now. Each status change is not recorded separately.",
    placed: "Order placed",
    placedBy: "By {name}",
    failed: "Could not load this order's activity.",
  },

  /**
   * The settings that belong to the business rather than to a row.
   *
   * Each one says its *consequence*, not just its name. Moving the closing hour
   * moves what "today" means on the queue and in every report, and a label
   * reading "Opens at" alone would hide that behind a dropdown that looks like
   * a preference.
   */
  general: {
    tab: "General",
    /**
     * Named, not "Saved".
     *
     * Three controls on this tab wrote the same word, and two of them can be
     * pressed a second apart — so a stack of identical pills said something had
     * happened without saying what. See `savedKey`.
     *
     * `saved` stays as the fallback for a patch that touches something no
     * message has been written for yet, which is better than a toast that says
     * nothing at all.
     */
    saved: "Saved",
    savedClock: "Clock format saved",
    savedHours: "Ordering hours saved",
    savedSound: "New-order sound saved",
    savedZone: "Time zone saved",

    clockTitle: "Times",
    clockLabel: "Clock",
    clockHint:
      "How times read across the dashboard and the app. Both show the same thing, so a total read down the phone matches the customer's screen.",
    clock24: "22:00",
    clock12: "10:00 PM",
    // The business clock (0183): the list comes from the `timezones` table.
    zoneLabel: "Time zone",
    zoneHint:
      "Every time in the dashboard and the app is shown in it, and every day in the reports is cut by it — wherever the screen reading it is.",

    shiftTitle: "When you take orders",
    // The consequence, before the control rather than after it.
    shiftBlurb:
      "The closing hour is also where a day ends. “Today” on the queue and every day in the reports end there — so a night that closes at 02:00 counts as one day’s trade rather than two half-nights, and once you close, “Today” starts fresh.",
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

    // The oldest customer app still served (0178), and where it updates from.
    customerAppTitle: "Customer app",
    customerAppBlurb:
      "A phone running an older version than the minimum sees an “Update the app” screen and cannot order until it updates. Its Update button opens the store link below.",
    minVersionIos: "Oldest iPhone version",
    minVersionAndroid: "Oldest Android version",
    minVersionHint: "Like 1.4.0. Empty means no minimum.",
    minVersionInvalid: "Numbers and dots only, like 1.4.0",
    // The consequence, said before the Save rather than discovered after it.
    minVersionWarning:
      "Raising a minimum blocks everyone on an older version straight away. Publish the new build in both stores first, and wait until it is live.",
    iosStoreUrl: "App Store link",
    androidStoreUrl: "Google Play link",
    storeUrlInvalid: "Must be a full link starting with https://",
    saveCustomerApp: "Save app settings",
    savedCustomerApp: "Customer app settings saved",

    // The bucket sweep (`api/images/unused`, migration 0188).
    unusedTitle: "Unused pictures",
    unusedBlurb:
      "Pictures and sounds that nothing points at any more: ones you replaced, ones from things deleted for good, and uploads from forms that were never saved. Archived items keep theirs, so a restore comes back with its picture. Uploads from the last day are left alone.",
    unusedChecking: "Checking…",
    unusedNone: "Nothing to clear.",
    unusedOne: "1 file nobody uses ({size}).",
    unusedMany: "{count} files nobody uses ({size}).",
    unusedRemove: "Remove them",
    unusedConfirmTitle: "Remove unused pictures?",
    unusedConfirmBody:
      "{count} files ({size}) are deleted from storage for good. Nothing in the app or the dashboard uses them, and none was uploaded in the last day.",
    unusedConfirm: "Delete files",
    unusedRemoved: "Removed {count} files ({size})",
    unusedSomeFailed:
      "{count} files could not be removed. Try again in a while.",
    unusedForbidden: "Only an admin can clear storage.",
    unusedNotReady:
      "This database is missing migration 0188, so it cannot say which pictures are in use. Nothing was deleted.",
    // Said as the refusal it is: either answer here means the sweep cannot tell
    // used from unused, and deleting on a guess would empty the app.
    unusedMismatch:
      "Storage and the database do not look like the same environment, so nothing was deleted. Check S3_BUCKET against the Supabase project this dashboard is using.",

    // The redesigned Settings screen (lebrunji-admin).
    tabCustomerApp: "Customer app",
    clockBlurb:
      "How times are written, here and in the customer app, and which clock every day is measured by.",
    clockFormatAria: "Clock format",
    zoneConfirmTitle: "Switch the business clock to {zone}?",
    zoneConfirmBody:
      "Every time in the dashboard and the customer app moves to {zone}, and every report day is cut by it from now on. Opening hours stay the same numbers, now read in the new zone.",
    zoneConfirm: "Switch time zone",
    shiftZone: "Hours are read in {zone} time.",
    shiftSameHour:
      "Opening and closing at the same hour means orders are taken around the clock.",
    customerAppMissing:
      "This database does not have the customer-app settings yet (migration 0178), so there is nothing to set here.",
    latestTitle: "Newest version in the stores",
    latestBlurb:
      "Customers on an older version are invited to update, once for each release, and can choose Not now. Enter a version only after it is live in that store.",
    latestVersionIos: "Newest iPhone version",
    latestVersionAndroid: "Newest Android version",
    latestVersionHint: "Like 1.4.0. Empty means no invitation.",
    versionsTitle: "Oldest version still allowed",
    versionsBlurb:
      "Customers on an older version are stopped at an “Update the app” screen and cannot order until they update.",
    storeLinksTitle: "Store links",
    storeLinksBlurb:
      "Where the “Update” button on that screen sends customers. Set these before raising a minimum.",
    minVersionConfirmTitle: "Block older versions of the app?",
    minVersionConfirmBody:
      "From the next launch, customers below {versions} see the update screen and cannot order until they update. Make sure that build is already live in the store.",
    minVersionConfirm: "Block older versions",
    unusedFailedTitle: "Could not check storage",
    pageBlurb:
      "The business clock, the hours you take orders, and how a new order is announced. Each setting saves on its own.",
    hoursLabel: "Ordering hours",
    alertsTitle: "Alerts",

    // Pausing orders (0256): the customer app keeps browsing and says why.
    pauseTitle: "Pause orders",
    pauseBlurb:
      "Stop taking orders right now, whatever the hours say — rain, no riders, a holiday. Customers can still browse; the app tells them orders are paused and when you’ll be back. Orders already placed carry on.",
    pauseLabel: "New orders",
    pauseTaking: "Taking orders",
    pauseClosed: "Outside your hours — the app says when you open",
    pausedUntil: "Paused until {time}",
    pausedOpen: "Paused until you resume",
    pauseButton: "Pause orders…",
    resumeButton: "Resume orders",
    pauseDialogTitle: "Pause new orders?",
    pauseDialogBody:
      "Customers can still browse and keep their baskets, but nobody can place an order until the pause ends.",
    pauseFor: "For how long",
    pause30: "30 min",
    pause60: "1 hour",
    pause120: "2 hours",
    pauseRest: "Rest of tonight",
    pauseManual: "Until I resume",
    pauseRestHint: "Lifts by itself at your opening hour, {time}.",
    pauseLiftsAt: "Lifts by itself at {time}.",
    pauseManualHint: "Stays on until somebody presses Resume.",
    pauseNoteEn: "Message in English",
    pauseNoteAr: "Message in Arabic",
    pauseNoteHint:
      "Shown in the app instead of the standard words. Leave blank to use those.",
    pauseConfirm: "Pause orders",
    savedPause: "Orders paused",
    savedResume: "Orders resumed",
    pauseMissing:
      "This database does not have migration 0256 yet, so orders cannot be paused from here.",
  },

  /**
   * Order status names — hardcoded, like the path itself. See
   * `src/lib/order-status.ts`. The app's own wording, so the operator and the
   * customer call a step the same thing.
   */
  orderStatus: {
    ordered: "Placed",
    confirmed: "Confirmed",
    driverSent: "On the way",
    delivered: "Delivered",
    cancelled: "Cancelled",
  },

  /** Changing a delivered or cancelled order's status — `reopen-dialog.tsx`, 0259. */
  reopen: {
    open: "Change status",
    title: "Change the status of {code}",
    blurb:
      "This order is {status}. If that was a mistake, choose where it really is.",
    question: "Where is this order?",
    pick: "Choose a status",
    means: {
      ordered: "Back to the start. The shop has to confirm it again.",
      confirmed: "Accepted and being prepared.",
      driverSent: "With a driver, on the way to the customer.",
      delivered: "It reached the customer after all.",
      cancelled:
        "It never arrived. Any promotion it used goes back to the customer.",
    },
    customerSees: "The customer's app shows the new status straight away.",
    samePrice:
      "It keeps the price the customer was quoted, promotion included, even if that promotion has run out since.",
    tellShop:
      "Nobody else is told. Let the shop know, and send a driver when it is ready.",
    notFinished:
      "This order is not delivered or cancelled any more. Someone may have reopened it already. The screen now shows where it is.",
  },

  orders: {
    title: "Orders",
    searchPlaceholder: "Search by order code",
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
    todayEmptyBody: "No orders have been placed today.",
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
    // The name comes from the account; an unfinished signup has none, and the
    // toast falls back to `arrived` rather than "New order from ".
    arrivedFrom: "New order from {name}",
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
    // The app's own eyebrow over the address on its order page.
    deliveringTo: "Delivering to",
    itemCount: "{count} items",
    itemCountOne: "1 item",
    fromShops: "from {count} shops",
    nextStep: "Next step",
    otherActions: "Other actions",
    courierNote: "Note for the courier: ",
    items: "Items",
    subtotal: "Subtotal",
    delivery: "Delivery",
    discount: "Discount",
    total: "Total",
    payment: "Payment",
    cancel: "Cancel",
    cancelTitle: "Cancel this order?",
    // It reaches a person who is waiting, and it is not a button to press
    // lightly: the way back (0259) is a deliberate correction, not an undo.
    cancelBody:
      "The customer is told immediately. If this turns out to be a mistake, use Change status on the order to reopen it.",
    cancelConfirm: "Cancel the order",
    keepOrder: "Keep the order",
    collapsePanel: "Collapse the order",
    expandPanel: "Expand the order",
    resizePanel: "Resize the order panel",
    moveTo: "Mark as {status}",
    detailFailed: "Could not load this order.",
    noPhone: "No phone number",
    copyPhone: "Copy phone number",
    copyCode: "Copy order code",
    // A multiplication sign, not the letter x — and a translated string rather
    // than a literal, because where the number sits relative to it is not
    // universal.
    quantity: "×{count}",
    locationLabel: "Where {name} is",
    // The receipt's line for the server's cash rounding (0173), shown only
    // when the total differs from the lines above it.
    rounding: "Rounding",

    // Refusals from api_v1_advance_order. The queue rolls back and refetches
    // either way, so both say what is true now rather than what failed.
    movedElsewhere:
      "This order was moved by someone else. The screen now shows where it is.",
    wasCancelled: "This order was cancelled. Nothing was moved.",
    driverHoldsOrder:
      "A driver has this order, so it can't go back. Reassign it or cancel it instead.",

    // The order's own page.
    changedAt: "Changed {when}",
    detailFailedBody:
      "The connection may have dropped, or the link is wrong. Nothing has been changed.",
    atAGlance: "At a glance",
    phone: "Phone",
    shops: "Shops",

    // How long an order has waited, counted from placement (order-age.tsx).
    waitJustNow: "Just now",
    waitMinutes: "{count} min",
    waitHours: "{hours} h",
    waitHoursMinutes: "{hours} h {minutes} min",
    waitDays: "{count} d",
    waitHint: "Waiting {time} since it was placed",
    waitLateHint: "Waiting {time} since it was placed. Overdue.",
    waitLateShort: ", overdue",
    // The browser tab's title while orders are unanswered, so a tab in the
    // background still says there is work.
    tabTitleWaiting: "({count}) {title}",
    lateCount: "{count} overdue",
    columnCount: "({count})",
    // Board and list.
    viewLabel: "Layout",
    viewList: "List",
    viewBoard: "Board",
    boardEmptyOrdered:
      "No new orders. New ones land here and the dashboard chimes.",
    boardEmptyConfirmed: "Nothing confirmed is waiting for a driver.",
    boardEmptyDriverSent: "No order is on the road.",
    boardFailed: "Could not load this column.",
    amendedBadge: "Changed",
    // Live orders are worked oldest first, like a ticket rail.
    oldestFirst: "Oldest first",
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
    // The refusals 0196 raises — aisles and sub-aisles.
    needsSubAisle:
      "On an aisles shop a product goes in a sub-aisle, not directly on an aisle.",
    sectionHasSubAisles:
      "This aisle has sub-aisles. Put the product in one of them.",
    oneLevel: "Aisles go one level deep: an aisle, then its sub-aisles.",
    subAisleHoldsProducts:
      "This sub-aisle holds products, so on an aisles shop it cannot become an aisle of its own. Move it under another aisle instead.",
    aisleArchived: "Its aisle is archived. Restore the aisle first, then this.",
    aisleHoldsSubAisles:
      "This aisle still holds sub-aisles. Move or archive them first.",
    // 0261: the database refuses an aisle or sub-aisle without a picture.
    needsPicture:
      "Aisles and sub-aisles need a picture. Add one, then save again.",
  },

  form: {
    optional: "optional",
    requiredSr: "(required)",
    requiredLegend: "Fields marked * are required.",
    unsaved: "Unsaved changes",
    discard: "Discard",
    save: "Save",
    // Names the languages rather than saying "incomplete": the operator has
    // done most of the work, and what they need is which box is empty.
    stillNeeded: "Still needed in: {languages}",
    // Names the characters rather than saying "invalid". A key that does
    // nothing is pressed harder; a key that says why is not pressed again.
    rejectedChars: "{chars} cannot be used in a name.",
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
    // Said once, above the list — since `0206` this order is the app's too,
    // and an operator dragging a row should know customers will see it move.
    reorderHint:
      "Drag to set the order shops appear in the app — in Featured, Open now and every list.",
    openMenu: "Menu",

    // ---- the shops list, rebuilt -----------------------------------------
    shopsTitle: "Shops",
    shopsDescription:
      "Every shop in the app, in the order customers see them. Open one to edit its menu, branches and hours.",
    filter: {
      all: "All ({count})",
      live: "Live ({count})",
      hidden: "Hidden ({count})",
    },
    filterEmpty: {
      all: "No shops yet",
      live: "No shop is live",
      hidden: "No hidden shops",
    },
    showAll: "Show all shops",
    count: "{count} shops",
    countOne: "1 shop",
    // Why the handles went away — said only when there is something to sort.
    reorderOff: "Clear the search and show all shops to change the order.",
    // A chain's row, where more than one place is unpinned.
    noPinCount:
      "{count} branches have no pin — their deliveries are charged at the top band",
    archiveTitleNamed: "Archive {name}?",
    moreFor: "More actions for {name}",
    openShop: "Open shop",
    archiveShop: "Archive shop",
    // The state a customer meets right now, under each shop's name.
    branchCount: "{count} branches",
    editHours: "Edit hours",
    filter2: {
      openNow: "Open now ({count})",
      closedNow: "Closed now ({count})",
    },
    filterEmpty2: {
      openNow: "No shop is open right now",
      closedNow: "Every live shop is open right now",
    },
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
    // A dish's photo. Says what happens without one (0153), since the box
    // being empty is allowed and the team asks.
    hint: "Without one, the app shows a placeholder. Shown on the menu card, the Home rail and the dish page.",
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
    // The size it is and the shape it should be, so the fix is in the message.
    wrongShape:
      "This picture is {width} × {height}. It needs to be {shape} — the app crops anything else.",
    // `cutout` uploads: category, aisle and sub-aisle art, laid on the app's
    // own tiles. A JPEG always lands here — it cannot be transparent.
    needsCutout:
      "This picture has a background. Use a PNG or WebP with a transparent background — the app puts it on its own tile.",

    // The thumbnail's accessible name. It is a button now — every picture in
    // the dashboard opens full size — so it needs one, and the version that
    // names the row is what stops a list announcing the same three words on
    // every line.
    view: "View the picture",
    viewOf: "View the picture of {name}",
    // The heading over the full-size view, for the few call sites with no name
    // to put there.
    preview: "Picture",

    // Shop and dish photos: cropped to their shape on upload, then the
    // subject marked, so the app crops around it (`ImageFramer`).
    adjust: "Adjust framing",
    frame: {
      title: "Frame the picture",
      titleAdjust: "Adjust the framing",
      description:
        "Crop it to {shape}, then click the dish or the shopfront. The app keeps that point in view wherever it shows the picture.",
      descriptionAdjust:
        "Click the dish or the shopfront. The app keeps that point in view wherever it shows the picture.",
      crop: "Crop",
      cropHint:
        "Drag the frame, or use the arrow keys, to choose what is kept.",
      zoom: "Zoom",
      focus: "Subject",
      focusHint: "Click where the subject is",
      reset: "Back to the middle",
      inTheApp: "How it looks in the app",
      use: "Use this picture",
      // The crop has too few pixels for the page's cover, the largest place
      // the photo is shown. Live: zooming in too far brings it up.
      softShop:
        "This picture is {pixels} pixels wide. The shop page needs about {needed} to look sharp, so it will look soft there. Use a bigger photo, or zoom out.",
      softDish:
        "This picture is {pixels} pixels wide. The dish page needs about {needed} to look sharp, so it will look soft there. Use a bigger photo, or zoom out.",
      cannotOpen:
        "This file could not be opened as a picture. Try a JPEG, PNG or WebP.",
      // The app's frames, named as the team knows them.
      card: "Menu card",
      rail: "Home rail",
      dishPage: "Dish page",
      homeCard: "Home card",
      featured: "Featured",
      thumb: "Thumbnail",
      shopPage: "Shop page",
    },
    // The shape in words, then its ratio — "Square 1:1". Chosen by the ratio
    // in `ImageUploader`; the team says "square" and "wide", not "21:9".
    shapeName: {
      square: "Square {shape}",
      portrait: "Portrait {shape}",
      landscape: "Landscape {shape}",
      wide: "Wide {shape}",
    },
  },

  /**
   * "Make it with ChatGPT" under a required picture (`ImagePrompt`). The
   * prompts themselves are in `lib/image-prompts.ts` — they are input to a
   * model, not chrome, and stay English.
   */
  imagePrompt: {
    title: "Make it with ChatGPT",
    intro: {
      category:
        "The same prompt every category's icon was made with, so a new one matches the strip: a glossy 3D group of things from that kind of shop, on a transparent background.",
      aisle:
        "The same prompt every aisle's picture was made with, so a new one matches its neighbours: a glossy 3D group of products from the aisle, on a transparent background.",
      subAisle:
        "The same prompt every sub-aisle's picture was made with: the product itself in glossy 3D, with how it is eaten or used, on a transparent background.",
      tag: "The same prompt every tag icon was made with: a small cartoon sticker with a dark outline, on a transparent background.",
      tile: "The house style for cards: one bold, playful idea, shot on plain red, yellow or cream.",
      banner:
        "The house style for banners: one bold, playful idea on plain red, yellow or cream, with room on the left for the words.",
    },
    subject: "What to draw",
    subjectPlaceholder: "Filled in from the English name",
    idea: "The idea",
    ideaPlaceholder: "A delivery rider racing a cheetah",
    headline: "Words on the picture (optional)",
    headlinePlaceholder: "20% off your first order",
    promptLabel: "The prompt",
    copy: "Copy prompt",
    open: "Open ChatGPT",
    step1: "Paste the prompt into ChatGPT and download the picture it makes.",
    step2: "Drop the downloaded file into the box above.",
    stepCutout:
      "If it comes back with a background, ask ChatGPT: “Make the background transparent.”",
    stepArabic:
      "For the Arabic picture, ask ChatGPT for the same image with the words in Arabic, and upload it in the Arabic box.",
  },

  /**
   * A shop's own settings, as opposed to what it sells.
   */
  store: {
    // ---- adding one -------------------------------------------------------
    add: "New shop",
    create: "Create shop",
    stepDetails: "Shop details",
    stepPlace: "Where it is",
    stepHours: "Opening hours",
    nextPlace: "Next: where it is",
    nextHours: "Next: opening hours",
    back: "Back",
    hoursBlurb:
      "When the shop takes orders. A day left closed is closed in the app — open at least one.",
    hoursNotSaved:
      "The shop was created, but its hours could not be saved. Set them here.",
    created: "{name} added — set up its menu next",

    category: "Main category",
    categoryHint:
      "What kind of shop this is. It is always one of the categories the shop is listed under.",
    pickCategory: "Choose a category",
    categoryRequired: "Every shop belongs to a category.",
    // The rest of `store_categories` (0136): where else the shop is listed.
    otherCategories: "Also listed under",
    otherCategoriesHint:
      "Other categories customers can find this shop under. Optional.",
    otherCategoriesPlaceholder: "Add a category",
    // The trigger refusing to unlink the main category. Reached only by a
    // stale tab; says what to do first.
    mainCategoryKept:
      "A shop's main category cannot be removed. Choose a different main category first.",

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
    /*
      The shop's own dollar rate — `0120`.

      Named for the decision rather than for the column: an operator setting
      this is answering "what is a dollar worth here", and the answer is a
      number they already argue about with the shop.

      The placeholder carries the platform's current rate, so leaving the box
      empty is a decision somebody can see the consequence of rather than an
      absence.
    */
    /*
      Both currencies named, and the direction with them.

      "Dollar rate" is what people actually say here — سعر الدولار — and it is
      the wrong label for a box you type lira into: it names the currency the
      number is *not* in. "LBP rate" has the opposite problem, reading as what a
      lira is worth rather than what a dollar costs.

      So neither idiom. The codes come from the `currencies` table rather than
      being written in, so the label is right on the day a third currency is
      switched on or a code changes — and `rateGeneric` covers the moment before
      that table has loaded, when a label with two blanks in it would be worse
      than a plain one.
    */
    rate: "{other} per {base} at this shop",
    rateGeneric: "Exchange rate at this shop",
    rateHint:
      "Leave empty to follow the platform rate, and it keeps following it when that changes. A number here is what the app converts this shop's prices at — it does not change what is charged, which is already in the shop's own currency.",
    ratePlatform: "Platform rate ({rate})",
    ratePositive: "A rate has to be more than zero.",

    // Featuring, asked on the form rather than only on the list — see
    // `StoreDraft.isFeatured`.
    featured: "Featured",
    // The plain negation, not a euphemism for it. "Normal" described the shop
    // rather than the switch, so the off state read as a category the shop was
    // in rather than as the thing the toggle does.
    notFeatured: "Not featured",
    featuredHint:
      "It leads the home screen, above the shops that are not featured.",
    featuredHintOff:
      "It appears in its category like any other shop. You can promote it later from the shops list.",
    // How the app draws the shop's menu — `stores.menu_layout`, 0190/0191.
    // Chosen per shop: nothing infers it from the shop's categories.
    menuLayout: "Menu layout",
    menuLayoutList: "List",
    menuLayoutAisles: "Aisles",
    menuLayoutListHint:
      "A restaurant's menu: each section a list of items, one under the other.",
    menuLayoutAislesHint:
      "A supermarket's: a row of aisle pictures, and each section a shelf customers swipe, with See all for the whole aisle. Products go in sub-aisles — Milk and Cheese under Dairy.",
    // The switch refused by 0196 while products sit directly on an aisle.
    menuLayoutNeedsSubAisles:
      "Some products sit directly on a section. On the aisles layout every product is in a sub-aisle — on the Menu tab, use Move to group sections under an aisle first, then switch.",
    // 0261: the same switch, refused while a section has no picture.
    menuLayoutNeedsPictures:
      "Some sections have no picture. On the aisles layout every aisle and sub-aisle is a tile in the app — on the Menu tab, edit each section without one and add its picture, then switch.",
    hiddenHintNew:
      "Recommended for now — it has no menu or opening hours yet. Turn it on from the shops list when it is ready.",

    mapEmpty: "No pin yet — paste a link or coordinates above.",
    noDefaultCountry:
      "No default country is set up, so a shop cannot be created. That is a database seed, not a setting on this screen.",

    /*
      The Details tab, back on the shop's own page.

      It was folded into the branch editor under a heading reading "The shop",
      which is a subheading asked to do the work of a page: the form around it
      was one branch, and the picture uploader beside it wrote to that branch.
      An operator changing "the shop's" picture there changed one place's.

      So the shop's answers are on the shop again, and the intro says which row
      is being edited rather than leaving a heading to imply it.
    */
    detailsTab: "Details",
    detailsIntro:
      "The shop itself. These are shared by every branch — where it is, when it opens and the number an order goes to belong to a branch, on the Branches tab.",
    detailsFailed: "Could not load the shop",
    name: "Shop name",
    nameHint: "What customers see at the top of the shop.",
    imageHint:
      "Without one, the app shows a placeholder. The shop's photo on Home, in search and at the top of its page; every branch without its own uses it.",
    prepTitle: "Preparation time",
    whatsapp: "WhatsApp number",
    // Says what its absence costs, which is the part somebody skipping the
    // field cannot otherwise know.
    whatsappHint:
      "Where an order is sent so the kitchen can start. Without one this shop cannot be sent orders.",
    whatsappPlaceholder: "70123456",
    prepWindow: "Store takes",
    // On the shop's header. The number an order is sent to is the one fact up
    // there somebody acts on, and it used to live two tabs away on the branch.
    copyWhatsapp: "Copy the WhatsApp number",
    noWhatsapp: "No WhatsApp number",
    // Says what the number is *for*, which the label cannot: this is the range
    // the app quotes a customer before they order.
    prepHint: "The range the app quotes with the delivery estimate.",
    prepTo: "to",
    minutes: "minutes",
    /**
     * The shopfront block on Details, shown only for a shop with one branch.
     *
     * Named for the place rather than for the table: "Branch" would be the
     * database's word for something the operator has never had to think of as
     * separate, and the whole point of the block is that they do not have to.
     */
    // The shop forms' other cards — see `StoreEditor`.
    pricesSection: "Prices",
    storefrontSection: "On the storefront",
    placeSection: "Where it is",
    placeSectionHint:
      "This shop trades from one address, so these are edited here. Add a second branch and each one answers for itself.",
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

    // ---- the rebuilt shop pages -----------------------------------------
    addDescription:
      "Everything a shop needs before it can take an order. It is created hidden, so nothing reaches customers until you turn it on.",
    stepShop: "The shop",
    stepShopHint: "Its name, what kind of shop it is, and its picture.",
    stepPrices: "Prices",
    stepPricesHint: "What its menu is priced in.",
    stepPlaceHint:
      "Where an order reaches the kitchen. A chain adds its other branches afterwards.",
    currencyHintNew: "Every price on its menu is in this currency.",
    pinHintNew:
      "Paste a Google Maps link, or right-click the shop in Maps and paste the coordinates. Delivery is charged from here — without a pin every order is charged at the top distance band.",
    pinPlaceholder: "33.8938, 35.5018",
    namePlaceholder: "Nara Kitchen",
    namePlaceholderAr: "مطبخ نارا",
    optional: "Optional",
    visibilityLive: "Live in the app",
    discard: "Discard changes",
    identitySection: "The shop",
    nameHintSole:
      "What customers see at the top of the shop. Its only branch is renamed with it.",
    detailsIntroSole:
      "The shop and the one place it trades from. Add a second branch on the Branches tab and each place is then edited on its own.",
    pricesSectionHint: "What the menu is priced in, and how it converts.",
    currencyMovedNoSample:
      "Every price in this shop will be rewritten in {code}. Choose what should happen to them:",
    currencyConfirmTitle: "Rewrite every price in {code}?",
    currencyConfirmBody: "Every price in this shop is rewritten in one go.",
    currencyConfirm: "Rewrite the prices",
    plusPrice: "+ {price}",
    // The header of a shop's page.
    liveInApp: "Live",
    hiddenInApp: "Hidden",
    orderPhoneHint:
      "Where orders are sent — the first branch's WhatsApp number.",
    readyTitle: "Before you create",
    readyCount: "{done} of {total} done",
    readyDone: "done",
    readyMissing: "still needed",
    statusHidden: "Hidden — customers cannot find this shop",
    statusNoBranch: "No branch is trading, so it cannot take orders",
    statusClosedNow: "Closed right now — outside its opening hours",
    statusOpenNow: "Open now — customers can order",
    statusOpenAt: "Open now at {open} of {total} trading branches",
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
    // Short enough for the 300px read-back panel it sits in — a button never
    // wraps. The hours it copies are listed in "The week" right under it.
    copyToAll: "Apply to all open days",
    incomplete: "Every open day needs an opening and a closing time.",
    // Seven closed days saves as no hours, and no hours is open around the
    // clock (`0170`), so the week is refused and the real off switch named.
    allClosed:
      "Open at least one day. A week with every day closed counts as no hours, and the app treats a shop with no hours as open around the clock. To stop orders, set the shop to Hidden, or set a branch to Closed indefinitely.",
    // The read-back for a branch that has no rows yet.
    noHours:
      "No hours set, so the app shows this branch as open around the clock. Set its hours and save.",
    // For a shop that shuts for the afternoon: 07:00–15:00, then 19:00–01:00.
    addShift: "Add a shift",
    removeShift: "Remove",
    overlap:
      "Two of the hours on {day} overlap. A shift has to end before the next one starts.",
    // The database's refusal, when the editor's own check missed it.
    overlapSaved: "Two of these shifts overlap, so the hours were not saved.",
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

    // ---- the rebuilt week grid -----------------------------------------
    gridTitle: "Each day",
    openOn: "Open on {day}",
    opensAt: "{day} opens at",
    closesAt: "{day} closes at",
    removeShiftOn: "Remove this shift on {day}",
    branchNotTrading:
      "{name} is set to Closed indefinitely, so it takes no orders whatever these hours say.",
    noHoursTitle: "Open around the clock",
    unsavedShort: "Unsaved changes",

    // ---- Google-style status and day actions -----------------------------
    // 00:00 to 00:00, which the app and `place_order` read as the whole day.
    allDay: "Open 24 hours",
    setHours: "Set opening hours",
    dayActions: "More for {day}",
    // Google Business Profile's "Copy to…": one day's hours onto the days
    // ticked. Closed days are offered too, unticked — ticking one opens it.
    copyTo: "Copy to…",
    copyToTitle: "Copy {day}'s hours to",
    copyToAllDays: "Select all",
    copyToApply: "Apply",
    copyToHint: "Closed days you tick open with these hours.",
    back: "Back",
    // Loads another branch's week into the grid; nothing is saved until Save.
    useBranchHours: "Use another branch's hours",
    useBranchHoursNone: "No hours set",
    copiedFromBranch: "{name}'s week is in the grid. Check it, then save.",
    // The line under a place's name: state, then the next change.
    status: {
      allDay: "Open 24 hours",
      noHours: "No hours set, open around the clock",
      closesToday: "Open, closes {time}",
      closesTomorrow: "Open, closes tomorrow at {time}",
      closesOn: "Open, closes {day} at {time}",
      opensToday: "Closed, opens {time}",
      opensTomorrow: "Closed, opens tomorrow at {time}",
      opensOn: "Closed, opens {day} at {time}",
      someOpen: "Open at {open} of {total} branches",
      notTrading: "Closed indefinitely",
      hidden: "Hidden from the app",
      noBranch: "No branch is trading",
    },
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

    // ---- the artwork ---------------------------------------------------------
    //
    // Only the icon is left, and it is required (`categories_icon_required`).
    // The empty-state glyph, its background and the shop page's text colour
    // went with their columns.
    artworkSection: "Artwork",
    artworkSectionHint: "How this category looks in the app.",
    // The editor's card for the two switches.
    showSection: "Where it shows",
    icon: "Category icon",
    iconHint: "Shown beside this category's name in the app's category strip.",
    // Shown by the form and by the api, and for a refusal from the constraint
    // — so it says what to do, which is the same in all three cases. It reads
    // right on a legacy category opened without one, too.
    iconRequired: "Add an icon — every category needs one to be saved.",
    // Reached by a link to a category that has since been archived, or a
    // mistyped id. Says what happened rather than showing an empty form that
    // would create a *new* one on save.
    notFound: "That category is not here any more.",
    visibility: "Visibility",
    live: "Live",
    hidden: "Hidden",
    liveHint: "Customers see this tile on the home screen.",
    hiddenHint:
      "The tile is gone from the app, and so is any shop listed only under it. Shops also listed under a live category stay up.",
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
    showBody:
      "The tile appears on the home screen straight away, and any shop it was hiding comes back.",
    showConfirm: "Show it",
    hideTitle: "Hide {name} from customers?",
    hideBody:
      "The tile disappears from the home screen straight away. No shop depends on it: every shop in it is also listed under a live category and stays up.",
    // `hidesShops` (0266): the shops listed under this and no other live one.
    hideBodyShops:
      "{count} shop(s) are listed only here. They disappear from the app, stop taking orders and leave customers' baskets straight away. Showing the category brings the shops back, but not what was in those baskets.",
    hideConfirm: "Hide it",
    featureTitle: "Feature {name}?",
    featureBody:
      "It leads the home screen, above the categories that are not featured.",
    featureConfirm: "Feature it",
    unfeatureTitle: "Stop featuring {name}?",
    unfeatureBody:
      "It keeps its place in the list; it just no longer leads the home screen.",
    unfeatureConfirm: "Stop featuring",
    // What "archive" will refuse on, said on the row rather than in the
    // refusal. `stillHasShops` below is the same fact arriving too late to be
    // useful; this is it in time to plan around. The same line the tags list
    // carries, for the same reason.
    usedBy: "On {count} shop(s)",
    unused: "No shops yet",

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

    // ---- the redesigned list and sheet ----
    blurb:
      "The tiles customers pick from before they pick a shop. The order here is the order on the home screen.",
    reorderOff: "Clear the search to reorder.",
    reorderOffFiltered: "Show All and clear the search to reorder.",
    filters: {
      all: "All ({count})",
      live: "Live ({count})",
      hidden: "Hidden ({count})",
    },
    filterNames: {
      all: "All",
      live: "Live",
      hidden: "Hidden",
    },
    noneInFilter: "No category in this view",
    count: "{count} categories",
    searchNoneBody: "Try another word, or clear the search to see them all.",
    emptyTitle: "No categories yet",
    emptyBody:
      "Add the first one — every shop belongs to a category, so this comes before shops.",
    noMenuTabs: "No menu tabs",
    actionsFor: "Actions for {name}",
    cannotArchiveTitle: "{name} still has shops",
    edit: "Category",
    newHint:
      "A tile on the app's home screen. It goes to the end of the order.",
    backToList: "Back to categories",
    create: "Add category",
  },

  tags: {
    tab: "Tags",
    blurb:
      "The chips an item can carry. One vocabulary for the whole app — a tag means the same thing on every menu, which is what makes it worth having instead of typing the word on each item.",
    add: "New tag",
    name: "Name",
    nameHint: "Short. It sits beside an item's name, not under it.",
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
    // A link to a tag that has since been retired, or a mistyped id.
    notFound: "That tag is not here any more.",

    // The letters rule (`menu_item_tags_name_letters`). Said as what a name
    // *is* rather than as a refusal — the hint carries it before the error has
    // to. `lettersOnly` names the language; `lettersOnlyAny` is the database's
    // refusal, which cannot say which one.
    lettersHint:
      "Letters only, one space between words — the icon is the picture.",
    lettersOnly:
      "Use letters and single spaces only in the {language} name — no emoji, numbers or punctuation.",
    lettersOnlyAny:
      "A tag name can only hold letters and single spaces — no emoji, numbers or punctuation.",
    // The icon (`menu_item_tags.icon_url`), drawn small before the name.
    icon: "Tag icon",
    iconHint:
      "Shown just before the tag's name, on every item that carries it.",
    // Shown by the form, by the api and for a refusal from
    // `menu_item_tags_icon_required` — including on a legacy tag opened
    // without one, which cannot be saved until it has one.
    iconRequired: "Add an icon — every tag needs one to be saved.",
    // The editor's preview of the chip, beside an item's name.
    previewTitle: "How it looks",
    previewHint:
      "Beside an item's name, in each language. A blank language shows the English.",
    previewEmpty: "Type a name to see the chip.",
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
    alreadyOnDish: "This item already carries that tag.",

    // ---- the redesigned list and sheet ----
    edit: "Tag",
    newHint: "A chip customers see beside a dish's name.",
    backToList: "Back to tags",
    create: "Add tag",
    count: "{count} tags",
    searchNoneBody: "Try another word, or clear the search to see them all.",
    emptyTitle: "No tags yet",
    emptyBody: "Add one, then put it on dishes from a shop's menu.",
    actionsFor: "Actions for {name}",
    // ---- status tabs ----
    filters: {
      all: "All ({count})",
      live: "Live ({count})",
      hidden: "Hidden ({count})",
      unused: "Unused ({count})",
    },
    filterNames: {
      all: "All",
      live: "Live",
      hidden: "Hidden",
      unused: "Unused",
    },
    noneInFilter: "No tag in this view",
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
    // The shop archive's fifth kind, and the only one that is not menu. A
    // closed branch is a place, so the filter says "Branches" rather than
    // borrowing one of the menu's words.
    branches: "Branches",
    stores: "Shops",
    categories: "Categories",
    tags: "Tags",
    promotions: "Promotions",
    // Shown when a filter is on and its own set is empty — distinct from the
    // whole archive being empty, which is a different sentence and a different
    // mascot.
    noneOfThese: "Nothing archived of this kind",
    noneOfTheseBody: "Try another filter, or All.",

    // The search. An archive only grows — nothing here is ever deleted — so
    // it is the one catalogue list where "scroll until you see it" stops
    // working first, and the thing being looked for is by definition old.
    searchPlaceholder: "Search the archive",
    // The shop's own archive names what is in it, because "the archive" on a
    // shop page could be read as the catalogue's.
    searchStorePlaceholder: "Search sections, dishes, questions and choices",
    noMatches: "Nothing matches that",
    // Aimed at the term rather than at the filter: a search that finds nothing
    // is corrected by typing something else, not by pressing another tab.
    noMatchesBody: "Try a different word, or part of a slug.",
    // The heading over one kind, carrying the server's count — "SHOPS · 40"
    // over the ten that have been paged in. A bare heading would say less than
    // the number does.
    groupHeading: "{title} ({count})",
    // Says where it would return to, which is the fact that decides whether
    // pressing the button is safe.
    inSection: "in {name}",
    onDish: "on {name}",
    inQuestion: "{question}, {dish}",
    archivedOn: "Archived {when}",
    // A branch is *closed*, not archived — that is what the button on the
    // Branches tab says, and the archive should not rename the thing it is
    // offering the way back from.
    closedOn: "Closed {when}",
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
    restoreSection:
      "It appears on the menu again. Items archived inside it stay archived until you bring those back too.",
    restoreItem: "It appears on the menu again and customers can order it.",
    restoreGroup: "It is asked again whenever this item is ordered.",
    restoreOption: "It is offered again as an answer to this question.",
    // Says what comes back *with* it, because that is the surprising part and
    // the reason closing a branch is soft in the first place.
    restoreBranch:
      "It trades again, with the prices and hidden items it had. If it was hidden when you closed it, it comes back hidden.",
    restoreStore:
      "It appears in the app again and customers can order from it.",
    restoreCategory:
      "It appears in the app again, with whatever shops you bring back into it.",
    restoreTag:
      "It can be put on items again, and reappears on any that still carry it.",
    restorePromotion:
      "It runs again if its dates still allow — check them, because they come back exactly as they were.",
    restoreConfirm: "Bring it back",
    // The refusal. A dish restored into an archived section is listed by
    // neither the dashboard nor the app, so it is refused rather than mislaid.
    sectionGoneFirst:
      "Bring back {name} first — an item cannot return to an archived section.",
    // The same refusal one tier up: `stores.category_id` is not null, so a shop
    // restored into an archived category is on a shelf nothing draws.
    categoryGoneFirst:
      "Bring back {name} first — a shop cannot return to an archived category.",
    broughtBack: "{name} is back",
    // The catalogue-level archive, above the per-shop one.
    catalogueTitle: "Put away",
    catalogueHint:
      "Archived shops, categories, tags, promotions and bundles. Nothing here is deleted — bring back what you need.",
    catalogueEmptyBody:
      "Archived shops, categories, tags, promotions and bundles collect here.",
    inCategory: "in {name}",
    // A promotion has no customer-facing name, so the slug is the handle — the
    // same one the promotions list shows.
    promotionSlug: "{slug}",
    restored: "{name} is back on the menu",
    sectionRestored: "{name} is back",
    offered: "{name} is offered again",
    branchRestored: "{name} is trading again",
    emptyTitle: "Nothing put away",
    emptyBody:
      "Archived sections and items, withdrawn questions and choices, and closed branches collect here.",
    failedTitle: "Could not load the archive",

    // A shop whose category is archived — the badge in place of the button.
    restoreCategoryFirst: "Category archived",
    restoreNamed: "Bring back {name}",
    // Bundles (`0204`) have no section, so the shop archive never listed them
    // and an archived bundle had no way back. They live here now.
    bundles: "Bundles",
    restoreBundle:
      "It comes back with its dishes, price and dates as they were. It shows in the app again if it is switched on, inside its dates, and every dish in it is on sale.",
    ofShop: "from {name}",
    restoreShopFirst: "Shop archived",
    shopGoneFirst:
      "Bring back {name} first — a bundle cannot return to an archived shop.",
    notABundle: "That is not a bundle.",
    // The tab strip's label with its count, in brackets like every other list.
    tabCount: "{label} ({count})",
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
    withdrawnHint:
      "Withdrawn from the whole shop. Bring it back from the Archive tab.",
    // The picker.
    pickTitle: "Which items ask {name}?",
    pickHint:
      "Tick a whole section, or the items inside it. Items in different sections can be mixed.",
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
    manageDishes: "Choose dishes",
    pickSearch: "Find a dish",
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
    // A display-only size's unit (`0262`); never a "Sold by" unit.
    cm: "cm",
    piece: "piece",
    bag: "bag",
    pack: "pack",
    // More than one of a counted unit: "6 pieces", "2 bags".
    pieces: "pieces",
    bags: "bags",
    packs: "packs",
    // Arabic has three plurals past one, and its dual carries no number, so
    // "Two" is a whole phrase. The same words in English. See `sizeOf`.
    piecesMany: "pieces",
    piecesTwo: "2 pieces",
    bagsMany: "bags",
    bagsTwo: "2 bags",
    packsMany: "packs",
    packsTwo: "2 packs",
    // The size under an item's name: "1 kg", "500 g".
    size: "{quantity} {unit}",
    // The comparison figure beside the price: "$12.00/kg".
    per: "{amount}/{unit}",
    // The editor.
    label: "Sold by",
    hint: "For anything priced by weight or volume. Leave the unit empty for an item sold as itself.",
    none: "No unit",
    quantity: "Amount",
    quantityHint:
      "How much of that unit the price above buys — 1 kg, or 500 g.",
    quantityRequired: "Say how much, or clear the unit.",
    quantityPositive: "The amount must be more than zero.",

    // The step — `0119`. How far the customer's + and − move, which is a
    // different question from how much one of these *is*, and the reason a
    // butcher can say "from five kilos, five at a time".
    step: "Steps by",
    // Says what setting it *does*, since `0122`: a step turns the price into a
    // rate, and that is the decision being made here rather than a detail of
    // the buttons. The preview underneath then shows it happening.
    // Only a step makes the price a rate; without one it is the price of one
    // item of the amount set. The hint used to say the rate happened as soon
    // as the unit was set, which was true only with "Steps by" filled.
    stepHint:
      "The price is for the amount set here. Fill in “Steps by” too and it becomes a rate — any amount costs it in proportion. Leave “Steps by” empty and the customer counts whole items.",
    stepPositive: "The step must be more than zero.",
    // What the buttons will actually do, spelled out. A shop setting this is
    // describing a range, and a range is far easier to check by reading it
    // than by reasoning about two numbers.
    stepPreview: "In the app: {chain}",
    stepPreviewNone: "In the app: 1, 2, 3 × {size}",
    // One stop on that range: what the customer gets, and what they pay for it.
    // The pair is the whole point — an amount with no price beside it is the
    // half of this that was never in doubt.
    stepPreviewStop: "{size}, {price}",

    // A display-only size (`0262`) — "900 g" on a bag of rice. Not "Sold by":
    // it prices and counts nothing.
    sizeLabel: "Size",
    sizeHint:
      "Shown under the name, on the order and in the messages to the driver and the shop — 900 g on a bag of rice. Information only; it does not change the price or how it is counted.",
    sizeAmount: "Size",
    sizeUnit: "Unit",
    sizeNone: "No size",
    sizeBoth: "Give both the size and its unit, or neither.",
    sizePositive: "The size must be more than zero.",
  },

  options: {
    tab: "Options",
    section: "Section",
    pickSection: "Choose a section",
    item: "Item",
    pickItem: "Choose an item",
    // The marker in the picker. A dish with no questions looks complete
    // everywhere else, so this is the only place it can be seen at a glance.
    noneSet: "no options yet",
    noQuestions: "Nothing here yet.",
    saveFirst: "Save this item first, then set up its options.",
    openFor: "Set up this item's options",
    // Both axes of the filter bar named: the selects say *where* a question is
    // asked, this says what it says. Choices are matched too — see
    // `questionIdsMatching`.
    searchPlaceholder: "Search questions and choices",
    noMatches: "No question matches that.",
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
    offerGroupBody:
      "Customers are asked it again whenever this item is ordered.",
    offerGroupConfirm: "Offer it",
    withdrawChoiceTitle: "Withdraw {name}?",
    withdrawChoiceBody:
      "Customers stop being able to pick it. It moves to the Archive tab, where you can bring it back.",
    withdrawChoiceConfirm: "Withdraw it",
    offerChoiceTitle: "Offer {name} again?",
    offerChoiceBody:
      "Customers can pick it again as an answer to this question.",
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
    // NOCHO, 0173: withdrawing the last live choice of a required question.
    lastRequiredChoice:
      "This is the last choice for a required question — make the question optional or add another choice first.",
    rangeImpossible:
      "At least cannot be more than At most — nobody could satisfy that.",

    // The Options tab, redesigned (2026-11).
    filterLabel: "Asked on",
    filterAll: "Every dish",
    filterSection: "Everything in {name}",
    questionCount: "{count} questions",
    newQuestion: "New question",
    renameQuestion: "Rename question",
    moreFor: "More actions for {name}",
    emptyAll: "No questions yet",
    emptyAllBody:
      "A question is what a customer answers when adding a dish — a size, a choice of bread, extras.",
    emptyDish: "This dish asks nothing yet",
    emptyDishBody:
      "Create a question for it, or add it to an existing one with Choose dishes.",
    rules: "Rules",
    atMostInvalid: "A whole number of 1 or more, or leave it empty.",
    defaultBadge: "Opens on this",
    choiceMore: "More actions for {name}",
    addChoice: "Add choice",
    choicesHeading: "Choices",
    // Best-in-class pass (2026-11): what a question is asked on, in names, and
    // its choices in the order customers read them.
    askedOn: "Asked on",
    askedOnMore: "and {count} more",
    askedOnNone: "No dish asks this yet. Choose dishes to start asking it.",
    choicePrice: "{name} +{price}",
    reorderChoicesHint:
      "Drag to set the order customers see. It is the same on every dish.",
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
    // What the base currency *is*, said on the screen that owns it.
    //
    // It reads as "the platform's currency" and it is not: since `0110` a shop
    // and even a single branch may price in another, and the operator who sets
    // one needs to know this is the fallback rather than the law. Named on the
    // rate card because that is the only screen the base currency appears on
    // by itself.
    baseTitle: "{code} is the default for all shops",
    baseBody:
      "Every shop prices in it unless it is given one of its own — on the shop's own form, or on a single branch's.",

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
    // Since `0193` a missing pin is refused rather than priced at the top
    // band, so "or one whose distance cannot be worked out" is gone. What the
    // top band does now: the edge for one shop's leg, and the longest ride one
    // multi-shop order may take.
    radiusMeans:
      "You do not deliver past {km} km. It is also the longest ride one order from several shops may take.",
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

    // The stop fee for a multi-shop order. `0133` added it to the farthest
    // leg; since `0193` it is added to the price of the whole route, and the
    // total is capped at what separate orders would cost.
    extraTitle: "Each extra shop",
    extraBody:
      "Added once for every shop after the first, for the courier's time at the counter.",
    extraLabel: "Per extra shop",
    extraSave: "Save",
    extraSaved: "Extra shop fee saved",
    discard: "Discard changes",
    bandDistancePositive: "Every band needs a distance greater than zero.",
    bandAmountNegative: "A fee cannot be negative.",
    bandDuplicate:
      "Two bands share a distance. Each one is the top of its own.",
    unsavedBand: "Not saved yet",
    // Best-in-class pass (2026-11): each band read as the range it covers,
    // as delivery-fee tiers are stated by DoorDash and Uber Eats.
    bandCovers: "{from} to {to} km",
    bandClash: "Same distance as another band",
    cheaperFartherTitle: "A longer ride costs less",
    cheaperFarther: "up to {far} km is cheaper than up to {near} km",
    stripTitle: "The ladder to scale",
    stripBand: "{from} to {to} km: {fee}",
    stripKm: "{km} km",

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

    description:
      "What delivery costs, and what the second currency is worth. Both apply to every basket straight away.",
    tabDelivery: "Delivery",
    tabExtra: "Extra shops",
    tabRate: "Exchange rate",
    tryShops: "Shops on the order",
    // For several shops the distance is the route — shop to shop to door —
    // not the door's distance from any one shop (`0193`).
    tryRouteLabel: "Route (km)",
    tryRouteHint:
      "The whole ride: from the first shop, past the others, to the door.",
    tryRide: "Ride, by the ladder",
    tryStops: "Extra shops ({count} × {fee})",
    tryTotal: "Delivery",
    tryCap:
      "Never more than ordering from each shop separately. If that is cheaper, the customer pays that instead.",
    tryRouteTooLong:
      "Refused. One ride may not be longer than {km} km, so the customer is asked to take a shop off the order.",
    howTitle: "How an order is priced",
    howBody: "What the app charges for delivery, in plain words.",
    howOne:
      "One shop: the band for the distance from the shop's branch to the customer's pin.",
    howMany:
      "Several shops: the band for the whole route, plus the extra-shop fee for every shop after the first.",
    howCap: "It never costs more than ordering from each shop separately.",
    howPin:
      "No pin, no price: if the customer or a shop has no pin on the map, the order is refused rather than guessed.",
    bandsCount: "{count} bands",
    removeBand: "Remove the {km} km band",
    rateNowTitle: "Current rate",
    rateConversions: "Sample amounts",
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
    // A link to a promotion that has since been archived, or a mistyped id.
    notFound: "That promotion is not here any more.",

    // The pictures moved to their own tab in `0129`. A pointer, so nobody
    // goes looking for the card box that used to be on this form.
    artworkTitle: "Pictures",
    artworkBody:
      "The banners and tiles that advertise a promotion are managed on the Artwork tab. A linked picture is shown only while this promotion is live.",
    artworkAdd: "Add a picture for this promotion",
    // Beside a picture already linked, in place of Add — it opens that
    // picture's own editor on the Artwork tab.
    artworkChange: "Change",
    artworkOpen: "Open the Artwork tab",

    search: "Search promotions",
    // The slug is the only text a promotion has: 0013 dropped the label,
    // headline and note columns because the card is artwork. Worth saying, or
    // the operator searches for wording that lives inside a picture.
    searchHint:
      "Searches the reference you gave each promotion — its pictures are artwork, so there is no wording to search.",
    reorderHint: "Drag the rows to reorder. Searching turns that off.",
    searchNone: "No promotion matches {term}.",

    // ---- what it takes off -------------------------------------------------
    // Since 0203 a promotion is free delivery and nothing else, so what is
    // left to set here is the minimum spend.
    discountSection: "Free delivery",
    minSubtotal: "Minimum spend",
    // Since 0173 a narrowed promotion counts only the matching items towards
    // the minimum — said here, because "spend 20" reads as the whole basket.
    minSubtotalHint:
      "In {code}. Below this the promotion does not apply. When it is narrowed to shops, categories or items, only those count towards it. Compared after conversion, so it means the same amount of money whatever a shop prices in. Leave empty for no minimum.",
    noMinimum: "No minimum",

    // ---- who gets it -------------------------------------------------------
    whoSection: "Who gets it",
    appliesTo: "Applies to",
    appliesToHint:
      "Narrowing it means the basket has to contain something matching, and only those items count towards the minimum spend.",
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

    // ---- how often ---------------------------------------------------------
    limitsSection: "How often",

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
    save: "Save promotion",
    added: "{name} added",
    saved: "{name} saved",
    archived: "{name} archived",
    archive: "Archive",
    archiveTitle: "Archive {name}?",
    archiveBody:
      "It stops discounting anything immediately, and any pictures linked to it come down from the app. It can be brought back.",
    archiveConfirm: "Archive",

    // ---- summaries ---------------------------------------------------------
    previewLabel: "In the app",
    preview: "{summary}",
    summaryFreeDelivery: "Free delivery",
    summaryOver: "over {amount}",
    summaryFirstOrder: "first order only",
    summaryScoped: "{count} scope(s)",
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

    showTitle: "Switch {name} on?",
    showBody:
      "It appears straight away, as long as today is inside its dates — and it starts coming off bills.",
    showConfirm: "Show it",
    hideTitle: "Hide {name}?",
    hideBody:
      "It stops discounting anything straight away, and any pictures linked to it come down from the app.",
    hideConfirm: "Hide it",
    formLabel: "Promotion details",

    // ---- the redesigned list and editor ----
    blurb:
      "Free delivery that applies on its own when a basket qualifies — there are no codes. Higher in the list is tried first.",
    edit: "Promotion",
    create: "Add promotion",
    newDescription:
      "Free delivery for the orders you choose. It applies automatically; customers never type a code.",
    failedTitle: "Could not load the promotions",
    emptyTitle: "No promotions yet",
    emptyBody:
      "Add one to give free delivery on the orders you choose — over a minimum spend, from certain shops, or on a first order.",
    noneInFilter: "No promotion in this view",
    noneInFilterBody: "Try another status, or clear the search.",
    reorderOff: "Show All and clear the search to reorder.",
    filters: {
      all: "All ({count})",
      live: "Live ({count})",
      scheduled: "Scheduled ({count})",
      paused: "Paused ({count})",
      ended: "Ended ({count})",
    },
    status: {
      all: "All",
      live: "Live",
      scheduled: "Scheduled",
      paused: "Paused",
      ended: "Ended",
    },
    columns: {
      promotion: "Promotion",
      status: "Status",
      dates: "Dates",
      used: "Used",
    },
    noEnd: "No end date",
    actionsFor: "Actions for {name}",
    basicsSection: "Basics",
    namePlaceholder: "ramadan-2026",
    discountSectionHint:
      "Every promotion takes the delivery fee off. Set a minimum spend to decide which baskets qualify.",
    whenSectionHint: "Dates follow the business calendar (Beirut).",
    capWhole: "Use a whole number of 1 or more, or leave it empty.",
    noCodes: "Applied automatically when a basket qualifies — no code needed.",
    artworkSaveFirst: "Save first, then add a picture for it.",
    tapSection: "When a picture is tapped",
    // ---- Shopify-style choices: a decision first, a number once chosen ----
    minimumQuestion: "Minimum spend",
    minSubtotalAmount: "Amount",
    minimumRequired: "Enter the minimum spend, or choose No minimum.",
    limitsSectionHint: "Leave both unticked for no limit.",
    usedSoFar: "Used {count} time(s) so far.",
    totalCapOn: "Limit how many times it can be used in total",
    perUserOn: "Limit how many times one customer can use it",
    capRequired: "Enter a number, or untick the limit.",
    // ---- the summary card beside the form ----
    summaryTitle: "Summary",
    summaryNoName: "No reference yet",
    summaryDraft: "Not saved yet",
    summaryDetails: "Details",
    summaryPerformance: "Performance",
    details: {
      over: "Free delivery on orders over {amount}",
      everyOrder: "Free delivery on every order",
      anyShop: "Any shop",
      fromShops: "Orders from {names}",
      noShops: "No shop chosen yet",
      inCategories: "Orders in {names}",
      noCategories: "No category chosen yet",
      withItems: "Orders containing {names}",
      noItems: "No item chosen yet",
      mixed: "A mix of shops, categories and items",
      firstOrder: "First order only",
      anyone: "Any customer",
      dates: "Runs {dates}",
      noDates: "Runs while switched on, with no end date",
      total: "Up to {count} use(s) in total",
      perUser: "Up to {count} use(s) per customer",
      noLimits: "No usage limits",
    },
    // The plain-language sentence beside the form and under each row.
    summary: {
      freeDelivery: "Free delivery",
      over: "on orders over {amount}",
      everyOrder: "on every order",
      fromShops: "from {names}",
      inCategories: "in {names}",
      withItems: "containing {names}",
      mixed: "for a mix of shops, categories and items",
      firstOrder: ", first order only",
      dates: ", {dates}",
      until: "until {to}",
      starting: "starting {from}",
      perUser: "{count} time(s) per customer",
      total: "{count} in total",
      limits: "Up to {limits}.",
      and: " and ",
      count: "{count} chosen",
      either: "{a} or {b}",
      andMore: "{names} and {count} more",
    },
  },

  /**
   * "When tapped, go to" — where a promotion's or an artwork's pictures lead
   * (0137). Shared by both editors, so it lives on its own.
   */
  /** Bundles — several of a shop's dishes at one price (`0204`). */
  bundles: {
    tab: "Bundles",
    add: "Add bundle",
    edit: "Edit bundle",
    save: "Save bundle",
    search: "Search bundles",
    intro:
      "Several of a shop's dishes sold together for one price. Customers find them from the shop's Bundles link, and from any picture that advertises one.",
    reorderHint: "Drag to set the order a shop's bundles are listed in.",
    none: "No bundles yet. Add one to sell a few dishes together for less.",
    searchNone: "No bundle matches “{term}”.",
    notFound: "This bundle doesn't exist or has been archived.",
    empty: "Nothing in it yet",
    priceLine: "{price}, {separately} separately",
    live: "Live",
    hidden: "Hidden",
    showTitle: "Put {name} on sale?",
    showBody:
      "Customers can add it from the shop's Bundles page straight away, inside its dates.",
    showConfirm: "Put on sale",
    hideTitle: "Take {name} off sale?",
    hideBody:
      "It leaves the app at once, and its pictures with it. Baskets that already hold it can't check out with it.",
    hideConfirm: "Take off sale",
    archive: "Archive",
    archiveTitle: "Archive {name}?",
    archiveBody:
      "It leaves the app and this list, and its pictures stop showing. Past orders keep what was in it, and it can be brought back from Archive.",
    archiveConfirm: "Archive",
    added: "{name} added",
    saved: "{name} saved",
    archived: "{name} archived",
    always: "On offer with no end date",
    ended: "Live, but its end date has passed, so customers can't see it",
    // `bundle_is_sellable` refusing it for a dish rather than for its dates.
    offSale:
      "Off the menu: {dishes}. Show it again, or take it out of the bundle.",
    dishOffSale: "Off the menu",
    itemsOffSale:
      "Customers can't see this bundle while a dish in it is hidden or archived on the menu. Show the dish again, or take it out of the bundle.",
    startsOn: "Live from {when}",
    between: "{from} to {to}",
    until: "Until {to}",
    from: "From {from}",
    store: "Shop",
    storeHint: "A bundle holds dishes from one shop.",
    storeLocked:
      "Fixed once saved: its dishes, prices and orders belong to this shop.",
    storePlaceholder: "Choose a shop",
    storeRequired: "Choose the shop this bundle belongs to.",
    visibility: "On sale",
    visibilityHint: "Hidden bundles stay here but don't show in the app.",
    name: "Name",
    description: "Description",
    descriptionHint: "Optional. The app lists what's inside anyway.",
    imageHint:
      "Without one, the app shows a placeholder. The picture on the bundle's card and page.",
    itemsSection: "What's inside",
    pickDishes: "Dishes",
    pickDishesHint:
      "At least two. Set how many of each next to it. Hidden dishes aren't listed.",
    pickDishesPlaceholder: "Search this shop's dishes",
    pickShopFirst: "Choose the shop first",
    itemsRequired:
      "Add at least two dishes. A single dish is better sold at its own price.",
    quantityOf: "How many {name}",
    quantityRange: "Each dish can be in a bundle 1 to 20 times.",
    sameShop: "Every dish in a bundle must come from the bundle's shop.",
    noNesting: "A bundle can't contain another bundle.",
    dishTwice: "A dish is listed twice. Set its quantity instead.",
    choicesTitle: "Choices",
    choicesBody:
      "Questions asked when a customer adds this bundle, like a dish's options. An answer's extra price is added to the bundle price.",
    choicesNone: "None. It's added as it is.",
    choicesAdd: "Add choices",
    choicesChange: "Change",
    choicesSaveFirst:
      "Save first, then add choices from the shop's Options tab.",
    questionRequired: "Required",
    questionOptional: "Optional",
    priceSection: "Price",
    price: "Bundle price",
    priceHint: "What the customer pays for the whole bundle, in {code}.",
    pricePositive: "The bundle needs a price above zero.",
    priceBelowOriginal:
      "The bundle's price must be less than the original price ({separately}).",
    originalPrice: "Original price",
    originalPriceHint:
      "What the dishes cost bought separately. The app shows it struck through next to the bundle price.",
    originalPriceSaving: "Customers save {saving}",
    originalPriceEmpty: "Add dishes to see it",
    branchPrices: "Price at each branch",
    branchPricesHint: "Leave blank to charge the bundle price above.",
    branchPriceOf: "Price at {name}",
    branchPriceSame: "Bundle price",
    whenSection: "When",
    startsAt: "On offer from",
    startsHint: "Blank means straight away.",
    endsAt: "Until",
    endsHint: "Blank means no end date.",
    windowBackwards: "The end date must be after the start date.",
    previewLabel: "In the app",
    previewSaving: "{price} instead of {separately}, customers save {saving}",
    previewNoSaving:
      "{price}, but the dishes cost {separately} separately, so customers don't save anything",
    previewEmpty: "Choose the dishes and set a price to see the saving.",
    artworkTitle: "Pictures",
    artworkBody:
      "A banner or tile can advertise this bundle. It shows only while the bundle is on offer, and a tap opens the shop's bundles.",
    artworkChange: "Change",
    artworkAdd: "Add a picture",
    artworkOpen: "Save first, then add a picture from the Artwork tab",

    // ---- the redesigned list and editor ----
    reorderOff: "Clear the search to reorder.",
    notShowingCount: "{count} not showing — a dish in each is off the menu",
    failedTitle: "Could not load the bundles",
    searchNoneBody: "Try another word, or clear the search.",
    emptyTitle: "No bundles yet",
    actionsFor: "Actions for {name}",
    // What a customer sees right now. "Not showing" is a bundle that is on,
    // inside its dates, with a dish off the menu (QA-021).
    status: {
      live: "Live",
      scheduled: "Scheduled",
      ended: "Ended",
      paused: "Off sale",
      notShowing: "Not showing",
    },
    quantityTimes: "{count}× {name}",
    allShops: "All shops",
    filterShop: "Filter by shop",
    backToShop: "Back to the shop",
    newDescription: "A few of one shop's dishes, sold together for less.",
    create: "Add bundle",
    detailsSection: "Bundle",
    fewer: "One fewer {name}",
    more: "One more {name}",
    removeDish: "Take {name} out of the bundle",
    choiceWithPrice: "{name} +{price}",
    // ---- status tabs and the saving on each row ----
    filterAll: "All",
    filterCount: "{label} ({count})",
    reorderOffFiltered: "Show All and clear the search to reorder.",
    noneInFilter: "No bundle in this view",
    noneInFilterBody: "Try another tab, or clear the search.",
    savePercent: "Save {percent}%",
  },
  links: {
    label: "When tapped, go to",
    hint: "Where a customer lands when they tap the picture.",
    kinds: {
      none: "Nowhere",
      store: "A shop",
      category: "A category",
      tab: "A tab-bar page",
      page: "Another page",
    },
    store: "Shop",
    pickStore: "Choose a shop",
    category: "Category",
    pickCategory: "Choose a category",
    page: "Page",
    pickPage: "Choose a page",
    pages: {
      home: "Home",
      search: "Search",
      cart: "Basket",
      orders: "Orders",
      account: "Account",
      checkout: "Checkout",
      addresses: "Addresses",
      "address-new": "New address",
      profile: "Profile",
      "profile-details": "Profile details",
      help: "Help",
    },
    // For the "follows its promotion" hint.
    toStore: "{name}'s page",
    toCategory: "the {name} category",
    // A kind chosen with nothing picked under it.
    targetRequired: "Choose where it goes, or set it to Nowhere.",
    // `_link_shape` refusing a row — reached only by a stale tab.
    badShape:
      "That destination is not complete. Choose it again, or set it to Nowhere.",
  },

  artworks: {
    subject: "Advertises",
    subjectHint:
      "A picture can advertise a promotion or a bundle, not both. Either way it runs on that deal's dates.",
    subjects: {
      none: "Nothing, artwork only",
      promotion: "A promotion",
      bundle: "A bundle",
    },
    pickPromotion: "Choose the promotion this picture advertises.",
    pickBundle: "Choose the bundle this picture advertises.",
    pickPromotionPlaceholder: "Choose a promotion",
    pickBundlePlaceholder: "Choose a bundle",
    bundle: "Linked bundle",
    bundleHint:
      "Or advertise a bundle: the picture shows while the bundle is on offer, and a tap opens the shop's bundles.",
    archivedBundleOption: "{name} (archived)",
    linkedToBundle: "Bundle: {name}",
    runsOnBundle: "Runs on its bundle's dates: {window}.",
    runsOnBundleOpen:
      "Runs while its bundle is on offer, with no dates set there.",
    whileBundle: "Runs while its bundle is on offer",
    bundleArchived: "Its bundle is archived, so this picture no longer shows",
    followsBundle:
      "With nowhere set, a tap opens the bundle's shop page of bundles.",
    oneSubject: "A picture can advertise a promotion or a bundle, not both.",
    bundleGone: "That bundle no longer exists. Choose another, or none.",
    tab: "Artwork",
    add: "New artwork",
    edit: "Artwork",
    save: "Save artwork",
    added: "Artwork added",
    saved: "Artwork saved",
    deleted: "Artwork deleted",
    // A link to a picture that has since been deleted, or a mistyped id.
    notFound: "That picture is not here any more.",
    reorderHint:
      "Drag the rows to reorder. Banners and tiles are ordered separately.",
    empty: "No artwork yet",
    emptyBody:
      "Banners run in the carousel and tiles sit three to a row. Either can advertise a promotion or stand on its own.",

    sections: {
      banner: "Banners",
      tile: "Tiles",
    },
    sectionsHint: {
      banner: "Wide cards in the carousel, one at a time.",
      tile: "Small squares, three to a row — customers scroll for more.",
    },
    sectionsEmpty: {
      banner: "No banners yet.",
      tile: "No tiles yet.",
    },

    // The editor's cards.
    pictureSection: "The picture",
    whereSection: "Where it shows",
    whenSection: "When it runs",

    // ---- format ------------------------------------------------------------
    format: "Format",
    formatHint:
      "A banner is the wide card in the carousel. A tile is a small square, three to a row.",
    formats: {
      banner: "Banner",
      tile: "Tile",
    },
    formatNotes: {
      banner: "Wide, 21:9",
      tile: "Portrait, 4:5",
    },
    formatUnknown: "That format is not one the app can draw.",

    // ---- image -------------------------------------------------------------
    // The shape is stated because the app crops to it: the carousel card is
    // 21:9 (the app's `offer-card.tsx`) and a tile is square.
    imageHint: {
      banner:
        "Wide, 21:9. The words are in the picture, so each language gets its own. English is required; without an Arabic one, the English is shown.",
      tile: "Portrait, 4:5. The words are in the picture, so each language gets its own. English is required; without an Arabic one, the English is shown.",
    },
    imageRequired: "Add the picture — without one there is nothing to show.",
    // Names the boxes, because after switching format it is usually all of
    // them and the operator needs to know the pictures, not the form, are why.
    imageWrongShape:
      "The picture for {languages} is not {shape}. Replace it, or the app will crop it.",
    imageNeedsEnglish:
      "Add the English picture — it is the one shown wherever another language has none.",
    // ---- alt text (0225) ---------------------------------------------------
    // Read aloud by VoiceOver and TalkBack in place of the picture, whose words
    // a screen reader cannot see. Optional, so says what leaving it costs.
    altText: "What the picture says",
    altTextHint:
      "Read aloud to customers who use a screen reader. Write the words on the picture, e.g. “20% off at Forno”. Left blank, the app just says “Offer”.",
    altTextNeedsEnglish:
      "Add the English words too — they are read wherever another language has none.",
    altTextTooLong: "Keep the words under {max} characters in each language.",

    // ---- linked promotion --------------------------------------------------
    promotion: "Linked promotion",
    promotionHint:
      "A linked picture is shown only while its promotion is live, and on shop pages only where the promotion applies. Artwork only is always shown within its own dates.",
    archivedPromotionOption: "{slug} (archived)",
    promotionGone: "That promotion no longer exists. Choose another, or none.",
    linkedTo: "Linked to {slug}",
    artworkOnly: "Artwork only",

    // ---- screens -----------------------------------------------------------
    placement: "Show it on",
    placementHint:
      "Where customers see the picture. Turn every screen off to keep it as a draft, shown nowhere.",
    placementOn: "Shown",
    placementOff: "Hidden",
    // The screens `artworks_placements_known` allows since 0136, in the
    // app's own order. Named for what the customer sees, not the route.
    placements: {
      home: "Home",
      search: "Search",
      category: "Category page",
      store: "Shop page",
      item: "Dish page",
      cart: "Basket",
      checkout: "Checkout",
      orders: "Orders list",
      order: "Order page",
      account: "Account",
      profile: "Profile",
      "profile-details": "Profile details",
      addresses: "Addresses",
      "address-new": "New address",
      help: "Help",
    },
    placementsHint: {
      home: "Near the top, to everyone.",
      search: "On the Search tab, under Featured, before anything is typed.",
      category: "On a category's page, above its shops.",
      store:
        "On shop pages — the shops chosen below, or every shop when none are. A linked picture also only where its promotion applies.",
      item: "On a dish's own page.",
      cart: "Above the basket, where a minimum spend is a number the customer can act on.",
      checkout: "On the checkout screen, just before the order is placed.",
      orders: "Above the customer's list of orders.",
      order: "On a single order's page.",
      account: "On the account screen.",
      profile: "On the profile screen.",
      "profile-details": "On the screen where a customer edits their details.",
      addresses: "On the customer's list of saved addresses.",
      "address-new": "On the screen for adding an address.",
      help: "On the help screen.",
    },
    // `artwork_stores` (0136): which shops' pages, for the Shop page placement.
    storesLabel: "Which shops",
    storesHint:
      "Leave empty to show it on every shop page. Pick shops to show it on theirs only.",
    storesPlaceholder: "All shops",
    placementsUnknown: "One of those screens is not one the app knows.",
    shownOn: "On {screens}",
    draft: "Draft — shown on no screen",

    // ---- when --------------------------------------------------------------
    startsAt: "Starts",
    startsHint: "Leave empty to start as soon as it is switched on.",
    endsAt: "Ends",
    endsHint: "Leave empty to run until you switch it off.",
    windowBackwards: "The end has to come after the start.",
    // A linked picture has no dates of its own since 0136
    // (`artworks_linked_has_no_window`) — it runs on its promotion's.
    runsOnPromotion: "Runs on its promotion's dates: {window}.",
    runsOnPromotionOpen: "Runs on its promotion's dates — no dates set there.",
    linkedHasNoWindow:
      "A picture linked to a promotion runs on the promotion's dates and cannot have its own.",
    // The link hint when the picture has no destination of its own (0137).
    followsPromotion:
      "Leave on Nowhere to follow its promotion: a tap goes to {destination}. Choose a destination to override it.",
    visibility: "Visibility",
    visibilityHint:
      "Shown only when it is on and inside its dates — and, if linked, while its promotion is live.",
    live: "Live",
    hidden: "Hidden",

    // The window in words. A picture can be switched on and invisible, which
    // is the state worth naming.
    always: "Runs until you switch it off",
    whilePromotion: "Runs while its promotion is live",
    between: "{from} to {to}",
    until: "Until {to}",
    startsFrom: "From {from}",
    startsOn: "Switched on, but does not start until {when}",
    ended: "Switched on, but its dates have passed",
    stateOff: "Switched off",
    promotionArchived:
      "Not shown — its promotion is archived. Bring the promotion back, or link another.",

    // ---- row actions -------------------------------------------------------
    // `{name}` is "Linked to …" or "Artwork only" — a picture has no name of
    // its own, the words are in the image.
    showTitle: "Show this picture? ({name})",
    showBody:
      "It appears in the app straight away, as long as today is inside its dates.",
    showConfirm: "Show it",
    hideTitle: "Hide this picture? ({name})",
    hideBody: "It disappears from the app straight away.",
    hideConfirm: "Hide it",
    delete: "Delete",
    deleteTitle: "Delete this picture? ({name})",
    deleteBody:
      "It comes out of the app immediately and cannot be brought back. The promotion it advertised is not affected.",
    deleteConfirm: "Delete",

    // ---- the redesigned gallery and editor ----
    blurb:
      "The banners and tiles customers see in the app. Each card shows where it is placed and whether it is showing right now.",
    reorder: "Reorder",
    reorderTitle: "Order of pictures",
    failedTitle: "Could not load the artwork",
    filters: {
      all: "All ({count})",
      showing: "Showing ({count})",
      notShowing: "Not showing ({count})",
    },
    noneInFilter: "None in this view.",
    editNamed: "Edit {name}",
    actionsFor: "Actions for {name}",
    // Whether a customer sees it right now — the badge on each card.
    status: {
      live: "Showing",
      scheduled: "Scheduled",
      ended: "Ended",
      off: "Off",
      promotionArchived: "Promotion archived",
      bundleArchived: "Bundle archived",
    },
    newDescription:
      "A banner or tile for the app — on its own, or advertising a promotion or a bundle.",
    create: "Add artwork",
    tapSection: "When tapped",
    // ---- the gallery's screen filter and section headings ----
    allScreens: "Every screen",
    filterScreen: "Filter by screen",
    sectionCount: "{title} ({count})",
  },

  /**
   * What the platform earns from a shop — commission or markup (`0262`). Staff
   * only: no rate or store price is ever shown to a customer.
   */
  earnings: {
    saved: "Earnings saved",
    model: "How we earn",
    commission: "Commission",
    markup: "Markup",
    commissionHint:
      "A percentage of the shop’s part of each order, delivery left out. The driver pays the shop the rest at pickup.",
    markupHint:
      "Each dish and choice has a price from the shop and our markup. Customers pay the two together; the driver pays the shop its price at pickup.",
    // Shown while the model is being changed, before saving (user, 2026-11-08).
    switchToMarkup:
      "After saving, every dish starts with its current price as the price from the shop and no markup. Add our markup to each: To do lists the ones still missing it. Orders already placed keep commission.",
    switchToCommission:
      "Prices in the app still include our markup. Lower them if the shop should sell at its own price, or we take commission on top. Orders already placed keep their markup.",
    percent: "Commission rate (%)",
    percentHint:
      "On a $10 order with $2 delivery, 10% is $0.80, and the driver pays the shop $7.20. A new rate applies to new orders only.",
    percentPlaceholder: "e.g. 10",
    percentRequired: "Enter the commission rate.",
    // The new-shop checklist, and what is said if the shop was made but its
    // terms were not saved.
    readyLabel: "Commission or markup",
    notSavedNew:
      "The shop was created, but its commission or markup was not saved. Set it on its Details tab — the shop is listed in To do until then.",
    percentRange: "The rate must be between 0 and 100.",
    percentDecimals: "Two decimal places at most.",
    // The branch editor.
    branchHint:
      "Same as the shop unless this branch is settled differently. Applies to orders placed from now on.",
    markupBranchHint:
      "Set this branch’s store prices on its Menu tab, in its own currency. A dish without one there uses the shop’s.",
    sameAsShop: "Same as the shop ({model})",
    commissionAt: "Commission {percent}%",
    commissionNone: "Commission, no rate",
    percentBranchHint:
      "This branch’s own rate. To use the shop’s, choose “Same as the shop”.",
    percentShop: "Shop’s rate: {percent}%",
    // Markup, typed as the shop's price plus ours (user, 2026-11-08). The
    // app price is their sum and is worked out; the markup is never stored.
    shopPrice: "Price from the shop",
    shopPriceHint: "What the shop charges us for one. Customers never see it.",
    shopPricePlaceholder: "380000",
    markupPlaceholder: "20000",
    markupAmount: "Our markup",
    markupAmountHint: "Added on top. This is what we keep on each one.",
    appPrice: "Price in the app: {price}",
    markupNegative:
      "The markup can’t be below zero, or we would lose money on every sale.",
    // Both are required on a shop on markup (user, 2026-11-08).
    bothNeeded: "Fill in both the price from the shop and our markup.",
    shopPriceFor: "Price from the shop for {name}",
    markupFor: "Our markup for {name}",
    // The captions beside a branch row's two boxes.
    fromShopShort: "From shop",
    markupShort: "Markup",
    branchMenuMarkup:
      "This branch is on markup: each row has the price from the branch and our markup, in {code}. Empty uses the shop’s.",
    // The quick price on the Menu tab, for a dish with a price from the shop:
    // changing the app price there alone would quietly change our markup.
    quickPriceMarkup:
      "This dish is on markup. Change the price from the shop and our markup on its page, so the two stay together.",
    openDish: "Open the dish",
    // The order page, under each shop's lines.
    orderModel: "Settled by",
    orderNoRecord: "No commission recorded",
    orderEarned: "We earn",
    orderPaidToShop: "Paid to the shop at pickup",
  },

  /** The earnings report — `/earnings`, `api_v1_admin_earnings` (`0262`). */
  earningsReport: {
    // The filters: one shop, and the way of earning (user, 2026-11-08).
    allShops: "All shops",
    shopFilter: "Shop",
    filter: {
      all: "All",
      commission: "Commission",
      markup: "Markup",
    },
    emptyFiltered: {
      commission: "No commission in this period",
      markup: "No markup in this period",
    },
    title: "Earnings",
    description:
      "What we earned from each shop and branch, and what drivers paid the shops at pickup.",
    currencyTitle: "In {code}",
    currencySummary:
      "{earned} earned, {paid} paid to shops, {delivery} delivery paid, {orders} shop orders",
    // Only when a promotion gave free delivery in the period (0285).
    currencyFree:
      "Free delivery given on {count} orders: {waived}, not in Total earned.",
    colShop: "Shop",
    colBranch: "Branch",
    colModel: "Settled by",
    colOrders: "Shop orders",
    colSales: "Sales",
    colEarned: "Earned from store",
    colPaid: "Paid to shops",
    // What customers paid for delivery — a free delivery adds nothing (0285).
    colDelivery: "Delivery paid",
    // What promotions took off the fee: free delivery given. A cost to us,
    // not money in, so it is not in Total earned.
    colFreeDelivery: "Free delivery",
    colFreeCount: "Free deliveries",
    freeOrders: "{count} orders",
    // Earned from the store plus the delivery customers paid.
    colTotalEarned: "Total earned",
    colSalesRaw: "Sales (minor units)",
    colEarnedRaw: "Earned from store (minor units)",
    colPaidRaw: "Paid (minor units)",
    colDeliveryRaw: "Delivery paid (minor units)",
    colFreeDeliveryRaw: "Free delivery (minor units)",
    colTotalEarnedRaw: "Total earned (minor units)",
    total: "Total",
    sheet: "Earnings {code}",
    failed: "Could not load the earnings.",
    emptyTitle: "Nothing earned in this period",
    emptyBody:
      "No orders were placed in this period. Set a shop’s rate on its Details tab.",
    toShops: "Go to shops",
    note: "Sales leave delivery out; delivery has its own column. Delivery paid is what customers paid; a fee a promotion took off is under Free delivery and not in Total earned. An order from two shops counts once for each, and its delivery fee is split evenly between them. Cancelled orders are not counted; one reopened is counted again.",
  },

  reports: {
    // What we earned (`0262`): commission and markup as one figure, per
    // currency, with the breakdown on the Earnings page.
    earned: "We earned",
    earnedHint: "Commission and markup. Breakdown on Earnings.",
    earnedColumn: "Earned",
    earnedIn: "We earned ({code})",
    title: "Reports",
    description:
      "How the business did over a period, compared with the period before.",
    vsBefore: "vs the period before",
    rangeLabel: "Period",
    otherFigures: "Also in this period",
    colRank: "Rank",

    // Deliberately not date-filtered: an order still unconfirmed from Tuesday
    // is not Tuesday's business, it is the most urgent thing on the screen.
    needsYou: "Needs you now",
    needsYouNote: "Every order still waiting, whatever day it arrived",
    countsFailed: "Could not count the open orders.",

    performance: "How we are doing",
    range7: "7 days",
    range30: "30 days",
    range90: "90 days",
    range365: "12 months",
    // Shopify's "compare to": the period before, or the same days a year
    // earlier, which is the fair one across Ramadan and the summer.
    compareLabel: "Compare with",
    compare: {
      previous: "Compare with the period before",
      year: "Compare with last year",
      none: "No comparison",
    },
    rangeNoteCompared:
      "{from} to {to}, Beirut time, compared with {beforeFrom} to {beforeTo}",
    // Beside the change pill: the old figure, so "+50%" can be read.
    was: "from {value}",
    storesHint: "Open a shop to see more.",
    rangeClear: "Back to presets",

    exportLabel: "Export",
    exportChoose: "Choose a format",
    exporting: "Preparing…",
    rangePlaceholder: "Pick a date range",
    export: {
      csv: "CSV",
      xlsx: "Excel",
    },

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
    fromNothing: "New",
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

    // The trend chart: one figure at a time, chosen above it.
    metric: {
      revenue: "Revenue",
      orders: "Orders",
      average: "Average order",
    },
    chartByDay: "{metric} by day",
    chartByMonth: "{metric} by month",
    chartAria:
      "{metric} for each bar in the range, with the comparison period behind it.",
    chartBar: "{when}: {value}",
    chartBarCompared: "{when}: {value}, compared with {before}",
    ghostNoteYear: "The grey bars are the same days last year.",
  },

  account: {
    title: "Your account",
    blurb: "Your own sign-in to this dashboard.",
    profileTitle: "Profile",
    profileBlurb: "Who this dashboard knows you as.",
    tabPassword: "Password",
    tabEmail: "Email",
    signedInAs: "Signed in as",
    failed: "Could not read your account.",

    currentPassword: "Current password",
    currentHint: "Proves it is you, and not a session somebody walked up to.",
    currentPlaceholder: "The password you sign in with now",
    newPasswordPlaceholder: "{min} characters or more",
    confirmPlaceholder: "Type it again",
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
    // The rows of the security card (Google/Stripe style).
    unknownEmail: "Unknown",
    signInTitle: "Signing in",
    signInBlurb:
      "How you get into the dashboard. Changing either asks for your current password first, so an unattended laptop cannot.",
    emailRow: "Email",
    passwordRow: "Password",
    passwordMasked: "••••••••••",
    change: "Change",
  },

  content: {
    title: "Settings",
    tabHelp: "Help",
    tabLegal: "Legal",
    tabAdvanced: "Advanced",
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
    // A link to a topic or a section that has since been archived.
    notFound: "That is not here any more.",
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

    // The redesigned Settings screen (lebrunji-admin).
    blurb:
      "How the business runs, and the words customers read in the app. Changes here reach the app straight away.",
    tabHelpTopics: "Help topics",
    helpListTitle: "Questions and answers",
    helpCountOne: "1 question",
    helpCount: "{count} questions",
    helpEmptyTitle: "No questions yet",
    helpEmptyBody:
      "Add the first one. Customers read these in the Help screen of the app.",
    legalListTitle: "Sections",
    legalCountOne: "1 section",
    legalCount: "{count} sections",
    legalEmptyTitle: "This document has no sections yet",
    legalEmptyBody:
      "Add its first section. Customers read it in the app top to bottom, in this order.",
    documentLabel: "Document",
    moreFor: "More for {name}",
    visibilityAria: "Show {name} in the app",
    notFoundBody:
      "It may have been removed by somebody else. Go back to the list to see what is there now.",
    // The settings side menu (Linear/Stripe style).
    navBusiness: "Business",
    navAppText: "In the app",
    navSystem: "System",
    advancedBlurb: "Housekeeping that is rarely needed.",
    topicSectionTitle: "Question and answer",
    topicSectionBlurb:
      "Write it in every language the app speaks. Customers see the language their phone is set to.",
    groupSectionTitle: "Where it sits",
    visibilityBlurb:
      "Hidden topics stay here, so you can bring one back without writing it again.",
    sectionSectionTitle: "Section text",
    sectionSectionBlurb:
      "One heading and its paragraphs, in every language the app speaks.",
    inDocument: "Part of the {document}.",
    noGroups:
      "There are no groups yet. Groups are added with a migration, so ask whoever looks after the database.",
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
    // The picker over the Menu tab, on a shop with more than one branch. The
    // first choice is the menu itself; a branch shows what it does differently.
    forBranch: "Branch",
    back: "All shops",
    itemNotFound: "That item is not here any more.",
    sectionNotFound: "That section is not here any more.",
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
    archiveInBundlesBody:
      "It disappears from the app immediately, and so do the bundles it's in: {bundles}. Past orders keep it, and it can be brought back.",
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
    // The same, for a dish inside a switched-on bundle — which goes with it.
    hideInBundlesBody:
      "It disappears from the shop's menu straight away, and so do the bundles it's in: {bundles}. Orders already placed are not affected, and you can show it again at any time.",
    hideConfirm: "Hide it",

    // Sections. A section is the heading a customer scans before they read any
    // item under it, so what it is called is the menu's structure rather than
    // decoration.
    sections: "Sections",
    addSection: "Add a section",
    sectionTitle: "Section name",
    sectionTitleHint: "What customers see above the items in it.",
    // `menu_sections.image_url`, 0190 — read only by the Aisles layout.
    sectionImage: "Aisle picture",
    // A sub-aisle's tile too, since its aisle's page shows them (0196).
    sectionImageHint:
      "Shown on its tile when the shop's menu layout is Aisles — an aisle on the shop's page, a sub-aisle on its aisle's page. Without one, the tile shows its first item's picture.",
    sectionImageHintRequired:
      "Required for aisles and sub-aisles: it is the tile customers tap in the app — an aisle on the shop's page, a sub-aisle on its aisle's page.",
    sectionImageRequired: "Add a picture. Aisles and sub-aisles need one.",
    // On the Menu tab, beside an aisle or sub-aisle saved before pictures
    // were required. Rename it to add one.
    noPicture: "No picture",
    gatherTitle: "Gather {name}'s loose products",
    sectionAdded: "{name} added",
    // The new name, not the old one: it is what the operator is looking at
    // in the list, and it confirms the edit landed as typed.
    sectionRenamed: "Renamed to {name}",
    sectionArchived: "{name} archived",
    renameSection: "Rename",
    mergeSubAisle: "Move products into another sub-aisle…",
    mergeSection: "Move products into another section…",
    mergeTitle: "Move everything in {name}",
    mergeBody:
      "Its {count} product(s) go into the section you choose, after what is already there, in the same order.",
    mergeTo: "Move them into",
    mergeHint: "Any sub-aisle or section, in any aisle.",
    mergeConfirm: "Move {count} product(s)",
    mergeArchive: "Archive {name} once it is empty",
    mergeArchiveHint:
      "You'll be asked to confirm. It can be brought back from the Archive.",
    mergePartial:
      "{count} product(s) could not be moved, so the section is not empty. The reason is in the message above.",
    sectionArchiveTitle: "Archive this section?",
    sectionArchiveBody:
      "It disappears from the app immediately. It can be brought back.",
    // The refusal an operator is most likely to meet, so it says the number and
    // what to do — not that the action was unavailable.
    sectionNotEmpty:
      "This section still holds {count} live item(s). Move or archive them first, or they would disappear from the app without being deleted.",
    // Sub-aisles — 0196. An aisle holds sub-aisles, and on an aisles shop the
    // products live in those.
    aisleNotEmpty:
      "This aisle still holds {count} sub-aisle(s). Move or archive them first, or they would disappear from the app without being deleted.",
    aisleCount: "{subAisles} sub-aisles, {items} items",
    subAisleLabel: "Sub-aisle",
    addSubAisle: "Add a sub-aisle",
    aisleNeedsSubAisle:
      "Products on an aisles shop go in a sub-aisle. Add one — Milk, Cheese — to start stocking this aisle.",
    // The three levels, named on every heading so none is read for another
    // (2026-11). An aisle holds sub-aisles; a sub-aisle and a section hold
    // dishes — a section is a top-level heading with nothing under it.
    aisleLabel: "Aisle",
    addAisle: "Add an aisle",
    newAisleTitle: "New aisle",
    aisleTitle: "Aisle name",
    subAisleTitle: "Sub-aisle name",
    renameAisle: "Rename aisle",
    renameSubAisle: "Rename sub-aisle",
    renameSectionLevel: "Rename section",
    renameAisleTitle: "Rename aisle {name}",
    renameSubAisleTitle: "Rename sub-aisle {name}",
    renameSectionLevelTitle: "Rename section {name}",
    aisleArchiveTitle: "Archive this aisle?",
    subAisleArchiveTitle: "Archive this sub-aisle?",
    levelAisles: "{count} aisles",
    levelAislesOne: "1 aisle",
    levelSubAisles: "{count} sub-aisles",
    levelSubAislesOne: "1 sub-aisle",
    levelSections: "{count} sections",
    levelSectionsOne: "1 section",
    summaryLevels: "{items} dishes in {levels}",
    looseTitle: "{count} product(s) sit directly on this aisle",
    looseBody:
      "They keep selling, but new products cannot join them. Move them into a sub-aisle of their own, then split it further if you like.",
    looseGather: "Move into a sub-aisle",
    looseGathered: "{name}'s products moved into a sub-aisle",
    move: "Move",
    moveAisleInto: "Move this section into",
    moveSubAisleTo: "Move this sub-aisle to",
    moveHint:
      "Under another aisle it becomes a sub-aisle, with its products. A new aisle is made here and this goes inside it.",
    moveChoose: "Choose where it goes",
    moveNewAisle: "A new aisle…",
    moveOwnAisle: "An aisle of its own",
    newAisleName: "New aisle name",
    moveConfirm: "Move",
    sectionMoved: "{name} moved",
    aislesGrouped: "{name} made, with this inside it",
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
    // The picker on an item's page — how a dish moves from one section to
    // another.
    section: "Section",
    sectionHint:
      "Where it sits on the menu. Moving it puts it at the end of that section.",
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
    hiddenInBundlesHint:
      "Kept, but not shown in the app, and neither are the bundles it's in: {bundles}.",
    newItem: "New item",
    // Placeholders are examples, never labels. Each shows what a good answer
    // looks like for a field whose name is already above it.
    namePlaceholder: "Kibbeh Plate",
    namePlaceholderAr: "صحن كبة",
    descriptionPlaceholder: "Baked lamb kibbeh, tahini, pickles",
    descriptionPlaceholderAr: "كبة لحم مشوية، طحينة، كبيس",
    pricePlaceholder: "380000",
    slugPlaceholder: "kibbeh-plate",

    // The Menu tab, redesigned (2026-11). The list is the work surface: price
    // and availability change from the row, everything else on the dish page.
    addDish: "Add dish",
    addDishTo: "Add a dish to {section}",
    addSectionFirst: "Add a section first, then put dishes in it.",
    showInMenu: "Show in menu",
    summary: "{items} dishes in {sections} sections",
    summaryHidden: "{count} hidden",
    filterLabel: "Show",
    filterAll: "All",
    filterLive: "Live",
    filterHidden: "Hidden",
    filterNoDrag: "Show all dishes to reorder.",
    filterNone: "No dish in this view.",
    filterNoneBody: "Switch back to All to see the whole menu.",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    emptyAction:
      "Start with a section — Starters, Mains, Drinks — then add dishes to it.",
    sectionMore: "More actions for {name}",
    dishMore: "More actions for {name}",
    editDish: "Edit dish",
    changePrice: "Change price",
    priceOf: "Price of {name}",
    savePrice: "Save price",
    priceFieldHint: "Customers see the new price straight away.",
    newSectionTitle: "New section",
    newSubAisleTitle: "New sub-aisle in {name}",
    renameSectionTitle: "Rename {name}",
    moveSectionTitle: "Move {name}",
    sectionEmptyAdd: "No dishes yet. Add the first one.",
    dragHint: "Drag the handles to change the order customers see.",
    hideEverywhere: "Hide from customers",
    showEverywhere: "Show to customers",
    // The dish page.
    pageNewDescription: "Adding to {section} at {shop}.",
    pageDescription: "{shop}, {section}",
    basics: "Basics",
    basicsHint: "What the dish is called, and the line under its name.",
    priceSection: "Price and unit",
    priceSectionHint: "What it costs, and what that price buys.",
    optionsSection: "Options",
    optionsSectionHint:
      "Questions the customer answers when adding it — a size, extras.",
    optionsNone: "This dish asks nothing yet.",
    optionsManage: "Manage options",
    optionsManageHint:
      "Options are shared across a shop's dishes, so they are set up on the shop's Options tab.",
    tagsSection: "Tags",
    tagsSectionHint: "Labels customers see beside the dish, like Spicy.",
    availability: "Availability",
    availabilityHint: "Whether customers can see and order it.",
    showInApp: "Show in the app",
    branchesSection: "At each branch",
    branchesSectionHint:
      "What each branch serves and charges. Each is changed on that branch's menu.",
    branchSamePrice: "Shop price",
    branchNoPrice: "No price",
    branchSectionOff: "Section off here",
    editAtBranch: "Edit at {name}",
    // On a chain's Menu tab, where the branch picker used to be.
    branchesNote:
      "This is the menu every branch shares. What each branch serves and what it charges are set on that branch's own menu:",
    branchesSaveFirst:
      "Save the dish first, then set what each branch serves and charges.",
    branchesOne:
      "This shop has one branch, so the shop's price and availability are the whole story.",
    preview: "Preview",
    previewHint: "Roughly how the dish reads on the menu.",
    previewName: "Dish name",
    unsaved: "Unsaved changes",
    noChanges: "No changes",
    archiveDish: "Archive dish",
    fixErrors: "Fix the highlighted fields, then save again.",

    // Best-in-class pass (2026-11): a section rail, bulk edits, duplicating.
    // The rail beside the list on a wide screen — where each section is.
    jumpTo: "Go to {name}",
    // Bulk edits, from ticked rows. Both directions ask, as a single switch does.
    selectDish: "Select {name}",
    selectSection: "Select every dish in {name}",
    selected: "{count} selected",
    bulkShow: "Show",
    bulkHide: "Hide",
    bulkMove: "Move to…",
    bulkClear: "Clear selection",
    bulkShowTitle: "Show {count} dishes to customers?",
    bulkShowBody:
      "They appear on the shop's menu straight away and can be ordered.",
    bulkHideTitle: "Hide {count} dishes from customers?",
    bulkHideBody:
      "They disappear from the shop's menu straight away. Orders already placed are not affected, and you can show them again at any time.",
    bulkHideInBundlesBody:
      "They disappear from the shop's menu straight away, and so do the bundles they're in: {bundles}. Orders already placed are not affected, and you can show them again at any time.",
    bulkMoveTitle: "Move {count} dishes",
    bulkMoveLabel: "Section",
    bulkMoveHint:
      "They go to the end of that section, in the order they are in now.",
    bulkMoveConfirm: "Move dishes",
    // Duplicating — starts hidden, the way a copied product starts as a draft.
    duplicate: "Duplicate",
    pageDuplicateDescription: "A copy of {name}, in {section} at {shop}.",
    duplicateNote:
      "The copy starts hidden so customers never see two of the same dish. Its options and branch prices are not copied — set them once it is saved.",
    // The dish page's side column.
    status: "Status",
    organisation: "Organisation",
    media: "Picture",
  },

  map: {
    noPin: "No location saved for this address.",
    openLarger: "Open in Google Maps",
    engage: "Click to move the map",
    recenter: "Back to the pin",
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

  /**
   * Branches — the places one shop trades from.
   *
   * The words keep the split the schema does: a *store* is the brand and a
   * *branch* is an address. Nothing here says "store", because the operator is
   * looking at one already and the question on this tab is always about a
   * place.
   */
  branches: {
    notFound: "That branch is not here any more.",
    tab: "Branches",
    tabCount: "Branches ({count})",
    // There were two headings here — "The shop" and "This branch" — from when
    // the branch editor carried both records. It carries one now, so the page
    // needs no heading to say which: see `store-details.tsx`.

    // The two a branch may differ on since 0110. Both say what leaving them
    // alone means, because "empty" and "the same as the shop" look identical
    // in a form and are not the same thing at all.
    imageSharedHint:
      "The shop's picture, used until you choose one here to give this branch its own.",
    imageOwnHint:
      "This branch's own picture. Remove it to go back to the shop's.",
    currency: "Prices in",
    currencyHint:
      "What this branch charges in. Changing it converts its prices at today's rate and makes every one of them this branch's own, so they no longer follow the shop's. Leave it on the shop's unless this place really does trade in another.",
    currencySame: "Same as the shop ({code})",
    searchPlaceholder: "Search branches",
    // A term that matched nothing, said as its own state — the list simply
    // emptying reads as a shop that has lost its branches.
    noMatches: "No branch matches that.",
    add: "New branch",
    name: "Branch name",
    // The place, not the brand — the shop's name is already above.
    nameHint: "The area or street, not the shop's name.",
    namePlaceholder: "Hamra",
    // Required since 0198. Printed under the shop in the app, so the hint says
    // where it shows rather than repeating the label.
    address: "Address",
    addressHint: "A short street address the app shows under the shop.",
    addressRequired: "Every branch needs its address, in English at least.",
    addressPlaceholder: "Hamra St., near the AUB gate",
    pin: "Where it is",
    pinHint:
      "Delivery is charged from here. Without a pin every order from this branch is charged at the top distance band.",
    prep: "Store takes",
    prepHint:
      "The range the app quotes with the delivery estimate for this branch.",
    whatsapp: "WhatsApp number",
    whatsappHint:
      "Where an order from this branch is sent. Without one this branch cannot be sent orders.",
    // Says the consequence rather than "required". A branch with no number is
    // listed, takes orders, and has nowhere to send them.
    whatsappRequired:
      "A branch needs a number — without one an order placed here reaches no kitchen.",
    // And this one is money: an unpinned branch does not fail to quote, it
    // quotes the top distance band on every order.
    pinRequired:
      "A branch needs a pin — without one every delivery from it is charged at the top distance band.",
    /*
      Not the opening hours, and it used to read as though it were.
   
      This switch said "Taking orders — Open / Closed", which is the exact
      question the weekly timetable on the Hours tab answers, so a branch
      appeared to have two competing switches for one thing. It does not. Since
      `0116` `branch_is_open` reads the timetable and `place_order` enforces it,
      and that is what decides whether a customer can order *right now*.
   
      What this decides is whether the branch trades at all — a refit, a
      seasonal shut, a place that is not opening again this year. A branch
      turned off here is gone from the app whatever its hours say, which is why
      it is worded as a state the operator has to come back and undo.
    */
    visibility: "Branch status",
    hidden: "Closed indefinitely",
    // The badge on the row, where the switch's own words are too long — and
    // where "Closed" alone would be read as the shop being shut for the
    // evening, which is the confusion this whole block exists to end.
    notTrading: "Not trading",
    liveHint:
      "Open on the hours set for it. Those are what decide whether it is taking orders right now — this switch is for shutting the branch altogether.",
    hiddenHint:
      "Shut until this is turned back on, whatever its opening hours say. Gone from the app; the shop’s other branches are unaffected.",
    hoursTitle: "Opening hours",
    added: "{name} added",
    saved: "{name} saved",
    closed: "{name} closed",
    closeTitle: "Close {name}?",
    // Says what survives, because the word "close" reads as deletion.
    closeBody:
      "It stops appearing in the app and cannot be ordered from. Nothing is deleted: the orders it took keep pointing at it, and its prices and hidden items are kept so reopening is one click.",
    closeConfirm: "Close branch",
    // The one refusal worth a sentence rather than a constraint name.
    lastOne:
      "A shop needs somewhere to trade from. Add another branch before closing this one.",
    pinHalf: "A pin needs both a latitude and a longitude.",
    // No `unpinned`. It said "No pin" — the fact rather than the cost — and the
    // branch rows now use `catalogue.noPin`, which says what an unpinned place
    // charges. One warning, one wording, on both screens that show it.
    count: "{count} branches",
    countOne: "1 branch",
    // A shop always has at least one after `0101`, so this is a schema that
    // has not been migrated rather than an empty state to design for.
    noneYet: "This shop has no branches yet.",

    // ---- the rebuilt branch pages -----------------------------------------
    introSole:
      "This shop trades from one place, edited on its Details tab. Add a branch to trade from a second address — the menu is shared, and each branch can hide dishes and charge its own prices.",
    failed: "Could not load the branches",
    noAddress: "No address",
    // Under a branch's name in a picker, where the address tells branches
    // apart and a blank line would look like a fault.
    noAddressYet: "No address yet",
    editedOnDetails: "Edited on Details",
    backToList: "Back to branches",
    addDescription:
      "A new place {shop} trades from. It shares the shop's menu; what it serves and charges can differ once it exists.",
    ofShop: "A branch of {shop}",
    detailsTab: "Details",
    menuTab: "Menu",
    hoursTab: "Hours",
    identitySection: "The branch",
    placeHint: "Where an order from this branch reaches the kitchen.",
    namePlaceholderAr: "الحمرا",
    addressPlaceholderAr: "شارع الحمرا، قرب بوابة الجامعة الأميركية",
    differsSection: "Prices and picture",
    differsHint: "Both follow the shop unless this branch is given its own.",
    hoursNew:
      "When this branch takes orders. Open at least one day — a branch with no hours is open around the clock.",
    editHours: "Edit hours",
    create: "Create branch",
    hoursNotSaved:
      "The branch was created, but its hours could not be saved. Set them here — until then the app shows it as open around the clock.",
    currencyConfirmTitle: "Price this branch in {code}?",
    currencyConfirmBody:
      "Every price at this branch is converted to {code} at today's rate and becomes this branch's own, so it no longer follows the shop's prices. Past orders are unaffected.",
    currencyBackBody:
      "This branch goes back to the shop's currency ({code}). Its prices are converted back at today's rate and stay its own — clear a price on Menu and prices to follow the shop's again.",
    currencyConfirm: "Convert the prices",

    // ---- a branch managed like a store of its own (2026-11) ----------------
    // Uber Eats Manager and Shopify's locations: every place has its own page
    // with its menu, hours and details, and the shop is the brand above them.
    breadcrumb: "Where you are",
    shops: "Shops",
    switchBranch: "Other branches ({count})",
    switchBranchLabel: "Go to another branch of {shop}",
    // The Live switch on a branch: whether it trades at all, not its hours.
    liveOnTitle: "Start trading at {name}?",
    liveOnBody:
      "Customers can order from {name} again, during its opening hours.",
    liveOnConfirm: "Start trading",
    liveOffTitle: "Stop trading at {name}?",
    liveOffBody:
      "Customers cannot order from {name} until it is turned back on, whatever its opening hours say. The shop's other branches keep trading, and orders already placed are not affected.",
    liveOffConfirm: "Stop trading",
    openBranch: "Open branch",
    editDetails: "Edit details",
    editMenu: "Edit menu and prices",
    // A branch of a shop that is itself hidden from the app.
    shopHidden: "The shop is hidden, so this branch is not in the app",
    lastOneHint: "The only branch a shop has cannot be closed.",
    showBranches: "Show the branches of {name}",
    hideBranches: "Hide the branches of {name}",
    // The Branches tab of a chain, said once above the list.
    introChain:
      "Each branch is managed on its own page: its menu and prices, its hours and its details. The menu itself, the options and the bundles are the shop's and shared by all of them.",
  },

  /**
   * One branch's differences from the shared menu.
   *
   * The words avoid "override" and "exception" — true of the schema, and not
   * how anybody describes a shop that has run out of something or charges more
   * at the airport.
   */
  branchMenu: {
    served: "Served",
    notServed: "Not served",
    // Said once under a section that is off, rather than on each row beneath
    // it: the rows are already dimmed, and the sentence explains the dimming.
    sectionOff: "The whole section is off here, so nothing in it is served.",
    priceFor: "Price for {name} at this branch",
    /**
     * Copying a price list in from another branch.
     *
     * "Copy from" rather than "sync": it happens once, when it is pressed. A
     * word implying a standing link would promise that later changes follow,
     * which they do not.
     */
    // Says how many, because a bare "done" on something that rewrites a price
    // list is not checkable.
    copied: "{count} dishes now match {name}",
    // The expander on a dish. Loaded only when opened: most dishes are never
    // asked about, and a menu is a lot of questions to fetch up front.
    options: "Options",
    noOptions: "This dish asks nothing.",
    // A required question with every choice turned off here: the dish cannot
    // be added to a basket at this branch.
    requiredEmpty:
      "Every choice for this required question is off here, so customers at this branch cannot order the dish. Turn one back on, or turn the question off.",
    // 0181: the database refuses the last served answer to a required question.
    lastChoiceLocked:
      "The last choice for a required question here. To stop serving it, turn the question off at this branch, or the dish.",
    lastChoiceRefused:
      "That would leave a required question with nothing to choose at this branch. Turn the question off here instead, or the dish.",
    optionPriceFor: "Price for {name} at this branch",

    // ---- the branch's Menu and prices tab -----------------------------------
    failed: "Could not load this branch's menu",
    emptyTitle: "The menu is empty",
    emptyBody:
      "Add dishes on the shop's Menu tab; each branch can then hide them or charge its own price.",
    toMenu: "Go to the menu",
    intro:
      "What {name} serves and charges. Changes here are saved as you make them. An empty price means the shop's price.",
    introOwnCurrency:
      "What {name} serves and charges, in {code}. Every dish has its own price here, because this branch prices in a currency of its own. Changes are saved as you make them.",
    searchPlaceholder: "Search dishes",
    noMatches: "No dish matches that.",
    // ---- the one way to copy prices: a dialog from the Menu tab's toolbar ---
    copyPrices: "Copy prices",
    copyTitle: "Copy prices into {name}",
    copyBody:
      "Each dish and choice takes the price {from} charges. Where {from} charges the shop's price, {to} goes back to it too.",
    copyFrom: "From",
    copyWhat: "What",
    copyWhole: "The whole menu",
    copySection: "One section",
    copySectionLabel: "Section",
    // A branch in another currency, in the From list. `copy_branch_prices`
    // refuses it (0229): a price is digits with no currency of its own.
    copyOtherCurrency: "Prices in {code}",
    copyCurrencyRefused:
      "{from} charges in {fromCode} and {to} in {toCode}. Prices can only be copied between branches that charge in the same currency, so set these by hand.",
    copyLoading: "Working out what would change…",
    copyFailed: "Could not read {name}'s prices.",
    dishCount: "{count} dishes",
    dishCountOne: "1 dish",
    choiceCount: "{count} choices",
    choiceCountOne: "1 choice",
    copyAnd: "{a} and {b}",
    copyWillChange: "{what} will change price.",
    copyWillGoBack: "{what} will go back to the shop's price.",
    copySame: "{count} are already the same.",
    copySameOne: "1 is already the same.",
    copyNothing:
      "Everything here already matches {from}, so there is nothing to copy.",
    copyShowChanges: "Show changes",
    copyHideChanges: "Hide changes",
    copyBackToShop: "Shop's price",
    copyConfirm: "Copy {count} prices",
    copyConfirmOne: "Copy 1 price",
    sectionServed: "{name} served at this branch",
    servedFor: "{name} served at this branch",
    offEverywhere: "Off everywhere",
    shopPrice: "Shop price {price}",
    ownPrice: "Own price",
  },

  /** The shared form controls in `components/ui` — pickers, uploaders, charts. */
  controls: {
    noMatches: "Nothing matches that search.",
    allChosen: "Everything is already chosen.",
    // The shop pickers (`ShopSelect`), searched on the server as you type.
    noShops: "No shop matches “{term}”.",
    pickShop: "Choose a shop",
    pickShops: "Choose shops",
    remove: "Remove {name}",
    loadMore: "Load more",
    // The phone field shows only the national digits, so its spoken name
    // carries the country.
    phoneLabel: "Phone number, country code +{code}",
    imageRules: "JPEG, PNG or WebP, up to {mb} MB",
    // Leads the line when the picture has one shape it must be. The example
    // size is the one ChatGPT returns for it, so a generated file fits.
    imageShape: "{shape}, e.g. {width} × {height} px",
    // A cut-out: a JPEG can never be one, so it is not offered.
    imageCutoutRules:
      "PNG or WebP with a transparent background, up to {mb} MB",
    // A shop or dish photo: any size goes in, because it is cropped and
    // shrunk in the browser before it is uploaded. The width is what the
    // page's cover needs to stay sharp (`coverPixelsNeeded`).
    imagePhotoRules:
      "{shape} — choose any JPEG, PNG or WebP photo and you crop it to that next. {pixels} px wide or more stays sharp.",
    // Comma-separated, January first / Monday first. Split by the calendar.
    months:
      "January,February,March,April,May,June,July,August,September,October,November,December",
    weekdays: "Mo,Tu,We,Th,Fr,Sa,Su",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    time: "Time",
    done: "Done",
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
    notBuiltTitle: "Not built yet",
    notBuiltBody: "This section has not been built yet.",
    groupOperate: "Operate",
    groupCatalogue: "Catalogue",
    groupMarketing: "Marketing",
    groupPeople: "People",
    groupBusiness: "Business",
    shops: "Shops",
    library: "Menu library",
    collapse: "Collapse sidebar",
    expand: "Expand sidebar",
    openMenu: "Open menu",
    search: "Search or jump to…",
    searchShort: "Search",
    searchEmpty: "Nothing matches.",
    goTo: "Go to",
    actions: "Actions",
    signedInAs: "Signed in as",
    keyboard: "Keyboard shortcuts",
    newOrders: "{count} new",
    soundLocked:
      "Sound is off: the browser keeps the page silent until you click on it, so new orders won't chime.",
    soundTurnOn: "Turn on sound",
    // The browser's rule is per load; only its own site setting lifts it for
    // good, and then `soundLocked` reads the context as running and the bar
    // never shows on that computer.
    soundForGood:
      "To stop this for good: click the icon left of the address, open Site settings, and set Sound to Allow (Media autoplay in Edge).",
    live: "Live",
  },

  commandPalette: {
    find: "Find",
    findOrder: "Orders matching “{query}”",
    findCustomer: "Customers matching “{query}”",
    findShop: "Shops matching “{query}”",
    newShop: "New shop",
    newDriver: "New driver",
    newPromotion: "New promotion",
    newBundle: "New bundle",
    newCategory: "New category",
  },

  // Which deployment this is, on the sign-in pages and the strip across the top
  // of the dashboard. Production shows neither.
  environment: {
    staging: "Staging",
    development: "Development",
    stagingNote: "Test data. Nothing here reaches customers.",
    developmentNote: "Developer data. Nothing here reaches customers.",
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
    showPassword: "Show password",
    hidePassword: "Hide password",
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

/** A locale that covers part of `en`, in any words. */
type Translated<T> = {
  [K in keyof T]?: T[K] extends string ? string : Translated<T[K]>;
};

/** What drivers and shops read. See the note at the top of this file. */
const ar: Translated<Strings> = {
  dispatch: {
    heading: "طلب توصيل جديد {code}",
    tripOne: "استلام من محل واحد، ثم التسليم للزبون",
    // A figure rather than a counted noun: Arabic's noun changes with the
    // number, and "عدد المحلات" is right for all of them.
    tripMany: "عدد المحلات: {count}، ثم التسليم للزبون",
    placed: "وقت الطلب: {when}",
    customer: "الزبون: {name}",
    phone: "الهاتف: {phone}",
    map: "الموقع: {url}",
    note: "ملاحظة الزبون: {note}",
    stopPickup: "المحطة {n}: الاستلام من {store}",
    stopDeliver: "المحطة {n}: التسليم إلى {name}",
    payShop: "ادفع للمحل: {amount}",
    bag: "الأصناف: {amount}",
    // No minus sign: "يُخصم" says it, and a sign before a figure lands on the
    // wrong side of it in a right-to-left line.
    commission: "يُخصم {percent}% عمولة: {amount}",
    lineNote: "ملاحظة: {note}",
    packEach: "{size} للواحدة",
    subtotal: "الأصناف {amount}",
    delivery: "التوصيل {amount}",
    discount: "الخصم {amount}",
    rounding: "التقريب {amount}",
    collect: "اقبض من الزبون: {amount}",
    collectOther: "أو {amount}",
    cashLeft: "يبقى معك بعد الدفع للمحلات: {amount}",
    amountUnknown: "المبلغ: راجع لوحة التحكم.",
    kitchenHeading: "طلب جديد {code}",
    kitchenFor: "الاسم على الكيس: {name}",
    kitchenFooter:
      "سيستلم سائقنا الطلب ويدفع لكم عند الاستلام. إذا كان أي صنف غير متوفر، أخبرونا هنا قبل البدء.",
    cancelHeading: "أُلغي الطلب {code}",
    cancelBody:
      "تم إلغاء هذا الطلب. الرجاء عدم استلامه أو توصيله. نعتذر عن الإزعاج.",
  },
  orders: {
    incompleteSignup: "لم يكتمل التسجيل",
  },
  // The app's words (`units` in its bundle), so a shop and a customer read
  // one amount the same way.
  units: {
    kg: "كغ",
    g: "غ",
    l: "ل",
    ml: "مل",
    cm: "سم",
    piece: "قطعة",
    pieces: "قطع",
    piecesMany: "قطعة",
    piecesTwo: "قطعتان",
    bag: "كيس",
    bags: "أكياس",
    bagsMany: "كيس",
    bagsTwo: "كيسان",
    pack: "علبة",
    packs: "علب",
    packsMany: "علبة",
    packsTwo: "علبتان",
    size: "{quantity} {unit}",
  },
};

const bundles: Record<Locale, Translated<Strings>> = { en, ar };

/** The string at a dotted path through a bundle, if there is one. */
function lookup(bundle: unknown, parts: string[]): string | null {
  let value = bundle;
  for (const part of parts) {
    if (typeof value !== "object" || value === null) return null;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : null;
}

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
  const value =
    lookup(bundles[locale], parts) ?? lookup(bundles[DEFAULT_LOCALE], parts);
  if (value === null) return key;
  if (!params) return value;

  return value.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
