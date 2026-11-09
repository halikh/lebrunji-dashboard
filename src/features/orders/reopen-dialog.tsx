"use client";

import { AlertTriangle, Info } from "lucide-react";
import { useState } from "react";

import { Button, Dialog } from "@/components/ui";
import { ChoiceList, type Choice } from "@/components/ui/choice-list";
import { t } from "@/i18n/translations";
import {
  statusTone,
  type OrderStatus,
  type OrderStatusSlug,
} from "@/lib/order-status";

import type { Order } from "./api/orders";
import { useReopenOrder } from "./use-orders";

/**
 * Changes the status of a finished order — the way back from a Delivered or
 * a Cancel pressed by mistake (`api_v1_reopen_order`, `0259`).
 *
 * Every other status is offered, not only the one before: "it was cancelled,
 * but it is in fact with a driver" is as likely as "not delivered yet". The
 * default is the step just before the one being undone, which is what a wrong
 * press usually skipped.
 */
export function ReopenDialog({
  order,
  from,
  statuses,
  onClose,
}: {
  order: Pick<Order, "id" | "code">;
  /** The order's status now: `delivered` or `cancelled`. */
  from: OrderStatus;
  statuses: OrderStatus[];
  onClose: () => void;
}) {
  const reopen = useReopenOrder();
  const others = statuses.filter((status) => status.slug !== from.slug);
  const [to, setTo] = useState<OrderStatusSlug>(
    from.slug === "cancelled" ? "confirmed" : "toCustomer",
  );
  const target = others.find((status) => status.slug === to);

  const choices: Choice<OrderStatusSlug>[] = others.map((status) => ({
    value: status.slug,
    label: (
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: statusTone(status.slug).dot }}
        />
        {status.name}
      </span>
    ),
    description: t(`reopen.means.${status.slug}`),
  }));

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !reopen.isPending && onClose()}
      title={t("reopen.title", { code: order.code })}
      description={t("reopen.blurb", { status: from.name })}
      footer={
        <>
          <Button
            variant="secondary"
            disabled={reopen.isPending}
            onClick={onClose}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant={to === "cancelled" ? "danger" : "primary"}
            disabled={!target}
            pending={reopen.isPending}
            onClick={() => {
              if (!target) return;
              reopen.mutate(
                {
                  orderId: order.id,
                  code: order.code,
                  fromSlug: from.slug,
                  toSlug: target.slug,
                  toName: target.name,
                },
                { onSuccess: onClose },
              );
            }}
          >
            {target
              ? t("orders.moveTo", { status: target.name })
              : t("reopen.pick")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ChoiceList
          label={t("reopen.question")}
          choices={choices}
          value={to}
          onChange={(value) => {
            reopen.reset();
            setTo(value);
          }}
          disabled={reopen.isPending}
        />

        <ul className="flex flex-col gap-1.5 rounded-md border border-line bg-subtle px-3 py-2.5 text-[13px] text-ink-2">
          <li className="flex items-start gap-1.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
            {t("reopen.customerSees")}
          </li>
          {from.slug === "cancelled" && (
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
              {t("reopen.samePrice")}
            </li>
          )}
          {from.slug === "cancelled" && to !== "delivered" && (
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
              {t("reopen.tellShop")}
            </li>
          )}
        </ul>

        {reopen.isError && (
          <p
            role="alert"
            className="flex items-start gap-1.5 text-[13px] text-danger-ink"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {reopen.error.message}
          </p>
        )}
      </div>
    </Dialog>
  );
}
