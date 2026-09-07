import { Suspense } from "react";

import { DriverEditor } from "@/features/drivers/driver-editor";

/**
 * Adding a driver.
 *
 * A literal segment, so it wins over `[id]` — Next matches static folders
 * before dynamic ones, which is why this is the add form rather than a driver
 * whose id is the word "new".
 */
export default function NewDriverPage() {
  return (
    <Suspense>
      <DriverEditor id={null} />
    </Suspense>
  );
}
