"use client";

import { AlertCircle, Info, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  FormError,
  Notice,
  Section,
  Segmented,
  Skeleton,
  Tooltip,
  cx,
} from "@/components/ui";
import { MoneyInput } from "@/components/ui/money-input";
import { NumberInput } from "@/components/ui/number-input";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { Price } from "@/features/reference/price";
import { useMoney } from "@/features/reference/use-currencies";
import { useAppSettings } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";

import type { Band } from "./api/pricing";
import { quoteDelivery } from "./quote";
import { useLadder, useSaveExtraStoreFee, useSaveLadder } from "./use-pricing";

/**
 * The delivery ladder, the extra-shop fee, and a preview that prices a
 * distance by both — as edited, before Save, so a change can be checked
 * against what the operator expected before any customer sees it.
 *
 * ## One table, one Save
 *
 * The bands only mean anything together: each price is chosen against the ones
 * either side of it. Saving row by row would let somebody commit half of a
 * decision they made whole, which is why every edit here is local until Save.
 *
 * ## The largest band is the delivery radius
 *
 * Past it a single shop is out of range, and since `0193` it is also the
 * longest ride one multi-shop order may take. So the last row is the edge of
 * the business: the screen says so on the row, and removing it asks first.
 */
export function DeliveryTab() {
  const ladder = useLadder();
  const save = useSaveLadder();
  const settings = useAppSettings();

  const [draft, setDraft] = useState<Band[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Null means untouched, so a fee merely looked at is not unsaved work.
  const [extraDraft, setExtraDraft] = useState<number | null>(null);

  const saved = ladder.data ?? [];
  const bands = draft ?? saved;
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedChanges(dirty);

  const savedExtra = settings.data?.extraStoreFee ?? null;
  const extra = extraDraft ?? savedExtra ?? 0;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex min-w-0 flex-col gap-6">
        <Ladder
          query={ladder}
          saved={saved}
          bands={bands}
          dirty={dirty}
          error={error}
          pending={save.isPending}
          onChange={(next) => {
            setDraft(next);
            setError(null);
          }}
          onDiscard={() => {
            setDraft(null);
            setError(null);
          }}
          onSave={() => {
            const sorted = [...bands].sort((a, b) => a.upToKm - b.upToKm);
            if (sorted.some((band) => !(band.upToKm > 0))) {
              setError(t("pricing.bandDistancePositive"));
              return;
            }
            if (sorted.some((band) => !(band.amount >= 0))) {
              setError(t("pricing.bandAmountNegative"));
              return;
            }
            // `up_to_km` is the primary key, so two bands with one ceiling is a
            // constraint violation — caught here so it reads as a form rather
            // than as a message about an index.
            if (
              new Set(sorted.map((band) => band.upToKm)).size !== sorted.length
            ) {
              setError(t("pricing.bandDuplicate"));
              return;
            }
            setError(null);
            save.mutate(sorted, { onSuccess: () => setDraft(null) });
          }}
        />

        <MultiShop
          savedExtra={savedExtra}
          extraDraft={extraDraft}
          onExtraChange={setExtraDraft}
        />
      </div>

      <div className="lg:sticky lg:top-0">
        <TryDistance bands={bands} extra={extra} dirty={dirty} />
      </div>
    </div>
  );
}

/* ─────────────────────────── The ladder ─────────────────────────── */

