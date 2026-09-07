import { Suspense } from "react";

import { PolicySectionEditor } from "@/features/settings/policy-section-editor";

/** One row. */
export default async function PolicySectionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense>
      <PolicySectionEditor id={id} />
    </Suspense>
  );
}
