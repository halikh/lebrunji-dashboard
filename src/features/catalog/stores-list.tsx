"use client";

import { useState } from "react";

import { cx, Input } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui";
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
              await archive.mutateAsync(store.id);
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
  const name = pickName(store.name);

  return (
    <div
      className={cx(
        "flex items-center gap-lg rounded-md border border-border bg-surface px-lg py-md",
        // A hidden shop is dimmed rather than removed: it is still a thing the
        // operator manages, and it must be findable to be put back.
        !store.isActive && "opacity-60",
      )}
    >
      {store.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={store.imageUrl}
          alt=""
          aria-hidden
          className="size-[46px] shrink-0 rounded-md object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="size-[46px] shrink-0 rounded-md bg-neutral-fill"
        />
      )}

      <div className="flex min-w-0 flex-grow flex-col gap-xxs">
        <div className="flex items-center gap-sm">
          <span className="truncate text-[15px] font-semibold">{name}</span>
          {store.isFeatured && (
            <span className="shrink-0 rounded-full bg-yellow-wash px-sm text-[11px] font-bold text-on-yellow">
              {t("catalogue.featured")}
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

      <Toggle
        label={store.isActive ? t("catalogue.active") : t("catalogue.inactive")}
        on={store.isActive}
        onChange={onToggleActive}
      />

      <Button variant="secondary" size="sm" onClick={onToggleFeatured}>
        {t("catalogue.featured")}
      </Button>

      <ConfirmButton
        onConfirm={onArchive}
        titleKey="catalogue.archiveTitle"
        bodyKey="catalogue.archiveBody"
        confirmKey="catalogue.archiveConfirm"
        variant="danger"
        // Red type, not a red fill: this repeats on every row, and a column of
        // filled red buttons stops reading as a warning by the fourth one.
        triggerVariant="danger-quiet"
        size="sm"
      >
        {t("catalogue.archive")}
      </ConfirmButton>
    </div>
  );
}

/**
 * A switch.
 *
 * A real `<button>` with `aria-pressed` rather than a styled checkbox: the
 * state is "on or off", which is what `aria-pressed` says, and a checkbox would
 * announce "checked" — right for a form field being submitted, wrong for a
 * control that acts the moment it is pressed.
 */
function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onChange}
      className="flex shrink-0 items-center gap-sm text-[13px] font-semibold text-text-soft"
    >
      <span
        aria-hidden
        className={cx(
          "flex h-[22px] w-[38px] items-center rounded-full p-xxs",
          on ? "justify-end bg-accent" : "justify-start bg-neutral-fill",
        )}
      >
        <span className="size-[18px] rounded-full bg-surface" />
      </span>
      <span className="w-[46px] text-left">{label}</span>
    </button>
  );
}

/** One readable name, for a label. Falls back the way `pickLocalized` does. */
function pickName(name: Record<string, string>): string {
  for (const candidate of [name.en, ...Object.values(name)]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
}
