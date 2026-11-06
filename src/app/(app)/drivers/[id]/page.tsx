import { Suspense } from "react";

import { DriverProfile } from "@/features/drivers/driver-profile";

export const metadata = { title: "Driver" };

/** `params` is a promise in Next 16; the client screen takes a plain id. */
export default async function DriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <DriverProfile id={id} />
    </Suspense>
  );
}
