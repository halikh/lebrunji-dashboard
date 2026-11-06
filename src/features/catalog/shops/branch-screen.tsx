"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  DoorClosed,
  MapPinOff,
  MoreHorizontal,
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
  Thumb,
  cx,
} from "@/components/ui";
import {
  useAnyUnsaved,
  useConfirmLeave,
  useGuardedAction,
} from "@/components/unsaved-changes";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";

import type { Branch } from "../api/branches";
import type { Store } from "../api/stores";
import { useArchiveBranch, useBranches } from "../use-branches";
import { useStore } from "../use-stores";

import { BranchDetailsForm } from "./branch-editor";
import { BranchLabel } from "./branch-label";
import { BranchMenuEditor } from "./branch-menu";
import { BranchLiveToggle, BranchStatusLine } from "./branch-status";
import { BranchHoursPane } from "./hours-tab";
import { useBranchHours } from "./use-hours";

/**
 * One branch, managed like a store of its own — Uber Eats Manager's store
 * page, Shopify's location.
 *
 * ## Everything about one place, in one place
 *
 * A chain's owner thinks "Hamra is out of the fattoush" or "Verdun closes
 * early on Sundays", and the answer used to be split across the shop's Menu
 * tab (with a branch picker), the shop's Hours tab (with another), this page's
 * details and each dish's page. Now it is here: the branch's menu — what it
 * serves and charges — its week and its details, under one header that says
 * whether it is taking orders and holds the switch that stops it.
 *
 * What is the *brand's* — the menu itself, options, bundles, name, category —
 * stays on the shop's page, and the breadcrumb leads there.
 *
 * ## Tabs, Menu first, in the URL
 *
 * As on the shop's page: `?tab=`, with `replace`, mounted on first visit and
 * kept after, a tab whose draft was discarded remounted. The header's switcher
 * to a sibling branch keeps the tab, so walking a chain's Hours is one click
 * a place. `?tab=menu` is the old "Menu and prices" link; it is the Menu tab.
 */

const TABS = [
  { key: "menu", labelKey: "branches.menuTab" },
  { key: "hours", labelKey: "branches.hoursTab" },
  { key: "details", labelKey: "branches.detailsTab" },
] as const satisfies readonly { key: string; labelKey: TranslationKey }[];

type TabKey = (typeof TABS)[number]["key"];

