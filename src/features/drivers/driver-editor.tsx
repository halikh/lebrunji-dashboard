"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, UserX } from "lucide-react";
import { useState } from "react";

import {
  Button,
  EmptyState,
  Field,
  Input,
  Page,
  PageHeader,
  Section,
  Skeleton,
} from "@/components/ui";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import type { DayHours } from "@/features/catalog/api/hours";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { digitsOf } from "@/lib/phone";
import { validatePhone } from "@/lib/validation";

import type { Courier, CourierDraft } from "./api/couriers";
import { DEFAULT_WEEK, HoursGrid, WeekSummary } from "./hours-grid";
import { useCourier, useSaveCourier } from "./use-couriers";

/**
 * A driver's details and their week, on a page of its own — the same form for
 * adding and editing, in the order somebody would say it: a name, a number, a
 * rota.
 *
 * ## Where Save and Cancel go depends on where Edit was pressed
 *
 * From the list, the list with `?focus=` so the row comes back into view;
 * from the driver's page, that page. Told apart by `?from=list`
 * rather than by history, because `router.back()` after a save steps into
 * whatever the browser happens to hold.
 */
export function DriverEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const fromList = useSearchParams().get("from") === "list";

  // `?? ""` keeps the hook unconditional; nothing reads it without an id.
  const courier = useCourier(id ?? "");
  const initial = id ? (courier.data ?? null) : null;
  const save = useSaveCourier();

  const listHref = `/drivers${id ? `?focus=${id}` : ""}`;
  const toList = !id || fromList;
  const backHref = toList ? listHref : `/drivers/${id}`;

  const leave = () => router.replace(backHref);

  if (id && !initial) {
    return (
      <Page width="narrow">
        <PageHeader title={t("drivers.edit")} />
        {courier.isPending ? (
          <div className="flex flex-col gap-4" aria-busy>
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        ) : courier.isError ? (
          <EmptyState
            icon={<AlertCircle />}
            title={t("common.loadFailed")}
            action={
              <Button onClick={() => void courier.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<UserX />}
            title={t("drivers.notFound")}
            description={t("drivers.notFoundBody")}
          />
        )}
      </Page>
    );
  }

  return (
    <Form
      // Keyed on the row, so opening a second driver never resumes the first
      // one's half-typed name.
      key={initial?.id ?? "new"}
      initial={initial}
      pending={save.isPending}
      onCancel={leave}
      onSave={(draft) =>
        save.mutate(
          { id: initial?.id ?? null, draft, name: draft.name.trim() },
          { onSuccess: leave },
        )
      }
    />
  );
}

function Form({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: Courier | null;
  pending: boolean;
  onSave: (draft: CourierDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [hours, setHours] = useState<DayHours[]>(
    initial?.hours ?? DEFAULT_WEEK,
  );
  const [touched, setTouched] = useState({ name: false, phone: false });

  // An untouched new form starts from DEFAULT_WEEK, so it is not dirty and
  // leaving asks nothing — there is nothing to lose yet.
  const dirty = changed(
    { name, phone, hours },
    {
      name: initial?.name ?? "",
      phone: initial?.phone ?? "",
      hours: initial?.hours ?? DEFAULT_WEEK,
    },
  );
  useUnsavedChanges(dirty);
  const guard = useGuardedAction();

  /**
   * The CHECK constraint's rule, applied before Save rather than reported by a
   * constraint name after it. A week with no working days is refused too: it
   * makes a driver who is never offered, silently.
   */
  const digits = digitsOf(phone);
  const phoneCheck = validatePhone(digits);
  const nameError =
    touched.name && !name.trim() ? t("drivers.nameRequired") : undefined;
  const phoneError =
    touched.phone && digits.length > 0 && !phoneCheck.ok
      ? t(phoneCheck.key, phoneCheck.params)
      : undefined;
  const ready = name.trim().length > 0 && phoneCheck.ok && hours.length > 0;
  const canSave = ready && (dirty || !initial);

  function submit() {
    setTouched({ name: true, phone: true });
    if (!canSave || pending) return;
    onSave({ name, phone, hours });
  }

  return (
    <Page>
      <PageHeader
        title={initial ? initial.name : t("drivers.add")}
        description={t(initial ? "drivers.editBlurb" : "drivers.newBlurb")}
      />

      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Section
              title={t("drivers.detailsTitle")}
              description={t("drivers.detailsBlurb")}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t("drivers.name")} error={nameError}>
                  {(props) => (
                    <Input
                      {...props}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onBlur={() =>
                        setTouched((was) => ({ ...was, name: true }))
                      }
                      placeholder={t("drivers.namePlaceholder")}
                      maxLength={TEXT.name}
                      autoComplete="off"
                      autoFocus={!initial}
                    />
                  )}
                </Field>
                <Field
                  label={t("drivers.phone")}
                  hint={t("drivers.phoneHint")}
                  error={phoneError}
                >
                  {(props) => (
                    <div
                      onBlur={() =>
                        setTouched((was) => ({ ...was, phone: true }))
                      }
                    >
                      <PhoneInput
                        {...props}
                        value={phone}
                        onChange={setPhone}
                        placeholder={t("drivers.phonePlaceholder")}
                        invalid={!!phoneError}
                      />
                    </div>
                  )}
                </Field>
              </div>
            </Section>

            <Section
              title={t("drivers.hoursTitle")}
              description={t("drivers.hoursBlurb")}
            >
              <HoursGrid week={hours} onChange={setHours} />
            </Section>
          </div>

          <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-0">
            <Section
              title={t("drivers.weekTitle")}
              description={t("drivers.weekBlurb")}
            >
              <WeekSummary week={hours} onChange={setHours} />
            </Section>
          </aside>
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 -mb-6 lg:-mb-8 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <Button
            type="button"
            variant="secondary"
            onClick={guard(onCancel)}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSave}
            pending={pending}
          >
            {initial ? t("common.save") : t("drivers.finish")}
          </Button>
        </div>
      </form>
    </Page>
  );
}
