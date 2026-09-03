"use client";

import { useState, type ReactNode } from "react";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { ROW_STATIC } from "@/components/ui/row";
import { FilterTab, tabArrowHandler } from "@/components/ui/tab";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import { formatDate } from "@/lib/time";

import { TagChip } from "./tag-chip";
import { useCatalogueArchive, useCatalogueRestore } from "./use-archive";

/**
 * What the catalogue has put away, and the way back.
 *
 * ## The tier above the shop's own archive
 *
 * A shop's Archive tab holds its sections, its dishes and its withdrawn
 * questions and choices. This holds the shops themselves and the three things
 * that are true across all of them — categories, tags, promotions. The split
 * follows the screens: you archive a dish while looking at a menu and a shop
 * while looking at the catalogue, so that is where each comes back from.
 *
 * ## Everything here is soft, and the buttons say so
 *
 * All four tables carry a `deleted_at` and nothing is ever removed: a shop is
 * referenced by every order placed at it, a tag by the dishes wearing it, a
 * promotion by its redemptions. So "Bring back" is the whole vocabulary, with
 * no delete beside it.
 *
 * It still asks before it acts. Restoring is reversible, so the dialog is not
 * there to prevent a loss — it is there because the action is **outward-facing**
 * and the rows are identical: a restored shop is orderable by customers the
 * moment it lands, and naming the thing in the question is what catches the
 * click that landed one row off.
 *
 * ## A shop says which category it would return to
 *
 * Not decoration: `stores.category_id` is `not null`, so a shop restored into
 * an archived category lands on a shelf neither the dashboard nor the app
 * draws. `restoreStore` refuses it, and the row says so in place of the button
 * rather than after it is pressed.
 */

type Kind = "all" | "stores" | "categories" | "tags" | "promotions";

const TABS: { key: Kind; labelKey: TranslationKey }[] = [
  { key: "all", labelKey: "archive.all" },
  { key: "stores", labelKey: "archive.stores" },
  { key: "categories", labelKey: "archive.categories" },
  { key: "tags", labelKey: "archive.tags" },
  { key: "promotions", labelKey: "archive.promotions" },
];

