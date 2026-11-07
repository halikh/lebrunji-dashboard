"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  ConfirmDialog,
  Field,
  NativeSelect,
  Page,
  PageHeader,
  Section,
  Switch,
  cx,
} from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { LocalizedField } from "@/components/ui/localized-field";
import { PhoneInput } from "@/components/ui/phone-input";
import { useToasts } from "@/components/ui/toast";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { useMoney } from "@/features/reference/use-currencies";
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

import type { Branch, BranchDraft, BranchPatch } from "../api/branches";
import { saveBranchHours } from "../api/hours";
import type { Store } from "../api/stores";
import { useBranches, useCreateBranch, useUpdateBranch } from "../use-branches";
import { useStore } from "../use-stores";

import { BranchLiveToggle } from "./branch-status";
import {
  PinField,
  PrepWindowField,
  SaveBar,
  pinProblem,
  revealFirstError,
} from "./form-bits";
import {
  WeekEditor,
  checkWeek,
  draftWeek,
  weekToHours,
  type WeekDraft,
} from "./hours";
import { hoursKeys } from "./use-hours";

/**
 * Adding a branch to a shop, and the form behind a branch's Details tab.
 *
 * ## One record, and only one
 *
 * The shop's own answers — its name, picture, category, currency — are on the
 * shop's Details tab. A form whose every control writes to a branch's row
 * cannot also hold the shop's with only a subheading between them: what
 * happened was an operator changed "the shop's" picture and got one branch's.
 * The shop is still *read* here, for the two fields that fall back to it
 * (picture and currency, both a live reference since `0110`).
 *
 * The rest of an existing branch — its menu and its hours — are tabs of its
 * own page (`branch-screen.tsx`), each saving its own way: the menu as each
 * switch and price is made, the week and this form with a Save.
 */
export function NewBranchScreen({ storeId }: { storeId: string }) {
  const store = useStore(storeId);
  const branches = useBranches(storeId);
  const rows = branches.data ?? [];

  const shopName = store.data ? pickLocalized(store.data.name) : "";

  return (
    <Page width="narrow">
      <PageHeader
        title={t("branches.add")}
        description={
          shopName ? t("branches.addDescription", { shop: shopName }) : null
        }
      />
      <BranchForm
        storeId={storeId}
        store={store.data ?? null}
        initial={null}
        sortOrder={rows.length}
      />
    </Page>
  );
}

/** An existing branch's Details tab. */
export function BranchDetailsForm({
  storeId,
  store,
  branch,
}: {
  storeId: string;
  store: Store | null;
  branch: Branch;
}) {
  // Keyed on the row as read, so a refetch that changed it rebuilds the form
  // rather than leaving edits on top of newer data. Not on `isActive`: that is
  // written by its own switch (here and in the page header), and flipping it
  // must not throw away a half-edited address.
  return (
    <BranchForm
      key={JSON.stringify({ ...branch, isActive: null })}
      storeId={storeId}
      store={store}
      initial={branch}
      sortOrder={branch.sortOrder}
    />
  );
}

type Errors = Partial<
  Record<"name" | "address" | "pin" | "whatsapp" | "prep" | "hours", string>
>;

function pinOf(branch: Branch | null): string {
  return branch && branch.latitude !== null && branch.longitude !== null
    ? `${branch.latitude}, ${branch.longitude}`
    : "";
}

