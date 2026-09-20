"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useConfirmLeave } from "@/components/unsaved-changes";

import { cx } from "@/components/ui";
import { SectionTab, tabArrowHandler } from "@/components/ui/tab";
import { BackLink } from "@/components/ui/back-link";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import { BranchesTab } from "./branches-tab";
import { StoreFacts, StoreThumb } from "./store-identity";
import { StoreArchive } from "./store-archive";
import { StoreDetails } from "./store-details";
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
  /**
   * The shop itself — its name, its picture, what it prices in.
   *
   * This tab was removed once. `0101` moved the pin, the prep window, the
   * WhatsApp number and the hours onto the branch that owns them, which left
   * Details holding three fields beside a Branches tab carrying everything else
   * about the same shop — so the three were folded into the branch editor under
   * a heading reading "The shop".
   *
   * That was wrong in a way a heading cannot fix. The branch editor is a form
   * over one branch's row, and the picture uploader in it writes to that row;
   * an operator changing the shop's photograph there changed one place's and
   * left the shop's alone. Two records behind one Save, told apart by a
   * subheading.
   *
   * So it is a tab again, and the branch editor is only about a branch. See
   * `store-details.tsx`.
   */
  { key: "details", labelKey: "store.detailsTab" },
  /** The places the shop trades from. */
  { key: "branches", labelKey: "branches.tab" },
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
   * Which tabs have been opened on this visit.
   *
   * ## The two things this reconciles
   *
   * The panes used to be siblings, all mounted, with the inactive ones hidden
   * — which kept the menu's scroll position across a look at the settings and
   * back, and paid for it by running **every** tab's queries on arrival. A shop
   * page opened on the menu fetched the menu, the questions and the opening
   * hours, of which two were for tabs nobody had pressed.
   *
   * Mounting on each visit instead would have fixed that and given back the
   * problem the siblings were solving: a remount refetches, loses the
   * operator's place, and flashes a skeleton at somebody returning to a screen
   * they were just on.
   *
   * A tab is mounted the first time it is opened and stays mounted after — so
   * nothing is fetched until it is asked for, and nothing is thrown away once
   * it has been. Only the first visit to a tab costs a wait, which is the visit
   * that was always going to.
   *
   * `Archive` and `Branches` are still mounted only while open, and keep their
   * own reasons for it below.
   */
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set([tab]));

  // Adjusted during render rather than in an effect — React's own pattern for
  // state that follows a prop, and the one the compiler's
  // `set-state-in-effect` rule exists to push code towards. An effect would
  // render the new tab empty once and then again with its pane, which is a
  // visible flash of nothing on every first visit to a tab.
  //
  // A new Set rather than a mutation, because the re-render is keyed on the
  // reference; the guard is what stops it looping.
  if (!visited.has(tab)) setVisited(new Set(visited).add(tab));

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
        {/* `gap-md`, not `gap-xs`. The header used to be three single lines and
            is now a button, a two-line identity block and the tabs — at the
            old spacing they touched. */}
        <div className="flex shrink-0 flex-col gap-md border-b border-border bg-surface px-xxl pt-lg">
          <BackLink href="/catalogue">{t("menu.back")}</BackLink>

          {/*
            The shop, said the way the shops list says it.

            The header used to be the name alone, which meant the two facts an
            operator checks first — is this the right shop, and is this the
            right *branch* of a name that repeats — were on the list they had
            just left and nowhere on the page they had arrived at. The picture
            and the category line are what that list shows, so the row and the
            page are recognisably the same object.

            The prep window comes with the category because it is on that same
            line in the list. It is the shop's own default; a branch may differ,
            and the Branches tab is where that shows.

            Both halves live in `store-identity` now, because the pages *under*
            this one — a branch, a branch's menu — had the same hole and no
            answer to it. This is still where the answer was worked out.
          */}
          <div className="flex items-center gap-lg">
            {store.data && (
              <StoreThumb
                store={store.data}
                className="size-[52px] rounded-md"
              />
            )}

            <div className="flex min-w-0 flex-col gap-xxs">
              <h1 className="truncate text-[24px]">
                {store.data ? pickLocalized(store.data.name) : ""}
              </h1>
              {store.data && <StoreFacts store={store.data} />}
            </div>
          </div>

          {/*
            `tablist` with real tabs, not links styled as tabs. The distinction is
            the keyboard: a tab list is arrowed through, and only the selected tab
            is in the tab order — which is what stops a two-tab strip costing two
            stops on the way to the content every time.
          */}
          <div role="tablist" className="-mb-px flex gap-lg">
            {TABS.map(({ key, labelKey }) => (
              <SectionTab
                key={key}
                label={t(labelKey)}
                active={tab === key}
                onClick={() => show(key)}
                onKeyDown={tabArrowHandler(
                  TABS.map((one) => one.key),
                  tab,
                  show,
                )}
              />
            ))}
          </div>
        </div>

        {/* The panes are siblings rather than one swapped child, so the menu's
            scroll position survives a look at the settings and back — and each
            one waits to exist until it has been opened. See `visited`. */}
        <Pane show={tab === "menu"} mounted={visited.has("menu")}>
          <StoreMenu storeId={storeId} />
        </Pane>
        <Pane show={tab === "details"} mounted={visited.has("details")}>
          <StoreDetails storeId={storeId} />
        </Pane>
        {/* Mounted only when open, like Archive: it has no scroll position
            worth preserving, and its query would otherwise run on every visit
            to every shop. */}
        {tab === "branches" && (
          <div className="min-h-0 flex-1">
            <BranchesTab storeId={storeId} />
          </div>
        )}
        <Pane show={tab === "options"} mounted={visited.has("options")}>
          <StoreOptions storeId={storeId} />
        </Pane>
        <Pane show={tab === "hours"} mounted={visited.has("hours")}>
          <StoreHours storeId={storeId} />
        </Pane>
        {/* Mounted only when it is open, unlike its siblings. They stay mounted
            to keep a scroll position across a tab switch; this one has none,
            and its query would otherwise run on every visit to a shop to answer
            a question nobody asked. */}
        {tab === "archive" && (
          <div className="min-h-0 flex-1">
            <StoreArchive storeId={storeId} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One tab's pane: absent until it has been opened, hidden after.
 *
 * The two states are genuinely different and the distinction is the point.
 * **Not mounted** is a tab that has never been asked for, and it costs nothing
 * — no query, no render. **Hidden** is a tab that has been read and left, and
 * it keeps everything: its rows, its scroll position, and the queries already
 * answered.
 *
 * `hidden` as a class rather than the attribute, because the pane is a flex
 * child and `display: none` is what has to win — which is what Tailwind's
 * `hidden` sets, in the same place the surrounding classes are set.
 */
function Pane({
  show,
  mounted,
  children,
}: {
  show: boolean;
  /** Whether this tab has ever been opened — see `visited`. */
  mounted: boolean;
  children: ReactNode;
}) {
  if (!mounted) return null;

  return (
    <div className={cx("min-h-0 flex-1", !show && "hidden")}>{children}</div>
  );
}
