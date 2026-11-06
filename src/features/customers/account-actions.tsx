"use client";

import { Ban, LockOpen, MoreHorizontal, UserX } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, ConfirmDialog, Menu, type MenuItem } from "@/components/ui";
import { t } from "@/i18n/translations";
import { formatPhone } from "@/lib/phone";

import { nameOf } from "./customer-status";
import { useCloseCustomerAccount, useSetCustomerActive } from "./use-customers";

type Target = {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  deletedAt: string | null;
};

type Asking = "toggle" | "close" | null;

/**
 * Suspend, reinstate, close — written once because it appears twice, on the
 * list row (`AccountActions`, a ⋯ menu) and in the profile header's ⋯
 * (`useAccountActions`). Two copies would be
 * two sets of confirmation copy, and the one that drifted would be the one
 * nobody re-read.
 *
 * **Suspending** is a door held shut (`0078` makes it bite through RLS on the
 * customer's next request) and it is reversible. **Closing** releases the phone
 * number: signing up again with it makes a *new* account, and this one can
 * never be reopened. So closing is the red action and suspending is not —
 * spending red on both would make red mean nothing by the time it reached the
 * one that cannot be undone.
 *
 * Both confirm, unlike most row actions here, because the person who finds out
 * is a customer standing in an app that has stopped working. A closed account
 * offers neither: there is nothing left to do to it.
 */
export function AccountActions({ customer }: { customer: Target }) {
  const { items, dialogs } = useAccountActions(customer);
  if (items.length === 0) return null;

  return (
    <>
      <Menu
        items={items}
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("customers.actionsFor", { name: nameOf(customer) })}
          >
            <MoreHorizontal />
          </Button>
        }
      />
      {dialogs}
    </>
  );
}

/**
 * The same actions as menu items plus their dialogs, for a screen that puts
 * them in its own menu — the profile hangs them on its header's ⋯, the way
 * Shopify's customer page keeps account actions under "More actions". Empty
 * for a closed account: there is nothing left to do to it.
 */
export function useAccountActions(customer: Target): {
  items: MenuItem[];
  dialogs: ReactNode;
} {
  const setActive = useSetCustomerActive();
  const close = useCloseCustomerAccount();
  const [asking, setAsking] = useState<Asking>(null);

  if (customer.deletedAt !== null) return { items: [], dialogs: null };

  // The same fallback the row and the profile use, so a customer whose signup
  // stalled is called one thing in the confirmation and the toast.
  const name = nameOf(customer);
  const suspending = customer.isActive;

  const dialogs = (
    <>
      <ConfirmDialog
        open={asking === "toggle"}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t(
          suspending ? "customers.suspendTitle" : "customers.reinstateTitle",
          { name },
        )}
        description={t(
          suspending ? "customers.suspendBody" : "customers.reinstateBody",
        )}
        confirmLabel={t(
          suspending
            ? "customers.suspendConfirm"
            : "customers.reinstateConfirm",
        )}
        tone={suspending ? "danger" : "primary"}
        onConfirm={() =>
          // The hook toasts the failure; swallowing it here only stops it
          // surfacing a second time as an unhandled rejection.
          setActive
            .mutateAsync({ id: customer.id, isActive: !suspending, name })
            .catch(() => undefined)
        }
      />
      <ConfirmDialog
        open={asking === "close"}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t("customers.closeTitle", { name })}
        // The number is in the sentence because releasing it is the part that
        // cannot be undone.
        description={t("customers.closeBody", {
          phone: formatPhone(customer.phone),
        })}
        confirmLabel={t("customers.closeConfirm")}
        tone="danger"
        onConfirm={() =>
          close.mutateAsync({ id: customer.id, name }).catch(() => undefined)
        }
      />
    </>
  );

  const items: MenuItem[] = [
    {
      label: suspending ? t("customers.suspend") : t("customers.reinstate"),
      icon: suspending ? <Ban /> : <LockOpen />,
      onSelect: () => setAsking("toggle"),
    },
    "separator",
    {
      label: t("customers.close"),
      icon: <UserX />,
      tone: "danger",
      onSelect: () => setAsking("close"),
    },
  ];

  return { items, dialogs };
}
