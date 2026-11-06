import { Suspense } from "react";

import { HelpTopicEditor } from "@/features/settings/help-topic-editor";

export const metadata = { title: "Help topic" };

export default async function HelpTopicPage({
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
