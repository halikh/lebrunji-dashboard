"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog, Menu, cx } from "@/components/ui";
import { useAnyUnsaved } from "@/components/unsaved-changes";
import { t } from "@/i18n/translations";
import { forgetAccessToken } from "@/lib/supabase/client";

async function fetchEmail(): Promise<string | null> {
  const response = await fetch("/auth/account");
  if (!response.ok) return null;
  const body = (await response.json()) as { email?: string | null };
  return body.email ?? null;
}

export function AccountMenu({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const unsaved = useAnyUnsaved();
  const [confirming, setConfirming] = useState(false);
  const email = useQuery({
    queryKey: ["account", "email"],
    queryFn: fetchEmail,
    staleTime: Infinity,
  });
  const name = email.data ?? "";

  async function signOut() {
    const response = await fetch("/auth/sign-out", { method: "POST" });
    if (!response.ok) throw new Error("sign-out failed");
    forgetAccessToken();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <Menu
        align="start"
        label={
          email.data ? (
            <span className="flex flex-col">
              <span>{t("shell.signedInAs")}</span>
              <span className="truncate font-medium text-ink">
                {email.data}
              </span>
            </span>
          ) : undefined
        }
        items={[
          {
            label: t("nav.account"),
            icon: <UserRound />,
            onSelect: () => router.push("/account"),
          },
          "separator",
          {
            label: t("common.signOut"),
            icon: <LogOut />,
            tone: "danger",
            onSelect: () => setConfirming(true),
          },
        ]}
        trigger={
          <button
            type="button"
            aria-label={t("nav.account")}
            title={collapsed ? name || t("nav.account") : undefined}
            className={cx(
              "flex h-9 w-full items-center gap-2.5 rounded-md text-start transition-colors hover:bg-hover",
              collapsed ? "justify-center" : "px-2.5",
            )}
          >
            {collapsed ? (
              <UserRound className="size-[18px] text-ink-3" strokeWidth={1.9} />
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-2">
                  {name || t("nav.account")}
                </span>
                <ChevronsUpDown className="size-4 text-ink-4" />
              </>
            )}
          </button>
        }
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirm.signOutTitle")}
        description={t(
          unsaved ? "confirm.signOutBodyUnsaved" : "confirm.signOutBody",
        )}
        confirmLabel={t("confirm.signOutConfirm")}
        tone="danger"
        onConfirm={signOut}
      />
    </>
  );
}
