"use client";

import {
  AlertCircle,
  ArchiveRestore,
  Inbox,
  Lock,
  SearchX,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ListSkeleton,
  Page,
  PageHeader,
  SearchInput,
  Skeleton,
  Tabs,
  Thumb,
  Tooltip,
} from "@/components/ui";
import { InfiniteSentinel } from "@/components/ui/infinite-sentinel";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import { formatDate } from "@/lib/time";

import { TagChip } from "../tags/tag-chip";
import {
  useArchiveCounts,
  useArchivedBundles,
  useArchivedCategories,
  useArchivedPromotions,
  useArchivedStores,
  useArchivedTags,
  useCatalogueRestore,
} from "../use-archive";

type Kind = "all" | "categories" | "stores" | "tags" | "promotions" | "bundles";

// Categories first: a shop cannot come back until its category has, so the
// list that unblocks the others leads.
const TABS: { key: Kind; labelKey: TranslationKey }[] = [
  { key: "all", labelKey: "archive.all" },
  { key: "categories", labelKey: "archive.categories" },
  { key: "stores", labelKey: "archive.stores" },
  { key: "tags", labelKey: "archive.tags" },
  { key: "promotions", labelKey: "archive.promotions" },
  { key: "bundles", labelKey: "archive.bundles" },
];

type Pending = {
  name: string;
  body: TranslationKey;
  run: () => Promise<unknown>;
};

/**
 * What has been put away across the catalogue — shops, categories, tags and
 * promotions — with the way back. Nothing here is deleted; order history still
 * points at all of it.
 *
 * Every "Bring back" asks first, and says what will happen for *that* kind,
 * because what returns with it differs: a shop reappears in the app, a tag
 * reappears on every dish that kept it, a promotion runs again if its dates
 * still allow. A shop whose category is itself archived cannot come back —
 * `stores.category_id` would point at a shelf nothing draws — so its row says
 * which category to restore first instead of offering a button that would be
 * refused. A bundle in an archived shop is handled the same way.
 *
 * Like a mail client's Trash or Shopify's archived products: one place, newest
 * first, a filter per kind with its count, and the way back on every row. The
 * filter is in the URL (`?kind=`), so a link from elsewhere — "your archived
 * bundles" — opens on that list.
 */
