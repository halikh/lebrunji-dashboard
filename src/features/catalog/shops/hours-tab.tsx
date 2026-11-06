"use client";

import { AlertTriangle, CalendarClock, Clock, PauseCircle } from "lucide-react";
import { useState } from "react";

import { Badge, Button, EmptyState, Menu, Skeleton } from "@/components/ui";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { DayHours } from "../api/hours";
import { useBranches, type Branch } from "../use-branches";

import { BranchLabel } from "./branch-label";
import { Notice, SaveBar } from "./form-bits";
import { WeekEditor, checkWeek, draftWeek, weekToHours } from "./hours";
import {
  useBranchHours,
  useHoursForBranches,
  useSaveBranchHours,
} from "./use-hours";

/**
 * A branch's week: the grid, its read-back, and "Use another branch's hours",
 * which loads a sibling's week into the grid to be checked and saved.
 *
 * Hours belong to a place since `0101`. On a chain each branch's week is on
 * that branch's own page (its Hours tab); a shop with one branch keeps them on
 * the shop's Hours tab, because there the shop *is* the place. Either way this
 * is the one editor, and any sibling's week can be copied into the grid —
 * a chain's places mostly keep one timetable.
 */
export function BranchHoursPane({
  storeId,
  branch,
}: {
  storeId: string;
  branch: Branch;
}) {
  const branches = useBranches(storeId);
  const rows = branches.data ?? [];
  const everyWeek = useHoursForBranches(rows.map((row) => row.id));

  const others: OtherWeek[] = everyWeek.data
    ? rows
        .filter((row) => row.id !== branch.id)
        .map((row) => ({
          branch: row,
          name: pickLocalized(row.name),
          hours: everyWeek.data.get(row.id) ?? [],
        }))
    : [];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {!branch.isActive && (
        <Notice tone="info" icon={<PauseCircle />}>
          {t("hours.branchNotTrading", { name: pickLocalized(branch.name) })}
        </Notice>
      )}

      {/* Keyed, so another branch starts from its own week rather than
          resuming the previous one's half-edited grid. */}
      <BranchHours key={branch.id} branchId={branch.id} others={others} />
    </div>
  );
}

/**
 * The Hours tab of a shop with one branch — that branch's week. A chain has no
 * Hours tab: its hours are on each branch's page, and `ShopScreen` sends the
 * old `?tab=hours` links there.
 */
export function ShopHoursTab({ storeId }: { storeId: string }) {
  const branches = useBranches(storeId);
  const branch = branches.data?.[0] ?? null;

  if (branches.isPending) return <HoursSkeleton />;

  if (branches.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title={t("hours.failedTitle")}
        description={t("catalogue.failedBody")}
        action={
          <Button onClick={() => void branches.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  if (!branch) {
    // `0101` gives every shop a branch, so this is a schema that has not been
    // migrated rather than a state anybody should meet.
    return <EmptyState icon={<Clock />} title={t("branches.noneYet")} />;
  }

  return <BranchHoursPane storeId={storeId} branch={branch} />;
}

function HoursSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4, 5, 6].map((row) => (
        <Skeleton key={row} className="h-12 w-full" />
      ))}
    </div>
  );
}

type OtherWeek = { branch: Branch; name: string; hours: DayHours[] };

function BranchHours({
  branchId,
  others,
}: {
  branchId: string;
  others: OtherWeek[];
}) {
  const hours = useBranchHours(branchId);
  const save = useSaveBranchHours(branchId);

  if (hours.isPending) return <HoursSkeleton />;

  if (hours.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title={t("hours.failedTitle")}
        action={
          <Button onClick={() => void hours.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  return (
    <HoursForm
      // Keyed on what came back, so a refetch that changes the week rebuilds
      // the form rather than leaving edits on top of newer data.
      key={JSON.stringify(hours.data)}
      saved={hours.data}
      others={others}
      pending={save.isPending}
      onSave={(week) => save.mutate(week)}
    />
  );
}

function HoursForm({
  saved,
  others,
  pending,
  onSave,
}: {
  saved: DayHours[];
  others: OtherWeek[];
  pending: boolean;
  onSave: (week: DayHours[]) => void;
}) {
  const [week, setWeek] = useState(() => draftWeek(saved));
  const [error, setError] = useState<string | null>(null);
  /** The branch whose week was just copied in, until the grid is touched. */
  const [copied, setCopied] = useState<string | null>(null);

  const dirty = changed(
    weekToHours(week).filter((one) => one.opensAt && one.closesAt),
    saved,
  );
  useUnsavedChanges(dirty);

  function submit() {
    const problem = checkWeek(week);
    setError(problem);
    if (problem) return;
    onSave(weekToHours(week));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The one state where the app disagrees with what "no hours" sounds
          like: a branch with none is open around the clock. */}
      {saved.length === 0 && (
        <Notice icon={<AlertTriangle />} title={t("hours.noHoursTitle")}>
          {t("hours.noHours")}
        </Notice>
      )}

      {others.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {copied && (
            <p role="status" className="me-auto text-[13px] text-ink-3">
              {t("hours.copiedFromBranch", { name: copied })}
            </p>
          )}
          <Menu
            label={t("hours.useBranchHours")}
            trigger={
              <Button size="sm" variant="secondary">
                <CalendarClock />
                {t("hours.useBranchHours")}
              </Button>
            }
            // Into the grid, not saved: it is read, then saved. A branch with
            // no hours has nothing to copy — its week is open around the
            // clock, which the grid cannot hold. Name and address, because the
            // address is what tells a chain's branches apart.
            items={others.map((other) => ({
              label: (
                <BranchLabel
                  branch={other.branch}
                  className="max-w-72"
                  aside={
                    other.hours.length === 0 ? (
                      <Badge tone="neutral">
                        {t("hours.useBranchHoursNone")}
                      </Badge>
                    ) : undefined
                  }
                />
              ),
              disabled: other.hours.length === 0,
              onSelect: () => {
                setWeek(draftWeek(other.hours));
                setError(null);
                setCopied(other.name);
              },
            }))}
          />
        </div>
      )}

      <WeekEditor
        week={week}
        onChange={(next) => {
          setWeek(next);
          setError(null);
          setCopied(null);
        }}
        error={error}
        dirty={dirty}
      />

      <SaveBar status={dirty ? t("hours.unsavedShort") : undefined}>
        <Button
          variant="ghost"
          disabled={!dirty || pending}
          onClick={() => {
            setWeek(draftWeek(saved));
            setError(null);
            setCopied(null);
          }}
        >
          {t("store.discard")}
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          pending={pending}
          disabled={!dirty}
        >
          {t("hours.save")}
        </Button>
      </SaveBar>
    </div>
  );
}
