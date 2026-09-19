"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Field } from "@/components/ui";
import { EditorPage } from "@/components/ui/editor-page";
import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { MoneyInput } from "@/components/ui/money-input";
import { NumberInput } from "@/components/ui/number-input";
import { LocalizedField } from "@/components/ui/localized-field";
import { Toggle } from "@/components/ui/toggle";
import { MultiSelect, Select } from "@/components/ui/select";
import { ImageUploader } from "@/components/ui/image-uploader";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";

import { ItemOptions } from "./item-options";
import { ShopLine } from "./store-identity";
import { TagChip } from "./tag-chip";
import { useStore } from "./use-stores";
import { useTagVocabulary } from "./use-tags";
import { useMoney } from "@/features/reference/use-currencies";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import type { Localized } from "@/lib/validation";
import {
  linePrice,
  PRICE_UNITS,
  unitAmount,
  unitKey,
  type PriceUnit,
} from "@/lib/units";
import {
  validateLocalizedText,
  validatePrice,
  type Valid,
} from "@/lib/validation";

export type ItemDraft = {
  name: Localized;
  description: Localized;
  /** Minor units, as an integer. Never a float — see `lib/money.ts`. */
  price: number;
  isActive: boolean;
  /** A Storage URL, or null for no picture. */
  imageUrl: string | null;
  /**
   * What the price buys — `('kg', 1)` for a one-kilo pack.
   *
   * Both null for an item sold as itself, which is most of them. `0095` refuses
   * one without the other, so the form clears them together.
   */
  priceUnit: PriceUnit | null;
  unitQuantity: number | null;
  /**
   * How far one press of the customer's `+` or `−` moves — `0119`.
   *
   * Null for the plain whole-item stepper, and null whenever the unit is,
   * since a step with nothing to step in is a number nothing reads.
   */
  unitStep: number | null;
  /**
   * The chips this dish carries, as ids into the shared vocabulary.
   *
   * The vocabulary is edited on the catalogue's Tags tab, not here — a tag is a
   * property of the whole app, and a form that could invent one would be four
   * spellings of "Spicy" waiting to happen. This form only says which of the
   * existing ones apply.
   */
  tagIds: string[];
};

/**
 * The form that adds or edits an item.
 *
 * ## Why not the row itself
 *
 * The flow study called for editing in place, and this replaces that. An item
 * carries more than a row can hold without pushing the list around: two
 * languages of name, two of description, a price, a slug, a switch — and
 * eventually an image. Growing a row to fit all of that reflows every row below
 * it, so the list the operator was reading moves under them each time they open
 * one.
 *
 * What mattered about the inline idea was **not losing your place in the
 * menu**, and that is kept without the row growing: the page returns
 * `?focus=<id>` and the list scrolls that dish back into view. The section this
 * dish belongs to is named in the overline, which is the context that says
 * whether the thing being added belongs there, and "save and add another" keeps
 * the operator on the form rather than sending them round the loop again.
 *
 * See `MenuItemScreen`, which is what supplies all of that.
 *
 * ## There is no slug field
 *
 * A slug is a key, not content — nobody using the app ever sees one. It exists
 * so an import file has something stable to join on, and the database fills it
 * from the English name (migration 0070).
 *
 * Generating it here was the first attempt and could not do the part that
 * matters: make it **unique without racing**. Checking whether a slug is taken
 * and then inserting is two round trips with a gap in the middle, and the gap is
 * where two tabs both decide `kibbeh-plate` is free. A trigger runs inside the
 * insert's own transaction.
 */
