"use client";

import Link from "next/link";
import { useState } from "react";

import { cx, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Button } from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
        <h1 className="flex-grow text-[24px]">{t("catalogue.stores")}</h1>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("catalogue.searchPlaceholder")}
          aria-label={t("catalogue.searchPlaceholder")}
          className="w-[260px]"
        />
      </div>

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
          <p role="status" className="px-md py-lg text-[13px] text-text-faint">
            {t("catalogue.truncated")}
          </p>
        )}
      </div>
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
        "flex items-center gap-lg rounded-md border bg-surface px-lg py-md",
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={store.imageUrl}
          alt=""
          aria-hidden
          className={cx(
            "size-[46px] shrink-0 rounded-md object-cover",
            !store.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <div
          aria-hidden
          className="size-[46px] shrink-0 rounded-md bg-neutral-fill"
        />
      )}

      <div className="flex min-w-0 flex-grow flex-col gap-xxs">
        <div className="flex items-center gap-sm">
          <span
            className={cx(
              "truncate text-[15px] font-semibold",
              !store.isActive && "text-text-soft",
            )}
          >
            {name}
          </span>
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
        {store.latitude === null && (
          // The consequence, not the fact. "No location" would read as
          // cosmetic; this is money leaving on every order.
          <span className="flex items-center gap-xs text-[12px] font-semibold text-danger">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 8v5M12 16.5v.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            {t("catalogue.noPin")}
          </span>
        )}
      </div>

      {/* Stacked, not side by side. They are two properties of the same shop
          rather than a choice between them, and in a row they read as a pair of
          competing controls — worse, the second one pushed the actions around
          on every row where a name was long. */}
      <div className="flex shrink-0 flex-col gap-xs">
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

      {/* The menu is what an operator comes to a shop for. A link rather than a
          button: it is a place, so it should be openable in a new tab. */}
      <Link
        href={`/catalogue/${store.id}`}
        // A filled ground, not bare text. It sits beside a filled Archive
        // button, and blue text alone read as a footnote next to it — the two
        // are both things you press, and the one you press far more often
        // should not be the quieter of the pair.
        //
        // `primary-wash` with `primary` type rather than a solid fill: it is
        // navigation, not the row's primary action, and a second solid button
        // per row would leave nothing to distinguish weight with.
        className="shrink-0 rounded-md bg-primary-wash px-md py-sm text-[13px] font-semibold text-primary hover:brightness-95"
      >
        {t("catalogue.openMenu")}
      </Link>

      <ConfirmButton
        onConfirm={onArchive}
        titleKey="catalogue.archiveTitle"
        bodyKey="catalogue.archiveBody"
        confirmKey="catalogue.archiveConfirm"
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("catalogue.archive")}
      </ConfirmButton>
    </div>
  );
}
