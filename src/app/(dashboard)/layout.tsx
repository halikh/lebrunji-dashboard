import type { ReactNode } from 'react';

import { Wordmark } from '@/components/brand/wordmark';
import { SignOutButton } from '@/components/sign-out-button';
import { Rail } from '@/components/shell/rail';
import { t } from '@/i18n/translations';

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
    <div className="flex h-full flex-col md:flex-row">
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
        {t('nav.skipToContent')}
      </a>

      {/*
        A top bar on a phone only. The rail becomes a bottom bar there and
        carries the six sections; adding sign-out as a seventh would crowd them
        and put a destructive-ish action a thumb-width from Orders. So it moves
        up here, where the wordmark also does the job of saying which app this
        is on a screen too narrow for the rail to show it.
      */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-lg py-sm md:hidden">
        <Wordmark scale={0.4} />
        <SignOutButton />
      </header>

      <Rail />

      <main id="main" className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
