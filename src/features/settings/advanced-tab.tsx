"use client";

import { CustomerAppSection } from "./customer-app-section";
import { UnusedPicturesSection } from "./unused-pictures-section";

/**
 * The settings that are set once and then left alone.
 *
 * The oldest customer app still served, and clearing storage. Neither is
 * something a shop changes in the ordinary run of a week, and both can do real
 * damage when changed carelessly — a minimum version locks customers out, a
 * sweep deletes files — so they sit behind their own tab rather than under the
 * clock and the opening hours, where they used to be scrolled past every visit.
 *
 * Each section draws its own top rule, which the first one here does not need.
 * Done with `first:` rather than a prop because the customer-app section draws
 * nothing before its migration, and then the storage one is first.
 */
export function AdvancedTab() {
  return (
    <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto scroll-hint p-lg md:p-xxl [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0">
      <CustomerAppSection />
      <UnusedPicturesSection />
    </div>
  );
}