export function ArchiveScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("kind");
  const kind: Kind = TABS.some((tab) => tab.key === requested)
    ? (requested as Kind)
    : "all";
  const setKind = (next: Kind) =>
    router.replace(next === "all" ? pathname : `${pathname}?kind=${next}`, {
      scroll: false,
    });
  const [search, setSearch] = useState("");
  const [asking, setAsking] = useState<Pending | null>(null);

  const restore = useCatalogueRestore();
  const counts = useArchiveCounts(search);

  const showing = (which: Kind) => kind === "all" || kind === which;
  const stores = useArchivedStores(search, showing("stores"));
  const categories = useArchivedCategories(search, showing("categories"));
  const tags = useArchivedTags(search, showing("tags"));
  const promotions = useArchivedPromotions(search, showing("promotions"));
  const bundles = useArchivedBundles(search, showing("bundles"));

  const searching = search.trim().length > 0;
  const tally: Record<Kind, number> | null = counts.data
    ? {
        all: counts.data.all,
        stores: counts.data.stores,
        categories: counts.data.categories,
        tags: counts.data.tags,
        promotions: counts.data.promotions,
        bundles: counts.data.bundles,
      }
    : null;

  const ask = (pending: Pending) => setAsking(pending);

  let body: ReactNode;
  if (counts.isError) {
    body = (
      <Card padded={false}>
        <EmptyState
          icon={<AlertCircle />}
          title={t("archive.failedTitle")}
          description={t("common.loadFailed")}
          action={
            <Button onClick={() => void counts.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      </Card>
    );
  } else if (!tally) {
    body = (
      <Card padded={false}>
        <ListSkeleton rows={4} />
      </Card>
    );
  } else if (tally.all === 0 && !searching) {
    body = (
      <Card padded={false}>
        <EmptyState
          icon={<Inbox />}
          title={t("archive.emptyTitle")}
          description={t("archive.catalogueEmptyBody")}
        />
      </Card>
    );
  } else if (tally[kind] === 0) {
    body = (
      <Card padded={false}>
        <EmptyState
          icon={<SearchX />}
          title={searching ? t("archive.noMatches") : t("archive.noneOfThese")}
          description={
            searching
              ? t("archive.noMatchesBody")
              : t("archive.noneOfTheseBody")
          }
        />
      </Card>
    );
  } else {
    body = (
      <div className="flex flex-col gap-6">
        <Group
          title={t("archive.categories")}
          shown={showing("categories")}
          count={tally.categories}
          query={categories}
        >
          {categories.data?.pages
            .flatMap((page) => page.rows)
            .map((category) => {
              const name = pickLocalized(category.name);
              return (
                <Row
                  key={category.id}
                  leading={<Thumb src={null} size={40} />}
                  title={name}
                  detail={t("archive.archivedOn", {
                    when: formatDate(category.archivedAt),
                  })}
                  action={
                    <RestoreButton
                      name={name}
                      onClick={() =>
                        ask({
                          name,
                          body: "archive.restoreCategory",
                          run: () =>
                            restore.category.mutateAsync({
                              id: category.id,
                              name,
                            }),
                        })
                      }
                    />
                  }
                />
              );
            })}
        </Group>

        <Group
          title={t("archive.stores")}
          shown={showing("stores")}
          count={tally.stores}
          query={stores}
        >
          {stores.data?.pages
            .flatMap((page) => page.rows)
            .map((store) => {
              const name = pickLocalized(store.name);
              const category = pickLocalized(store.categoryName);
              return (
                <Row
                  key={store.id}
                  leading={<Thumb src={store.imageUrl} size={40} />}
                  title={name}
                  detail={[
                    t("archive.inCategory", { name: category }),
                    t("archive.archivedOn", {
                      when: formatDate(store.archivedAt),
                    }),
                  ].join(", ")}
                  action={
                    store.categoryArchived ? (
                      <Tooltip
                        content={t("archive.categoryGoneFirst", {
                          name: category,
                        })}
                      >
                        <span tabIndex={0} className="rounded-full">
                          <Badge tone="warning">
                            <Lock className="size-3" />
                            {t("archive.restoreCategoryFirst")}
                          </Badge>
                        </span>
                      </Tooltip>
                    ) : (
                      <RestoreButton
                        name={name}
                        onClick={() =>
                          ask({
                            name,
                            body: "archive.restoreStore",
                            run: () =>
                              restore.store.mutateAsync({
                                id: store.id,
                                name,
                              }),
                          })
                        }
                      />
                    )
                  }
                  note={
                    store.categoryArchived
                      ? t("archive.categoryGoneFirst", { name: category })
                      : undefined
                  }
                />
              );
            })}
        </Group>

        <Group
          title={t("archive.tags")}
          shown={showing("tags")}
          count={tally.tags}
          query={tags}
        >
          {tags.data?.pages
            .flatMap((page) => page.rows)
            .map((tag) => {
              const name = pickLocalized(tag.name);
              return (
                <Row
                  key={tag.id}
                  title={
                    <TagChip label={name} iconUrl={tag.iconUrl} size="lg" />
                  }
                  detail={t("archive.archivedOn", {
                    when: formatDate(tag.archivedAt),
                  })}
                  action={
                    <RestoreButton
                      name={name}
                      onClick={() =>
                        ask({
                          name,
                          body: "archive.restoreTag",
                          run: () =>
                            restore.tag.mutateAsync({ id: tag.id, name }),
                        })
                      }
                    />
                  }
                />
              );
            })}
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
              // The slug is the name: a promotion's card is artwork, so the
              // reference is the only handle an operator has on it.
              <Row
                key={promotion.id}
                leading={<Thumb src={promotion.imageUrl} size={40} />}
                title={promotion.slug}
                detail={t("archive.archivedOn", {
                  when: formatDate(promotion.archivedAt),
                })}
                action={
                  <RestoreButton
                    name={promotion.slug}
                    onClick={() =>
                      ask({
                        name: promotion.slug,
                        body: "archive.restorePromotion",
                        run: () =>
                          restore.promotion.mutateAsync({
                            id: promotion.id,
                            name: promotion.slug,
                          }),
                      })
                    }
                  />
                }
              />
            ))}
        </Group>

        <Group
          title={t("archive.bundles")}
          shown={showing("bundles")}
          count={tally.bundles}
          query={bundles}
        >
          {bundles.data?.pages
            .flatMap((page) => page.rows)
            .map((bundle) => {
              const name = pickLocalized(bundle.name);
              const shop = pickLocalized(bundle.storeName);
              return (
                <Row
                  key={bundle.id}
                  leading={<Thumb src={bundle.imageUrl} size={40} />}
                  title={name}
                  detail={[
                    t("archive.ofShop", { name: shop }),
                    t("archive.archivedOn", {
                      when: formatDate(bundle.archivedAt),
                    }),
                  ].join(", ")}
                  action={
                    bundle.storeArchived ? (
                      <Tooltip
                        content={t("archive.shopGoneFirst", { name: shop })}
                      >
                        <span tabIndex={0} className="rounded-full">
                          <Badge tone="warning">
                            <Lock className="size-3" />
                            {t("archive.restoreShopFirst")}
                          </Badge>
                        </span>
                      </Tooltip>
                    ) : (
                      <RestoreButton
                        name={name}
                        onClick={() =>
                          ask({
                            name,
                            body: "archive.restoreBundle",
                            run: () =>
                              restore.bundle.mutateAsync({
                                id: bundle.id,
                                name,
                              }),
                          })
                        }
                      />
                    )
                  }
                  note={
                    bundle.storeArchived
                      ? t("archive.shopGoneFirst", { name: shop })
                      : undefined
                  }
                />
              );
            })}
        </Group>
      </div>
    );
  }

  return (
    <Page>
      <PageHeader
        title={t("archive.tab")}
        description={t("archive.catalogueHint")}
      />

      {/* Search and filter stay above the list, so a filtered view always
          shows that a filter is on. */}
      <div className="flex flex-col gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("archive.searchPlaceholder")}
          className="w-full sm:w-96"
        />
        <Tabs
          items={TABS.map(({ key, labelKey }) => ({
            key,
            label: tally
              ? t("archive.tabCount", { label: t(labelKey), count: tally[key] })
              : t(labelKey),
          }))}
          value={kind}
          onChange={setKind}
        />
      </div>

      {body}

      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t("archive.restoreTitle", { name: asking?.name ?? "" })}
        description={asking ? t(asking.body) : undefined}
        confirmLabel={t("archive.restoreConfirm")}
        onConfirm={async () => {
          await asking?.run().catch(() => undefined);
        }}
      />
    </Page>
  );
}

