"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button, cx } from "@/components/ui";
import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { ListHeader } from "@/components/ui/list-header";
import { ROW, ROW_ABOVE, ROW_TARGET } from "@/components/ui/row";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { useRowFocus } from "@/components/ui/row-focus";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { formatDate } from "@/lib/time";

import { separatePrice, type Bundle } from "./api/bundles";
import {
  useArchiveBundle,
  useBundles,
  useReorderBundles,
  useToggleBundle,
} from "./use-bundles";

/**
 * The bundles — several of a shop's dishes at one price (`0204`).
 *
 * Every shop's on one list, as the promotions are: a bundle is campaign work,
 * done on the same errand as the promotion and the picture that announce it.
 * Each row names its shop, what is in it and both prices, so the saving is
 * on the screen rather than in the operator's head.
 *
 * Dragging sets the order the app lists a shop's bundles in.
 */
export function BundlesList({ storeId }: { storeId?: string } = {}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  /**
   * On a shop's own screen, that shop's bundles: new ones start on it, and
   * the editor comes back here rather than to the catalogue.
   */
  const bundles = useBundles(searching ? search : "", storeId);
  const fromShop = storeId ? `?store=${storeId}` : "";
  const toggle = useToggleBundle();
  const archive = useArchiveBundle();
  const reorder = useReorderBundles();
  const focus = useRowFocus();

  const rows = bundles.data ?? [];

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const next = ids.flatMap((id, index) => {
        const row = rows.find((one) => one.id === id);
        return row ? [{ ...row, sortOrder: index }] : [];
      });
      const updates = next.flatMap((row) => {
        const before = rows.find((one) => one.id === row.id);
        return before?.sortOrder === row.sortOrder
          ? []
          : [{ id: row.id, sortOrder: row.sortOrder }];
      });
      reorder.mutate({ updates, next, storeId });
    },
    labelOf: (id) =>
      pickLocalized(rows.find((row) => row.id === id)?.name ?? {}),
    disabled: searching,
  });

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <ListHeader
          title={t("bundles.tab")}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("bundles.search"),
          }}
          hint={order.sortable ? t("bundles.reorderHint") : undefined}
          action={
            <Button
              onClick={() => router.push(`/catalogue/bundles/new${fromShop}`)}
            >
              {t("bundles.add")}
            </Button>
          }
        />

        <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto scroll-hint p-lg md:p-xxl">
          <p className="ps-md pb-sm text-[13px] text-text-soft">
            {t("bundles.intro")}
          </p>
          {bundles.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1].map((row) => (
                <div key={row} className="h-[90px] rounded-lg bg-line-soft" />
              ))}
            </div>
          )}
          {bundles.isError && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {bundles.error instanceof Error
                ? bundles.error.message
                : t("common.somethingWentWrong")}
            </p>
          )}
          {order.instructions}
          {order
            .ordered(rows, (row) => row.id)
            .map((row) => (
              <Row
                key={row.id}
                bundle={row}
                open={focus.isFocused(row.id)}
                anchor={focus.attach(row.id)}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() =>
                  router.push(`/catalogue/bundles/${row.id}${fromShop}`)
                }
                showShop={!storeId}
                onToggleActive={() =>
                  toggle.mutate({ id: row.id, isActive: !row.isActive })
                }
                onArchive={async () => {
                  await archive.mutateAsync({
                    id: row.id,
                    name: pickLocalized(row.name),
                  });
                }}
              />
            ))}
          {!bundles.isPending && !searching && rows.length === 0 && (
            <EmptyState titleKey="bundles.none" mood="waiting" />
          )}
          {searching && rows.length === 0 && (
            <EmptyState
              titleKey="bundles.searchNone"
              params={{ term: search.trim() }}
              mood="lost"
            />
          )}
        </div>
      </div>
    </div>
  );
}

type ReorderProps = {
  rowProps: (
    id: string,
    className?: string,
  ) => { "data-reorder-id": string; className: string };
  handleProps: (id: string) => Record<string, unknown>;
};

