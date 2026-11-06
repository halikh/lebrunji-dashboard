"use client";

import { useState } from "react";

import { Button, Checkbox, SearchInput, Sheet } from "@/components/ui";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { StoreQuestion } from "../api/options";

type PickerSection = {
  id: string;
  title: Record<string, string>;
  items: { id: string; name: Record<string, string> }[];
};

/**
 * Which dishes ask a question, from a panel on the right.
 *
 * A section's own box ticks and unticks every dish under it, and shows a third
 * state when only some are on — the state a menu is usually in, and drawing it
 * as "off" would invite a tick that silently adds the ones left out on purpose.
 *
 * Save hands back the whole list and `setQuestionItems` works out the diff, so
 * unticking does something visible. Only live dishes are listed (`useMenu`
 * leaves archived ones out); restoring a dish brings its links back.
 */
export function ItemPickerSheet({
  question,
  sections,
  pending,
  onClose,
  onSave,
}: {
  /** The question being assigned, or null when the panel is shut. */
  question: StoreQuestion | null;
  sections: PickerSection[];
  pending: boolean;
  onClose: () => void;
  onSave: (itemIds: string[]) => void;
}) {
  const guarded = useGuardedAction();
  const close = guarded(onClose);
  return (
    <Sheet
      open={question !== null}
      onOpenChange={(open) => !open && close()}
      title={
        question
          ? t("commonOptions.pickTitle", {
              name: pickLocalized(question.title),
            })
          : ""
      }
      description={t("commonOptions.pickHint")}
      width="md"
    >
      {question && (
        <Picker
          key={question.id}
          question={question}
          sections={sections}
          pending={pending}
          onCancel={close}
          onSave={onSave}
        />
      )}
    </Sheet>
  );
}

function Picker({
  question,
  sections,
  pending,
  onCancel,
  onSave,
}: {
  question: StoreQuestion;
  sections: PickerSection[];
  pending: boolean;
  onCancel: () => void;
  onSave: (itemIds: string[]) => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(question.itemIds),
  );
  const [search, setSearch] = useState("");

  // Sorted, because a set is not an order and `changed` compares arrays as
  // ordered.
  const dirty = changed([...chosen].sort(), [...question.itemIds].sort());
  useUnsavedChanges(dirty);

  function setMany(ids: string[], on: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  const term = search.trim().toLowerCase();
  const visible = sections
    .map((section) => ({
      ...section,
      items: term
        ? section.items.filter((item) =>
            Object.values(item.name).some((name) =>
              name.toLowerCase().includes(term),
            ),
          )
        : section.items,
    }))
    .filter((section) => section.items.length > 0);
  const everyId = sections.flatMap((section) =>
    section.items.map((item) => item.id),
  );

  return (
    // The sheet's body scrolls; the footer here sticks to its bottom edge so
    // Save is always in reach on a long menu.
    <div className="-mx-6 -my-5 flex min-h-full flex-col">
      <div className="flex flex-col gap-3 border-b border-line px-6 py-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("commonOptions.pickSearch")}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMany(everyId, true)}
          >
            {t("commonOptions.pickAll")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChosen(new Set())}
          >
            {t("commonOptions.pickNone")}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-6 py-4">
        {visible.map((section) => {
          const ids = section.items.map((item) => item.id);
          const on = ids.filter((id) => chosen.has(id)).length;
          const all = ids.length > 0 && on === ids.length;
          return (
            <fieldset key={section.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Checkbox
                  checked={all ? true : on > 0 ? "indeterminate" : false}
                  onCheckedChange={() => setMany(ids, !all)}
                  label={pickLocalized(section.title)}
                />
                <span className="text-[12px] text-ink-3 tabular-nums">
                  {on}
                  {"/"}
                  {ids.length}
                </span>
              </div>
              <div className="flex flex-col gap-2 ps-6">
                {section.items.map((item) => (
                  <Checkbox
                    key={item.id}
                    checked={chosen.has(item.id)}
                    onCheckedChange={(next) => setMany([item.id], next)}
                    label={
                      <span className="font-normal">
                        {pickLocalized(item.name)}
                      </span>
                    }
                  />
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-line bg-subtle px-6 py-3.5">
        <span className="min-w-0 flex-1 text-[12.5px] text-ink-3">
          {chosen.size === 0
            ? t("commonOptions.pickedNone")
            : t("commonOptions.picked", { count: chosen.size })}
        </span>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          pending={pending}
          disabled={!dirty}
          onClick={() => onSave([...chosen])}
        >
          {t("commonOptions.save")}
        </Button>
      </div>
    </div>
  );
}
