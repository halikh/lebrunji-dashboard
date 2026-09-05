"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, Input, cx } from "@/components/ui";
import { Field } from "@/components/ui/field";
import { SectionTab, tabArrowHandler } from "@/components/ui/tab";
import { useToasts } from "@/components/ui/toast";
import {
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { GeneralTab } from "@/features/settings/general-tab";
import { t, type TranslationKey } from "@/i18n/translations";
import { PASSWORD } from "@/lib/limits";
import { validatePassword } from "@/lib/validation";

/**
 * The operator's own account.
 *
 * ## Its own page, not a tab on Settings
 *
 * It began as a fifth tab there and does not belong: Settings is **the app's
 * prose** — the words customers read in the help screen, the legal documents,
 * the order timeline. An operator's own sign-in is not content the product
 * shows anybody, and filing it beside the privacy policy makes both harder to
 * find.
 *
 * It is not a rail section either. The rail is six items and should stay six —
 * it is glanced at all day, and every addition costs a little of the queue's
 * prominence. So it lives where account-level things already live: at the foot
 * of the rail, next to Sign out, which is the other thing there that is about
 * *you* rather than about the business.
 *
 * ## Both actions ask for the current password
 *
 * Not ceremony. A signed-in session is exactly what an unattended laptop
 * already has, so a session alone cannot be the proof for a change that
 * outlives it: setting a new password from a borrowed session is a permanent
 * takeover, and setting a new *email* hands over the recovery route too, which
 * is worse — the real operator can no longer reset their way back in.
 *
 * The current password is the one thing a stolen session does not carry. The
 * route re-authenticates with it before either change; the form asks for it
 * because a control that is going to be refused should say why beforehand.
 *
 * ## An email change is not done when it says it is
 *
 * Supabase mails the **new** address and the change lands only when that link
 * is followed. So a success here is "check your email", and the address on
 * screen keeps saying the old one — because it is still the old one. Reporting
 * "saved" would leave an operator believing they had moved their recovery route
 * when they had not, which is the single worst thing this screen could get
 * wrong.
 */
type TabKey = "general" | "password" | "email";

const TABS: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: "general", labelKey: "general.tab" },
  { key: "password", labelKey: "account.tabPassword" },
  { key: "email", labelKey: "account.tabEmail" },
];

