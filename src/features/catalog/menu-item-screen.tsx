"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EditorPage } from "@/components/ui/editor-page";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { MenuSection } from "./api/menu";
import { MenuItemEditor } from "./menu-item-editor";
import { useCreateMenuItem, useMenu, useUpdateMenuItem } from "./use-menu";

/**
 * One dish, on a page of its own.
 *
 * ## What the panel was protecting, and how it is kept
 *
 * The editor opened beside the menu, and `menu-item-editor.tsx` records why:
 * the flow study asked for editing *within the row*, a dish carries two
 * languages of name and description, a price, a picture and its tags, and
 * growing a row to hold that reflows every row beneath it. The panel kept what
 * mattered about the inline idea — **not losing your place in a menu two
 * hundred dishes long** — and dropped what did not.
 *
 * A page gives that up unless it is told to keep it, so it is told: Back and
 * Cancel both return `?focus=<id>`, and the menu scrolls that row into view.
 * See `useRowFocus`.
 *
 * ## Which section a new dish joins
 *
 * From `?section=`, because a new dish has no row to read it off. It is the
 * section whose Add button was pressed, and it is in the URL rather than in
 * state so that a reload or a pasted link still lands in the right part of the
 * menu instead of at the top of it.
 */
export function MenuItemScreen({
  storeId,
  itemId,
}: {
  storeId: string;
  itemId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const menu = useMenu(storeId);
  const sections = menu.data ?? [];

  const create = useCreateMenuItem(storeId);
  const update = useUpdateMenuItem(storeId);

  /**
   * How many dishes have been added on this visit.
   *
   * The editor's `key` on a new item, so "save and add another" gets a blank
   * form — and a *failed* save does not. It counts **saves**, not submissions:
   * it used to be `create.submittedAt`, which changes on every attempt, so a
   * refused insert remounted the editor and threw away everything the operator
   * had typed at the exact moment they needed to read the error and correct one
   * field. Losing a form to its own error message is the worst version of a
   * validation failure.
   */
  const [added, setAdded] = useState(0);

  const initial = itemId
    ? sections.flatMap((one) => one.items).find((one) => one.id === itemId)
    : undefined;

  // The row's own section when editing; the one whose Add was pressed when not.
  const sectionId = itemId
    ? (sections.find((one) => one.items.some((item) => item.id === itemId))
        ?.id ?? "")
    : (params.get("section") ?? "");

  const section = sections.find((one) => one.id === sectionId);

  const menuHref = `/catalogue/${storeId}`;
  const backHref = itemId ? `${menuHref}?focus=${itemId}` : menuHref;
  const leave = () => router.replace(backHref);

  const pending = create.isPending || update.isPending;
  const error =
    create.error instanceof Error
      ? create.error.message
      : update.error instanceof Error
        ? update.error.message
        : null;

  // A cold arrival — a pasted link, a refresh — has no menu yet, and an id that
  // is not in the one that lands is a dish that is not there any more.
  if ((itemId && !initial) || (!itemId && !section)) {
    return (
      <EditorPage
        title={itemId ? t("menu.formLabel") : t("menu.newItem")}
        backHref={menuHref}
        backLabel={t("menu.title")}
      >
        {menu.isPending ? (
          <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
        ) : (
          <p className="text-[14px] text-text-soft">{t("menu.itemNotFound")}</p>
        )}
      </EditorPage>
    );
  }

  return (
    <MenuItemEditor
      // Keyed, so arriving at a second dish rebuilds the form rather than
      // leaving the previous one's text in the fields — the state lives inside
      // the editor, and React would otherwise reuse it. The counter on a new
      // item is what makes "add another" clear the form.
      key={itemId ?? `new-${sectionId}-${added}`}
      storeId={storeId}
      itemId={itemId}
      sectionId={sectionId}
      initial={initial}
      // The overline says where in the menu this lands. The title below cannot
      // — "Falafel" says nothing about which section it is in.
      overline={pickLocalized(section?.title ?? {})}
      imageUrl={initial?.imageUrl ?? null}
      title={initial ? pickLocalized(initial.name) : t("menu.newItem")}
      backHref={backHref}
      backLabel={t("menu.title")}
      pending={pending}
      error={error}
      onSave={(draft) => {
        if (itemId) {
          update.mutate({ id: itemId, patch: draft }, { onSuccess: leave });
        } else {
          create.mutate(
            {
              draft: { ...draft, storeId, sectionId },
              sortOrder: nextSortOrder(section),
            },
            { onSuccess: leave },
          );
        }
      }}
      onSaveAndAnother={
        // Only while adding. "Add another" means nothing when editing something
        // that already exists.
        itemId
          ? undefined
          : (draft) =>
              create.mutate(
                {
                  draft: { ...draft, storeId, sectionId },
                  // At the end of the section it was added to. The column has
                  // no default, and "where does it go" is a question the caller
                  // can answer and the database cannot.
                  sortOrder: nextSortOrder(section),
                },
                // The blank form is the reward for a save that landed.
                { onSuccess: () => setAdded((count) => count + 1) },
              )
      }
      onCancel={leave}
    />
  );
}

/** The end of the section a dish is being added to. */
function nextSortOrder(section: MenuSection | undefined): number {
  if (!section) return 0;
  return (
    section.items.reduce(
      (highest, item) => Math.max(highest, item.sortOrder),
      0,
    ) + 1
  );
}
