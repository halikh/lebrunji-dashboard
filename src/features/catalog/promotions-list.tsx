"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { Button, cx } from "@/components/ui";
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

import type { Promotion } from "./api/promotions";
import {
  useArchivePromotion,
  usePromotions,
  useReorderPromotions,
  useUpdatePromotion,
} from "./use-promotions";

/**
 * The promotions on the app's home screen — the card, and what it takes off.
 *
 * ## This screen used to manage artwork only, and said so
 *
 * It was labelled "banners" because `place_order` hardcoded a zero discount:
 * `kind`, `value` and the caps were columns nothing read, and putting a "20%
 * off" field on the screen would have offered a decision with no consequence.
 *
 * `0076` built the engine, so those fields now do what they say. The screen
 * gained them and lost the disclaimer.
 *
 * ## Dragging a row decides who wins
 *
 * `priority` is the app's display order *and* the engine's tiebreak: one
 * discount per order, lowest priority first, ties going to the larger amount.
 * So the drag handle on this list is the most consequential control on it —
 * more so than on the categories list, where the order only decides what is
 * seen first.
 *
 * ## A card can be on and invisible
 *
 * The app shows one only while it is switched on **and** inside its dates, so
 * "Live" on a promotion that ended last week is true and useless. The row says
 * which of those it is, because nothing else on the screen would.
 */
