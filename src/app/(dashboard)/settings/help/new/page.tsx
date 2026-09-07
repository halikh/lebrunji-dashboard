import { Suspense } from "react";

import { HelpTopicEditor } from "@/features/settings/help-topic-editor";

/** Adding one. `Suspense` as on every other editor route. */
export default function NewHelpTopicEditorPage() {
  return (
    <Suspense>
      <HelpTopicEditor id={null} />
    </Suspense>
  );
}
