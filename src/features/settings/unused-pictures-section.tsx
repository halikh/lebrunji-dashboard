"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  fetchUnusedPictures,
  removeUnusedPictures,
} from "./api/unused-pictures";

const unusedKey = ["unused-pictures"] as const;

/**
 * Clearing pictures nothing points at out of storage.
 *
 * A button rather than a schedule. The dashboard holds no credential that
 * works without somebody signed in — by design, see `lib/storage/bucket.ts` —
 * so a timer would need a key that bypasses RLS just for this. Clutter in a
 * bucket costs cents; that key would cost the design. The count is shown so
 * the button is pressed when there is something to press it for.
 */
export function UnusedPicturesSection() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  const unused = useQuery({
    queryKey: unusedKey,
    queryFn: fetchUnusedPictures,
    // It lists the whole bucket. Once a visit is plenty.
    staleTime: 5 * 60_000,
    retry: false,
  });

  const sweep = useMutation({
    mutationFn: removeUnusedPictures,
    onSuccess: (result) => {
      toast.success(
        t("general.unusedRemoved", {
          count: result.deleted,
          size: formatBytes(result.bytes),
        }),
      );
      if (result.failed > 0) {
        toast.danger(t("general.unusedSomeFailed", { count: result.failed }));
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: unusedKey }),
  });

  const data = unused.data;
  const size = formatBytes(data?.bytes ?? 0);

  return (
    <section className="flex flex-col gap-sm border-t border-border pt-xxl">
      <h2 className="text-[17px]">{t("general.unusedTitle")}</h2>
      <p className="text-[13px] text-text-soft">{t("general.unusedBlurb")}</p>

      <div className="flex flex-wrap items-center gap-sm">
        {unused.isPending ? (
          <p className="text-[13px] text-text-faint">
            {t("general.unusedChecking")}
          </p>
        ) : unused.isError ? (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {unused.error.message}
          </p>
        ) : data && data.count > 0 ? (
          <>
            <p className="text-[13px] font-semibold">
              {data.count === 1
                ? t("general.unusedOne", { size })
                : t("general.unusedMany", { count: data.count, size })}
            </p>
            <ConfirmButton
              triggerVariant="secondary"
              titleKey="general.unusedConfirmTitle"
              bodyKey="general.unusedConfirmBody"
              confirmKey="general.unusedConfirm"
              params={{ count: data.count, size }}
              onConfirm={async () => {
                await sweep.mutateAsync();
              }}
            >
              {t("general.unusedRemove")}
            </ConfirmButton>
          </>
        ) : (
          <p className="text-[13px] text-text-faint">
            {t("general.unusedNone")}
          </p>
        )}
      </div>
    </section>
  );
}

/** `840 KB`, `12.4 MB` — storage sizes, not money, so no locale grouping. */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
