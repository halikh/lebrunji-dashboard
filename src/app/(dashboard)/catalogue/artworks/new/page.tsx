import { Suspense } from "react";

import { ArtworkEditor } from "@/features/catalog/artwork-editor";

/**
 * Adding a picture. `?discount=<id>` preselects the promotion it advertises,
 * `?bundle=<id>` the bundle (`0204`) — the promotion and bundle editors link
 * here that way.
 */
export default async function NewArtworkPage({
  searchParams,
}: {
  searchParams: Promise<{
    discount?: string | string[];
    bundle?: string | string[];
  }>;
}) {
  const { discount, bundle } = await searchParams;

  return (
    <Suspense>
      <ArtworkEditor
        id={null}
        initialDiscountId={typeof discount === "string" ? discount : null}
        initialBundleId={typeof bundle === "string" ? bundle : null}
      />
    </Suspense>
  );
}
