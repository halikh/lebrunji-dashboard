"use client";

import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Branch } from "../api/branches";
import type { DayHours } from "../api/hours";
import { useUpdateBranch } from "../use-branches";

import { useNow } from "./hours";
import { nextChangeAt } from "./next-change";
import { StatusLine, useDescribeChange } from "./open-status";

/**
 * One branch's line — "Open, closes 23:00" — in the words the shop's own line
 * uses, so a place reads the same on the shops list, the Branches tab and its
 * own page.
 *
 * Three things can be in the way, and the first that is wins: the shop hidden
 * from the app, the branch not trading, its hours. A branch with no hours is
 * open around the clock (`0170`), said as a warning because it is rarely meant.
 * `week` undefined is "not read yet" and draws nothing, rather than a branch
 * with no hours — which would read as open all day.
 */
export function BranchStatusLine({
  branch,
  shopActive,
  week,
  className,
}: {
  branch: Pick<Branch, "isActive">;
  shopActive: boolean;
  week: DayHours[] | undefined;
  className?: string;
}) {
  const now = useNow();
  const describe = useDescribeChange();

  if (!shopActive) {
    return (
      <StatusLine tone="muted" className={className}>
        {t("branches.shopHidden")}
      </StatusLine>
    );
  }
  if (!branch.isActive) {
    return (
      <StatusLine tone="muted" className={className}>
        {t("hours.status.notTrading")}
      </StatusLine>
    );
  }
  if (!week) return null;

  const change = nextChangeAt(week, now);
  const unset = week.length === 0;
  return (
    <StatusLine
      tone={unset ? "warning" : change.open ? "open" : "closed"}
      className={className}
    >
      {describe(change, { unset })}
    </StatusLine>
  );
}

/**
 * Whether a branch trades at all — `branches.is_active` — as a switch that asks
 * first and says what it does to customers. Not its hours: those decide when
 * it is open; this shuts it altogether, as a refit or a seasonal close would.
 *
 * Written straight away, not through a form's Save, so the same switch means
 * the same thing on the shops list, the Branches tab and the branch's page.
 * `updateBranch` refuses to start a branch with no number or pin on its own.
 */
export function BranchLiveToggle({
  storeId,
  branch,
  className,
}: {
  storeId: string;
  branch: Branch;
  className?: string;
}) {
  const update = useUpdateBranch(storeId);
  const name = pickLocalized(branch.name);

  return (
    <ConfirmToggle
      on={branch.isActive}
      onChange={async () => {
        // Rethrown so the dialog stays open on a refusal; the hook has toasted.
        await update.mutateAsync({
          id: branch.id,
          patch: { isActive: !branch.isActive },
          name,
        });
      }}
      disabled={update.isPending}
      labelOn={t("catalogue.active")}
      labelOff={t("branches.notTrading")}
      params={{ name }}
      whenTurningOn={{
        titleKey: "branches.liveOnTitle",
        bodyKey: "branches.liveOnBody",
        confirmKey: "branches.liveOnConfirm",
      }}
      whenTurningOff={{
        titleKey: "branches.liveOffTitle",
        bodyKey: "branches.liveOffBody",
        confirmKey: "branches.liveOffConfirm",
      }}
      className={className}
    />
  );
}
