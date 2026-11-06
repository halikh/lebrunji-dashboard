"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Page, PageHeader, Tabs, cx } from "@/components/ui";
import { t } from "@/i18n/translations";

import { DeliveryTab } from "./delivery-tab";
import { RateTab } from "./rate-tab";

type TabKey = "delivery" | "rate";

/**
 * What every order costs to deliver, and what a price is worth in the second
 * currency. One page because they are the same errand — a merchant setting up,
 * or reacting to a currency that moved — and `delivery_quote` reads both.
 *
 * Delivery first: it is what this page is visited for most. The tab lives in
 * the URL (`?tab=rate`), replaced rather than pushed.
 */
export function PricingScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: TabKey = params.get("tab") === "rate" ? "rate" : "delivery";

  function show(next: TabKey) {
    const query = new URLSearchParams(params);
    if (next === "delivery") query.delete("tab");
    else query.set("tab", next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  return (
    <Page>
      <PageHeader
        title={t("pricing.title")}
        description={t("pricing.description")}
      />
      <Tabs
        items={[
          { key: "delivery" as const, label: t("pricing.tabDelivery") },
          { key: "rate" as const, label: t("pricing.tabRate") },
        ]}
        value={tab}
        onChange={show}
      />
      {/* Siblings rather than one swapped child, so an unsaved ladder survives
          a look at the rate and back — the edits are local until Save, and
          unmounting would throw them away without saying so. That is also why
          switching tabs does not ask: nothing is lost by it. */}
      <div className={cx(tab !== "delivery" && "hidden")}>
        <DeliveryTab />
      </div>
      <div className={cx(tab !== "rate" && "hidden")}>
        <RateTab />
      </div>
    </Page>
  );
}
