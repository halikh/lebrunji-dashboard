"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Button, cx } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import {
  useCouriers,
  useRecordDispatch,
} from "@/features/drivers/use-couriers";
import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { formatPhone } from "@/lib/phone";
import { isOpenNow } from "@/lib/week";

import type { Order, OrderLine } from "./api/orders";
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
 * ## Each row is a link, not a button
 *
 * Pressing one opens WhatsApp. That is a navigation, so it is an `<a>`: it
 * opens in a new tab, it can be middle-clicked, and the browser handles the
 * handoff to the desktop application. A click handler calling `window.open`
 * would be a popup for a blocker to eat.
 *
 * The hand-over is recorded on the way past — see `recordDispatch` on why a
 * failure there is swallowed rather than blocking the send.
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
  const { currencies } = useMoney();
  const record = useRecordDispatch();

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

  // On shift *now*, read from their hours rather than from a switch somebody
  // had to remember to flip. A driver outside their hours is not offered: the
  // whole point of the change in migration 0084 is that this list is right at
  // two in the morning without anybody having maintained it.
  const liveCount = (all.data ?? []).filter((one) =>
    isOpenNow(one.hours),
  ).length;
  const filtering = liveCount > BROWSABLE;
  const live = (couriers.data ?? []).filter((one) => isOpenNow(one.hours));
  const searching = search.trim().length >= SEARCH.minTerm;

  const message = dispatchMessage(
    { ...order, lines },
    currencies?.find((one) => one.code === order.currencyCode),
  );

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

        <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
          {/* The kitchen first, because it is the earlier step: a shop that has
              not been told what to cook has nothing for a driver to collect.

              Each shop gets **only its own items**, and no address, phone or
              money — see `kitchenMessage`. A shop cooking one half of a
              two-shop order has no reason to hold a customer's home address,
              and once it is in a WhatsApp thread it is on somebody's phone for
              good. */}
          <section className="flex flex-col gap-sm">
            <h3 className="text-[13px] font-semibold text-text-soft">
              {t("dispatch.kitchenTab")}
            </h3>

            {order.stores.map((portion) =>
              portion.storeWhatsapp ? (
                <a
                  key={portion.id}
                  href={whatsappLink(
                    portion.storeWhatsapp,
                    kitchenMessage({ ...order, lines }, portion.id),
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className={cx(
                    "flex items-center gap-lg rounded-lg border border-border bg-surface p-lg",
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

                  <span className="flex shrink-0 items-center gap-sm rounded-md bg-whatsapp px-lg py-sm text-[14px] font-semibold text-on-whatsapp">
                    <WhatsAppMark />
                    {t("dispatch.kitchenSend")}
                  </span>
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

          <h3 className="text-[13px] font-semibold text-text-soft">
            {t("dispatch.driverTab")}
          </h3>

          {couriers.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="h-[64px] rounded-lg border border-border bg-neutral-fill/40"
                />
              ))}
            </div>
          )}

          {couriers.isSuccess && live.length === 0 && searching && (
            <p className="text-[13px] text-text-faint">
              {t("drivers.searchNone", { term: search.trim() })}
            </p>
          )}

          {couriers.isSuccess && live.length === 0 && !searching && (
            // Not a broken control and not an empty list — a sentence with the
            // next step in it. A button that opened an empty chat would be
            // worse than one that is absent.
            <p className="text-[13px] text-text-faint">
              {t("dispatch.noDrivers")}{" "}
              <Link
                href="/drivers"
                className="font-semibold text-primary hover:underline"
              >
                {t("dispatch.addDriver")}
              </Link>
            </p>
          )}

          {live.map((driver) => (
            <a
              key={driver.id}
              href={whatsappLink(driver.phone, message)}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                record.mutate({ orderId: order.id, courierId: driver.id });
                // Closed on the way out. Leaving the dialog open behind a chat
                // that has just opened in another window means coming back to a
                // question already answered.
                onClose();
              }}
              className={cx(
                "flex items-center gap-lg rounded-lg border border-border bg-surface p-lg",
                "transition-[border-color,background-color] hover:border-whatsapp hover:bg-whatsapp-wash/60",
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
                {t("dispatch.send")}
              </span>
            </a>
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
