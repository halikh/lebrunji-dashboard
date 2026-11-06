"use client";

import { AlertCircle, ArrowRight } from "lucide-react";
import { useState } from "react";

import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Section,
  Skeleton,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cx,
} from "@/components/ui";
import { NumberInput } from "@/components/ui/number-input";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { useMoney } from "@/features/reference/use-currencies";
import { useClock } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";
import { convertMoney, formatMoney } from "@/lib/money";

import { useRates, useSetRate } from "./use-pricing";

/**
 * The exchange rate.
 *
 * ## Why the date is as prominent as the number
 *
 * `0028` stores `rate_updated_at` for one reason: *a rate with no date is a
 * rumour.* In a country where the number moves, "1 USD = 89,500 LBP" is only
 * useful alongside when somebody last checked.
 *
 * ## Why it confirms, and shows what changes
 *
 * Every price the app displays in the second currency is derived from this one
 * number. A wrong digit breaks nothing visibly; it quietly misprices the whole
 * catalogue. So the dialog shows the arithmetic, and the table beside the
 * field shows real amounts at the rate as typed, before it is saved.
 */
export function RateTab() {
  const clock = useClock();
  const rates = useRates();
  const save = useSetRate();
  const [confirming, setConfirming] = useState(false);

  const other = rates.data?.find((one) => !one.isBase) ?? null;
  const base = rates.data?.find((one) => one.isBase) ?? null;

  const [value, setValue] = useState<string | null>(null);
  const typed = value ?? (other ? String(other.rate) : "");
  const next = Number(typed);
  const valid = typed.trim() !== "" && Number.isFinite(next) && next > 0;
  const changed = value !== null && valid && next !== other?.rate;

  // Null means untouched, so a rate merely looked at is not unsaved work.
  useUnsavedChanges(value !== null && next !== other?.rate);

  if (rates.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (rates.isError || !other || !base) {
    return (
      <Card padded={false}>
        <EmptyState
          icon={<AlertCircle />}
          title={t("pricing.rateTitle")}
          description={
            rates.error instanceof Error
              ? rates.error.message
              : t("pricing.rateMissing")
          }
          action={
            rates.isError ? (
              <Button onClick={() => void rates.refetch()}>
                {t("common.retry")}
              </Button>
            ) : undefined
          }
        />
      </Card>
    );
  }

  /** One unit of the base, in the other currency, as the dialog will say it. */
  const sample = t("pricing.rateLine", {
    base: base.code,
    other: other.code,
    amount: next.toLocaleString("en-GB"),
  });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Section
        title={t("pricing.rateTitle")}
        description={t("pricing.rateBody")}
      >
        <div className="flex flex-col gap-5">
          {/* The rate now, and when it was set — as prominent as each other. */}
          <div className="flex flex-col gap-1 rounded-md border border-line bg-subtle px-4 py-3.5">
            <span className="text-[12.5px] font-medium text-ink-3">
              {t("pricing.rateNowTitle")}
            </span>
            <span className="text-[20px] font-semibold tracking-tight text-ink tabular-nums">
              {t("pricing.rateLine", {
                base: base.code,
                other: other.code,
                amount: other.rate.toLocaleString("en-GB"),
              })}
            </span>
            <span className="text-[12.5px] text-ink-3">
              {t("pricing.rateAsOf", {
                when: clock.dateTime(other.rateUpdatedAt),
              })}
            </span>
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (changed) setConfirming(true);
            }}
          >
            <Field
              label={t("pricing.rateLabel", { code: other.code })}
              hint={t("pricing.rateHint", {
                base: base.code,
                other: other.code,
              })}
              error={
                value !== null && !valid ? t("pricing.ratePositive") : undefined
              }
            >
              {(props) => (
                <NumberInput
                  {...props}
                  value={typed}
                  onChange={(event) => setValue(event.target.value)}
                  min={0}
                  step="any"
                />
              )}
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              {value !== null && (
                <Button variant="secondary" onClick={() => setValue(null)}>
                  {t("pricing.discard")}
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={!changed}>
                {t("pricing.rateSave")}
              </Button>
            </div>
          </form>

          {/* What the base currency is for. The only place `is_base` surfaces
              on its own, and an operator who has just given one shop its own
              currency has no other way to find out what the rest fall back to. */}
          <div className="flex flex-col gap-0.5 border-t border-line pt-4">
            <span className="text-[13.5px] font-medium text-ink">
              {t("pricing.baseTitle", { code: base.code })}
            </span>
            <span className="text-[13px] text-ink-3">
              {t("pricing.baseBody")}
            </span>
          </div>
        </div>
      </Section>

      <Conversions
        base={base.code}
        other={other.code}
        current={other.rate}
        next={valid ? next : other.rate}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("pricing.rateConfirmTitle")}
        description={t("pricing.rateConfirmBody", { sample })}
        confirmLabel={t("pricing.rateConfirmAction")}
        onConfirm={async () => {
          await save.mutateAsync({ code: other.code, rate: next });
          setValue(null);
        }}
      />
    </div>
  );
}

/**
 * What the rate does to real amounts.
 *
 * "89,500" is a number nobody can sanity-check; "a $12.50 dish becomes
 * ل.ل1,118,750" is a line a merchant either recognises or does not — and that
 * is how a mistyped digit gets caught before it reaches a customer.
 *
 * Every figure goes through `formatMoney` with its own currency row, and the
 * arithmetic through `convertMoney` — the function the storefront converts
 * with — so the preview and the app round the same way.
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
  const { currencies } = useMoney();
  const from = currencies?.find((one) => one.code === base);
  const to = currencies?.find((one) => one.code === other);

  // Nothing rather than a guess: a figure formatted against an assumed scale
  // is indistinguishable from a real one, and this panel is read as a fact.
  if (!from || !to) return null;

  // A coffee, a dish, a large order, a week of them — in the base currency's
  // major units, rounded to what it can actually hold.
  const samples = [2, 12.5, 50, 500];
  const changed = Math.abs(next - current) > 0.0000005;

  const at = (minor: number, rate: number) =>
    formatMoney(convertMoney(minor, from, { ...to, rate }), to);

  return (
    <Section
      title={t("pricing.whatItMeans")}
      description={t("pricing.whatItMeansHint")}
      bodyClassName="p-0"
    >
      <Table>
        <THead>
          <tr>
            <Th>{t("pricing.amount")}</Th>
            <Th className="text-end">{t("pricing.atCurrent")}</Th>
            {changed && <Th className="text-end">{t("pricing.atNew")}</Th>}
          </tr>
        </THead>
        <TBody>
          {samples.map((amount) => {
            const minor = Math.round(amount * 10 ** from.decimalDigits);
            return (
              <Tr key={amount}>
                <Td className="tabular-nums">{formatMoney(minor, from)}</Td>
                <Td
                  className={cx(
                    "text-end tabular-nums",
                    changed && "text-ink-3",
                  )}
                >
                  {at(minor, current)}
                </Td>
                {changed && (
                  <Td className="text-end tabular-nums font-semibold text-accent-ink">
                    <span className="inline-flex items-center gap-1.5">
                      <ArrowRight className="size-3.5 text-ink-4 rtl:rotate-180" />
                      {at(minor, next)}
                    </span>
                  </Td>
                )}
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </Section>
  );
}
