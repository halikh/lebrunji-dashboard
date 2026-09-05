"use client";

import { useState } from "react";

import { Button, Card } from "@/components/ui";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Select } from "@/components/ui/select";
import { useLanguages } from "@/features/reference/use-languages";
import { useMoney } from "@/features/reference/use-currencies";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { restatePrice } from "@/lib/money";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { CurrencyChangeMode, Store } from "./api/stores";
import { useMenu } from "./use-menu";
import { useSetStoreCurrency, useStore, useUpdateStore } from "./use-stores";

/**
 * The shop itself — the brand, as opposed to the places it trades from.
 *
 * ## It used to be a tab, and now it is a card on the Branches one
 *
 * The pin, the prep window and the WhatsApp number moved to Branches with
 * `0101`, because all three are facts about an address and a shop with two
 * addresses cannot answer any of them once. What that left behind was a whole
 * tab holding three fields — a name, a picture and a currency — sitting beside
 * a tab called Branches that carried everything else about the same shop. Two
 * tabs, and no way to tell from their labels which one had the field you
 * wanted.
 *
 * So this is the card at the top of Branches now: the shop, and then the
 * places. Everything about a shop is edited on one screen, read from the brand
 * downward, and the tab strip is one item shorter.
 *
 * It keeps its own Save. The branch editor writes a branch and this writes the
 * store row — two different writes, and one button over both would claim to do
 * something it cannot.
 *
 * ## Why it is here at all
 *
 * The wizard asks for it once and nothing showed it again, so a shop's currency
 * was invisible after the day it was created: an operator opening a shop
 * somebody else set up could only infer it from a formatted price, and could
 * not correct a wrong pick at all. Choosing the wrong one is a first-minute
 * mistake, and it had no first-minute fix.
 *
 * ## It saves with the page, and that is the whole point
 *
 * The first version of this gave the currency its own apply button, on the
 * reasoning that it is more consequential than a renamed shop and deserved its
 * own deliberate act. That reasoning was fine and the result was a bug: the
 * page has one large Save at the bottom, so an operator changed the dropdown,
 * pressed Save, watched every other field save, and saw the currency snap back
 * on the refetch. A field that ignores the page's Save button is a field that
 * does not work, however well argued.
 *
 * So there is one Save and it saves everything. The consequence is shown in
 * place instead, live, the moment the value differs.
 *
 * ## Nothing is converted, and the screen says so
 *
 * Prices are minor units in a column with no currency of its own, so this
 * changes what they mean without changing a digit — and across USD and LBP that
 * is a decimal-scale shift as well as a rate. Rather than describing that, the
 * warning shows it: a real price off this menu, rendered both ways. "The scale
 * differs" is a sentence somebody can read and still not believe.
 *
 * No modal, deliberately. It hangs off the page's Save, which also carries
 * unrelated edits, so a dialog would interrupt somebody who only fixed a
 * typo in the name. The change is exactly reversible — no row is rewritten —
 * and the warning is unmissable and sits against the control that caused it.
 */
export function StoreBrandForm({ storeId }: { storeId: string }) {
  const store = useStore(storeId);

  if (store.isPending) {
    return (
      <Card>
        <div aria-hidden className="flex flex-col gap-lg">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-[64px] rounded-md bg-neutral-fill" />
          ))}
        </div>
      </Card>
    );
  }

  if (store.isError || !store.data) {
    return (
      <Card className="flex flex-col items-center gap-lg text-center">
        <div className="flex flex-col gap-xs">
          <h2 className="text-[18px]">{t("catalogue.failedTitle")}</h2>
          <p className="text-[14px] text-text-soft">
            {t("catalogue.failedBody")}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void store.refetch()}>
          {t("common.retry")}
        </Button>
      </Card>
    );
  }

  // Keyed on the row, so arriving at a different shop rebuilds the form rather
  // than leaving the previous one's values in the fields.
  return <Form key={store.data.id} store={store.data} />;
}

