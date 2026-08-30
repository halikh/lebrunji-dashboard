"use client";

import { useEffect, useRef, useState } from "react";

import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { reveal } from "@/components/ui/reveal";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";
import { formatDateTime } from "@/lib/time";

import type { Band } from "./api/pricing";
import { useLadder, useRates, useSaveLadder, useSetRate } from "./use-pricing";

/**
 * What every order costs to deliver, and what a price is worth.
 *
 * Two screens' worth of decisions that belong on one page: a merchant setting a
 * shop up, or reacting to a currency that moved, does both in the same sitting,
 * and `delivery_quote` reads both on every basket.
 */
const TABS = [
  { key: "rate", labelKey: "pricing.rateTitle" },
  { key: "ladder", labelKey: "pricing.ladderTitle" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function PricingScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("tab");
  const tab: TabKey = requested === "ladder" ? "ladder" : "rate";

  function show(next: TabKey) {
    const query = new URLSearchParams(params);
    if (next === "rate") query.delete("tab");
    else query.set("tab", next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 flex-col gap-sm border-b border-border bg-surface px-xxl pt-lg">
        <h1 className="text-[24px]">{t("pricing.title")}</h1>

        <div role="tablist" className="-mb-px flex gap-lg">
          {TABS.map(({ key, labelKey }) => {
            const selected = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => show(key)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                    return;
                  }
                  event.preventDefault();
                  const at = TABS.findIndex((one) => one.key === tab);
                  const step = event.key === "ArrowRight" ? 1 : -1;
                  show(TABS[(at + step + TABS.length) % TABS.length].key);
                }}
                className={cx(
                  "border-b-2 pb-sm text-[14px] font-semibold",
                  selected
                    ? "border-active text-text"
                    : "border-transparent text-text-soft hover:text-text",
                )}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Siblings rather than one swapped child, so an unsaved ladder survives
          a look at the rate and back — the edits are local until Save, and
          unmounting would throw them away without saying so. */}
      <div className={cx("min-h-0 flex-1", tab !== "rate" && "hidden")}>
        <Rate />
      </div>
      <div className={cx("min-h-0 flex-1", tab !== "ladder" && "hidden")}>
        <Ladder />
      </div>
    </div>
  );
}

/**
 * The exchange rate.
 *
 * ## Why the date is as prominent as the number
 *
 * `0028_currency_choice.sql` stores `rate_updated_at` for one reason, and says
 * it plainly: *a rate with no date is a rumour.* In a country where the number
 * moves, "1 USD = 89,500 LBP" is only useful alongside when somebody last
 * checked — a rate set three months ago is not a rate, it is a guess that
 * happens to be written down.
 *
 * ## Why it confirms, and shows what changes
 *
 * Every price the app displays in the second currency is derived from this one
 * number. Getting a digit wrong does not break anything visibly; it quietly
 * misprices the whole catalogue. So the dialog shows what a real amount becomes
 * — the arithmetic, not a reassurance — because the operator can check *that*
 * against what they expected in a way they cannot check a bare figure.
 */
function Rate() {
  const rates = useRates();
  const save = useSetRate();

  const other = rates.data?.find((one) => !one.isBase) ?? null;
  const base = rates.data?.find((one) => one.isBase) ?? null;

  const [value, setValue] = useState<string | null>(null);
  const typed = value ?? (other ? String(other.rate) : "");
  const next = Number(typed);
  const valid = Number.isFinite(next) && next > 0;

  if (rates.isPending) {
    return <div aria-hidden className="h-[140px] rounded-md bg-neutral-fill" />;
  }

  if (rates.isError || !other || !base) {
    return (
      <section className="flex flex-col gap-sm">
        <h2 className="ps-md text-[18px]">{t("pricing.rateTitle")}</h2>
        <p role="alert" className="text-[13px] font-medium text-danger">
          {rates.error instanceof Error
            ? rates.error.message
            : t("pricing.rateMissing")}
        </p>
      </section>
    );
  }

  /** One unit of the base, in the other currency, as the dialog will say it. */
  const sample = t("pricing.rateLine", {
    base: base.code,
    other: other.code,
    amount: next.toLocaleString("en-GB"),
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <section className="flex flex-col gap-lg p-xxl lg:flex-1 lg:overflow-y-auto">
        <div className="flex flex-col gap-xs">
          <h2 className="ps-md text-[18px]">{t("pricing.rateTitle")}</h2>
          <p className="ps-md text-[14px] text-text-soft">
            {t("pricing.rateBody")}
          </p>
        </div>

        <div className="flex flex-col gap-xs rounded-md border border-border bg-surface p-lg">
          <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
            {t("pricing.rateNow")}
          </span>
          <span className="text-[20px] font-semibold tabular-nums">
            {t("pricing.rateLine", {
              base: base.code,
              other: other.code,
              amount: other.rate.toLocaleString("en-GB"),
            })}
          </span>
          {/* As prominent as the number, because it is what makes the number
            mean anything. */}
          <span className="text-[13px] text-text-faint">
            {t("pricing.rateAsOf", {
              when: formatDateTime(other.rateUpdatedAt),
            })}
          </span>
        </div>

        <Field
          label={t("pricing.rateLabel", { code: other.code })}
          hint={t("pricing.rateHint", { base: base.code, other: other.code })}
          error={
            typed.trim() !== "" && !valid
              ? t("pricing.ratePositive")
              : undefined
          }
        >
          {/* Stacked and full width, so the button is the same shape as the box
            it acts on. Beside it, a short button against a wide input read as a
            control belonging to something else on the row. */}
          <div className="flex flex-col gap-sm">
            <NumberInput
              value={typed}
              onChange={(event) => setValue(event.target.value)}
              min={0}
              step="any"
            />
            <ConfirmButton
              fullWidth
              onConfirm={async () => {
                await save.mutateAsync({ code: other.code, rate: next });
                setValue(null);
              }}
              titleKey="pricing.rateConfirmTitle"
              bodyKey="pricing.rateConfirmBody"
              confirmKey="pricing.rateConfirmAction"
              params={{ sample }}
              variant="primary"
              // Coral, like every other "go on" in the dashboard. A neutral
              // fill made it the same colour as Cancel, and the quieter of the
              // two things on screen — the wrong way round for the only action
              // on the panel.
              triggerVariant="primary"
            >
              {t("pricing.rateSave")}
            </ConfirmButton>
          </div>
        </Field>
      </section>

      <Conversions
        base={base.code}
        other={other.code}
        current={other.rate}
        next={valid ? next : other.rate}
      />
    </div>
  );
}

/**
 * What the rate does to real amounts.
 *
 * A rate is an abstraction until it is multiplied by something. "89,500" is a
 * number nobody can sanity-check; "a 12.50 dish becomes 1,118,750" is a line a
 * merchant either recognises or does not — and recognising it is the only way a
 * mistyped digit gets caught before it reaches a customer.
 *
 * The second column is the rate **as typed**, before it is saved, so the two can
 * be compared side by side. That is the whole reason this sits beside the field
 * rather than under it, and why it appears only once the number has changed.
 */
function Conversions({
  base,
  other,
  current,
  next,
}: {
  base: string;
  other: string;
  current: number;
  next: number;
}) {
  // A spread of the amounts this catalogue deals in: a coffee, a dish, a large
  // order, a week of them. Round numbers, because the point is to be
  // recognisable rather than exact.
  const samples = [2, 12.5, 50, 500];
  const changed = Math.abs(next - current) > 0.0000005;

  return (
    <aside className="flex flex-col gap-lg p-xxl lg:flex-1 lg:overflow-y-auto">
      <div className="flex flex-col gap-xs">
        <h3 className="ps-md text-[15px] font-semibold">
          {t("pricing.whatItMeans")}
        </h3>
        <p className="ps-md text-[13px] text-text-faint">
          {t("pricing.whatItMeansHint")}
        </p>
      </div>

      <div className="flex max-w-[520px] flex-col gap-xs rounded-md border border-border bg-surface p-lg">
        <div className="flex items-baseline gap-md border-b border-border pb-sm text-[12px] font-bold uppercase tracking-wide text-text-faint">
          <span className="flex-grow">{t("pricing.amount")}</span>
          <span className="w-[120px] text-end">{t("pricing.atCurrent")}</span>
          {changed && (
            <span className="w-[120px] text-end text-active-deep">
              {t("pricing.atNew")}
            </span>
          )}
        </div>

        {samples.map((amount) => (
          <div
            key={amount}
            className="flex items-baseline gap-md py-xs text-[14px]"
          >
            <span className="flex-grow tabular-nums">
              {t("pricing.sampleAmount", {
                amount: amount.toLocaleString("en-GB", {
                  minimumFractionDigits: 2,
                }),
                code: base,
              })}
            </span>
            <span className="w-[120px] text-end tabular-nums text-text-soft">
              {Math.round(amount * current).toLocaleString("en-GB")}
            </span>
            {changed && (
              <span className="w-[120px] text-end font-semibold tabular-nums text-active-deep">
                {Math.round(amount * next).toLocaleString("en-GB")}
              </span>
            )}
          </div>
        ))}

        <span className="pt-sm text-[12px] text-text-faint">
          {t("pricing.allIn", { other })}
        </span>
      </div>
    </aside>
  );
}

/**
 * The delivery ladder.
 *
 * ## One table, one Save
 *
 * The bands only mean anything together: each price is chosen against the ones
 * either side of it. Saving row by row would let somebody commit half of a
 * decision they made whole, which is why every edit here is local until Save.
 *
 * ## The largest band is the delivery radius
 *
 * `delivery_fee_for_km` charges the top band for anything beyond it and for any
 * order whose distance is unknown, so the last row is not just the most
 * expensive — it is the edge of the business. The screen says so where it can
 * be read, and removing that row asks first.
 */
function Ladder() {
  const ladder = useLadder();
  const save = useSaveLadder();
  const { format, currencies } = useMoney();

  const [draft, setDraft] = useState<Band[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saved = ladder.data ?? [];
  const bands = draft ?? saved;
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  // The base currency is what an amount here is in — the same units as an order
  // total. Falls back to the bare number until the reference data lands.
  const baseCode =
    currencies?.find((one) => Number(one.rate) === 1)?.code ?? "";

  function edit(index: number, patch: Partial<Band>) {
    setDraft(
      bands.map((band, at) => (at === index ? { ...band, ...patch } : band)),
    );
    setError(null);
  }

  /**
   * The row that was just added, so it can be scrolled to and focused.
   *
   * A ladder is long, and the new band goes at the end — below the fold on
   * anything but the shortest one. The click works, the row is there, and
   * nothing appears to happen, which reads as a broken button. The same rule
   * `reveal()` follows everywhere else.
   *
   * By key rather than by ref: the rows are rebuilt on every keystroke, so a
   * ref captured at click time is stale by the time the effect runs.
   */
  const added = useRef<number | null>(null);

  // Keyed on the count, so it runs after the new row is in the DOM. A ref
  // rather than state: clearing state inside an effect is a second render for
  // something nothing renders.
  useEffect(() => {
    if (added.current === null) return;
    reveal(
      document.querySelector<HTMLElement>(`[data-band="${added.current}"]`),
      { focus: true },
    );
    added.current = null;
  }, [bands.length]);

  function add() {
    // A new band above the current top, so it becomes the radius only if the
    // operator means it to — and starts from the last price rather than zero,
    // which is never the answer.
    const last = bands[bands.length - 1];
    setDraft([
      ...bands,
      {
        upToKm: last ? last.upToKm + 5 : 3,
        amount: last ? last.amount : 0,
      },
    ]);
    added.current = bands.length;
  }

  function remove(index: number) {
    setDraft(bands.filter((_, at) => at !== index));
    setError(null);
  }

  function submit() {
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
    // constraint violation — caught here so it reads as a form rather than as
    // a message about an index.
    if (new Set(sorted.map((band) => band.upToKm)).size !== sorted.length) {
      setError(t("pricing.bandDuplicate"));
      return;
    }

    setError(null);
    save.mutate(sorted, { onSuccess: () => setDraft(null) });
  }

  return (
    // Full width. The ladder is a table of rows that are read across — a
    // distance, a fee, and what the last one means — so it uses the window
    // rather than sharing it.
    <div className="flex h-full min-h-0 flex-col">
      <section className="flex min-h-0 flex-1 flex-col gap-lg overflow-y-auto p-xxl">
        <div className="flex flex-col gap-xs">
          <h2 className="ps-md text-[18px]">{t("pricing.ladderTitle")}</h2>
          <p className="ps-md text-[14px] text-text-soft">
            {t("pricing.ladderBody")}
          </p>
        </div>

        {ladder.isPending && (
          <div aria-hidden className="h-[180px] rounded-md bg-neutral-fill" />
        )}

        {ladder.isError && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {ladder.error instanceof Error
              ? ladder.error.message
              : t("common.somethingWentWrong")}
          </p>
        )}

        <div className="flex flex-col gap-sm">
          {bands.map((band, index) => {
            const isTop = index === bands.length - 1;
            // Not yet in the database — either just added, or a ceiling that was
            // moved, which is the same thing here because `up_to_km` is the key.
            //
            // It needs a look of its own. A new band is usually also the top one,
            // so it was drawing the *radius* border and reading as an existing
            // row that happened to be selected. Dashed says provisional, and the
            // marker says which of the two things this border means.
            const unsaved = !saved.some(
              (one) => one.upToKm === band.upToKm && one.amount === band.amount,
            );
            return (
              <div
                key={index}
                // What the reveal effect looks the new row up by. A `key` is
                // React's, not the DOM's — there is nothing to query for
                // without this.
                data-band={index}
                className={cx(
                  // `items-start`, not `items-end`. One field carries a hint and
                  // the other does not, so aligning the bottoms pushed the
                  // shorter field's input down by the height of a line of text —
                  // two boxes on one row, at two different heights.
                  "flex flex-wrap items-start gap-lg rounded-md border bg-surface px-lg py-md",
                  unsaved
                    ? "border-dashed border-primary bg-primary-wash/30"
                    : isTop
                      ? "border-active"
                      : "border-border",
                )}
              >
                <Field label={t("pricing.upTo")}>
                  <NumberInput
                    value={String(band.upToKm)}
                    onChange={(event) =>
                      edit(index, { upToKm: Number(event.target.value) })
                    }
                    min={0}
                    step="any"
                    className="w-[110px]"
                  />
                </Field>

                <Field
                  label={t("pricing.fee")}
                  hint={
                    baseCode
                      ? format(band.amount, baseCode)
                      : t("pricing.minor")
                  }
                >
                  <NumberInput
                    value={String(band.amount)}
                    onChange={(event) =>
                      edit(index, { amount: Number(event.target.value) })
                    }
                    min={0}
                    className="w-[140px]"
                  />
                </Field>

                {unsaved && (
                  <span className="mt-lg w-fit rounded-full bg-primary-wash px-md py-xxs text-[12px] font-semibold text-primary">
                    {t("pricing.unsavedBand")}
                  </span>
                )}

                {isTop && (
                  // Said where it is decided, and said in full.
                  //
                  // "Delivery radius" is a label, not an explanation — it names
                  // the row without telling anybody what happens either side of
                  // it. The sentence under it does: past this distance there is
                  // no delivery at all, and an order whose distance cannot be
                  // worked out is charged this band. Both are consequences of one
                  // row, and neither is visible anywhere else in the dashboard.
                  <div className="flex min-w-[220px] flex-col gap-xxs pt-lg">
                    <span className="w-fit rounded-full bg-active-wash px-md py-xxs text-[12px] font-semibold text-active-deep">
                      {t("pricing.isRadius")}
                    </span>
                    <span className="text-[12px] text-text-faint">
                      {t("pricing.radiusMeans", { km: band.upToKm })}
                    </span>
                  </div>
                )}

                <div className="ms-auto pt-lg">
                  {/* The confirmation is about losing the delivery radius, which
                    a band that has never been saved cannot lose — removing one
                    undoes a click, and asking about that is the empty question
                    `ConfirmButton` warns against. */}
                  {isTop && !unsaved ? (
                    <ConfirmButton
                      onConfirm={() => remove(index)}
                      titleKey="pricing.removeTopTitle"
                      bodyKey="pricing.removeTopBody"
                      confirmKey="pricing.removeConfirm"
                      params={{
                        km: band.upToKm,
                        next: bands[bands.length - 2]?.upToKm ?? 0,
                      }}
                      variant="danger"
                      triggerVariant="danger"
                      size="sm"
                    >
                      {t("pricing.remove")}
                    </ConfirmButton>
                  ) : (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      {t("pricing.remove")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pinned, both of them.
          A ladder runs to eight or ten bands, and the two controls that act on
          it — add a row, commit the lot — are wanted from wherever the operator
          is in the list. Scrolling to the bottom to reach Save is a cost paid on
          every edit, and an edit here is one decision made across several
          rows. */}
      <div className="flex shrink-0 flex-col gap-sm border-t border-border bg-surface p-lg">
        {/* The same shape as "Add an item to Signature plates" on the menu: a
            dashed, full-width place where the new row will appear. A plain
            button reads as a control *about* the table; this reads as the next
            row of it. */}
        <button
          type="button"
          onClick={add}
          className="flex w-full items-center justify-center gap-sm rounded-md border border-dashed border-border px-lg py-md text-[14px] font-semibold text-text-soft hover:border-primary hover:text-primary"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t("pricing.addBand")}
        </button>

        {error && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        )}

        {/* At the end of the bar, where a form's actions live everywhere else
            in the dashboard — the item editor, the store details, the hours.
            Left-aligned they read as two more rows of the table above. */}
        <div className="flex items-center justify-end gap-sm">
          {dirty && (
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              {t("pricing.discard")}
            </Button>
          )}
          <Button onClick={submit} pending={save.isPending} disabled={!dirty}>
            {t("pricing.ladderSave")}
          </Button>
        </div>
      </div>
    </div>
  );
}
