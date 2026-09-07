import { Suspense } from "react";

import { DriverEditor } from "@/features/drivers/driver-editor";

/** One driver's details and rota. */
export default async function EditDriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense>
      <DriverEditor id={id} />
    </Suspense>
  );
}
