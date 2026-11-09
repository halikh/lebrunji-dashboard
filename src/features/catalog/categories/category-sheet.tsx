"use client";

import { SearchX } from "lucide-react";
import { useState } from "react";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Sheet,
  Skeleton,
  Switch,
} from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { Select } from "@/components/ui/select";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { ARTWORK_SHAPES } from "@/lib/image-shape";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { Category, CategoryDraft } from "../api/categories";
import {
  useCategories,
  useCategoryKinds,
  useCreateCategory,
  useUpdateCategory,
} from "../use-categories";

/**
 * One category, in a sheet over the list.
 *
 * `editing` is the URL's `?edit=` — an id, `"new"`, or null for closed. The
 * row is read from the list's own cache (the vocabulary is one short query), so
 * opening one is instant; a cold link waits for it and says so if the category
 * has gone.
 */
export function CategorySheet({
  editing,
  sortOrder,
  onClose,
}: {
  editing: string | null;
  /** Where a new one goes — the end of the order. */
  sortOrder: number;
  onClose: () => void;
}) {
  const guarded = useGuardedAction();
  const categories = useCategories("");
  const rows = categories.data ?? [];
  const isNew = editing === "new";
  const initial =
    editing && !isNew ? (rows.find((row) => row.id === editing) ?? null) : null;

  const title = initial
    ? pickLocalized(initial.name)
    : isNew
      ? t("categories.add")
      : t("categories.edit");

  return (
    <Sheet
      open={editing !== null}
      onOpenChange={(open) => !open && guarded(onClose)()}
      title={title}
      description={
        initial
          ? initial.usedBy === 0
            ? t("categories.unused")
            : t("categories.usedBy", { count: initial.usedBy })
          : t("categories.newHint")
      }
    >
      {editing === null ? null : isNew || initial ? (
        <Form
          key={initial?.id ?? "new"}
          initial={initial}
          sortOrder={sortOrder}
          onDone={onClose}
          onCancel={guarded(onClose)}
        />
      ) : categories.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <EmptyState
          icon={<SearchX />}
          title={t("categories.notFound")}
          action={
            <Button onClick={onClose}>{t("categories.backToList")}</Button>
          }
        />
      )}
    </Sheet>
  );
}

function Form({
  initial,
  sortOrder,
  onDone,
  onCancel,
}: {
  initial: Category | null;
  sortOrder: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const kinds = useCategoryKinds();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const pending = create.isPending || update.isPending;

  const start = {
    name: initial?.name ?? ({} as Localized),
    kindId: initial?.kindId ?? "",
    isActive: initial?.isActive ?? true,
    hasMenuNav: initial?.hasMenuNav ?? true,
    iconUrl: initial?.iconUrl ?? null,
  };

  const [name, setName] = useState<Localized>(start.name);
  const [kindId, setKindId] = useState(start.kindId);
  const [isActive, setIsActive] = useState(start.isActive);
  const [hasMenuNav, setHasMenuNav] = useState(start.hasMenuNav);
  // Required — `categories_icon_required`. Null only for a new category or a
  // legacy row from before the constraint, which cannot be saved until it has
  // one.
  const [iconUrl, setIconUrl] = useState<string | null>(start.iconUrl);
  const [confirmingHide, setConfirmingHide] = useState(false);

  const dirty = changed({ name, kindId, isActive, hasMenuNav, iconUrl }, start);
  useUnsavedChanges(dirty);

  // Seeded for a legacy row without an icon: the constraint refuses *every*
  // update to it, so say so on opening rather than on Save.
  const [errors, setErrors] = useState<{
    name?: string;
    kind?: string;
    icon?: string;
  }>(() =>
    initial && !hasIcon(initial.iconUrl)
      ? { icon: t("categories.iconRequired") }
      : {},
  );

  function submit() {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      // `category_kind_id` is not null with no default — caught here so it
      // reads as a form rather than a refusal from Postgres.
      kind: kindId ? undefined : t("categories.kindRequired"),
      icon: hasIcon(iconUrl) ? undefined : t("categories.iconRequired"),
    };
    setErrors(found);
    if (found.name || found.kind || found.icon) return;

    // Hiding takes shops with it and empties baskets (`0266`), so Save asks
    // first, as the switch on the list does.
    if (initial?.isActive && !isActive && initial.hidesShops > 0) {
      setConfirmingHide(true);
      return;
    }
    save();
  }

  function save() {
    const draft: CategoryDraft = {
      name,
      kindId,
      isActive,
      hasMenuNav,
      iconUrl,
    };
    if (initial) {
      update.mutate(
        { id: initial.id, patch: draft, name: draft.name },
        { onSuccess: onDone },
      );
    } else {
      create.mutate({ draft, sortOrder }, { onSuccess: onDone });
    }
  }

  return (
    <form
      className="flex min-h-full flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <LocalizedField
        label={t("categories.name")}
        value={name}
        onChange={setName}
        maxLength={TEXT.name}
        error={errors.name}
        filter="title"
        placeholder={{ en: "Restaurants", ar: "مطاعم" }}
      />

      <Field
        label={t("categories.kind")}
        hint={t("categories.kindHint")}
        error={errors.kind}
      >
        {(wiring) => (
          <Select
            {...wiring}
            value={kindId}
            onChange={setKindId}
            placeholder={t("categories.pickKind")}
            options={(kinds.data ?? []).map((kind) => ({
              value: kind.id,
              label: pickLocalized(kind.name),
            }))}
            disabled={pending || !kinds.isSuccess}
          />
        )}
      </Field>

      <Field
        label={t("categories.icon")}
        hint={t("categories.iconHint")}
        error={errors.icon}
        required
      >
        <ImageUploader
          value={iconUrl}
          onChange={(url) => {
            setIconUrl(url);
            if (hasIcon(url)) {
              setErrors((current) => ({ ...current, icon: undefined }));
            }
          }}
          folder="category-art"
          shape={ARTWORK_SHAPES.categoryIcon}
          cutout
          prompt={{ kind: "category", subject: name.en ?? "" }}
          disabled={pending}
        />
      </Field>

      <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          label={t("categories.visibility")}
          description={
            isActive ? t("categories.liveHint") : t("categories.hiddenHint")
          }
          disabled={pending}
        />
        <div className="h-px bg-line" />
        <Switch
          checked={hasMenuNav}
          onCheckedChange={setHasMenuNav}
          label={t("categories.menuNav")}
          description={t("categories.menuNavHint")}
          disabled={pending}
        />
      </div>

      {initial ? (
        <ConfirmDialog
          open={confirmingHide}
          onOpenChange={setConfirmingHide}
          title={t("categories.hideTitle", {
            name: pickLocalized(initial.name),
          })}
          description={t("categories.hideBodyShops", {
            count: initial.hidesShops,
          })}
          confirmLabel={t("categories.hideConfirm")}
          tone="primary"
          onConfirm={save}
        />
      ) : null}

      <div className="sticky -bottom-5 -mx-6 -mb-5 mt-auto flex items-center justify-end gap-2 border-t border-line bg-subtle px-6 py-3.5">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          disabled={!dirty}
        >
          {initial ? t("categories.save") : t("categories.create")}
        </Button>
      </div>
    </form>
  );
}

/** Whether a URL counts as an icon — blank does not, as the constraint trims. */
function hasIcon(url: string | null | undefined): boolean {
  return Boolean(url && url.trim() !== "");
}
