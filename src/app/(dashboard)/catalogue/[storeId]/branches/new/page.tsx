import { Suspense } from "react";

import { BranchEditorScreen } from "@/features/catalog/branch-editor";

/** Adding a branch to a shop. */
export default async function NewBranchPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;

  return (
    <Suspense>
      <BranchEditorScreen storeId={storeId} branchId={null} />
    </Suspense>
  );
}
