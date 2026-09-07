import { Suspense } from "react";

import { HelpTopicEditor } from "@/features/settings/help-topic-editor";

/** One row. */
export default async function HelpTopicEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense>
      <HelpTopicEditor id={id} />
    </Suspense>
  );
}
