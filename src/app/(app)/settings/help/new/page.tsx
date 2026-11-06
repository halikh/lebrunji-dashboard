import { Suspense } from "react";

import { HelpTopicEditor } from "@/features/settings/help-topic-editor";

export const metadata = { title: "New help topic" };

export default function NewHelpTopicPage() {
  return (
    <Suspense>
      <HelpTopicEditor id={null} />
    </Suspense>
  );
}
