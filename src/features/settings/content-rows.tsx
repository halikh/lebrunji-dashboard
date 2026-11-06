"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, ConfirmDialog, Menu, Switch } from "@/components/ui";
import { t } from "@/i18n/translations";

/**
 * Live / Hidden on a help topic, asked before it flips — either way is
 * something customers see (or stop seeing) in the app straight away.
 */
export function VisibilitySwitch({
  name,
  on,
  onChange,
}: {
  name: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Switch
        checked={on}
        onCheckedChange={() => setAsking(true)}
        aria-label={t("content.visibilityAria", { name })}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(on ? "content.hideTitle" : "content.showTitle", { name })}
        description={t(on ? "content.hideBody" : "content.showBody")}
        confirmLabel={t(on ? "content.hideConfirm" : "content.showConfirm")}
        onConfirm={() => onChange(!on)}
      />
    </>
  );
}

/**
 * The ⋯ on a content row: Edit, and Remove behind a confirmation that says it
 * is a real delete (`help_topics` and `policy_sections` have no `deleted_at`,
 * unlike every catalogue row).
 */
export function RowMenu({
  name,
  onEdit,
  removeTitle,
  removeBody,
  onRemove,
}: {
  name: string;
  onEdit: () => void;
  removeTitle: ReactNode;
  removeBody: ReactNode;
  onRemove: () => Promise<unknown>;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Menu
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("content.moreFor", { name })}
          >
            <MoreHorizontal />
          </Button>
        }
        items={[
          { label: t("common.edit"), icon: <Pencil />, onSelect: onEdit },
          "separator",
          {
            label: t("content.remove"),
            icon: <Trash2 />,
            tone: "danger",
            onSelect: () => setAsking(true),
          },
        ]}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        tone="danger"
        title={removeTitle}
        description={removeBody}
        confirmLabel={t("content.removeConfirm")}
        onConfirm={async () => {
          // The mutation toasts its own failure; the dialog just closes.
          await onRemove().catch(() => undefined);
        }}
      />
    </>
  );
}
