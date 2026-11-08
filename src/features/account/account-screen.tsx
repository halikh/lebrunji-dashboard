"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Mail, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  Avatar,
  Button,
  Field,
  Input,
  Page,
  PageHeader,
  Skeleton,
  useToasts,
} from "@/components/ui";
import { SettingRow } from "@/components/ui/setting-row";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";
import { PASSWORD } from "@/lib/limits";
import { validatePassword } from "@/lib/validation";

/**
 * The operator's own account.
 *
 * ## Its own page, not a tab on Settings
 *
 * Settings is **the shop's** — its hours, its sound, the words customers read.
 * An operator's own sign-in belongs to one person, so it lives where the
 * account menu points, next to Sign out.
 *
 * ## Both changes ask for the current password
 *
 * A signed-in session is exactly what an unattended laptop already has, so it
 * cannot be the proof for a change that outlives it. `/auth/account`
 * re-authenticates with the current password before either change; the form
 * asks for it up front because a control that is going to be refused should
 * say why beforehand.
 *
 * ## An email change is not done when it says it is
 *
 * Supabase mails the **new** address and the change lands only when that link
 * is followed. So success here is "check your email", and the address at the
 * top keeps saying the old one — because it still is.
 *
 * ## Rows first, forms on demand
 *
 * Laid out like Google's and Stripe's security pages: the email and the
 * password are rows that say what is there now, each with Change. The form
 * opens under its own row with its own Save, so neither can submit the
 * other's half — a form that sends whichever half was filled in can be
 * half-sent by accident.
 */

export const accountKey = ["account", "me"] as const;

export function AccountScreen() {
  const account = useQuery({
    queryKey: accountKey,
    queryFn: async () => {
      const response = await fetch("/auth/account");
      if (!response.ok) throw new Error(t("account.failed"));
      return (await response.json()) as { email: string | null };
    },
    // The browser holds no token it could read an email out of, so this is
    // the only way to know. It changes about never.
    staleTime: 10 * 60_000,
  });

  const email = account.data?.email ?? null;
  const [open, setOpen] = useState<Kind | null>(null);

  const emailValue = account.isPending ? (
    <Skeleton className="h-4 w-48" />
  ) : account.isError ? (
    <span role="alert" className="text-danger-ink">
      {t("account.failed")}{" "}
      <button
        type="button"
        onClick={() => void account.refetch()}
        className="font-medium underline underline-offset-2 hover:text-danger"
      >
        {t("common.retry")}
      </button>
    </span>
  ) : (
    // `break-all`: an address is one unbroken word, and a long one would
    // otherwise push the row wider than a phone.
    <span className="font-medium break-all text-ink-2">{email}</span>
  );

  return (
    <Page>
      <PageHeader title={t("account.title")} description={t("account.blurb")} />

      {/* Stripe's and Vercel's account pages: each section named on the left,
          its card on the right, so the page fills a desk-width screen in two
          columns instead of one narrow strip beside a lot of nothing. */}
      <div className="flex max-w-5xl flex-col divide-y divide-line">
        <AccountSection
          title={t("account.profileTitle")}
          description={t("account.profileBlurb")}
        >
          <div className="flex items-center gap-4 rounded-lg border border-line bg-surface p-5 shadow-xs">
            {email ? (
              <Avatar name={email} size={52} />
            ) : (
              <span className="flex size-13 shrink-0 items-center justify-center rounded-full bg-hover text-ink-3">
                <UserRound className="size-6" />
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[12.5px] font-medium text-ink-4">
                {t("account.signedInAs")}
              </p>
              {account.isPending ? (
                <Skeleton className="h-5 w-56" />
              ) : (
                <p className="text-[16px] font-semibold break-all text-ink">
                  {email ?? t("account.unknownEmail")}
                </p>
              )}
            </div>
          </div>
        </AccountSection>

        {/* Google's and Stripe's security pages: each way in is a row that
            says what it is now, with Change beside it. The form opens under
            its own row, so nothing is asked for until somebody means to
            change it, and the two changes can never be sent as one. */}
        <AccountSection
          title={t("account.signInTitle")}
          description={t("account.signInBlurb")}
        >
          <div className="divide-y divide-line rounded-lg border border-line bg-surface shadow-xs">
            <SettingRow
              label={
                <span className="flex items-center gap-2">
                  <Mail className="size-4 text-ink-3" aria-hidden />
                  {t("account.emailRow")}
                </span>
              }
              description={emailValue}
              footer={
                open === "email" && (
                  <ChangeForm
                    kind="email"
                    blurb={t("account.emailBlurb")}
                    submit={t("account.changeEmail")}
                    email={email}
                    onClose={() => setOpen(null)}
                  />
                )
              }
            >
              {open !== "email" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpen("email")}
                  aria-label={t("account.emailTitle")}
                >
                  {t("account.change")}
                </Button>
              )}
            </SettingRow>

            <SettingRow
              label={
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4 text-ink-3" aria-hidden />
                  {t("account.passwordRow")}
                </span>
              }
              description={
                <span className="tracking-widest text-ink-2">
                  {t("account.passwordMasked")}
                </span>
              }
              footer={
                open === "password" && (
                  <ChangeForm
                    kind="password"
                    blurb={t("account.passwordBlurb")}
                    submit={t("account.changePassword")}
                    email={email}
                    onClose={() => setOpen(null)}
                  />
                )
              }
            >
              {open !== "password" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpen("password")}
                  aria-label={t("account.passwordTitle")}
                >
                  {t("account.change")}
                </Button>
              )}
            </SettingRow>
          </div>
        </AccountSection>
      </div>
    </Page>
  );
}

