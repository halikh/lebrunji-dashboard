import { Suspense } from "react";

import { PolicySectionEditor } from "@/features/settings/policy-section-editor";

export const metadata = { title: "New policy section" };

export default function NewPolicySectionPage() {
  return (
    <Suspense>
      <PolicySectionEditor id={null} />
    </Suspense>
  );
}
