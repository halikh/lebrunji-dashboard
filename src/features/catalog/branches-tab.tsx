"use client";

import { useState } from "react";

import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { Button, Field, Input, cx } from "@/components/ui";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Select } from "@/components/ui/select";
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
import type { CurrencyChangeMode, Store } from "./api/stores";
import { BranchMenuPanel } from "./branch-menu-panel";
import { NoPinWarning } from "./no-pin-warning";
import { ShopFields, useSaveShop } from "./shop-fields";
import {
  useArchiveBranch,
  useBranches,
  useCreateBranch,
  useUpdateBranch,
} from "./use-branches";
import { useMoney } from "@/features/reference/use-currencies";

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
 * First the pin, the prep window, the WhatsApp number and the opening hours —
 * all four answer "where and when and how does an order reach a kitchen", and
 * all four are wrong the moment a shop has two addresses.
 *
 * Then the rest of it. What Details had left was three fields — the shop's
 * name, its picture and its currency — on a tab of their own, next to a tab
 * carrying everything else about the same shop. Nothing in either label said
 * which one held the field you wanted.
 *
 * They are in the **panel** now rather than in a card above the list, which was
 * the intermediate answer and kept the same split one level down. Opening a
 * branch opens everything about the shop at that branch, read from the brand
 * downward: what it is called, what it prices in, then what is true of this
 * place. One panel, one Save — see `shop-fields.tsx` for why it is one and not
 * two.
 *
 * ## And a branch may now differ on two of them
 *
 * `0110` gave `branches` an `image_url` and a `currency_code`, both nullable,
 * both meaning "the shop's" when absent. Not a copy — a live reference, so a
 * shop that changes either still moves every branch that has not set its own.
 * Every read here is therefore `branch ?? store`, and the money path in the
 * database resolves the same `coalesce` on the side that charges.
 */
