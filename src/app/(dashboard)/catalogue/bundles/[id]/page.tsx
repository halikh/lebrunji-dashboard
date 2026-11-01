import { Suspense } from "react";

import { BundleEditor } from "@/features/catalog/bundle-editor";

/** One bundle. `?store=<id>`: opened from that shop's Bundles tab, so Back returns there. */
export default async function BundlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ store?: string | string[] }>;
}) {
  const { id } = await params;
  const { store } = await searchParams;

  return (
    <Suspense>
      <BundleEditor
        id={id}
        fromStoreId={typeof store === "string" ? store : null}
      />
    </Suspense>
  );
}
