"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ImageOff, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button, ConfirmDialog, Section, Skeleton } from "@/components/ui";
import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  fetchUnusedPictures,
  removeUnusedPictures,
} from "./api/unused-pictures";

const unusedKey = ["unused-pictures"] as const;

/**
 * Set-once, rarely-touched settings. Today that is the storage sweep.
 *
 * A button rather than a schedule: the dashboard holds no credential that works
 * without somebody signed in (by design, see `lib/storage/bucket.ts`), so a
 * timer would need a key that bypasses RLS just for this. Clutter in a bucket
 * costs cents; that key would cost the design. The count is shown so the
 * button is pressed when there is something to press it for.
 *
 * The refusals (not an admin, migration 0188 missing, storage and database
 * from different environments) come back as sentences from
 * `api/unused-pictures` and are shown as they are — each means nothing was
 * deleted.
 */
export function AdvancedTab() {
  const queryClient = useQueryClient();
  const toast = useToasts();
  const [confirming, setConfirming] = useState(false);

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
    onError: (error) =>
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: unusedKey }),
  });

  const data = unused.data;
  const size = formatBytes(data?.bytes ?? 0);
  const hasSome = data != null && data.count > 0;

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={t("general.unusedTitle")}
        description={t("general.unusedBlurb")}
      >
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-subtle p-3">
          {unused.isPending ? (
            <>
              <Skeleton className="size-9 rounded-md" />
              <span className="text-[13.5px] text-ink-3">
                {t("general.unusedChecking")}
              </span>
            </>
          ) : unused.isError ? (
            <>
              <Status icon={<AlertCircle className="text-danger" />}>
                <span className="font-medium text-ink">
                  {t("general.unusedFailedTitle")}
                </span>
                <span role="alert" className="text-[12.5px] text-danger-ink">
                  {unused.error.message}
                </span>
              </Status>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void unused.refetch()}
              >
                {t("common.retry")}
              </Button>
            </>
          ) : hasSome ? (
            <>
              <Status icon={<ImageOff className="text-ink-3" />}>
                <span className="font-medium text-ink">
                  {data.count === 1
                    ? t("general.unusedOne", { size })
                    : t("general.unusedMany", { count: data.count, size })}
                </span>
              </Status>
              <Button
                variant="danger-soft"
                size="sm"
                pending={sweep.isPending}
                onClick={() => setConfirming(true)}
              >
                <Trash2 />
                {t("general.unusedRemove")}
              </Button>
            </>
          ) : (
            <Status icon={<CheckCircle2 className="text-success" />}>
              <span className="font-medium text-ink">
                {t("general.unusedNone")}
              </span>
            </Status>
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        title={t("general.unusedConfirmTitle")}
        description={t("general.unusedConfirmBody", {
          count: data?.count ?? 0,
          size,
        })}
        confirmLabel={t("general.unusedConfirm")}
        onConfirm={async () => {
          // The mutation toasts its own failure; the dialog just closes.
          await sweep.mutateAsync().catch(() => undefined);
        }}
      />
    </div>
  );
}

function Status({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface [&_svg]:size-4">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 text-[13.5px]">
        {children}
      </div>
    </div>
  );
}

/** `840 KB`, `12.4 MB` — storage sizes, not money, so no locale grouping. */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
