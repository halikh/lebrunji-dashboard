import { Suspense } from "react";

import { ArtworkEditor } from "@/features/catalog/artwork-editor";

/** One picture. */
export default async function ArtworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense>
      <ArtworkEditor id={id} />
    </Suspense>
  );
}