export function CatalogueArchive() {
  const archive = useCatalogueArchive();
  const restore = useCatalogueRestore();

  /**
   * Component state, not the URL.
   *
   * The catalogue's query string already carries `?tab=`, and which kind of
   * archived thing you were looking at is not a view worth linking to. A filter
   * nobody pastes is state.
   */
  const [kind, setKind] = useState<Kind>("all");

  const data = archive.data;

  const counts: Record<Kind, number> = {
    all:
      (data?.stores.length ?? 0) +
      (data?.categories.length ?? 0) +
      (data?.tags.length ?? 0) +
      (data?.promotions.length ?? 0),
    stores: data?.stores.length ?? 0,
    categories: data?.categories.length ?? 0,
    tags: data?.tags.length ?? 0,
    promotions: data?.promotions.length ?? 0,
  };

  const showing = (which: Kind) => kind === "all" || kind === which;

  if (archive.isError) {
    return (
      <EmptyState
        mood="lost"
        titleKey="archive.failedTitle"
        bodyKey="archive.catalogueHint"
      />
    );
  }

  if (archive.isSuccess && counts.all === 0) {
    return (
      <EmptyState
        mood="done"
        titleKey="archive.emptyTitle"
        bodyKey="archive.catalogueEmptyBody"
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Above the scroller. A filter strip that scrolls away leaves the
          operator looking at a filtered list with no visible sign that a filter
          is on. */}
      <div
        role="tablist"
        aria-label={t("archive.catalogueTitle")}
        className="flex shrink-0 gap-xxs overflow-x-auto border-b border-border bg-surface px-xxl pt-sm"
      >
        {TABS.map(({ key, labelKey }) => (
          <FilterTab
            key={key}
            label={t(labelKey)}
            count={counts[key]}
            active={kind === key}
            onClick={() => setKind(key)}
            onKeyDown={tabArrowHandler(
              TABS.map((one) => one.key),
              kind,
              setKind,
            )}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
        <p className="max-w-[560px] text-[13px] text-text-soft">
          {t("archive.catalogueHint")}
        </p>

        {/* A filter with nothing behind it is its own state. Without this the
            screen would go blank under a strip whose count says zero, which
            reads as broken rather than as empty. */}
        {counts[kind] === 0 && (
          <EmptyState
            mood="waiting"
            titleKey="archive.noneOfThese"
            bodyKey="archive.noneOfTheseBody"
          />
        )}

        {/* Categories first: a shop cannot come back until its category has, so
            the list that unblocks the others leads. */}
        <Group
          title={t("archive.categories")}
          rows={showing("categories") ? counts.categories : 0}
        >
          {data?.categories.map((category) => (
            <div key={category.id} className={ROW_STATIC}>
              <Identity
                name={pickLocalized(category.name)}
                detail={t("archive.archivedOn", {
                  when: formatDate(category.archivedAt),
                })}
              />
              <Restore
                name={pickLocalized(category.name)}
                body="archive.restoreCategory"
                onConfirm={() =>
                  restore.category.mutateAsync({
                    id: category.id,
                    name: pickLocalized(category.name),
                  })
                }
              />
            </div>
          ))}
        </Group>

        <Group
          title={t("archive.stores")}
          rows={showing("stores") ? counts.stores : 0}
        >
          {data?.stores.map((store) => (
            <div key={store.id} className={ROW_STATIC}>
              <Thumbnail url={store.imageUrl} />
              <Identity
                name={pickLocalized(store.name)}
                detail={[
                  t("archive.inCategory", {
                    name: pickLocalized(store.categoryName),
                  }),
                  t("archive.archivedOn", {
                    when: formatDate(store.archivedAt),
                  }),
                ].join(" · ")}
              />
              {store.categoryArchived ? (
                <Blocked>
                  {t("archive.categoryGoneFirst", {
                    name: pickLocalized(store.categoryName),
                  })}
                </Blocked>
              ) : (
                <Restore
                  name={pickLocalized(store.name)}
                  body="archive.restoreStore"
                  onConfirm={() =>
                    restore.store.mutateAsync({
                      id: store.id,
                      name: pickLocalized(store.name),
                    })
                  }
                />
              )}
            </div>
          ))}
        </Group>

        <Group
          title={t("archive.tags")}
          rows={showing("tags") ? counts.tags : 0}
        >
          {data?.tags.map((tag) => (
            <div key={tag.id} className={ROW_STATIC}>
              {/* The chip, not the bare name. A tag *is* its colour on a dish,
                  and an archived one should be recognisable as the thing that
                  was taken off forty menu rows. */}
              <span className="shrink-0">
                <TagChip tone={tag.tone} label={pickLocalized(tag.name)} />
              </span>
              <Identity
                name={pickLocalized(tag.name)}
                detail={t("archive.archivedOn", {
                  when: formatDate(tag.archivedAt),
                })}
              />
              <Restore
                name={pickLocalized(tag.name)}
                body="archive.restoreTag"
                onConfirm={() =>
                  restore.tag.mutateAsync({
                    id: tag.id,
                    name: pickLocalized(tag.name),
                  })
                }
              />
            </div>
          ))}
        </Group>

        <Group
          title={t("archive.promotions")}
          rows={showing("promotions") ? counts.promotions : 0}
        >
          {data?.promotions.map((promotion) => (
            <div key={promotion.id} className={ROW_STATIC}>
              <Thumbnail url={promotion.imageUrl} />
              {/* The slug is the name. `0013` dropped every text column a
                  customer would have read — the card is artwork — so the slug is
                  the only handle an operator has on a picture in a list. */}
              <Identity
                name={promotion.slug}
                detail={t("archive.archivedOn", {
                  when: formatDate(promotion.archivedAt),
                })}
              />
              <Restore
                name={promotion.slug}
                body="archive.restorePromotion"
                onConfirm={() =>
                  restore.promotion.mutateAsync({
                    id: promotion.id,
                    name: promotion.slug,
                  })
                }
              />
            </div>
          ))}
        </Group>
      </div>
    </div>
  );
}

/** The row's name over the line that says where it was and when it went. */
function Identity({ name, detail }: { name: string; detail: string }) {
  return (
    <span className="flex min-w-0 flex-grow flex-col gap-xxs">
      <span className="truncate text-[15px] font-semibold">{name}</span>
      <span className="truncate text-[12px] text-text-faint">{detail}</span>
    </span>
  );
}

/** The picture, or the space one would take — the menu list's own shape. */
function Thumbnail({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div
        aria-hidden
        className="size-[44px] shrink-0 rounded-md bg-neutral-fill"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden
      className="size-[44px] shrink-0 rounded-md object-cover"
    />
  );
}

/**
 * Why this one cannot come back yet, standing *in place of* the button.
 *
 * Beside a disabled control it would still invite the press. What is needed
 * here is the next step, and the next step is the category.
 */
function Blocked({ children }: { children: ReactNode }) {
  return (
    <span className="max-w-[280px] shrink-0 text-end text-[12px] text-danger">
      {children}
    </span>
  );
}

/**
 * One kind of put-away thing.
 *
 * Empty groups are dropped rather than shown with a "none" line — four headings
 * over a single archived tag is a page about its own structure, and the
 * operator came here to find one thing.
 */
function Group({
  title,
  rows,
  children,
}: {
  title: string;
  rows: number;
  children: ReactNode;
}) {
  if (rows === 0) return null;

  return (
    <section className="flex flex-col gap-sm">
      <h2 className="ps-md text-[13px] font-semibold uppercase tracking-wide text-text-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Bringing one thing back, after a question.
 *
 * What earns a dialog on a *reversible* action is that it is outward-facing: a
 * restored shop is orderable by customers the moment it lands, and the row
 * clicked is one of a column of identical rows. The question names the thing,
 * which is what catches the case a confirmation exists for — the wrong row.
 *
 * Mint on the confirm button, because coral is the ordinary go-on and red is a
 * warning, and this is neither. `body` differs per kind because what happens
 * differs per kind — see the strings.
 */
function Restore({
  name,
  body,
  onConfirm,
}: {
  /** The thing's own name, so the question is about the row that was clicked. */
  name: string;
  body: TranslationKey;
  onConfirm: () => Promise<void>;
}) {
  return (
    <ConfirmButton
      onConfirm={onConfirm}
      titleKey="archive.restoreTitle"
      bodyKey={body}
      confirmKey="archive.restoreConfirm"
      params={{ name }}
      variant="accent"
      triggerVariant="accent"
      size="sm"
      className="shrink-0"
    >
      {t("archive.restore")}
    </ConfirmButton>
  );
}
