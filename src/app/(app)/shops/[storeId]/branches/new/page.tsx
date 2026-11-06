import { Suspense } from "react";

import { NewBranchScreen } from "@/features/catalog/shops/branch-editor";

export const metadata = { title: "New branch" };

/** Adding a branch to a shop. */
export default async function NewBranchPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  return (
    <Suspense>
      <NewBranchScreen storeId={storeId} />
    </Suspense>
  );
}
