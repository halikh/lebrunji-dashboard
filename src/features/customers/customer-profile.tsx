"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  MapPin,
  MapPinOff,
  Phone,
  Receipt,
  Tag,
} from "lucide-react";
import { useCallback, useMemo, type ReactNode } from "react";

import {
  Badge,
  Button,
  Card,
  Copyable,
  DescriptionList,
  EmptyState,
  ListSkeleton,
  MapView,
  Notice,
  Page,
  PageHeader,
  RecordSkeleton,
  Section,
  Sheet,
  Skeleton,
  StatusBadge,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  TwoColumn,
  cx,
} from "@/components/ui";
import { BarChart, HeatStrip } from "@/components/ui/chart";
import { InfiniteSentinel } from "@/components/ui/infinite-sentinel";
import { OrderPanel } from "@/features/orders/order-panel";
import { Price } from "@/features/reference/price";
import { useMoney } from "@/features/reference/use-currencies";
import { useClock } from "@/features/settings/use-clock";
import { t, type TranslationKey } from "@/i18n/translations";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatMonthKey, formatRelative } from "@/lib/time";

import { useAccountActions } from "./account-actions";
import type {
  CustomerAddress,
  CustomerDetail,
  CustomerOrder,
  CustomerRedemption,
  CustomerStats,
} from "./api/customers";
import { CustomerStatus, nameOf } from "./customer-status";
import {
  useCustomer,
  useCustomerOrders,
  useCustomerRedemptions,
  useCustomerStats,
} from "./use-customers";

/** Sunday-first, matching the stored index of `byWeekday`. */
const WEEKDAY_SHORT: TranslationKey[] = [
  "customers.weekdayShort.sun",
  "customers.weekdayShort.mon",
  "customers.weekdayShort.tue",
  "customers.weekdayShort.wed",
  "customers.weekdayShort.thu",
  "customers.weekdayShort.fri",
  "customers.weekdayShort.sat",
];

/**
 * One customer, in full: who they are, how to reach them, what they have
 * bought, where they live, what promotions they have had.
 *
 * - **A page, not a panel**, so it is a URL an operator on the phone can send
 *   to a colleague, and the maps get room.
 * - **Four queries that paint as they arrive.** The name and the phone are what
 *   somebody on a call needs now; totalling a hundred orders should not hold
 *   them up. Each block has its own loading and error state.
 * - **One page, two columns** (Shopify, Stripe): what they have done on the
 *   left, who they are and where they live on the right. No tabs — see
 *   `ProfileBody`.
 * - **An order opens over the page** (`?order=`) in the queue's own receipt,
 *   so reading one line of a history does not lose the history.
 * - **Back is the header's**, which goes to the page before — the order, the
 *   queue or the list, whichever it was.
 */
export function CustomerProfile({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const openOrder = params.get("order");

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

  const setOpenOrder = useCallback(
    (orderId: string | null) =>
      replace((q) => (orderId ? q.set("order", orderId) : q.delete("order"))),
    [replace],
  );

  const customer = useCustomer(id);
  const stats = useCustomerStats(id);
  const orders = useCustomerOrders(id);
  const redemptions = useCustomerRedemptions(id);

  const orderRows = useMemo(
    () => orders.data?.pages.flatMap((page) => page.orders) ?? [],
    [orders.data],
  );

  /**
   * What promotions have taken off, per currency — a sum across two
   * currencies is a number in no currency at all (`0028`).
   */
  const saved = useMemo(() => {
    const totals = new Map<string, number>();
    for (const one of redemptions.data ?? []) {
      totals.set(
        one.currencyCode,
        (totals.get(one.currencyCode) ?? 0) + one.amount,
      );
    }
    return [...totals.entries()];
  }, [redemptions.data]);

  if (customer.isPending) {
    return (
      <Page>
        <RecordSkeleton />
      </Page>
    );
  }

  if (customer.isError || !customer.data) {
    return (
      <Page>
        <PageHeader title={t("customers.title")} />
        <Card padded={false}>
          <EmptyState
            icon={<AlertCircle />}
            title={t("customers.profileFailedTitle")}
            description={t("customers.profileFailedBody")}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => void customer.refetch()}>
                  {t("common.retry")}
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/customers">{t("customers.backToList")}</Link>
                </Button>
              </div>
            }
          />
        </Card>
      </Page>
    );
  }

  const row = customer.data;

  return (
    <Page>
      <ProfileBody
        row={row}
        name={nameOf(row)}
        closed={row.deletedAt !== null}
        stats={stats}
        saved={saved}
        orders={orders}
        orderRows={orderRows}
        redemptions={redemptions}
        onOpenOrder={setOpenOrder}
      />

      {/* The queue's own receipt, over the profile — same component, so a
          field added there appears here without anybody remembering to. */}
      <Sheet
        open={openOrder !== null}
        onOpenChange={(open) => !open && setOpenOrder(null)}
        title={t("orders.panelLabel")}
        width="lg"
      >
        {openOrder && (
          <div className="-mx-6 -my-5 h-[calc(100dvh-65px)]">
            <OrderPanel
              orderId={openOrder}
              embedded
              onClose={() => setOpenOrder(null)}
            />
          </div>
        )}
      </Sheet>
    </Page>
  );
}

