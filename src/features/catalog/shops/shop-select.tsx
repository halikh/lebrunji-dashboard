"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  AsyncMultiSelect,
  AsyncSelect,
  type SelectOption,
} from "@/components/ui/select";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import {
  fetchStoreOptions,
  searchStoreOptions,
  type StoreOption,
} from "../api/stores";
import { storeKeys } from "../use-stores";

/**
 * Choosing a shop, or several — searched on the server as the operator types
 * (`AsyncSelect`), rather than every shop fetched up front to fill a list.
 *
 * The form keeps ids, as it always has; these turn ids into names. A search
 * is cached under the stores' own query key, so an edit to a shop (which
 * invalidates `["stores"]`) is what the next search shows.
 */

function toOption(shop: StoreOption): SelectOption {
  return { value: shop.id, label: pickLocalized(shop.name) };
}

function useShopLoaders() {
  const queryClient = useQueryClient();
  const search = async (input: string) => {
    const term = input.trim();
    const shops = await queryClient.fetchQuery({
      queryKey: [...storeKeys.all, "options", term],
      queryFn: () => searchStoreOptions(term),
      staleTime: 30_000,
    });
    return shops.map(toOption);
  };
  const resolve = async (ids: readonly string[]) =>
    (await fetchStoreOptions(ids)).map(toOption);
  return { search, resolve };
}

function noShops(input: string) {
  return input
    ? t("controls.noShops", { term: input })
    : t("controls.noMatches");
}

export function ShopSelect({
  value,
  onChange,
  placeholder,
  disabled,
  isClearable,
  className,
  "aria-label": ariaLabel,
  ...wiring
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isClearable?: boolean;
  className?: string;
  "aria-label"?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}) {
  const { search, resolve } = useShopLoaders();
  return (
    <AsyncSelect
      {...wiring}
      value={value}
      onChange={(id) => onChange(id)}
      loadOptions={search}
      resolveOption={async (id) => (await resolve([id]))[0] ?? null}
      placeholder={placeholder ?? t("controls.pickShop")}
      disabled={disabled}
      isClearable={isClearable}
      noOptionsMessage={noShops}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

export function ShopMultiSelect({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  "aria-label": ariaLabel,
  ...wiring
}: {
  value: readonly string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}) {
  const { search, resolve } = useShopLoaders();
  const [known, setKnown] = useState<ReadonlyMap<string, SelectOption>>(
    () => new Map(),
  );

  // The saved shops' names, asked once for whichever the picker has not met.
  const asked = useRef(new Set<string>());
  const resolver = useRef(resolve);
  useEffect(() => {
    resolver.current = resolve;
  });
  // Render reads only state; which of these were already asked for is the
  // effect's business.
  const missingKey = value.filter((id) => !known.has(id)).join(",");
  useEffect(() => {
    if (!missingKey) return;
    const ids = missingKey.split(",").filter((id) => !asked.current.has(id));
    if (ids.length === 0) return;
    for (const id of ids) asked.current.add(id);
    resolver.current(ids).then(
      (found) =>
        setKnown((current) => {
          const next = new Map(current);
          for (const option of found) next.set(option.value, option);
          return next;
        }),
      () => {},
    );
  }, [missingKey]);

  const chosen = value.map(
    (id) => known.get(id) ?? { value: id, label: t("common.loading") },
  );

  return (
    <AsyncMultiSelect
      {...wiring}
      value={chosen}
      onChange={(next) => {
        setKnown((current) => {
          const map = new Map(current);
          for (const option of next) map.set(option.value, option);
          return map;
        });
        onChange(next.map((option) => option.value));
      }}
      loadOptions={search}
      placeholder={placeholder ?? t("controls.pickShops")}
      disabled={disabled}
      noOptionsMessage={noShops}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
