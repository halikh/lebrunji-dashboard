import { Suspense } from "react";

import { CustomerProfile } from "@/features/customers/customer-profile";

export const metadata = { title: "Customer" };

/**
 * One customer's own page — a route rather than a panel, so an operator on
 * the phone can send a colleague exactly the person they are looking at.
 */
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <CustomerProfile id={id} />
    </Suspense>
  );
}
