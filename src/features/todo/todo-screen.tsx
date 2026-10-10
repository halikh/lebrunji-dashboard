"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button, cx } from "@/components/ui";
import { Collapse } from "@/components/ui/collapse";
import { ROW, ROW_TARGET } from "@/components/ui/row";
import { SearchInput } from "@/components/ui/search-input";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import {
  fetchItemsWithoutImage,
  fetchStoresWithoutHours,
  fetchStoresWithoutImage,
  type ItemTodo,
  type TodoList,
} from "./api/todo";

const todoKeys = {
  all: ["todo"] as const,
  storeImages: ["todo", "store-images"] as const,
  itemImages: ["todo", "item-images"] as const,
  hours: ["todo", "hours"] as const,
};

/**
 * What is left to do before the catalogue looks finished.
 *
 * Three lists, each a row per thing with a link straight to where it is
 * fixed, so the page is worked *through* rather than read. Hours first: a shop
 * with no hours cannot be ordered from at all, where a missing picture only
 * looks unfinished.
 *
 * Refetched on every visit (`staleTime: 0`): this is the page somebody comes
 * back to after fixing three things, and a cached list still showing them
 * would say the fixes did not land.
 */
export function TodoScreen() {
  const [search, setSearch] = useState("");

  const hours = useQuery({
    queryKey: todoKeys.hours,
    queryFn: fetchStoresWithoutHours,
    staleTime: 0,
  });
  const storeImages = useQuery({
    queryKey: todoKeys.storeImages,
    queryFn: fetchStoresWithoutImage,
    staleTime: 0,
  });
  const itemImages = useQuery({
    queryKey: todoKeys.itemImages,
    queryFn: fetchItemsWithoutImage,
    staleTime: 0,
  });

  // Filtered here rather than in the queries. These lists are what is *left*,
  // short by nature and already fully downloaded, so a browser-side filter
  // searches all of it — the reason the rest of the dashboard asks the
  // database does not apply. A capped list says so under itself regardless.
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-md border-b border-border bg-surface px-xxl py-lg">
        <div className="flex flex-col gap-xxs">
          <h1 className="text-[30px]">{t("todo.title")}</h1>
          <p className="text-[14px] text-text-soft">{t("todo.blurb")}</p>
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("todo.search")}
        />
      </div>

      {/* No vertical padding on the scroller itself: a sticky heading sticks
          to the scroller's edge, and padding there would leave a strip above
          it for the rows to show through as they pass.

          And no `scroll-hint`, alone among the panes: its top-edge shadow is
          drawn whenever the pane is scrolled, which here is always under a
          sticky heading — a shadow beneath a heading that is not raised. */}
      <div className="flex min-h-0 flex-grow flex-col overflow-y-auto bg-background">
        <div className="flex flex-col gap-lg px-xxl pb-xxl pt-sm">
          <TodoSection
            titleKey="todo.hoursTitle"
            bodyKey="todo.hoursBody"
            query={hours}
            count={hoursRows.length}
            doneKey="todo.hoursDone"
            searching={searching}
          >
            {hoursRows.map((row) => (
              <TodoRow
                key={row.storeId}
                href={`/catalogue/${row.storeId}?tab=hours${
                  row.branches.length > 0 ? `&branch=${row.branches[0].id}` : ""
                }`}
                title={pickLocalized(row.storeName)}
                hidden={!row.storeActive}
                detail={
                  // A one-branch shop is "no hours"; a chain names which of
                  // its places are missing them.
                  row.branchCount > 1
                    ? t("todo.hoursBranches", {
                        names: row.branches
                          .map((branch) => pickLocalized(branch.name))
                          .join(" · "),
                        count: row.branches.length,
                        total: row.branchCount,
                      })
                    : t("todo.hoursNone")
                }
                actionKey="todo.setHours"
              />
            ))}
          </TodoSection>

          <TodoSection
            titleKey="todo.storeImagesTitle"
            bodyKey="todo.storeImagesBody"
            query={storeImages}
            count={storeRows.length}
            doneKey="todo.storeImagesDone"
            searching={searching}
          >
            {storeRows.map((row) => (
              <TodoRow
                key={row.id}
                href={`/catalogue/${row.id}?tab=details`}
                title={pickLocalized(row.name)}
                hidden={!row.isActive}
                actionKey="todo.addPicture"
              />
            ))}
          </TodoSection>

          <TodoSection
            titleKey="todo.itemImagesTitle"
            bodyKey="todo.itemImagesBody"
            query={itemImages}
            count={itemRows.length}
            doneKey="todo.itemImagesDone"
            searching={searching}
          >
            {itemGroups.map((group) => (
              <div key={group.storeId} className="flex flex-col gap-sm">
                {/* Sticky under the section's own heading, so a long run of
                    dishes still says whose menu it is. `--todo-head` is that
                    heading's height, measured by the section.
 */}
                <h3 className="sticky top-[var(--todo-head)] z-10 flex items-baseline gap-sm bg-background pb-xs pt-sm text-[17px]">
                  {pickLocalized(group.storeName)}
                  <span className="font-sans text-[12px] font-medium text-text-faint">
                    {group.items.length === 1
                      ? t("todo.itemsOne")
                      : t("todo.items", { count: group.items.length })}
                  </span>
                </h3>
                {group.items.map((item) => (
                  <TodoRow
                    key={item.id}
                    href={`/catalogue/${item.storeId}/items/${item.id}`}
                    title={pickLocalized(item.name)}
                    hidden={!item.isActive}
                    actionKey="todo.addPicture"
                  />
                ))}
              </div>
            ))}
          </TodoSection>
        </div>
      </div>
    </div>
  );
}

