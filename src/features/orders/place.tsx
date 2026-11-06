import { cx } from "@/components/ui";

import { placeName, type OrderStore } from "./api/orders";

/**
 * A shop's name on an order, with the branch's written address under it when
 * the shop has more than one place — the address is what tells "Khalifeh,
 * Hamra" from "Khalifeh, Hamra 2" for the operator and the driver.
 */
export function PlaceName({
  store,
  className,
  nameClassName,
}: {
  store: Pick<OrderStore, "storeName" | "branchName" | "branchAddress">;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cx("flex min-w-0 flex-col", className)}>
      <span className={cx("truncate", nameClassName)}>{placeName(store)}</span>
      {store.branchAddress && (
        <span
          title={store.branchAddress}
          className="truncate text-[12.5px] font-normal text-ink-3"
        >
          {store.branchAddress}
        </span>
      )}
    </span>
  );
}
