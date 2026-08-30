"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cx } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import { StoreDetails } from "./store-details";
import { StoreHours } from "./store-hours";
import { StoreMenu } from "./store-menu";
import { useStore } from "./use-stores";

/**
 * One shop: its menu, and its own settings.
 *
 * ## Tabs, and why the menu is the first one
 *
 * The flow study's answer for a store was a short wizard to create and a tabbed
 * page to edit, because a shop is created a handful of times ever and then
 * visited for years to change one thing. The tabs are what that page is.
 *
 * The menu leads because it is what an operator comes to a shop *for* — prices
 * change weekly, a dish comes off, a photograph is wrong. The settings are a
 * place you go deliberately, perhaps twice a year.
 *
 * ## The tab lives in the URL
 *
 * `?tab=details` rather than component state, so the view can be linked,
 * reloaded and sent to somebody — the same rule every filter on the queue
 * follows. `replace` rather than `push`, because switching tabs is not a
 * journey: Back should leave the shop, not walk through the tabs the operator
 * looked at on the way.
 */

const TABS = [
  { key: "menu", labelKey: "menu.title" },
  { key: "details", labelKey: "store.tab" },
  { key: "hours", labelKey: "hours.tab" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function StoreScreen({ storeId }: { storeId: string }) {
  const store = useStore(storeId);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("tab");
  const tab: TabKey = TABS.some((one) => one.key === requested)
    ? (requested as TabKey)
    : "menu";

  function show(next: TabKey) {
    const query = new URLSearchParams(params);
    if (next === "menu") query.delete("tab");
    else query.set("tab", next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 flex-col gap-xs border-b border-border bg-surface px-xxl pt-lg">
        <Link
          href="/catalogue"
          className="flex w-fit items-center gap-xs text-[13px] font-semibold text-primary hover:underline"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {t("menu.back")}
        </Link>

        <h1 className="text-[24px]">
          {store.data ? pickLocalized(store.data.name) : ""}
        </h1>

        {/*
          `tablist` with real tabs, not links styled as tabs. The distinction is
          the keyboard: a tab list is arrowed through, and only the selected tab
          is in the tab order — which is what stops a two-tab strip costing two
          stops on the way to the content every time.
        */}
        <div role="tablist" className="-mb-px flex gap-lg">
          {TABS.map(({ key, labelKey }) => {
            const selected = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => show(key)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                    return;
                  }
                  event.preventDefault();
                  const at = TABS.findIndex((one) => one.key === tab);
                  const step = event.key === "ArrowRight" ? 1 : -1;
                  show(TABS[(at + step + TABS.length) % TABS.length].key);
                }}
                className={cx(
                  "border-b-2 pb-sm text-[14px] font-semibold",
                  selected
                    ? "border-active text-text"
                    : "border-transparent text-text-soft hover:text-text",
                )}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* The panes are siblings rather than one swapped child, so the menu's
          scroll position and its open panel survive a look at the settings and
          back. `hidden` rather than unmounting: remounting would refetch, lose
          the operator's place, and flash a skeleton at somebody returning to a
          screen they were just on. */}
      <div className={cx("min-h-0 flex-1", tab !== "menu" && "hidden")}>
        <StoreMenu storeId={storeId} />
      </div>
      <div className={cx("min-h-0 flex-1", tab !== "details" && "hidden")}>
        <StoreDetails storeId={storeId} />
      </div>
      <div className={cx("min-h-0 flex-1", tab !== "hours" && "hidden")}>
        <StoreHours storeId={storeId} />
      </div>
    </div>
  );
}
