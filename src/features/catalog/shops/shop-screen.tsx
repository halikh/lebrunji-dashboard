"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  MoreHorizontal,
  Star,
  StarOff,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Menu,
  Page,
  Skeleton,
  Tabs,
  cx,
} from "@/components/ui";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { useAnyUnsaved, useConfirmLeave } from "@/components/unsaved-changes";
import { ShopBundlesTab } from "@/features/catalog/bundles/shop-bundles-tab";
import { ShopMenuTab } from "@/features/catalog/menu/shop-menu-tab";
import { ShopOptionsTab } from "@/features/catalog/menu/shop-options-tab";
import { pickLocalized } from "@/i18n/db-text";
import { BackButton } from "@/components/back-button";
import { t, type TranslationKey } from "@/i18n/translations";

import type { Store } from "../api/stores";
import { useBranches } from "../use-branches";
import { useArchiveStore, useStore, useUpdateStore } from "../use-stores";

import { useNow } from "./hours";
import { nextChangeAt, shopChange } from "./next-change";
import { StatusLine, useDescribeChange } from "./open-status";
import { ShopArchiveTab } from "./shop-archive-tab";
import { ShopBranchesTab } from "./branches-tab";
import { ShopDetailsTab } from "./shop-details-tab";
import { ShopFacts, ShopThumb } from "./shop-identity";
import { ShopHoursTab } from "./hours-tab";
import { useHoursForBranches } from "./use-hours";

/**
 * One shop: its menu, and its own settings.
 *
 * ## Tabs, Menu first
 *
 * A shop is created a handful of times ever and then visited for years to
 * change one thing — usually the menu (prices change weekly, a dish comes off).
 * The settings are a place you go deliberately. So the menu leads, and Archive
 * comes last: it is where you go to undo something, not part of setting up.
 *
 * ## The tab lives in the URL, with `replace`
 *
 * `?tab=details`, so a view can be linked and reloaded; `replace` rather than
 * `push`, because switching tabs is not a journey — Back leaves the shop.
 *
 * ## Mounted on first visit, kept after
 *
 * Nothing is fetched until a tab is asked for, and nothing is thrown away once
 * it has been: a tab you return to keeps its rows, its scroll and its answered
 * queries rather than flashing a skeleton at somebody who was just there. A
 * tab left with unsaved work (after the operator agreed to discard it) is
 * remounted, so the discarded draft is really gone and stops guarding.
 *
 * ## A chain is a brand above its branches
 *
 * With two or more branches this page holds only what they share — the menu,
 * the options, the bundles, the brand's details — and each branch is managed
 * on its own page, its menu, hours and details together (`branch-screen.tsx`).
 * So a chain has no Hours tab: hours are a place's. A shop with one branch
 * keeps it, since there the shop *is* the place.
 *
 * Links from before (`?tab=hours&branch=`, `?tab=menu&branch=`, a chain's
 * `?tab=hours`) are sent on to the branch's page, so a bookmark or a To do
 * entry still lands where the thing is edited now.
 */

const TABS = [
  { key: "menu", labelKey: "menu.title" },
  { key: "details", labelKey: "store.detailsTab" },
  { key: "branches", labelKey: "branches.tab" },
  { key: "options", labelKey: "options.tab" },
  { key: "bundles", labelKey: "bundles.tab" },
  { key: "hours", labelKey: "hours.tab" },
  { key: "archive", labelKey: "archive.tab" },
] as const satisfies readonly { key: string; labelKey: TranslationKey }[];

type TabKey = (typeof TABS)[number]["key"];

