import { Suspense } from "react";

import { BranchScreen } from "@/features/catalog/shops/branch-screen";

/**
 * One branch, managed like a store of its own: its menu and prices, its hours
 * and its details, the tab in `?tab=` (Menu when absent).
 */
export default async function BranchPage({
  params,
}: {
  params: Promise<{ storeId: string; branchId: string }>;
}) {
  const { storeId, branchId } = await params;
  return (
    <Suspense>
      <BranchScreen storeId={storeId} branchId={branchId} />
    </Suspense>
  );
}
