"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Image as ImageIcon,
  MapPin,
  PartyPopper,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import {
  Badge,
  Button,
  buttonClass,
  Card,
  EmptyState,
  LinkRow,
  Page,
  PageHeader,
  SearchInput,
  Skeleton,
  cx,
} from "@/components/ui";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import type {
  AddressTodo,
  HoursTodo,
  ItemTodo,
  StoreTodo,
  TodoList,
} from "./api/todo";
import { todoHref, useTodoLists } from "./use-todo";

/**
 * What is left to do before the catalogue looks finished.
 *
 * Four groups, each a row per thing with a link straight to where it is fixed,
 * so the page is worked *through* rather than read. Hours first and marked
 * urgent: a shop with no hours is open around the clock in the app (`0170`),
 * so it takes orders at hours nobody is there to cook them. Addresses next:
 * required since `0198`. A missing picture only looks unfinished.
 *
 * Groups start closed — the page opens on four headings and four counts, which
 * is the summary — except the first one with work in it (the urgent one,
 * while it has rows), and any group a search found something in.
 *
 * ## Shaped after Shopify's setup guide and Stripe's onboarding checklist
 *
 * - **Progress first**: "2 of 4 done" with a bar, so the page answers "how
 *   far along are we" before anything is opened.
 * - **One clear next step**: the single most useful fix, named, with one
 *   primary button — the urgent group first, live shops before hidden ones.
 * - **Tasks complete themselves**: a group turns green when its list is
 *   empty, because the list *is* the data. There is no "mark as done" and no
 *   dismiss: either would hide a gap that is still there. A "this shop
 *   deliberately has no picture" choice would need a column to remember it
 *   (a migration), not a browser setting.
 */
