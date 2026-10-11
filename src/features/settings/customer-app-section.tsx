"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import { useToasts } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";

import {
  fetchCustomerAppSettings,
  isValidAppVersion,
  isValidStoreUrl,
  updateCustomerAppSettings,
  type CustomerAppSettings,
} from "./api/app-settings";
import { appSettingsKey } from "./use-clock";

/**
 * Under `appSettingsKey`, so the invalidation every other save on this tab
 * makes reaches it too.
 */
const customerAppKey = [...appSettingsKey, "customer-app"] as const;

type Draft = Record<keyof CustomerAppSettings, string>;

const FIELDS = [
  "minVersionIos",
  "minVersionAndroid",
  "iosStoreUrl",
  "androidStoreUrl",
] as const satisfies readonly (keyof CustomerAppSettings)[];

function toDraft(saved: CustomerAppSettings): Draft {
  return {
    minVersionIos: saved.minVersionIos ?? "",
    minVersionAndroid: saved.minVersionAndroid ?? "",
    iosStoreUrl: saved.iosStoreUrl ?? "",
    androidStoreUrl: saved.androidStoreUrl ?? "",
  };
}

/** Trimmed, and empty back to null — which is what "no minimum" is stored as. */
function fromDraft(draft: Draft): CustomerAppSettings {
  const value = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    minVersionIos: value(draft.minVersionIos),
    minVersionAndroid: value(draft.minVersionAndroid),
    iosStoreUrl: value(draft.iosStoreUrl),
    androidStoreUrl: value(draft.androidStoreUrl),
  };
}

/**
 * The oldest customer app still served, and where its Update button goes.
 *
 * ## Hidden, not broken, before migration 0178
 *
 * The read returns `null` when the columns are not there, and the section draws
 * nothing — the rest of the tab is unrelated and has no reason to fail with it.
 *
 * ## One Save for the four
 *
 * Unlike the clock, these are one decision: a minimum is only safe alongside a
 * link that leads to the build that satisfies it.
 */
export function CustomerAppSection() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const settings = useQuery({
    queryKey: customerAppKey,
    queryFn: fetchCustomerAppSettings,
    staleTime: 10 * 60_000,
  });

  /** Only what has been typed; the rest falls through to the saved value. */
  const [edits, setEdits] = useState<Partial<Draft>>({});

  const save = useMutation({
    mutationFn: updateCustomerAppSettings,
    onSuccess: () => {
      setEdits({});
      void queryClient.invalidateQueries({ queryKey: customerAppKey });
      toast.success(t("general.savedCustomerApp"));
    },
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
  });

  const saved = settings.data ? toDraft(settings.data) : null;
  const draft: Draft | null = saved ? { ...saved, ...edits } : null;
  const dirty =
    saved != null &&
    draft != null &&
    FIELDS.some((key) => draft[key].trim() !== saved[key]);

  // Before the returns below: a hook cannot be conditional.
  useUnsavedChanges(dirty);

  // Not migrated yet (null), or still loading: nothing to show.
  if (!draft) {
    if (settings.isError) {
      return (
        <section className="flex flex-col gap-sm border-t border-border pt-xxl">
          <h2 className="text-[17px]">{t("general.customerAppTitle")}</h2>
          <p role="alert" className="text-[13px] font-medium text-danger">
            {settings.error instanceof Error
              ? settings.error.message
              : t("content.failed")}
          </p>
        </section>
      );
    }
    return null;
  }

  const iosVersionBad = !isValidAppVersion(draft.minVersionIos);
  const androidVersionBad = !isValidAppVersion(draft.minVersionAndroid);
  const iosUrlBad = !isValidStoreUrl(draft.iosStoreUrl);
  const androidUrlBad = !isValidStoreUrl(draft.androidStoreUrl);
  const anyBad =
    iosVersionBad || androidVersionBad || iosUrlBad || androidUrlBad;

  const edit = (key: keyof Draft) => (value: string) =>
    setEdits((previous) => ({ ...previous, [key]: value }));

  return (
    <section className="flex flex-col gap-sm border-t border-border pt-xxl">
      <h2 className="text-[17px]">{t("general.customerAppTitle")}</h2>
      <p className="text-[13px] text-text-soft">
        {t("general.customerAppBlurb")}
      </p>

      <div className="flex flex-wrap items-start gap-lg">
        <div className="w-[180px]">
          <Field
            label={t("general.minVersionIos")}
            hint={t("general.minVersionHint")}
            error={iosVersionBad ? t("general.minVersionInvalid") : undefined}
          >
            <Input
              value={draft.minVersionIos}
              onChange={(event) => edit("minVersionIos")(event.target.value)}
              placeholder="1.4.0"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>

        <div className="w-[180px]">
          <Field
            label={t("general.minVersionAndroid")}
            hint={t("general.minVersionHint")}
            error={
              androidVersionBad ? t("general.minVersionInvalid") : undefined
            }
          >
            <Input
              value={draft.minVersionAndroid}
              onChange={(event) =>
                edit("minVersionAndroid")(event.target.value)
              }
              placeholder="1.4.0"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
      </div>

      {/* The consequence, before the Save rather than after it. There is no
          grace period on the phone: the next launch below the minimum is the
          blocking screen. */}
      <p className="w-fit rounded-sm bg-warning-wash px-sm py-xs text-[12px] font-semibold text-text">
        {t("general.minVersionWarning")}
      </p>

      <div className="flex max-w-[560px] flex-col gap-sm">
        <Field
          label={t("general.iosStoreUrl")}
          error={iosUrlBad ? t("general.storeUrlInvalid") : undefined}
        >
          <Input
            type="url"
            value={draft.iosStoreUrl}
            onChange={(event) => edit("iosStoreUrl")(event.target.value)}
            placeholder="https://apps.apple.com/app/id…"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <Field
          label={t("general.androidStoreUrl")}
          error={androidUrlBad ? t("general.storeUrlInvalid") : undefined}
        >
          <Input
            type="url"
            value={draft.androidStoreUrl}
            onChange={(event) => edit("androidStoreUrl")(event.target.value)}
            placeholder="https://play.google.com/store/apps/details?id=…"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </div>

      <div>
        <Button
          disabled={!dirty || anyBad}
          pending={save.isPending}
          onClick={() => save.mutate(fromDraft(draft))}
        >
          {t("general.saveCustomerApp")}
        </Button>
      </div>
    </section>
  );
}