function Row({
  bundle,
  open,
  anchor,
  rowProps,
  handleProps,
  onEdit,
  onToggleActive,
  onArchive,
  showShop,
}: {
  bundle: Bundle;
  /** Off on a shop's own tab, where every row is that shop's. */
  showShop: boolean;
  open: boolean;
  anchor: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onArchive: () => Promise<void>;
} & ReorderProps) {
  const { format } = useMoney();
  const name = pickLocalized(bundle.name);
  const separately = separatePrice(bundle.items);

  const row = rowProps(
    bundle.id,
    cx(
      ROW,
      "max-md:flex-wrap",
      !bundle.isActive && "border-transparent bg-neutral-fill/60 shadow-none",
      bundle.isActive && "border-transparent",
      bundle.isActive && open && "border-active",
    ),
  );

  return (
    <div {...row} ref={anchor}>
      <button {...handleProps(bundle.id)}>
        <GripIcon />
      </button>

      {bundle.imageUrl ? (
        <PreviewImage
          src={bundle.imageUrl}
          name={name}
          className={cx(ROW_ABOVE, "size-[46px] shrink-0 rounded-md")}
        />
      ) : (
        <ImagePlaceholder className="size-[46px] shrink-0 rounded-md" />
      )}

      <button
        type="button"
        onClick={onEdit}
        className={cx(
          ROW_TARGET,
          "flex min-w-0 flex-grow flex-col gap-xxs text-left max-md:basis-0",
        )}
      >
        <span className="truncate text-[15px] font-semibold">
          {name}
          {showShop && (
            <span className="font-normal text-text-faint">
              {" · "}
              {bundle.storeName}
            </span>
          )}
        </span>
        <span className="truncate text-[13px] text-text-soft">
          {describeContents(bundle)}
        </span>
        <span className="truncate text-[12px] text-text-faint">
          {t("bundles.priceLine", {
            price: format(bundle.price, bundle.currencyCode),
            separately: format(separately, bundle.currencyCode),
          })}
          {" · "}
          {describeWindow(bundle)}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-lg max-md:w-full max-md:justify-end">
        <ConfirmToggle
          on={bundle.isActive}
          onChange={onToggleActive}
          labelOn={t("bundles.live")}
          labelOff={t("bundles.hidden")}
          params={{ name }}
          whenTurningOn={{
            titleKey: "bundles.showTitle",
            bodyKey: "bundles.showBody",
            confirmKey: "bundles.showConfirm",
          }}
          whenTurningOff={{
            titleKey: "bundles.hideTitle",
            bodyKey: "bundles.hideBody",
            confirmKey: "bundles.hideConfirm",
          }}
          className={cx(ROW_ABOVE, "w-[104px]")}
        />

        <ConfirmButton
          className={ROW_ABOVE}
          onConfirm={onArchive}
          titleKey="bundles.archiveTitle"
          bodyKey="bundles.archiveBody"
          confirmKey="bundles.archiveConfirm"
          params={{ name }}
          variant="danger"
          triggerVariant="danger"
          size="sm"
        >
          {t("bundles.archive")}
        </ConfirmButton>
      </div>
    </div>
  );
}

/** "2× Burger, Fries, Soft drink" — the app's own wording. */
export function describeContents(bundle: Pick<Bundle, "items">): string {
  if (bundle.items.length === 0) return t("bundles.empty");
  return bundle.items
    .map((item) =>
      item.quantity > 1 ? `${item.quantity}× ${item.label}` : item.label,
    )
    .join(", ");
}

/** When it is on offer, and whether that is now — as the promotions list says it. */
function describeWindow(bundle: Bundle): string {
  const now = Date.now();
  const started =
    !bundle.startsAt || new Date(bundle.startsAt).getTime() <= now;
  const ended = Boolean(
    bundle.endsAt && new Date(bundle.endsAt).getTime() <= now,
  );

  if (bundle.isActive && ended) return t("bundles.ended");
  if (bundle.isActive && !started) {
    return t("bundles.startsOn", { when: formatDate(bundle.startsAt!) });
  }
  if (!bundle.startsAt && !bundle.endsAt) return t("bundles.always");
  if (bundle.startsAt && bundle.endsAt) {
    return t("bundles.between", {
      from: formatDate(bundle.startsAt),
      to: formatDate(bundle.endsAt),
    });
  }
  if (bundle.endsAt)
    return t("bundles.until", { to: formatDate(bundle.endsAt) });
  return t("bundles.from", { from: formatDate(bundle.startsAt!) });
}