export function TodoScreen() {
  const [search, setSearch] = useState("");
  const { hours, addresses, storeImages, itemImages } = useTodoLists();

  // Filtered here rather than in the queries. These lists are what is *left*,
  // short by nature and already fully downloaded, so a browser-side filter
  // searches all of it. A capped list says so under itself regardless.
  const term = normalise(search);
  const searching = term.length > 0;

  // Hidden things last: they are usually "not ready yet", and the live ones
  // are what a customer is looking at right now.
  const hoursRows = (hours.data?.rows ?? [])
    .filter(
      (row) =>
        !searching ||
        matches(term, row.storeName, ...row.branches.map((b) => b.name)),
    )
    .sort((a, b) => Number(b.storeActive) - Number(a.storeActive));
  const addressRows = (addresses.data?.rows ?? [])
    .filter((row) => !searching || matches(term, row.storeName, row.branchName))
    .sort((a, b) => Number(b.storeActive) - Number(a.storeActive));
  const storeRows = (storeImages.data?.rows ?? [])
    .filter((row) => !searching || matches(term, row.name))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive));
  // A shop's name finds all its dishes; a dish's name finds that dish.
  const itemRows = (itemImages.data?.rows ?? []).filter(
    (row) => !searching || matches(term, row.name, row.storeName),
  );
  // Grouped by shop: forty dishes without pictures are usually four shops'
  // menus, and that is how somebody sets about fixing them.
  const itemGroups = groupByStore(itemRows);

  const all = [hours, addresses, storeImages, itemImages];
  const loaded = all.every((query) => query.isSuccess);
  const total =
    (hours.data?.rows.length ?? 0) +
    (addresses.data?.rows.length ?? 0) +
    (storeImages.data?.rows.length ?? 0) +
    (itemImages.data?.rows.length ?? 0);
  const truncated = all.some((query) => query.data?.truncated);
  const allDone = loaded && total === 0;

  /** Which groups have nothing left, in page order. */
  const groupsDone = all.map(
    (query) => query.isSuccess && query.data.rows.length === 0,
  );
  const doneCount = groupsDone.filter(Boolean).length;
  /** The first group with work in it opens by itself — the guide's "current step". */
  const firstOpen = all.findIndex(
    (query) => query.isSuccess && query.data.rows.length > 0,
  );
  // From the whole lists, not the searched ones: the next step does not move
  // because somebody typed a name.
  const next = loaded
    ? nextStep({
        hours: hours.data?.rows ?? [],
        addresses: addresses.data?.rows ?? [],
        storeImages: storeImages.data?.rows ?? [],
        itemImages: itemImages.data?.rows ?? [],
      })
    : null;

  return (
    <Page>
      <PageHeader
        title={t("todo.title")}
        description={t("todo.blurb")}
        meta={
          loaded && total > 0 ? (
            <Badge
              tone={hoursRows.length > 0 && !searching ? "danger" : "neutral"}
            >
              {total === 1
                ? t("todo.remainingOne")
                : t("todo.remaining", {
                    count: truncated ? `${total}+` : total,
                  })}
            </Badge>
          ) : undefined
        }
      />

      {allDone ? (
        <Card padded={false}>
          <EmptyState
            icon={<PartyPopper />}
            title={t("todo.allDoneTitle")}
            description={t("todo.allDoneBody")}
          />
        </Card>
      ) : (
        <>
          {loaded && <Guide done={doneCount} of={all.length} next={next} />}

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("todo.search")}
            className="-my-3"
          />

          <div className="flex flex-col gap-4">
            <TodoGroup
              icon={<Clock />}
              titleKey="todo.hoursTitle"
              bodyKey="todo.hoursBody"
              doneKey="todo.hoursDone"
              query={hours}
              count={hoursRows.length}
              searching={searching}
              current={firstOpen === 0}
              urgent
            >
              <ul className="divide-y divide-line">
                {hoursRows.map((row) => (
                  <li key={row.storeId}>
                    <TodoRow
                      href={todoHref.hours(row.storeId, row.branches[0]?.id)}
                      title={pickLocalized(row.storeName)}
                      hidden={!row.storeActive}
                      // A one-branch shop is "no hours"; a chain names which
                      // of its places are missing them.
                      detail={
                        row.branchCount > 1
                          ? t("todo.hoursBranches", {
                              names: row.branches
                                .map((branch) => pickLocalized(branch.name))
                                .join(", "),
                              count: row.branches.length,
                              total: row.branchCount,
                            })
                          : t("todo.hoursNone")
                      }
                      actionKey="todo.setHours"
                    />
                  </li>
                ))}
              </ul>
            </TodoGroup>

            <TodoGroup
              icon={<MapPin />}
              titleKey="todo.addressTitle"
              bodyKey="todo.addressBody"
              doneKey="todo.addressDone"
              query={addresses}
              count={addressRows.length}
              searching={searching}
              current={firstOpen === 1}
            >
              <ul className="divide-y divide-line">
                {addressRows.map((row) => (
                  <li key={row.branchId}>
                    <TodoRow
                      href={todoHref.address(
                        row.storeId,
                        row.branchId,
                        row.branchCount,
                      )}
                      title={pickLocalized(row.storeName)}
                      hidden={!row.storeActive}
                      detail={
                        row.branchCount > 1
                          ? pickLocalized(row.branchName)
                          : undefined
                      }
                      actionKey="todo.addAddress"
                    />
                  </li>
                ))}
              </ul>
            </TodoGroup>

            <TodoGroup
              icon={<Store />}
              titleKey="todo.storeImagesTitle"
              bodyKey="todo.storeImagesBody"
              doneKey="todo.storeImagesDone"
              query={storeImages}
              count={storeRows.length}
              searching={searching}
              current={firstOpen === 2}
            >
              <ul className="divide-y divide-line">
                {storeRows.map((row) => (
                  <li key={row.id}>
                    <TodoRow
                      href={todoHref.storeImage(row.id)}
                      title={pickLocalized(row.name)}
                      hidden={!row.isActive}
                      actionKey="todo.addPicture"
                    />
                  </li>
                ))}
              </ul>
            </TodoGroup>

            <TodoGroup
              icon={<ImageIcon />}
              titleKey="todo.itemImagesTitle"
              bodyKey="todo.itemImagesBody"
              doneKey="todo.itemImagesDone"
              query={itemImages}
              count={itemRows.length}
              searching={searching}
              current={firstOpen === 3}
            >
              {itemGroups.map((group) => (
                <div key={group.storeId}>
                  {/* Sticky, so a long run of dishes still says whose menu
                      it is. */}
                  <h3 className="sticky top-0 z-[1] flex items-baseline gap-2 border-y border-line bg-subtle px-5 py-2 text-[13px] font-semibold text-ink">
                    <span className="truncate">
                      {pickLocalized(group.storeName)}
                    </span>
                    <span className="shrink-0 text-[12px] font-normal text-ink-3">
                      {group.items.length === 1
                        ? t("todo.itemsOne")
                        : t("todo.items", { count: group.items.length })}
                    </span>
                  </h3>
                  <ul className="divide-y divide-line">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <TodoRow
                          href={todoHref.itemImage(item.storeId, item.id)}
                          title={pickLocalized(item.name)}
                          hidden={!item.isActive}
                          actionKey="todo.addPicture"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </TodoGroup>
          </div>
        </>
      )}
    </Page>
  );
}

function TodoGroup<T>({
  icon,
  titleKey,
  bodyKey,
  doneKey,
  query,
  count,
  searching,
  urgent = false,
  current = false,
  children,
}: {
  /** The first group with work in it: open on arrival, like a guide's current step. */
  current?: boolean;
  icon: ReactNode;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  doneKey: TranslationKey;
  query: {
    isPending: boolean;
    isError: boolean;
    isSuccess: boolean;
    data?: TodoList<T>;
    refetch: () => unknown;
  };
  count: number;
  searching: boolean;
  /**
   * A gap that costs something now, not before launch: the group starts open
   * while it has rows, and wears the danger colour.
   */
  urgent?: boolean;
  children: ReactNode;
}) {
  // Null until the heading is pressed, so an urgent group can open itself once
  // its rows arrive and still be closed by hand.
  const [open, setOpen] = useState<boolean | null>(null);
  // A search opens every group it found something in — results folded away
  // behind a heading would read as no results.
  const shown =
    (open ?? ((urgent || current) && count > 0)) || (searching && count > 0);
  const panelId = useId();
  const hot = urgent && query.isSuccess && count > 0;
  const done = query.isSuccess && count === 0 && !searching;

  return (
    <section
      className={cx(
        "rounded-lg border bg-surface shadow-xs",
        hot ? "border-danger/30" : "border-line",
      )}
    >
      <h2>
        <button
          type="button"
          onClick={() => setOpen(!shown)}
          aria-expanded={shown}
          aria-controls={panelId}
          className="flex w-full items-start gap-3.5 rounded-lg px-5 py-4 text-start transition-colors hover:bg-subtle"
        >
          <span
            aria-hidden
            className={cx(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md [&_svg]:size-[18px]",
              hot
                ? "bg-danger-soft text-danger"
                : done
                  ? "bg-success-soft text-success"
                  : "bg-hover text-ink-3",
            )}
          >
            {done ? <Check /> : icon}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">
              {t(titleKey)}
              {query.isPending && <Skeleton className="h-5 w-8 rounded-full" />}
              {query.isSuccess && count > 0 && (
                <Badge tone={hot ? "danger" : "neutral"}>
                  <span className="tabular-nums">
                    {count}
                    {query.data?.truncated && !searching && "+"}
                  </span>
                </Badge>
              )}
              {hot && <Badge tone="danger">{t("todo.urgent")}</Badge>}
              {done && (
                <Badge tone="success" dot>
                  {t("todo.done")}
                </Badge>
              )}
            </span>
            <span className="text-[13px] font-normal text-ink-3">
              {t(bodyKey)}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cx(
              "mt-2 size-4 shrink-0 text-ink-4 transition-transform",
              shown && "rotate-180",
            )}
          />
        </button>
      </h2>

      {shown && (
        <div id={panelId} className="border-t border-line">
          {query.isPending && (
            <div aria-busy className="flex flex-col gap-3 px-5 py-4">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-4 w-2/3" />
              ))}
            </div>
          )}

          {query.isError && (
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <AlertCircle className="size-4 shrink-0 text-danger" />
              <p role="alert" className="flex-1 text-[13.5px] text-danger-ink">
                {t("todo.failed")}
              </p>
              <Button size="sm" onClick={() => void query.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          )}

          {query.isSuccess && count === 0 && (
            // An empty group is the good news this page exists to deliver, so
            // it is said in green. A search that found nothing is not that.
            <p
              className={cx(
                "flex items-center gap-2 px-5 py-4 text-[13.5px] font-medium",
                searching ? "text-ink-3" : "text-success-ink",
              )}
            >
              {!searching && <Check className="size-4" />}
              {searching ? t("todo.noMatch") : t(doneKey)}
            </p>
          )}

          {query.isSuccess && count > 0 && children}

          {query.data?.truncated && (
            <p className="border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
              {t("todo.truncated")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function TodoRow({
  href,
  title,
  detail,
  hidden,
  actionKey,
}: {
  href: string;
  title: string;
  detail?: string;
  hidden: boolean;
  actionKey: TranslationKey;
}) {
  return (
    <LinkRow href={href} className="px-5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cx(
              "truncate text-[14px] font-medium",
              hidden ? "text-ink-3" : "text-ink",
            )}
          >
            {title}
          </span>
          {hidden && <Badge>{t("todo.hidden")}</Badge>}
        </span>
        {detail && (
          <span className="truncate text-[12.5px] text-ink-3">{detail}</span>
        )}
      </div>
      {/* The words go on a phone and the chevron stays: the whole row is the
          link, and the group's heading already says what the fix is. */}
      <span className="shrink-0 text-[13px] font-medium text-accent-ink max-sm:sr-only">
        {t(actionKey)}
      </span>
    </LinkRow>
  );
}

type NextStep = { href: string; label: string; urgentStep: boolean };

/**
 * The one fix to make next, in the page's order of cost: hours (a shop
 * taking orders at 4 a.m.), then addresses (required), then pictures. Live
 * shops before hidden ones within each, because a live gap is one a
 * customer is looking at.
 */
function nextStep(lists: {
  hours: HoursTodo[];
  addresses: AddressTodo[];
  storeImages: StoreTodo[];
  itemImages: ItemTodo[];
}): NextStep | null {
  const live = <T,>(rows: T[], active: (row: T) => boolean) =>
    rows.find(active) ?? rows[0];

  const hours = live(lists.hours, (row) => row.storeActive);
  if (hours) {
    return {
      href: todoHref.hours(hours.storeId, hours.branches[0]?.id),
      label: t("todo.nextHours", { name: pickLocalized(hours.storeName) }),
      urgentStep: true,
    };
  }
  const address = live(lists.addresses, (row) => row.storeActive);
  if (address) {
    return {
      href: todoHref.address(
        address.storeId,
        address.branchId,
        address.branchCount,
      ),
      label: t("todo.nextAddress", {
        name:
          address.branchCount > 1
            ? `${pickLocalized(address.storeName)}, ${pickLocalized(address.branchName)}`
            : pickLocalized(address.storeName),
      }),
      urgentStep: false,
    };
  }
  const store = live(lists.storeImages, (row) => row.isActive);
  if (store) {
    return {
      href: todoHref.storeImage(store.id),
      label: t("todo.nextStoreImage", { name: pickLocalized(store.name) }),
      urgentStep: false,
    };
  }
  const item = live(lists.itemImages, (row) => row.isActive);
  if (item) {
    return {
      href: todoHref.itemImage(item.storeId, item.id),
      label: t("todo.nextItemImage", {
        name: pickLocalized(item.name),
        shop: pickLocalized(item.storeName),
      }),
      urgentStep: false,
    };
  }
  return null;
}

/**
 * Progress and the next step, at the top — Shopify's setup guide. The bar
 * counts groups, not rows: four hundred dishes without pictures is one task
 * with a long list, and a bar crawling by quarter-percents says nothing.
 */
function Guide({
  done,
  of,
  next,
}: {
  done: number;
  of: number;
  next: NextStep | null;
}) {
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-[13px] font-medium text-ink-3 tabular-nums">
          {t("todo.progress", { done, total: of })}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={of}
          aria-valuenow={done}
          aria-label={t("todo.progressLabel")}
          className="h-2 w-full max-w-md overflow-hidden rounded-full bg-hover"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${(done / Math.max(1, of)) * 100}%` }}
          />
        </div>
        {next && (
          <p className="flex min-w-0 items-center gap-2 text-[14px] text-ink">
            <span className="shrink-0 font-semibold">{t("todo.nextUp")}</span>
            <span className="truncate">{next.label}</span>
            {next.urgentStep && <Badge tone="danger">{t("todo.urgent")}</Badge>}
          </p>
        )}
      </div>
      {next && (
        <Link
          href={next.href}
          className={cx(buttonClass({ variant: "primary" }), "shrink-0")}
        >
          {t("todo.startNext")}
          <ArrowRight className="rtl:rotate-180" />
        </Link>
      )}
    </Card>
  );
}

/** Lower-case, accents and Arabic diacritics off, so a search forgives both. */
function normalise(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟ]/g, "")
    .toLowerCase()
    .trim();
}

/** Whether any language of any of these names contains the term. */
function matches(term: string, ...names: (Localized | null | undefined)[]) {
  return names.some((name) =>
    Object.values(name ?? {}).some(
      (text) => typeof text === "string" && normalise(text).includes(term),
    ),
  );
}

type ItemGroup = {
  storeId: string;
  storeName: ItemTodo["storeName"];
  items: ItemTodo[];
};

function groupByStore(items: ItemTodo[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>();
  for (const item of items) {
    const group: ItemGroup = groups.get(item.storeId) ?? {
      storeId: item.storeId,
      storeName: item.storeName,
      items: [],
    };
    group.items.push(item);
    groups.set(item.storeId, group);
  }
  return [...groups.values()];
}
