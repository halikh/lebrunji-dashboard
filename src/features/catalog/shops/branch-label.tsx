import type { ReactNode } from "react";

import { cx } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Branch } from "../api/branches";

/**
 * A branch as it is told apart in a picker: its name, and its written address
 * under it.
 *
 * On a chain the names are often a neighbourhood or a number, and two branches
 * can share one; the address is what an owner actually recognises. So every
 * list of branches to choose from says it, and says plainly when there is none
 * yet — a blank second line reads as a rendering fault.
 *
 * Truncated to the space it is given, with the whole address on hover.
 */
export function BranchLabel({
  branch,
  aside,
  className,
}: {
  branch: Pick<Branch, "name" | "address">;
  /** Beside the name — a badge, a currency, "not trading". */
  aside?: ReactNode;
  className?: string;
}) {
  const name = pickLocalized(branch.name);
  const address = pickLocalized(branch.address);
  return (
    <span className={cx("flex min-w-0 flex-col text-start", className)}>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate" title={name}>
          {name}
        </span>
        {aside}
      </span>
      <span
        title={address || undefined}
        className={cx(
          "truncate text-[12.5px] font-normal",
          address ? "text-ink-3" : "text-ink-4",
        )}
      >
        {address || t("branches.noAddressYet")}
      </span>
    </span>
  );
}
