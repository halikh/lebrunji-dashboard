"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowUpDown,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Menu,
  Page,
  PageHeader,
  Segmented,
  Skeleton,
  cx,
} from "@/components/ui";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Select } from "@/components/ui/select";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import {
  ARTWORK_FORMATS,
  PLACEMENTS,
  artworkState,
  type Artwork,
  type ArtworkFormat,
  type Placement,
} from "../api/artworks";
import { useNow } from "../promotions/schedule";
import {
  useArtworks,
  useDeleteArtwork,
  useUpdateArtwork,
} from "../use-artworks";
import {
  ARTWORK_TONE,
  artworkName,
  describeArtworkWindow,
  describePlacements,
} from "./artwork-status";
import { ReorderArtworksSheet } from "./reorder-artworks-sheet";

type Filter = "all" | "showing" | "notShowing";
const FILTERS: Filter[] = ["all", "showing", "notShowing"];

/**
 * The pictures the app draws — banners in the carousel, tiles three to a row —
 * as a gallery, because a picture is recognised by looking at it.
 *
 * Each card says the three things that decide whether a customer sees it:
 * where it is placed, what it advertises, and whether it is showing right now
 * (and if not, why — off, not started, ended, or its promotion archived). A
 * picture can be switched on and still invisible; the badge is what makes that
 * visible.
 *
 * Banners and tiles are ordered separately — they are drawn in different
 * places — and the order is set in a sheet with a plain list, because dragging
 * cards around a grid is a worse instrument for "which comes first" than a
 * column of rows.
 *
 * Filtered the way Shopify's and Klaviyo's creative libraries are: by whether
 * it is running and by where it runs. "What is on the home screen right now"
 * is the question asked most, so both filters are in the URL
 * (`?show=showing&screen=home`) and can be sent as a link.
 */
export function ArtworksScreen() {
  const artworks = useArtworks();
  const rows = useMemo(() => artworks.data ?? [], [artworks.data]);
  const now = useNow();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("show") as Filter | null;
  const filter: Filter =
    requested && FILTERS.includes(requested) ? requested : "all";
  const requestedScreen = params.get("screen");
  const screen: Placement | "" = (PLACEMENTS as readonly string[]).includes(
    requestedScreen ?? "",
  )
    ? (requestedScreen as Placement)
    : "";
  const setQuery = (next: { show?: Filter; screen?: Placement | "" }) => {
    const query = new URLSearchParams();
    const show = next.show ?? filter;
    const where = next.screen ?? screen;
    if (show !== "all") query.set("show", show);
    if (where) query.set("screen", where);
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };
  const [reordering, setReordering] = useState(false);

  const placed = rows.filter(
    (row) => !screen || row.placements.includes(screen),
  );
  const showing = placed.filter((row) => artworkState(row, now) === "live");
  const counts: Record<Filter, number> = {
    all: placed.length,
    showing: showing.length,
    notShowing: placed.length - showing.length,
  };
  const visible = placed.filter((row) => {
    if (filter === "all") return true;
    const live = artworkState(row, now) === "live";
    return filter === "showing" ? live : !live;
  });

  return (
    <Page>
      <PageHeader
        title={t("artworks.tab")}
        description={t("artworks.blurb")}
        actions={
          <>
            {rows.length > 1 && (
              <Button onClick={() => setReordering(true)}>
                <ArrowUpDown />
                {t("artworks.reorder")}
              </Button>
            )}
            <Button variant="primary" asChild>
              <Link href="/artworks/new">
                <Plus />
                {t("artworks.add")}
              </Link>
            </Button>
          </>
        }
      />

      {artworks.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <Card key={key} padded={false} className="overflow-hidden">
              <Skeleton className="aspect-[21/9] rounded-none" />
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </Card>
          ))}
        </div>
      ) : artworks.isError ? (
        <Card padded={false}>
          <EmptyState
            icon={<AlertCircle />}
            title={t("artworks.failedTitle")}
            description={
              artworks.error instanceof Error
                ? artworks.error.message
                : t("common.loadFailed")
            }
            action={
              <Button onClick={() => void artworks.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<ImageIcon />}
            title={t("artworks.empty")}
            description={t("artworks.emptyBody")}
            action={
              <Button variant="primary" asChild>
                <Link href="/artworks/new">
                  <Plus />
                  {t("artworks.add")}
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Segmented
              className="w-fit max-w-full overflow-x-auto"
              items={FILTERS.map((key) => ({
                key,
                label: t(`artworks.filters.${key}`, { count: counts[key] }),
              }))}
              value={filter}
              onChange={(show) => setQuery({ show })}
            />
            <Select
              value={screen}
              onChange={(next) => setQuery({ screen: next as Placement | "" })}
              isClearable
              placeholder={t("artworks.allScreens")}
              aria-label={t("artworks.filterScreen")}
              options={PLACEMENTS.map((one) => ({
                value: one,
                label: t(`artworks.placements.${one}`),
              }))}
              className="w-full sm:w-60"
            />
          </div>
          {ARTWORK_FORMATS.map((format) => (
            <FormatGallery
              key={format}
              format={format}
              rows={visible.filter((row) => row.format === format)}
              total={placed.filter((row) => row.format === format).length}
              now={now}
            />
          ))}
        </>
      )}

      <ReorderArtworksSheet
        open={reordering}
        onOpenChange={setReordering}
        all={rows}
      />
    </Page>
  );
}

