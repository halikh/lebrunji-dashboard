"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Smartphone, TriangleAlert } from "lucide-react";
import { useState } from "react";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Section,
  Skeleton,
} from "@/components/ui";
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
import { SaveBar } from "./settings-parts";
import { appSettingsKey } from "./use-clock";

/**
 * Under `appSettingsKey`, so the invalidation every other app-settings save
 * makes reaches it too.
 */
const customerAppKey = [...appSettingsKey, "customer-app"] as const;

type Draft = Record<
  Exclude<keyof CustomerAppSettings, "supportsLatest">,
  string
>;

const FIELDS = [
  "minVersionIos",
  "minVersionAndroid",
  "iosStoreUrl",
  "androidStoreUrl",
  "latestVersionIos",
  "latestVersionAndroid",
] as const satisfies readonly (keyof Draft)[];

function toDraft(saved: CustomerAppSettings): Draft {
  return {
    minVersionIos: saved.minVersionIos ?? "",
    minVersionAndroid: saved.minVersionAndroid ?? "",
    iosStoreUrl: saved.iosStoreUrl ?? "",
    androidStoreUrl: saved.androidStoreUrl ?? "",
    latestVersionIos: saved.latestVersionIos ?? "",
    latestVersionAndroid: saved.latestVersionAndroid ?? "",
  };
}

/** Trimmed, and empty back to null — which is what "no minimum" is stored as. */
function fromDraft(draft: Draft, supportsLatest: boolean): CustomerAppSettings {
  const value = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    minVersionIos: value(draft.minVersionIos),
    minVersionAndroid: value(draft.minVersionAndroid),
    iosStoreUrl: value(draft.iosStoreUrl),
    androidStoreUrl: value(draft.androidStoreUrl),
    latestVersionIos: value(draft.latestVersionIos),
    latestVersionAndroid: value(draft.latestVersionAndroid),
    supportsLatest,
  };
}

/**
 * The oldest customer app still served, and where its Update button goes.
 *
 * - **Before migration 0178** the read returns null; the tab says so rather
 *   than drawing an empty form.
 * - **One Save for the four**: a minimum is only safe alongside a link that
 *   leads to the build that satisfies it.
 * - **A new minimum asks first.** There is no grace period on the phone — the
 *   next launch below it is the blocking screen — so setting or changing a
 *   minimum is confirmed, saying who is locked out. Clearing one, or editing
 *   only a link, saves straight away.
 */
