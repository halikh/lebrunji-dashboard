"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToasts } from "@/components/ui/toast";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

import {
  createHelpTopic,
  createPolicySection,
  deleteHelpTopic,
  deletePolicySection,
  fetchHelpTopics,
  fetchOrderStatusContent,
  fetchPaymentMethods,
  fetchPolicySections,
  renameHelpGroup,
  setContentOrder,
  updateHelpTopic,
  updateOrderStatusContent,
  updatePaymentMethod,
  updatePolicySection,
  type HelpTopicDraft,
  type HelpTopicPatch,
  type PolicyDocument,
  type PolicySectionDraft,
} from "./api/content";

export const contentKeys = {
  help: ["content", "help"] as const,
  helpList: (search: string) => ["content", "help", search] as const,
  policy: (document: PolicyDocument) =>
    ["content", "policy", document] as const,
  policyList: (document: PolicyDocument, search: string) =>
    ["content", "policy", document, search] as const,
  payments: ["content", "payments"] as const,
  statuses: ["content", "statuses"] as const,
};

/**
 * All four reads are cached hard.
 *
 * This is content somebody writes once and revisits when it is wrong. A stale
 * FAQ for a minute is not a failure; refetching it on every focus would be.
 */
const SETTLED = { staleTime: 5 * 60_000 };

export function useHelpTopics(search = "") {
  const term = search.trim();

  return useQuery({
    queryKey: contentKeys.helpList(term),
    queryFn: () => fetchHelpTopics(term),
    ...SETTLED,
    // The rows on screen stay while the next ones are fetched, so typing does
    // not blink the list empty between keystrokes.
    placeholderData: (previous) => previous,
  });
}

export function usePolicySections(document: PolicyDocument, search = "") {
  const term = search.trim();

  return useQuery({
    queryKey: contentKeys.policyList(document, term),
    queryFn: () => fetchPolicySections(document, term),
    ...SETTLED,
    placeholderData: (previous) => previous,
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: contentKeys.payments,
    queryFn: fetchPaymentMethods,
    ...SETTLED,
  });
}

export function useOrderStatusContent() {
  return useQuery({
    queryKey: contentKeys.statuses,
    queryFn: fetchOrderStatusContent,
    ...SETTLED,
  });
}

/**
 * One mutation shape for the whole screen.
 *
 * Every write here is "save this and refetch that list" with a toast naming
 * what changed. Four near-identical hooks would be four places for the
 * invalidation key to drift from the query key, which is the bug that shows up
 * as a screen that saves and does not update.
 */
function useContentMutation<TInput extends { name?: string }>(
  run: (input: TInput) => Promise<unknown>,
  key: readonly unknown[],
  messageKey: "content.saved" | "content.added" | "content.removed",
) {
  const queryClient = useQueryClient();
  const toast = useToasts();

  return useMutation({
    mutationFn: run,
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: key });
      if (input.name) toast.success(t(messageKey, { name: input.name }));
    },
    onError: (error) => {
      toast.danger(
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    },
  });
}

// ---- help ------------------------------------------------------------------

export function useCreateHelpTopic() {
  return useContentMutation<{
    draft: HelpTopicDraft;
    sortOrder: number;
    name: string;
  }>(
    (input) => createHelpTopic(input.draft, input.sortOrder),
    contentKeys.help,
    "content.added",
  );
}

export function useUpdateHelpTopic() {
  return useContentMutation<{
    id: string;
    patch: HelpTopicPatch;
    name?: string;
  }>(
    (input) => updateHelpTopic(input.id, input.patch),
    contentKeys.help,
    "content.saved",
  );
}

export function useRenameHelpGroup() {
  return useContentMutation<{
    groupSlug: string;
    groupName: Localized;
    name: string;
  }>(
    (input) => renameHelpGroup(input.groupSlug, input.groupName),
    contentKeys.help,
    "content.saved",
  );
}

export function useDeleteHelpTopic() {
  return useContentMutation<{ id: string; name: string }>(
    (input) => deleteHelpTopic(input.id),
    contentKeys.help,
    "content.removed",
  );
}

export function useReorderHelpTopics() {
  return useContentMutation<{
    updates: { id: string; sortOrder: number }[];
    /** Never set: a reorder announces itself by the list moving. */
    name?: string;
  }>(
    (input) => setContentOrder("help_topics", input.updates),
    contentKeys.help,
    "content.saved",
  );
}

// ---- policy ----------------------------------------------------------------

export function useCreatePolicySection(document: PolicyDocument) {
  return useContentMutation<{
    draft: PolicySectionDraft;
    sortOrder: number;
    name: string;
  }>(
    (input) => createPolicySection(input.draft, input.sortOrder),
    contentKeys.policy(document),
    "content.added",
  );
}

export function useUpdatePolicySection(document: PolicyDocument) {
  return useContentMutation<{
    id: string;
    patch: Partial<Omit<PolicySectionDraft, "document">> & {
      sortOrder?: number;
    };
    name?: string;
  }>(
    (input) => updatePolicySection(input.id, input.patch),
    contentKeys.policy(document),
    "content.saved",
  );
}

export function useDeletePolicySection(document: PolicyDocument) {
  return useContentMutation<{ id: string; name: string }>(
    (input) => deletePolicySection(input.id),
    contentKeys.policy(document),
    "content.removed",
  );
}

export function useReorderPolicySections(document: PolicyDocument) {
  return useContentMutation<{
    updates: { id: string; sortOrder: number }[];
    /** Never set: a reorder announces itself by the list moving. */
    name?: string;
  }>(
    (input) => setContentOrder("policy_sections", input.updates),
    contentKeys.policy(document),
    "content.saved",
  );
}

// ---- reference -------------------------------------------------------------

export function useUpdatePaymentMethod() {
  return useContentMutation<{
    id: string;
    patch: { name?: Localized; detail?: Localized; isEnabled?: boolean };
    name?: string;
  }>(
    (input) => updatePaymentMethod(input.id, input.patch),
    contentKeys.payments,
    "content.saved",
  );
}

export function useUpdateOrderStatusContent() {
  const queryClient = useQueryClient();

  return useContentMutation<{
    id: string;
    patch: {
      name?: Localized;
      timelineTitle?: Localized;
      timelineDetail?: Localized;
    };
    name?: string;
  }>(
    async (input) => {
      await updateOrderStatusContent(input.id, input.patch);
      // The queue draws its tabs from these names, so a rename here has to
      // reach a screen this one does not own.
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    contentKeys.statuses,
    "content.saved",
  );
}

/** The name a toast should use for a localised row. */
export function nameOf(value: Localized): string {
  return pickLocalized(value);
}
