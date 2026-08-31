import { Suspense } from "react";

import { SettingsScreen } from "@/features/settings/settings-screen";

/**
 * The app's written content.
 *
 * The screen reads `?tab=` to decide which section is open, and Next requires a
 * boundary around `useSearchParams` during static rendering.
 */
export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}
