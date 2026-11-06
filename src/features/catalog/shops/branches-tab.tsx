"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  DoorClosed,
  MapPinned,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  UtensilsCrossed,
} from "lucide-react";
import { useState } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ListSkeleton,
  Menu,
  SearchInput,
  Thumb,
  cx,
} from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Branch } from "../api/branches";
import { useArchiveBranch, useBranches } from "../use-branches";
import { useStore } from "../use-stores";

import type { DayHours } from "../api/hours";

import { BranchLiveToggle, BranchStatusLine } from "./branch-status";
import { NoPinWarning, NoWhatsappWarning } from "./shop-identity";
import { useHoursForBranches } from "./use-hours";

/**
 * The places one shop trades from.
 *
 * A shop with one branch and a shop with nine are the same screen: `0101`
 * gave every shop a branch, so this list is never empty and a chain is simply
 * a shop with more rows. Each row says what is wrong with the place before it
 * is opened — no pin (delivery charged at the top band, measured from here
 * since `0109`), no number (orders reach no kitchen), not trading.
 *
 * ## The one-branch case
 *
 * The shop's only branch *is* the shopfront, and Details edits it: the row
 * opens Details, and it cannot be closed — a shop with no branch is listed,
 * has a menu and has nowhere for an order to go. Both come back the moment a
 * second branch exists. `useArchiveBranch` refuses the last one on its own
 * too, for a stale list.
 *
 * ## Open now, per place
 *
 * Shopify's locations list says whether each location is active; for a
 * kitchen the live question is narrower — is it taking orders this minute,
 * and until when — so every row carries the hours line the shop header and
 * the branch's page use, the switch that stops it trading, and a menu
 * straight to its menu, hours or details — the tabs of its own page.
 */
