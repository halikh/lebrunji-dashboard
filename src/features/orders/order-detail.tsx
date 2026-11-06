"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  UserRound,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  Copyable,
  MapView,
  Thumb,
  cx,
} from "@/components/ui";
import { Price } from "@/features/reference/price";
import { t } from "@/i18n/translations";
import { isFinishedSlug, statusTone } from "@/lib/order-status";
import { formatPhone } from "@/lib/phone";
import { unitLabel } from "@/lib/unit-label";
import { itemUnit, linePrice } from "@/lib/units";

import { fetchHandovers } from "./api/history";
import {
  roundingOf,
  type Order,
  type OrderLine,
  type OrderStatus,
  type OrderStore,
} from "./api/orders";
import { AmendDialog } from "./amend-dialog";
import { cancellationMessage, whatsappLink } from "./dispatch";
import { DispatchDialog } from "./dispatch-dialog";
import { PlaceName } from "./place";
import {
  nextStatus,
  orderKeys,
  orderStatus,
  useAdvanceOrder,
} from "./use-orders";

export type OrderWithLines = Order & { lines: OrderLine[] };
export type ReadFrom = "panel" | "page";

function Block({
  icon,
  label,
  children,
  aside,
}: {
  icon: ReactNode;
  label: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-hover text-ink-3 [&_svg]:size-4">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[12px] font-medium text-ink-3">{label}</p>
          {children}
        </div>
        {aside}
      </div>
    </section>
  );
}

/** Customer, where it is going, what is in it, and what it costs. */
export function OrderBody({
  order,
  from,
  flush,
}: {
  order: OrderWithLines;
  from: ReadFrom;
  /** No padding of its own — on the full page, which has gutters already. */
  flush?: boolean;
}) {
  const itemCount = order.lines.length;
  const rounding = roundingOf(order);
  const phone = order.customerPhone ? formatPhone(order.customerPhone) : null;

  return (
    <div className={cx("flex flex-col gap-3", !flush && "p-4 sm:p-5")}>
      <Block
        icon={<UserRound />}
        label={t("orders.customer")}
        aside={
          phone ? (
            <Copyable
              value={phone}
              href={`tel:${phone}`}
              label={t("orders.copyPhone")}
              className="shrink-0 text-[13.5px] font-medium text-ink tabular-nums"
            />
          ) : (
            <span className="shrink-0 text-[12.5px] text-ink-4">
              {t("orders.noPhone")}
            </span>
          )
        }
      >
        <Link
          href={
            from === "page"
              ? `/customers/${order.customerId}?fromOrder=${order.id}&code=${encodeURIComponent(order.code)}`
              : `/customers/${order.customerId}?fromQueue=${order.id}`
          }
          className="w-fit max-w-full truncate text-[14.5px] font-semibold text-ink hover:text-accent hover:underline"
        >
          {order.customerName || t("orders.incompleteSignup")}
        </Link>
      </Block>

      <Block icon={<MapPin />} label={t("orders.deliveringTo")}>
        <p className="text-[14px] font-medium text-ink">{order.addressLine}</p>
        {order.courierNote && (
          <p className="mt-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-[13px] text-warning-ink">
            <span className="font-semibold">{t("orders.courierNote")}</span>
            {order.courierNote}
          </p>
        )}
        <MapView
          className="mt-3"
          latitude={order.latitude}
          longitude={order.longitude}
          label={t("orders.locationLabel", { name: order.addressLine })}
        />
      </Block>

      <div className="flex items-baseline justify-between px-1 pt-2">
        <h3 className="text-[14px] font-semibold text-ink">
          {t("orders.items")}
        </h3>
        <span className="text-[12.5px] text-ink-3">
          {[
            itemCount === 1
              ? t("orders.itemCountOne")
              : t("orders.itemCount", { count: itemCount }),
            order.stores.length > 1 &&
              t("orders.fromShops", { count: order.stores.length }),
          ]
            .filter(Boolean)
            .join(", ")}
        </span>
      </div>

      {order.stores.map((store) => (
        <StoreLines
          key={store.id}
          store={store}
          lines={order.lines.filter((line) => line.orderStoreId === store.id)}
          currencyCode={order.currencyCode}
          shopRate={order.shopRate}
        />
      ))}

      <section className="rounded-lg border border-line bg-surface p-4">
        <h3 className="mb-2 text-[14px] font-semibold text-ink">
          {t("orders.payment")}
        </h3>
        <dl className="flex flex-col gap-1.5 text-[13.5px]">
          <MoneyLine
            label={t("orders.subtotal")}
            value={order.subtotal}
            order={order}
          />
          <MoneyLine
            label={t("orders.delivery")}
            value={order.deliveryFee}
            order={order}
          />
          {order.discount > 0 && (
            <MoneyLine
              label={t("orders.discount")}
              value={-order.discount}
              order={order}
              good
            />
          )}
          {rounding !== 0 && (
            <MoneyLine
              label={t("orders.rounding")}
              value={rounding}
              order={order}
            />
          )}
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-[15px] font-semibold text-ink">
            {t("orders.total")}
          </span>
          <Price
            value={order.total}
            code={order.currencyCode}
            shopRate={order.shopRate}
            align="end"
            className="text-[18px] font-semibold text-ink"
          />
        </div>
      </section>
    </div>
  );
}