function Ladder({
  query,
  saved,
  bands,
  dirty,
  error,
  pending,
  onChange,
  onDiscard,
  onSave,
}: {
  query: ReturnType<typeof useLadder>;
  saved: Band[];
  bands: Band[];
  dirty: boolean;
  error: string | null;
  pending: boolean;
  onChange: (bands: Band[]) => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const { convertTo, secondaryCode, baseCode, baseDecimals } = useMoney();
  const [confirmTop, setConfirmTop] = useState(false);

  /**
   * The row that was just added, so it can be scrolled to and focused. A
   * ladder is long and the new band goes at the end — below the fold on
   * anything but the shortest one, where a click that seems to do nothing
   * reads as a broken button. A ref rather than state: nothing renders it.
   */
  const added = useRef<number | null>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (added.current === null) return;
    const row = list.current?.querySelector<HTMLElement>(
      `[data-band="${added.current}"]`,
    );
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    row?.querySelector<HTMLInputElement>("input")?.focus();
    added.current = null;
  }, [bands.length]);

  /** A band in the other currency, or nothing — absent rather than approximate. */
  function other(amount: number): string | null {
    const to = baseCode ? secondaryCode(baseCode) : null;
    return to && baseCode ? convertTo(amount, baseCode, to) : null;
  }

  function edit(index: number, patch: Partial<Band>) {
    onChange(
      bands.map((band, at) => (at === index ? { ...band, ...patch } : band)),
    );
  }

  function add() {
    // Above the current top, so it becomes the radius only if the operator
    // means it to — and from the last price rather than zero, which is never
    // the answer.
    const last = bands[bands.length - 1];
    added.current = bands.length;
    onChange([
      ...bands,
      { upToKm: last ? last.upToKm + 5 : 3, amount: last ? last.amount : 0 },
    ]);
  }

  function remove(index: number) {
    onChange(bands.filter((_, at) => at !== index));
  }

  /**
   * The radius is the largest ceiling, wherever it sits in the draft. Rows
   * are not re-sorted while somebody types (a row jumping under the cursor
   * is worse than one out of order) and Save sorts them, so the last row is
   * not necessarily the top one until then.
   */
  const topIndex = bands.reduce(
    (best, band, index) =>
      best === -1 || band.upToKm > bands[best].upToKm ? index : best,
    -1,
  );
  const top = topIndex === -1 ? undefined : bands[topIndex];
  /** The next ceiling down from the radius: where delivery would stop. */
  const nextDown = top
    ? Math.max(
        0,
        ...bands
          .filter((band) => band.upToKm < top.upToKm)
          .map((band) => band.upToKm),
      )
    : 0;
  const inversions = cheaperFarther(bands);

  return (
    <Section
      title={t("pricing.ladderTitle")}
      description={t("pricing.ladderBody")}
      actions={
        bands.length > 0 ? (
          <Badge>{t("pricing.bandsCount", { count: bands.length })}</Badge>
        ) : undefined
      }
      bodyClassName="p-0"
    >
      {/* What the numbers are in, and what a shop pricing in another currency
          does with them. Said because it used not to be true: before `0080`
          the fee was added unconverted, and nothing anywhere said so. */}
      {baseCode && (
        <p className="flex items-start gap-2 border-b border-line bg-subtle px-5 py-3 text-[12.5px] text-ink-3">
          <Info className="mt-px size-4 shrink-0 text-ink-4" />
          {t("pricing.ladderCurrency", { code: baseCode })}
        </p>
      )}

      {query.isPending && (
        <div aria-busy className="flex flex-col gap-3 p-5">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-9 w-full" />
          ))}
        </div>
      )}

      {query.isError && (
        <EmptyState
          icon={<AlertCircle />}
          title={t("common.loadFailed")}
          description={
            query.error instanceof Error ? query.error.message : undefined
          }
          action={
            <Button onClick={() => void query.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      )}

      {query.isSuccess && (
        <>
          {/* Column labels, for the eye. Each input carries its own label for
              a screen reader, so the phone layout can drop this row. */}
          {bands.length > 0 && (
            <div className="hidden grid-cols-[8rem_minmax(0,13rem)_minmax(0,1fr)_2.25rem] gap-4 border-b border-line px-5 py-2 text-[12px] font-medium text-ink-3 sm:grid">
              <span>{t("pricing.upTo")}</span>
              <span>{t("pricing.fee")}</span>
            </div>
          )}

          <div ref={list} className="divide-y divide-line">
            {bands.map((band, index) => {
              const isTop = index === topIndex;
              // Each row read as the range it covers — "3 to 6 km" — the way
              // DoorDash and Uber Eats state their distance tiers, since a
              // bare ceiling leaves the reader to find the floor.
              const floor = Math.max(
                0,
                ...bands
                  .filter((one) => one.upToKm < band.upToKm)
                  .map((one) => one.upToKm),
              );
              // Said on the row as it is typed, not only on Save.
              const clash =
                band.upToKm > 0 &&
                bands.filter((one) => one.upToKm === band.upToKm).length > 1;
              // Not yet in the database — just added, or a ceiling that moved,
              // which is the same thing here because `up_to_km` is the key.
              const unsaved = !saved.some(
                (one) =>
                  one.upToKm === band.upToKm && one.amount === band.amount,
              );
              const converted = baseCode ? other(band.amount) : null;
              return (
                <div
                  key={index}
                  data-band={index}
                  className={cx(
                    "relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-start gap-x-3 gap-y-2 px-5 py-3 sm:grid-cols-[8rem_minmax(0,13rem)_minmax(0,1fr)_2.25rem] sm:gap-x-4",
                    unsaved && "bg-info-soft/40",
                  )}
                >
                  {isTop && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 start-0 w-[3px] bg-accent"
                    />
                  )}
                  <NumberInput
                    aria-label={t("pricing.upTo")}
                    value={String(band.upToKm)}
                    onChange={(event) =>
                      edit(index, { upToKm: Number(event.target.value) })
                    }
                    min={0}
                    step="any"
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <MoneyInput
                      aria-label={t("pricing.fee")}
                      value={band.amount}
                      onChange={(amount) =>
                        edit(index, { amount: amount ?? 0 })
                      }
                      decimalDigits={baseDecimals}
                    />
                    {/* What a customer paying in the other currency is
                        charged — the field already says the amount itself. */}
                    {converted && (
                      <span className="text-[12px] text-ink-4 tabular-nums">
                        {converted}
                      </span>
                    )}
                  </div>
                  <div className="col-span-3 row-start-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:min-h-9">
                    {band.upToKm > 0 && !clash && (
                      <span className="text-[12.5px] text-ink-3 tabular-nums">
                        {t("pricing.bandCovers", {
                          from: floor,
                          to: band.upToKm,
                        })}
                      </span>
                    )}
                    {clash && (
                      <Badge tone="danger">{t("pricing.bandClash")}</Badge>
                    )}
                    {isTop && (
                      <Tooltip
                        content={t("pricing.radiusMeans", {
                          km: band.upToKm,
                        })}
                      >
                        <span tabIndex={0} className="rounded-full">
                          <Badge tone="accent" dot>
                            {t("pricing.isRadius")}
                          </Badge>
                        </span>
                      </Tooltip>
                    )}
                    {unsaved && (
                      <Badge tone="info">{t("pricing.unsavedBand")}</Badge>
                    )}
                  </div>
                  <div className="col-start-3 row-start-1 sm:col-start-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("pricing.removeBand", {
                        km: band.upToKm,
                      })}
                      className="hover:text-danger"
                      // Removing the saved top band shrinks where the business
                      // delivers, so it asks. A band never saved cannot lose
                      // the radius — removing it just undoes a click.
                      onClick={() =>
                        isTop && !unsaved ? setConfirmTop(true) : remove(index)
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {bands.length === 0 && (
            <EmptyState title={t("pricing.tryNoBands")} className="py-10" />
          )}

          <div className="border-t border-line px-5 py-3">
            <Button
              variant="ghost"
              onClick={add}
              className="w-full border border-dashed border-line-strong text-ink-2 hover:border-accent hover:text-accent-ink"
            >
              <Plus />
              {t("pricing.addBand")}
            </Button>
          </div>

          {/* The radius said in full where it is decided: neither consequence
              is visible anywhere else in the dashboard. */}
          {top && (
            <p className="flex items-start gap-2 border-t border-line px-5 py-3 text-[12.5px] text-ink-3">
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
              />
              {t("pricing.radiusMeans", { km: top.upToKm })}
            </p>
          )}

          <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-b-lg border-t border-line bg-subtle px-5 py-3.5">
            {/* A check, not a rule: nothing in the database forbids it, and
                a promotion-shaped ladder may mean it. But it is far more
                often a typo, and a customer further away paying less is
                the kind of mistake nobody reports. */}
            {inversions.length > 0 && (
              <Notice tone="warning" title={t("pricing.cheaperFartherTitle")}>
                {inversions
                  .map((pair) =>
                    t("pricing.cheaperFarther", {
                      far: pair.far,
                      near: pair.near,
                    }),
                  )
                  .join(", ")}
              </Notice>
            )}
            <FormError>{error}</FormError>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {dirty && (
                <Button variant="secondary" onClick={onDiscard}>
                  {t("pricing.discard")}
                </Button>
              )}
              <Button
                variant="primary"
                onClick={onSave}
                pending={pending}
                disabled={!dirty}
              >
                {t("pricing.ladderSave")}
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmTop}
        onOpenChange={setConfirmTop}
        tone="danger"
        title={t("pricing.removeTopTitle", { km: top?.upToKm ?? 0 })}
        description={t("pricing.removeTopBody", {
          km: top?.upToKm ?? 0,
          next: nextDown,
        })}
        confirmLabel={t("pricing.removeConfirm")}
        onConfirm={() => remove(topIndex)}
      />
    </Section>
  );
}

/**
 * Every place the ladder charges less for a longer ride, as ceiling pairs.
 * Only well-formed bands, read in distance order, each against the one
 * below it — an inversion further down is reported where it happens.
 */
function cheaperFarther(bands: readonly Band[]) {
  const sorted = bands
    .filter((band) => band.upToKm > 0 && band.amount >= 0)
    .sort((a, b) => a.upToKm - b.upToKm);
  const pairs: { near: number; far: number }[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const near = sorted[index - 1];
    const far = sorted[index];
    if (far.upToKm !== near.upToKm && far.amount < near.amount) {
      pairs.push({ near: near.upToKm, far: far.upToKm });
    }
  }
  return pairs;
}

/* ───────────────────── Several shops, one order ───────────────────── */

/**
 * The rules for a multi-shop order in words, beside the one number they use.
 *
 * Since `0193` a basket from several shops is priced by the ride it takes:
 * the ladder's band for the whole route, plus the stop fee for each shop after
 * the first, capped at what separate orders would cost. A missing pin is
 * refused, never priced at the top band.
 */
function MultiShop({
  savedExtra,
  extraDraft,
  onExtraChange,
}: {
  savedExtra: number | null;
  extraDraft: number | null;
  onExtraChange: (amount: number | null) => void;
}) {
  const save = useSaveExtraStoreFee();
  const { baseDecimals, baseCode, convertTo, secondaryCode } = useMoney();

  const amount = extraDraft ?? savedExtra ?? 0;
  const dirty = extraDraft !== null && extraDraft !== savedExtra;
  useUnsavedChanges(dirty);

  const to = baseCode ? secondaryCode(baseCode) : null;
  const converted = to && baseCode ? convertTo(amount, baseCode, to) : null;

  const rules = [
    t("pricing.howOne"),
    t("pricing.howMany"),
    t("pricing.howCap"),
    t("pricing.howPin"),
  ];

  return (
    <Section title={t("pricing.howTitle")} description={t("pricing.howBody")}>
      <ol className="flex flex-col gap-3">
        {rules.map((rule, index) => (
          <li key={index} className="flex items-start gap-3 text-[13.5px]">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-hover text-[12px] font-semibold text-ink-2 tabular-nums"
            >
              {index + 1}
            </span>
            <span className="pt-0.5 text-ink-2">{rule}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1 sm:max-w-xs sm:flex-1">
          <Field label={t("pricing.extraTitle")} hint={t("pricing.extraBody")}>
            {(props) => (
              <MoneyInput
                {...props}
                value={amount}
                onChange={(next) => onExtraChange(next ?? 0)}
                // Disabled until the stored figure is in, so a save cannot
                // write the placeholder zero over a real amount.
                decimalDigits={savedExtra === null ? null : baseDecimals}
              />
            )}
          </Field>
          {converted && (
            <span className="text-[12px] text-ink-4 tabular-nums">
              {converted}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:pt-[26px]">
          {dirty && (
            <Button variant="secondary" onClick={() => onExtraChange(null)}>
              {t("pricing.discard")}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!dirty || amount < 0}
            pending={save.isPending}
            onClick={() =>
              save.mutate(amount, { onSuccess: () => onExtraChange(null) })
            }
          >
            {t("pricing.extraSave")}
          </Button>
        </div>
      </div>
    </Section>
  );
}

/* ───────────────────────── The preview ───────────────────────── */

/**
 * The ladder drawn to scale: one segment per band, as wide as the distance it
 * covers, its fee under it, and a mark at the distance being tried. Uber
 * Eats and DoorDash show tiers on a line for the same reason — a band that is
 * 0.5 km wide or 20 km wide looks the same in a table and not on a ruler.
 *
 * A segment is a button that tries its own ceiling, so the preview can walk
 * the ladder without typing.
 */
function LadderStrip({
  bands,
  km,
  onPick,
}: {
  bands: readonly Band[];
  km: number;
  onPick: (ceiling: number) => void;
}) {
  const { baseCode, format } = useMoney();
  const sorted = [...bands]
    .filter((band) => band.upToKm > 0 && band.amount >= 0)
    .sort((a, b) => a.upToKm - b.upToKm)
    // One segment per ceiling; a duplicate is flagged on its row.
    .filter((band, index, all) => all[index - 1]?.upToKm !== band.upToKm);
  if (sorted.length === 0 || !baseCode) return null;

  const radius = sorted[sorted.length - 1].upToKm;
  const marker =
    Number.isFinite(km) && km >= 0 ? Math.min(km / radius, 1) : null;

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="text-[12.5px] font-medium text-ink-3">
        {t("pricing.stripTitle")}
      </figcaption>
      <div className="relative pt-2">
        {marker !== null && km <= radius && (
          <span
            aria-hidden
            className="absolute top-0 bottom-6 z-[1] w-0.5 -translate-x-1/2 rounded-full bg-ink rtl:translate-x-1/2"
            style={{ insetInlineStart: `${marker * 100}%` }}
          />
        )}
        <div className="flex gap-0.5">
          {sorted.map((band, index) => {
            const floor = sorted[index - 1]?.upToKm ?? 0;
            const share = (band.upToKm - floor) / radius;
            // `<=` the ceiling, as `delivery_fee_for_km`; 0 km is the first band.
            const active =
              (index === 0 ? km >= 0 : km > floor) && km <= band.upToKm;
            const label = t("pricing.stripBand", {
              from: floor,
              to: band.upToKm,
              fee: format(band.amount, baseCode),
            });
            return (
              <button
                key={band.upToKm}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => onPick(band.upToKm)}
                className="group flex min-w-0 flex-col gap-1 text-start"
                style={{ flexGrow: share, flexBasis: 0 }}
              >
                <span
                  className={cx(
                    "h-2.5 w-full rounded-sm transition-colors",
                    active
                      ? "bg-accent"
                      : "bg-accent/25 group-hover:bg-accent/45",
                  )}
                />
                <span
                  className={cx(
                    "truncate text-[11px] tabular-nums",
                    active ? "font-semibold text-ink" : "text-ink-3",
                  )}
                >
                  {format(band.amount, baseCode)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        aria-hidden
        className="flex justify-between text-[11px] text-ink-4 tabular-nums"
      >
        <span>{t("pricing.stripKm", { km: 0 })}</span>
        <span>{t("pricing.stripKm", { km: radius })}</span>
      </div>
    </figure>
  );
}

const SHOP_COUNTS = ["1", "2", "3", "4"] as const;

/**
 * The ladder read back. A table is right for setting prices and wrong for
 * checking them: "what does someone four kilometres away pay" is the
 * question, and reading it off a table means scanning for the first ceiling
 * above four. Prices the ladder *as edited*, so a change is checked before
 * it is saved.
 */
function TryDistance({
  bands,
  extra,
  dirty,
}: {
  bands: Band[];
  extra: number;
  dirty: boolean;
}) {
  const { baseCode, format } = useMoney();
  const [km, setKm] = useState("3");
  const [shops, setShops] = useState<(typeof SHOP_COUNTS)[number]>("1");

  const count = Number(shops);
  const distance = km.trim() === "" ? Number.NaN : Number(km);
  const quote = quoteDelivery(bands, distance, count, extra);
  const several = count > 1;

  return (
    <Section title={t("pricing.tryTitle")} description={t("pricing.tryHint")}>
      <div className="flex flex-col gap-4">
        <Field label={t("pricing.tryShops")}>
          <Segmented
            items={SHOP_COUNTS.map((key) => ({ key, label: key }))}
            value={shops}
            onChange={setShops}
          />
        </Field>

        <Field
          label={several ? t("pricing.tryRouteLabel") : t("pricing.tryLabel")}
          hint={several ? t("pricing.tryRouteHint") : undefined}
        >
          {(props) => (
            <NumberInput
              {...props}
              value={km}
              onChange={(event) => setKm(event.target.value)}
              min={0}
              step="any"
            />
          )}
        </Field>

        <div
          aria-live="polite"
          className={cx(
            "flex flex-col gap-2 rounded-md border px-4 py-3.5",
            quote.kind === "out"
              ? "border-danger/20 bg-danger-soft"
              : "border-line bg-subtle",
          )}
        >
          {quote.kind === "none" && (
            <p className="text-[13.5px] text-ink-3">
              {bands.length === 0 ? t("pricing.tryNoBands") : "—"}
            </p>
          )}

          {quote.kind === "out" && (
            <p className="text-[13.5px] font-medium text-danger-ink">
              {several
                ? t("pricing.tryRouteTooLong", { km: quote.radiusKm })
                : t("pricing.tryOutOfRange", { km: quote.radiusKm })}
            </p>
          )}

          {quote.kind === "priced" && baseCode && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium text-ink-3">
                  {t("pricing.tryTotal")}
                </span>
                <Price
                  value={quote.total}
                  code={baseCode}
                  align="end"
                  className="text-[22px] font-semibold tracking-tight text-ink"
                />
              </div>
              {several && (
                <dl className="flex flex-col gap-1 border-t border-line pt-2 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-3">{t("pricing.tryRide")}</dt>
                    <dd className="text-ink tabular-nums">
                      {format(quote.ride, baseCode)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-3">
                      {t("pricing.tryStops", {
                        count: count - 1,
                        fee: format(extra, baseCode),
                      })}
                    </dt>
                    <dd className="text-ink tabular-nums">
                      {format(quote.stops, baseCode)}
                    </dd>
                  </div>
                </dl>
              )}
              <p className="text-[12.5px] text-ink-3">
                {t("pricing.tryBand", { km: quote.band.upToKm })}
              </p>
              {several && (
                <p className="text-[12.5px] text-ink-3">
                  {t("pricing.tryCap")}
                </p>
              )}
            </>
          )}
        </div>

        <LadderStrip
          bands={bands}
          km={distance}
          onPick={(ceiling) => setKm(String(ceiling))}
        />

        {dirty && (
          <p className="flex items-start gap-2 text-[12.5px] text-info-ink">
            <Info className="mt-px size-4 shrink-0" />
            {t("pricing.tryUnsaved")}
          </p>
        )}
      </div>
    </Section>
  );
}
