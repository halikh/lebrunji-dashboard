"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { EditorPage } from "@/components/ui/editor-page";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmptyState } from "@/components/ui/empty-state";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import type { DayHours } from "@/features/catalog/api/hours";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { digitsOf } from "@/lib/phone";
import { validatePhone } from "@/lib/validation";

import type { Courier, CourierDraft } from "./api/couriers";
import { HoursGrid } from "./hours-grid";
import { useCourier, useSaveCourier } from "./use-couriers";

/**
 * A driver's details and their week, on a page of its own.
 *
 * ## Why it is no longer a panel
 *
 * It was one, opened from the list *and* from the driver's own page — two
 * places, one form, and both of them 420pt wide with a seven-row rota inside.
 * The grid was the thing being squeezed, and it is the part of the form with
 * the most to say.
 *
 * ## Where Back goes depends on where Edit was pressed
 *
 * From the list, back is the list — with `?focus=` so the row comes back under
 * the operator's eye, the one thing the panel did that a page has to be told to
 * do. From the driver's page, back is that page. The two are told apart by
 * `?from=list` rather than by history, because `router.back()` after a save is
 * a step into whatever the browser happens to be holding: a reload, a pasted
 * link and a second edit all give different answers.
 *
 * ## The same form for adding and editing
 *
 * It was briefly a two-step wizard on create, on the store's model. That is the
 * right shape for a shop — seven interdependent parts ending in a map pin — and
 * the wrong one here: a driver is a name, a number and a rota, and splitting
 * three answers across two screens adds a click and a decision without removing
 * anything from either. One column, in the order somebody would say it.
 */
export function DriverEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const fromList = useSearchParams().get("from") === "list";

  // The `?? ""` keeps the call unconditional, which is what the rules of hooks
  // require; nothing reads the result when there is no id.
  const courier = useCourier(id ?? "");
  const initial = id ? (courier.data ?? null) : null;

  const save = useSaveCourier();

  const listHref = `/drivers${id ? `?focus=${id}` : ""}`;
  const toList = !id || fromList;

  const backHref = toList ? listHref : `/drivers/${id}`;
  // Their name when the way back is their page, so the link says where it
  // goes rather than "Back" — the same rule every other back link follows.
  const backLabel = toList
    ? t("drivers.title")
    : (initial?.name ?? t("drivers.title"));

  const leave = () => router.replace(backHref);

  if (id && !initial) {
    return (
      <EditorPage
        title={t("drivers.edit")}
        // The list, not their page: if there is no such driver there is no
        // page to go back to either.
        backHref={listHref}
        backLabel={t("drivers.title")}
        // The same width the form takes, so the page does not narrow to 640pt
        // for the length of the fetch and then jump wide when the driver lands.
        width="wide"
      >
        {courier.isPending ? (
          <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
        ) : (
          <EmptyState titleKey="drivers.notFound" mood="lost" />
        )}
      </EditorPage>
    );
  }

  return (
    <Form
      // Keyed on the row, so arriving at a second driver starts from the one
      // that was clicked rather than resuming the previous person's half-typed
      // name — and so Add after an edit starts blank.
      key={initial?.id ?? "new"}
      initial={initial}
      backHref={backHref}
      backLabel={backLabel}
      pending={save.isPending}
      onCancel={leave}
      onSave={(draft) =>
        save.mutate(
          { id: initial?.id ?? null, draft, name: draft.name },
          { onSuccess: leave },
        )
      }
    />
  );
}

/**
 * New drivers start from a week rather than a blank one.
 *
 * A driver with no working days is never on shift, so a form that defaults to
 * empty creates somebody who can never be dispatched — and the operator finds
 * that out the next time an order needs sending, with no clue why the name is
 * missing. `DEFAULT_WEEK` is a starting point, not a guess to live with: every
 * part of it is one click from being changed.
 */
