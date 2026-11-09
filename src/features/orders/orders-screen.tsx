"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Columns3,
  Inbox,
  List,
  PanelRightOpen,
  SearchX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  Button,
  EmptyState,
  Kbd,
  ListSkeleton,
  SearchInput,
  Segmented,
  Sheet,
  Tooltip,
  cx,
} from "@/components/ui";
import { ResizeHandle, useStoredWidth } from "@/components/ui/resizable";
import { useMoney } from "@/features/reference/use-currencies";
import { t, type TranslationKey } from "@/i18n/translations";
import { statusTone } from "@/lib/order-status";

import type { Order, Scope } from "./api/orders";
import { useTick } from "./order-age";
import { OrderBoard } from "./order-board";
import { OrderPanel } from "./order-panel";
import { OrderRow } from "./order-row";
import {
  nextStatus,
  orderStatus,
  useAdvanceOrder,
  useOrderStatuses,
  useOrders,
  useStatusCounts,
} from "./use-orders";

const SCOPES: Scope[] = ["live", "today", "all"];
type View = "list" | "board";
const VIEW_KEY = "orders.view";
const DEFAULT_STATUS = "ordered";
const ALL_STATUSES = "all";

const EMPTY: Record<Scope, { title: TranslationKey; body: TranslationKey }> = {
  live: { title: "orders.liveEmptyTitle", body: "orders.liveEmptyBody" },
  today: { title: "orders.todayEmptyTitle", body: "orders.todayEmptyBody" },
  all: { title: "orders.allEmptyTitle", body: "orders.allEmptyBody" },
};

function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

/**
 * List or board, remembered per browser. On the server (and the first paint)
 * it is null and the queue shows its skeleton, so it never flashes one layout
 * and swaps to the other.
 *
 * With nothing remembered, a desk-sized screen gets the board — every live
 * step at once — and a phone the list, which is the layout that fits one.
 */
const viewListeners = new Set<() => void>();
// Holds the choice for this visit when storage refuses it (private window).
let chosenView: View | null = null;

function readView(): View {
  if (chosenView) return chosenView;
  try {
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "list" || stored === "board") return stored;
  } catch {
    // Storage refused; the default below stands.
  }
  return window.matchMedia("(min-width: 1024px)").matches ? "board" : "list";
}

function subscribeView(listener: () => void) {
  viewListeners.add(listener);
  return () => {
    viewListeners.delete(listener);
  };
}

function usePreferredView() {
  const view = useSyncExternalStore<View | null>(
    subscribeView,
    readView,
    () => null,
  );
  const remember = useCallback((next: View) => {
    chosenView = next;
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; the choice still holds for this visit.
    }
    viewListeners.forEach((listener) => listener());
  }, []);
  return [view, remember] as const;
}

/**
 * The queue. Orders down the left (or the live steps as a board), the open
 * order's receipt docked on the right — so the operator reads, decides and
 * moves an order without leaving the queue.
 *
 * Live orders are worked **oldest first**, like a ticket rail: the order that
 * has waited longest is at the top, and its waiting time turns amber, then red
 * (`order-age.tsx`). Today and All orders are history, newest first.
 *
 * Everything that defines the view lives in the URL (`scope`, `status`,
 * `order`, `q`, `view`), so a view can be shared, reloaded or opened from
 * search.
 */