function MoneyLine({
  label,
  value,
  order,
  good,
}: {
  label: string;
  value: number;
  order: Order;
  good?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cx("font-medium", good ? "text-success-ink" : "text-ink")}>
        <Price
          value={value}
          code={order.currencyCode}
          shopRate={order.shopRate}
          align="end"
        />
      </dd>
    </div>
  );
}

function StoreLines({
  store,
  lines,
  currencyCode,
  shopRate,
}: {
  store: OrderStore;
  lines: OrderLine[];
  currencyCode: string;
  shopRate: number | null;
}) {
  const tone = statusTone(store.statusSlug);
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line bg-subtle px-4 py-2.5">
        <Thumb src={store.storeImageUrl} size={28} alt="" />
        <h4 className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">
          <PlaceName store={store} />
        </h4>
        <span
          className="flex items-center gap-1.5 text-[12px] font-medium"
          style={{ color: tone.ink }}
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ background: tone.dot }}
          />
          {store.statusName}
        </span>
      </div>
      <ul className="divide-y divide-line">
        {lines.map((line) => {
          const coming = line.fulfilledQuantity ?? line.quantity;
          const gone = coming === 0;
          const changed = line.fulfilledQuantity !== null;
          return (
            <li key={line.id} className="flex items-start gap-3 px-4 py-3">
              <Thumb
                src={line.imageUrl}
                size={44}
                className={gone ? "opacity-50" : undefined}
              />
              <span className="mt-0.5 min-w-8 rounded-md bg-hover px-1.5 py-0.5 text-center text-[12.5px] font-semibold text-ink-2 tabular-nums">
                {itemUnit(line)?.step == null
                  ? t("orders.quantity", { count: coming })
                  : unitLabel(line, coming)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={cx(
                    "text-[14px] font-medium text-ink",
                    gone && "text-ink-4 line-through",
                  )}
                >
                  {line.name}
                </span>
                {(line.options.length > 0 || line.note) && (
                  <span className="text-[12.5px] text-ink-3">
                    {[...line.options, line.note].filter(Boolean).join(", ")}
                  </span>
                )}
                {changed && (
                  <Badge tone="danger" className="w-fit">
                    {gone
                      ? t("amend.outOfStock")
                      : t("amend.short", { count: unitLabel(line, coming) })}
                  </Badge>
                )}
                {line.amendmentReason === "substitute" && (
                  <Badge className="w-fit">
                    {t("amend.substituteFor", {
                      name:
                        lines.find((one) => one.id === line.replacesLineId)
                          ?.name ?? "",
                    })}
                  </Badge>
                )}
              </div>
              <Price
                value={linePrice(
                  line.unitPrice,
                  line.optionsPrice,
                  itemUnit(line),
                  coming,
                )}
                code={currencyCode}
                shopRate={shopRate}
                align="end"
                className={cx(
                  "text-[13.5px] font-medium text-ink",
                  gone && "opacity-50",
                )}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The bar at the foot of the receipt: one big button for the next step, and
 * the less frequent actions — tell a driver, change the order, cancel — above it.
 */
export function OrderActions({
  order,
  statuses,
  onMoved,
}: {
  order: OrderWithLines;
  statuses: OrderStatus[];
  onMoved?: (toSlug: string) => void;
}) {
  const { advance } = useAdvanceOrder();
  const [amending, setAmending] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const cancelled = statuses.find((status) => status.progress === null);
  const status = orderStatus(order, statuses);
  const next = status ? nextStatus(statuses, status.slug) : null;
  const finished = status ? isFinishedSlug(status.slug) : false;
  const wasCancelled = status?.slug === "cancelled";

  // A cancelled order may still be in a driver's WhatsApp; offer the message
  // that stands them down.
  const handovers = useQuery({
    queryKey: orderKeys.handovers(order.id),
    queryFn: () => fetchHandovers(order.id),
    enabled: wasCancelled,
  });
  const holder = wasCancelled ? (handovers.data?.[0] ?? null) : null;

  // Amending needs room for at least one more step after it.
  const here = status?.progress ?? null;
  const movesLeft =
    here === null
      ? 0
      : statuses.filter((one) => one.progress !== null && one.progress > here)
          .length;
  const amendable = movesLeft > 1;

  const secondary =
    !finished || holder?.courierPhone || amendable || (next && cancelled);
  if (!next && !secondary) return null;

  return (
    <div className="flex shrink-0 flex-col gap-2.5 border-t border-line bg-surface p-4">
      {secondary && (
        <div className="flex flex-wrap gap-2">
          {!finished && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setDispatching(true)}
            >
              <MessageCircle className="text-[#25d366]" />
              {t("dispatch.open")}
            </Button>
          )}
          {holder?.courierPhone && (
            <Button asChild size="sm" className="flex-1">
              <a
                href={whatsappLink(
                  holder.courierPhone,
                  cancellationMessage(order),
                )}
                target="_blank"
                rel="noreferrer"
              >
                <Phone className="text-[#25d366]" />
                <span className="truncate">
                  {t("dispatch.tellDriver", { name: holder.courierName })}
                </span>
              </a>
            </Button>
          )}
          {amendable && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => setAmending(true)}
            >
              <Pencil />
              {t("amend.open")}
            </Button>
          )}
          {next && cancelled && (
            <Button
              size="sm"
              variant="danger-soft"
              className="flex-1"
              onClick={() => setCancelling(true)}
            >
              <XCircle />
              {t("orders.cancel")}
            </Button>
          )}
        </div>
      )}

      {next && (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => {
            advance({
              orderId: order.id,
              code: order.code,
              fromSlug: status?.slug ?? "",
              toSlug: next.slug,
              toName: next.name,
            });
            onMoved?.(next.slug);
          }}
        >
          <span
            aria-hidden
            className="size-2 rounded-full ring-2 ring-white/60"
            style={{ background: statusTone(next.slug).dot }}
          />
          {t("orders.moveTo", { status: next.name })}
        </Button>
      )}

      {cancelled && (
        <ConfirmDialog
          open={cancelling}
          onOpenChange={setCancelling}
          title={t("orders.cancelTitle")}
          description={t("orders.cancelBody")}
          confirmLabel={t("orders.cancelConfirm")}
          cancelLabel={t("orders.keepOrder")}
          tone="danger"
          onConfirm={() => {
            advance({
              orderId: order.id,
              code: order.code,
              fromSlug: status?.slug ?? "",
              toSlug: cancelled.slug,
              toName: cancelled.name,
              undoable: false,
            });
            onMoved?.(cancelled.slug);
          }}
        />
      )}

      {dispatching && !finished && (
        <DispatchDialog
          order={order}
          lines={order.lines}
          onClose={() => setDispatching(false)}
        />
      )}
      {amending && (
        <AmendDialog
          order={order}
          lines={order.lines}
          onClose={() => setAmending(false)}
        />
      )}
    </div>
  );
}
