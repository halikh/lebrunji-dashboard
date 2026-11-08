"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { useState } from "react";

import {
  EmptyState,
  Page,
  PageHeader,
  RecordSkeleton,
  buttonClass,
} from "@/components/ui";
import { useGuardedAction } from "@/components/unsaved-changes";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import { canHoldProducts, sectionPath } from "../api/menu";
import {
  useArchiveMenuItem,
  useCreateMenuItem,
  useMenu,
  useUpdateMenuItem,
} from "../use-menu";
import { useStore } from "../use-stores";
import { DishEditor } from "./dish-editor";
import {
  duplicateDishHref,
  menuHref,
  newDishHref,
  nextSortOrder,
} from "./shared";

/**
 * One dish's page — adding or editing.
 *
 * ## Not losing your place in the menu
 *
 * Back, Cancel and Save all return to the Menu tab with `?focus=<id>`, and the
 * tab scrolls that row back into view and marks it. A new dish's section comes
 * from `?section=` — the section whose Add was pressed — in the URL so a reload
 * or a pasted link still lands in the right part of the menu. It is only where
 * the form opens: the section is a field, so the dish can be filed elsewhere.
 */
export function DishScreen({
  storeId,
  itemId,
}: {
  storeId: string;
  itemId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const guarded = useGuardedAction();

  const menu = useMenu(storeId);
  const store = useStore(storeId);
  const sections = menu.data ?? [];
  const layout = store.data?.menuLayout ?? "list";

  const create = useCreateMenuItem(storeId);
  const update = useUpdateMenuItem(storeId);
  const archive = useArchiveMenuItem(storeId);

  /**
   * How many dishes have been added on this visit — the editor's key on a new
   * dish, so "save and add another" gets a blank form and a *failed* save does
   * not (it counts saves, not attempts: losing a form to its own error message
   * is the worst version of a validation failure).
   */
  const [added, setAdded] = useState(0);

  const everyItem = sections.flatMap((one) => one.items);
  /**
   * Duplicating: a new dish opened with `?from=` starts as a copy of that one —
   * the fields only. Its options and branch prices are rows of their own that
   * the copy does not have until it exists, and the page says so. It starts
   * hidden, the way a duplicated product starts as a draft: two identical
   * dishes on the customer's menu, even for a minute, is the worse mistake.
   */
  // Only the first form: "save and add another" after a copy opens blank.
  const source =
    itemId || added > 0
      ? undefined
      : everyItem.find((one) => one.id === params.get("from"));
  const initial = itemId
    ? everyItem.find((one) => one.id === itemId)
    : source
      ? {
          name: source.name,
          description: source.description,
          price: source.price,
          isActive: false,
          imageUrl: source.imageUrl,
          priceUnit: source.priceUnit,
          unitQuantity: source.unitQuantity,
          unitStep: source.unitStep,
          sizeQuantity: source.sizeQuantity,
          sizeUnit: source.sizeUnit,
          tagIds: source.tagIds,
        }
      : undefined;

  const firstHolder = sections.find((one) =>
    canHoldProducts(one, sections, layout),
  );
  const requested = params.get("section");
  const sectionId = itemId
    ? (sections.find((one) => one.items.some((item) => item.id === itemId))
        ?.id ?? "")
    : sections.some((one) => one.id === requested)
      ? (requested as string)
      : (firstHolder?.id ?? "");

  const sectionById = (id: string) => sections.find((one) => one.id === id);
  const backHref = itemId ? menuHref(storeId, itemId) : menuHref(storeId);
  const leave = () => router.replace(backHref);

  const pending = create.isPending || update.isPending;
  const error =
    create.error instanceof Error
      ? create.error.message
      : update.error instanceof Error
        ? update.error.message
        : null;

  if (menu.isPending) {
    return (
      <Page>
        <RecordSkeleton />
      </Page>
    );
  }

  // A cold arrival whose id is not in the menu that landed is a dish that is
  // not there any more (archived, or another shop's).
  if ((itemId && !initial) || (!itemId && !sectionId)) {
    return (
      <Page>
        <PageHeader title={itemId ? t("menu.formLabel") : t("menu.newItem")} />
        <div className="rounded-lg border border-line bg-surface shadow-xs">
          <EmptyState
            icon={<SearchX />}
            title={
              itemId
                ? t("menu.itemNotFound")
                : menu.isError
                  ? t("menu.failedTitle")
                  : t("menu.addSectionFirst")
            }
            action={
              <Link
                href={menuHref(storeId)}
                className={buttonClass({ variant: "secondary" })}
              >
                {t("menu.title")}
              </Link>
            }
          />
        </div>
      </Page>
    );
  }

  return (
    <DishEditor
      // Keyed, so arriving at a second dish rebuilds the form instead of
      // keeping the previous one's text, and "add another" clears it.
      key={itemId ?? `new-${sectionId}-${source?.id ?? ""}-${added}`}
      storeId={storeId}
      store={store.data}
      itemId={itemId}
      sectionId={sectionId}
      initial={initial}
      duplicateOf={source ? pickLocalized(source.name) : undefined}
      // Only where a dish may go (0196) — never a section with sub-aisles, and
      // on an aisles shop never directly on an aisle — named "Dairy › Milk".
      // The section it sits in now stays listed even if it no longer
      // qualifies: a dish placed before the rule keeps its place.
      sections={sections
        .filter(
          (one) =>
            one.id === sectionId || canHoldProducts(one, sections, layout),
        )
        .map((one) => ({ id: one.id, title: sectionPath(one, sections) }))}
      pending={pending}
      error={error}
      onCancel={() => leave()}
      onSave={(draft) => {
        if (itemId) {
          const { sectionId: target, ...fields } = draft;
          update.mutate(
            {
              id: itemId,
              // Only a move carries the section and a new position — sent on
              // every save, the position would undo wherever it was dragged.
              patch:
                target !== sectionId
                  ? {
                      ...fields,
                      sectionId: target,
                      sortOrder: nextSortOrder(sectionById(target)),
                    }
                  : fields,
            },
            { onSuccess: () => leave() },
          );
        } else {
          create.mutate(
            {
              draft: { ...draft, storeId },
              sortOrder: nextSortOrder(sectionById(draft.sectionId)),
            },
            { onSuccess: () => leave() },
          );
        }
      }}
      onSaveAndAnother={
        itemId
          ? undefined
          : (draft) =>
              create.mutate(
                {
                  draft: { ...draft, storeId },
                  sortOrder: nextSortOrder(sectionById(draft.sectionId)),
                },
                {
                  onSuccess: () => {
                    // The next blank form opens in the section this one was
                    // filed under — the operator is working down that one.
                    if (draft.sectionId !== sectionId) {
                      router.replace(newDishHref(storeId, draft.sectionId));
                    }
                    setAdded((count) => count + 1);
                  },
                },
              )
      }
      onDuplicate={
        itemId
          ? guarded(() =>
              router.push(duplicateDishHref(storeId, sectionId, itemId)),
            )
          : undefined
      }
      onArchive={
        itemId && initial
          ? async () => {
              await archive.mutateAsync({ id: itemId, name: initial.name });
              router.replace(menuHref(storeId));
            }
          : undefined
      }
    />
  );
}