function CurrencySection({
  value,
  onChange,
  mode,
  onModeChange,
  preview,
}: {
  value: string;
  onChange: (code: string) => void;
  mode: CurrencyChangeMode;
  onModeChange: (mode: CurrencyChangeMode) => void;
  /**
   * A real price off this menu under each answer, or null when there is nothing
   * to restate — a shop with no dishes, or a currency that has not moved.
   */
  preview: { before: string; keep: string; convert: string } | null;
}) {
  const { currencies } = useMoney();

  return (
    <section className="flex flex-col gap-lg">
      <h2 className="ps-md text-[17px]">{t("store.currencyTitle")}</h2>

      <Field label={t("store.currency")} hint={t("store.currencyEditHint")}>
        <Select
          value={value}
          onChange={onChange}
          placeholder={t("store.pickCurrency")}
          options={(currencies ?? []).map((one) => ({
            value: one.code,
            label: one.code,
          }))}
        />
      </Field>

      {preview && (
        <div className="flex flex-col gap-md rounded-md border border-danger-wash bg-danger-wash/40 px-lg py-lg">
          <p role="status" className="text-[13px] text-text">
            {t("store.currencyMoved", { before: preview.before })}
          </p>

          {/*
            Both answers, each showing what it does to a real price off this
            menu. Describing the difference does not work — "restate the digits"
            and "convert at the rate" are the same sentence to anybody who has
            not thought about minor units. "12 becomes ل.ل12" against "12
            becomes ل.ل1,076,400" needs no explaining at all.
          */}
          <ChoiceOfMode
            checked={mode === "keep"}
            onSelect={() => onModeChange("keep")}
            label={t("store.currencyKeep")}
            result={t("store.currencyBecomes", {
              before: preview.before,
              after: preview.keep,
            })}
          />
          <ChoiceOfMode
            checked={mode === "convert"}
            onSelect={() => onModeChange("convert")}
            label={t("store.currencyConvert")}
            result={t("store.currencyBecomes", {
              before: preview.before,
              after: preview.convert,
            })}
          />

          <p className="text-[12px] text-text-faint">
            {t("store.currencyLossy")}
          </p>
        </div>
      )}
    </section>
  );
}

/** One of the two answers, with what it does to a real price. */
function ChoiceOfMode({
  checked,
  onSelect,
  label,
  result,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  result: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-sm text-[13px]">
      <input
        type="radio"
        name="currency-mode"
        checked={checked}
        onChange={onSelect}
        className="mt-[2px] size-[16px] shrink-0 accent-[var(--color-active)]"
      />
      <span className="flex min-w-0 flex-col gap-xxs">
        <span className="font-semibold text-text">{label}</span>
        <span className="tabular-nums text-text-soft">{result}</span>
      </span>
    </label>
  );
}

