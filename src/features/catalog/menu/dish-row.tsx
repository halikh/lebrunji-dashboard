"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CopyPlus, MoreHorizontal, Pencil } from "lucide-react";
import { useState, type HTMLAttributes, type ReactNode } from "react";

import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Menu,
  Popover,
  Thumb,
  cx,
  type MenuItem as MenuAction,
} from "@/components/ui";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { useGuardedAction } from "@/components/unsaved-changes";
import { MoneyInput } from "@/components/ui/money-input";
import { GripIcon } from "@/components/ui/reorderable";
import { Price } from "@/features/reference/price";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { validatePrice } from "@/lib/validation";

import type { MenuItem } from "../api/menu";
import type { useArchiveMenuItem, useUpdateMenuItem } from "../use-menu";
import {
  ItemTags,
  PerUnit,
  dishHref,
  duplicateDishHref,
  unitSize,
} from "./shared";

/** What a reorderable list hands each of its rows. */
export type RowOrder = {
  rowProps: (
    id: string,
    className?: string,
  ) => { "data-reorder-id": string; className: string };
  handleProps: (id: string) => HTMLAttributes<HTMLButtonElement>;
  sortable: boolean;
  carried: boolean;
};

/**
 * One dish on the Menu tab.
 *
 * ## The two jobs done from the row
 *
 * Changing a price and taking a dish off are what the menu is opened for most
 * days, so both are one click from the list: the price is a button that opens
 * a small editor in place, and availability is the switch beside it. Everything
 * else — names, pictures, units, tags — is the dish's own page, reached by
 * clicking the row.
 *
 * Always the shop's: what one branch charges and serves is on that branch's
 * own Menu tab (`shops/branch-menu.tsx`).
 *
 * ## The row is a link
 *
 * The name is the link and its hit area is stretched over the row, so a click
 * anywhere that is not a control opens the dish. The controls sit above that
 * area (`relative z-[1]`) so pressing them never navigates.
 */
export function DishRow({
  item,
  storeId,
  code,
  shopRate,
  context,
  bundles,
  update,
  archive,
  order,
  focused,
  selection,
}: {
  item: MenuItem;
  storeId: string;
  /** The shop's currency — what `item.price` is in. */
  code: string;
  /** `stores.exchange_rate`, so the second figure is the shop's own. */
  shopRate: number | null;
  /** A line naming where it sits — on a search result, where the list does not. */
  context?: string;
  /** The switched-on bundles it is in, which leave the app with it. */
  bundles: string[];
  update: ReturnType<typeof useUpdateMenuItem>;
  archive: ReturnType<typeof useArchiveMenuItem>;
  /** Absent on a search result: a position among matches is not a position. */
  order?: RowOrder;
  /** Just returned to from its own page. */
  focused?: boolean;
  /** Its tick for bulk edits, Square-style. */
  selection?: { checked: boolean; onChange: (checked: boolean) => void };
}) {
  const router = useRouter();
  const guarded = useGuardedAction();
  const name = pickLocalized(item.name);
  const [asking, setAsking] = useState<null | "archive">(null);
  const [priceOpen, setPriceOpen] = useState(false);

  const muted = !item.isActive;
  const bundleList = bundles.join(", ");

  const detail = [unitSize(item), context ?? pickLocalized(item.description)]
    .filter(Boolean)
    .join(", ");

  const actions: MenuAction[] = [
    {
      label: t("menu.editDish"),
      icon: <Pencil />,
      onSelect: guarded(() => router.push(dishHref(storeId, item.id))),
    },
    {
      label: t("menu.duplicate"),
      icon: <CopyPlus />,
      onSelect: guarded(() =>
        router.push(duplicateDishHref(storeId, item.sectionId, item.id)),
      ),
    },
    {
      label: t("menu.changePrice"),
      icon: <Pencil />,
      onSelect: () => setPriceOpen(true),
    },
    "separator",
    {
      label: t("menu.archive"),
      icon: <Archive />,
      tone: "danger",
      onSelect: () => setAsking("archive"),
    },
  ];

  const row = order?.rowProps(
    item.id,
    cx(
      "group relative flex flex-wrap items-center gap-x-3 gap-y-2 bg-surface px-4 py-3 transition-colors hover:bg-subtle sm:flex-nowrap",
      focused && "bg-accent-soft/50 hover:bg-accent-soft/60",
      selection?.checked && "bg-accent-soft/30",
    ),
  ) ?? {
    className: cx(
      "group relative flex flex-wrap items-center gap-x-3 gap-y-2 bg-surface px-4 py-3 transition-colors hover:bg-subtle sm:flex-nowrap",
    ),
  };

  return (
    <li {...row} data-dish-id={item.id}>
      {selection && (
        <span className="relative z-[1] flex shrink-0 items-center">
          <Checkbox
            checked={selection.checked}
            onCheckedChange={selection.onChange}
            label={
              <span className="sr-only">{t("menu.selectDish", { name })}</span>
            }
          />
        </span>
      )}
      {order?.sortable && (
        <button
          type="button"
          {...order.handleProps(item.id)}
          className="relative z-[1] -ms-1 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink-2 active:cursor-grabbing"
        >
          <GripIcon />
        </button>
      )}

      <Thumb
        src={item.imageUrl}
        size={44}
        alt=""
        className={cx(muted && "opacity-50 grayscale")}
      />

      <div className="flex min-w-0 flex-1 basis-[calc(100%-120px)] flex-col gap-0.5 sm:basis-auto">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={dishHref(storeId, item.id)}
            className={cx(
              "truncate text-[14px] font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-accent",
              muted ? "text-ink-3" : "text-ink",
            )}
          >
            {name}
          </Link>
          {!item.isActive && <Badge>{t("menu.hidden")}</Badge>}
        </div>
        {detail && (
          <p className="truncate text-[12.5px] text-ink-3">{detail}</p>
        )}
        <ItemTags ids={item.tagIds} />
      </div>

      {/* Price, then availability, then the rest. */}
      <div
        className={cx(
          "relative z-[1] flex shrink-0 items-center gap-3 max-sm:w-full max-sm:justify-between sm:gap-4",
          selection ? "max-sm:ms-[84px]" : "max-sm:ms-[56px]",
        )}
      >
        <QuickPrice
          item={item}
          name={name}
          code={code}
          shopRate={shopRate}
          open={priceOpen}
          onOpenChange={setPriceOpen}
          update={update}
        />

        <div className="flex items-center gap-1">
          <ConfirmToggle
            on={item.isActive}
            // Optimistic in the hook, so the dialog closes on the new state
            // and a refusal flips it back with a toast.
            onChange={() =>
              update.mutate({
                id: item.id,
                patch: { isActive: !item.isActive },
              })
            }
            labelOn={t("menu.live")}
            labelOff={t("menu.hidden")}
            params={{ name, bundles: bundleList }}
            whenTurningOn={{
              titleKey: "menu.showTitle",
              bodyKey: "menu.showBody",
              confirmKey: "menu.showConfirm",
            }}
            whenTurningOff={{
              titleKey: "menu.hideTitle",
              bodyKey:
                bundles.length > 0 ? "menu.hideInBundlesBody" : "menu.hideBody",
              confirmKey: "menu.hideConfirm",
            }}
            className="w-[84px]"
          />

          <Menu
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("menu.dishMore", { name })}
              >
                <MoreHorizontal />
              </Button>
            }
            items={actions}
          />
        </div>
      </div>

      <ConfirmDialog
        open={asking === "archive"}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t("menu.archiveTitle")}
        description={t(
          bundles.length > 0 ? "menu.archiveInBundlesBody" : "menu.archiveBody",
          { name, bundles: bundleList },
        )}
        confirmLabel={t("menu.archiveConfirm")}
        tone="danger"
        onConfirm={() => archive.mutateAsync({ id: item.id, name: item.name })}
      />
    </li>
  );
}

