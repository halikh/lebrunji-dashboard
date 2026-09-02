"use client";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { t } from "@/i18n/translations";
import { formatPhone } from "@/lib/phone";

import { nameOf } from "./customers-screen";
import { useCloseCustomerAccount, useSetCustomerActive } from "./use-customers";

/**
 * Suspend, reinstate, close.
 *
 * Written once because it appears twice — on the list row and on the profile —
 * and these are the two most consequential controls in the customers feature.
 * Two copies would be two sets of confirmation copy, and the one that drifted
 * would be the one nobody re-read.
 *
 * ## They are not the same weight, and the buttons say so
 *
 * **Suspending** is a door held shut. `0078` made it bite through RLS, so it
 * takes effect on the customer's next request rather than their next launch,
 * and it is reversible: the same account comes back.
 *
 * **Closing** releases the phone number. Somebody signing up again with that
 * number gets a *new* account, and this one can never be reopened. So it is the
 * filled danger button and suspension is not — spending red on both would make
 * red mean nothing by the time it reached the one that cannot be undone.
 *
 * A closed account offers neither: there is nothing left to suspend, and
 * nothing left to close.
 *
 * ## Both confirm, and this is not the house habit
 *
 * Most row actions in this dashboard get undo rather than a dialog. These get a
 * dialog because they are terminal or near-terminal, invisible from the
 * operator's side once done — nothing on this screen looks different to them
 * afterwards — and because the person who finds out is a customer standing in
 * an app that has stopped working.
 */
export function AccountActions({
  customer,
  size = "sm",
}: {
  customer: {
    id: string;
    name: string;
    phone: string;
    isActive: boolean;
    deletedAt: string | null;
  };
  size?: "sm" | "md";
}) {
  const setActive = useSetCustomerActive();
  const close = useCloseCustomerAccount();

  // A closed account has nothing left to do to it.
  if (customer.deletedAt !== null) return null;

  // The same fallback the row and the profile use, so a customer whose signup
  // stalled is called one thing in the confirmation and the toast rather than
  // two.
  const name = nameOf(customer);

  return (
    <span className="flex shrink-0 items-center gap-sm">
      <ConfirmButton
        onConfirm={async () => {
          await setActive.mutateAsync({
            id: customer.id,
            isActive: !customer.isActive,
            name,
          });
        }}
        titleKey={
          customer.isActive
            ? "customers.suspendTitle"
            : "customers.reinstateTitle"
        }
        bodyKey={
          customer.isActive
            ? "customers.suspendBody"
            : "customers.reinstateBody"
        }
        confirmKey={
          customer.isActive
            ? "customers.suspendConfirm"
            : "customers.reinstateConfirm"
        }
        params={{ name }}
        variant={customer.isActive ? "danger" : "primary"}
        triggerVariant="secondary"
        size={size}
      >
        {customer.isActive ? t("customers.suspend") : t("customers.reinstate")}
      </ConfirmButton>

      <ConfirmButton
        onConfirm={async () => {
          await close.mutateAsync({ id: customer.id, name });
        }}
        titleKey="customers.closeTitle"
        bodyKey="customers.closeBody"
        // The number is in the confirmation because releasing it is the part
        // that cannot be undone, and it is the part the sentence is about.
        confirmKey="customers.closeConfirm"
        params={{ name, phone: formatPhone(customer.phone) }}
        variant="danger"
        triggerVariant="danger"
        size={size}
      >
        {t("customers.close")}
      </ConfirmButton>
    </span>
  );
}
