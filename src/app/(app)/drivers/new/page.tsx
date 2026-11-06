import { Suspense } from "react";

import { DriverEditor } from "@/features/drivers/driver-editor";

export const metadata = { title: "New driver" };

export default function NewDriverPage() {
  return (
    <Suspense>
      <DriverEditor id={null} />
    </Suspense>
  );
}
