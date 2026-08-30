"use client";

import Link from "next/link";

import { Toggle } from "@/components/ui/toggle";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import { OwnGroups } from "./item-own-options";
import { useItemGroups, useOptionGroups, useSetItemGroup } from "./use-options";

/**
 * Which questions this dish asks.
 *
 * ## Switches only, deliberately
 *
 * The first version put the whole of option management in here — creating
 * groups, adding choices, setting prices, retiring them — inside a 420px side
 * panel that already holds two languages of name, two of description, a price,
 * an image and a switch. It did not fit, and more to the point it was the wrong
 * question. Editing a dish, the operator is answering *does this one offer
 * size?*, not deciding what sizes the shop sells.
 *
 * So the shared groups are a list of switches and nothing else. What those
 * groups *are* lives on the shop's Options tab, where there is room for a table
 * of prices, and the link below goes there rather than folding a second screen
 * into this column.
 *
 * ## The dish's own questions are the exception, and they belong here
 *
 * "How would you like the steak done?" is about the steak. Making it shop-wide
 * to ask it would leave the shop's list full of entries that are each about one
 * dish, so the list meant to show what is *shared* would stop being able to.
 * Those groups are created and edited here (migration 0073), because here is the
 * only place they are ever offered.
 *
 * ## Why it needs a saved dish
 *
 * A link is a row joining two ids, and an unsaved dish has none. The
 * alternatives are worse than the wait: holding the choices in memory and
 * writing them after the insert makes a save that can half-succeed, and
 * inserting the dish early to get an id puts a half-finished row on the menu of
 * a shop that is open.
 */
export function ItemOptions({
  storeId,
  itemId,
}: {
  storeId: string;
  /** Null while the dish is still being added. */
  itemId: string | null;
}) {
  const groups = useOptionGroups(storeId);
  const attached = useItemGroups(itemId);
  const link = useSetItemGroup(itemId ?? "");

  if (itemId === null) {
    return (
      <p className="rounded-md border border-dashed border-border px-lg py-md text-[13px] text-text-faint">
        {t("options.saveFirst")}
      </p>
    );
  }

  if (groups.isPending) {
    return <div aria-hidden className="h-[44px] rounded-md bg-neutral-fill" />;
  }

  /**
   * Failure says so, and says what failed.
   *
   * There was no branch here at all, so a refused query drew an empty list —
   * indistinguishable from a shop with no option groups. The operator would be
   * told "there are none" by a screen that had no idea, while the actual
   * message, which named a missing column and therefore a migration, lived only
   * in the network tab.
   */
  if (groups.isError) {
    return (
      <p role="alert" className="text-[13px] font-medium text-danger">
        {groups.error instanceof Error
          ? groups.error.message
          : t("common.somethingWentWrong")}
      </p>
    );
  }

  const linked = new Set(attached.data ?? []);

  return (
    <div className="flex flex-col gap-xxl">
      <OwnGroups storeId={storeId} itemId={itemId} />

      <section className="flex flex-col gap-sm">
        <div className="flex flex-col gap-xxs">
          <h3 className="ps-md text-[13px] font-semibold text-text-soft">
            {t("options.sharedTitle")}
          </h3>
          <p className="ps-md text-[12px] text-text-faint">
            {t("options.sharedHint")}
          </p>
        </div>

        {groups.data.length === 0 && (
          <p className="ps-md text-[13px] text-text-faint">
            {t("options.noneYet")}
          </p>
        )}

        {groups.data.map((group) => (
          <div
            key={group.id}
            className="flex items-center gap-md rounded-md border border-border bg-surface px-md py-sm"
          >
            <Toggle
              on={linked.has(group.id)}
              onChange={() =>
                link.mutate({
                  groupId: group.id,
                  attached: !linked.has(group.id),
                })
              }
              labelOn={t("options.offered")}
              labelOff={t("options.notOffered")}
              className="w-[104px]"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-semibold">
                {pickLocalized(group.title)}
              </span>
              {/* The rules in words. `single`/`multi` and a boolean are how the
                row is stored; "choose one, 3 choices" is the same fact in the
                form somebody can check against what the shop offers. */}
              <span className="truncate text-[12px] text-text-faint">
                {t(
                  group.mode === "single"
                    ? "options.chooseOne"
                    : "options.chooseAny",
                )}
                {" · "}
                {t("options.count", { count: group.options.length })}
              </span>
            </div>
          </div>
        ))}

        <Link
          href={`/catalogue/${storeId}?tab=options`}
          className="ps-md text-[12px] font-semibold text-primary hover:underline"
        >
          {t("options.manage")}
        </Link>
      </section>
    </div>
  );
}
