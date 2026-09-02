"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { t } from "@/i18n/translations";

import {
  setCourierActive,
  createCourier,
  fetchCourier,
  fetchCouriers,
  fetchDispatches,
  recordDispatch,
  updateCourier,
  type CourierDraft,
} from "./api/couriers";

export const courierKeys = {
  all: ["couriers"] as const,
  list: (search: string) => ["couriers", "list", search] as const,
  one: (id: string) => ["couriers", id] as const,
  dispatches: (id: string) => ["couriers", id, "dispatches"] as const,
};

/**
 * The drivers.
 *
 * Cached hard, like the rest of this screen: an address book of a handful of
 * people, edited when somebody joins or leaves. It is also read by the order
 * queue — the dispatch button needs the list — so it is here rather than in the
 * settings feature's own private state, and one fetch serves both screens.
 */
export function useCouriers(search = "") {
  return useQuery({
    queryKey: courierKeys.list(search),
    queryFn: () => fetchCouriers(search),
    staleTime: 5 * 60_000,
    // The list stays on screen while the next answer is fetched, so typing does
    // not blink it empty between keystrokes.
    placeholderData: (previous) => previous,
  });
}

/** One driver, for their own page. */
export function useCourier(id: string) {
  return useQuery({
    queryKey: courierKeys.one(id),
    queryFn: () => fetchCourier(id),
    staleTime: 5 * 60_000,
  });
}

/**
 * What this driver has been handed.
 *
 * Shorter staleness than the driver themselves: the name and number change
 * when somebody edits them, and this changes every time an order goes out.
 */
export function useDispatches(courierId: string) {
  return useQuery({
    queryKey: courierKeys.dispatches(courierId),
    queryFn: () => fetchDispatches(courierId),
    staleTime: 30_000,
  });
}

/**
 * Records a hand-off.
 *
 * No toast on success — the operator is already looking at a WhatsApp window
 * opening, which is a louder confirmation than anything this could show. And
 * none on failure either: see `recordDispatch`. Losing the record is bad;
 * interrupting a dispatch to say so is worse.
 */
export function useRecordDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      courierId,
    }: {
      orderId: string;
      courierId: string;
    }) => recordDispatch(orderId, courierId),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: courierKeys.dispatches(variables.courierId),
      });
    },
  });
}

export function useSaveCourier() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: async ({
      id,
      draft,
    }: {
      id: string | null;
      draft: CourierDraft;
      /** Said in the confirmation, from what was typed rather than refetched. */
      name: string;
    }): Promise<void> => {
      // The created row is discarded on purpose: the list refetches, and a
      // half-updated cache written from one insert is how a screen ends up
      // showing a row the database sorted somewhere else.
      if (id) await updateCourier(id, draft);
      else await createCourier(draft);
    },

    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: courierKeys.all });
      toast.success(
        t(variables.id ? "drivers.saved" : "drivers.added", {
          name: variables.name,
        }),
      );
    },
    onError: (error) => toast.danger(reason(error)),
  });
}

export function useSetCourierActive() {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: ({
      id,
      active,
    }: {
      id: string;
      active: boolean;
      name: string;
    }) => setCourierActive(id, active),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: courierKeys.all });
      toast.success(
        t(variables.active ? "drivers.reactivated" : "drivers.deactivated", {
          name: variables.name,
        }),
      );
    },
    onError: (error) => toast.danger(reason(error)),
  });
}

/**
 * What went wrong, in terms the operator can act on.
 *
 * The one failure they can actually cause is a number already on the books —
 * `couriers_phone_live_idx`. A raw PostgREST message names the index, which
 * says nothing about what to do; every other failure keeps its own text, since
 * inventing a friendlier sentence for something unpredicted would sound
 * confident about something not understood.
 */
function reason(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("couriers_phone_live_idx")) {
    return t("drivers.duplicatePhone");
  }
  if (message.includes("couriers_phone_shape")) {
    return t("drivers.badPhone");
  }
  return message || t("common.somethingWentWrong");
}
