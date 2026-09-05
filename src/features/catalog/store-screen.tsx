"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useConfirmLeave } from "@/components/unsaved-changes";

import { cx } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import { StoreDetails } from "./store-details";
import { StoreArchive } from "./store-archive";
import { StoreHours } from "./store-hours";
import { StoreMenu } from "./store-menu";
import { StoreOptions } from "./store-options";
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
  // One tab, not two. It was Options (an item's questions) beside Common
  // options (a question's items) — the same rows read in opposite directions,
  // which meant repricing a choice happened on one screen and deciding who asks
  // about it on another. The selects are a filter now: nothing picked is the
  // shop's questions, an item picked is what the old Options tab showed.
  { key: "options", labelKey: "options.tab" },
  { key: "hours", labelKey: "hours.tab" },
  // Last. It is where you go to undo something, not part of setting a shop up,
  // and the tab order should read as the order the work is done in.
  { key: "archive", labelKey: "archive.tab" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function StoreScreen({ storeId }: { storeId: string }) {
  /**
   * Where the menu's panel is portalled to — see the slot at the bottom.
   *
   * State, not a ref: a ref does not re-render, so the first paint would have
   * a null target and the panel would never move. The callback fires when the
   * node is attached, and the panel is closed on that first render anyway.
   */
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null);
  const store = useStore(storeId);
  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("tab");
  const tab: TabKey = TABS.some((one) => one.key === requested)
    ? (requested as TabKey)
    : "menu";

  /**
   * Switching tabs unmounts whatever is in the current one, so it is a way out
   * of a form even though the URL barely moves. Guarded here rather than on each
   * tab button: there is one `show`, and there are five tabs.
   */
  function show(next: TabKey) {
    void confirmLeave().then((leave) => {
      if (!leave) return;
      const query = new URLSearchParams(params);
      if (next === "menu") query.delete("tab");
      else query.set("tab", next);
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    /*
      A row whose first child is the whole of the shop page — header, tabs and
      panes — and whose second is where the menu's detail panel lands.
     *
     * The panel used to be a sibling of the *list*, one level further in, so it
     * began under the shop's name and its tabs: a 420px column that started a
     * third of the way down the screen while the thing it was covering ran the
     * full height. Every other screen in the dashboard already opens its panel
     * beside its own header rather than beneath it, and this was the one that
     * did not.
     */
    <div className="relative flex h-full min-w-0">
      <div className="flex min-w-0 flex-grow flex-col">
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
                    if (
                      event.key !== "ArrowLeft" &&
                      event.key !== "ArrowRight"
                    ) {
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
            scroll position and its open panel survive a look at the settings
            and back. `hidden` rather than unmounting: remounting would refetch,
            lose the operator's place, and flash a skeleton at somebody
            returning to a screen they were just on. */}
        <div className={cx("min-h-0 flex-1", tab !== "menu" && "hidden")}>
          <StoreMenu storeId={storeId} panelSlot={panelSlot} />
        </div>
        <div className={cx("min-h-0 flex-1", tab !== "details" && "hidden")}>
          <StoreDetails storeId={storeId} />
        </div>
        <div className={cx("min-h-0 flex-1", tab !== "options" && "hidden")}>
          <StoreOptions storeId={storeId} />
        </div>
        <div className={cx("min-h-0 flex-1", tab !== "hours" && "hidden")}>
          <StoreHours storeId={storeId} />
        </div>
        {/* Mounted only when it is open, unlike its siblings. They stay mounted
            to keep a scroll position and an open panel across a tab switch;
            this one has neither, and its query would otherwise run on every
            visit to a shop to answer a question nobody asked. */}
        {tab === "archive" && (
          <div className="min-h-0 flex-1">
            <StoreArchive storeId={storeId} />
          </div>
        )}
      </div>

      {/*
        Where the menu's panel is rendered, by a portal from inside `StoreMenu`.

        A portal rather than lifting the panel's state up here. Everything it
        needs — which dish is open, the section being renamed, the save
        mutations, the counter that clears the form after "add another" — is
        `StoreMenu`'s, and hoisting a hundred lines of JSX and eight pieces of
        state to move a box up by the height of a header would be a large
        change to working code for a layout reason. The portal moves the DOM
        node and leaves the React tree alone.

        `display: contents` so the slot itself lays nothing out: the panel
        becomes a flex child of the row, which is what makes it a full-height
        column beside the page rather than a box inside it. On a phone the panel
        is `absolute inset-0` and now resolves against this row — so it covers
        the shop's header too, which is what a full-screen panel should do.
      */}
      <div ref={setPanelSlot} className="contents" />
    </div>
  );
}