export function AccountScreen() {
  const [tab, setTab] = useState<TabKey>("general");
  // These tabs are local state rather than the URL, so there is no `show()` to
  // guard the way the other screens have — the button is the whole switch.
  const guarded = useGuardedAction();

  const toast = useToasts();
  const queryClient = useQueryClient();

  const account = useQuery({
    queryKey: ["account", "me"],
    queryFn: async () => {
      const response = await fetch("/auth/account");
      if (!response.ok) throw new Error(t("account.failed"));
      return (await response.json()) as { email: string | null };
    },
    // The browser holds no token it could read an email out of, so this is the
    // only way to know. It changes about never.
    staleTime: 10 * 60_000,
  });

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 flex-col gap-sm border-b border-border bg-surface px-xxl pt-lg">
        <h1 className="text-[24px]">{t("account.title")}</h1>
        <p className="text-[13px] text-text-soft">{t("account.blurb")}</p>

        {/* Chapters of one screen, so `SectionTab` — the same underline the
            store and the customer profile use.

            General is first and it is not an account setting: it is the shop's.
            It sits here because this is the page an operator opens to change
            how the thing behaves, and a fifth tab on Settings would have put
            the clock format next to the privacy policy. */}
        <div role="tablist" className="-mb-px flex gap-lg">
          {TABS.map(({ key, labelKey }) => (
            <SectionTab
              key={key}
              label={t(labelKey)}
              active={tab === key}
              onClick={guarded(() => setTab(key))}
              onKeyDown={tabArrowHandler(
                TABS.map((one) => one.key),
                tab,
                setTab,
              )}
            />
          ))}
        </div>
      </div>

      {tab === "general" && <GeneralTab />}

      {/* Unmounted on General, not hidden with a class.

          Everything below is a password box or an email box, and `hidden` left
          all four of them in the DOM sitting just after the two hour selects.
          Chrome does not need a field to be visible to decide a page carries a
          credential form, and the username it fills is the text input nearest
          the passwords — which, on the General tab, is "Closes at". So the
          operator opened this page and found their own email typed over the
          closing hour, and the autofill wrote React state on the way in, which
          is what put an unsaved-changes dialog on a tab that has no Save.

          The two forms below stay siblings, so the state the note on them is
          about still survives moving between Password and Email. */}
      {tab !== "general" && (
        <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
          {/* Full width and first: which account these two forms are about is
              the thing to establish before either of them is filled in. */}
          <section className="flex flex-col gap-xs rounded-md border border-border bg-surface p-lg">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">
              {t("account.signedInAs")}
            </h2>
            <p className="text-[17px] font-semibold">
              {account.data?.email ?? t("common.loading")}
            </p>
          </section>

          {/* One at a time, not side by side. They were a two-column grid,
              which was right when the page was only these two forms: the same
              current-password field, the same shape, and stacking them put the
              second below the fold. With tabs the choice is made above, so
              showing both would be offering it twice.

              Siblings rather than a swapped child, so a half-typed password
              survives a look at the email form and back. */}
          <div className={cx(tab !== "password" && "hidden")}>
            <Change
              title={t("account.passwordTitle")}
              blurb={t("account.passwordBlurb")}
              submit={t("account.changePassword")}
              fields="password"
              onDone={() => toast.success(t("account.passwordChanged"))}
            />
          </div>

          <div className={cx(tab !== "email" && "hidden")}>
            <Change
              title={t("account.emailTitle")}
              blurb={t("account.emailBlurb")}
              submit={t("account.changeEmail")}
              fields="email"
              onDone={() => {
                // Not "saved": the address does not move until the link in the new
                // inbox is followed.
                toast.info(t("account.emailPending"));
                void queryClient.invalidateQueries({
                  queryKey: ["account", "me"],
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One change, with its re-authentication.
 *
 * Two instances rather than one form with both fields: an operator changing a
 * password should not have to look at an email box, and a form that submits
 * whichever half you filled in is a form that can be half-submitted by
 * accident.
 */
function Change({
  title,
  blurb,
  submit,
  fields,
  onDone,
}: {
  title: string;
  blurb: string;
  submit: string;
  fields: "password" | "email";
  onDone: () => void;
}) {
  const toast = useToasts();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  // Short and quick to retype, but it is still a form somebody is part way
  // through, and the tab strip above would empty it without a word.
  useUnsavedChanges(current !== "" || next !== "" || confirm !== "");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});

  function clear() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
  }

  async function send() {
    const strong =
      fields === "password" ? validatePassword(next) : { ok: true as const };

    const found = {
      current: current ? undefined : t("account.currentRequired"),
      next:
        fields === "email"
          ? // Deliberately shallow. The address is proved by the confirmation
            // mail reaching it — a regex here would only ever catch a typo that
            // has no `@` in it, and every stricter pattern rejects addresses
            // that are perfectly valid.
            next.includes("@")
            ? undefined
            : t("account.emailInvalid")
          : strong.ok
            ? undefined
            : t(strong.key, strong.params),
      confirm:
        fields === "password" && next !== confirm
          ? t("account.confirmMismatch")
          : undefined,
    };

    setErrors(found);
    if (found.current || found.next || found.confirm) return;

    setPending(true);
    try {
      const response = await fetch("/auth/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          fields === "password"
            ? { current, password: next }
            : { current, email: next },
        ),
      });

      const body = (await response.json()) as { error?: string };

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
      onDone();
    } catch {
      toast.danger(t("common.somethingWentWrong"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex h-full flex-col gap-lg rounded-md border border-border bg-surface p-lg">
      <div className="flex flex-col gap-xs">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        <p className="text-[13px] text-text-soft">{blurb}</p>
      </div>

      <Field
        label={t("account.currentPassword")}
        hint={t("account.currentHint")}
        error={errors.current}
      >
        <Input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          placeholder={t("login.passwordPlaceholder")}
        />
      </Field>

      {fields === "password" ? (
        <>
          <Field
            label={t("account.newPassword")}
            hint={t("account.newPasswordHint", { min: PASSWORD.min })}
            error={errors.next}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              placeholder={t("login.passwordPlaceholder")}
            />
          </Field>

          <Field label={t("account.confirmPassword")} error={errors.confirm}>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={t("login.passwordPlaceholder")}
            />
          </Field>
        </>
      ) : (
        <Field
          label={t("account.newEmail")}
          hint={t("account.newEmailHint")}
          error={errors.next}
        >
          <Input
            type="email"
            autoComplete="email"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            placeholder={t("login.emailPlaceholder")}
          />
        </Field>
      )}

      <div className="mt-auto flex justify-end">
        <Button onClick={() => void send()} pending={pending}>
          {submit}
        </Button>
      </div>
    </section>
  );
}
