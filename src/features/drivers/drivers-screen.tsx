"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, Field, Input, cx } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { ROW } from "@/components/ui/row";
import { Panel } from "@/components/ui/panel";
import { PhoneInput } from "@/components/ui/phone-input";
import { PanelHeader } from "@/components/ui/panel-header";
import { Toggle } from "@/components/ui/toggle";
import { ListHeader } from "@/components/ui/list-header";
import { FilterTab, tabArrowHandler, type TabTone } from "@/components/ui/tab";
import { t, type TranslationKey } from "@/i18n/translations";
import { SEARCH, TEXT } from "@/lib/limits";
import { digitsOf, formatPhone } from "@/lib/phone";
import { validatePhone } from "@/lib/validation";

import {
  isOverridden,
  isTakingOrders,
  type Courier,
  type CourierDraft,
} from "./api/couriers";
import type { DayHours } from "@/features/catalog/api/hours";

import { HoursGrid } from "./hours-grid";
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

  /** The row being edited, `"new"` for the one being added, or nothing. */
  const [open, setOpen] = useState<string | null>(null);
  const guarded = useGuardedAction();

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

  /** The driver the panel is editing, or nothing when it is adding one. */
  const editing =
    open === "new" ? null : (matching.find((one) => one.id === open) ?? null);

  return (
    // A row, not a column: the panel is a *sibling* of the list, which is what
    // makes it open beside it — the same shape the shops list uses.
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <ListHeader
          title={t("drivers.title")}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t("drivers.search"),
          }}
          action={
            <Button onClick={guarded(() => setOpen("new"))}>
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
              open={open === courier.id}
              onEdit={guarded(() => setOpen(courier.id))}
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

      <Panel
        open={open !== null}
        onClose={guarded(() => setOpen(null))}
        label={editing ? t("drivers.edit") : t("drivers.add")}
      >
        {open !== null && (
          <>
            <PanelHeader
              title={editing ? editing.name : t("drivers.add")}
              onClose={guarded(() => setOpen(null))}
            />

            <DriverEditor
              // Keyed on the row, so switching between two drivers starts from
              // the one that was clicked rather than resuming the previous
              // person's half-typed name — and so opening Add after an edit
              // starts blank.
              key={open}
              initial={editing}
              pending={save.isPending}
              onCancel={guarded(() => setOpen(null))}
              onSave={(draft) =>
                save.mutate(
                  { id: editing?.id ?? null, draft, name: draft.name },
                  { onSuccess: () => setOpen(null) },
                )
              }
            />
          </>
        )}
      </Panel>
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
  onEdit,
  onOverride,
  onSetActive,
  onDeactivate,
}: {
  courier: Courier;
  open: boolean;
  onEdit: () => void;
  onOverride: (value: boolean | null) => void;
  onSetActive: (active: boolean) => void;
  onDeactivate: () => Promise<void>;
}) {
  const taking = isTakingOrders(courier);
  const overridden = isOverridden(courier);

  return (
    <div
      className={cx(
        ROW,
        open
          ? "border-active shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]"
          : "border-border",
      )}
    >
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

/**
 * A driver's details and their week, in one form.
 *
 * ## The same form for adding and editing
 *
 * It was briefly a two-step wizard on create, on the store's model. That is the
 * right shape for a shop — seven interdependent parts ending in a map pin — and
 * the wrong one here: a driver is a name, a number and a rota, and splitting
 * three answers across two screens adds a click and a decision without removing
 * anything from either. One column, in the order somebody would say it.
 *
 * ## New drivers start from a week rather than a blank one
 *
 * A driver with no working days is never on shift, so a form that defaults to
 * empty creates somebody who can never be dispatched — and the operator finds
 * that out the next time an order needs sending, with no clue why the name is
 * missing. `DEFAULT_WEEK` is a starting point, not a guess to live with: every
 * part of it is one click from being changed.
 */
export function DriverEditor({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: Courier | null;
  pending: boolean;
  onSave: (draft: CourierDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [hours, setHours] = useState<DayHours[]>(
    initial?.hours ?? DEFAULT_WEEK,
  );

  // A new driver starts from `DEFAULT_WEEK`, so an untouched blank form is not
  // dirty and closing it asks nothing — which is right: there is nothing there
  // to lose yet.
  useUnsavedChanges(
    changed(
      { name, phone, hours },
      {
        name: initial?.name ?? "",
        phone: initial?.phone ?? "",
        hours: initial?.hours ?? DEFAULT_WEEK,
      },
    ),
  );

  /**
   * The same rule the CHECK constraint carries, applied here so the operator is
   * told before saving rather than by a constraint name afterwards.
   *
   * `digitsOf` runs on the way in as well as in the API, because what they see
   * before pressing Save should be what gets stored — a field that silently
   * rewrites the value afterwards leaves somebody unsure which version is real.
   *
   * A week with no working days is refused for the reason above: it produces a
   * driver who is never offered, silently.
   */
  const digits = digitsOf(phone);
  const ready =
    name.trim().length > 0 && validatePhone(digits).ok && hours.length > 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSave({ name, phone, hours });
      }}
      // No card border: inside a panel the panel *is* the card, and a second
      // box around the form is a frame within a frame eating the width the
      // fields need. The body scrolls and the buttons stay put.
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <Field label={t("drivers.name")}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("drivers.namePlaceholder")}
            maxLength={TEXT.name}
            autoFocus
          />
        </Field>

        <Field label={t("drivers.phone")} hint={t("drivers.phoneHint")}>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            placeholder={t("drivers.phonePlaceholder")}
          />
        </Field>

        <div className="flex flex-col gap-sm border-t border-border pt-lg">
          <h3 className="text-[15px] font-semibold">
            {t("drivers.hoursTitle")}
          </h3>
          <HoursGrid week={hours} onChange={setHours} />
        </div>
      </div>

      {/* Pinned. The grid is seven rows tall and Save would otherwise be below
          the fold on every driver. */}
      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={!ready} pending={pending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

/**
 * The week a new driver starts on.
 *
 * Monday to Saturday, late afternoon into the night — when a delivery driver in
 * this business actually works. Sunday is left off rather than guessed at: a
 * default that is wrong in the *absence* direction is corrected the first time
 * somebody looks, while one that is wrong the other way sends an order to a
 * driver who is at home.
 */
const DEFAULT_WEEK: DayHours[] = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  opensAt: "16:00",
  closesAt: "23:00",
}));