/** A section's name and blurb on the left, its card on the right. */
function AccountSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-4 py-8 first:pt-2 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        <p className="text-[13px] text-ink-3">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

type Kind = "password" | "email";

type Errors = { current?: string; next?: string; confirm?: string };

/**
 * One change, with its re-authentication.
 *
 * Errors appear when Save is pressed rather than while typing: a half-typed
 * password is not a mistake yet, and a field going red under the cursor reads
 * as being told off.
 */
function ChangeForm({
  kind,
  blurb,
  submit,
  email,
  onClose,
}: {
  kind: Kind;
  blurb: string;
  submit: string;
  email: string | null;
  onClose: () => void;
}) {
  const toast = useToasts();
  const queryClient = useQueryClient();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  const dirty = current !== "" || next !== "" || confirm !== "";
  // Short and quick to retype, but still a form somebody is part way through.
  useUnsavedChanges(dirty);

  function clear() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
  }

  function validate(): Errors {
    const strong =
      kind === "password"
        ? validatePassword(next, { email: email ?? undefined })
        : ({ ok: true } as const);
    return {
      current: current ? undefined : t("account.currentRequired"),
      next:
        kind === "email"
          ? // Deliberately shallow. The address is proved by the confirmation
            // mail reaching it; every stricter pattern rejects valid ones.
            next.trim().includes("@")
            ? undefined
            : t("account.emailInvalid")
          : strong.ok
            ? undefined
            : t(strong.key, strong.params),
      confirm:
        kind === "password" && next !== confirm
          ? t("account.confirmMismatch")
          : undefined,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (found.current || found.next || found.confirm) return;

    setPending(true);
    try {
      const response = await fetch("/auth/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          kind === "password"
            ? { current, password: next }
            : { current, email: next.trim() },
        ),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        // A wrong current password belongs on the field it is about, not in a
        // toast at the corner of the screen.
        if (response.status === 403) {
          setErrors({ current: body.error ?? t("account.wrongPassword") });
          return;
        }
        toast.danger(body.error ?? t("common.somethingWentWrong"));
        return;
      }

      clear();
      onClose();
      if (kind === "password") {
        toast.success(t("account.passwordChanged"));
      } else {
        // Not "saved": the address does not move until the link in the new
        // inbox is followed.
        toast.info(t("account.emailPending"));
        void queryClient.invalidateQueries({ queryKey: accountKey });
      }
    } catch {
      toast.danger(t("common.somethingWentWrong"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      noValidate
      className="flex flex-col gap-4 rounded-md border border-line bg-subtle p-4"
    >
      <p className="text-[13px] text-ink-3">{blurb}</p>
      {/* Password managers fill the right account when the form names it. */}
      {email && (
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          hidden
        />
      )}
      <Field
        label={t("account.currentPassword")}
        hint={t("account.currentHint")}
        error={errors.current}
      >
        {(props) => (
          <Input
            {...props}
            type="password"
            autoComplete="current-password"
            // Opened on purpose, so the cursor goes where typing starts.
            autoFocus
            placeholder={t("account.currentPlaceholder")}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className="sm:max-w-sm"
          />
        )}
      </Field>

      {kind === "password" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("account.newPassword")}
            hint={t("account.newPasswordHint", { min: PASSWORD.min })}
            error={errors.next}
          >
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="new-password"
                maxLength={PASSWORD.max}
                placeholder={t("account.newPasswordPlaceholder", {
                  min: PASSWORD.min,
                })}
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("account.confirmPassword")} error={errors.confirm}>
            {(props) => (
              <Input
                {...props}
                type="password"
                autoComplete="new-password"
                maxLength={PASSWORD.max}
                placeholder={t("account.confirmPlaceholder")}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            )}
          </Field>
        </div>
      ) : (
        <Field
          label={t("account.newEmail")}
          hint={t("account.newEmailHint")}
          error={errors.next}
        >
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              placeholder={t("login.emailPlaceholder")}
              className="sm:max-w-sm"
            />
          )}
        </Field>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            clear();
            onClose();
          }}
          disabled={pending}
        >
          {t("common.cancel")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!dirty}
          pending={pending}
        >
          {submit}
        </Button>
      </div>
    </form>
  );
}
