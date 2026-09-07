import { Suspense } from "react";

import { CategoryEditor } from "@/features/catalog/category-editor";

/** One category. See `CategoryEditor`, and the note on the `new` route. */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense>
      <CategoryEditor id={id} />
    </Suspense>
  );
}
