import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { SignOutButton } from "@/components/sign-out-button";
import { Rail } from "@/components/shell/rail";
import { Providers } from "@/app/providers";
import { t } from "@/i18n/translations";

/**
 * The shell every signed-in screen renders inside.
 *
 * A route group, so it wraps the dashboard without adding a path segment — the
 * queue stays at `/`, which is the point: signing in lands on live orders.
 *
 * ## Work opens over the queue, not instead of it
 *
 * The rail persists across every route, so a new order arriving while somebody
 * is editing a menu still shows up in the badge. That is the whole reason the
 * layout exists rather than each page drawing its own chrome.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      {/*
        `h-dvh` and `overflow-hidden`, not `h-full`.

        `h-full` is `height: 100%`, which resolves against the body — and the
        body is `min-h-full`, a *minimum*. A percentage against a minimum is
        the kind of thing that lands a pixel or two out, and the symptom is two
        scrollbars: the window scrolling a hair, and the content area scrolling
        properly inside it. `h-dvh` measures the viewport itself and asks no
        ancestor anything, and `overflow-hidden` says out loud that scrolling
        in the dashboard belongs to the panes, not to the page.

        The dynamic unit also handles a phone's address bar sliding away, which
        `100vh` famously does not.
      */}
      <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
        {/*
        First in the DOM and visually hidden until focused. Without it, reaching
        the content from the keyboard means tabbing through every section link
        on every page load — which is exactly the operator this dashboard is
        supposed to be fast for.
      */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:m-sm focus:rounded-md focus:bg-surface focus:px-lg focus:py-md focus:font-semibold"
        >
          {t("nav.skipToContent")}
        </a>

        {/*
        A top bar on a phone only. The rail becomes a bottom bar there and
        carries the six sections; adding sign-out as a seventh would crowd them
        and put a destructive-ish action a thumb-width from Orders. So it moves
        up here, where the wordmark also does the job of saying which app this
        is on a screen too narrow for the rail to show it.
      */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-lg py-sm md:hidden">
          <Wordmark scale={0.5} />
          <SignOutButton />
        </header>

        <Rail />

        {/*
          `min-h-0` is what makes the inner scroll areas work.

          A flex item's `min-height` defaults to `auto`, which means "never
          smaller than my content" — so this would grow to fit the whole queue
          instead of bounding it, the scrolling would happen on the page, and
          the screen chrome would slide away with it.
        */}
        <main id="main" className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </Providers>
  );
}
