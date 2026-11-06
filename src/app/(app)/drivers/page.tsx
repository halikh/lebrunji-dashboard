import { Suspense } from "react";

import { DriversScreen } from "@/features/drivers/drivers-screen";

export const metadata = { title: "Drivers" };

/** The screen reads `?scope=` and `?focus=`, so it needs a Suspense boundary. */
export default function DriversPage() {
  return (
    <Suspense>
      <DriversScreen />
    </Suspense>
  );
}
