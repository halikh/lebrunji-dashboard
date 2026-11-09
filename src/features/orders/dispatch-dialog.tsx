"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Info,
  Store,
  Truck,
} from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  Copyable,
  Dialog,
  EmptyState,
  SearchInput,
  Skeleton,
  Tooltip,
  cx,
} from "@/components/ui";
import { isTakingOrders, type Courier } from "@/features/drivers/api/couriers";
import { useCouriers, useDispatchOrder } from "@/features/drivers/use-couriers";
import { useMoney } from "@/features/reference/use-currencies";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { isFinishedSlug } from "@/lib/order-status";
import { formatPhone } from "@/lib/phone";

import { fetchHandovers } from "./api/history";
import { type Order, type OrderLine, type OrderStore } from "./api/orders";
import { PlaceName } from "./place";
import { OrderRefusal } from "./api/refusal";
import { dispatchMessage, kitchenMessage, whatsappLink } from "./dispatch";
import { orderKeys, patchOrderCaches } from "./use-orders";

/**
 * Handing the order out: the kitchen first, then a driver.
 *
 * ## Three steps, in the order they happen
 *
 * 1. **Tell the kitchen.** Each shop gets only its own items — no address,
 *    phone or money (see `kitchenMessage`). A shop with nothing cooking has
 *    nothing for a driver to collect, so this comes first.
 * 2. **Choose a driver.** Drivers are rows you press, each with a face, a name
 *    and the number the message will go to — the last chance to notice the
 *    customer's address is about to reach the wrong phone. Only drivers on
 *    shift now are offered, by the drivers screen's own rule (`isTakingOrders`).
 * 3. **Check and send.** The exact message, then one button. Choosing and
 *    sending are separate presses on purpose: the message carries a home
 *    address, and once it is in somebody's WhatsApp it cannot be called back.
 *
 * ## Recorded first, then the chat — never the other way round
 *
 * The hand-over is `api_v1_dispatch_order` (`0173`), and its refusals are
 * exactly the reasons a message must not go out: cancelled a moment ago
 * (`CANCL`), delivered (`DONE`), handed to somebody else by another operator
 * (`TAKEN`), or the driver has left (`NOCOU`). So Send opens a blank window
 * inside the click — no pop-up blocker treats it as unrequested — and points
 * it at WhatsApp only once the server has said yes. On a refusal the window
 * is closed and the dialog says why. If the browser refused even the blank
 * window, the chat is offered as a link once the record lands.
 *
 * ## Somebody already has it
 *
 * The dialog says who, and since when. Choosing anybody else shows what
 * reassigning means before the button is pressed — the first driver still has
 * the address — and the button says "Hand it to …" rather than "Send". The
 * server refuses a silent second hand-over (`TAKEN`), so two operators racing
 * on one order both meet that question rather than both succeeding.
 */

/**
 * How many drivers fit on screen before a list stops being browsable. Below
 * this a search box is one more thing to read past; above it, typing three
 * letters beats scrolling near-identical rows.
 */
const BROWSABLE = 6;

