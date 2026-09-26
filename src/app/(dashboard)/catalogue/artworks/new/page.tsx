import { Suspense } from "react";

import { ArtworkEditor } from "@/features/catalog/artwork-editor";

/**
 * Adding a picture. `?discount=<id>` preselects the promotion it advertises —
 * the promotion editor links here that way.
 */
export default async function NewArtworkPage({
  searchParams,
}: {
  searchParams: Promise<{ discount?: string | string[] }>;
}) {
  const { discount } = await searchParams;

  return (
    <Suspense>
      <ArtworkEditor
        id={null}
        initialDiscountId={typeof discount === "string" ? discount : null}
      />
    </Suspense>
  );
}
