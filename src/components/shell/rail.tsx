'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Wordmark } from '@/components/brand/wordmark';
import { SignOutButton } from '@/components/sign-out-button';
import { cx } from '@/components/ui';
import { t } from '@/i18n/translations';

import { Icon } from './icons';
import { SECTIONS, activeSection } from './nav';

/**
 * The rail.
 *
 * ## Why a rail and not a sidebar
 *
 * The operator spends almost the whole day on one screen — the order queue —
 * and visits the others occasionally, usually to fix one specific thing.
 * Navigation being rare is the argument: a wide sidebar would occupy a fifth of
 * the screen somebody stares at for eight hours, permanently, to serve a click
 * they make twice a day.
 *
 * What the rail *does* have to do all day is carry the live-order count, so
 * leaving the queue never means losing sight of it.
 *
 * ## Labels are not hidden behind hover
 *
 * Icon-only navigation that reveals its labels on hover is unusable from a
 * keyboard and hostile on a touch screen. The labels are always rendered; they
 * are simply small. On a narrow viewport the rail becomes a bottom bar, which
 * is the same trade the app already makes with its tab bar.
 */
export function Rail({ liveOrders = 0 }: { liveOrders?: number }) {
  const pathname = usePathname();
  const active = activeSection(pathname);

  return (
    <nav
      aria-label={t('nav.label')}
      className={cx(
        'flex shrink-0 gap-xs border-border bg-surface',
        // Bottom bar on a phone, left rail from `md` up. One component, because
        // two would be two things to keep in step.
        'order-last w-full flex-row justify-around border-t px-sm py-xs',
        'md:order-first md:h-full md:w-[124px] md:flex-col md:justify-start md:border-r md:border-t-0 md:px-sm md:py-lg',
      )}
    >
      <div className="hidden md:mb-xl md:flex md:justify-center">
        <Wordmark scale={0.58} />
      </div>

      {SECTIONS.map((section) => {
        const isActive = active?.href === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            // The one place a screen reader needs more than the label: which
            // of these is where you already are.
            aria-current={isActive ? 'page' : undefined}
            className={cx(
              'relative flex flex-1 flex-col items-center gap-xxs rounded-md px-xs py-sm',
              'text-[11px] font-semibold md:flex-none md:py-md md:text-[12px]',
              isActive ? 'bg-active-wash text-active-ink' : 'text-text-soft hover:bg-neutral-fill',
            )}
          >
            <Icon name={section.icon} />
            {t(section.labelKey)}

            {section.href === '/' && liveOrders > 0 && (
              <span
                // The count is on the icon, but the meaning is in the label —
                // a bare "3" read aloud is not information.
                aria-label={`${liveOrders} ${t('nav.liveOrders')}`}
                className={cx(
                  'absolute right-[18px] top-[2px] min-w-[18px] rounded-full px-[5px]',
                  'bg-danger-action text-center text-[11px] font-bold text-on-active',
                  'md:right-[36px] md:top-[6px]',
                )}
              >
                {liveOrders}
              </span>
            )}
          </Link>
        );
      })}

      <div className="hidden md:mt-auto md:block">
        <SignOutButton />
      </div>
    </nav>
  );
}
