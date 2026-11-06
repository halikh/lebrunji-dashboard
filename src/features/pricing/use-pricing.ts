"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { currencyKeys } from "@/features/reference/use-currencies";
import { updateAppSettings } from "@/features/settings/api/app-settings";
import { appSettingsKey } from "@/features/settings/use-clock";
import { t } from "@/i18n/translations";

import {
  fetchLadder,
  fetchRates,
  saveLadder,
  setRate,
  type Band,
} from "./api/pricing";

export const pricingKeys = {
  ladder: ["pricing", "ladder"] as const,
  rates: ["pricing", "rates"] as const,
};

export function useLadder() {
  return useQuery({ queryKey: pricingKeys.ladder, queryFn: fetchLadder });
}

export function useSaveLadder() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (bands: Band[]) => saveLadder(bands),
    onSuccess: () => {
      toast.success(t("pricing.ladderSaved"));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
    onSettled: () => {
      // On failure as well as success. The write is several requests and not
      // atomic, so what actually landed is the only thing worth showing.
      void queryClient.invalidateQueries({ queryKey: pricingKeys.ladder });
    },
  });
}

export function useRates() {
  return useQuery({ queryKey: pricingKeys.rates, queryFn: fetchRates });
}

export function useSetRate() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (input: { code: string; rate: number }) =>
      setRate(input.code, input.rate),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: pricingKeys.rates });
      // Every price shown in a second currency anywhere in the dashboard is
      // derived from this number, so the cache that holds it has to go too —
      // otherwise the screen that just changed the rate goes on converting at
      // the old one.
      void queryClient.invalidateQueries({ queryKey: currencyKeys.all });
      toast.success(t("pricing.rateSaved", { code: input.code }));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

/**
 * What each shop past the first adds to a delivery (`app_settings.extra_store_fee`).
 *
 * Its own Save, not the ladder's. It is a different row in a different table,
 * and folding it into "Save the ladder" would make a ladder that fails half-way
 * also leave this unsaved without saying so.
 */
export function useSaveExtraStoreFee() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: (amount: number) =>
      updateAppSettings({ extraStoreFee: amount }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appSettingsKey });
      toast.success(t("pricing.extraSaved"));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}
