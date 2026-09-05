"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cx } from "@/components/ui";
import { SectionTab, tabArrowHandler } from "@/components/ui/tab";
import { useConfirmLeave } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";

import { CatalogueArchive } from "./catalogue-archive";
import { CategoriesList } from "./categories-list";
import { PromotionsList } from "./promotions-list";
import { StoresList } from "./stores-list";
import { TagsList } from "./tags-list";

/**
 * The catalogue: the shops, and the categories they sit in.
 *
 * ## Two tabs rather than two rail entries
 *
 * The rail is six items and should stay six — it is glanced at all day and
 * every addition costs a little of the queue's prominence. Categories are also
 * not a peer of Orders or Pricing: they are the shelf the shops sit on, visited
 * on the same errand, and a merchant adding a category is nearly always about
 * to add a shop to it.
 *
 * Shops lead because that is what the catalogue is for. Categories change a
 * handful of times a year, and promotions are the third thing the home screen
 * is made of — a card, a tile, a shop — so all three belong on one errand.
 *
 * Tags joined them last, and belong here for the same reason categories do:
 * a tag is a property of the catalogue as a whole rather than of one shop, so
 * it has no home on a shop's own screen. It is edited on the same errand as
 * everything else that is true across every menu at once.
 *
 * ## The tab lives in the URL
 *
 * `?tab=categories`, so the view can be linked and reloaded — the same rule the
 * store screen's tabs follow. `replace` rather than `push`, because switching
 * tabs is not a journey: Back should leave the catalogue, not walk through the
 * tabs somebody looked at on the way.
 */

const TABS = [
  { key: "shops", labelKey: "catalogue.stores" },
  { key: "categories", labelKey: "categories.tab" },
  { key: "promotions", labelKey: "promotions.tab" },
  { key: "tags", labelKey: "tags.tab" },
  // Last, like the shop page's. It is where you go to undo something rather
  // than part of building the catalogue up, and the tab order should read as
  // the order the work is done in.
  { key: "archive", labelKey: "archive.tab" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function CatalogueScreen() {
  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("tab");
  const tab: TabKey = TABS.some((one) => one.key === requested)
    ? (requested as TabKey)
    : "shops";

  /**
   * Switching tabs unmounts whatever is in the current one, so it is a way out
   * of a form even though the URL barely moves. Guarded here rather than on
   * each tab button: there is one `show`.
   */
  function show(next: TabKey) {
    void confirmLeave().then((leave) => {
      if (!leave) return;
      const query = new URLSearchParams(params);
      if (next === "shops") query.delete("tab");
      else query.set("tab", next);
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 flex-col gap-sm border-b border-border bg-surface px-xxl pt-lg">
        <h1 className="text-[24px]">{t("catalogue.title")}</h1>

        {/*
          `SectionTab`, not a hand-rolled button.

          These are the *chapters* of the catalogue rather than buckets of a
          list, which is the distinction `tab.tsx` draws — and drawing them here
          meant this strip and the store screen's were two copies of the same
          twenty lines, free to drift in size. They had, by two pixels.
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

      {/* Siblings rather than one swapped child, so the shop list's search and
          scroll position survive a look at the categories and back. `hidden`
          rather than unmounting: remounting would refetch, lose the operator's
          place, and flash a skeleton at somebody returning to a screen they
          were just on. */}
      <div className={cx("min-h-0 flex-1", tab !== "shops" && "hidden")}>
        <StoresList />
      </div>
      <div className={cx("min-h-0 flex-1", tab !== "categories" && "hidden")}>
        <CategoriesList />
      </div>
      <div className={cx("min-h-0 flex-1", tab !== "promotions" && "hidden")}>
        <PromotionsList />
      </div>
      <div className={cx("min-h-0 flex-1", tab !== "tags" && "hidden")}>
        <TagsList />
      </div>
      {/* Mounted only while it is open, unlike its siblings. They stay mounted
          to keep a search term and a scroll position across a tab switch; this
          one has neither, and its four queries would otherwise run on every
          visit to the catalogue to answer a question nobody asked. */}
      {tab === "archive" && (
        <div className="min-h-0 flex-1">
          <CatalogueArchive />
        </div>
      )}
    </div>
  );
}