/**
 * The record itself, laid out the way Shopify and Stripe lay out a customer:
 * the header names them and carries the account actions under ⋯; the main
 * column is what they have done (lifetime figures, the shape of their
 * ordering, every order, every promotion); the side column is who they are
 * and where they live, which is what somebody on a call reads first.
 *
 * One scrolling page rather than tabs, because nothing here is long enough
 * to hide behind one, and the operator should not have to click to learn
 * that a customer's address has no pin.
 */
function ProfileBody({
  row,
  name,
  closed,
  stats,
  saved,
  orders,
  orderRows,
  redemptions,
  onOpenOrder,
}: {
  row: CustomerDetail;
  name: string;
  closed: boolean;
  stats: ReturnType<typeof useCustomerStats>;
  saved: [string, number][];
  orders: ReturnType<typeof useCustomerOrders>;
  orderRows: CustomerOrder[];
  redemptions: ReturnType<typeof useCustomerRedemptions>;
  onOpenOrder: (id: string) => void;
}) {
  const actions = useAccountActions(row);
  const phone = formatPhone(row.phone);
  const unnamed = !row.name.trim();
  // Shopify leaves out what a customer has never had; an empty promotions
  // card on most profiles would be noise. A failed read still shows, so
  // "none" and "could not tell" never look alike.
  const usedPromotions =
    redemptions.isError || (redemptions.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={cx(
                "break-words",
                unnamed && "font-medium text-ink-3 italic",
              )}
            >
              {name}
            </span>
          </span>
        }
        meta={<CustomerStatus customer={row} />}
        more={actions.items}
        actions={
          phone && !closed ? (
            // The most-wanted action on the page: the operator is usually
            // already dialling.
            <Button variant="secondary" asChild>
              <a href={`tel:${phone}`}>
                <Phone />
                {t("customers.call")}
              </a>
            </Button>
          ) : undefined
        }
      />
      {actions.dialogs}

      {closed && (
        <Notice>
          {t("customers.closedNote", {
            when: formatDate(row.deletedAt as string),
          })}
        </Notice>
      )}

      <TwoColumn
        main={
          <>
            <SummaryTiles stats={stats} saved={saved} />
            {stats.isSuccess && stats.data.orderCount > 0 && (
              <Charts stats={stats.data} />
            )}
            <Section
              title={t("customers.ordersCount", { count: row.orderCount })}
              description={t("customers.ordersBlurb")}
              bodyClassName="p-0"
            >
              <OrdersTable
                query={orders}
                rows={orderRows}
                onOpen={onOpenOrder}
                paged
              />
            </Section>
            {usedPromotions && (
              <Section
                title={t("customers.promotions")}
                description={t("customers.promotionsBlurb")}
                actions={
                  saved.length > 0 ? (
                    <span className="flex items-baseline gap-2 text-[13px] text-ink-3">
                      {t("customers.savedTotal")}
                      {saved.map(([code, amount]) => (
                        <Price
                          key={code}
                          value={amount}
                          code={code}
                          className="text-[14px] font-semibold text-success-ink"
                        />
                      ))}
                    </span>
                  ) : undefined
                }
                bodyClassName="p-0"
              >
                <PromotionsTable query={redemptions} onOpen={onOpenOrder} />
              </Section>
            )}
          </>
        }
        aside={
          <>
            <ContactCard customer={row} phone={phone} />
            <AddressesCard addresses={row.addresses} />
          </>
        }
      />
    </>
  );
}

/**
 * Who they are. The phone first and copyable — it is what somebody on a call
 * needs — then the facts that qualify the account.
 */
