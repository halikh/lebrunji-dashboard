"use client";

import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Menu as MenuIcon, Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useUndoLast } from "@/components/ui";
import { ResizeHandle, useStoredWidth } from "@/components/ui/resizable";
import { useOrderRealtime } from "@/features/orders/use-order-realtime";
import { useLiveOrderCount } from "@/features/orders/use-orders";
import { t } from "@/i18n/translations";

import { CommandPalette } from "./command-palette";
import { EnvBanner } from "./env-banner";
import { Sidebar } from "./sidebar";
import { SoundLock } from "./sound-lock";

const SIDEBAR = {
  collapsed: 68,
  /** Below this the labels no longer fit; it folds instead. */
  snap: 150,
  min: 200,
  default: 248,
  max: 360,
};

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Sidebar, search and the content area. Mounted once for every signed-in
 * route, so the live-order subscription and its badge survive navigation.
 */
export function AppShell({ children }: { children: ReactNode }) {
  useOrderRealtime();
  const live = useLiveOrderCount();
  const undoLast = useUndoLast();
  const pathname = usePathname();

  const [palette, setPalette] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useStoredWidth(
    "lebrunji-admin:sidebar-width",
    SIDEBAR.default,
  );
  const collapsed = sidebarWidth < SIDEBAR.min;

  // Dragged under the snap point it folds to icons; dragged back past it, it
  // opens at the narrowest full width — never a half-width with clipped labels.
  function resizeSidebar(next: number) {
    if (next < SIDEBAR.snap) setSidebarWidth(SIDEBAR.collapsed);
    else setSidebarWidth(Math.min(SIDEBAR.max, Math.max(SIDEBAR.min, next)));
  }
  // The drawer remembers which page it was opened on, so following any link
  // (or Back) closes it without an effect.
  const [drawerOn, setDrawerOn] = useState<string | null>(null);
  const drawer = drawerOn === pathname;
  const setDrawer = (open: boolean) => setDrawerOn(open ? pathname : null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // ⌘Z undoes the last undoable action. Search has no shortcut; it opens
      // from the sidebar.
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.shiftKey && event.key.toLowerCase() === "z") {
        if (isTyping(event.target)) return;
        if (undoLast()) event.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoLast]);

  const liveOrders = live.data ?? 0;

  return (
    <div data-app-shell className="flex h-dvh flex-col overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:font-medium focus:shadow-md"
      >
        {t("nav.skipToContent")}
      </a>
      <EnvBanner />

      <div className="flex min-h-0 flex-1">
        <div className="relative hidden shrink-0 lg:block">
          <Sidebar
            liveOrders={liveOrders}
            onOpenSearch={() => setPalette(true)}
            width={sidebarWidth}
            collapsed={collapsed}
            onToggle={() =>
              setSidebarWidth(collapsed ? SIDEBAR.default : SIDEBAR.collapsed)
            }
          />
          <ResizeHandle
            edge="end"
            width={sidebarWidth}
            min={SIDEBAR.collapsed}
            max={SIDEBAR.max}
            onResize={resizeSidebar}
            onReset={() => setSidebarWidth(SIDEBAR.default)}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Below `lg` the sidebar becomes a drawer behind this bar. */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label={t("shell.openMenu")}
              className="relative flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-hover"
            >
              <MenuIcon className="size-5" />
              {liveOrders > 0 && (
                <span className="absolute end-1 top-1 size-2 rounded-full bg-status-ordered ring-2 ring-surface" />
              )}
            </button>
            <Link href="/" className="flex items-center gap-2">
              <Logo variant="wide" width={50} />
            </Link>
            <button
              type="button"
              onClick={() => setPalette(true)}
              aria-label={t("shell.searchShort")}
              className="ms-auto flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-hover"
            >
              <Search className="size-5" />
            </button>
          </header>

          <SoundLock />

          <main id="main" className="min-h-0 flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>

      <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/30 animate-fade-in lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 start-0 z-40 shadow-lg focus:outline-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">
              {t("nav.label")}
            </DialogPrimitive.Title>
            <Sidebar
              mobile
              liveOrders={liveOrders}
              onOpenSearch={() => {
                setDrawer(false);
                setPalette(true);
              }}
              onNavigate={() => setDrawer(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}