export function ShopScreen({ storeId }: { storeId: string }) {
  const store = useStore(storeId);
  const branches = useBranches(storeId);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const confirmLeave = useConfirmLeave();
  const anyUnsaved = useAnyUnsaved();

  const branchCount = store.data?.branchIds.length ?? 0;
  const chain = branchCount > 1;
  const tabs = TABS.filter((one) => !(chain && one.key === "hours"));

  const requested = params.get("tab");
  const tab: TabKey = tabs.some((one) => one.key === requested)
    ? (requested as TabKey)
    : "menu";

  // The old homes of a branch's hours and prices, sent on to its page.
  const linkedBranch = params.get("branch");
  const firstBranch = branches.data?.[0]?.id ?? null;
  const redirect = !chain
    ? null
    : linkedBranch &&
        store.data?.branchIds.includes(linkedBranch) &&
        (requested === null || requested === "menu" || requested === "hours")
      ? `/shops/${storeId}/branches/${linkedBranch}${requested === "hours" ? "?tab=hours" : ""}`
      : requested === "hours" && firstBranch
        ? `/shops/${storeId}/branches/${firstBranch}?tab=hours`
        : null;
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set([tab]));
  // Adjusted during render — React's pattern for state that follows a prop —
  // so a first visit draws the pane in the same frame rather than a frame of
  // nothing first.
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));

  /** Bumped to remount a tab whose draft the operator chose to discard. */
  const [epochs, setEpochs] = useState<Partial<Record<TabKey, number>>>({});

  function show(next: TabKey) {
    if (next === tab) return;
    const hadWork = anyUnsaved;
    void confirmLeave().then((leave) => {
      if (!leave) return;
      if (hadWork) {
        setEpochs((current) => ({
          ...current,
          [tab]: (current[tab] ?? 0) + 1,
        }));
      }
      const query = new URLSearchParams(params);
      if (next === "menu") query.delete("tab");
      else query.set("tab", next);
      // A branch picked on one tab is not a choice on another.
      query.delete("branch");
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  if (store.isError) {
    return (
      <Page>
        <BackButton />
        <EmptyState
          icon={<AlertTriangle />}
          title={t("store.detailsFailed")}
          description={
            store.error instanceof Error ? store.error.message : undefined
          }
          action={
            <Button onClick={() => void store.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      </Page>
    );
  }

  const panes: Record<TabKey, ReactNode> = {
    menu: <ShopMenuTab storeId={storeId} />,
    details: <ShopDetailsTab storeId={storeId} />,
    branches: <ShopBranchesTab storeId={storeId} />,
    options: <ShopOptionsTab storeId={storeId} />,
    bundles: <ShopBundlesTab storeId={storeId} />,
    hours: <ShopHoursTab storeId={storeId} />,
    archive: <ShopArchiveTab storeId={storeId} />,
  };

  return (
    <Page>
      <div className="flex flex-col gap-4">
        <BackButton />
        {store.data ? (
          <ShopHeader store={store.data} />
        ) : (
          <div className="flex items-center gap-4" aria-busy>
            <Skeleton className="size-14 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Tabs
          items={tabs.map(({ key, labelKey }) => ({
            key,
            // A chain says how many places it has before the tab is opened.
            label:
              key === "branches" && branchCount > 1
                ? t("branches.tabCount", { count: branchCount })
                : t(labelKey),
          }))}
          value={tab}
          onChange={show}
        />

        {tabs.map(({ key }) =>
          visited.has(key) && !(key === tab && redirect) ? (
            <div
              key={`${key}-${epochs[key] ?? 0}`}
              role="tabpanel"
              aria-label={t(TABS.find((one) => one.key === key)!.labelKey)}
              className={cx(key !== tab && "hidden")}
            >
              {panes[key]}
            </div>
          ) : null,
        )}
      </div>
    </Page>
  );
}

/**
 * The shop, said the way the list says it — picture, name, the category and
 * prep line, the number orders go to — plus whether customers can order from
 * it right now, and the two storefront switches.
 */
function ShopHeader({ store }: { store: Store }) {
  const router = useRouter();
  const update = useUpdateStore();
  const archive = useArchiveStore();
  const name = pickLocalized(store.name);
  const [asking, setAsking] = useState<"feature" | "archive" | null>(null);

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 items-start gap-4">
        <ShopThumb
          store={store}
          size={56}
          className={cx(
            "rounded-lg",
            !store.isActive && "opacity-60 grayscale",
          )}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">
              {name}
            </h1>
            {store.isActive ? (
              <Badge tone="success" dot>
                {t("catalogue.active")}
              </Badge>
            ) : (
              <Badge tone="neutral" dot>
                {t("catalogue.inactive")}
              </Badge>
            )}
          </div>
          <ShopFacts store={store} />
          <OpenInApp store={store} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ConfirmToggle
          on={store.isActive}
          onChange={() =>
            update.mutate({
              id: store.id,
              patch: { isActive: !store.isActive },
            })
          }
          labelOn={t("store.liveInApp")}
          labelOff={t("store.hiddenInApp")}
          params={{ name }}
          whenTurningOn={{
            titleKey: "catalogue.openTitle",
            bodyKey: "catalogue.openBody",
            confirmKey: "catalogue.openConfirm",
          }}
          whenTurningOff={{
            titleKey: "catalogue.closeTitle",
            bodyKey: "catalogue.closeBody",
            confirmKey: "catalogue.closeConfirm",
          }}
        />
        <Menu
          label={name}
          trigger={
            <Button
              variant="secondary"
              size="icon"
              aria-label={t("catalogue.moreFor", { name })}
            >
              <MoreHorizontal />
            </Button>
          }
          items={[
            {
              label: store.isFeatured
                ? t("catalogue.unfeatureConfirm")
                : t("catalogue.featureConfirm"),
              icon: store.isFeatured ? <StarOff /> : <Star />,
              onSelect: () => setAsking("feature"),
            },
            "separator",
            {
              label: t("catalogue.archiveShop"),
              icon: <Archive />,
              tone: "danger",
              onSelect: () => setAsking("archive"),
            },
          ]}
        />
      </div>

      <ConfirmDialog
        open={asking === "feature"}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t(
          store.isFeatured
            ? "catalogue.unfeatureTitle"
            : "catalogue.featureTitle",
          { name },
        )}
        description={t(
          store.isFeatured
            ? "catalogue.unfeatureBody"
            : "catalogue.featureBody",
        )}
        confirmLabel={t(
          store.isFeatured
            ? "catalogue.unfeatureConfirm"
            : "catalogue.featureConfirm",
        )}
        onConfirm={() =>
          update.mutate({
            id: store.id,
            patch: { isFeatured: !store.isFeatured },
          })
        }
      />
      <ConfirmDialog
        open={asking === "archive"}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t("catalogue.archiveTitleNamed", { name })}
        description={t("catalogue.archiveBody")}
        confirmLabel={t("catalogue.archiveConfirm")}
        tone="danger"
        onConfirm={async () => {
          try {
            await archive.mutateAsync({ id: store.id, name: store.name });
            router.push("/shops");
          } catch {
            // Reported by the hook's toast; the shop stays on screen.
          }
        }}
      />
    </header>
  );
}

/**
 * Whether a customer opening the app now could order here, and until when.
 *
 * Three things decide it, and the line names whichever is in the way: the
 * shop's own switch, whether any branch is trading, and the trading branches'
 * hours in Beirut. A branch with no hours is open around the clock (`0170`),
 * which is how the app and `place_order` read it too. When it is open, the
 * line says when that ends ("Open, closes 23:00"), Google Business Profile's
 * wording — the next change is what the operator plans around.
 */
function OpenInApp({ store }: { store: Store }) {
  const trading = store.tradingBranchIds;
  const hours = useHoursForBranches(trading);
  const now = useNow();
  const describe = useDescribeChange();

  if (!store.isActive) {
    return (
      <StatusLine tone="muted" className="text-[13px]">
        {t("store.statusHidden")}
      </StatusLine>
    );
  }
  if (trading.length === 0) {
    return (
      <StatusLine tone="warning" className="text-[13px]">
        {t("store.statusNoBranch")}
      </StatusLine>
    );
  }
  if (!hours.data) return null;

  const weeks = trading.map((id) => hours.data.get(id) ?? []);
  const rolled = shopChange(weeks.map((week) => nextChangeAt(week, now)));
  const unset = weeks.every((week) => week.length === 0);

  return (
    <StatusLine
      tone={unset ? "warning" : rolled.open ? "open" : "closed"}
      className="text-[13px]"
    >
      {rolled.open && trading.length > 1 && rolled.openCount < trading.length
        ? t("hours.status.someOpen", {
            open: rolled.openCount,
            total: trading.length,
          })
        : describe(rolled, { unset })}
    </StatusLine>
  );
}
