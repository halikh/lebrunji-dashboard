import { Suspense } from "react";

import { PolicySectionEditor } from "@/features/settings/policy-section-editor";

/** Adding one. `Suspense` as on every other editor route. */
export default function NewPolicySectionEditorPage() {
  return (
    <Suspense>
      <PolicySectionEditor id={null} />
    </Suspense>
  );
}