function TodoSection<T>({
  titleKey,
  bodyKey,
  doneKey,
  query,
  count,
  searching,
  children,
}: {
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
  children: ReactNode;
}) {
  // Closed by default: the page opens on three headings and three counts,
  // which is the summary, and a section is opened to work through it.
  const [open, setOpen] = useState(false);
  // A search opens every section it found something in — results folded
  // away behind a heading would read as no results.
  const shown = open || (searching && count > 0);
  const panelId = useId();

  // The heading's height, for the shop names sticking beneath it. Measured
  // rather than guessed: the blurb wraps on a narrow window, and a guessed
  // offset would tuck the shop name under the heading or leave a gap.
  const section = useRef<HTMLElement>(null);
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = head.current;
    const host = section.current;
    if (!node || !host) return;
    const observer = new ResizeObserver(() => {
      host.style.setProperty("--todo-head", `${node.offsetHeight}px`);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={section} className="flex flex-col">
      {/* Sticky, so the section being worked through is always named at the
          top while its rows scroll by. The page's ground behind it, so the
          rows pass underneath rather than through. */}
      <div ref={head} className="sticky top-0 z-20 bg-background pb-sm pt-md">
        {/* The heading opens and closes the section, as a menu section's
            does — the whole heading row is the target, the chevron turns with
            it, and the count stays visible closed, since closed it is the
            whole of what the section says. */}
        <button
          type="button"
          onClick={() => setOpen(!shown)}
          aria-expanded={shown}
          aria-controls={panelId}
          className="flex w-full items-start gap-md rounded-md px-xxs py-xs text-left"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={cx(
              "mt-[9px] shrink-0 text-text-faint duration-[var(--duration-expand)] ease-[var(--ease-arrive)]",
              shown && "rotate-90",
            )}
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
          <span className="flex min-w-0 flex-col gap-xxs">
            <h2 className="flex items-center gap-sm text-[22px]">
              {t(titleKey)}
              {query.isSuccess && count > 0 && (
                <span className="flex h-[24px] min-w-[24px] items-center justify-center rounded-full bg-active-fill px-sm font-sans text-[13px] font-medium text-on-active tabular-nums">
                  {count}
                  {query.data?.truncated && !searching && "+"}
                </span>
              )}
              {query.isSuccess && count === 0 && !searching && (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="text-accent-deep"
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </h2>
            <span className="text-[13px] text-text-soft">{t(bodyKey)}</span>
          </span>
        </button>
      </div>

      <Collapse open={shown}>
        {/* Indented to where the title's text starts — past the chevron (14),
            its gap (12) and the button's own inset (2) — so the title, the
            shop names and the tiles all share one left edge. */}
        <div id={panelId} className="flex flex-col gap-sm pb-sm pl-[28px]">
          {query.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-[60px] rounded-lg bg-line-soft" />
              ))}
            </div>
          )}

          {query.isError && (
            <div className="flex items-center gap-md rounded-lg bg-danger-wash px-lg py-md">
              <p role="alert" className="flex-grow text-[14px] text-danger">
                {t("todo.failed")}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void query.refetch()}
              >
                {t("common.retry")}
              </Button>
            </div>
          )}

          {query.isSuccess && count === 0 && (
            <p
              className={cx(
                "flex items-center gap-sm rounded-lg bg-surface px-lg py-md text-[14px] font-medium shadow-card",
                searching ? "text-text-soft" : "text-accent-deep",
              )}
            >
              {/* Said, and in green: an empty to-do list is the good news
                  this page exists to deliver. A search that found nothing is
                  not that, and says so plainly. */}
              {!searching && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
              {searching ? t("todo.noMatch") : t(doneKey)}
            </p>
          )}

          {query.isSuccess && count > 0 && children}

          {query.data?.truncated && (
            <p className="px-xxs text-[12px] text-text-faint">
              {t("todo.truncated")}
            </p>
          )}
        </div>
      </Collapse>
    </section>
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
    <div
      className={cx(
        ROW,
        "border-transparent",
        hidden && "bg-neutral-fill/60 shadow-none",
      )}
    >
      <div className="flex min-w-0 flex-grow flex-col gap-xxs">
        <span className="flex min-w-0 items-center gap-sm">
          {/* The whole row is the link — see `ROW_TARGET`. */}
          <Link
            href={href}
            className={cx(
              "truncate text-[15px] font-medium text-text",
              ROW_TARGET,
            )}
          >
            {title}
          </Link>
          {hidden && (
            <span className="flex h-[22px] shrink-0 items-center rounded-full bg-line-soft px-[9px] text-[11px] font-medium text-text-soft">
              {t("todo.hidden")}
            </span>
          )}
        </span>
        {detail && (
          <span className="truncate text-[13px] text-text-soft">{detail}</span>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-xs text-[14px] font-medium text-text">
        {t(actionKey)}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </div>
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
