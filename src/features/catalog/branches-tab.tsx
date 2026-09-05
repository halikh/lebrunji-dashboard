"use client";

import { useState } from "react";

import { Button, Field, Input, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { LocalizedField } from "@/components/ui/localized-field";
import { Map } from "@/components/ui/map";
import { NumberInput } from "@/components/ui/number-input";
import { Panel } from "@/components/ui/panel";
import { PanelHeader } from "@/components/ui/panel-header";
import { PhoneInput } from "@/components/ui/phone-input";
import { ROW } from "@/components/ui/row";
import { Toggle } from "@/components/ui/toggle";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { parseLocation } from "@/lib/location";
import { digitsOf } from "@/lib/phone";
import {
  validateLocalizedText,
  validatePhone,
  validatePrepWindow,
  type Localized,
} from "@/lib/validation";

import type { Branch, BranchDraft } from "./api/branches";
import {
  useArchiveBranch,
  useBranches,
  useCreateBranch,
  useUpdateBranch,
} from "./use-branches";

/**
 * The places one shop trades from.
 *
 * ## Why this is a tab and not a field on Details
 *
 * Because the shop that has one branch and the shop that has nine are the same
 * screen. Migration `0101` gave every existing shop a branch, so this list is
 * never empty and never has a "turn on branches" step — a chain is a shop with
 * more rows here, not a shop in a different mode.
 *
 * ## What moved off Details to get here
 *
 * The pin, the prep window, the WhatsApp number and the opening hours. All four
 * answer "where and when and how does an order reach a kitchen", and all four
 * are wrong the moment a shop has two addresses. The Details tab keeps what is
 * true of the brand: the name, the picture, the category, the currency.
 */
export function BranchesTab({ storeId }: { storeId: string }) {
  const branches = useBranches(storeId);
  const create = useCreateBranch(storeId);
  const update = useUpdateBranch(storeId);
  const archive = useArchiveBranch(storeId);
  const guarded = useGuardedAction();

  /** The row being edited, `"new"` while one is being added, or nothing. */
  const [open, setOpen] = useState<string | null>(null);

  const rows = branches.data ?? [];
  const editing = rows.find((row) => row.id === open) ?? null;

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
          <h2 className="flex-grow text-[18px]">{t("branches.tab")}</h2>
          <Button onClick={guarded(() => setOpen("new"))}>
            {t("branches.add")}
          </Button>
        </div>

        <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
          {/* Says why the tab exists on a shop with one branch, which is the
              first question it gets. */}
          <p className="ps-md text-[13px] text-text-faint">
            {t("branches.intro")}
          </p>

          {branches.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="h-[64px] rounded-md bg-neutral-fill"
                />
              ))}
            </div>
          )}

          {rows.map((branch) => (
            <BranchRow
              key={branch.id}
              branch={branch}
              open={open === branch.id}
              onEdit={guarded(() => setOpen(branch.id))}
              onClose={async () => {
                await archive.mutateAsync({
                  id: branch.id,
                  name: pickLocalized(branch.name),
                  live: rows.length,
                });
              }}
              // The last one cannot go: a shop with no branches is listed, has
              // a menu, and has nowhere for an order to arrive. Disabled here
              // and refused again in the mutation, because a stale list is the
              // one case a disabled button does not cover.
              canClose={rows.length > 1}
            />
          ))}
        </div>
      </div>

      <Panel
        open={open !== null}
        onClose={guarded(() => setOpen(null))}
        label={editing ? t("branches.edit") : t("branches.add")}
      >
        {open !== null && (
          <>
            <PanelHeader
              title={editing ? pickLocalized(editing.name) : t("branches.add")}
              onClose={guarded(() => setOpen(null))}
            />

            <BranchEditor
              // Keyed on the row, so switching between two branches starts from
              // the one that was clicked rather than resuming the other's
              // half-typed pin.
              key={open}
              initial={editing}
              pending={create.isPending || update.isPending}
              onCancel={guarded(() => setOpen(null))}
              onSave={(draft) => {
                if (editing) {
                  update.mutate(
                    {
                      id: editing.id,
                      patch: draft,
                      name: pickLocalized(draft.name),
                    },
                    { onSuccess: () => setOpen(null) },
                  );
                } else {
                  create.mutate(
                    { draft, sortOrder: rows.length },
                    { onSuccess: () => setOpen(null) },
                  );
                }
              }}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

function BranchRow({
  branch,
  open,
  onEdit,
  onClose,
  canClose,
}: {
  branch: Branch;
  open: boolean;
  onEdit: () => void;
  onClose: () => Promise<void>;
  canClose: boolean;
}) {
  const name = pickLocalized(branch.name);
  const pinned = branch.latitude !== null && branch.longitude !== null;

  return (
    <div
      className={cx(
        ROW,
        !branch.isActive && "border-danger-wash bg-danger-wash/30",
        open &&
          "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]",
        branch.isActive && !open && "border-border",
        branch.isActive && open && "border-active",
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col items-start gap-xxs text-left"
      >
        <span className="text-[15px] font-semibold">{name}</span>
        <span className="flex items-center gap-sm text-[13px] text-text-faint">
          {/* An unpinned branch charges every order at the top distance band,
              so it is called out rather than left as an empty space. */}
          {!pinned && (
            <span className="font-medium text-danger">
              {t("branches.unpinned")}
            </span>
          )}
          {!branch.isActive && <span>{t("branches.hidden")}</span>}
        </span>
      </button>

      <ConfirmButton
        onConfirm={onClose}
        titleKey="branches.closeTitle"
        bodyKey="branches.closeBody"
        confirmKey="branches.closeConfirm"
        params={{ name }}
        variant="danger"
        triggerVariant="danger-quiet"
        size="sm"
        className={cx(!canClose && "pointer-events-none opacity-40")}
      >
        {t("branches.closeConfirm")}
      </ConfirmButton>
    </div>
  );
}

function BranchEditor({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: Branch | null;
  pending: boolean;
  onSave: (draft: BranchDraft) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const [name, setName] = useState<Localized>(initial?.name ?? {});
  const [whatsapp, setWhatsapp] = useState(initial?.whatsappPhone ?? "");
  const [prepMin, setPrepMin] = useState(String(initial?.prepMinMinutes ?? 10));
  const [prepMax, setPrepMax] = useState(String(initial?.prepMaxMinutes ?? 20));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [pin, setPin] = useState(
    initial && initial.latitude !== null && initial.longitude !== null
      ? `${initial.latitude}, ${initial.longitude}`
      : "",
  );

  const [errors, setErrors] = useState<{
    name?: string;
    prep?: string;
    whatsapp?: string;
    pin?: string;
  }>({});

  useUnsavedChanges(
    changed(
      { name, whatsapp, prepMin, prepMax, isActive, pin },
      {
        name: initial?.name ?? {},
        whatsapp: initial?.whatsappPhone ?? "",
        prepMin: String(initial?.prepMinMinutes ?? 10),
        prepMax: String(initial?.prepMaxMinutes ?? 20),
        isActive: initial?.isActive ?? true,
        pin:
          initial && initial.latitude !== null && initial.longitude !== null
            ? `${initial.latitude}, ${initial.longitude}`
            : "",
      },
    ),
  );

  const located = parseLocation(pin);
  const coordinates = located.ok ? located : null;

  function save() {
    const min = Number(prepMin);
    const max = Number(prepMax);

    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const prepCheck = validatePrepWindow(min, max);
    const phoneCheck = validatePhone(digitsOf(whatsapp));

    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      prep: prepCheck.ok ? undefined : t(prepCheck.key, prepCheck.params),
      // Optional, like the shop's. A branch is often added before anybody has
      // been given its number.
      whatsapp:
        whatsapp.trim() === "" || phoneCheck.ok
          ? undefined
          : t(phoneCheck.key, phoneCheck.params),
      // An empty box is "no pin", which is legitimate and flagged on the row.
      // Text that is not a location is not: saving null for it would look
      // exactly like success while leaving the branch unpinned.
      pin: located.ok
        ? undefined
        : located.reason === "empty"
          ? undefined
          : located.reason === "shortened"
            ? t("store.pinShortened")
            : t("store.pinInvalid"),
    };

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    onSave({
      name,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      prepMinMinutes: min,
      prepMaxMinutes: max,
      whatsappPhone: whatsapp.trim() || null,
      isActive,
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <LocalizedField
          label={t("branches.name")}
          hint={t("branches.nameHint")}
          value={name}
          onChange={setName}
          placeholder={{ en: t("branches.namePlaceholder"), ar: "الحمرا" }}
          error={errors.name}
          maxLength={TEXT.name}
        />

        <Field
          label={t("branches.pin")}
          hint={t("branches.pinHint")}
          error={errors.pin}
        >
          <Input
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="33.8938, 35.5018"
            inputMode="text"
          />
        </Field>

        <Map
          latitude={coordinates?.latitude ?? null}
          longitude={coordinates?.longitude ?? null}
          label={pickLocalized(name)}
          emptyKey="store.noPinYet"
          className="h-[200px] w-full rounded-md"
        />

        <Field
          label={t("branches.prep")}
          hint={t("branches.prepHint")}
          error={errors.prep}
        >
          <div className="flex items-center gap-md">
            <span className="flex-1">
              <NumberInput
                min={0}
                step={1}
                value={prepMin}
                onChange={(event) => setPrepMin(event.target.value)}
                aria-label={t("store.prepMin")}
              />
            </span>
            <span className="shrink-0 text-[13px] text-text-soft">
              {t("store.prepTo")}
            </span>
            <span className="flex-1">
              <NumberInput
                min={0}
                step={1}
                value={prepMax}
                onChange={(event) => setPrepMax(event.target.value)}
                aria-label={t("store.prepMax")}
              />
            </span>
            <span className="shrink-0 text-[13px] text-text-soft">
              {t("store.minutes")}
            </span>
          </div>
        </Field>

        <Field
          label={t("branches.whatsapp")}
          hint={t("branches.whatsappHint")}
          error={errors.whatsapp}
        >
          <PhoneInput
            value={whatsapp}
            onChange={setWhatsapp}
            placeholder={t("store.whatsappPlaceholder")}
          />
        </Field>

        <Field
          label={t("branches.visibility")}
          hint={isActive ? t("branches.liveHint") : t("branches.hiddenHint")}
        >
          <Toggle
            on={isActive}
            onChange={() => setIsActive((current) => !current)}
            labelOn={t("branches.live")}
            labelOff={t("branches.hidden")}
          />
        </Field>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" pending={pending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