function ContactCard({
  customer,
  phone,
}: {
  customer: CustomerDetail;
  phone: string;
}) {
  const clock = useClock();
  return (
    <Section title={t("customers.contact")}>
      <DescriptionList
        className="grid-cols-[minmax(0,7rem)_1fr]"
        items={[
          {
            label: t("customers.colPhone"),
            value: phone ? (
              <Copyable
                value={phone}
                href={`tel:${phone}`}
                label={t("customers.copyPhone")}
                className="font-medium tabular-nums"
              >
                <span dir="ltr">{phone}</span>
              </Copyable>
            ) : (
              <span className="text-ink-4">{t("customers.notSet")}</span>
            ),
          },
          {
            label: t("customers.joinedLabel"),
            value: clock.dateTime(customer.createdAt),
          },
          {
            label: t("customers.language"),
            value: customer.locale ?? (
              <span className="text-ink-3">{t("customers.notSet")}</span>
            ),
          },
          {
            label: t("customers.currency"),
            // Null is a real answer (`0028`): each shop's own currency.
            value: customer.currencyCode ?? (
              <span className="text-ink-3">{t("customers.shopsOwn")}</span>
            ),
          },
        ]}
      />
    </Section>
  );
}

/**
 * Where their orders go: the selected address in full, with its map; the
 * others as lines. A missing pin is flagged on every one, because it means an
 * overcharge on every order there.
 */
