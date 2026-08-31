import { CustomerProfile } from "@/features/customers/customer-profile";

/**
 * One customer's own page.
 *
 * A route rather than a panel: a customer is a record with a history, a set of
 * addresses that only mean anything on a map, and every order they have placed.
 * None of that fits a column beside a list — and as a URL it can be sent to
 * somebody, which is what an operator on the phone actually needs.
 */
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerProfile id={id} />;
}
