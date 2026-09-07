import { Suspense } from "react";

import { BranchMenuScreen } from "@/features/catalog/branch-menu-panel";

/** What this branch hides and what it charges differently. */
export default async function BranchMenuPage({
  params,
}: {
  params: Promise<{ storeId: string; branchId: string }>;
}) {
  const { storeId, branchId } = await params;

  return (
    <Suspense>
      <BranchMenuScreen storeId={storeId} branchId={branchId} />
    </Suspense>
  );
}
