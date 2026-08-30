"use client";

import { useState } from "react";

import { Button, Field } from "@/components/ui";
import { NumberInput } from "@/components/ui/number-input";
import { LocalizedField } from "@/components/ui/localized-field";
import { Toggle } from "@/components/ui/toggle";
import { useLanguages } from "@/features/reference/use-languages";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import type { Localized } from "@/lib/validation";
import {
  firstFailure,
  validateLocalizedText,
  validatePrice,
} from "@/lib/validation";

export type ItemDraft = {
  name: Localized;
  description: Localized;
  /** Minor units, as an integer. Never a float — see `lib/money.ts`. */
  price: number;
  isActive: boolean;
};

/**
 * The form that adds or edits an item, in the side panel.
 *
 * ## Why a panel rather than the row itself
 *
 * The flow study called for editing in place, and this replaces that. An item
 * carries more than a row can hold without pushing the list around: two
 * languages of name, two of description, a price, a slug, a switch — and
 * eventually an image. Growing a row to fit all of that reflows every row below
 * it, so the list the operator was reading moves under them each time they open
 * one.
 *
 * The panel keeps what mattered about the inline idea and drops what did not:
 * **the section stays on screen beside the form**, which is the context that
 * says whether the thing being added belongs there, and "save and add another"
 * still leaves the operator exactly where they are. What is lost is editing
 * literally within the row, which was never the point — not losing your place
 * was.
 *
 * It also means one shell pattern: detail opens beside the list here exactly as
 * an order's receipt does.
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
  initial,
  pending,
  error,
  onSave,
  onSaveAndAnother,
  onCancel,
}: {
  initial?: Partial<ItemDraft>;
  pending: boolean;
  error?: string | null;
  onSave: (draft: ItemDraft) => void;
  /** Absent when editing: "add another" only means something while adding. */
  onSaveAndAnother?: (draft: ItemDraft) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();

  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [description, setDescription] = useState<Localized>(
    initial?.description ?? {},
  );
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [shown, setShown] = useState<string | null>(null);

  const codes = languages.data?.map((language) => language.code) ?? [];
  function build(): ItemDraft | null {
    const parsed = Number(price);
    const problem = firstFailure([
      validateLocalizedText(name, codes, TEXT.name),
      validateLocalizedText(description, codes, TEXT.description, {
        optional: true,
      }),
      validatePrice(Number.isFinite(parsed) ? parsed : NaN),
    ]);

    if (!problem.ok) {
      setShown(problem.message);
      return null;
    }

    setShown(null);
    return { name, description, price: parsed, isActive };
  }

  return (
    // `flex-1 min-h-0`, not `h-full`.
    //
    // This sits in a flex column that already has a header above it, so
    // `h-full` asked for the panel's whole height *in addition to* that header
    // — the total overflowed and the button row fell out of the bottom of the
    // panel. `flex-1` claims what is left instead, and `min-h-0` is what lets
    // it shrink below its content so the scrolling happens inside.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <div className="flex flex-col gap-lg">
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
            maxLength={TEXT.name}
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
            maxLength={TEXT.description}
          />
        </div>

        <div className="flex w-full flex-col gap-lg">
          <Field label={t("menu.price")} hint={t("menu.priceHint")}>
            <NumberInput
              min={0}
              step={1}
              placeholder={t("menu.pricePlaceholder")}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
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

        {(shown || error) && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {shown ?? error}
          </p>
        )}
      </div>

      {/* Pinned, not scrolled with the fields. On a long form the operator
          should never have to scroll to find Save. */}
      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
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
      </div>
    </div>
  );
}