function BranchForm({
  storeId,
  store,
  initial,
  sortOrder,
}: {
  storeId: string;
  /** The shop, read for the two fields that fall back to it. Null while loading. */
  store: Store | null;
  initial: Branch | null;
  sortOrder: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToasts();
  const guarded = useGuardedAction();
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const { currencies } = useMoney();
  const create = useCreateBranch(storeId);
  const update = useUpdateBranch(storeId);
  const listHref = `/shops/${storeId}?tab=branches`;

  const start = {
    name: initial?.name ?? ({} as Localized),
    address: initial?.address ?? ({} as Localized),
    whatsapp: initial?.whatsappPhone ?? "",
    prepMin: String(initial?.prepMinMinutes ?? store?.prepMinMinutes ?? 10),
    prepMax: String(initial?.prepMaxMinutes ?? store?.prepMaxMinutes ?? 20),
    // A new branch's trading state is part of the form; an existing one's is
    // its own switch, written straight away (`BranchLiveToggle`), so it is
    // never carried — stale — by a Save of something else.
    isActive: initial ? null : true,
    pin: pinOf(initial),
    // Null rather than the shop's values copied in: a copy would quietly turn
    // a branch that follows the brand into one that no longer does (`0110`).
    imageUrl: initial?.imageUrl ?? null,
    currencyCode: initial?.currencyCode ?? null,
  };

  const [name, setName] = useState<Localized>(start.name);
  const [address, setAddress] = useState<Localized>(start.address);
  const [whatsapp, setWhatsapp] = useState(start.whatsapp);
  const [prepMin, setPrepMin] = useState(start.prepMin);
  const [prepMax, setPrepMax] = useState(start.prepMax);
  const [isActive, setIsActive] = useState(start.isActive ?? true);
  const [pin, setPin] = useState(start.pin);
  const [imageUrl, setImageUrl] = useState<string | null>(start.imageUrl);
  const [currencyCode, setCurrencyCode] = useState<string | null>(
    start.currencyCode,
  );
  const [week, setWeek] = useState<WeekDraft>(() => draftWeek());
  const [errors, setErrors] = useState<Errors>({});
  const [confirmingCurrency, setConfirmingCurrency] = useState(false);

  const values = {
    name,
    address,
    whatsapp,
    prepMin,
    prepMax,
    isActive: initial ? null : isActive,
    pin,
    imageUrl,
    currencyCode,
  };
  const dirty =
    changed(values, start) || (!initial && weekToHours(week).length > 0);
  useUnsavedChanges(dirty);

  const located = parseLocation(pin);
  const currencyMoved = initial !== null && currencyCode !== start.currencyCode;
  const pending = create.isPending || update.isPending;

  function check(): boolean {
    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    // Required since 0198: the app prints it under every shop's name.
    const addressCheck = validateLocalizedText(address, codes, TEXT.address);
    const prepCheck = validatePrepWindow(Number(prepMin), Number(prepMax));
    const phoneCheck = validatePhone(digitsOf(whatsapp));

    const found: Errors = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      address: addressCheck.ok
        ? undefined
        : t(addressCheck.key, addressCheck.params),
      prep: prepCheck.ok ? undefined : t(prepCheck.key, prepCheck.params),
      // Required: a branch is listed and takes orders the moment it exists,
      // and with no number an order placed here reaches no kitchen.
      whatsapp:
        whatsapp.trim() === ""
          ? t("branches.whatsappRequired")
          : phoneCheck.ok
            ? undefined
            : t(phoneCheck.key, phoneCheck.params),
      // Required, for money: an unpinned branch quotes the top band, silently.
      pin: pinProblem(located, { required: true }),
      // A new branch is asked for its week, because no week at all is open
      // around the clock — the same rule as a new shop.
      hours: initial ? undefined : (checkWeek(week) ?? undefined),
    };
    setErrors(found);
    const ok = !Object.values(found).some(Boolean);
    if (!ok) revealFirstError();
    return ok;
  }

  function requestSave() {
    if (!check()) return;
    // A currency change rewrites every price at this branch (`0229`), so it is
    // said before it happens.
    if (currencyMoved) setConfirmingCurrency(true);
    else save();
  }

  function draft(): BranchDraft {
    return {
      name,
      address,
      latitude: located.ok ? located.latitude : null,
      longitude: located.ok ? located.longitude : null,
      prepMinMinutes: Number(prepMin),
      prepMaxMinutes: Number(prepMax),
      whatsappPhone: whatsapp.trim(),
      imageUrl,
      currencyCode,
      isActive: initial ? initial.isActive : isActive,
    };
  }

  function save() {
    const next = draft();

    if (!initial) {
      create.mutate(
        { draft: next, sortOrder },
        {
          onSuccess: async (id) => {
            // The branch exists; its week is a second write. A failure there
            // sends the operator to the Hours tab rather than inviting a
            // second branch.
            try {
              await saveBranchHours(id, weekToHours(week));
              void queryClient.invalidateQueries({ queryKey: hoursKeys.all });
              router.replace(`/shops/${storeId}/branches/${id}`);
            } catch {
              toast.danger(t("branches.hoursNotSaved"));
              router.replace(`/shops/${storeId}/branches/${id}?tab=hours`);
            }
          },
        },
      );
      return;
    }

    // Only what moved. The currency in particular: an unchanged one would
    // still call the converting RPC.
    const patch: BranchPatch = {};
    for (const key of Object.keys(next) as (keyof BranchDraft)[]) {
      const before: Record<keyof BranchDraft, unknown> = {
        name: initial.name,
        address: initial.address,
        latitude: initial.latitude,
        longitude: initial.longitude,
        prepMinMinutes: initial.prepMinMinutes,
        prepMaxMinutes: initial.prepMaxMinutes,
        whatsappPhone: initial.whatsappPhone,
        imageUrl: initial.imageUrl,
        currencyCode: initial.currencyCode,
        isActive: initial.isActive,
      };
      if (changed(next[key], before[key])) {
        (patch as Record<string, unknown>)[key] = next[key];
      }
    }
    // Both halves of the pin travel together, or neither.
    if ("latitude" in patch || "longitude" in patch) {
      patch.latitude = next.latitude;
      patch.longitude = next.longitude;
    }
    if (Object.keys(patch).length === 0) return;

    update.mutate({ id: initial.id, patch, name: pickLocalized(next.name) });
  }

  function discard() {
    setName(start.name);
    setAddress(start.address);
    setWhatsapp(start.whatsapp);
    setPrepMin(start.prepMin);
    setPrepMax(start.prepMax);
    setIsActive(start.isActive ?? true);
    setPin(start.pin);
    setImageUrl(start.imageUrl);
    setCurrencyCode(start.currencyCode);
    setErrors({});
  }

  const shopCode = store?.currencyCode ?? "";
  const nextCode = currencyCode ?? shopCode;

  return (
    <div className="flex flex-col gap-5">
      {/* Two columns on wide screens, packed top to bottom so sections of
          different heights leave no holes. One column on phones. */}
      <div className="gap-5 xl:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
        <Section title={t("branches.identitySection")}>
          <div className="flex flex-col gap-5">
            <LocalizedField
              label={t("branches.name")}
              hint={t("branches.nameHint")}
              value={name}
              onChange={setName}
              placeholder={{
                en: t("branches.namePlaceholder"),
                ar: t("branches.namePlaceholderAr"),
              }}
              error={errors.name}
              maxLength={TEXT.name}
            />
            <LocalizedField
              label={t("branches.address")}
              hint={t("branches.addressHint")}
              value={address}
              onChange={setAddress}
              placeholder={{
                en: t("branches.addressPlaceholder"),
                ar: t("branches.addressPlaceholderAr"),
              }}
              error={errors.address}
              maxLength={TEXT.address}
            />
            {/* Not the opening hours: whether the branch trades at all. The
              timetable decides whether it is open right now. */}
            {initial ? (
              <div
                className={cx(
                  "flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                  initial.isActive
                    ? "border-line"
                    : "border-warning/30 bg-warning-soft/50",
                )}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[13.5px] font-medium text-ink">
                    {t("branches.visibility")}
                  </p>
                  <p className="text-[12.5px] text-ink-3">
                    {initial.isActive
                      ? t("branches.liveHint")
                      : t("branches.hiddenHint")}
                  </p>
                </div>
                <BranchLiveToggle storeId={storeId} branch={initial} />
              </div>
            ) : (
              <div
                className={cx(
                  "rounded-md border px-4 py-3",
                  isActive
                    ? "border-line"
                    : "border-warning/30 bg-warning-soft/50",
                )}
              >
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  label={t("branches.visibility")}
                  description={
                    isActive ? t("branches.liveHint") : t("branches.hiddenHint")
                  }
                />
              </div>
            )}
          </div>
        </Section>

        <Section
          title={t("store.placeSection")}
          description={t("branches.placeHint")}
          bodyClassName="@container"
        >
          <div className="flex flex-col gap-5">
            <PinField
              value={pin}
              onChange={setPin}
              located={located}
              error={errors.pin}
              label={t("branches.pin")}
              hint={t("branches.pinHint")}
              mapLabel={pickLocalized(name) || t("branches.name")}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label={t("branches.whatsapp")}
                hint={t("branches.whatsappHint")}
                error={errors.whatsapp}
              >
                {(wiring) => (
                  <PhoneInput
                    {...wiring}
                    value={whatsapp}
                    onChange={setWhatsapp}
                    placeholder={t("store.whatsappPlaceholder")}
                  />
                )}
              </Field>
              <PrepWindowField
                min={prepMin}
                max={prepMax}
                onMin={setPrepMin}
                onMax={setPrepMax}
                error={errors.prep}
                label={t("branches.prep")}
                hint={t("branches.prepHint")}
              />
            </div>
          </div>
        </Section>

        <Section
          title={t("branches.differsSection")}
          description={t("branches.differsHint")}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* The empty option is "the same as the shop", named with the
              shop's code so leaving it alone shows its consequence. A value
              here is charged as well as quoted (`0110`). A new branch always
              starts on the shop's and converts after (`0229`). */}
            <Field
              label={t("branches.currency")}
              hint={t("branches.currencyHint")}
            >
              {(wiring) => (
                <NativeSelect
                  {...wiring}
                  value={currencyCode ?? ""}
                  onChange={(event) =>
                    setCurrencyCode(event.target.value || null)
                  }
                >
                  <option value="">
                    {t("branches.currencySame", { code: shopCode })}
                  </option>
                  {(currencies ?? [])
                    .filter((one) => one.code !== shopCode)
                    .map((one) => (
                      <option key={one.code} value={one.code}>
                        {one.code}
                      </option>
                    ))}
                </NativeSelect>
              )}
            </Field>
            {/* Handed the resolved picture, so the box is never empty while the
              shop has one. Removing it goes back to the shop's, not to none. */}
            <Field
              label={t("images.label")}
              hint={
                imageUrl
                  ? t("branches.imageOwnHint")
                  : t("branches.imageSharedHint")
              }
              optional={t("form.optional")}
            >
              <ImageUploader
                value={imageUrl ?? store?.imageUrl ?? null}
                onChange={(url) =>
                  setImageUrl(url === store?.imageUrl ? null : url)
                }
                folder="stores"
                photo="shop"
                // Showing the shop's own photo: its framing is the shop's.
                reframe={imageUrl != null}
                disabled={pending}
              />
            </Field>
          </div>
        </Section>

        {!initial && (
          <Section
            title={t("branches.hoursTitle")}
            description={t("branches.hoursNew")}
          >
            <WeekEditor
              week={week}
              onChange={(next) => {
                setWeek(next);
                setErrors((current) => ({ ...current, hours: undefined }));
              }}
              error={errors.hours}
            />
          </Section>
        )}
      </div>
      <SaveBar status={initial && dirty ? t("hours.unsavedShort") : undefined}>
        {initial ? (
          <Button
            variant="ghost"
            onClick={discard}
            disabled={!dirty || pending}
          >
            {t("store.discard")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={guarded(() => router.push(listHref))}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={requestSave}
          pending={pending}
          disabled={initial !== null && !dirty}
        >
          {initial ? t("common.save") : t("branches.create")}
        </Button>
      </SaveBar>

      <ConfirmDialog
        open={confirmingCurrency}
        onOpenChange={setConfirmingCurrency}
        title={t("branches.currencyConfirmTitle", { code: nextCode })}
        description={
          currencyCode === null
            ? t("branches.currencyBackBody", { code: shopCode })
            : t("branches.currencyConfirmBody", { code: nextCode })
        }
        confirmLabel={t("branches.currencyConfirm")}
        onConfirm={save}
      />
    </div>
  );
}