export function ShopBranchesTab({ storeId }: { storeId: string }) {
  const router = useRouter();
  const store = useStore(storeId);
  // Reaches the database rather than filtering the rows on screen: the list
  // is capped, so a client-side filter would search what was *read*.
  const [search, setSearch] = useState("");
  const branches = useBranches(storeId, search);
  // The whole list, for counting: while searching, `rows.length` is how many
  // *matched*, and one match in a chain of nine is not the shop's only branch.
  const everything = useBranches(storeId);
  const archive = useArchiveBranch(storeId);
  const [closing, setClosing] = useState<Branch | null>(null);
  // The whole list's ids, so the key matches the Hours tab's and is shared.
  const weeks = useHoursForBranches(
    (everything.data ?? []).map((one) => one.id),
  );

  const searching = search.trim().length > 0;
  const rows = branches.data ?? [];
  const total = everything.data?.length ?? rows.length;
  const sole = total === 1;

  const hrefOf = (branch: Branch) =>
    sole
      ? `/shops/${storeId}?tab=details`
      : `/shops/${storeId}/branches/${branch.id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("branches.searchPlaceholder")}
          className="w-full sm:w-72"
        />
        {everything.isSuccess && (
          <p className="text-[13px] text-ink-3 tabular-nums">
            {total === 1
              ? t("branches.countOne")
              : t("branches.count", { count: total })}
          </p>
        )}
        <Button variant="primary" asChild className="ms-auto">
          <Link href={`/shops/${storeId}/branches/new`}>
            <Plus />
            {t("branches.add")}
          </Link>
        </Button>
      </div>

      <p className="text-[13.5px] text-ink-3">
        {sole ? t("branches.introSole") : t("branches.introChain")}
      </p>

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
        {branches.isPending && <ListSkeleton rows={2} />}

        {branches.isError && (
          <EmptyState
            icon={<AlertTriangle />}
            title={t("branches.failed")}
            action={
              <Button onClick={() => void branches.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        )}

        {/* A search that matched nothing, said as its own state — the list
            simply emptying reads as a shop that has lost its branches. */}
        {branches.isSuccess && rows.length === 0 && (
          <EmptyState
            icon={searching ? <SearchX /> : <MapPinned />}
            title={searching ? t("branches.noMatches") : t("branches.noneYet")}
            action={
              searching ? (
                <Button onClick={() => setSearch("")}>
                  {t("common.clear")}
                </Button>
              ) : undefined
            }
          />
        )}

        {rows.length > 0 && (
          <ul className="divide-y divide-line">
            {rows.map((branch) => (
              <BranchRow
                key={branch.id}
                branch={branch}
                href={hrefOf(branch)}
                imageUrl={branch.imageUrl ?? store.data?.imageUrl ?? null}
                sole={sole}
                week={weeks.data?.get(branch.id)}
                weeksLoaded={weeks.isSuccess}
                storeId={storeId}
                shopActive={store.data?.isActive ?? true}
                onOpen={(tab) =>
                  router.push(
                    `/shops/${storeId}/branches/${branch.id}${tab ? `?tab=${tab}` : ""}`,
                  )
                }
                onClose={() => setClosing(branch)}
              />
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={closing !== null}
        onOpenChange={(open) => !open && setClosing(null)}
        title={t("branches.closeTitle", {
          name: closing ? pickLocalized(closing.name) : "",
        })}
        description={t("branches.closeBody")}
        confirmLabel={t("branches.closeConfirm")}
        tone="danger"
        onConfirm={async () => {
          if (!closing) return;
          try {
            await archive.mutateAsync({
              id: closing.id,
              name: pickLocalized(closing.name),
              live: total,
            });
          } catch {
            // Reported by the hook's toast — including the last-branch refusal.
          }
        }}
      />
    </div>
  );
}

function BranchRow({
  branch,
  href,
  imageUrl,
  sole,
  week,
  weeksLoaded,
  storeId,
  shopActive,
  onOpen,
  onClose,
}: {
  branch: Branch;
  storeId: string;
  shopActive: boolean;
  href: string;
  /** Already resolved against the shop's: null means "the shop's" (`0110`). */
  imageUrl: string | null;
  sole: boolean;
  /** Absent with `weeksLoaded` is a branch with no hours: open all the time. */
  week: DayHours[] | undefined;
  weeksLoaded: boolean;
  /** To the branch's page, on a tab (Menu when absent). */
  onOpen: (tab?: "hours" | "details") => void;
  onClose: () => void;
}) {
  const name = pickLocalized(branch.name);
  const address = pickLocalized(branch.address);
  const pinned = branch.latitude !== null && branch.longitude !== null;

  return (
    <li className="group relative flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle sm:flex-nowrap">
      <Thumb
        src={imageUrl}
        size={44}
        alt={name}
        className={cx(!branch.isActive && "opacity-60 grayscale")}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={href}
            className="truncate text-[14.5px] font-semibold text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-accent"
          >
            {name}
          </Link>
          {!branch.isActive && (
            <Badge tone="neutral">{t("branches.notTrading")}</Badge>
          )}
          {branch.currencyCode && (
            <Badge tone="info">{branch.currencyCode}</Badge>
          )}
        </div>
        <p className="truncate text-[12.5px] text-ink-3">
          {[
            address,
            t("catalogue.prep", {
              min: branch.prepMinMinutes,
              max: branch.prepMaxMinutes,
            }),
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
        <BranchStatusLine
          branch={branch}
          shopActive={shopActive}
          // Absent once loaded is a branch with no hours: open all the time.
          week={weeksLoaded ? (week ?? []) : undefined}
        />
        {(!pinned || !branch.whatsappPhone || !address) && (
          <div className="flex flex-wrap gap-1.5">
            {!pinned && <NoPinWarning />}
            {!branch.whatsappPhone && <NoWhatsappWarning />}
            {!address && (
              <span className="inline-flex w-fit items-center rounded-md bg-warning-soft px-2 py-0.5 text-[12px] font-medium text-warning-ink">
                {t("branches.noAddress")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto">
        {!sole && <BranchLiveToggle storeId={storeId} branch={branch} />}
        {sole ? (
          <span className="hidden text-[12.5px] text-ink-4 sm:inline">
            {t("branches.editedOnDetails")}
          </span>
        ) : (
          <Menu
            label={name}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("catalogue.moreFor", { name })}
              >
                <MoreHorizontal />
              </Button>
            }
            items={[
              {
                label: t("branches.editMenu"),
                icon: <UtensilsCrossed />,
                onSelect: () => onOpen(),
              },
              {
                label: t("branches.editHours"),
                icon: <Clock />,
                onSelect: () => onOpen("hours"),
              },
              {
                label: t("branches.editDetails"),
                icon: <Pencil />,
                onSelect: () => onOpen("details"),
              },
              "separator",
              {
                label: t("branches.closeConfirm"),
                icon: <DoorClosed />,
                tone: "danger",
                onSelect: onClose,
              },
            ]}
          />
        )}
        <ChevronRight
          aria-hidden
          className="size-4 text-ink-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180"
        />
      </div>
    </li>
  );
}
