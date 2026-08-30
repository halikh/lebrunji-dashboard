"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cx } from "@/components/ui";
import { t } from "@/i18n/translations";

import { CategoriesList } from "./categories-list";
import { StoresList } from "./stores-list";

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
 * handful of times a year.
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
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function CatalogueScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("tab");
  const tab: TabKey = requested === "categories" ? "categories" : "shops";

  function show(next: TabKey) {
    const query = new URLSearchParams(params);
    if (next === "shops") query.delete("tab");
    else query.set("tab", next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 flex-col gap-sm border-b border-border bg-surface px-xxl pt-lg">
        <h1 className="text-[24px]">{t("catalogue.title")}</h1>

        {/*
          A real tab list, not links styled as tabs. The distinction is the
          keyboard: a tab list is arrowed through, and only the selected tab is
          in the tab order — which is what stops a two-tab strip costing two
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
    </div>
  );
}
