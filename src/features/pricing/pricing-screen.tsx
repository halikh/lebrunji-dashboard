"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Page, PageHeader, Tabs, cx } from "@/components/ui";
import { t } from "@/i18n/translations";

import { DeliveryTab, ExtraShopTab } from "./delivery-tab";
import { RateTab } from "./rate-tab";

const TABS = ["delivery", "extra", "rate"] as const;
type TabKey = (typeof TABS)[number];

/**
 * What every order costs to deliver, and what a price is worth in the second
 * currency. One page because they are the same errand — a merchant setting up,
 * or reacting to a currency that moved — and `delivery_quote` reads both.
 *
 * One form per tab: the delivery ladder, the extra-shop fee, the exchange
 * rate. The rules they add up to are read-only, so they sit on the Delivery
 * tab under the ladder rather than on a tab of their own. Delivery first: it
 * is what this page is visited for most. The tab lives in the URL
 * (`?tab=extra`, `?tab=rate`), replaced rather than pushed.
 */
export function PricingScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("tab");
  const tab: TabKey = TABS.find((key) => key === requested) ?? "delivery";

  // The extra-shop fee as edited, held here rather than in its tab: the
  // Delivery tab's preview prices a several-shop order with it before Save.
  // Null means untouched, so a fee merely looked at is not unsaved work.
  const [extraDraft, setExtraDraft] = useState<number | null>(null);

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
          { key: "extra" as const, label: t("pricing.tabExtra") },
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
        <DeliveryTab extraDraft={extraDraft} />
      </div>
      <div className={cx("max-w-3xl", tab !== "extra" && "hidden")}>
        <ExtraShopTab extraDraft={extraDraft} onExtraChange={setExtraDraft} />
      </div>
      <div className={cx(tab !== "rate" && "hidden")}>
        <RateTab />
      </div>
    </Page>
  );
}