function Form({
  initial,
  backHref,
  backLabel,
  pending,
  onSave,
  onCancel,
}: {
  initial: Courier | null;
  backHref: string;
  backLabel: string;
  pending: boolean;
  onSave: (draft: CourierDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [hours, setHours] = useState<DayHours[]>(
    initial?.hours ?? DEFAULT_WEEK,
  );

  // A new driver starts from `DEFAULT_WEEK`, so an untouched blank form is not
  // dirty and leaving it asks nothing — which is right: there is nothing there
  // to lose yet.
  useUnsavedChanges(
    changed(
      { name, phone, hours },
      {
        name: initial?.name ?? "",
        phone: initial?.phone ?? "",
        hours: initial?.hours ?? DEFAULT_WEEK,
      },
    ),
  );

  /**
   * The same rule the CHECK constraint carries, applied here so the operator is
   * told before saving rather than by a constraint name afterwards.
   *
   * `digitsOf` runs on the way in as well as in the API, because what they see
   * before pressing Save should be what gets stored — a field that silently
   * rewrites the value afterwards leaves somebody unsure which version is real.
   *
   * A week with no working days is refused for the reason above: it produces a
   * driver who is never offered, silently.
   */
  const digits = digitsOf(phone);
  const ready =
    name.trim().length > 0 && validatePhone(digits).ok && hours.length > 0;

  return (
    <EditorPage
      title={initial ? initial.name : t("drivers.add")}
      backHref={backHref}
      backLabel={backLabel}
      /* Two columns' worth of room — see the grid below, and `EditorPage`. */
      width="wide"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => onSave({ name, phone, hours })}
            disabled={!ready}
            pending={pending}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      {/**
       * Two columns: who they are, and when they work.
       *
       * The note above still holds — a driver is a name, a number and a rota,
       * asked in the order somebody would say it. What changed is that "one
       * column" was being read as "one column, 640pt wide, against whatever
       * the monitor is", which `EditorPage` itself calls a layout that reads
       * as failed rather than measured. The answers are short and the rota is
       * seven rows of controls, so stacking them left two thirds of the page
       * empty and pushed the rota below the fold on the screen it most needs
       * to be seen on.
       *
       * The split is along the seam the form already had: the two text answers
       * are one thought, the week is another, and the divider that used to sit
       * between them is now the gutter.
       *
       * Not equal halves. `EditorPage` hands the measure to the editor
       * precisely because the editor knows which of its fields are prose and
       * which are short controls — and a name and a phone number are short
       * answers that get no better for being 700pt wide, while the rota is
       * seven rows of a label, a switch and two time fields and uses
       * everything it is given. So the identity column is capped at a
       * readable measure and the rest of the page goes to the week.
       *
       * `items-start` so the short column does not stretch to the rota's
       * height and grow a tail of empty box under the phone field — the same
       * reason `menu-item-editor` gives for its own grid. Single column below
       * `lg`, where there is no room to divide and the original order is the
       * right one.
       */}
      <div className="grid grid-cols-1 items-start gap-lg lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-xxl">
        <div className="flex min-w-0 flex-col gap-lg">
          <Field label={t("drivers.name")}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("drivers.namePlaceholder")}
              maxLength={TEXT.name}
              autoFocus
            />
          </Field>

          <Field label={t("drivers.phone")} hint={t("drivers.phoneHint")}>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              placeholder={t("drivers.phonePlaceholder")}
            />
          </Field>
        </div>

        {/* No rule above it any more: beside the other column a border would
            be a line across the middle of the page rather than the seam
            between two parts of one form. The heading carries it instead —
            and below `lg`, where the columns stack, the heading is still what
            says a new section has started. */}
        <div className="flex min-w-0 flex-col gap-sm">
          <h3 className="text-[15px] font-semibold">
            {t("drivers.hoursTitle")}
          </h3>
          <HoursGrid week={hours} onChange={setHours} />
        </div>
      </div>
    </EditorPage>
  );
}

/**
 * The week a new driver starts on.
 *
 * Monday to Saturday, late afternoon into the night — when a delivery driver in
 * this business actually works. Sunday is left off rather than guessed at: a
 * default that is wrong in the *absence* direction is corrected the first time
 * somebody looks, while one that is wrong the other way sends an order to a
 * driver who is at home.
 */
const DEFAULT_WEEK: DayHours[] = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  opensAt: "16:00",
  closesAt: "23:00",
}));
