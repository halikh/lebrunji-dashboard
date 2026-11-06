"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Badge, Skeleton, cx } from "@/components/ui";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { BranchLabel } from "../shops/branch-label";

import type { Branch } from "../api/branches";
import { useBranches } from "../use-branches";
import { useBranchOverrides } from "../use-branch-menu";

/**
 * A dish at each of its shop's branches: what it costs there and whether it is
 * served — read only, with the way to the one place each is changed.
 *
 * It used to hold every branch's switch and price box, which made this the
 * third place a branch's menu could be edited (with the shop's Menu tab and
 * the branch's own). Editing per-branch things now happens on the branch's
 * Menu tab; "Edit at Hamra" lands there scrolled to this dish (`?focus=`).
 */
export function DishBranches({
  storeId,
  itemId,
  sectionId,
  shopPrice,
  shopCode,
}: {
  storeId: string;
  itemId: string;
  sectionId: string;
  /** The saved shop price, which a branch with no price of its own charges. */
  shopPrice: number;
  shopCode: string;
}) {
  const branches = useBranches(storeId);

  if (branches.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  const rows = branches.data ?? [];
  if (rows.length < 2) {
    return <p className="text-[13.5px] text-ink-3">{t("menu.branchesOne")}</p>;
  }

  return (
    <ul className="-my-2 divide-y divide-line">
      {rows.map((branch) => (
        <BranchLine
          key={branch.id}
          storeId={storeId}
          branch={branch}
          itemId={itemId}
          sectionId={sectionId}
          shopPrice={shopPrice}
          shopCode={shopCode}
        />
      ))}
    </ul>
  );
}

function BranchLine({
  storeId,
  branch,
  itemId,
  sectionId,
  shopPrice,
  shopCode,
}: {
  storeId: string;
  branch: Branch;
  itemId: string;
  sectionId: string;
  shopPrice: number;
  shopCode: string;
}) {
  const overrides = useBranchOverrides(branch.id);
  const { format } = useMoney();

  const code = branch.currencyCode ?? shopCode;
  // Off the shop's currency a branch has a price of its own for every dish
  // (`0229`); the shop's figure, in another currency, is not its price.
  const inherits =
    branch.currencyCode === null || branch.currencyCode === shopCode;
  const state = overrides.data;
  const sectionOff = state?.hiddenSections.has(sectionId) ?? false;
  const hidden = state?.hiddenItems.has(itemId) ?? false;
  const own = state?.itemPrices.get(itemId) ?? null;
  const name = pickLocalized(branch.name);
  const served = !hidden && !sectionOff;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3">
      <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
        <BranchLabel
          branch={branch}
          className="text-[14px] font-medium text-ink"
        />
        {!branch.isActive && (
          <Badge tone="neutral">{t("branches.notTrading")}</Badge>
        )}
      </div>

      {overrides.isPending ? (
        <Skeleton className="h-4 w-40" />
      ) : (
        <>
          <span className="flex items-center gap-1.5 text-[13.5px] tabular-nums">
            {own !== null ? (
              <>
                <span className="font-medium text-ink">
                  {code ? format(own, code) : null}
                </span>
                {inherits && (
                  <span className="text-[12px] font-medium text-info-ink">
                    {t("branchMenu.ownPrice")}
                  </span>
                )}
              </>
            ) : inherits ? (
              <>
                <span className="text-ink-2">
                  {shopCode ? format(shopPrice, shopCode) : null}
                </span>
                <span className="text-[12px] text-ink-4">
                  {t("menu.branchSamePrice")}
                </span>
              </>
            ) : (
              <span className="text-warning-ink">
                {t("menu.branchNoPrice")}
              </span>
            )}
          </span>
          <span
            className={cx(
              "w-36 text-[13px]",
              served ? "text-success-ink" : "text-ink-3",
            )}
          >
            {sectionOff
              ? t("menu.branchSectionOff")
              : hidden
                ? t("branchMenu.notServed")
                : t("branchMenu.served")}
          </span>
        </>
      )}

      <Link
        href={`/shops/${storeId}/branches/${branch.id}?focus=${itemId}`}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink hover:underline"
      >
        {t("menu.editAtBranch", { name })}
        <ArrowUpRight aria-hidden className="size-3.5 rtl:-scale-x-100" />
      </Link>
    </li>
  );
}
