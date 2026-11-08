"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Tooltip, cx } from "@/components/ui";
import { t } from "@/i18n/translations";

import { AccountMenu } from "./account-menu";
import { NAV, SETTINGS_ITEM, activeItem, type NavItem } from "./nav";
import { SettingsMenu } from "./settings-menu";

/**
 * The navigation. Full (icons and labels) or collapsed (icons only, names in
 * tooltips) — which one, and how wide, is the shell's to decide: the person
 * drags the edge or presses the toggle. The phone drawer is always full.
 */
export function Sidebar({
  liveOrders,
  onOpenSearch,
  onNavigate,
  mobile,
  collapsed = false,
  width,
  onToggle,
}: {
  liveOrders: number;
  onOpenSearch: () => void;
  /** Called after a link is followed — the mobile drawer closes on it. */
  onNavigate?: () => void;
  mobile?: boolean;
  collapsed?: boolean;
  /** Pixels; the drawer and the server render use the default. */
  width?: number;
  onToggle?: () => void;
}) {
  const pathname = usePathname();
  const active = activeItem(pathname);

  return (
    <nav
      aria-label={t("nav.label")}
      style={{ width: width ?? 248 }}
      className={cx(
        "flex h-full flex-col bg-surface",
        !mobile && "border-e border-line",
      )}
    >
      <div
        className={cx(
          "relative flex h-16 shrink-0 items-center justify-center",
          collapsed ? "px-2" : "px-10",
        )}
      >
        <Link href="/" onClick={onNavigate} className="flex items-center">
          {collapsed ? (
            // No room for the wordmark: the mark alone.
            <Image
              src="/favicon.svg"
              alt="LebRunji"
              width={30}
              height={30}
              priority
            />
          ) : (
            <Logo variant="wide" width={64} priority />
          )}
        </Link>
        {onToggle && !collapsed && (
          <ToggleButton collapsed={false} onToggle={onToggle} />
        )}
      </div>
      {/* Collapsed, the header has no room beside the mark, so the toggle sits
          directly under it — still at the top, where the person last saw it. */}
      {onToggle && collapsed && (
        <div className="shrink-0 px-3 pb-2">
          <ToggleButton collapsed onToggle={onToggle} />
        </div>
      )}

      <div className="shrink-0 px-3 pb-2">
        <Tooltip
          content={collapsed ? t("shell.searchShort") : null}
          side="right"
        >
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={t("shell.searchShort")}
            className={cx(
              "flex h-9 w-full items-center gap-2 rounded-md border border-line bg-subtle text-[13.5px] text-ink-4 transition-colors hover:border-line-strong hover:text-ink-3",
              collapsed ? "justify-center" : "px-2.5",
            )}
          >
            <Search className="size-4 shrink-0" />
            {!collapsed && (
              <span className="flex-1 truncate text-start">
                {t("shell.searchShort")}
              </span>
            )}
          </button>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
        {NAV.map((group) => (
          <div key={group.labelKey} className="pt-4 first:pt-2">
            {collapsed ? (
              <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line" />
            ) : (
              <p className="truncate px-2.5 pb-1.5 text-[11.5px] font-medium tracking-wide text-ink-4 uppercase">
                {t(group.labelKey)}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink
                    item={item}
                    active={active?.href === item.href}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                    badge={item.href === "/orders" ? liveOrders : undefined}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-0.5 border-t border-line p-3">
        <SettingsMenu
          active={active?.href === SETTINGS_ITEM.href}
          collapsed={collapsed}
          mobile={mobile}
          onNavigate={onNavigate}
        />
        <AccountMenu collapsed={collapsed} />
      </div>
    </nav>
  );
}

function ToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const label = t(collapsed ? "shell.expand" : "shell.collapse");
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <Tooltip content={label} side="right">
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        className={cx(
          "flex items-center justify-center rounded-md text-ink-4 hover:bg-hover hover:text-ink",
          collapsed ? "h-9 w-full" : "absolute end-3 size-7",
        )}
      >
        <Icon className="size-4 rtl:rotate-180" />
      </button>
    </Tooltip>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const label = t(item.labelKey);
  return (
    <Tooltip content={collapsed ? label : null} side="right">
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
        className={cx(
          "relative flex h-9 items-center gap-2.5 rounded-md text-[14px] font-medium transition-colors",
          collapsed ? "justify-center" : "px-2.5",
          active
            ? "bg-accent-soft text-accent-ink"
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
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {badge != null && badge > 0 && (
          <span
            aria-label={`${badge} ${t("nav.liveOrders")}`}
            className={cx(
              "flex h-5 min-w-5 items-center justify-center rounded-full bg-status-ordered-fill px-1.5 text-[11.5px] font-semibold text-white tabular-nums",
              collapsed &&
                "absolute -end-1 -top-1 h-4 min-w-4 px-1 text-[10px]",
            )}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
    </Tooltip>
  );
}