export function DispatchDialog({
  order,
  lines,
  onClose,
}: {
  order: Order;
  lines: OrderLine[];
  onClose: () => void;
}) {
  const clock = useClock();
  const { currencies, secondaryCode } = useMoney();
  const dispatch = useDispatchOrder();
  const queryClient = useQueryClient();

  // Who has it now — newest first, so the first is the holder. The same key
  // the history tab reads, so the two never disagree.
  const handovers = useQuery({
    queryKey: orderKeys.handovers(order.id),
    queryFn: () => fetchHandovers(order.id),
  });
  const holder = handovers.data?.[0] ?? null;

  /**
   * Finished while the dialog was open — realtime refetched the order under
   * it. The receipt hides Notify for a finished order; this is the same rule
   * for one that finished after the button was pressed.
   */
  const finished =
    order.stores.length > 0 &&
    order.stores.every((portion) => isFinishedSlug(portion.statusSlug));

  /**
   * Already with a driver: every portion still in play is `driverSent`. Read
   * from the order, not the hand-overs — an Undo moves the order back without
   * taking the hand-over away, and it is `driverSent` that blocks an amend.
   */
  const onTheWay =
    order.stores.some((portion) => portion.rawStatus === "driverSent") &&
    order.stores.every(
      (portion) =>
        portion.rawStatus === "driverSent" ||
        isFinishedSlug(portion.statusSlug),
    );

  /** The driver picked in step 2, whose message step 3 shows. */
  const [chosen, setChosen] = useState<Courier | null>(null);
  /**
   * The server said `TAKEN` to a press made when nobody seemed to have it.
   * The next press is a reassignment, and says so, even before the refetched
   * hand-overs name who has it.
   */
  const [raced, setRaced] = useState(false);
  /** Why the last hand-over was refused. */
  const [failure, setFailure] = useState<string | null>(null);
  /** The chat, when the browser would not open a window for it. */
  const [fallback, setFallback] = useState<{
    href: string;
    name: string;
  } | null>(null);

  const [search, setSearch] = useState("");

  /**
   * Two reads of the same query. With no term it is the list the drivers page
   * already holds, so it is free — and it answers "how many drivers are there
   * at all", which decides whether a search box belongs here. Asking the
   * filtered list instead would hide the box the moment a search matched
   * nothing.
   */
  const all = useCouriers();
  const couriers = useCouriers(search);

  // On shift *now*: the rota, unless tonight's override says otherwise.
  const liveCount = (all.data ?? []).filter((one) =>
    isTakingOrders(one),
  ).length;
  const filtering = liveCount > BROWSABLE;
  const live = (couriers.data ?? []).filter((one) => isTakingOrders(one));
  const searching = search.trim().length >= SEARCH.minTerm;
  const anyOnBooks = (all.data?.length ?? 0) > 0;

  // Which shops have had their chat opened here. Opening is all the dashboard
  // can know — the operator presses Send inside WhatsApp — but it is enough to
  // say which are left, which is the question with three shops.
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  const markSent = (id: string) =>
    setSent((current) => new Set(current).add(id));

  const reachable = order.stores.filter((portion) => portion.storeWhatsapp);
  const unsent = reachable.filter((portion) => !sent.has(portion.id));
  const nextShop = unsent[0] ?? null;
  const [blocked, setBlocked] = useState(false);

  const kitchenText = (portion: OrderStore) =>
    kitchenMessage({ ...order, lines }, portion.id, clock.clock24h);
  const kitchenHref = (portion: OrderStore) =>
    whatsappLink(portion.storeWhatsapp as string, kitchenText(portion));

  /**
   * Every unopened shop chat, from one press.
   *
   * A click may open **one** window; the rest are pop-ups, blocked until the
   * site is allowed them. So each is opened and checked: the ones that opened
   * are marked, and if any were refused the dialog says how to allow them and
   * the button stays for the rest — a second press opens the next either way.
   *
   * Not `noopener` in the features: with it `window.open` always returns null
   * and a blocked window cannot be told from an opened one. The opener is cut
   * by hand instead.
   */
  function notifyAll() {
    let refused = false;
    const opened: string[] = [];
    for (const portion of unsent) {
      // A name per shop, so a second press reuses that shop's tab.
      const win = window.open(kitchenHref(portion), `kitchen-${portion.id}`);
      if (win) {
        win.opener = null;
        opened.push(portion.id);
      } else {
        refused = true;
      }
    }
    setSent((current) => {
      const next = new Set(current);
      for (const id of opened) next.add(id);
      return next;
    });
    setBlocked(refused);
  }

  // The order's currency and the other one, so each shop's pay and the total
  // can be said in both. Either missing (rates still loading, or no second
  // currency) and the message leaves the second figures out.
  const from = currencies?.find((one) => one.code === order.currencyCode);
  const otherCode = secondaryCode(order.currencyCode);
  const to = otherCode
    ? currencies?.find((one) => one.code === otherCode)
    : undefined;

  const message = dispatchMessage(
    { ...order, lines },
    from,
    // The driver reads this on their own phone, so it carries the business's
    // clock format — the phone has no idea what this setting says.
    clock.clock24h,
    from && to ? { from, to } : undefined,
  );

  const isHolder = (driver: Courier) => holder?.courierId === driver.id;
  /** Sending to the chosen driver takes the order off somebody else. */
  const reassigning =
    chosen !== null && !isHolder(chosen) && (holder !== null || raced);

  /**
   * Records the hand-over, then opens the chat — see the header. Must run
   * inside the click, so the blank window counts as the operator's own.
   */
  function record(driver: Courier, reassign: boolean) {
    setFailure(null);
    setFallback(null);

    const href = whatsappLink(driver.phone, message);
    const win = window.open("about:blank", `dispatch-${order.id}`);
    // Cut by hand rather than with `noopener`, which would return null and
    // leave nothing to point at the chat once the record lands.
    if (win) win.opener = null;

    dispatch.mutate(
      { orderId: order.id, courierId: driver.id, reassign },
      {
        onSuccess: () => {
          // Every live portion is `driverSent` now. The refetch the hook
          // started is still the authority; this only closes the gap.
          patchOrderCaches(queryClient, order.id, "driverSent");
          if (win && !win.closed) {
            win.location.replace(href);
            onClose();
          } else {
            setFallback({ href, name: driver.name });
          }
        },
        onError: (error) => {
          win?.close();
          if (error instanceof OrderRefusal && error.code === "TAKEN") {
            // Somebody got there first. Not a dead end: show who, and let
            // the next press be a deliberate reassignment.
            void handovers.refetch();
            setRaced(true);
          }
          setFailure(
            error instanceof Error
              ? error.message
              : t("common.somethingWentWrong"),
          );
        },
      },
    );
  }

  /** The footer's Send. */
  function send() {
    if (!chosen) return;
    if (isHolder(chosen)) {
      // The same person, but an Undo has taken the order back off them.
      // Recorded again as a reassignment, so it moves back to driverSent —
      // left confirmed, it could be amended behind the driver's back.
      if (!onTheWay) {
        record(chosen, true);
        return;
      }
      // Already theirs and on its way: nothing to record. Just the chat, for
      // a message that went astray.
      const win = window.open(
        whatsappLink(chosen.phone, message),
        `dispatch-${order.id}`,
      );
      if (win) win.opener = null;
      onClose();
      return;
    }
    record(chosen, reassigning);
  }

  const sendLabel = !chosen
    ? t("dispatch.send")
    : isHolder(chosen)
      ? t("dispatch.sendAgain")
      : reassigning
        ? t("dispatch.reassignConfirm", { name: chosen.name })
        : t("dispatch.sendTo", { name: chosen.name });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("dispatch.title", { code: order.code })}
      description={t("dispatch.blurb")}
      size="lg"
      footer={
        <>
          <p className="flex min-w-0 basis-full items-center gap-1.5 text-[12.5px] text-ink-3 sm:flex-1 sm:basis-0">
            <Info className="size-3.5 shrink-0" />
            {t("dispatch.opensWhatsApp")}
          </p>
          {/* One group, so the two buttons never split across lines. */}
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            {!finished && (
              <Button
                variant="primary"
                disabled={!chosen || fallback !== null}
                pending={dispatch.isPending}
                onClick={send}
              >
                <WhatsAppMark />
                <span className="max-w-56 truncate">{sendLabel}</span>
              </Button>
            )}
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── Step 1: the kitchen ─────────────────────────────────── */}
        <Step
          n={1}
          icon={<Store />}
          title={t("dispatch.stepKitchen")}
          description={t("dispatch.kitchenBlurb")}
          done={reachable.length > 0 && unsent.length === 0}
          aside={
            reachable.length > 1 &&
            (nextShop ? (
              <Button size="sm" onClick={notifyAll}>
                <WhatsAppMark />
                {unsent.length === reachable.length
                  ? t("dispatch.kitchenAll", { count: reachable.length })
                  : t("dispatch.kitchenRest", { count: unsent.length })}
              </Button>
            ) : (
              <Badge tone="success">
                <Check className="size-3.5" />
                {t("dispatch.kitchenAllDone")}
              </Badge>
            ))
          }
        >
          {blocked && nextShop && (
            <Notice tone="warning" role="status">
              {t("dispatch.kitchenBlocked")}
            </Notice>
          )}

          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line">
            {order.stores.map((portion) => (
              <ShopRow
                key={portion.id}
                portion={portion}
                sent={sent.has(portion.id)}
                href={portion.storeWhatsapp ? kitchenHref(portion) : null}
                message={kitchenText(portion)}
                onSent={() => markSent(portion.id)}
              />
            ))}
          </ul>

          {reachable.length > 1 && <PopupHelp />}
        </Step>

        {/* ── Step 2: the driver ──────────────────────────────────── */}
        <Step
          n={2}
          icon={<Truck />}
          title={t("dispatch.stepDriver")}
          description={finished ? undefined : t("dispatch.stepDriverHint")}
          done={chosen !== null}
          last={finished}
        >
          {holder && (
            // Who has it, before anybody is offered it again.
            <Notice tone="neutral">
              {t("dispatch.alreadyWith", {
                name: holder.courierName,
                when: clock.dayAndTime(holder.dispatchedAt),
              })}
            </Notice>
          )}

          {finished ? (
            <Notice tone="neutral">{t("dispatch.finished")}</Notice>
          ) : (
            <>
              {filtering && (
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={t("drivers.search")}
                />
              )}

              {couriers.isPending && (
                <div aria-hidden className="flex flex-col gap-2">
                  {[0, 1, 2].map((row) => (
                    <Skeleton key={row} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              )}

              {couriers.isError && (
                <Notice tone="danger" role="alert">
                  <span className="flex flex-wrap items-center gap-2">
                    {t("common.loadFailed")}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void couriers.refetch()}
                    >
                      {t("common.retry")}
                    </Button>
                  </span>
                </Notice>
              )}

              {couriers.isSuccess && live.length === 0 && searching && (
                <EmptyState
                  className="py-8"
                  title={t("drivers.searchNone", { term: search.trim() })}
                />
              )}

              {couriers.isSuccess && live.length === 0 && !searching && (
                // Two different empties. Drivers who are all off shift is not
                // "no driver yet" — said that way, it sends the operator to
                // add somebody who is already there.
                <EmptyState
                  className="py-8"
                  icon={<Truck />}
                  title={t(
                    anyOnBooks
                      ? "dispatch.noDriversOnShift"
                      : "dispatch.noDrivers",
                  )}
                  action={
                    <Button asChild size="sm">
                      <Link href={anyOnBooks ? "/drivers" : "/drivers/new"}>
                        {t(
                          anyOnBooks
                            ? "dispatch.seeDrivers"
                            : "dispatch.addDriver",
                        )}
                      </Link>
                    </Button>
                  }
                />
              )}

              {live.length > 0 && (
                <div
                  role="radiogroup"
                  aria-label={t("dispatch.stepDriver")}
                  className="flex flex-col gap-2"
                >
                  {live.map((driver) => (
                    <DriverRow
                      key={driver.id}
                      driver={driver}
                      selected={chosen?.id === driver.id}
                      holds={isHolder(driver)}
                      // One hand-over at a time: a second press mid-flight
                      // would be the server's `TAKEN` about our own press.
                      disabled={dispatch.isPending}
                      onSelect={() => {
                        setChosen(driver);
                        setFailure(null);
                        setFallback(null);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </Step>

        {/* ── Step 3: check and send ──────────────────────────────── */}
        {!finished && (
          <Step
            n={3}
            icon={<WhatsAppMark />}
            title={t("dispatch.stepPreview")}
            description={
              chosen
                ? t("dispatch.previewTo", {
                    name: chosen.name,
                    phone: formatPhone(chosen.phone),
                  })
                : t("dispatch.chooseFirst")
            }
            last
          >
            {reassigning && chosen && (
              <Notice tone="warning" role="alert">
                <span className="font-semibold">
                  {t("dispatch.reassignTitle", { name: chosen.name })}
                </span>{" "}
                {t("dispatch.reassignBody", {
                  name: holder?.courierName || t("dispatch.someoneElse"),
                })}
              </Notice>
            )}

            {failure && (
              <Notice tone="danger" role="alert">
                {failure}
              </Notice>
            )}

            {fallback && (
              // Recorded, but the browser would not open a window. The chat
              // as a link — a real navigation the operator makes.
              <Button asChild variant="primary" className="w-full">
                <a
                  href={fallback.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onClose}
                >
                  <WhatsAppMark />
                  {t("dispatch.openChat", { name: fallback.name })}
                </a>
              </Button>
            )}

            {chosen && <MessagePreview text={message} />}
          </Step>
        )}
      </div>
    </Dialog>
  );
}

/* ───────────────────────────── Pieces ───────────────────────────── */

/** A numbered step with a rail joining it to the next. */
function Step({
  n,
  icon,
  title,
  description,
  aside,
  done,
  last,
  children,
}: {
  n: number;
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  done?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="relative flex gap-3.5">
      {!last && (
        <span
          aria-hidden
          className="absolute start-[13px] top-8 bottom-[-1.5rem] w-px bg-line"
        />
      )}
      <span
        aria-hidden
        className={cx(
          "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold tabular-nums",
          done
            ? "bg-accent text-white"
            : "border border-line-strong bg-surface text-ink-2",
        )}
      >
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink [&_svg]:size-4 [&_svg]:text-ink-3">
              {icon}
              {title}
            </h3>
            {description && (
              <p className="text-[13px] text-ink-3">{description}</p>
            )}
          </div>
          {aside}
        </div>
        {children}
      </div>
    </section>
  );
}

function Notice({
  tone,
  role,
  children,
}: {
  tone: "neutral" | "warning" | "danger";
  role?: "status" | "alert";
  children: ReactNode;
}) {
  return (
    <div
      role={role}
      className={cx(
        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px]",
        tone === "neutral" && "border-line bg-subtle text-ink-2",
        tone === "warning" &&
          "border-warning/25 bg-warning-soft text-warning-ink",
        tone === "danger" && "border-danger/20 bg-danger-soft text-danger-ink",
      )}
    >
      {tone !== "neutral" && (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** One shop: its number, its ticket on request, and the button that opens it. */
function ShopRow({
  portion,
  sent,
  href,
  message,
  onSent,
}: {
  portion: OrderStore;
  sent: boolean;
  href: string | null;
  message: string;
  onSent: () => void;
}) {
  const [showing, setShowing] = useState(false);
  const previewId = useId();

  if (!href) {
    // No number is not a broken row. It names the shop, says why there is
    // nothing to press, and points at the screen that fixes it.
    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-subtle px-4 py-3 text-[13px]">
        <PlaceName store={portion} nameClassName="font-medium text-ink" />
        <span className="text-ink-3">{t("dispatch.kitchenNoNumber")}</span>
        <Link
          href={`/shops/${portion.storeId}?tab=branches`}
          className="font-medium text-accent hover:underline"
        >
          {t("dispatch.kitchenAddNumber")}
        </Link>
      </li>
    );
  }

  return (
    <li className="bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <PlaceName
            store={portion}
            nameClassName="text-[14px] font-medium text-ink"
          />
          <span className="truncate text-[12.5px] text-ink-3 tabular-nums">
            {formatPhone(portion.storeWhatsapp as string)}
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={showing}
          aria-controls={previewId}
          onClick={() => setShowing((was) => !was)}
        >
          {showing ? t("dispatch.hideMessage") : t("dispatch.showMessage")}
          <ChevronDown
            className={cx("transition-transform", showing && "rotate-180")}
          />
        </Button>
        {/* Opened stays pressable — a chat closed by mistake has to be
            reopenable — but says it has been done, so the eye skips it. */}
        <Button
          asChild
          size="sm"
          variant={sent ? "secondary" : "primary"}
          className="min-w-24"
        >
          <a href={href} target="_blank" rel="noreferrer" onClick={onSent}>
            {sent ? <Check className="text-success" /> : <WhatsAppMark />}
            {sent ? t("dispatch.kitchenSent") : t("dispatch.kitchenSend")}
          </a>
        </Button>
      </div>
      {showing && (
        <div id={previewId} className="px-4 pb-3">
          <MessagePreview text={message} />
        </div>
      )}
    </li>
  );
}

/** A driver, pressed to choose them. The number is there to be checked. */
function DriverRow({
  driver,
  selected,
  holds,
  disabled,
  onSelect,
}: {
  driver: Courier;
  selected: boolean;
  holds: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cx(
        "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-start transition-colors",
        "disabled:cursor-wait disabled:opacity-60",
        selected
          ? "border-accent bg-accent-soft ring-1 ring-accent"
          : "border-line bg-surface hover:border-line-strong hover:bg-subtle",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium text-ink">
          {driver.name}
        </span>
        {/* On the row on purpose: the last chance to notice the order is
            about to go to the wrong person, and it carries a home address. */}
        <span className="truncate text-[12.5px] text-ink-3 tabular-nums">
          {formatPhone(driver.phone)}
        </span>
      </span>
      {holds && <Badge tone="info">{t("dispatch.holderBadge")}</Badge>}
      <span
        aria-hidden
        className={cx(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border",
          selected ? "border-accent bg-accent" : "border-line-strong",
        )}
      >
        {selected && <span className="size-1.5 rounded-full bg-white" />}
      </span>
    </button>
  );
}

/** The message as it will arrive, in a chat bubble, with a copy button. */
function MessagePreview({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // No clipboard (insecure origin, or denied). The text is selectable.
    }
  }

  const label = copied ? t("common.copied") : t("dispatch.copyMessage");
  return (
    <div className="relative rounded-lg border border-line bg-hover p-3">
      <Tooltip content={label}>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={label}
          className="absolute end-5 top-5 z-10 flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-hover hover:text-ink"
        >
          {copied ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </Tooltip>
      {/* `plaintext`: each line picks its own direction, as WhatsApp's do. */}
      <p className="max-h-64 overflow-y-auto rounded-md rounded-ss-none bg-surface px-3 py-2.5 pe-10 text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink shadow-xs scrollbar-thin [unicode-bidi:plaintext]">
        {text}
      </p>
    </div>
  );
}

/**
 * How to let "Notify all" open every chat: Chrome's pop-up permission, step
 * by step. Folded away — it is done once per computer and then never read.
 *
 * The address in step 3 is read from the page, so each environment shows its
 * own — the permission is per address, and the wrong one would be a setting
 * that silently does nothing.
 */
function PopupHelp() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // Only rendered inside a dialog opened by a click: no server render.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="rounded-md border border-line bg-subtle text-[13px]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-start font-medium text-ink-2 hover:text-ink"
      >
        <Info className="size-4 shrink-0 text-ink-3" />
        {t("dispatch.popupHelpTitle")}
        <ChevronDown
          className={cx(
            "ms-auto size-4 shrink-0 text-ink-3 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div id={panelId} className="px-3 pb-3">
          <ol className="flex list-decimal flex-col gap-2 ps-7 text-ink-2">
            <li>
              {t("dispatch.popupStep1")}{" "}
              {/* Copied rather than linked: Chrome refuses to let a web page
                  open a chrome:// address, so a link would do nothing. */}
              <Copyable
                value={SETTINGS_URL}
                label={t("dispatch.popupCopySettings")}
                className="font-medium text-ink"
              />
            </li>
            <li>{t("dispatch.popupStep2")}</li>
            <li>
              {t("dispatch.popupStep3")}{" "}
              <Copyable
                value={origin}
                label={t("dispatch.popupCopyAddress")}
                className="font-medium text-ink"
              />
            </li>
            <li>{t("dispatch.popupStep4")}</li>
          </ol>
          <p className="mt-2 text-[12.5px] text-ink-3">
            {t("dispatch.popupNote")}
          </p>
        </div>
      )}
    </div>
  );
}

const SETTINGS_URL = "chrome://settings/content/popups";

/**
 * WhatsApp's mark, drawn rather than fetched — one more request for sixteen
 * pixels, on a screen that has to work on a shop's bad connection.
 */
export function WhatsAppMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.86 9.86 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.24-8.23a8.18 8.18 0 0 1 5.82 2.42 8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.22-8.24 8.22Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.1-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.09-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.31-.23.24-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.74 2.65 4.2 3.72.59.25 1.05.4 1.4.52.6.18 1.14.16 1.56.1.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}
