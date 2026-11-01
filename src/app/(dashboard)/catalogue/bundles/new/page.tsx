import { Suspense } from "react";

import { BundleEditor } from "@/features/catalog/bundle-editor";

/** Adding a bundle. `Suspense` as on every other editor route. */
export default function NewBundlePage() {
  return (
    <Suspense>
      <BundleEditor id={null} />
    </Suspense>
  );
}
