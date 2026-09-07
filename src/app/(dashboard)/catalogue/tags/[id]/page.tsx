import { Suspense } from "react";

import { TagEditor } from "@/features/catalog/tag-editor";

/** One tag. */
export default async function TagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense>
      <TagEditor id={id} />
    </Suspense>
  );
}
