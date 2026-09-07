import { Suspense } from "react";

import { TagEditor } from "@/features/catalog/tag-editor";

/** Adding a tag. `Suspense` for the same reason the category routes need it. */
export default function NewTagPage() {
  return (
    <Suspense>
      <TagEditor id={null} />
    </Suspense>
  );
}
