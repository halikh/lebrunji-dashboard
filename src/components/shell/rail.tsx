"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { cx } from "@/components/ui";
import { t } from "@/i18n/translations";

import { Icon } from "./icons";
import { SECTIONS, activeSection } from "./nav";
import { railItemClass } from "./rail-item";

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
  const ref = useRef<HTMLElement>(null);

  // The bar scrolls on a phone (see below), so the section you are on may be
  // past the edge — and a nav whose current item is off screen is one that
  // does not say where you are. `nearest` is a no-op when it is already in
  // view, which is always on the desktop rail.
  useEffect(() => {
    ref.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav
      ref={ref}
      aria-label={t("nav.label")}
      className={cx(
        "flex shrink-0 gap-xs border-border bg-surface",
        // Bottom bar on a phone, left rail from `md` up. One component, because
        // two would be two things to keep in step.
        //
        // Eight sections at 360px is 45px each, and "Customers" at eleven
        // pixels is wider than that — so on the narrowest phones the bar
        // scrolls sideways (each item keeps a 64px minimum, in `railItemClass`)
        // rather than letting the labels run into each other. From about 520px
        // they all fit and it is an ordinary bar again.
        // No `justify-around`: the items grow to share the width themselves,
        // and once they overflow it would centre them and push the first
        // past the start edge, where a scroller cannot reach.
        "order-last w-full flex-row border-t px-xxs py-xs",
        "overflow-x-auto scrollbar-none",
        "md:order-first md:h-full md:w-[124px] md:flex-col md:justify-start md:border-r md:border-t-0 md:px-sm md:py-lg",
        // Never cut off. On a short window the spacing tightens (`short:`, in
        // the items too); on one shorter still the rail scrolls rather than
        // clipping account and sign-out. No visible scrollbar: in a 124px
        // rail it would take a tenth of the width, and the last item sitting
        // half under the edge already says there is more.
        "md:min-h-0 md:overflow-y-auto md:[scrollbar-width:none] short:gap-0 short:py-sm",
      )}
    >
      <div className="hidden md:mb-xl md:flex md:shrink-0 md:justify-center short:mb-sm">
        <Logo width={56} />
      </div>

      {SECTIONS.map((section) => {
        const isActive = active?.href === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            // The one place a screen reader needs more than the label: which
            // of these is where you already are.
            aria-current={isActive ? "page" : undefined}
            className={railItemClass({ active: isActive })}
          >
            <Icon name={section.icon} />
            {t(section.labelKey)}

            {section.href === "/" && liveOrders > 0 && (
              <span
                // The count is on the icon, but the meaning is in the label —
                // a bare "3" read aloud is not information.
                aria-label={`${liveOrders} ${t("nav.liveOrders")}`}
                // Sun, not red.
                //
                // Red is the palette's alarm, and orders waiting are not an
                // alarm — they are the ordinary state of a working shop. A
                // badge that is red all day is a badge that stops being read,
                // and it spends the one colour reserved for something being
                // wrong on something being normal.
                //
                // `on-yellow` is ink rather than white: sun is a light ground,
                // and white on it fails contrast at eleven pixels.
                className={cx(
                  "absolute right-[18px] top-[2px] min-w-[18px] rounded-full px-[5px]",
                  "bg-yellow text-center text-[11px] font-bold text-on-yellow",
                  "md:right-[36px] md:top-[6px]",
                )}
              >
                {liveOrders}
              </span>
            )}
          </Link>
        );
      })}

      {/* Below `md` the rail is a bottom bar and these two live in the top
          bar instead — another item there would crowd the sections and put
          sign-out a thumb-width from Orders. */}
      <div className="hidden w-full md:mt-auto md:block">
        {/* Account-level, like sign-out beneath it — not a seventh section.
            The rail's six are the business; these two are the operator. */}
        <Link
          href="/account"
          aria-current={pathname === "/account" ? "page" : undefined}
          className={railItemClass({ active: pathname === "/account" })}
        >
          <Icon name="customers" />
          {t("nav.account")}
        </Link>
        <SignOutButton />
      </div>
    </nav>
  );
}
