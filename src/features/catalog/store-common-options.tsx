"use client";

import { useState } from "react";

import { Button, cx } from "@/components/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { ROW_STATIC } from "@/components/ui/row";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { StoreQuestion } from "./api/options";
import { useMenu } from "./use-menu";
import { useSetQuestionItems, useStoreQuestions } from "./use-options";

/**
 * One question, asked on as many items as you like.
 *
 * ## Why this tab exists at all
 *
 * The Options tab is per item: pick a section, pick an item, set up what *it*
 * asks. That is the right shape for a question only one dish asks, and the
 * wrong one for "Choose a size", which is identical across twenty pizzas.
 * Before `0094` there was no other shape available — a group had one owner, so
 * twenty pizzas meant twenty questions typed by hand and twenty edits to
 * reprice, with no way afterwards to tell whether all twenty had been changed.
 *
 * This is the other half. The same question row, offered wherever it applies.
 *
 * ## Where you are is the question, not the item
 *
 * The Options tab starts from an item and shows its questions; this starts from
 * a question and shows its items. Same rows underneath, opposite direction —
 * and that is the whole reason it is a separate tab rather than a control on
 * the existing one. A picker for "which items ask this" makes no sense on a
 * screen whose first two fields are "which item".
 *
 * ## Editing is editing everywhere, and the hint says so
 *
 * Renaming a question here, or repricing one of its choices, changes it on
 * every item asking it. That is the point of the feature and it is also its one
 * sharp edge, so it is said in the hint rather than discovered. Taking a
 * question off *some* items is a different act with its own control — see the
 * picker — and is not the same as withdrawing it, which removes it from all.
 */