export function BranchesTab({ storeId }: { storeId: string }) {
  /**
   * The shop the branches belong to — for the panel, which edits it, and for
   * the two things on a row that fall back to it.
   *
   * The **picture** is the branch's where it has set one and the shop's
   * otherwise. It used to be the shop's full stop, on the reasoning that giving
   * a branch its own would invite a merchant to photograph nine shopfronts to
   * fill a 46pt square — which was right about the effort and wrong about who
   * gets to decide. `0110` made it optional instead, so the default is still
   * one photograph for the chain and a branch that wants its own may have it.
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
              imageUrl={branch.imageUrl ?? store.data?.imageUrl ?? null}
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
              store={store.data ?? null}
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
  /** This branch's picture, already resolved against the shop's by the caller. */
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
        <PreviewImage
          src={imageUrl}
          name={name}
          className={cx(
            "size-[46px] rounded-md",
            !branch.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <ImagePlaceholder className="size-[46px] rounded-md" />
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
  store,
  pending,
  onSave,
  onCancel,
}: {
  initial: Branch | null;
  /**
   * The shop this branch belongs to, or null while it is still loading.
   *
   * The panel edits it — see `ShopFields` — and the branch's own picture and
   * currency are shown against it, because both fall back to it. Null only
   * happens on the first paint, and the section simply is not drawn until the
   * row arrives rather than rendering empty fields somebody could type into.
   */
  store: Store | null;
  pending: boolean;
  onSave: (draft: BranchDraft) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const shop = useSaveShop();
  const { currencies } = useMoney();

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
  /**
   * This branch's own picture and currency — null for "the shop's".
   *
   * Null rather than the shop's values copied in, on both. A form that
   * pre-filled them would save a copy the moment anything else on the panel
   * changed, quietly turning a branch that follows the brand into one that no
   * longer does. See the note on `Branch`.
   */
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [currencyCode, setCurrencyCode] = useState<string | null>(
    initial?.currencyCode ?? null,
  );

  /** The shop's own answers, edited in the same panel and saved first. */
  const [shopName, setShopName] = useState<Localized>(store?.name ?? {});
  const [shopCurrency, setShopCurrency] = useState(store?.currencyCode ?? "");
  /**
   * What a currency change is *for*, defaulted to the common case.
   *
   * `keep` is the wrong-pick fix and is what almost every change will be.
   * `convert` is a shop genuinely re-denominating, which happens once if ever —
   * so it is the deliberate choice rather than the one you land on.
   */
  const [mode, setMode] = useState<CurrencyChangeMode>("keep");

  const [errors, setErrors] = useState<{
    name?: string;
    shopName?: string;
    prep?: string;
    whatsapp?: string;
    pin?: string;
  }>({});

  // `mode` is left out on purpose: it is a question *about* a currency change
  // rather than a value of its own, and it cannot be reached without moving
  // `shopCurrency` first — which is compared.
  useUnsavedChanges(
    changed(
      {
        name,
        whatsapp,
        prepMin,
        prepMax,
        isActive,
        pin,
        imageUrl,
        currencyCode,
        shopName,
        shopCurrency,
      },
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
        imageUrl: initial?.imageUrl ?? null,
        currencyCode: initial?.currencyCode ?? null,
        shopName: store?.name ?? {},
        shopCurrency: store?.currencyCode ?? "",
      },
    ),
  );

  const located = parseLocation(pin);
  const coordinates = located.ok ? located : null;

  async function save() {
    const min = Number(prepMin);
    const max = Number(prepMax);

    const nameCheck = validateLocalizedText(name, codes, TEXT.name);
    const prepCheck = validatePrepWindow(min, max);
    const phoneCheck = validatePhone(digitsOf(whatsapp));
    // Only when the shop is loaded. Nothing can have been typed into a section
    // that was not drawn, so an absent store is not an empty name.
    const shopNameCheck = store
      ? validateLocalizedText(shopName, codes, TEXT.name)
      : null;

    const found = {
      name: nameCheck.ok ? undefined : t(nameCheck.key, nameCheck.params),
      shopName:
        !shopNameCheck || shopNameCheck.ok
          ? undefined
          : t(shopNameCheck.key, shopNameCheck.params),
      prep: prepCheck.ok ? undefined : t(prepCheck.key, prepCheck.params),
      /*
       * Required now, where it used to be optional.
       *
       * The old reasoning was that a branch is often added before anybody has
       * been given its number, and that is true — but what it bought was a
       * branch that is *listed and takes orders* with nowhere for an order to
       * go. The order is placed, the customer is told the kitchen has it, and
       * nothing arrives at a kitchen. Asked for at creation, the cost is one
       * phone call before the branch goes live; left optional, the cost is an
       * order.
       */
      whatsapp:
        whatsapp.trim() === ""
          ? t("branches.whatsappRequired")
          : phoneCheck.ok
            ? undefined
            : t(phoneCheck.key, phoneCheck.params),
      /*
       * Required too, and for money rather than for tidiness.
       *
       * `delivery_fee_for_km` charges an unknown distance at the **top band**,
       * so an unpinned branch does not fail to quote — it quotes the most
       * expensive answer there is, on every order, silently. That is the
       * failure `no-pin-warning.tsx` exists to shout about after the fact; this
       * is the same fact asked before it can happen.
       */
      pin: located.ok
        ? undefined
        : located.reason === "empty"
          ? t("branches.pinRequired")
          : located.reason === "shortened"
            ? t("store.pinShortened")
            : t("store.pinInvalid"),
    };

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    /*
     * The shop first, and only what moved.
     *
     * Its currency rewrites every price in the shop and has to be atomic on its
     * own, so it cannot be folded into the branch's write — see `useSaveShop`.
     * Going first means a failure stops before the branch is touched: the
     * reverse order would leave a branch saved against a shop whose prices did
     * not move, which is a screen and a database disagreeing about money.
     */
    if (store && !(await shop.saveShop(store, {
      name: shopName,
      currencyCode: shopCurrency,
      mode,
    }))) {
      return;
    }

    // The pin and the number are checked above, so their fallbacks are
    // unreachable — they are here because the columns are still nullable in the
    // database and the types say so. See `requireTradeable` in the branch API
    // for where that is enforced on every path.
    onSave({
      name,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      prepMinMinutes: min,
      prepMaxMinutes: max,
      whatsappPhone: whatsapp.trim(),
      imageUrl,
      currencyCode,
      isActive,
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        {/* The brand first, then this place. Anything typed here changes the
            shop and every branch of it, which is why the section says so. */}
        {store && (
          <>
            <ShopFields
              store={store}
              name={shopName}
              onName={setShopName}
              nameError={errors.shopName}
              currencyCode={shopCurrency}
              onCurrencyCode={setShopCurrency}
              mode={mode}
              onMode={setMode}
            />

            <hr className="border-border" />

            <div className="flex flex-col gap-xxs">
              <h3 className="ps-md text-[17px]">
                {t("branches.branchSection")}
              </h3>
              <p className="ps-md text-[12px] text-text-faint">
                {t("branches.branchSectionHint")}
              </p>
            </div>
          </>
        )}

        <LocalizedField
          label={t("branches.name")}
          hint={t("branches.nameHint")}
          value={name}
          onChange={setName}
          placeholder={{ en: t("branches.namePlaceholder"), ar: "الحمرا" }}
          error={errors.name}
          maxLength={TEXT.name}
        />

        {/*
          This branch's own picture, or the shop's.

          The uploader is handed the resolved value, so the box is never empty
          while the shop has a photograph — what an operator sees is what a
          customer sees. Clearing it puts the branch back to following the shop
          rather than to showing nothing, which is what `Remove` means here and
          what the hint says.
        */}
        <Field
          label={t("images.label")}
          hint={
            imageUrl
              ? t("branches.imageOwnHint")
              : t("branches.imageSharedHint")
          }
        >
          <ImageUploader
            value={imageUrl ?? store?.imageUrl ?? null}
            onChange={setImageUrl}
            folder="stores"
            disabled={pending}
          />
        </Field>

        {/*
          And its currency, which is the same idea and is money.

          The empty option is not a blank — it is "the same as the shop", named
          with the shop's code in it so the consequence of leaving it alone is
          on screen. `0110` resolves `coalesce(branch, store)` on the side that
          quotes *and* the side that charges, so a value picked here is what the
          customer pays in.
        */}
        <Field
          label={t("branches.currency")}
          hint={t("branches.currencyHint")}
        >
          <Select
            value={currencyCode ?? ""}
            onChange={(next) => setCurrencyCode(next || null)}
            options={[
              {
                value: "",
                label: t("branches.currencySame", {
                  code: shopCurrency || store?.currencyCode || "",
                }),
              },
              ...(currencies ?? []).map((one) => ({
                value: one.code,
                label: one.code,
              })),
            ]}
          />
        </Field>

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
        <Button type="submit" pending={pending || shop.pending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
