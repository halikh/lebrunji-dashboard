import { Suspense } from "react";

import { BundleEditor } from "@/features/catalog/bundle-editor";

/**
 * Adding a bundle. `?store=<id>` starts it on that shop — the shop screen's
 * Bundles tab links here that way — and Back returns to that tab.
 */
export default async function NewBundlePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string | string[] }>;
}) {
  const { store } = await searchParams;

  return (
    <Suspense>
      <BundleEditor
        id={null}
        fromStoreId={typeof store === "string" ? store : null}
      />
    </Suspense>
  );
}