export function MenuItemEditor({
  storeId,
  itemId,
  sectionId,
  initial,
  title,
  overline,
  imageUrl: pictureUrl,
  backHref,
  backLabel,
  pending,
  error,
  onSave,
  onSaveAndAnother,
  onCancel,
}: {
  initial?: Partial<ItemDraft>;
  /** The dish's name, or "New item". */
  title: string;
  /** Which section it lands in — see the note on `MenuItemScreen`. */
  overline: string;
  /** The dish's own picture, drawn beside the title. */
  imageUrl?: string | null;
  backHref: string;
  backLabel: string;
  pending: boolean;
  error?: string | null;
  onSave: (draft: ItemDraft) => void;
  /** Absent when editing: "add another" only means something while adding. */
  onSaveAndAnother?: (draft: ItemDraft) => void;
  /** Where this dish lives, so the options link can open on it. */
  storeId: string;
  itemId: string | null;
  sectionId: string;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  // A dish is priced in its shop's currency — which is whichever one the wizard
  // was pointed at, and *not* necessarily the base one the ladder and the
  // discounts are written in. Asking the base currency how many decimals to
  // scale by put a hundred between what was typed and what was stored on every
  // shop that priced in the other currency.
  //
  // The same query the menu screen around this already runs, so it is a cache
  // read rather than a second fetch.
  const store = useStore(storeId);
  const { decimalsOf, format } = useMoney();
  const decimals = decimalsOf(store.data?.currencyCode ?? "");

  /**
   * The shop, above the dish's name.
   *
   * Small and quiet: it is the answer to "which menu am I in", which somebody
   * needs once on arriving and never again while typing. The picture is the
   * shop's own, at the size a favicon reads at rather than the dish's.
   */
  const shopLine = store.data ? <ShopLine store={store.data} /> : null;

  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [description, setDescription] = useState<Localized>(
    initial?.description ?? {},
  );
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? []);
  const [priceUnit, setPriceUnit] = useState<PriceUnit | "">(
    initial?.priceUnit ?? "",
  );
  /** A string while it is being typed — `1.` is not a number and is valid so far. */
  const [unitQuantity, setUnitQuantity] = useState(
    initial?.unitQuantity == null ? "" : String(initial.unitQuantity),
  );
  /** Same, for the step. Empty is a real answer: the whole-item stepper. */
  const [unitStep, setUnitStep] = useState(
    initial?.unitStep == null ? "" : String(initial.unitStep),
  );

  // A new item opens with `isActive` already true, so the comparison is against
  // what the form *opened with* rather than against empty — otherwise every
  // blank editor would announce itself as unsaved the moment it appeared.
  useUnsavedChanges(
    changed(
      {
        name,
        description,
        price,
        isActive,
        imageUrl,
        tagIds,
        priceUnit,
        unitQuantity,
        unitStep,
      },
      {
        name: initial?.name ?? {},
        description: initial?.description ?? {},
        price: String(initial?.price ?? ""),
        isActive: initial?.isActive ?? true,
        imageUrl: initial?.imageUrl ?? null,
        tagIds: initial?.tagIds ?? [],
        priceUnit: initial?.priceUnit ?? "",
        unitQuantity:
          initial?.unitQuantity == null ? "" : String(initial.unitQuantity),
        unitStep: initial?.unitStep == null ? "" : String(initial.unitStep),
      },
    ),
  );

  const tags = useTagVocabulary();

  /**
   * One message per field, not one for the form.
   *
   * The first version collected the *first* failure and printed it at the
   * bottom of the panel — so "This is required." sat under the visibility
   * switch while the empty field it was about had scrolled off the top. A
   * message detached from its field is barely a message: the operator is told
   * something is wrong and left to find out what.
   *
   * Every field is checked, not just up to the first failure. Reporting one
   * problem at a time turns a form into a queue of round trips, and the
   * operator fixes a name only to be told about a price.
   */
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    price?: string;
    unit?: string;
    step?: string;
  }>({});

  const codes = languages.data?.map((language) => language.code) ?? [];

  /**
   * After a failed save, take the operator to the first problem.
   *
   * The panel scrolls, so a message can be perfectly well attached to its field
   * and still be invisible — which is what the screenshot showed: the empty
   * name had scrolled off the top while the form reported it at the bottom.
   * Marking the field is not enough if the field is not on screen.
   *
   * Focus as well as scroll, so a screen reader lands on the control and reads
   * the error `aria-describedby` points at — the same journey, by another
   * route.
   */
  /**
   * The stepper, spelled out — **with what each press costs**.
   *
   * Built from `unitAmount` and `linePrice`, which are the app's own
   * arithmetic: three presses here and three presses on a phone are the same
   * three amounts at the same three prices, because both come from the same
   * two functions rather than from a description of them that can drift.
   *
   * ## Why the money is in it
   *
   * This used to show the amounts alone, with a warning underneath for the case
   * where the step did not match — "each press adds one more price, so this
   * only adds up when the step matches the amount". That was true, and it was
   * the wrong answer: a shop quoting per kilo means per kilo. `0122` made the
   * price a rate, and the honest way to say so is to show the prices and let
   * the operator read them.
   *
   * Three is enough to show a pattern and short enough to read at a glance.
   */
  const stepPreview = (() => {
    if (priceUnit === "") return null;

    const quantity = Number(unitQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    const word = t(unitKey(priceUnit));
    const typedStep = unitStep.trim() === "" ? null : Number(unitStep);

    // Typed but not yet valid — mid-keystroke, or the error above. Nothing
    // truthful to draw, and a preview that guessed would be worse than none.
    if (typedStep !== null && (!Number.isFinite(typedStep) || typedStep <= 0)) {
      return null;
    }

    if (typedStep === null) {
      return t("units.stepPreviewNone", {
        size: t("units.size", { quantity, unit: word }),
      });
    }

    const unit = { unit: priceUnit, quantity, step: typedStep };
    const minor = price.trim() === "" ? NaN : Number(price);
    const code = store.data?.currencyCode ?? "";

    const chain = [1, 2, 3]
      .map((press) => {
        const size = t("units.size", {
          quantity: unitAmount(unit, press),
          unit: word,
        });

        // The amount alone until there is a price to scale and a currency to
        // say it in — the same rule `MoneyInput` above follows, and for the
        // same reason: a figure in the wrong currency's clothes is worse than
        // no figure. Options are nothing here; this is the dish by itself.
        if (!Number.isFinite(minor) || code === "") return size;

        return t("units.stepPreviewStop", {
          size,
          price: format(linePrice(minor, 0, unit, press), code),
        });
      })
      .join(" → ");

    return t("units.stepPreview", { chain });
  })();

  const form = useRef<HTMLDivElement>(null);
  const attempt = useRef(0);

  useEffect(() => {
    if (attempt.current === 0) return;
    const first = form.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    if (!first) return;
    first.scrollIntoView({ block: "center", behavior: "smooth" });
    first.focus({ preventScroll: true });
  }, [errors]);

  function build(): ItemDraft | null {
    const parsed = price.trim() === "" ? NaN : Number(price);

    // Both or neither — the pair `0095` enforces. A unit with no amount is
    // "kg" without saying how many, which nothing can draw.
    const amount = unitQuantity.trim() === "" ? null : Number(unitQuantity);
    // Empty is the answer most items give, so it parses to null rather than to
    // NaN — "not stepped" is a state, not a failed number.
    const step = unitStep.trim() === "" ? null : Number(unitStep);
    const unitProblem =
      priceUnit === ""
        ? undefined
        : amount === null || !Number.isFinite(amount)
          ? t("units.quantityRequired")
          : amount <= 0
            ? t("units.quantityPositive")
            : undefined;

    // Optional, unlike the amount: an item can have a unit and still be counted
    // one at a time, which is what every item written before `0119` does. So
    // the only failure here is a step that has been typed and cannot move —
    // `0119`'s CHECK refuses those, and a form that let one through would turn
    // a save into a Postgres error the operator cannot read.
    const stepProblem =
      priceUnit === "" || step === null
        ? undefined
        : !Number.isFinite(step) || step <= 0
          ? t("units.stepPositive")
          : undefined;

    const found = {
      name: messageOf(validateLocalizedText(name, codes, TEXT.name)),
      description: messageOf(
        validateLocalizedText(description, codes, TEXT.description, {
          optional: true,
        }),
      ),
      price: messageOf(validatePrice(Number.isFinite(parsed) ? parsed : NaN)),
      unit: unitProblem,
      step: stepProblem,
    };

    setErrors(found);
    // Bumped every attempt, so two identical failures still scroll — without
    // it, pressing Save twice on the same empty field would change nothing and
    // the effect would not run.
    attempt.current += 1;

    if (
      found.name ||
      found.description ||
      found.price ||
      found.unit ||
      found.step
    ) {
      return null;
    }
    return {
      name,
      description,
      price: parsed,
      isActive,
      imageUrl,
      tagIds,
      // Cleared together: an amount left behind on an item whose unit was
      // removed is a number nothing reads and the CHECK would refuse.
      priceUnit: priceUnit === "" ? null : priceUnit,
      unitQuantity: priceUnit === "" ? null : (amount as number),
      // All three together — `0119` refuses a step beside a null unit for the
      // same reason `0095` refuses an amount beside one.
      unitStep: priceUnit === "" ? null : step,
    };
  }

  return (
    <EditorPage
      title={title}
      backHref={backHref}
      backLabel={backLabel}
      /* Two columns' worth of room — see the grid below, and `EditorPage`. */
      width="wide"
      /* The same 46pt square the row was clicked on, so the page opens looking
         like the thing it came from. */
      media={
        pictureUrl ? (
          <PreviewImage
            src={pictureUrl}
            name={title}
            className="size-[46px] shrink-0 rounded-md"
          />
        ) : (
          <ImagePlaceholder className="size-[46px] shrink-0 rounded-md" />
        )
      }
      /* Which shop's menu this is. Two shops can both sell a Charcoal Chicken
         Taouk, and on a page reached by URL the title alone does not say which
         one is being edited. */
      meta={shopLine}
      /* Which section this dish lands in. The title cannot say it — a name
         on its own reads the same wherever it sits in the menu. */
      aside={
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
          {overline}
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          {onSaveAndAnother && (
            <Button
              variant="primary-quiet"
              pending={pending}
              onClick={() => {
                const draft = build();
                if (draft) onSaveAndAnother(draft);
              }}
            >
              {t("menu.saveAndAnother")}
            </Button>
          )}
          <Button
            pending={pending}
            onClick={() => {
              const draft = build();
              if (draft) onSave(draft);
            }}
          >
            {t("menu.save")}
          </Button>
        </>
      }
    >
      {/**
       * Two equal columns on a wide screen, one on a narrow one, filling the
       * page between them.
       *
       * The split is not "half the fields each" — it is the two kinds of thing
       * a dish is made of. On the left, **what it is**: the name, the
       * description, and the way through to the questions it asks. On the
       * right, **the facts about it**: the price, what that price buys, the
       * tags, the picture and whether it is live.
       *
       * Equal halves rather than a wide column and a sidebar. The left is four
       * boxes of prose (two languages each, one right-to-left) and the right is
       * short controls, so the two do not *need* the same width — but they are
       * read as a pair, and two columns that nearly match read as a column that
       * missed rather than as a deliberate proportion.
       *
       * Stacked below `lg`, left column first, which is close to the order the
       * form had before: name, description, options, then price, unit, tags,
       * picture, visibility.
       *
       * `items-start` so the two columns keep their own heights — stretched,
       * the shorter one would grow a tail of empty box under its last field.
       *
       * The ref stays on a wrapper enclosing **both** columns, because the
       * first-error scroll below searches inside it and an error can be in
       * either one.
       */}
      <div
        ref={form}
        className="grid grid-cols-1 items-start gap-lg lg:grid-cols-2 lg:gap-xxl"
      >
        <div className="flex min-w-0 flex-col gap-lg">
          <LocalizedField
            label={t("menu.name")}
            value={name}
            onChange={setName}
            // One example per language. An English example above an Arabic
            // input shows the wrong script in the wrong direction, and hints
            // that English is what belongs there.
            placeholder={{
              en: t("menu.namePlaceholder"),
              ar: t("menu.namePlaceholderAr"),
            }}
            hint={t("menu.nameHint")}
            error={errors.name}
            maxLength={TEXT.name}
            format="upper"
          />
          <LocalizedField
            label={t("menu.description")}
            value={description}
            onChange={setDescription}
            placeholder={{
              en: t("menu.descriptionPlaceholder"),
              ar: t("menu.descriptionPlaceholderAr"),
            }}
            multiline
            optional
            hint={t("menu.descriptionHint")}
            error={errors.description}
            maxLength={TEXT.description}
            format="sentence"
          />

          {/* The way through to the Options page, and nothing else.
              No label and no hint: a `Field` is a thing on this form with a
              value, and dressing the link as one said the panel had options in
              it — when the point is that it does not. Options belong to the
              Options tab, which is where the whole of that job lives.

              Under the description, at the foot of the column that says what
              this dish *is*: its options are the rest of that answer — which
              size, which bread — where everything in the other column is a fact
              about the dish rather than part of describing it. The rule above it
              stays, so the link does not read as the last field of the form it
              is not part of. */}
          <div className="border-t border-border pt-lg">
            <ItemOptions
              storeId={storeId}
              itemId={itemId}
              sectionId={sectionId}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-lg">
          <Field
            label={t("menu.price")}
            hint={t("menu.priceHint")}
            error={errors.price}
          >
            {/* Typed as a person would say it — `18.75`, not `1875`. The
              conversion to minor units is `MoneyInput`'s, so the operator
              adding forty dishes in an afternoon is not doing it forty
              times. */}
            <MoneyInput
              value={price.trim() === "" ? null : Number(price)}
              onChange={(minor) =>
                setPrice(minor === null ? "" : String(minor))
              }
              // `null` until the shop's currency lands, which disables the box
              // rather than letting `3` be entered before it is settled whether
              // that means 3 or 300.
              decimalDigits={decimals}
              placeholder={t("menu.pricePlaceholder")}
            />
          </Field>

          {/* Straight after the price, because it is a fact *about* the price:
            "$12.00" and "$12.00 for a kilo" are different offers, and reading
            one without the other is how a customer compares two shops
            wrongly. Empty for most items, which is why the unit leads and the
            amount only appears once there is something to measure. */}
          <Field
            label={t("units.label")}
            hint={t("units.hint")}
            error={errors.unit ?? errors.step}
          >
            <div className="flex flex-wrap items-start gap-sm">
              {/* Three equal columns, filling the field.

                They were 150 and 130 and 130, which left a third of the row
                empty on a wide panel — three small boxes huddled at the start
                of a line, reading as controls that failed to lay out rather
                than as the three parts of one answer. Equal thirds say what
                they are: the unit, how much of it, and how far a press moves.

                `basis-[110px]` is the width each *asks* for before the share is
                worked out, so on a narrow panel they wrap to two lines instead
                of shrinking to boxes no number fits in.

                With no unit picked there is only this one, and it takes the
                whole row — which is the common state of the field, since most
                items are sold as themselves. */}
              <span className="min-w-0 flex-1 basis-[110px]">
                <Select
                  value={priceUnit}
                  onChange={(value) => {
                    setPriceUnit(value as PriceUnit | "");
                    // Cleared together. An amount left behind on an item whose
                    // unit was removed is a number nothing reads, and `0095`
                    // and `0119` would refuse the trio anyway.
                    if (!value) {
                      setUnitQuantity("");
                      setUnitStep("");
                    }
                  }}
                  placeholder={t("units.none")}
                  isClearable
                  options={PRICE_UNITS.map((unit) => ({
                    value: unit,
                    label: t(unitKey(unit)),
                  }))}
                />
              </span>

              {priceUnit !== "" && (
                <>
                  <span className="min-w-0 flex-1 basis-[110px]">
                    <NumberInput
                      value={unitQuantity}
                      onChange={(event) => setUnitQuantity(event.target.value)}
                      min={0}
                      step="any"
                      placeholder="1"
                      aria-label={t("units.quantity")}
                    />
                  </span>

                  {/* Beside the amount, because the two are read as a pair: the
                    amount is where the customer starts and this is how far each
                    press moves them. Optional — empty is the whole-item stepper
                    every item had before `0119`. */}
                  <span className="min-w-0 flex-1 basis-[110px]">
                    <NumberInput
                      value={unitStep}
                      onChange={(event) => setUnitStep(event.target.value)}
                      min={0}
                      step="any"
                      placeholder={t("units.step")}
                      aria-label={t("units.step")}
                    />
                  </span>
                </>
              )}
            </div>

            {/*
              What the customer will actually see.

              Two numbers that describe a range are hard to check by reasoning
              about and trivial to check by reading, and this is the whole
              feature said back: "5 kg → 10 kg → 15 kg". It draws from the same
              `unitAmount` the app steps with, so an operator who reads this has
              read the app's behaviour rather than a second description of it.
            */}
            {stepPreview && (
              <p className="ps-md text-[12px] text-text-faint">{stepPreview}</p>
            )}
          </Field>

          {/* Beside the price rather than down with the options, because a tag
            is part of what the dish *is* — the same kind of fact as its name
            — whereas the options are a set of questions it asks. */}
          <Field
            label={t("tags.itemLabel")}
            hint={
              tags.isSuccess && tags.data.length === 0
                ? t("tags.itemNone")
                : t("tags.itemHint")
            }
          >
            <MultiSelect
              value={tagIds}
              onChange={setTagIds}
              placeholder={t("tags.itemPlaceholder")}
              disabled={pending || !tags.isSuccess}
              options={(tags.data ?? []).map((tag) => ({
                value: tag.id,
                // The label is what typing filters on and what a screen reader
                // reads; the chip is what the eye picks out of a list of five.
                label: pickLocalized(tag.name),
                render: (
                  <TagChip
                    tone={tag.tone}
                    ink={tag.ink}
                    color={tag.color}
                    label={pickLocalized(tag.name)}
                  />
                ),
              }))}
            />
          </Field>

          {/* Last, and deliberately.
            The name and the price are what an item *is*; a picture is how it
            is sold. Putting it first makes the form open on the slowest,
            most optional thing in it — and an operator adding forty items in
            an afternoon would meet the upload box forty times before the
            field they came to fill in. */}
          <Field label={t("images.label")} hint={t("images.hint")}>
            <ImageUploader
              value={imageUrl}
              onChange={setImageUrl}
              folder="menu-items"
              disabled={pending}
            />
          </Field>

          <Field
            label={t("menu.visibility")}
            hint={isActive ? t("menu.liveHint") : t("menu.hiddenHint")}
          >
            <Toggle
              on={isActive}
              onChange={() => setIsActive((current) => !current)}
              labelOn={t("menu.live")}
              labelOff={t("menu.hidden")}
            />
          </Field>
        </div>
      </div>

      {/* Only what belongs to no field — a refusal from the server. Anything
          about a value appears beside that value. */}
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </EditorPage>
  );
}

/**
 * A failure's sentence, or nothing when it passed.
 *
 * The validator hands back a key; the screen turns it into words. That split is
 * what keeps validation messages inside the translation bundle with every other
 * string, rather than being the one class of user-facing text that never went
 * through `t()`.
 */
function messageOf(result: Valid): string | undefined {
  return result.ok ? undefined : t(result.key, result.params);
}
