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
import { BranchMenuPanel } from "./branch-menu-panel";
import { NoPinWarning } from "./no-pin-warning";
import {
  useArchiveBranch,
  useBranches,
  useCreateBranch,
  useUpdateBranch,
} from "./use-branches";
import { useStore } from "./use-stores";

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
  /**
   * The shop the branches belong to, for the two things on a row that are the
   * brand's rather than the place's.
   *
   * The **picture** is the shop's — a branch has none, and giving it one would
   * be inviting a merchant to photograph nine shopfronts to fill a 46pt square.
   * It is here so a branch row is recognisably the same object the shops list
   * shows, which is where the operator has just come from.
   *
   * The **category** is the shop's too, and it repeats down the column
   * unchanged. That is the point rather than an oversight: the meta line reads
   * the same on both screens, so nobody has to work out whether a branch can
   * belong to a different one. (It cannot — `category_id` is on `stores`.)
   *
   * Already cached by the tab strip above, so this costs nothing.
   */
  const store = useStore(storeId);
  const branches = useBranches(storeId);
  const create = useCreateBranch(storeId);
  const update = useUpdateBranch(storeId);
  const archive = useArchiveBranch(storeId);
  const guarded = useGuardedAction();

  /** The row being edited, `"new"` while one is being added, or nothing. */
  const [open, setOpen] = useState<string | null>(null);
  /**
   * The branch whose menu differences are being looked at.
   *
   * A separate panel from the editor rather than a tab inside it: the editor is
   * a form with a Save, and this is a list of switches that write as they are
   * flipped. Putting them behind one header would make the Save look as though
   * it governed both.
   */
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const rows = branches.data ?? [];
  const editing = rows.find((row) => row.id === open) ?? null;
  const showingMenu = rows.find((row) => row.id === menuFor) ?? null;

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
              imageUrl={store.data?.imageUrl ?? null}
              categoryName={store.data?.categoryName ?? ""}
              open={open === branch.id}
              onEdit={guarded(() => setOpen(branch.id))}
              onShowMenu={guarded(() => setMenuFor(branch.id))}
              onClose={async () => {
                await archive.mutateAsync({
                  id: branch.id,
                  name: pickLocalized(branch.name),
                  live: rows.length,
                });
              }}
              /**
               * Whether this row is the whole shop.
               *
               * A shop that has never been thought about as a chain has exactly
               * the one branch migration `0101` gave it, named after itself —
               * which is what the merchant sees here, and it reads as the store
               * rather than as a place the store trades from. Neither action on
               * the row means anything in that state:
               *
               * - **Close** was already impossible. A shop with no branches is
               *   listed, has a menu, and has nowhere for an order to arrive, so
               *   the button was rendered at 40% and swallowed its own clicks —
               *   a control whose only job was to look unavailable.
               * - **Menu here** offers to hide items and override prices *at
               *   this branch*, and there is nothing to differ from. Every
               *   override would apply everywhere the shop trades, which is what
               *   the Menu tab already edits.
               *
               * Both come back the moment a second branch exists, including on
               * this row: once there are two places, the first one is a place
               * like any other and its menu really can differ.
               *
               * `archiveBranch` still refuses the last branch on its own — a
               * stale list is the one case a hidden button does not cover.
               */
              soleBranch={rows.length === 1}
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

      <Panel
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        label={
          showingMenu
            ? t("branchMenu.title", { name: pickLocalized(showingMenu.name) })
            : t("branches.menuHere")
        }
      >
        {showingMenu && (
          <>
            <PanelHeader
              title={t("branchMenu.title", {
                name: pickLocalized(showingMenu.name),
              })}
              onClose={() => setMenuFor(null)}
            />
            {/* Not guarded by `useUnsavedChanges`: every switch here has already
                written by the time the panel is closed, so there is never
                anything unsaved to lose. */}
            <BranchMenuPanel branch={showingMenu} storeId={storeId} />
          </>
        )}
      </Panel>
    </div>
  );
}

function BranchRow({
  branch,
  imageUrl,
  categoryName,
  open,
  onEdit,
  onShowMenu,
  onClose,
  soleBranch,
}: {
  branch: Branch;
  /** The **shop's** picture — a branch has none. See the call site. */
  imageUrl: string | null;
  /** The shop's category, repeated down the column on purpose. */
  categoryName: string;
  open: boolean;
  onEdit: () => void;
  onShowMenu: () => void;
  onClose: () => Promise<void>;
  /** The shop's only branch — see the call site. Renders no actions. */
  soleBranch: boolean;
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
      {/* The same 46pt square the shops list draws, greyed the same way when
          the row is hidden — a branch row should read as the same kind of
          object as the shop row the operator arrived from. The placeholder is
          not optional: without it the rows of a shop that has no picture line
          up differently from every other list in the app. */}
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className={cx(
            "size-[46px] shrink-0 rounded-md object-cover",
            !branch.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <div
          aria-hidden
          className="size-[46px] shrink-0 rounded-md bg-neutral-fill"
        />
      )}

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col items-start gap-xxs text-left"
      >
        <span className="flex items-center gap-sm">
          <span className="truncate text-[15px] font-semibold">{name}</span>
          {/* Said in words, not only in colour — the same badge the shops list
              puts on a shop that is off the storefront. */}
          {!branch.isActive && (
            <span className="shrink-0 rounded-full bg-danger-wash px-sm text-[11px] font-bold text-danger">
              {t("branches.hidden")}
            </span>
          )}
        </span>

        {/* The shops list's meta line, with the half that is now the branch's.
            The category is the brand's and repeats; the prep window is this
            kitchen's, and since `0101` it is the only place it lives. */}
        <span className="truncate text-[12px] text-text-faint">
          {categoryName ? `${categoryName} · ` : ""}
          {t("catalogue.prep", {
            min: branch.prepMinMinutes,
            max: branch.prepMaxMinutes,
          })}
        </span>

        {/* An unpinned branch charges every order at the top distance band —
            and since `0109` the distance is measured from *here*, so this is
            the row where it actually bites. Same warning, same words as the
            shops list. */}
        {!pinned && <NoPinWarning />}
      </button>

      {/* Nothing on a one-branch shop — the row is the store, and both of these
          are answers to questions only a chain can ask. See the call site. */}
      {!soleBranch && (
        <>
          <Button variant="primary-quiet" size="sm" onClick={onShowMenu}>
            {t("branches.menuHere")}
          </Button>

          <ConfirmButton
            onConfirm={onClose}
            titleKey="branches.closeTitle"
            bodyKey="branches.closeBody"
            confirmKey="branches.closeConfirm"
            params={{ name }}
            variant="danger"
            triggerVariant="danger-quiet"
            size="sm"
          >
            {t("branches.closeConfirm")}
          </ConfirmButton>
        </>
      )}
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
