"use client";

import { useState } from "react";

import { Button, Input, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { t } from "@/i18n/translations";
import { formatDate } from "@/lib/time";

import type { Banner, BannerDraft } from "./api/promotions";
import {
  useArchiveBanner,
  useBanners,
  useCreateBanner,
  useReorderBanners,
  useUpdateBanner,
} from "./use-promotions";

/**
 * The cards on the app's home screen.
 *
 * ## Called banners, because that is what they are
 *
 * The rows live in `discounts`, and the table carries a whole discount engine's
 * vocabulary — `kind`, `value`, `min_subtotal`, redemption caps. **None of it
 * is read by anything.** `place_order` hardcodes `v_discount bigint := 0` with
 * the comment *no discount engine yet*, and no coupon column exists anywhere.
 *
 * So this screen manages what actually has an effect: a picture, the window it
 * appears in, and the order the cards come in. Putting a "20% off" field here
 * would offer a decision with no consequence, and the operator would find out
 * from a customer's bill that it never applied. The screen says so in a line,
 * once, rather than leaving it to be discovered.
 *
 * ## A banner is artwork
 *
 * The app's own reader is explicit: *the card is the artwork alone — any
 * wording belongs in the image.* There is no headline to write and nothing to
 * link to; `0013` dropped the text columns and `0053` dropped `link_value`. The
 * name here is the operator's own label, never seen by a customer, and it is
 * the only handle they have on a picture in a list.
 */
export function PromotionsList() {
  const banners = useBanners();
  const create = useCreateBanner();
  const update = useUpdateBanner();
  const archive = useArchiveBanner();
  const reorder = useReorderBanners();

  /** The row the panel is editing, or `"new"` while one is being added. */
  const [open, setOpen] = useState<string | null>(null);

  const rows = banners.data ?? [];
  const editing = rows.find((row) => row.id === open) ?? null;

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      // `priority` is the app's order and lower shows first, so a position in
      // this list is the priority — renumbered from zero so the stored order is
      // always the order on screen.
      const next = ids.flatMap((id, index) => {
        const row = rows.find((one) => one.id === id);
        return row ? [{ ...row, priority: index }] : [];
      });
      const updates = next.flatMap((row) => {
        const before = rows.find((one) => one.id === row.id);
        return before?.priority === row.priority
          ? []
          : [{ id: row.id, priority: row.priority }];
      });
      reorder.mutate({ updates, next });
    },
    labelOf: (id) => rows.find((row) => row.id === id)?.slug ?? "",
  });

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
          <h1 className="flex-grow text-[24px]">{t("promotions.tab")}</h1>
        </div>

        <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
          {/* Said once, at the top, rather than left to be discovered from a
              customer's bill. */}
          <p className="rounded-md border border-border bg-surface px-lg py-md text-[13px] text-text-soft">
            {t("promotions.artworkOnly")}
          </p>

          {banners.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1].map((row) => (
                <div
                  key={row}
                  className="h-[90px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}

          {banners.isError && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {banners.error instanceof Error
                ? banners.error.message
                : t("common.somethingWentWrong")}
            </p>
          )}

          {order.instructions}

          {order
            .ordered(rows, (row) => row.id)
            .map((row) => (
              <Row
                key={row.id}
                banner={row}
                open={open === row.id}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() => setOpen(row.id)}
                onToggleActive={() => {
                  setOpen(null);
                  update.mutate({
                    id: row.id,
                    patch: { isActive: !row.isActive },
                  });
                }}
                onArchive={async () => {
                  setOpen(null);
                  await archive.mutateAsync({ id: row.id, name: row.slug });
                }}
              />
            ))}
        </div>

        {banners.isSuccess && (
          <div className="flex shrink-0 items-center border-t border-border bg-surface p-lg">
            <Button fullWidth onClick={() => setOpen("new")}>
              {t("promotions.add")}
            </Button>
          </div>
        )}
      </div>

      <Panel
        open={open !== null}
        onClose={() => setOpen(null)}
        label={t("promotions.formLabel")}
      >
        {open && (
          <>
            <div className="flex shrink-0 items-start gap-md border-b border-border p-xxl">
              <h2 className="flex-grow text-[20px]">
                {editing ? editing.slug : t("promotions.add")}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(null)}
                aria-label={t("common.close")}
                className="hidden size-[30px] shrink-0 items-center justify-center rounded-full border border-border text-text-soft hover:bg-neutral-fill lg:flex"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <Editor
              key={open}
              initial={editing ?? undefined}
              pending={create.isPending || update.isPending}
              onSave={(draft) => {
                if (editing) {
                  update.mutate(
                    { id: editing.id, patch: draft, name: editing.slug },
                    { onSuccess: () => setOpen(null) },
                  );
                } else {
                  create.mutate(
                    { draft, priority: rows.length },
                    { onSuccess: () => setOpen(null) },
                  );
                }
              }}
              onCancel={() => setOpen(null)}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

type ReorderProps = {
  rowProps: (
    id: string,
    className?: string,
  ) => { "data-reorder-id": string; className: string };
  handleProps: (id: string) => Record<string, unknown>;
};

function Row({
  banner,
  open,
  rowProps,
  handleProps,
  onEdit,
  onToggleActive,
  onArchive,
}: {
  banner: Banner;
  open: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onArchive: () => Promise<void>;
} & ReorderProps) {
  const row = rowProps(
    banner.id,
    cx(
      "flex items-center gap-lg rounded-md border bg-surface px-lg py-md",
      !banner.isActive && "border-danger-wash bg-danger-wash/30",
      open &&
        "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]",
      banner.isActive && !open && "border-border",
      banner.isActive && open && "border-active",
    ),
  );

  return (
    <div {...row}>
      <button {...handleProps(banner.id)}>
        <GripIcon />
      </button>

      {/* Wide, because that is the shape it is on the home screen and the
          picture is the whole content — a thumbnail would show the middle of a
          card and tell nobody whether it reads. */}
      {banner.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.imageUrl}
          alt=""
          aria-hidden
          className={cx(
            "h-[64px] w-[128px] shrink-0 rounded-md object-cover",
            !banner.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <div
          aria-hidden
          className="flex h-[64px] w-[128px] shrink-0 items-center justify-center rounded-md bg-neutral-fill text-[11px] text-text-faint"
        >
          {t("promotions.noArtwork")}
        </div>
      )}

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col items-start gap-xxs text-left"
      >
        <span className="truncate text-[15px] font-semibold">
          {banner.slug}
        </span>
        <span className="truncate text-[12px] text-text-faint">
          {describeWindow(banner)}
        </span>
      </button>

      <ConfirmToggle
        on={banner.isActive}
        onChange={onToggleActive}
        labelOn={t("promotions.live")}
        labelOff={t("promotions.hidden")}
        params={{ name: banner.slug }}
        whenTurningOn={{
          titleKey: "promotions.showTitle",
          bodyKey: "promotions.showBody",
          confirmKey: "promotions.showConfirm",
        }}
        whenTurningOff={{
          titleKey: "promotions.hideTitle",
          bodyKey: "promotions.hideBody",
          confirmKey: "promotions.hideConfirm",
        }}
        className="w-[104px]"
      />

      <ConfirmButton
        onConfirm={onArchive}
        titleKey="promotions.archiveTitle"
        bodyKey="promotions.archiveBody"
        confirmKey="promotions.archiveConfirm"
        params={{ name: banner.slug }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("promotions.archive")}
      </ConfirmButton>
    </div>
  );
}

/**
 * The window, in words, and whether it is live *now*.
 *
 * The app shows a card only while it is switched on **and** inside its dates, so
 * a banner can be on and invisible. That is the state worth naming: an operator
 * looking at a switch reading "Live" on a promotion that ended last week has no
 * other way to find out.
 */
function describeWindow(banner: Banner): string {
  const now = Date.now();
  const started =
    !banner.startsAt || new Date(banner.startsAt).getTime() <= now;
  const ended = Boolean(
    banner.endsAt && new Date(banner.endsAt).getTime() < now,
  );

  if (banner.isActive && ended) return t("promotions.ended");
  if (banner.isActive && !started) {
    return t("promotions.startsOn", { when: formatDate(banner.startsAt!) });
  }

  if (!banner.startsAt && !banner.endsAt) return t("promotions.always");
  if (banner.startsAt && banner.endsAt) {
    return t("promotions.between", {
      from: formatDate(banner.startsAt),
      to: formatDate(banner.endsAt),
    });
  }
  if (banner.endsAt) {
    return t("promotions.until", { to: formatDate(banner.endsAt) });
  }
  return t("promotions.from", { from: formatDate(banner.startsAt!) });
}

function Editor({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial?: Banner;
  pending: boolean;
  onSave: (draft: BannerDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.slug ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [startsAt, setStartsAt] = useState<string | null>(
    initial?.startsAt ?? null,
  );
  const [endsAt, setEndsAt] = useState<string | null>(initial?.endsAt ?? null);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [errors, setErrors] = useState<{ name?: string; window?: string }>({});

  function submit() {
    const found = {
      name: name.trim() === "" ? t("promotions.nameRequired") : undefined,
      // The database refuses this too (`discounts_window_ordered`, 0066), and
      // it refuses it by constraint name. Caught here so it reads as a form.
      window:
        startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)
          ? t("promotions.windowBackwards")
          : undefined,
    };

    setErrors(found);
    if (found.name || found.window) return;

    onSave({ name: name.trim(), imageUrl, startsAt, endsAt, isActive });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <Field
          label={t("promotions.name")}
          hint={t("promotions.nameHint")}
          error={errors.name}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ramadan-2026"
            disabled={Boolean(initial)}
          />
        </Field>

        <Field label={t("images.label")} hint={t("promotions.imageHint")}>
          <ImageUploader
            value={imageUrl}
            onChange={setImageUrl}
            folder="categories"
            disabled={pending}
          />
        </Field>

        <Field
          label={t("promotions.startsAt")}
          hint={t("promotions.startsHint")}
        >
          <DateField value={startsAt} onChange={setStartsAt} />
        </Field>

        <Field
          label={t("promotions.endsAt")}
          hint={t("promotions.endsHint")}
          error={errors.window}
        >
          <DateField value={endsAt} onChange={setEndsAt} />
        </Field>

        <Field
          label={t("promotions.visibility")}
          hint={t("promotions.visibilityHint")}
        >
          {/* A plain switch, not a confirming one.
              The switch in the *row* confirms, because flipping it there
              publishes or withdraws a card straight away. In here nothing has
              happened yet — the form is a draft until Save — and asking "are
              you sure" about a value that is not yet written is the empty
              question `ConfirmButton` warns about. */}
          <Toggle
            on={isActive}
            onChange={() => setIsActive((current) => !current)}
            labelOn={t("promotions.live")}
            labelOff={t("promotions.hidden")}
          />
        </Field>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={pending}>
          {t("promotions.save")}
        </Button>
      </div>
    </div>
  );
}
