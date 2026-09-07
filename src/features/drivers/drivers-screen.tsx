"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { FOCUS_RING, useRowFocus } from "@/components/ui/row-focus";
import { ROW } from "@/components/ui/row";
import { Toggle } from "@/components/ui/toggle";
import { ListHeader } from "@/components/ui/list-header";
import { FilterTab, tabArrowHandler, type TabTone } from "@/components/ui/tab";
import { t, type TranslationKey } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";
import { formatPhone } from "@/lib/phone";

import { isOverridden, isTakingOrders, type Courier } from "./api/couriers";

import {
  useCouriers,
  useSaveCourier,
  useSetCourierActive,
} from "./use-couriers";

type Scope = "all" | "active" | "off" | "inactive";

const TABS: { key: Scope; labelKey: TranslationKey; tone?: TabTone }[] = [
  { key: "all", labelKey: "drivers.tabAll" },
  {
    key: "active",
    labelKey: "drivers.tabActive",
    tone: {
      wash: "var(--color-accent-wash)",
      ink: "var(--color-text)",
      dot: "var(--color-accent)",
    },
  },
  {
    key: "off",
    labelKey: "drivers.tabOff",
    tone: {
      wash: "var(--color-neutral-fill)",
      ink: "var(--color-text)",
      dot: "var(--color-text-faint)",
    },
  },
  {
    key: "inactive",
    labelKey: "drivers.tabInactive",
    tone: {
      wash: "var(--color-danger-wash)",
      ink: "var(--color-text)",
      dot: "var(--color-danger)",
    },
  },
];

/**
 * Who an order can be handed to.
 *
 * ## It was a settings tab, and outgrew one
 *
 * A name and a number is a setting. A person with a history of orders is not —
 * and once a driver has a page worth opening, the list that leads to it belongs
 * on the rail beside customers rather than four clicks inside the app's prose.
 * The shape follows customers deliberately: a heading, a search that fills the
 * bar, and rows that *are* the link.
 *
 * ## The search is a query, even here
 *
 * The whole list is usually a handful of rows already in the browser, so
 * filtering them locally would work today. It is still a query, because the
 * failure of the local version is silent: a shop that grows to a dozen drivers
 * across two shifts gets a search that only finds what is already loaded, shows
 * nothing, and reads as "we do not have that person".
 */