export function BranchScreen({
  storeId,
  branchId,
}: {
  storeId: string;
  branchId: string;
}) {
  const store = useStore(storeId);
  const branches = useBranches(storeId);
  const rows = branches.data ?? [];
  const branch = rows.find((row) => row.id === branchId) ?? null;
  const shopHref = `/shops/${storeId}`;

  if (!branch) {
    return (
      <Page>
        <Breadcrumb
          storeId={storeId}
          shopName={store.data ? pickLocalized(store.data.name) : ""}
          branchName={null}
        />
        {branches.isPending ? (
          <div aria-hidden className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : branches.isError ? (
          <EmptyState
            icon={<AlertTriangle />}
            title={t("branches.failed")}
            action={
              <Button onClick={() => void branches.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<MapPinOff />}
            title={t("branches.notFound")}
            action={
              <Button asChild>
                <Link href={`${shopHref}?tab=branches`}>
                  {t("branches.backToList")}
                </Link>
              </Button>
            }
          />
        )}
      </Page>
    );
  }

  return (
    <BranchPage
      // A sibling picked in the header is another record: nothing of this
      // one's tabs (visited, drafts) carries over.
      key={branch.id}
      storeId={storeId}
      store={store.data ?? null}
      branch={branch}
      siblings={rows}
    />
  );
}

function BranchPage({
  storeId,
  store,
  branch,
  siblings,
}: {
  storeId: string;
  store: Store | null;
  branch: Branch;
  siblings: Branch[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const confirmLeave = useConfirmLeave();
  const anyUnsaved = useAnyUnsaved();

  const requested = params.get("tab");
  const tab: TabKey = TABS.some((one) => one.key === requested)
    ? (requested as TabKey)
    : "menu";

  // `?tab=menu` was the old way to this branch's prices; Menu is the default
  // now, so the parameter is dropped rather than kept as a second address.
  useEffect(() => {
    if (requested !== "menu") return;
    const query = new URLSearchParams(params);
    query.delete("tab");
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }, [requested, params, pathname, router]);

  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set([tab]));
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));
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
      // A dish arrived at is a Menu thing; it does not follow to Hours.
      query.delete("focus");
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  const panes: Record<TabKey, ReactNode> = {
    menu: (
      <BranchMenuEditor
        storeId={storeId}
        store={store}
        branch={branch}
        siblings={siblings}
      />
    ),
    hours: <BranchHoursPane storeId={storeId} branch={branch} />,
    details: (
      <BranchDetailsForm storeId={storeId} store={store} branch={branch} />
    ),
  };

  return (
    <Page>
      <div className="flex flex-col gap-4">
        <Breadcrumb
          storeId={storeId}
          shopName={store ? pickLocalized(store.name) : ""}
          branchName={pickLocalized(branch.name)}
        />
        <BranchHeader
          storeId={storeId}
          store={store}
          branch={branch}
          siblings={siblings}
          tab={tab}
        />
      </div>

      <div className="flex flex-col gap-6">
        <Tabs
          items={TABS.map(({ key, labelKey }) => ({ key, label: t(labelKey) }))}
          value={tab}
          onChange={show}
        />
        {TABS.map(({ key, labelKey }) =>
          visited.has(key) ? (
            <div
              key={`${key}-${epochs[key] ?? 0}`}
              role="tabpanel"
              aria-label={t(labelKey)}
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

/** Shops › Brand › Branch — the way back up, each step a link. */
function Breadcrumb({
  storeId,
  shopName,
  branchName,
}: {
  storeId: string;
  shopName: string;
  branchName: string | null;
}) {
  const separator = (
    <ChevronRight aria-hidden className="size-3.5 shrink-0 rtl:rotate-180" />
  );
  return (
    <nav aria-label={t("branches.breadcrumb")}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink-3">
        <li>
          <Link href="/shops" className="hover:text-ink">
            {t("branches.shops")}
          </Link>
        </li>
        <li className="flex min-w-0 items-center gap-1.5">
          {separator}
          {shopName ? (
            <Link
              href={`/shops/${storeId}?tab=branches`}
              className="truncate hover:text-ink"
            >
              {shopName}
            </Link>
          ) : (
            <Skeleton className="h-3.5 w-24" />
          )}
        </li>
        {branchName && (
          <li className="flex min-w-0 items-center gap-1.5" aria-current="page">
            {separator}
            <span className="truncate text-ink-2">{branchName}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}

/**
 * The branch, said the way the shops list says it — its picture (its own, or
 * the shop's), its name and address, whether a customer could order there now
 * — with the switch that stops it trading, the way to its siblings, and the
 * rarer actions under ⋯.
 */
function BranchHeader({
  storeId,
  store,
  branch,
  siblings,
  tab,
}: {
  storeId: string;
  store: Store | null;
  branch: Branch;
  siblings: Branch[];
  tab: TabKey;
}) {
  const router = useRouter();
  const guarded = useGuardedAction();
  const hours = useBranchHours(branch.id);
  const archive = useArchiveBranch(storeId);
  const [closing, setClosing] = useState(false);

  const name = pickLocalized(branch.name);
  const address = branch.address ? pickLocalized(branch.address) : "";
  const shopName = store ? pickLocalized(store.name) : "";
  const others = siblings.filter((one) => one.id !== branch.id);
  const last = siblings.length <= 1;
  const tabQuery = tab === "menu" ? "" : `?tab=${tab}`;

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 items-start gap-4">
        <Thumb
          src={branch.imageUrl ?? store?.imageUrl ?? null}
          size={56}
          alt=""
          className={cx(
            "rounded-lg",
            !branch.isActive && "opacity-60 grayscale",
          )}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">
              {name}
            </h1>
            {!branch.isActive && (
              <Badge tone="neutral" dot>
                {t("branches.notTrading")}
              </Badge>
            )}
            {branch.currencyCode && (
              <Badge tone="info">{branch.currencyCode}</Badge>
            )}
          </div>
          <p className="text-[13px] text-ink-3">
            {[shopName ? t("branches.ofShop", { shop: shopName }) : "", address]
              .filter(Boolean)
              .join(", ")}
          </p>
          <BranchStatusLine
            branch={branch}
            shopActive={store?.isActive ?? true}
            week={hours.data}
            className="text-[13px]"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {others.length > 0 && (
          <Menu
            label={t("branches.switchBranchLabel", { shop: shopName })}
            trigger={
              <Button variant="secondary">
                {t("branches.switchBranch", { count: others.length })}
                <ChevronDown />
              </Button>
            }
            // Name and address: on a chain the address is what tells two
            // branches apart.
            items={others.map((one) => ({
              label: (
                <BranchLabel
                  branch={one}
                  className="max-w-72"
                  aside={
                    one.isActive ? undefined : (
                      <Badge tone="neutral">{t("branches.notTrading")}</Badge>
                    )
                  }
                />
              ),
              onSelect: guarded(() =>
                router.push(`/shops/${storeId}/branches/${one.id}${tabQuery}`),
              ),
            }))}
          />
        )}
        <BranchLiveToggle storeId={storeId} branch={branch} />
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
              label: last
                ? t("branches.lastOneHint")
                : t("branches.closeConfirm"),
              icon: <DoorClosed />,
              tone: "danger",
              disabled: last,
              onSelect: () => setClosing(true),
            },
          ]}
        />
      </div>

      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={t("branches.closeTitle", { name })}
        description={t("branches.closeBody")}
        confirmLabel={t("branches.closeConfirm")}
        tone="danger"
        onConfirm={async () => {
          try {
            await archive.mutateAsync({
              id: branch.id,
              name,
              live: siblings.length,
            });
            router.push(`/shops/${storeId}?tab=branches`);
          } catch {
            // Reported by the hook's toast — including the last-branch refusal.
          }
        }}
      />
    </header>
  );
}
