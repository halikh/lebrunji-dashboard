import { Badge } from "@/components/ui";
import { t } from "@/i18n/translations";

/**
 * The name, or what to say instead of one.
 *
 * `users.name = ''` is this schema's record of "signed in, never finished
 * setup" (`0045`/`0046`). A blank makes the row look broken; naming it makes
 * it a status, which is what it is.
 */
export function nameOf(customer: {
  name: string;
  deletedAt?: string | null;
}): string {
  // Closing an account erases its name and phone on purpose (`0149`, `0201`,
  // `0260`), so a blank there is not an unfinished signup.
  if (customer.deletedAt) {
    return customer.name.trim() || t("customers.closedAccount");
  }
  return customer.name.trim() || t("customers.incomplete");
}

/**
 * Active, suspended or closed — a state, not a switch. Suspended is amber
 * because it is reversible and somebody chose it; closed is grey because it
 * is over.
 */
export function CustomerStatus({
  customer,
}: {
  customer: { isActive: boolean; deletedAt: string | null };
}) {
  if (customer.deletedAt !== null) {
    return <Badge tone="neutral">{t("customers.closedLabel")}</Badge>;
  }
  return customer.isActive ? (
    <Badge tone="success" dot>
      {t("customers.activeLabel")}
    </Badge>
  ) : (
    <Badge tone="warning" dot>
      {t("customers.suspendedLabel")}
    </Badge>
  );
}