function Form({ store }: { store: Store }) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const update = useUpdateStore();
  const setCurrency = useSetStoreCurrency();
  const { format, currencies } = useMoney();
  // Only for the worked example below. Cached — the Menu tab has usually
  // already loaded it — and its absence costs nothing: no sample, no warning,
  // which is the right answer for a shop with no menu anyway.
  const menu = useMenu(store.id);

  const [name, setName] = useState<Localized>(store.name);
  const [currencyCode, setCurrencyCode] = useState(store.currencyCode);
  /**
   * What the change is *for*, defaulted to the common case.
   *
   * `keep` is the wrong-pick fix and is what almost every change here will be.
   * `convert` is a shop genuinely re-denominating, which happens once if ever —
   * so it is the deliberate choice rather than the one you land on.
   */
  const [mode, setMode] = useState<CurrencyChangeMode>("keep");
  const [imageUrl, setImageUrl] = useState<string | null>(store.imageUrl);

  // `mode` is left out on purpose: it is a question *about* a currency change
  // rather than a value of its own, and it cannot be reached without moving
  // `currencyCode` first — which is compared.
  useUnsavedChanges(
    changed(
      { name, currencyCode, imageUrl },
      {
        name: store.name,
        currencyCode: store.currencyCode,
        imageUrl: store.imageUrl,
      },
    ),
  );

  const [errors, setErrors] = useState<{
    name?: string;
  }>({});

  const currencyMoved =
    currencyCode !== "" && currencyCode !== store.currencyCode;

  /**
   * A real price off this menu under each answer.
   *
   * Null when the currency has not moved, or when the shop has nothing priced —
   * and the second case is the one this feature exists for. A shop created five
   * minutes ago has nothing to misprice, so it gets no question and no friction.
   *
   * `restatePrice` is the same arithmetic `api_v1_set_store_currency` runs, so
   * these figures are what will actually be written. A preview computed any
   * other way would be a promise rather than a preview.
   */
  const sample =
    (menu.data ?? []).flatMap((section) => section.items)[0] ?? null;
  const from = currencies?.find((one) => one.code === store.currencyCode);
  const into = currencies?.find((one) => one.code === currencyCode);

  const preview =
    currencyMoved && sample && from && into
      ? {
          before: format(sample.price, from.code),
          keep: format(
            restatePrice(sample.price, from, into, "keep"),
            into.code,
          ),
          convert: format(
            restatePrice(sample.price, from, into, "convert"),
            into.code,
          ),
        }
      : null;

  async function save() {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);

    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
    };

    setErrors(found);
    if (found.name) return;

    /*
     * The currency first, and only if it moved.
     *
     * Two writes rather than one, because they are two different things: the
     * currency rewrites every price in the shop and has to be atomic on its
     * own, while the rest is a handful of columns on this row. Neither can be
     * folded into the other.
     *
     * It goes first so a failure stops here. The reverse order would leave the
     * shop renamed and its prices in a currency the operator was told had
     * changed — a screen and a database disagreeing about money.
     */
    if (currencyMoved) {
      try {
        await setCurrency.mutateAsync({
          storeId: store.id,
          currencyCode,
          mode,
          name: store.name,
        });
      } catch {
        // Already reported by the mutation's own toast. Returning here is what
        // stops the rest of the save from running on a shop whose prices did
        // not move.
        return;
      }
    }

    update.mutate({
      id: store.id,
      patch: {
        name,
        imageUrl,
      },
      name: store.name,
    });
  }

  return (
    <Card className="flex flex-col gap-xxl">
      {/*
        One column, capped.

        This was two — fields on the left, the map on the right — until the pin
        moved to the branch that owns it. What is left is three short answers,
        and stretching a name field across a wide monitor makes it harder to
        read and to aim at rather than easier. `max-w-[540px]` is the same width
        the left column had.
      */}
      <div className="flex max-w-[540px] flex-col gap-xxl">
        <section className="flex flex-col gap-lg">
          <LocalizedField
            label={t("store.name")}
            value={name}
            onChange={setName}
            maxLength={TEXT.name}
            hint={t("store.nameHint")}
            error={errors.name}
            placeholder={{ en: "Nara Kitchen", ar: "مطبخ نارة" }}
          />

          <Field label={t("images.label")} hint={t("store.imageHint")}>
            <ImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              folder="stores"
              disabled={update.isPending}
            />
          </Field>
        </section>

        <CurrencySection
          value={currencyCode}
          onChange={setCurrencyCode}
          mode={mode}
          onModeChange={setMode}
          preview={preview}
        />
      </div>

      {/* At the end of the card rather than pinned to the window. A pinned bar
          is right for a pane that *is* the screen; this one is a card with a
          list of branches under it, and a Save floating over that list would
          be ambiguous about which of the two it saved. */}
      <div className="flex items-center justify-end border-t border-border pt-lg">
        <Button
          onClick={() => void save()}
          pending={update.isPending || setCurrency.isPending}
        >
          {t("store.save")}
        </Button>
      </div>
    </Card>
  );
}
