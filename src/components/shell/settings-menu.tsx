"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { cx } from "@/components/ui";
import {
  SETTINGS_GROUPS,
  settingsHref,
  settingsTabAt,
  type SettingsEntry,
} from "@/features/settings/sections";
import { t } from "@/i18n/translations";

import { SETTINGS_ITEM } from "./nav";

/** Long enough to cross the gap from the entry to the flyout. */
const CLOSE_DELAY_MS = 180;

/**
 * The sidebar's Settings entry, with the settings pages beside it.
 *
 * On a desk it is a flyout to the side, opened by hovering the entry or
 * clicking it, and closed a moment after the pointer leaves both. A click
 * keeps it open until a choice, a click elsewhere or Escape; the arrow keys
 * move through it as through any menu.
 *
 * In the phone drawer there is no hover, and a flyout would hang off the
 * screen, so the entry expands in place instead.
 *
 * The pages are links, so leaving a half-typed form through one is caught by
 * the unsaved-changes guard like any other link.
 */
export function SettingsMenu({
  active,
  collapsed,
  mobile,
  onNavigate,
}: {
  active: boolean;
  collapsed: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  if (mobile) return <Disclosure active={active} onNavigate={onNavigate} />;
  return <Flyout active={active} collapsed={collapsed} />;
}

function entryClass(here: boolean) {
  return cx(
    "flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium outline-none transition-colors",
    here
      ? "bg-accent-soft text-accent-ink"
      : "text-ink-2 hover:bg-hover hover:text-ink data-[highlighted]:bg-hover data-[highlighted]:text-ink",
  );
}

function EntryContent({
  entry,
  here,
}: {
  entry: SettingsEntry;
  here: boolean;
}) {
  const Icon = entry.icon;
  return (
    <>
      <Icon
        aria-hidden
        className={cx("size-4 shrink-0", here ? "text-accent" : "text-ink-4")}
      />
      {t(entry.labelKey)}
    </>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-0.5 text-[12px] font-medium text-ink-4">
      {children}
    </p>
  );
}

function Flyout({
  active,
  collapsed,
}: {
  active: boolean;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Opened by a click: the pointer leaving does not close it.
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  function scheduleClose() {
    cancelClose();
    if (pinned.current) return;
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }
  useEffect(() => cancelClose, []);

  function change(next: boolean) {
    if (!next) pinned.current = false;
    setOpen(next);
  }

  const label = t(SETTINGS_ITEM.labelKey);
  const Icon = SETTINGS_ITEM.icon;

  return (
    <DropdownMenu.Root open={open} onOpenChange={change} modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={collapsed ? label : undefined}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            cancelClose();
            setOpen(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") scheduleClose();
          }}
          // Radix toggles on pointerdown, which would shut the menu the hover
          // has just opened. The click below decides instead.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            cancelClose();
            if (open && pinned.current) {
              change(false);
            } else {
              pinned.current = true;
              setOpen(true);
            }
          }}
          className={cx(
            "relative flex h-9 w-full items-center gap-2.5 rounded-md text-[14px] font-medium transition-colors",
            collapsed ? "justify-center" : "px-2.5",
            active
              ? "bg-accent-soft text-accent-ink"
              : open
                ? "bg-hover text-ink"
                : "text-ink-2 hover:bg-hover hover:text-ink",
          )}
        >
          <Icon
            className={cx(
              "size-[18px] shrink-0",
              active ? "text-accent" : "text-ink-3",
            )}
            strokeWidth={1.9}
          />
          {!collapsed && (
            <>
              <span className="flex-1 truncate text-start">{label}</span>
              <ChevronRight
                aria-hidden
                className="size-4 text-ink-4 rtl:rotate-180"
              />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right"
          align="end"
          sideOffset={10}
          collisionPadding={8}
          onPointerEnter={cancelClose}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") scheduleClose();
          }}
          // Back to the entry would re-open it by hover; leave focus be.
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="z-50 flex min-w-56 flex-col gap-2.5 rounded-lg border border-line bg-surface p-1.5 shadow-lg animate-pop-in"
        >
          <DropdownMenu.Label className="px-2.5 pt-1 text-[13px] font-semibold text-ink">
            {label}
          </DropdownMenu.Label>
          <Suspense>
            <Groups
              render={(entry, here) => (
                <DropdownMenu.Item key={entry.key} asChild>
                  <Link
                    href={settingsHref(entry.key)}
                    aria-current={here ? "page" : undefined}
                    onClick={() => change(false)}
                    className={entryClass(here)}
                  >
                    <EntryContent entry={entry} here={here} />
                  </Link>
                </DropdownMenu.Item>
              )}
            />
          </Suspense>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Disclosure({
  active,
  onNavigate,
}: {
  active: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(active);
  const label = t(SETTINGS_ITEM.labelKey);
  const Icon = SETTINGS_ITEM.icon;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={cx(
          "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[14px] font-medium transition-colors",
          active
            ? "text-accent-ink"
            : "text-ink-2 hover:bg-hover hover:text-ink",
        )}
      >
        <Icon
          className={cx(
            "size-[18px] shrink-0",
            active ? "text-accent" : "text-ink-3",
          )}
          strokeWidth={1.9}
        />
        <span className="flex-1 truncate text-start">{label}</span>
        <ChevronDown
          aria-hidden
          className={cx(
            "size-4 text-ink-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2.5 ps-4 pb-1">
          <Suspense>
            <Groups
              render={(entry, here) => (
                <Link
                  key={entry.key}
                  href={settingsHref(entry.key)}
                  aria-current={here ? "page" : undefined}
                  onClick={onNavigate}
                  className={entryClass(here)}
                >
                  <EntryContent entry={entry} here={here} />
                </Link>
              )}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

/**
 * The groups and their pages. Under Suspense because it reads the query
 * string to mark the current page — and it renders only while open.
 */
function Groups({
  render,
}: {
  render: (entry: SettingsEntry, here: boolean) => ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = settingsTabAt(pathname, params.get("tab"));

  return SETTINGS_GROUPS.map((group) => (
    <div key={group.labelKey} className="flex flex-col gap-0.5">
      <GroupLabel>{t(group.labelKey)}</GroupLabel>
      {group.entries.map((entry) => render(entry, entry.key === current))}
    </div>
  ));
}