/**
 * The price, as a button that opens a small editor in place.
 *
 * A popover rather than a field always on the row: a column of live inputs is
 * a column of numbers a scroll wheel or a stray keystroke can change, and the
 * row's job most of the time is to be read. One click opens it, Enter saves.
 */
function QuickPrice({
  item,
  name,
  code,
  shopRate,
  open,
  onOpenChange,
  update,
}: {
  item: MenuItem;
  name: string;
  code: string;
  shopRate: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  update: ReturnType<typeof useUpdateMenuItem>;
}) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      align="end"
      className="w-72"
      trigger={
        <button
          type="button"
          aria-label={`${t("menu.changePrice")} — ${name}`}
          className="flex min-w-[96px] flex-col items-end rounded-md px-2 py-1 text-end transition-colors hover:bg-hover focus-visible:bg-hover"
        >
          {code ? (
            <Price
              value={item.price}
              code={code}
              shopRate={shopRate}
              align="end"
              className="text-[14px] font-medium tabular-nums"
            />
          ) : null}
          <PerUnit item={item} code={code} />
        </button>
      }
    >
      {open && (
        <PriceEditor
          item={item}
          name={name}
          code={code}
          onDone={() => onOpenChange(false)}
          update={update}
        />
      )}
    </Popover>
  );
}

function PriceEditor({
  item,
  name,
  code,
  onDone,
  update,
}: {
  item: MenuItem;
  name: string;
  code: string;
  onDone: () => void;
  update: ReturnType<typeof useUpdateMenuItem>;
}) {
  const { decimalsOf } = useMoney();
  const [price, setPrice] = useState<number | null>(item.price);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const result = validatePrice(price ?? NaN);
    if (!result.ok) {
      setError(t(result.key, result.params));
      return;
    }
    if (price !== item.price) {
      // Optimistic in the hook: the row shows the new figure at once, and a
      // refusal puts the old one back with a toast saying why.
      update.mutate({ id: item.id, patch: { price: price as number } });
    }
    onDone();
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink">
          {t("menu.priceOf", { name })}
        </span>
        <MoneyInput
          value={price}
          onChange={(next) => {
            setPrice(next);
            setError(null);
          }}
          decimalDigits={decimalsOf(code)}
          aria-label={t("menu.priceOf", { name })}
          invalid={error !== null}
        />
        <p
          className={cx(
            "text-[12.5px]",
            error ? "text-danger-ink" : "text-ink-3",
          )}
        >
          {error ?? t("menu.priceFieldHint")}
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onDone}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" size="sm">
          {t("menu.savePrice")}
        </Button>
      </div>
    </form>
  );
}

/** Rows' wrapper, so a section's dishes are one list for assistive tech. */
export function DishList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line">{children}</ul>;
}