function FormatGallery({
  format,
  rows,
  total,
  now,
}: {
  format: ArtworkFormat;
  rows: Artwork[];
  total: number;
  now: number;
}) {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-ink tabular-nums">
          {t("artworks.sectionCount", {
            title: t(`artworks.sections.${format}`),
            count: total,
          })}
        </h2>
        <p className="text-[13px] text-ink-3">
          {t(`artworks.sectionsHint.${format}`)}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-subtle px-4 py-6 text-center text-[13px] text-ink-3">
          {total === 0
            ? t(`artworks.sectionsEmpty.${format}`)
            : t("artworks.noneInFilter")}
        </div>
      ) : (
        <ul
          className={cx(
            "grid gap-4",
            format === "banner"
              ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
          )}
        >
          {sorted.map((row) => (
            <ArtworkCard key={row.id} artwork={row} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ArtworkCard({ artwork, now }: { artwork: Artwork; now: number }) {
  const router = useRouter();
  const update = useUpdateArtwork();
  const remove = useDeleteArtwork();
  const [deleting, setDeleting] = useState(false);

  const name = artworkName(artwork);
  const src = pickLocalized(artwork.imageUrl);
  const state = artworkState(artwork, now);
  const href = `/artworks/${artwork.id}`;

  return (
    <li className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xs transition-shadow hover:shadow-sm">
      <Link
        href={href}
        className="relative block bg-subtle"
        aria-label={t("artworks.editNamed", { name })}
      >
        <div
          className={cx(
            "w-full overflow-hidden",
            artwork.format === "banner" ? "aspect-[21/9]" : "aspect-[4/5]",
          )}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              loading="lazy"
              className={cx(
                "size-full object-cover transition-[filter,opacity]",
                state !== "live" && "opacity-60 grayscale",
              )}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-ink-4">
              <ImageIcon className="size-6" />
            </div>
          )}
        </div>
        <Badge
          tone={ARTWORK_TONE[state]}
          dot
          className="absolute start-2 top-2 shadow-xs"
        >
          {t(`artworks.status.${state}`)}
        </Badge>
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <Link
          href={href}
          className="truncate text-[14px] font-medium text-ink hover:underline"
        >
          {name}
        </Link>
        <p className="line-clamp-2 text-[12.5px] text-ink-3">
          {describePlacements(artwork)}
        </p>
        <p
          className={cx(
            "line-clamp-2 text-[12.5px]",
            state === "promotionArchived" || state === "bundleArchived"
              ? "font-medium text-warning-ink"
              : "text-ink-4",
          )}
        >
          {describeArtworkWindow(artwork, state)}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <ConfirmToggle
          on={artwork.isActive}
          onChange={() =>
            update.mutate({
              id: artwork.id,
              patch: { isActive: !artwork.isActive },
            })
          }
          labelOn={t("artworks.live")}
          labelOff={t("artworks.hidden")}
          params={{ name }}
          whenTurningOn={{
            titleKey: "artworks.showTitle",
            bodyKey: "artworks.showBody",
            confirmKey: "artworks.showConfirm",
          }}
          whenTurningOff={{
            titleKey: "artworks.hideTitle",
            bodyKey: "artworks.hideBody",
            confirmKey: "artworks.hideConfirm",
          }}
        />
        <Menu
          label={name}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("artworks.actionsFor", { name })}
            >
              <MoreHorizontal />
            </Button>
          }
          items={[
            {
              label: t("common.edit"),
              icon: <Pencil />,
              onSelect: () => router.push(href),
            },
            "separator",
            {
              label: t("artworks.delete"),
              icon: <Trash2 />,
              tone: "danger",
              onSelect: () => setDeleting(true),
            },
          ]}
        />
      </div>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        tone="danger"
        title={t("artworks.deleteTitle", { name })}
        description={t("artworks.deleteBody")}
        confirmLabel={t("artworks.deleteConfirm")}
        onConfirm={async () => {
          await remove.mutateAsync({ id: artwork.id }).catch(() => undefined);
        }}
      />
    </li>
  );
}