export function StoreCommonOptions({ storeId }: { storeId: string }) {
  const questions = useStoreQuestions(storeId);
  const menu = useMenu(storeId);
  const setItems = useSetQuestionItems(storeId);

  /** Which question's picker is open. One at a time — it is a whole menu. */
  const [picking, setPicking] = useState<string | null>(null);

  if (questions.isError) {
    return (
      <EmptyState
        mood="lost"
        titleKey="commonOptions.failedTitle"
        bodyKey="commonOptions.hint"
      />
    );
  }

  if (questions.isSuccess && questions.data.length === 0) {
    return (
      <EmptyState
        mood="waiting"
        titleKey="commonOptions.emptyTitle"
        bodyKey="commonOptions.emptyBody"
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-lg overflow-y-auto p-xxl">
      <p className="max-w-[620px] text-[13px] text-text-soft">
        {t("commonOptions.hint")}
      </p>

      <div className="flex flex-col gap-sm">
        {questions.data?.map((question) =>
          picking === question.id ? (
            <ItemPicker
              key={question.id}
              question={question}
              sections={menu.data ?? []}
              pending={setItems.isPending}
              onCancel={() => setPicking(null)}
              onSave={(itemIds) =>
                setItems.mutate(
                  {
                    groupId: question.id,
                    itemIds,
                    current: question.itemIds,
                    // Every item gets it in the same slot. The alternative is
                    // asking somebody to place one question twenty times.
                    sortOrder: 0,
                    name: question.title,
                  },
                  { onSuccess: () => setPicking(null) },
                )
              }
            />
          ) : (
            <div
              key={question.id}
              className={cx(
                ROW_STATIC,
                // A question withdrawn from the whole shop is marked rather
                // than hidden: "why is Choose a size on nothing" needs an
                // answer on the page that would otherwise be silent about it.
                !question.isActive && "border-danger-wash bg-danger-wash/30",
              )}
            >
              <span className="flex min-w-0 flex-grow flex-col gap-xxs">
                <span className="truncate text-[15px] font-semibold">
                  {pickLocalized(question.title)}
                </span>
                <span className="truncate text-[12px] text-text-faint">
                  {[
                    t(
                      question.mode === "single"
                        ? "options.chooseOne"
                        : "options.chooseAny",
                    ),
                    question.choiceCount === 0
                      ? t("commonOptions.noChoices")
                      : t("commonOptions.choices", {
                          count: question.choiceCount,
                        }),
                    question.itemIds.length === 0
                      ? t("commonOptions.usedOnNone")
                      : question.itemIds.length === 1
                        ? t("commonOptions.usedOnOne")
                        : t("commonOptions.usedOn", {
                            count: question.itemIds.length,
                          }),
                  ].join(" · ")}
                </span>
              </span>

              {!question.isActive && (
                <span
                  title={t("commonOptions.withdrawnHint")}
                  className="shrink-0 rounded-sm bg-danger-wash px-sm py-[1px] text-[11px] font-semibold text-text"
                >
                  {t("commonOptions.withdrawnMark")}
                </span>
              )}

              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => setPicking(question.id)}
              >
                {t("commonOptions.manage")}
              </Button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * Which items ask this question.
 *
 * ## A whole section, or the items in it, or both
 *
 * The section's own box ticks and unticks every live item under it, and shows
 * a third state when only some are on — which is the state a menu is usually
 * in, and drawing it as "off" would invite an operator to tick it and silently
 * add the eleven they had deliberately left out.
 *
 * ## Save means "this is the answer"
 *
 * The picker hands back the whole list it wants and the diff is worked out in
 * `setQuestionItems`. That is what makes unticking a box do something visible:
 * a Save that only applied additions would leave the operator wondering what
 * the tick did.
 *
 * ## Only live items are listed
 *
 * `useMenu` filters archived ones out, so there is nothing here to disable: an
 * item that has been put away is not offered, and a link to it would be one
 * nothing reads. Restoring the item from the Archive tab brings it back into
 * this list, and its links come back with it — they were never removed.
 */
function ItemPicker({
  question,
  sections,
  pending,
  onSave,
  onCancel,
}: {
  question: StoreQuestion;
  sections: {
    id: string;
    title: Record<string, string>;
    items: { id: string; name: Record<string, string> }[];
  }[];
  pending: boolean;
  onSave: (itemIds: string[]) => void;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(question.itemIds),
  );

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const everyId = sections.flatMap((section) =>
    section.items.map((item) => item.id),
  );

  return (
    <div className="flex flex-col gap-lg rounded-md border border-active bg-surface p-lg">
      <div className="flex flex-col gap-xxs">
        <h3 className="text-[15px] font-semibold">
          {t("commonOptions.pickTitle", {
            name: pickLocalized(question.title),
          })}
        </h3>
        <p className="text-[13px] text-text-soft">
          {t("commonOptions.pickHint")}
        </p>
      </div>

      <div className="flex flex-wrap gap-sm">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMany(everyId, true)}
        >
          {t("commonOptions.pickAll")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setChosen(new Set())}
        >
          {t("commonOptions.pickNone")}
        </Button>
      </div>

      <div className="flex max-h-[420px] flex-col gap-lg overflow-y-auto rounded-md border border-border p-lg">
        {sections.map((section) => {
          const ids = section.items.map((item) => item.id);
          const on = ids.filter((id) => chosen.has(id)).length;
          const all = ids.length > 0 && on === ids.length;

          return (
            <div key={section.id} className="flex flex-col gap-xs">
              <label className="flex items-center gap-sm text-[14px] font-semibold">
                <input
                  type="checkbox"
                  checked={all}
                  // The third state: some but not all. Drawn rather than
                  // rounded down to "off", which would invite a tick that
                  // silently adds the ones left out on purpose.
                  ref={(box) => {
                    if (box) box.indeterminate = on > 0 && !all;
                  }}
                  onChange={() => setMany(ids, !all)}
                  className="size-[16px] accent-[var(--color-active)]"
                />
                {pickLocalized(section.title)}
                <span className="text-[12px] font-normal text-text-faint">
                  {on}/{ids.length}
                </span>
              </label>

              <div className="flex flex-col gap-xxs ps-xl">
                {section.items.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-sm text-[14px]"
                  >
                    <input
                      type="checkbox"
                      checked={chosen.has(item.id)}
                      onChange={() => toggle(item.id)}
                      className="size-[16px] accent-[var(--color-active)]"
                    />
                    {pickLocalized(item.name)}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        <span className="min-w-0 flex-grow text-[13px] text-text-faint">
          {chosen.size === 0
            ? t("commonOptions.pickedNone")
            : t("commonOptions.picked", { count: chosen.size })}
        </span>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button pending={pending} onClick={() => onSave([...chosen])}>
          {t("commonOptions.save")}
        </Button>
      </div>
    </div>
  );
}
