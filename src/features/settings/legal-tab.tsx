"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, FileText, Plus, SearchX } from "lucide-react";
import { useState } from "react";

import {
  Button,
  EmptyState,
  ListSkeleton,
  SearchInput,
  Section,
  Segmented,
  cx,
} from "@/components/ui";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { applyOrder } from "@/features/catalog/api/menu";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";

import { POLICY_DOCUMENTS, type PolicyDocument } from "./api/content";
import { RowMenu } from "./content-rows";
import { useReturnFocus } from "./settings-parts";
import {
  useDeletePolicySection,
  usePolicySections,
  useReorderPolicySections,
} from "./use-content";

/** Which policy is on screen, out of `?doc=` — the editors return to it. */
export function useDocumentParam(): PolicyDocument {
  return useSearchParams().get("doc") === "terms" ? "terms" : "privacy";
}

/**
 * Privacy and terms, section by section.
 *
 * A legal document is read in order, so the order *is* content: dragging a
 * section rewrites the document. Search turns reordering off, as on Help.
 */
export function LegalTab() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const document = useDocumentParam();

  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const sections = usePolicySections(document, searching ? search : "");
  const remove = useDeletePolicySection(document);
  const reorder = useReorderPolicySections(document);

  const rows = sections.data ?? [];
  const focus = useReturnFocus(sections.isSuccess);

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const { updates } = applyOrder(rows, ids);
      reorder.mutate({ updates });
    },
    labelOf: (id) =>
      pickLocalized(rows.find((row) => row.id === id)?.title ?? {}),
    disabled: searching,
  });

  function showDocument(next: PolicyDocument) {
    // A term that matched in privacy has no standing in terms, and the row
    // to return to belongs to the document being left.
    setSearch("");
    const query = new URLSearchParams(params);
    query.set("doc", next);
    query.delete("focus");
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  const count = rows.length;
  const newHref = `/settings/legal/new?doc=${document}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-medium text-ink-3">
          {t("content.documentLabel")}
        </span>
        <Segmented
          value={document}
          onChange={showDocument}
          items={POLICY_DOCUMENTS.map((one) => ({
            key: one,
            label: t(`content.document.${one}`),
          }))}
        />
      </div>

      <Section
        title={t(`content.document.${document}`)}
        actions={
          <Button asChild variant="primary">
            <Link href={newHref}>
              <Plus />
              {t("content.addSection")}
            </Link>
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-col gap-1.5 border-b border-line px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("content.searchLegal")}
              className="w-full sm:max-w-sm"
            />
            {sections.isSuccess && count > 0 && (
              <span className="text-[12.5px] text-ink-3 tabular-nums sm:ms-auto">
                {count === 1
                  ? t("content.legalCountOne")
                  : t("content.legalCount", { count })}
              </span>
            )}
          </div>
          {order.sortable && (
            <p className="text-[12.5px] text-ink-4">
              {t("content.reorderHint")}
            </p>
          )}
        </div>

        {order.instructions}

        {sections.isPending && <ListSkeleton rows={4} />}

        {sections.isError && (
          <EmptyState
            icon={<AlertCircle />}
            title={t("content.failed")}
            action={
              <Button onClick={() => void sections.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        )}

        {sections.isSuccess &&
          count === 0 &&
          (searching ? (
            <EmptyState
              icon={<SearchX />}
              title={t("content.searchNone", { term: search.trim() })}
            />
          ) : (
            <EmptyState
              icon={<FileText />}
              title={t("content.legalEmptyTitle")}
              description={t("content.legalEmptyBody")}
              action={
                <Button asChild variant="primary">
                  <Link href={newHref}>
                    <Plus />
                    {t("content.addSection")}
                  </Link>
                </Button>
              }
            />
          ))}

        {count > 0 && (
          <ol className="divide-y divide-line">
            {order
              .ordered(rows, (row) => row.id)
              .map((section) => {
                const name = pickLocalized(section.title);
                const href = `/settings/legal/${section.id}?doc=${document}`;
                return (
                  <li
                    key={section.id}
                    {...order.rowProps(
                      section.id,
                      cx(
                        "relative flex items-center gap-3 bg-surface px-4 py-3 transition-colors hover:bg-subtle sm:px-5",
                        focus === section.id && "bg-accent-soft/60",
                      ),
                    )}
                  >
                    <button {...order.handleProps(section.id)}>
                      <GripIcon />
                    </button>

                    <Link
                      href={href}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm"
                    >
                      <span className="truncate text-[14px] font-medium text-ink">
                        {name}
                      </span>
                      {/* One line of the body, as a reminder of which section
                          this is. */}
                      <span className="truncate text-[12.5px] text-ink-3">
                        {pickLocalized(section.body)}
                      </span>
                    </Link>

                    <RowMenu
                      name={name}
                      onEdit={() => router.push(href)}
                      removeTitle={t("content.removeSectionTitle", { name })}
                      removeBody={t("content.removeSectionBody")}
                      onRemove={() =>
                        remove.mutateAsync({ id: section.id, name })
                      }
                    />
                  </li>
                );
              })}
          </ol>
        )}
      </Section>
    </div>
  );
}