export function DriversScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = useState("");
  const couriers = useCouriers(search);

  // In the URL, like every other filter in the dashboard, so a view can be
  // linked, reloaded or sent.
  const requested = params.get("scope");
  const scope: Scope = TABS.some((one) => one.key === requested)
    ? (requested as Scope)
    : "all";

  function show(next: Scope) {
    const query = new URLSearchParams(params);
    if (next === "all") query.delete("scope");
    else query.set("scope", next);
    // Not `search`: that name is the search *term* three lines up, and a
    // shadowed variable in a function that writes the URL is the kind of slip
    // that puts somebody's half-typed query into the address bar.
    const nextQuery = query.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }

  const save = useSaveCourier();
  const setActive = useSetCourierActive();

  /** Which row to bring back into view — see `useRowFocus`. */
  const focus = useRowFocus();

  const searching = search.trim().length >= SEARCH.minTerm;
  const matching = couriers.data ?? [];

  /**
   * The counts, taken from what was fetched — and that is the exception rather
   * than the rule.
   *
   * Every other list in the dashboard counts with a `head` request, because a
   * paginated list's local count is a count of *one page* and every tab would
   * read "50". This list is not paginated: `fetchCouriers` returns every driver
   * matching the term, so the rows in hand **are** the whole set and counting
   * them is exact.
   *
   * They also follow the search, which is what makes the strip honest while
   * somebody is typing: "Taking orders 2" beside a filtered list means two of
   * the matches, not two in the business.
   */
  // Two different questions, and the tabs answer both. "All" and the two shift
  // tabs are about people who work here; "Not active" is about people who used
  // to — which is why they are excluded from the first three rather than
  // sitting in them switched off.
  const onBooks = matching.filter((one) => one.isActive);

  const counts: Record<Scope, number> = {
    all: onBooks.length,
    active: onBooks.filter((one) => isTakingOrders(one)).length,
    off: onBooks.filter((one) => !isTakingOrders(one)).length,
    inactive: matching.filter((one) => !one.isActive).length,
  };

  const rows =
    scope === "inactive"
      ? matching.filter((one) => !one.isActive)
      : scope === "all"
        ? onBooks
        : onBooks.filter((one) =>
            scope === "active" ? isTakingOrders(one) : !isTakingOrders(one),
          );

  return (
    <div className="flex h-full flex-col">
      <ListHeader
        title={t("drivers.title")}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("drivers.search"),
        }}
        action={
          <Button onClick={() => router.push("/drivers/new")}>
            {t("drivers.add")}
          </Button>
        }
      />

      {/* The same strip the queue and the customers list use — same shape,
            same place, same keyboard behaviour — because these are the same
            kind of control and two spellings of it would be two things to
            learn. */}
      <div
        role="tablist"
        aria-label={t("drivers.title")}
        className="flex shrink-0 gap-xxs overflow-x-auto border-b border-border bg-surface px-xxl pt-sm"
      >
        {TABS.map(({ key, labelKey, tone }) => (
          <FilterTab
            key={key}
            label={t(labelKey)}
            count={counts[key]}
            active={scope === key}
            tone={tone}
            onClick={() => show(key)}
            onKeyDown={tabArrowHandler(
              TABS.map((one) => one.key),
              scope,
              show,
            )}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
        <p className="ps-md pb-sm text-[13px] text-text-soft">
          {t("drivers.blurb")}
        </p>

        {couriers.isError && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {t("content.failed")}
          </p>
        )}

        {couriers.isSuccess && rows.length === 0 && (
          // The term is named. An empty list with no explanation is
          // indistinguishable from one that failed to load.
          <p className="ps-md text-[13px] text-text-faint">
            {searching
              ? t("drivers.searchNone", { term: search.trim() })
              : t("drivers.empty")}
          </p>
        )}

        {rows.map((courier) => (
          <DriverRow
            key={courier.id}
            courier={courier}
            open={focus.isFocused(courier.id)}
            anchor={focus.attach(courier.id)}
            onEdit={() =>
              // `?from=list` so Back returns here rather than to the driver's
              // own page — see `DriverEditor`.
              router.push(`/drivers/${courier.id}/edit?from=list`)
            }
            onOverride={(value) =>
              save.mutate({
                id: courier.id,
                draft: {
                  name: courier.name,
                  phone: courier.phone,
                  availableOverride: value,
                },
                name: courier.name,
              })
            }
            onSetActive={(active) =>
              active
                ? setActive.mutate({
                    id: courier.id,
                    active: true,
                    name: courier.name,
                  })
                : undefined
            }
            onDeactivate={async () => {
              await setActive.mutateAsync({
                id: courier.id,
                active: false,
                name: courier.name,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One driver.
 *
 * The name is a stretched link to their page, which is the row's main purpose —
 * so the largest target on the row opens it, and the accessible name is "Ali"
 * rather than "row".
 *
 * Everything to the right needs `relative z-10` to sit above that overlay, or
 * it stops responding. A stretched link copied without its second half is a row
 * where only the navigation works, and the failure looks like a broken button.
 *
 * ## Whether they are taking orders is read, not set
 *
 * There used to be a switch here. It had to be remembered twice a day by the
 * person who is busiest at exactly those moments, and both of its failures were
 * silent: left on at midnight, a sleeping driver is offered for dispatch; left
 * off, they are invisible through a whole shift and nobody finds out until an
 * order needs sending.
 *
 * So it is a badge computed from their hours (migration 0084) — a *state* the
 * row reports rather than a control it offers.
 */
function DriverRow({
  courier,
  open,
  anchor,
  onEdit,
  onOverride,
  onSetActive,
  onDeactivate,
}: {
  courier: Courier;
  open: boolean;
  anchor: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onOverride: (value: boolean | null) => void;
  onSetActive: (active: boolean) => void;
  onDeactivate: () => Promise<void>;
}) {
  const taking = isTakingOrders(courier);
  const overridden = isOverridden(courier);

  return (
    <div ref={anchor} className={cx(ROW, open ? FOCUS_RING : "border-border")}>
      <Avatar id={courier.id} name={courier.name} />

      <div className="flex min-w-0 flex-grow flex-col gap-xxs">
        <Link
          href={`/drivers/${courier.id}`}
          className="truncate text-[15px] font-semibold after:absolute after:inset-0"
        >
          {courier.name}
        </Link>
        <span className="truncate text-[12px] tabular-nums text-text-faint">
          {formatPhone(courier.phone)}
        </span>
        {/* Under the phone, with the identity. Whether somebody is still on the
            books is a fact about *them*; the shift switch beside it is a fact
            about tonight. Stacked in the same column as the rota controls the
            two read as one setting with two states, which they are not. */}
        {!courier.isActive && (
          <span className="w-fit rounded-sm bg-danger-wash px-sm py-[1px] text-[11px] font-semibold text-text">
            {t("drivers.inactive")}
          </span>
        )}
      </div>

      {/* The rota is the standing answer and this is tonight's exception, so
          the switch shows the *effective* state and flipping it writes an
          override rather than editing the week. Editing the week to describe
          one evening is the thing that would quietly become permanent.

          An override is invisible from the outside — the badge reads the same
          either way — so the row says when one is in force and offers to stop.
          An override left behind is the failure the rota was meant to end. */}
      {courier.isActive && (
        <span className="relative z-10 flex shrink-0 flex-col items-end gap-xxs">
          <Toggle
            on={taking}
            onChange={() => onOverride(!taking)}
            labelOn={t("drivers.onShift")}
            labelOff={t("drivers.offShift")}
            className="w-[124px]"
          />
          {overridden && (
            <button
              type="button"
              onClick={() => onOverride(null)}
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              {t("drivers.followRota")}
            </button>
          )}
        </span>
      )}

      <span className="relative z-10 flex items-center gap-sm">
        <Button variant="secondary" size="sm" onClick={onEdit}>
          {t("drivers.edit")}
        </Button>

        {/* There is no delete. A driver who has left still appears on every
            order they carried, and removing the row would leave that history
            pointing at a name nobody can look up.

            Switching off asks first — it takes somebody out of dispatch, and
            from this side of the screen nothing looks different afterwards.
            Switching back on does not: it restores, and a confirmation on a
            reversal is a question with one sensible answer. */}
        {courier.isActive ? (
          <ConfirmButton
            onConfirm={onDeactivate}
            titleKey="drivers.deactivateTitle"
            bodyKey="drivers.deactivateBody"
            confirmKey="drivers.deactivateConfirm"
            params={{ name: courier.name }}
            variant="danger"
            // Filled, like every other destructive control on a row. `quiet`
            // is transparent, so beside a filled Edit it read as text rather
            // than as a button — and the one control here with a consequence
            // should not be the one that looks least like a control.
            triggerVariant="danger"
            size="sm"
          >
            {t("drivers.deactivate")}
          </ConfirmButton>
        ) : (
          // Mint, the theme's "going well". Grey beside a red Deactivate said
          // the two were peers; this one puts somebody back on the rota.
          <Button variant="accent" size="sm" onClick={() => onSetActive(true)}>
            {t("drivers.reactivate")}
          </Button>
        )}
      </span>
    </div>
  );
}