function AddressesCard({ addresses }: { addresses: CustomerAddress[] }) {
  const selected = addresses.find((one) => one.isSelected) ?? null;
  const others = addresses.filter((one) => one !== selected);

  return (
    <Section title={t("customers.addresses")} bodyClassName="p-0">
      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin />}
          title={t("customers.noAddresses")}
          description={t("customers.noAddressesBody")}
        />
      ) : (
        <div className="flex flex-col divide-y divide-line">
          {selected && (
            <div className="p-5">
              <AddressCard address={selected} />
            </div>
          )}
          {others.length > 0 && (
            <div className="flex flex-col gap-3 p-5">
              <p className="text-[12.5px] font-medium text-ink-3">
                {t("customers.otherAddresses", { count: others.length })}
              </p>
              <ul className="flex flex-col gap-3">
                {others.map((address) => {
                  const noPin =
                    address.latitude === null || address.longitude === null;
                  return (
                    <li key={address.id} className="flex items-start gap-2">
                      {noPin ? (
                        <MapPinOff
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-warning"
                        />
                      ) : (
                        <MapPin
                          aria-hidden
                          className="mt-0.5 size-4 shrink-0 text-ink-4"
                        />
                      )}
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13.5px] font-medium text-ink">
                          {address.label ?? t("customers.unlabelled")}
                        </span>
                        <span className="text-[13px] text-ink-3">
                          {address.line}
                        </span>
                        {noPin && (
                          <span className="text-[12.5px] text-warning-ink">
                            {t("customers.noPin")}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function Tile({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-xs">
      <span className="text-[12.5px] font-medium text-ink-3">{label}</span>
      <span className="text-[20px] font-semibold tracking-tight break-words text-ink tabular-nums">
        {children}
      </span>
    </div>
  );
}

function SummaryTiles({
  stats,
  saved,
}: {
  stats: ReturnType<typeof useCustomerStats>;
  saved: [string, number][];
}) {
  if (stats.isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((one) => (
          <Skeleton key={one} className="h-[76px] rounded-lg" />
        ))}
      </div>
    );
  }
  if (stats.isError) {
    return (
      <p
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-[13.5px] text-danger-ink"
      >
        <AlertCircle className="size-4" />
        {t("customers.statsFailed")}
        <button
          type="button"
          onClick={() => void stats.refetch()}
          className="ms-auto font-medium underline underline-offset-2"
        >
          {t("common.retry")}
        </button>
      </p>
    );
  }
  const data = stats.data;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Tile label={t("customers.tileOrders")}>{data.orderCount}</Tile>
        {/* Per currency: usually one tile, and never a sum across two. */}
        {data.totals.map((total) => (
          <Tile
            key={total.code}
            label={t("customers.tileSpent", { code: total.code })}
          >
            <Price
              value={total.amount}
              code={total.code}
              className="text-[20px] font-semibold"
            />
          </Tile>
        ))}
        {saved.map(([code, amount]) => (
          <Tile
            key={`saved-${code}`}
            label={t("customers.tileSaved", { code })}
          >
            <Price
              value={amount}
              code={code}
              className="text-[20px] font-semibold"
            />
          </Tile>
        ))}
        {/* Average order value, Shopify's third lifetime figure — only in
            one currency, over the same rows the total is, so it is never an
            average of dollars and lira. */}
        {data.totals.length === 1 && data.orderCount > 0 && (
          <Tile
            label={t("customers.tileAverage", { code: data.totals[0]!.code })}
          >
            <Price
              value={Math.round(data.totals[0]!.amount / data.orderCount)}
              code={data.totals[0]!.code}
              className="text-[20px] font-semibold"
            />
          </Tile>
        )}
        <Tile label={t("customers.tileLast")}>
          {data.lastOrderAt ? (
            <span className="flex flex-col">
              {formatRelative(data.lastOrderAt)}
              <span className="text-[12.5px] font-normal text-ink-3">
                {t("customers.firstOrderOn", {
                  when: formatDate(data.firstOrderAt ?? data.lastOrderAt),
                })}
              </span>
            </span>
          ) : (
            t("customers.never")
          )}
        </Tile>
      </div>
      {/* The cap made visible: a lifetime figure that is a floor says so. */}
      {data.truncated && (
        <p className="text-[12.5px] text-ink-3">
          {t("customers.statsTruncated")}
        </p>
      )}
    </div>
  );
}

/**
 * The two things a total cannot say: whether they are still ordering, and
 * when. A customer who stopped in March is four flat bars.
 */
function Charts({ stats }: { stats: CustomerStats }) {
  const { format } = useMoney();
  const code = stats.seriesCurrency;
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Section
        title={
          code
            ? t("customers.chartMonthsMoney", { code })
            : t("customers.chartMonths")
        }
      >
        <BarChart
          tone="accent"
          title={t("customers.chartMonthsAria")}
          bars={stats.months.map((month) => ({
            key: month.key,
            label: formatMonthKey(month.key),
            // Money when there is one currency to draw, orders when there is
            // not — a bar mixing dollars and lira is a chart of nothing.
            value: code ? month.amount : month.orders,
            title: code
              ? t("customers.chartMonthTitleMoney", {
                  month: formatMonthKey(month.key),
                  orders: month.orders,
                  amount: format(month.amount, code),
                })
              : t("customers.chartMonthTitle", {
                  month: formatMonthKey(month.key),
                  orders: month.orders,
                }),
          }))}
        />
      </Section>
      <Section
        title={t("customers.chartWeekdays")}
        description={t("customers.chartWeekdaysHint")}
      >
        <HeatStrip
          tone="info"
          title={t("customers.chartWeekdaysAria")}
          // Rotated to Monday-first here, for reading; the stored order is
          // Sunday-first and stays that way.
          cells={[1, 2, 3, 4, 5, 6, 0].map((day) => ({
            key: String(day),
            label: t(WEEKDAY_SHORT[day]),
            value: stats.byWeekday[day] ?? 0,
          }))}
        />
      </Section>
    </div>
  );
}

function OrdersTable({
  query,
  rows,
  onOpen,
  paged,
}: {
  query: ReturnType<typeof useCustomerOrders>;
  rows: CustomerOrder[];
  onOpen: (id: string) => void;
  paged: boolean;
}) {
  const clock = useClock();

  if (query.isPending) return <ListSkeleton rows={paged ? 6 : 3} />;
  if (query.isError) {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title={t("customers.ordersFailed")}
        action={
          <Button onClick={() => void query.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Receipt />}
        title={t("customers.noOrders")}
        description={t("customers.noOrdersBody")}
      />
    );
  }

  return (
    <>
      <Table>
        <THead>
          <tr>
            <Th>{t("customers.colOrder")}</Th>
            <Th className="hidden sm:table-cell">{t("customers.colPlaced")}</Th>
            <Th>{t("customers.colStatus")}</Th>
            <Th className="hidden lg:table-cell">
              {t("customers.colDeliveredTo")}
            </Th>
            <Th className="text-end">{t("customers.colTotal")}</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((order) => (
            <Tr key={order.id} interactive onClick={() => onOpen(order.id)}>
              <Td>
                {/* A button, so the row is reachable by keyboard; the row's
                    click is the bigger target for a mouse. */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(order.id);
                  }}
                  className="font-medium text-ink tabular-nums hover:underline"
                  aria-label={t("customers.openOrder", { code: order.code })}
                >
                  {order.code}
                </button>
                <span className="block text-[12.5px] text-ink-3 sm:hidden">
                  {clock.dateTime(order.placedAt)}
                </span>
              </Td>
              <Td className="hidden whitespace-nowrap text-ink-2 sm:table-cell">
                {clock.dateTime(order.placedAt)}
              </Td>
              <Td>
                {/* One chip per shop: an order across two shops has two. */}
                <div className="flex flex-wrap gap-1">
                  {order.statuses.map((status) => (
                    <StatusBadge key={status.slug} slug={status.slug} />
                  ))}
                </div>
              </Td>
              <Td className="hidden max-w-[18rem] truncate text-ink-3 lg:table-cell">
                {order.addressLine}
              </Td>
              <Td className="text-end">
                {/* This one order's shop rate (`0120`). */}
                <Price
                  value={order.total}
                  code={order.currencyCode}
                  shopRate={order.shopRate}
                  align="end"
                  className="font-medium"
                />
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      {paged && (
        <div className="border-t border-line">
          <InfiniteSentinel
            hasMore={query.hasNextPage}
            loading={query.isFetchingNextPage}
            onLoadMore={() => void query.fetchNextPage()}
          />
        </div>
      )}
    </>
  );
}

function PromotionsTable({
  query,
  onOpen,
}: {
  query: ReturnType<typeof useCustomerRedemptions>;
  onOpen: (id: string) => void;
}) {
  if (query.isPending) return <ListSkeleton rows={3} />;
  if (query.isError) {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title={t("customers.promotionsFailed")}
        action={
          <Button onClick={() => void query.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }
  if (query.data.length === 0) {
    return <EmptyState icon={<Tag />} title={t("customers.noPromotions")} />;
  }
  return (
    <Table>
      <THead>
        <tr>
          <Th>{t("customers.colPromotion")}</Th>
          <Th>{t("customers.colOrder")}</Th>
          <Th className="hidden sm:table-cell">{t("customers.colDate")}</Th>
          <Th className="text-end">{t("customers.colSaved")}</Th>
        </tr>
      </THead>
      <TBody>
        {query.data.map((one) => (
          <RedemptionRow key={one.id} redemption={one} onOpen={onOpen} />
        ))}
      </TBody>
    </Table>
  );
}

function RedemptionRow({
  redemption,
  onOpen,
}: {
  redemption: CustomerRedemption;
  onOpen: (id: string) => void;
}) {
  return (
    <Tr interactive onClick={() => onOpen(redemption.orderId)}>
      {/* The label as it was when given (`0016`: a receipt line), never the
          promotion's name today. */}
      <Td className="max-w-[16rem] truncate font-medium">
        {redemption.label || (
          <span className="font-normal text-ink-3 italic">
            {t("customers.unnamedPromotion")}
          </span>
        )}
      </Td>
      <Td>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(redemption.orderId);
          }}
          className="text-ink-2 tabular-nums hover:underline"
          aria-label={t("customers.openOrder", { code: redemption.orderCode })}
        >
          {redemption.orderCode}
        </button>
      </Td>
      <Td className="hidden whitespace-nowrap text-ink-3 sm:table-cell">
        {formatDate(redemption.redeemedAt)}
      </Td>
      <Td className="text-end text-success-ink">
        {/* What came off, not something they paid. */}
        <Price
          value={redemption.amount}
          code={redemption.currencyCode}
          align="end"
          className="font-medium"
        />
      </Td>
    </Tr>
  );
}

function AddressCard({ address }: { address: CustomerAddress }) {
  const noPin = address.latitude === null || address.longitude === null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MapPin className="size-4 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
          {address.label ?? t("customers.unlabelled")}
        </span>
        {address.isSelected && (
          <Badge tone="accent">{t("customers.defaultAddress")}</Badge>
        )}
      </div>
      <p className="text-[13.5px] text-ink-2">{address.line}</p>
      {/* Who answers at this door, when it is not the account's own phone. */}
      {address.phone && (
        <p className="text-[13px] text-ink-3">
          {t("customers.addressPhone")}{" "}
          <span dir="ltr" className="text-ink-2 tabular-nums">
            {formatPhone(address.phone)}
          </span>
        </p>
      )}
      {noPin ? (
        // No pin falls to the top delivery band, so every order here is
        // overcharged — said with the consequence, not as an empty frame.
        <p className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">
          <MapPinOff className="mt-px size-4 shrink-0" />
          {t("customers.noPinWarning")}
        </p>
      ) : (
        <MapView
          latitude={address.latitude}
          longitude={address.longitude}
          label={address.label ?? address.line}
        />
      )}
    </div>
  );
}
