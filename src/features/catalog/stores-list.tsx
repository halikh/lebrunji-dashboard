"use client";

import Link from "next/link";
import { useState } from "react";

import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { cx } from "@/components/ui";
import { ListHeader } from "@/components/ui/list-header";
import { ROW } from "@/components/ui/row";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Button } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { Panel } from "@/components/ui/panel";
import { useGuardedAction } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";

import { NoPinWarning } from "./no-pin-warning";
import { StoreWizard } from "./store-wizard";

import type { Store } from "./api/stores";
import { useArchiveStore, useStores, useUpdateStore } from "./use-stores";

/**
 * The shops.
 *
 * Rare to create, edited occasionally, and read constantly — so this is a list
 * that shows *state* rather than a form. What an operator comes here to do is
 * almost always one of three things: take a shop off the storefront, put it
 * back, or notice that something is wrong with one.
 *
 * The third is why the pin warning is on the row rather than buried in a detail
 * page: a shop with no pin charges every customer the top delivery band, and
 * nothing else on the screen would ever say so.
 */
export function StoresList() {
  const [search, setSearch] = useState("");

  const stores = useStores(search);
  const update = useUpdateStore();
  const archive = useArchiveStore();

  const rows = stores.data?.stores ?? [];

  /**
   * Whether the add-a-shop wizard is open.
   *
   * Local state rather than the URL, unlike every filter here: a half-filled
   * wizard is not a view somebody should be able to link to or land back on
   * after a reload, because the state that made it meaningful is gone.
   */
  const [adding, setAdding] = useState(false);
  const guarded = useGuardedAction();

  return (
    // A row, not a column: the panel is a *sibling* of the list, which is what
    // makes it open beside it. Nested inside the column it becomes another
    // block in the stack and lands under the rows — the same shape the
    // categories, tags and promotions lists already use.
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <ListHeader
          title={t("catalogue.stores")}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("catalogue.searchPlaceholder"),
          }}
          action={
            <Button onClick={() => setAdding(true)}>{t("store.add")}</Button>
          }
        />

        <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
          {stores.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-[74px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}

          {stores.isError && (
            <div className="flex flex-col items-center gap-lg py-huge text-center">
              <div className="flex flex-col gap-xs">
                <h2 className="text-[18px]">{t("catalogue.failedTitle")}</h2>
                <p className="text-[14px] text-text-soft">
                  {t("catalogue.failedBody")}
                </p>
              </div>
              <Button variant="secondary" onClick={() => void stores.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          )}

          {stores.isSuccess && rows.length === 0 && (
            <EmptyState
              titleKey={
                search ? "catalogue.noMatchTitle" : "catalogue.emptyTitle"
              }
              bodyKey={search ? "catalogue.noMatchBody" : "catalogue.emptyBody"}
            />
          )}

          {rows.map((store) => (
            <StoreRow
              key={store.id}
              store={store}
              onToggleActive={() =>
                update.mutate({
                  id: store.id,
                  patch: { isActive: !store.isActive },
                })
              }
              onToggleFeatured={() =>
                update.mutate({
                  id: store.id,
                  patch: { isFeatured: !store.isFeatured },
                })
              }
              // Awaited and discarded: `ConfirmButton` keeps its dialog open
              // until this settles, and catches a rejection to report inside it.
              onArchive={async () => {
                await archive.mutateAsync({ id: store.id, name: store.name });
              }}
            />
          ))}

          {/* Said out loud rather than silently truncating. A catalogue that is
            quietly missing shops is the kind of wrong nobody notices until a
            customer asks why they cannot find one. */}
          {stores.data?.truncated && (
            <p
              role="status"
              className="px-md py-lg text-[13px] text-text-faint"
            >
              {t("catalogue.truncated")}
            </p>
          )}
        </div>
      </div>

      <Panel
        open={adding}
        onClose={guarded(() => setAdding(false))}
        label={t("store.add")}
      >
        {adding && (
          <>
            <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
              <h2 className="flex-grow text-[20px]">{t("store.add")}</h2>
              <button
                type="button"
                onClick={guarded(() => setAdding(false))}
                aria-label={t("common.close")}
                className="hidden size-[30px] shrink-0 items-center justify-center rounded-full border border-border text-text-soft hover:bg-neutral-fill lg:flex"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <StoreWizard
              // Keyed on being opened, so cancelling and reopening starts a
              // fresh shop rather than resuming a half-filled one nobody
              // expected to come back.
              key={String(adding)}
              sortOrder={stores.data?.stores.length ?? 0}
              onClose={() => setAdding(false)}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

function StoreRow({
  store,
  onToggleActive,
  onToggleFeatured,
  onArchive,
}: {
  store: Store;
  onToggleActive: () => void;
  onToggleFeatured: () => void;
  onArchive: () => Promise<void>;
}) {
  const name = pickLocalized(store.name);

  return (
    <div
      className={cx(
        // `relative`, so the name's stretched hit area is bounded by the row.
        ROW,
        // A hidden shop is marked, not dimmed.
        //
        // Fading the whole row was wrong: it took the controls with it, and a
        // faded button reads as a disabled one — so the row looked like
        // something you could not act on, which is the opposite of true. It is
        // hidden *from customers*, and the operator's job is precisely to act
        // on it.
        //
        // So the *content* mutes and the controls stay full strength, with a
        // border and a badge carrying the state instead.
        store.isActive
          ? "border-border"
          : "border-danger-wash bg-danger-wash/30",
      )}
    >
      {store.imageUrl ? (
        // `relative z-10`, for the same reason the controls below carry it:
        // the shop's name is an anchor stretched over the whole row, and
        // anything meant to be clickable in its own right has to sit above
        // that overlay. Without this the picture would open the shop.
        <PreviewImage
          src={store.imageUrl}
          name={name}
          className={cx(
            "relative z-10 size-[46px] rounded-md",
            !store.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <ImagePlaceholder className="size-[46px] rounded-md" />
      )}

      <div className="flex min-w-0 flex-grow flex-col gap-xxs">
        <div className="flex items-center gap-sm">
          {/*
            The row is the link, by way of this one.

            `after:absolute after:inset-0` stretches the anchor's hit area over
            the whole row while the anchor itself stays the shop's name — so the
            accessible name is "Nara Kitchen" rather than "row", and the whole
            row is still openable in a new tab, which a click handler on a div
            would have taken away.

            The controls after it carry `relative z-10` so they sit above that
            overlay and keep working. That is the whole trick, and it is why the
            row needs no separate Menu button: the thing an operator comes to a
            shop for is now the largest target on the row instead of the
            smallest.
          */}
          <Link
            href={`/catalogue/${store.id}`}
            className={cx(
              "truncate text-[15px] font-semibold after:absolute after:inset-0 after:rounded-md",
              !store.isActive && "text-text-soft",
            )}
          >
            {name}
          </Link>
          {!store.isActive && (
            // Said in words, not only in colour and dimness.
            <span className="shrink-0 rounded-full bg-danger-wash px-sm text-[11px] font-bold text-danger">
              {t("catalogue.inactive")}
            </span>
          )}
        </div>
        <span className="truncate text-[12px] text-text-faint">
          {store.categoryName} ·{" "}
          {t("catalogue.prep", {
            min: store.prepMinMinutes,
            max: store.prepMaxMinutes,
          })}
        </span>
        {/* The consequence, not the fact. "No location" would read as
            cosmetic; this is money leaving on every order. Shared with the
            branch rows, which carry the same warning about the same money —
            see `NoPinWarning`. */}
        {store.latitude === null && <NoPinWarning />}
      </div>

      {/* Stacked, not side by side. They are two properties of the same shop
          rather than a choice between them, and in a row they read as a pair of
          competing controls — worse, the second one pushed the actions around
          on every row where a name was long. */}
      {/* `relative z-10` puts these above the name's stretched hit area — see
          the note on the link. Without it they would be unclickable, which is
          how this pattern fails when it is copied without its second half. */}
      <div className="relative z-10 flex shrink-0 flex-col gap-xs">
        <ConfirmToggle
          on={store.isActive}
          onChange={onToggleActive}
          labelOn={t("catalogue.active")}
          labelOff={t("catalogue.inactive")}
          params={{ name: pickLocalized(store.name) }}
          whenTurningOn={{
            titleKey: "catalogue.openTitle",
            bodyKey: "catalogue.openBody",
            confirmKey: "catalogue.openConfirm",
          }}
          whenTurningOff={{
            titleKey: "catalogue.closeTitle",
            bodyKey: "catalogue.closeBody",
            confirmKey: "catalogue.closeConfirm",
          }}
          className="w-[104px]"
        />
        <ConfirmToggle
          on={store.isFeatured}
          onChange={onToggleFeatured}
          labelOn={t("catalogue.featured")}
          params={{ name: pickLocalized(store.name) }}
          whenTurningOn={{
            titleKey: "catalogue.featureTitle",
            bodyKey: "catalogue.featureBody",
            confirmKey: "catalogue.featureConfirm",
          }}
          whenTurningOff={{
            titleKey: "catalogue.unfeatureTitle",
            bodyKey: "catalogue.unfeatureBody",
            confirmKey: "catalogue.unfeatureConfirm",
          }}
          className="w-[104px]"
        />
      </div>

      <ConfirmButton
        onConfirm={onArchive}
        titleKey="catalogue.archiveTitle"
        bodyKey="catalogue.archiveBody"
        confirmKey="catalogue.archiveConfirm"
        params={{ name }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
        className="relative z-10"
      >
        {t("catalogue.archive")}
      </ConfirmButton>
    </div>
  );
}
