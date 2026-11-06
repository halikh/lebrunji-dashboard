import { Suspense } from "react";

import { PolicySectionEditor } from "@/features/settings/policy-section-editor";

export const metadata = { title: "Policy section" };

export default async function PolicySectionPage({
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
