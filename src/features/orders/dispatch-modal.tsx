"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState } from "react";

import { Button, cx } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { Collapse } from "@/components/ui/collapse";
import { Copyable } from "@/components/ui/copyable";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { isTakingOrders, type Courier } from "@/features/drivers/api/couriers";
import {
  useCouriers,
  useDispatchOrder,
} from "@/features/drivers/use-couriers";
import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { isFinishedSlug } from "@/lib/order-status";
import { formatPhone } from "@/lib/phone";
import { formatDayAndTime } from "@/lib/time";

import { fetchHandovers } from "./api/history";
import type { Order, OrderLine } from "./api/orders";
import { OrderRefusal } from "./api/refusal";
import { useClock } from "@/features/settings/use-clock";
import { orderKeys } from "./use-orders";

import { dispatchMessage, kitchenMessage, whatsappLink } from "./dispatch";

/**
 * Handing the order to a driver.
 *
 * ## Why a dialog and not two controls in the actions bar
 *
 * It was a select beside a button, sitting permanently across the bottom of
 * every receipt. Two things were wrong with that. It spent a whole row of the
 * panel on something the operator does **once** per order, in front of the
 * status buttons they press several times. And a `<select>` is the wrong
 * control for the question: picking a driver is choosing a *person*, and a
 * dropdown of names strips them to a word — no number to check, no way to see
 * who is on shift, and the choice hidden behind a click before you can even
 * see what is on offer.
 *
 * So it is one small button, and a dialog where the drivers are **rows you
 * press**. Each carries a face, a name and the number the message is going to
 * — which is the thing worth checking before you send somebody an address.
 *
 * ## Recorded first, then the chat — never the other way round
 *
 * A driver row used to be a plain link that recorded the hand-over on the way
 * past and swallowed any failure. Since `0173` the record is
 * `api_v1_dispatch_order`, and its refusals are exactly the reasons a message
 * must **not** go out: the order was cancelled a moment ago (`CANCL`), it was
 * delivered (`DONE`), another operator has just handed it to somebody else
 * (`TAKEN`), or the driver has left (`NOCOU`). Opening the chat first and
 * reporting the failure afterwards would put a customer's address on a
 * stranger's phone or send a driver to a cancelled order, and a message once
 * sent cannot be called back. A record that fails is a retry; a message that
 * should not have been sent is not.
 *
 * So the row is a button. The press opens a blank window straight away —
 * inside the click, so no pop-up blocker treats it as unrequested — and that
 * window is pointed at WhatsApp only once the server has said yes. On a
 * refusal it is closed and the dialog says why. If the browser refused even the
 * blank window, the dialog offers the chat as a link once the record succeeds.
 *
 * ## Somebody already has it
 *
 * The dialog says who, and since when, and a press on anybody else asks first:
 * reassigning sends the address to a second person, and the first still has
 * it. The server refuses a silent second hand-over too (`TAKEN`), so two
 * operators racing on the same order meet the same question rather than both
 * succeeding.
 */
/**
 * How many drivers fit on a screen before a list stops being browsable.
 *
 * Below this, a search box is one more control to read past on a dialog whose
 * whole job is one press. Above it, scrolling a column of near-identical rows
 * looking for a name is worse than typing three letters of it.
 */
const BROWSABLE = 6;

