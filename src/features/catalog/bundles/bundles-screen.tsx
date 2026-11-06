"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { Button, Page, PageHeader } from "@/components/ui";
import { Select } from "@/components/ui/select";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import { useStores } from "../use-stores";
import { BundlesList } from "./bundles-list";

/**
 * Every shop's bundles, with a shop filter in the URL (`?shop=`) so a
 * narrowed view can be shared or reloaded. Each shop's page has the same list
 * on its Bundles tab.
 */
export function BundlesScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const shop = params.get("shop") ?? "";
  const stores = useStores("");

  const setShop = (next: string) =>
    router.replace(next ? `${pathname}?shop=${next}` : pathname, {
      scroll: false,
    });

  return (
    <Page>
      <PageHeader
        title={t("bundles.tab")}
        description={t("bundles.intro")}
        actions={
          <Button variant="primary" asChild>
            <Link href={shop ? `/bundles/new?shop=${shop}` : "/bundles/new"}>
              <Plus />
              {t("bundles.add")}
            </Link>
          </Button>
        }
      />
      <BundlesList
        key={shop}
        storeId={shop}
        toolbarEnd={
          <Select
            value={shop}
            onChange={setShop}
            isClearable
            placeholder={t("bundles.allShops")}
            aria-label={t("bundles.filterShop")}
            options={(stores.data?.stores ?? []).map((store) => ({
              value: store.id,
              label: pickLocalized(store.name),
            }))}
            disabled={!stores.isSuccess}
            className="w-full sm:w-64"
          />
        }
      />
    </Page>
  );
}
