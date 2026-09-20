"use client";

import { useState, type ReactNode } from "react";

import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { InfiniteSentinel } from "@/components/ui/infinite-sentinel";
import { ROW_STATIC } from "@/components/ui/row";
import { SearchInput } from "@/components/ui/search-input";
import { FilterTab, tabArrowHandler } from "@/components/ui/tab";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import { formatDate } from "@/lib/time";

import { TagChip } from "./tag-chip";
import {
  useArchiveCounts,
  useArchivedCategories,
  useArchivedPromotions,
  useArchivedStores,
  useArchivedTags,
  useCatalogueRestore,
} from "./use-archive";

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
 *
 * ## The search, and why an archive of all things needs one
 *
 * This is the one list in the catalogue that only grows — nothing is ever
 * deleted — so it is the one where "scroll until you see it" stops working
 * first. The search is a **query**, not a filter over the rows on screen: the
 * thing being looked for is by definition old, which means it is exactly the
 * thing that has not been paged in yet.
 *
 * ## Nothing is drawn until the first answer arrives
 *
 * The strip used to render while the query was still in flight, with every
 * count reading zero, and then vanish when an empty archive resolved into its
 * empty state. A control that appears and is taken away reads as a glitch even
 * when both frames are correct. So the pending case is its own, above both.
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
  /**
   * Component state, not the URL.
   *
   * The catalogue's query string already carries `?tab=`, and which kind of
   * archived thing you were looking at is not a view worth linking to. A filter
   * nobody pastes is state.
   */
  const [kind, setKind] = useState<Kind>("all");
  const [search, setSearch] = useState("");

  const restore = useCatalogueRestore();
  const counts = useArchiveCounts(search);

  /** Whether a list is drawn at all — "All", or the one that was picked. */
  const showing = (which: Kind) => kind === "all" || kind === which;

  // Each list runs only while it is being shown. On a specific filter that is
  // one query; on "All" — which is a request for all four — it is four, each
  // paged rather than whole.
  const stores = useArchivedStores(search, showing("stores"));
  const categories = useArchivedCategories(search, showing("categories"));
  const tags = useArchivedTags(search, showing("tags"));
  const promotions = useArchivedPromotions(search, showing("promotions"));

  const searching = search.trim().length > 0;

  if (counts.isError) {
    return (
      <EmptyState
        mood="lost"
        titleKey="archive.failedTitle"
        bodyKey="archive.catalogueHint"
      />
    );
  }

  // Before the first answer. Above the empty state and above the strip, so
  // neither is drawn on numbers nobody has yet — see the note in the header.
  if (counts.isPending || counts.data === undefined) {
    return (
      <div aria-hidden className="flex flex-col gap-sm p-xxl">
        <div className="h-[36px] w-[320px] rounded-md bg-neutral-fill" />
        <div className="h-[64px] rounded-md bg-neutral-fill" />
        <div className="h-[64px] rounded-md bg-neutral-fill" />
      </div>
    );
  }

  // An archive with nothing in it and nothing typed. Not the same as a search
  // that found nothing, which keeps the box so the term can be corrected.
  if (counts.data.all === 0 && !searching) {
    return (
      <EmptyState
        mood="done"
        titleKey="archive.emptyTitle"
        bodyKey="archive.catalogueEmptyBody"
      />
    );
  }

  const tally: Record<Kind, number> = {
    all: counts.data.all,
    stores: counts.data.stores,
    categories: counts.data.categories,
    tags: counts.data.tags,
    promotions: counts.data.promotions,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Above the scroller. A filter strip that scrolls away leaves the
          operator looking at a filtered list with no visible sign that a filter
          is on — and the same is true of the search box beside it. */}
      <div className="flex shrink-0 flex-col gap-sm border-b border-border bg-surface px-xxl pt-sm">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("archive.searchPlaceholder")}
        />

        <div
          role="tablist"
          aria-label={t("archive.catalogueTitle")}
          className="flex gap-xxs overflow-x-auto"
        >
          {TABS.map(({ key, labelKey }) => (
            <FilterTab
              key={key}
              label={t(labelKey)}
              count={tally[key]}
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
      </div>

      <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto scroll-hint p-xxl">
        <p className="max-w-[560px] text-[13px] text-text-soft">
          {t("archive.catalogueHint")}
        </p>

        {/* A filter with nothing behind it is its own state. Without this the
            screen would go blank under a strip whose count says zero, which
            reads as broken rather than as empty. Searching says so differently:
            the fix for "no matches" is a different term, not a different tab. */}
        {tally[kind] === 0 && (
          <EmptyState
            mood="waiting"
            titleKey={searching ? "archive.noMatches" : "archive.noneOfThese"}
            bodyKey={
              searching ? "archive.noMatchesBody" : "archive.noneOfTheseBody"
            }
          />
        )}

        {/* Categories first: a shop cannot come back until its category has, so
            the list that unblocks the others leads. */}
        <Group
          title={t("archive.categories")}
          shown={showing("categories")}
          count={tally.categories}
          query={categories}
        >
          {categories.data?.pages
            .flatMap((page) => page.rows)
            .map((category) => (
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
          shown={showing("stores")}
          count={tally.stores}
          query={stores}
        >
          {stores.data?.pages
            .flatMap((page) => page.rows)
            .map((store) => (
              <div key={store.id} className={ROW_STATIC}>
                <Thumbnail
                  url={store.imageUrl}
                  name={pickLocalized(store.name)}
                />
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
          shown={showing("tags")}
          count={tally.tags}
          query={tags}
        >
          {tags.data?.pages
            .flatMap((page) => page.rows)
            .map((tag) => (
              <div key={tag.id} className={ROW_STATIC}>
                {/* The chip, not the bare name. A tag *is* its colour on a
                    dish, and an archived one should be recognisable as the
                    thing that was taken off forty menu rows. */}
                <span className="shrink-0">
                  <TagChip
                    tone={tag.tone}
                    ink={tag.ink}
                    color={tag.color}
                    label={pickLocalized(tag.name)}
                  />
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
          shown={showing("promotions")}
          count={tally.promotions}
          query={promotions}
        >
          {promotions.data?.pages
            .flatMap((page) => page.rows)
            .map((promotion) => (
              <div key={promotion.id} className={ROW_STATIC}>
                <Thumbnail url={promotion.imageUrl} name={promotion.slug} />
                {/* The slug is the name. `0013` dropped every text column a
                    customer would have read — the card is artwork — so the slug
                    is the only handle an operator has on a picture in a list. */}
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

/**
 * The picture, or the space one would take — the menu list's own shape.
 *
 * Clickable here as everywhere else, and it earns it on this screen more than
 * most: deciding whether to bring a shop back usually means looking at what it
 * was, and a 44pt square is not that.
 */
function Thumbnail({ url, name }: { url: string | null; name: string }) {
  if (!url) {
    return <ImagePlaceholder className="size-[44px] rounded-md" />;
  }
  return (
    <PreviewImage src={url} name={name} className="size-[44px] rounded-md" />
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
 * One kind of put-away thing, with its own way to the next page.
 *
 * Empty groups are dropped rather than shown with a "none" line — four headings
 * over a single archived tag is a page about its own structure, and the
 * operator came here to find one thing.
 *
 * ## The sentinel belongs to the group, not to the screen
 *
 * Each list pages separately, so "load more" has to mean *this* list. One
 * sentinel at the bottom of the page would be ambiguous on the All tab, where
 * four lists are on screen and three of them may have more to give.
 *
 * The count is the server's, and it is what decides whether the heading is
 * drawn at all — the rows in hand are a page of it. Both are shown: a heading
 * reading "Shops" over ten of forty says less than the number does.
 */
function Group({
  title,
  shown,
  count,
  query,
  children,
}: {
  title: string;
  /** Whether this kind is the filter, or the filter is "All". */
  shown: boolean;
  /** How many there are in total — not how many have been fetched. */
  count: number;
  query: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
  };
  children: ReactNode;
}) {
  if (!shown || count === 0) return null;

  return (
    <section className="flex flex-col gap-sm">
      <h2 className="ps-md text-[13px] font-semibold uppercase tracking-wide text-text-faint">
        {t("archive.groupHeading", { title, count })}
      </h2>
      {children}
      <InfiniteSentinel
        hasMore={query.hasNextPage}
        loading={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
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