export function DispatchModal({
  order,
  lines,
  onClose,
}: {
  order: Order;
  lines: OrderLine[];
  onClose: () => void;
}) {
  const titleId = useId();
  const clock = useClock();
  const { currencies, convertTo, secondaryCode } = useMoney();
  const dispatch = useDispatchOrder();

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
   * from the order, not from the hand-overs — an Undo moves the order back
   * without taking the hand-over away, so "has a holder" and "is on the way"
   * can disagree, and it is the second that blocks an amend or a cancel.
   */
  const onTheWay =
    order.stores.some((portion) => portion.statusSlug === "driverSent") &&
    order.stores.every(
      (portion) =>
        portion.statusSlug === "driverSent" ||
        isFinishedSlug(portion.statusSlug),
    );

  /** The driver about to replace the holder, waiting on a yes. */
  const [confirming, setConfirming] = useState<Courier | null>(null);
  /** Why the last hand-over was refused, beside the driver it was about. */
  const [failure, setFailure] = useState<string | null>(null);
  /** The chat, when the browser would not open a window for it. */
  const [fallback, setFallback] = useState<{
    href: string;
    name: string;
  } | null>(null);

  const [search, setSearch] = useState("");

  /**
   * Two reads of the same query, and the first is free.
   *
   * `useCouriers()` with no term is the one the drivers page and the actions
   * bar already hold, so it comes from the cache. It answers "how many drivers
   * are there at all", which is what decides whether a search box belongs here
   * — a shop with two drivers should not be handed a filter, and a shop with
   * thirty cannot work without one.
   *
   * Asking the filtered list how many exist would get this backwards: type
   * three letters, match nothing, and the box that let you type disappears.
   */
  const all = useCouriers();
  const couriers = useCouriers(search);

  // On shift *now*, by the same rule the drivers screen shows: the rota,
  // unless tonight's override says otherwise. Reading the rota alone offered a
  // driver who had been switched off shift on the drivers screen.
  const liveCount = (all.data ?? []).filter((one) =>
    isTakingOrders(one),
  ).length;
  const filtering = liveCount > BROWSABLE;
  const live = (couriers.data ?? []).filter((one) => isTakingOrders(one));
  const searching = search.trim().length >= SEARCH.minTerm;

  // Which shops have had their chat opened in this dialog. Opening is all the
  // dashboard can know — the operator presses Send inside WhatsApp — but it is
  // enough to say which ones are left, which is the question with three shops.
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  const markSent = (id: string) =>
    setSent((current) => new Set(current).add(id));

  const reachable = order.stores.filter((portion) => portion.storeWhatsapp);
  const unsent = reachable.filter((portion) => !sent.has(portion.id));
  const nextShop = unsent[0] ?? null;

  /** A shop's own chat, with only its own items in it. */
  const kitchenHref = (portion: (typeof order.stores)[number]) =>
    whatsappLink(
      portion.storeWhatsapp as string,
      kitchenMessage({ ...order, lines }, portion.id, clock.clock24h),
    );

  // Set when the browser refused some of the chats as pop-ups.
  const [blocked, setBlocked] = useState(false);

  /**
   * Every shop's chat that has not been opened yet, from one press.
   *
   * A browser lets a single click open **one** new window; the rest are
   * pop-ups, and are blocked until the site is allowed them. Chrome then shows
   * the blocked-pop-up icon in the address bar, and "Always allow" there is a
   * one-time setting for the dashboard. So each chat is opened and checked:
   * the ones that opened are marked sent, and if any were refused the dialog
   * says how to allow them and the button stays, now for the rest — pressing
   * it again opens the next one either way, so nothing is ever stranded.
   *
   * Not `noopener` in the features: with it `window.open` always returns null
   * and a blocked window cannot be told from an opened one. The opener is cut
   * by hand instead, which is what `noopener` was for.
   */
  function notifyAll() {
    let refused = false;
    const opened: string[] = [];
    for (const portion of unsent) {
      // A name per shop, so a second press reuses that shop's tab rather than
      // stacking another beside it.
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

  const message = dispatchMessage(
    { ...order, lines },
    currencies?.find((one) => one.code === order.currencyCode),
    // The driver reads this on their own phone, so it is the *shop's* format
    // that has to reach it — the message is composed here and sent from a
    // device that has no idea what this setting says.
    clock.clock24h,
    // The total in the other currency, at the rate the receipt reads it at.
    (minor) => {
      const other = secondaryCode(order.currencyCode);
      return other
        ? convertTo(minor, order.currencyCode, other, order.shopRate)
        : null;
    },
  );

  /**
   * Records the hand-over, then opens the chat — see the header.
   *
   * Must run inside the click: the blank window is opened synchronously so it
   * counts as the operator's own, and only navigated once the record lands.
   */
  function send(driver: Courier, reassign: boolean) {
    setFailure(null);
    setConfirming(null);
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
          if (win && !win.closed) {
            win.location.replace(href);
            onClose();
          } else {
            setFallback({ href, name: driver.name });
          }
        },
        onError: (error) => {
          win?.close();
          // Somebody got there first. Not a dead end: show who, and ask.
          if (error instanceof OrderRefusal && error.code === "TAKEN") {
            void handovers.refetch();
            setConfirming(driver);
            return;
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

  /** A press on a driver row. */
  function choose(driver: Courier) {
    if (holder && holder.courierId === driver.id) {
      // The same person, but the order is no longer "On the way" — an Undo
      // moved it back. Skipping the function here left it confirmed while the
      // driver rode off with it, and confirmed is the state that still lets it
      // be amended or cancelled behind their back. Recorded again, as a
      // reassignment, so it moves back to driverSent.
      if (!onTheWay) {
        send(driver, true);
        return;
      }
      // Sending it again to the person who has it: nothing to record, nothing
      // moves. Just the chat, for a message that went astray.
      const win = window.open(
        whatsappLink(driver.phone, message),
        `dispatch-${order.id}`,
      );
      if (win) win.opener = null;
      onClose();
      return;
    }
    if (holder) {
      setConfirming(driver);
      return;
    }
    send(driver, false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy={titleId}
      className="w-[min(520px,92vw)]"
    >
      <div className="flex max-h-[80vh] flex-col">
        <div className="flex flex-col gap-xxs border-b border-border p-xxl">
          <h2 id={titleId} className="text-[20px]">
            {t("dispatch.title", { code: order.code })}
          </h2>
          <p className="text-[13px] text-text-soft">{t("dispatch.blurb")}</p>
          <p className="text-[12px] text-text-faint">
            {t("dispatch.kitchenBlurb")}
          </p>

          {filtering && (
            <div className="flex pt-sm">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={t("drivers.search")}
              />
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto scroll-hint p-xxl">
          {/* The kitchen first, because it is the earlier step: a shop that has
              not been told what to cook has nothing for a driver to collect.

              Each shop gets **only its own items**, and no address, phone or
              money — see `kitchenMessage`. A shop cooking one half of a
              two-shop order has no reason to hold a customer's home address,
              and once it is in a WhatsApp thread it is on somebody's phone for
              good. */}
          <section className="flex flex-col gap-sm">
            <div className="flex items-center justify-between gap-md">
              <h3 className="text-[17px]">
                {t("dispatch.kitchenTab")}
              </h3>

              {/* Notify all: one press opens every shop's chat, each already
                  written. Only worth having with more than one shop to tell. */}
              {reachable.length > 1 &&
                (nextShop ? (
                  <button
                    type="button"
                    onClick={notifyAll}
                    className="flex h-[40px] shrink-0 items-center gap-sm rounded-xs bg-whatsapp px-md text-[14px] font-medium text-on-whatsapp hover:bg-whatsapp-deep"
                  >
                    <WhatsAppMark />
                    {unsent.length === reachable.length
                      ? t("dispatch.kitchenAll", { count: reachable.length })
                      : t("dispatch.kitchenRest", { count: unsent.length })}
                  </button>
                ) : (
                  <span className="flex h-[40px] shrink-0 items-center gap-xs text-[14px] font-medium text-accent-deep">
                    <Check />
                    {t("dispatch.kitchenAllDone")}
                  </span>
                ))}
            </div>

            {blocked && nextShop && (
              <p
                role="status"
                className="rounded-sm bg-warning-wash px-md py-sm text-[13px]"
              >
                {t("dispatch.kitchenBlocked")}
              </p>
            )}

            {reachable.length > 1 && <PopupHelp />}

            {order.stores.map((portion) =>
              portion.storeWhatsapp ? (
                <a
                  key={portion.id}
                  href={kitchenHref(portion)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => markSent(portion.id)}
                  className={cx(
                    "flex items-center gap-lg rounded-lg border-2 border-transparent bg-surface p-lg shadow-card",
                    "transition-[border-color,background-color] hover:border-whatsapp hover:bg-whatsapp-wash/60",
                  )}
                >
                  <div className="flex min-w-0 flex-grow flex-col gap-xxs">
                    <span className="truncate text-[15px] font-semibold">
                      {portion.storeName}
                    </span>
                    <span className="truncate text-[12px] tabular-nums text-text-faint">
                      {formatPhone(portion.storeWhatsapp)}
                    </span>
                  </div>

                  {/* Sent stays pressable — a chat closed by mistake has to
                      be reopenable — but says it has been done, so the eye
                      skips it on the way to the ones that have not. */}
                  {sent.has(portion.id) ? (
                    <span className="flex shrink-0 items-center gap-xs px-md text-[14px] font-medium text-accent-deep">
                      <Check />
                      {t("dispatch.kitchenSent")}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-sm rounded-md bg-whatsapp px-lg py-sm text-[14px] font-semibold text-on-whatsapp">
                      <WhatsAppMark />
                      {t("dispatch.kitchenSend")}
                    </span>
                  )}
                </a>
              ) : (
                // No number is not a broken row. It names the shop, says why
                // there is nothing to press, and points at the screen that
                // fixes it.
                <p
                  key={portion.id}
                  className="rounded-lg border border-dashed border-border px-lg py-md text-[13px] text-text-faint"
                >
                  {portion.storeName} — {t("dispatch.kitchenNoNumber")}{" "}
                  <Link
                    href={`/catalogue/${portion.storeId}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {t("dispatch.kitchenAddNumber")}
                  </Link>
                </p>
              ),
            )}
          </section>

          <h3 className="text-[17px]">
            {t("dispatch.driverTab")}
          </h3>

          {holder && (
            // Who has it, before anybody is offered it again.
            <p className="rounded-sm bg-neutral-fill px-md py-sm text-[13px]">
              {t("dispatch.alreadyWith", {
                name: holder.courierName,
                when: formatDayAndTime(holder.dispatchedAt, clock.clock24h),
              })}
            </p>
          )}

          {failure && (
            <p
              role="alert"
              className="rounded-sm bg-danger-wash px-md py-sm text-[13px] text-danger"
            >
              {failure}
            </p>
          )}

          {fallback && (
            // Recorded, but the browser would not open a window. The chat as
            // a link — a real navigation the operator makes themselves.
            <a
              href={fallback.href}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="flex items-center justify-center gap-sm rounded-md bg-whatsapp px-lg py-sm text-[14px] font-semibold text-on-whatsapp hover:bg-whatsapp-deep"
            >
              <WhatsAppMark />
              {t("dispatch.openChat", { name: fallback.name })}
            </a>
          )}

          {confirming && (
            <div
              role="alertdialog"
              aria-label={t("dispatch.reassignTitle", { name: confirming.name })}
              className="flex flex-col gap-md rounded-lg border-2 border-warning bg-warning-wash/60 p-lg"
            >
              <div className="flex flex-col gap-xxs">
                <span className="text-[15px] font-semibold">
                  {t("dispatch.reassignTitle", { name: confirming.name })}
                </span>
                <span className="text-[13px] text-text-soft">
                  {t("dispatch.reassignBody", {
                    name: holder?.courierName || t("dispatch.someoneElse"),
                  })}
                </span>
              </div>
              <div className="flex items-center justify-end gap-sm">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirming(null)}
                >
                  {t("dispatch.reassignBack")}
                </Button>
                <Button
                  size="sm"
                  pending={dispatch.isPending}
                  onClick={() => send(confirming, true)}
                >
                  {t("dispatch.reassignConfirm", { name: confirming.name })}
                </Button>
              </div>
            </div>
          )}

          {finished && (
            <p className="rounded-sm bg-neutral-fill px-md py-sm text-[13px] text-text-soft">
              {t("dispatch.finished")}
            </p>
          )}

          {!finished && couriers.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="h-[64px] rounded-lg border border-border bg-neutral-fill/40"
                />
              ))}
            </div>
          )}

          {!finished && couriers.isSuccess && live.length === 0 && searching && (
            <EmptyState
              titleKey="drivers.searchNone"
              params={{ term: search.trim() }}
              mood="lost"
            />
          )}

          {!finished && couriers.isSuccess && live.length === 0 && !searching && (
            // Not a broken control and not an empty list — a sentence with the
            // next step in it. A button that opened an empty chat would be
            // worse than one that is absent.
            // Two different empties. Drivers on the books who are all off shift
            // is not "no driver yet" — said that way, it sends the operator to
            // add somebody who is already there.
            <EmptyState
              titleKey={
                (all.data?.length ?? 0) > 0
                  ? "dispatch.noDriversOnShift"
                  : "dispatch.noDrivers"
              }
              action={
                <Link
                  href="/drivers"
                  className="font-semibold text-primary hover:underline"
                >
                  {t(
                    (all.data?.length ?? 0) > 0
                      ? "dispatch.seeDrivers"
                      : "dispatch.addDriver",
                  )}
                </Link>
              }
            />
          )}

          {!finished && live.map((driver) => (
            <button
              key={driver.id}
              type="button"
              // One hand-over at a time: a second press while the first is in
              // flight would be the server's `TAKEN`, asked of the operator
              // about their own press.
              disabled={dispatch.isPending}
              aria-busy={
                dispatch.isPending &&
                dispatch.variables?.courierId === driver.id
                  ? true
                  : undefined
              }
              onClick={() => choose(driver)}
              className={cx(
                "flex items-center gap-lg rounded-lg border-2 border-transparent bg-surface p-lg text-start shadow-card",
                "transition-[border-color,background-color] hover:border-whatsapp hover:bg-whatsapp-wash/60",
                "disabled:cursor-wait disabled:opacity-60",
              )}
            >
              <Avatar id={driver.id} name={driver.name} />

              <div className="flex min-w-0 flex-grow flex-col gap-xxs">
                <span className="truncate text-[15px] font-semibold">
                  {driver.name}
                </span>
                {/* The number is on the row on purpose. It is the last chance
                    to notice that the order is about to go to the wrong
                    person, and it is not recoverable afterwards — the message
                    carries the customer's home address. */}
                <span className="truncate text-[12px] tabular-nums text-text-faint">
                  {formatPhone(driver.phone)}
                </span>
              </div>

              {/* WhatsApp's own green. It is the mark's colour, so it is used
                  only where a control hands off to that application — the same
                  rule the brand red follows. */}
              <span className="flex shrink-0 items-center gap-sm rounded-md bg-whatsapp px-lg py-sm text-[14px] font-semibold text-on-whatsapp">
                <WhatsAppMark />
                {holder?.courierId === driver.id
                  ? t("dispatch.sendAgain")
                  : t("dispatch.send")}
              </span>
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-lg border-t border-border p-xxl">
          <p className="min-w-0 text-[12px] text-text-faint">
            {t("dispatch.opensWhatsApp")}
          </p>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * WhatsApp's mark, drawn rather than fetched.
 *
 * One more request for sixteen pixels, and an external asset on a screen that
 * has to work on a bad connection in a shop.
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

/**
 * How to let "Notify all" open every chat: Chrome's pop-up permission, step
 * by step.
 *
 * Folded away by default — it is done once per computer and then never read
 * again, so open it would be a paragraph in front of the shops on every order.
 * `Collapse` rather than a native `<details>`, because `<details>` snaps open
 * and shut; this eases, like every other fold in the dashboard.
 *
 * The address in step 3 is read from the page itself rather than written in,
 * so dev.lebrunji.com, staging.lebrunji.com and dashboard.lebrunji.com each
 * show their own — the permission is per address, and the wrong one would be
 * a setting that silently does nothing.
 */
function PopupHelp() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // Only rendered inside the dialog, which only opens on a click, so there is
  // no server render for this to disagree with.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="rounded-sm bg-neutral-fill text-[13px]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
        className="flex w-full items-center gap-xs rounded-sm px-md py-sm text-left font-medium text-text-soft hover:text-text"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 8h.01" />
        </svg>
        {t("dispatch.popupHelpTitle")}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={cx(
            "ml-auto duration-[var(--duration-expand)] ease-[var(--ease-arrive)]",
            open && "rotate-180",
          )}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <Collapse open={open}>
        <div id={panelId}>
          <ol className="flex list-decimal flex-col gap-sm pb-sm pl-[34px] pr-md text-text-soft">
            <li>
              {t("dispatch.popupStep1")} <SettingsLink />
            </li>
            <li>{t("dispatch.popupStep2")}</li>
            <li>
              {t("dispatch.popupStep3")}
              <Copyable
                value={origin}
                label={t("dispatch.popupCopyAddress")}
                className="mt-xxs flex w-fit font-medium text-text"
              />
            </li>
            <li>{t("dispatch.popupStep4")}</li>
          </ol>
          <p className="px-md pb-sm text-[12px] text-text-faint">
            {t("dispatch.popupNote")}
          </p>
        </div>
      </Collapse>
    </div>
  );
}

/**
 * Chrome's pop-up settings, as a link that copies.
 *
 * It cannot be a real link: Chrome refuses to let any web page open a
 * `chrome://` address, so an `<a href>` here would look right and do nothing
 * when pressed. Copying is the nearest thing that works — one click, then
 * paste into a new tab — and it says so as it happens.
 */
function SettingsLink() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SETTINGS_URL);
      setCopied(true);
    } catch {
      // No clipboard (an insecure origin has none). The address is on screen
      // and can be selected by hand.
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-xs">
      <button
        type="button"
        onClick={() => void copy()}
        className="font-medium text-text underline underline-offset-2 hover:text-text-soft"
      >
        {SETTINGS_URL}
      </button>
      {copied && (
        <span role="status" className="text-[12px] text-accent-deep">
          {t("dispatch.popupCopied")}
        </span>
      )}
    </span>
  );
}

const SETTINGS_URL = "chrome://settings/content/popups";

/** A tick, for a chat that has been opened. */
function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
