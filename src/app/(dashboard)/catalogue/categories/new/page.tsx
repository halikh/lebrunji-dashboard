import { Suspense } from "react";

import { CategoryEditor } from "@/features/catalog/category-editor";

/**
 * Adding a category.
 *
 * A route rather than a panel, so the form can be linked, refreshed and backed
 * out of — see `CategoryEditor` for why that trade was made and what was kept.
 *
 * `Suspense`, because the editor reads `?focus=` out of `useSearchParams` to
 * build its way back, and Next refuses to render that on the server without a
 * boundary: the query string is not known until the request arrives.
 */
export default function NewCategoryPage() {
  return (
    <Suspense>
      <CategoryEditor id={null} />
    </Suspense>
  );
}