function Group({
  title,
  shown,
  count,
  query,
  children,
}: {
  title: string;
  shown: boolean;
  count: number;
  query: {
    isPending: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
  };
  children: ReactNode;
}) {
  if (!shown || count === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-semibold text-ink tabular-nums">
        {t("archive.groupHeading", { title, count })}
      </h2>
      <Card padded={false} className="overflow-hidden">
        {query.isPending ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <ul className="divide-y divide-line">{children}</ul>
        )}
        <InfiniteSentinel
          hasMore={query.hasNextPage}
          loading={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      </Card>
    </section>
  );
}

function Row({
  leading,
  title,
  detail,
  note,
  action,
}: {
  leading?: ReactNode;
  title: ReactNode;
  detail: string;
  /** A sentence under the row on a phone, where a tooltip cannot be hovered. */
  note?: string;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center gap-3">
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="truncate text-[14px] font-medium text-ink">
            {title}
          </div>
          <p className="truncate text-[12.5px] text-ink-3">{detail}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {note && <p className="text-[12.5px] text-ink-3 sm:hidden">{note}</p>}
    </li>
  );
}

function RestoreButton({
  name,
  onClick,
}: {
  name: string;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      aria-label={t("archive.restoreNamed", { name })}
    >
      <ArchiveRestore />
      <span className="max-sm:hidden">{t("archive.restore")}</span>
    </Button>
  );
}