export function OrdersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const wide = useWide();
  const now = useTick();
  const [preferredView, rememberView] = usePreferredView();

  const scope: Scope = SCOPES.includes(params.get("scope") as Scope)
    ? (params.get("scope") as Scope)
    : "live";
  const rawStatus = params.get("status");
  // A search arriving from the command palette looks across every status.
  const statusSlug =
    rawStatus === ALL_STATUSES || (rawStatus === null && params.get("q"))
      ? null
      : (rawStatus ?? DEFAULT_STATUS);
  const openOrderId = params.get("order");
  const live = scope === "live";
  const rawView = params.get("view");
  // The board is for live work only; a search is a list question.
  const view: View | null = !live
    ? "list"
    : rawView === "list" || rawView === "board"
      ? rawView
      : preferredView;

  const [search, setSearch] = useState(params.get("q") ?? "");
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const replace = useCallback(
    (edit: (query: URLSearchParams) => void) => {
      const query = new URLSearchParams(params);
      edit(query);
      const text = query.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  const setScope = (next: Scope) =>
    replace((q) =>
      next === "live" ? q.delete("scope") : q.set("scope", next),
    );

  const setView = (next: View) => {
    rememberView(next);
    replace((q) => q.delete("view"));
  };

  const setStatus = (next: string | null) =>
    replace((q) => {
      const value = next ?? ALL_STATUSES;
      if (value === DEFAULT_STATUS) q.delete("status");
      else q.set("status", value);
      q.delete("order");
    });

  const setOpen = useCallback(
    (id: string | null) =>
      replace((q) => (id ? q.set("order", id) : q.delete("order"))),
    [replace],
  );

  // After a move, follow the order to its new tab so it stays in view.
  const follow = useCallback(
    (orderId: string, toSlug: string) =>
      replace((q) => {
        if (statusSlug !== null) {
          if (toSlug === DEFAULT_STATUS) q.delete("status");
          else q.set("status", toSlug);
        }
        q.set("order", orderId);
      }),
    [replace, statusSlug],
  );

  const statuses = useOrderStatuses();
  const counts = useStatusCounts(scope);
  const liveCounts = useStatusCounts("live");
  const orders = useOrders(scope, statusSlug, search);
  const { advance } = useAdvanceOrder();
  const { format } = useMoney();

  // Live orders are bounded by what is still in play, so the list reads to
  // the end and turns round: oldest first is only true once the oldest is in.
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = orders;
  useEffect(() => {
    if (live && view === "list" && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [live, view, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const rows = useMemo(() => {
    const all = orders.data?.pages.flatMap((page) => page.orders) ?? [];
    return live
      ? all.slice().sort((a, b) => a.placedAt.localeCompare(b.placedAt))
      : all;
  }, [orders.data, live]);

  // The browser tab says how many orders nobody has answered, so a dashboard
  // in a background tab still shows there is work — the chime is easy to miss.
  const waitingCount = liveCounts.data?.ordered ?? 0;
  useEffect(() => {
    const strip = (title: string) => title.replace(/^\(\d+\) /, "");
    const base = strip(document.title);
    document.title =
      waitingCount > 0
        ? t("orders.tabTitleWaiting", { count: waitingCount, title: base })
        : base;
    return () => {
      document.title = strip(document.title);
    };
  }, [waitingCount]);

  const openIndex = rows.findIndex((order) => order.id === openOrderId);
  const active =
    openIndex >= 0 ? openIndex : Math.min(cursor, Math.max(rows.length - 1, 0));

  const advanceOrder = useCallback(
    // The board advances in place: a card moves column and the operator stays
    // where they were. The list follows the order to its new tab.
    (order: Order, followIt = true) => {
      const status = orderStatus(order, statuses);
      const next = status ? nextStatus(statuses, status.slug) : null;
      if (!status || !next) return;
      advance({
        orderId: order.id,
        code: order.code,
        fromSlug: status.slug,
        toSlug: next.slug,
        toName: next.name,
      });
      if (followIt) follow(order.id, next.slug);
    },
    [advance, follow, statuses],
  );

  const select = useCallback(
    (index: number) => {
      const order = rows[index];
      if (!order) return;
      setCursor(index);
      setOpen(order.id);
    },
    [rows, setOpen],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        if (event.key === "Escape") target.blur();
        return;
      }
      if (document.querySelector("[role=dialog]")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // On the board the cards are buttons; Tab and Enter already work there.
      if (view !== "list" && event.key !== "Escape" && event.key !== "f") {
        return;
      }

      switch (event.key) {
        case "Escape":
          if (openOrderId) {
            event.preventDefault();
            setOpen(null);
          }
          break;
        case "j":
        case "ArrowDown":
          event.preventDefault();
          select(Math.min(active + 1, rows.length - 1));
          break;
        case "k":
        case "ArrowUp":
          event.preventDefault();
          select(Math.max(active - 1, 0));
          break;
        case "o":
          event.preventDefault();
          select(active);
          break;
        case "f":
          event.preventDefault();
          searchRef.current?.focus();
          break;
        case "Enter": {
          // A focused control's Enter is that control's: without this the
          // button never fired and the row under the cursor moved instead.
          if (target?.closest("button, a, [role=button]")) break;
          const order = rows[active];
          if (order) {
            event.preventDefault();
            advanceOrder(order);
          }
          break;
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, advanceOrder, openOrderId, rows, select, setOpen, view]);

  const panelOpen = openOrderId !== null;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        <div
          className={cx(
            "flex shrink-0 flex-col gap-4 px-4 pt-5 sm:px-6",
            view !== "list" && "border-b border-line pb-4",
          )}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">
              {t("orders.title")}
            </h1>
            <Segmented
              value={scope}
              onChange={setScope}
              items={[
                { key: "live", label: t("orders.scopeLive") },
                { key: "today", label: t("orders.scopeToday") },
                { key: "all", label: t("orders.scopeAll") },
              ]}
            />
            <div className="ms-auto flex w-full items-center gap-2 sm:w-auto">
              <SearchInput
                ref={searchRef}
                value={search}
                onChange={setSearch}
                placeholder={t("orders.searchPlaceholder")}
                className="min-w-0 flex-1 sm:w-64 sm:flex-none"
              />
              {live && view && (
                <div aria-label={t("orders.viewLabel")} className="shrink-0">
                  <Segmented
                    value={view}
                    onChange={setView}
                    items={[
                      {
                        key: "list",
                        label: (
                          <span className="flex items-center gap-1.5">
                            <List aria-hidden className="size-4" />
                            <span className="sr-only sm:not-sr-only">
                              {t("orders.viewList")}
                            </span>
                          </span>
                        ),
                      },
                      {
                        key: "board",
                        label: (
                          <span className="flex items-center gap-1.5">
                            <Columns3 aria-hidden className="size-4" />
                            <span className="sr-only sm:not-sr-only">
                              {t("orders.viewBoard")}
                            </span>
                          </span>
                        ),
                      },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>

          {view === "list" && (
            <div
              role="tablist"
              className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 shadow-[inset_0_-1px_0_var(--color-line)] scrollbar-thin"
            >
              <StatusTab
                label={t("orders.all")}
                active={statusSlug === null}
                onClick={() => setStatus(null)}
              />
              {statuses.map((status) => (
                <StatusTab
                  key={status.slug}
                  label={status.name}
                  dot={statusTone(status.slug).dot}
                  count={counts.data?.[status.slug]}
                  highlight={status.slug === "ordered"}
                  active={statusSlug === status.slug}
                  onClick={() => setStatus(status.slug)}
                />
              ))}
              {live && (
                <span className="ms-auto hidden shrink-0 items-center ps-3 text-[12.5px] text-ink-4 sm:flex">
                  {t("orders.oldestFirst")}
                </span>
              )}
            </div>
          )}
        </div>

        {view === null && (
          <div className="min-h-0 flex-1 bg-canvas">
            <div className="bg-surface">
              <ListSkeleton rows={8} />
            </div>
          </div>
        )}

        {view === "board" && (
          <div className="min-h-0 flex-1 bg-canvas">
            <OrderBoard
              statuses={statuses}
              counts={counts.data}
              search={search}
              now={now}
              openOrderId={openOrderId}
              onOpen={(order) => setOpen(order.id)}
              onAdvance={(order) => advanceOrder(order, false)}
              onMove={(order, from, to) =>
                // The same guarded move as the buttons: `fromSlug` is what
                // the card showed, so a drop on an order somebody else has
                // just moved is refused rather than rewinding their move.
                advance({
                  orderId: order.id,
                  code: order.code,
                  fromSlug: from.slug,
                  toSlug: to.slug,
                  toName: to.name,
                })
              }
            />
          </div>
        )}

        {view === "list" && (
          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto bg-canvas scrollbar-thin"
          >
            {orders.isPending && (
              <div className="bg-surface">
                <ListSkeleton rows={8} />
              </div>
            )}

            {orders.isError && (
              <EmptyState
                icon={<AlertCircle />}
                title={t("orders.failedTitle")}
                description={t("orders.failedBody")}
                action={
                  <Button onClick={() => void orders.refetch()}>
                    {t("common.retry")}
                  </Button>
                }
              />
            )}

            {orders.isSuccess && rows.length === 0 && (
              <EmptyState
                icon={search ? <SearchX /> : <Inbox />}
                title={t(search ? "orders.noMatchTitle" : EMPTY[scope].title)}
                description={t(
                  search ? "orders.noMatchBody" : EMPTY[scope].body,
                )}
              />
            )}

            {rows.length > 0 && (
              <ul className="divide-y divide-line border-b border-line bg-surface">
                {rows.map((order, index) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    statuses={statuses}
                    money={format}
                    now={now}
                    selected={order.id === openOrderId}
                    focused={index === active && !panelOpen}
                    compact={panelOpen && wide}
                    onOpen={() => select(index)}
                    onAdvance={() => advanceOrder(order)}
                  />
                ))}
              </ul>
            )}

            {!live && orders.hasNextPage && (
              <LoadMore
                loading={orders.isFetchingNextPage}
                onLoadMore={() => void orders.fetchNextPage()}
              />
            )}
          </div>
        )}

        <footer className="hidden shrink-0 items-center gap-5 border-t border-line bg-surface px-6 py-2.5 text-[12px] text-ink-3 md:flex">
          {view === "list" && (
            <>
              <span className="flex items-center gap-1.5">
                <Kbd>J</Kbd>
                <Kbd>K</Kbd>
                {t("orders.keyboardMove")}
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>Enter</Kbd>
                {t("orders.keyboardAdvance")}
              </span>
            </>
          )}
          <span className="flex items-center gap-1.5">
            <Kbd>F</Kbd>
            {t("orders.keyboardSearch")}
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>⌘Z</Kbd>
            {t("orders.keyboardUndo")}
          </span>
          <span className="ms-auto flex items-center gap-1.5 font-medium text-success-ink">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {t("orders.live")}
          </span>
        </footer>
      </div>

      {panelOpen && wide && openOrderId && (
        <DockedPanel
          orderId={openOrderId}
          onClose={() => setOpen(null)}
          onMoved={(toSlug) => follow(openOrderId, toSlug)}
        />
      )}

      {!wide && (
        <Sheet
          open={panelOpen}
          onOpenChange={(open) => !open && setOpen(null)}
          title={t("orders.panelLabel")}
        >
          {openOrderId && (
            <div className="-mx-6 -my-5 h-[calc(100dvh-65px)]">
              <OrderPanel
                orderId={openOrderId}
                embedded
                onClose={() => setOpen(null)}
                onMoved={(toSlug) => follow(openOrderId, toSlug)}
              />
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function StatusTab({
  label,
  count,
  dot,
  active,
  highlight,
  onClick,
}: {
  label: string;
  count?: number;
  dot?: string;
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "relative flex h-10 shrink-0 items-center gap-2 border-b-2 px-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors",
        active
          ? "border-ink text-ink"
          : "border-transparent text-ink-3 hover:text-ink",
      )}
    >
      {dot && (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: dot }}
        />
      )}
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cx(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums",
            highlight
              ? "bg-status-ordered-fill text-white"
              : active
                ? "bg-ink text-white"
                : "bg-hover text-ink-2",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Loads the next page when scrolled into view, with a button as fallback. */
function LoadMore({
  loading,
  onLoadMore,
}: {
  loading: boolean;
  onLoadMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onLoadMore);
  useEffect(() => {
    callback.current = onLoadMore;
  }, [onLoadMore]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && callback.current(),
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="flex justify-center py-5">
      <Button variant="ghost" size="sm" pending={loading} onClick={onLoadMore}>
        {t("orders.loadMore")}
      </Button>
    </div>
  );
}

const PANEL = {
  /** Folded to a strip. */
  collapsed: 48,
  /** Dragged narrower than this, it folds rather than squeezing the receipt. */
  snap: 300,
  min: 380,
  default: 460,
  max: 960,
};

/**
 * The receipt docked beside the queue. Its left edge drags it wider (to read
 * a long order) or narrower (to see more of the queue); pulled past the snap
 * point, or with its collapse button, it folds to a strip that keeps the
 * order open, one click from coming back. The width is remembered.
 */
function DockedPanel({
  orderId,
  onClose,
  onMoved,
}: {
  orderId: string;
  onClose: () => void;
  onMoved: (toSlug: string) => void;
}) {
  const [width, setWidth] = useStoredWidth(
    "lebrunji-admin:order-panel-width",
    PANEL.default,
  );
  const collapsed = width < PANEL.min;

  function resize(next: number) {
    if (next < PANEL.snap) setWidth(PANEL.collapsed);
    else setWidth(Math.min(PANEL.max, Math.max(PANEL.min, next)));
  }

  return (
    <aside
      style={{ width }}
      className="relative shrink-0 border-s border-line bg-surface"
    >
      <ResizeHandle
        edge="start"
        width={width}
        min={PANEL.collapsed}
        max={PANEL.max}
        onResize={resize}
        onReset={() => setWidth(PANEL.default)}
        label={t("orders.resizePanel")}
      />
      {collapsed ? (
        <div className="flex h-full flex-col items-center gap-2 py-3">
          <Tooltip content={t("orders.expandPanel")} side="left">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("orders.expandPanel")}
              onClick={() => setWidth(PANEL.default)}
            >
              <PanelRightOpen className="rtl:rotate-180" />
            </Button>
          </Tooltip>
          <Tooltip content={t("common.close")} side="left">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              <X />
            </Button>
          </Tooltip>
        </div>
      ) : (
        <OrderPanel
          orderId={orderId}
          onClose={onClose}
          onMoved={onMoved}
          onCollapse={() => setWidth(PANEL.collapsed)}
        />
      )}
    </aside>
  );
}