export function CustomerAppTab() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const settings = useQuery({
    queryKey: customerAppKey,
    queryFn: fetchCustomerAppSettings,
    staleTime: 10 * 60_000,
  });

  /** Only what has been typed; the rest falls through to the saved value. */
  const [edits, setEdits] = useState<Partial<Draft>>({});
  const [confirming, setConfirming] = useState(false);

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

  if (settings.isPending) {
    return <Skeleton className="h-72 rounded-lg" />;
  }

  if (settings.isError) {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title={t("content.failed")}
        description={
          settings.error instanceof Error ? settings.error.message : undefined
        }
        action={
          <Button onClick={() => void settings.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  if (!draft || !saved) {
    return (
      <EmptyState
        icon={<Smartphone />}
        title={t("general.customerAppTitle")}
        description={t("general.customerAppMissing")}
      />
    );
  }

  const iosVersionBad = !isValidAppVersion(draft.minVersionIos);
  const androidVersionBad = !isValidAppVersion(draft.minVersionAndroid);
  const iosUrlBad = !isValidStoreUrl(draft.iosStoreUrl);
  const androidUrlBad = !isValidStoreUrl(draft.androidStoreUrl);
  const iosLatestBad = !isValidAppVersion(draft.latestVersionIos);
  const androidLatestBad = !isValidAppVersion(draft.latestVersionAndroid);
  const supportsLatest = settings.data?.supportsLatest === true;
  const anyBad =
    iosVersionBad ||
    androidVersionBad ||
    iosUrlBad ||
    androidUrlBad ||
    iosLatestBad ||
    androidLatestBad;

  /** The minimums this save would set or change (not clear). */
  const newMinimums = (["minVersionIos", "minVersionAndroid"] as const)
    .filter((key) => {
      const value = draft[key].trim();
      return value !== "" && value !== saved[key];
    })
    .map((key) => draft[key].trim());

  const edit = (key: keyof Draft) => (value: string) =>
    setEdits((previous) => ({ ...previous, [key]: value }));

  function submit() {
    if (!draft || anyBad) return;
    if (newMinimums.length > 0) setConfirming(true);
    else save.mutate(fromDraft(draft, supportsLatest));
  }

  /** The props a version `Input` shares, whichever store it is for. */
  const versionProps = (
    key:
      | "minVersionIos"
      | "minVersionAndroid"
      | "latestVersionIos"
      | "latestVersionAndroid",
  ) => ({
    value: draft[key],
    onChange: (event: { target: { value: string } }) =>
      edit(key)(event.target.value),
    placeholder: "1.4.0",
    inputMode: "decimal" as const,
    autoComplete: "off",
    spellCheck: false,
    className: "tabular-nums",
  });

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={t("general.versionsTitle")}
        description={t("general.versionsBlurb")}
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("general.minVersionIos")}
              hint={t("general.minVersionHint")}
              error={iosVersionBad ? t("general.minVersionInvalid") : undefined}
            >
              {(props) => (
                <Input {...props} {...versionProps("minVersionIos")} />
              )}
            </Field>
            <Field
              label={t("general.minVersionAndroid")}
              hint={t("general.minVersionHint")}
              error={
                androidVersionBad ? t("general.minVersionInvalid") : undefined
              }
            >
              {(props) => (
                <Input {...props} {...versionProps("minVersionAndroid")} />
              )}
            </Field>
          </div>

          {/* The consequence, before the Save rather than after it. */}
          <p className="flex items-start gap-2.5 rounded-md border border-warning/20 bg-warning-soft px-3 py-2.5 text-[13px] text-warning-ink">
            <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
            {t("general.minVersionWarning")}
          </p>
        </div>
      </Section>

      {supportsLatest ? (
        <Section
          title={t("general.latestTitle")}
          description={t("general.latestBlurb")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("general.latestVersionIos")}
              hint={t("general.latestVersionHint")}
              error={iosLatestBad ? t("general.minVersionInvalid") : undefined}
            >
              {(props) => (
                <Input {...props} {...versionProps("latestVersionIos")} />
              )}
            </Field>
            <Field
              label={t("general.latestVersionAndroid")}
              hint={t("general.latestVersionHint")}
              error={
                androidLatestBad ? t("general.minVersionInvalid") : undefined
              }
            >
              {(props) => (
                <Input {...props} {...versionProps("latestVersionAndroid")} />
              )}
            </Field>
          </div>
        </Section>
      ) : null}

      <Section
        title={t("general.storeLinksTitle")}
        description={t("general.storeLinksBlurb")}
      >
        <div className="flex flex-col gap-4">
          <Field
            label={t("general.iosStoreUrl")}
            error={iosUrlBad ? t("general.storeUrlInvalid") : undefined}
          >
            {(props) => (
              <Input
                {...props}
                type="url"
                value={draft.iosStoreUrl}
                onChange={(event) => edit("iosStoreUrl")(event.target.value)}
                placeholder="https://apps.apple.com/app/id…"
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>
          <Field
            label={t("general.androidStoreUrl")}
            error={androidUrlBad ? t("general.storeUrlInvalid") : undefined}
          >
            {(props) => (
              <Input
                {...props}
                type="url"
                value={draft.androidStoreUrl}
                onChange={(event) =>
                  edit("androidStoreUrl")(event.target.value)
                }
                placeholder="https://play.google.com/store/apps/details?id=…"
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>
        </div>
      </Section>

      <SaveBar
        dirty={dirty}
        disabled={anyBad}
        pending={save.isPending}
        saveLabel={t("general.saveCustomerApp")}
        onSave={submit}
        onCancel={dirty ? () => setEdits({}) : undefined}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title={t("general.minVersionConfirmTitle")}
        description={t("general.minVersionConfirmBody", {
          versions: [...new Set(newMinimums)].join(" / "),
        })}
        confirmLabel={t("general.minVersionConfirm")}
        onConfirm={async () => {
          // The mutation toasts its own failure; the dialog just closes.
          await save
            .mutateAsync(fromDraft(draft, supportsLatest))
            .catch(() => undefined);
        }}
      />
    </div>
  );
}