export function PromotionsList() {
  const router = useRouter();
  /**
   * The term, and the mode it puts the list in.
   *
   * Searching and reordering are different jobs and cannot both be on: a
   * position among matches is not a priority, so dragging while filtered would
   * write an order nobody chose — and here that order decides which promotion a
   * customer gets. The handles go away and the list says why.
   */
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const promotions = usePromotions(searching ? search : "");
  const update = useUpdatePromotion();
  const archive = useArchivePromotion();
  const reorder = useReorderPromotions();

  /** The row the panel is editing, or `"new"` while one is being added. */
  /** Which row to bring back into view — see `useRowFocus`. */
  const focus = useRowFocus();

  const rows = promotions.data ?? [];

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      // A position in this list *is* the priority — renumbered from zero, so
      // the stored order is always the order on screen.
      const next = ids.flatMap((id, index) => {
        const row = rows.find((one) => one.id === id);
        return row ? [{ ...row, priority: index }] : [];
      });
      const updates = next.flatMap((row) => {
        const before = rows.find((one) => one.id === row.id);
        return before?.priority === row.priority
          ? []
          : [{ id: row.id, priority: row.priority }];
      });
      reorder.mutate({ updates, next });
    },
    labelOf: (id) => rows.find((row) => row.id === id)?.slug ?? "",
    disabled: searching,
  });

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        {/* The action is repeated here and at the end of the list: the end is
            where a new row appears, and the bar is what makes "add one"
            reachable without reading the list first. */}
        <ListHeader
          title={t("promotions.tab")}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("promotions.search"),
          }}
          // Gone when there is nothing to sort — see `sortable`.
          hint={order.sortable ? t("promotions.reorderHint") : undefined}
          action={
            <Button onClick={() => router.push("/catalogue/promotions/new")}>
              {t("promotions.add")}
            </Button>
          }
        />

        <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto scroll-hint p-xxl">
          <p className="ps-md pb-sm text-[13px] text-text-soft">
            {t("promotions.searchHint")}
          </p>
          {promotions.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="h-[90px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}
          {promotions.isError && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {promotions.error instanceof Error
                ? promotions.error.message
                : t("common.somethingWentWrong")}
            </p>
          )}
          {order.instructions}
          {order
            .ordered(rows, (row) => row.id)
            .map((row) => (
              <Row
                key={row.id}
                promotion={row}
                open={focus.isFocused(row.id)}
                anchor={focus.attach(row.id)}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() => router.push(`/catalogue/promotions/${row.id}`)}
                onToggleActive={() => {
                  update.mutate({
                    id: row.id,
                    patch: { isActive: !row.isActive },
                  });
                }}
                onArchive={async () => {
                  await archive.mutateAsync({ id: row.id, name: row.slug });
                }}
              />
            ))}
          {searching && rows.length === 0 && (
            <EmptyState
              titleKey="promotions.searchNone"
              params={{ term: search.trim() }}
              mood="lost"
            />
          )}
          {/* Where a new promotion actually goes: the end of the list, which is
              also the lowest priority. The pinned bar below is a shortcut to
              this one, and only exists while this one is out of sight. */}{" "}
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
  promotion,
  open,
  anchor,
  rowProps,
  handleProps,
  onEdit,
  onToggleActive,
  onArchive,
}: {
  promotion: Promotion;
  /** Whether this is the row just returned from. Draws the ring. */
  open: boolean;
  /** Scrolls this row back into view when it is the one returned to. */
  anchor: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onArchive: () => Promise<void>;
} & ReorderProps) {
  const { format, baseCode } = useMoney();
  // The currency a stated amount is written in. `0080` made this a column the
  // database enforces, so it is read rather than assumed to be the first row.
  const code = baseCode;

  const row = rowProps(
    promotion.id,
    cx(
      ROW,
      !promotion.isActive && "border-danger-wash bg-danger-wash/30",
      promotion.isActive && "border-border",
      promotion.isActive && open && "border-active",
    ),
  );

  return (
    <div {...row} ref={anchor}>
      <button {...handleProps(promotion.id)}>
        <GripIcon />
      </button>

      {/* Wide, because that is the shape it is on the home screen and the
          picture is the whole content — a thumbnail would show the middle of a
          card and tell nobody whether it reads. */}
      {pickLocalized(promotion.imageUrl ?? {}) ? (
        // The one picture in the dashboard the operator is really judging
        // rather than recognising: artwork that does not read is the whole
        // failure mode of a promotion, and 128 by 64 is not enough to tell.
        //
        // One language's card on the row — the operator's own — because a row
        // is for recognising the promotion. Both are in the editor, which is
        // where they are being judged.
        <PreviewImage
          src={pickLocalized(promotion.imageUrl ?? {})}
          name={promotion.slug}
          className={cx(
            "h-[64px] w-[128px] rounded-md",
            !promotion.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <ImagePlaceholder className="flex h-[64px] w-[128px] items-center justify-center rounded-md text-[11px] text-text-faint">
          {t("promotions.noArtwork")}
        </ImagePlaceholder>
      )}

      <button
        type="button"
        onClick={onEdit}
        // `ROW_TARGET` stretches this button's hit area over the whole row —
        // see `row.ts`. The row's own controls carry `ROW_ABOVE`.
        className={cx(
          ROW_TARGET,
          "flex min-w-0 flex-grow flex-col gap-xxs text-left",
        )}
      >
        <span className="truncate text-[15px] font-semibold">
          {promotion.slug}
        </span>
        {/* What it actually does, first — the slug is a filename and says
            nothing about the money. */}
        <span className="truncate text-[13px] text-text-soft">
          {describeDiscount(promotion, format, code)}
        </span>
        <span className="truncate text-[12px] text-text-faint">
          {describeWindow(promotion)}
        </span>
      </button>

      {/* The count is the only thing on the screen that says whether it is
          working. A cap means nothing without it, and a promotion nobody has
          redeemed is usually one whose scope or minimum is wrong. */}
      <span className="shrink-0 tabular-nums text-[12px] text-text-faint">
        {promotion.maxRedemptionsTotal
          ? t("promotions.redeemedOf", {
              count: promotion.redeemed,
              cap: promotion.maxRedemptionsTotal,
            })
          : t("promotions.redeemed", { count: promotion.redeemed })}
      </span>

      <ConfirmToggle
        on={promotion.isActive}
        onChange={onToggleActive}
        labelOn={t("promotions.live")}
        labelOff={t("promotions.hidden")}
        params={{ name: promotion.slug }}
        whenTurningOn={{
          titleKey: "promotions.showTitle",
          bodyKey: "promotions.showBody",
          confirmKey: "promotions.showConfirm",
        }}
        whenTurningOff={{
          titleKey: "promotions.hideTitle",
          bodyKey: "promotions.hideBody",
          confirmKey: "promotions.hideConfirm",
        }}
        className={cx(ROW_ABOVE, "w-[104px]")}
      />

      <ConfirmButton
        className={ROW_ABOVE}
        onConfirm={onArchive}
        titleKey="promotions.archiveTitle"
        bodyKey="promotions.archiveBody"
        confirmKey="promotions.archiveConfirm"
        params={{ name: promotion.slug }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("promotions.archive")}
      </ConfirmButton>
    </div>
  );
}

/** "20% off · over $25 · first order" — what the promotion does, in one line. */
function describeDiscount(
  promotion: Promotion,
  format: (minorUnits: number, code: string) => string,
  code: string,
): string {
  const amount =
    promotion.kind === "percentage"
      ? t("promotions.summaryPercent", { value: promotion.value })
      : promotion.kind === "fixedAmount"
        ? t("promotions.summaryFixed", {
            amount: format(promotion.value, code),
          })
        : t("promotions.summaryFreeDelivery");

  const parts = [amount];
  if (promotion.minSubtotal) {
    parts.push(
      t("promotions.summaryOver", {
        amount: format(promotion.minSubtotal, code),
      }),
    );
  }
  if (promotion.isFirstOrderOnly) parts.push(t("promotions.summaryFirstOrder"));
  if (promotion.scopes.length > 0) {
    parts.push(
      t("promotions.summaryScoped", { count: promotion.scopes.length }),
    );
  }

  return parts.join(" · ");
}

/**
 * The window, in words, and whether it is live *now*.
 *
 * The app shows a card only while it is switched on **and** inside its dates, so
 * a promotion can be on and invisible. That is the state worth naming: an
 * operator looking at a switch reading "Live" on one that ended last week has no
 * other way to find out.
 */
function describeWindow(promotion: Promotion): string {
  const now = Date.now();
  const started =
    !promotion.startsAt || new Date(promotion.startsAt).getTime() <= now;
  const ended = Boolean(
    promotion.endsAt && new Date(promotion.endsAt).getTime() < now,
  );

  if (promotion.isActive && ended) return t("promotions.ended");
  if (promotion.isActive && !started) {
    return t("promotions.startsOn", { when: formatDate(promotion.startsAt!) });
  }

  if (!promotion.startsAt && !promotion.endsAt) return t("promotions.always");
  if (promotion.startsAt && promotion.endsAt) {
    return t("promotions.between", {
      from: formatDate(promotion.startsAt),
      to: formatDate(promotion.endsAt),
    });
  }
  if (promotion.endsAt) {
    return t("promotions.until", { to: formatDate(promotion.endsAt) });
  }
  return t("promotions.from", { from: formatDate(promotion.startsAt!) });
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------
