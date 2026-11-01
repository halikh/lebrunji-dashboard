import { Suspense } from "react";

import { BundleEditor } from "@/features/catalog/bundle-editor";

/** One bundle. */
export default async function BundlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense>
      <BundleEditor id={id} />
    </Suspense>
  );
}
