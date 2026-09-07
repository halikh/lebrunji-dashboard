import { Suspense } from "react";

import { BranchEditorScreen } from "@/features/catalog/branch-editor";

/** One branch, and the shop fields that sit above it. */
export default async function BranchPage({
  params,
}: {
  params: Promise<{ storeId: string; branchId: string }>;
}) {
  const { storeId, branchId } = await params;

  return (
    <Suspense>
      <BranchEditorScreen storeId={storeId} branchId={branchId} />
    </Suspense>
  );
}
