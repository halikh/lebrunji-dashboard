"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button, cx } from "@/components/ui";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { useRowFocus } from "@/components/ui/row-focus";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { ROW, ROW_ABOVE, ROW_TARGET } from "@/components/ui/row";
import { Select } from "@/components/ui/select";
import { SectionTab, tabArrowHandler } from "@/components/ui/tab";

import { useConfirmLeave } from "@/components/unsaved-changes";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import { SEARCH } from "@/lib/limits";

import { applyOrder } from "../catalog/api/menu";
import {
  POLICY_DOCUMENTS,
  type HelpTopic,
  type PolicyDocument,
  type PolicySection,
} from "./api/content";
import {
  useDeleteHelpTopic,
  useDeletePolicySection,
  useHelpTopics,
  usePolicySections,
  useReorderHelpTopics,
  useReorderPolicySections,
  useUpdateHelpTopic,
} from "./use-content";

/**
 * Settings — the writing the app does that nobody could edit.
 *
 * ## Why these sit together
 *
 * The help topics and the two legal documents are one errand: they are the
 * app's *prose*. Each is a short ordered list of localised text, visited
 * rarely, and neither is big enough to deserve a place on the rail.
 *
 * Order statuses and payment methods used to be edited here too. The status
 * path is now hardcoded — see `src/lib/order-status.ts` — and payment methods
 * are no longer the dashboard's to manage.
 *
 * `0016` moved all of this out of translation keys and into the database
 * **precisely so it could be edited**, and then nothing could edit it. This is
 * the screen that sentence was written for.
 *
 * ## Section tabs, not filter tabs
 *
 * These are chapters of one subject rather than buckets of one list — the same
 * distinction the store screen and the customer profile draw, and the reason
 * `SectionTab` exists separately from `FilterTab`.
 */

type TabKey = "help" | "legal";

const TABS: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: "help", labelKey: "content.tabHelp" },
  { key: "legal", labelKey: "content.tabLegal" },
];

export function SettingsScreen() {
  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const pathname = usePathname();
  const params = useSearchParams();

  const requested = params.get("tab");
  const tab: TabKey = TABS.some((one) => one.key === requested)
    ? (requested as TabKey)
    : "help";

  /**
   * Switching tabs unmounts whatever is in the current one, so it is a way out
   * of a form even though the URL barely moves. Guarded here rather than on each
   * tab button: there is one `show`, and every tab goes through it.
   */
  function show(next: TabKey) {
    void confirmLeave().then((leave) => {
      if (!leave) return;
      const query = new URLSearchParams(params);
      if (next === "help") query.delete("tab");
      else query.set("tab", next);
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    });
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 flex-col gap-sm border-b border-border bg-surface px-xxl pt-lg">
        <h1 className="text-[24px]">{t("content.title")}</h1>

        <div role="tablist" className="-mb-px flex gap-lg">
          {TABS.map(({ key, labelKey }) => (
            <SectionTab
              key={key}
              label={t(labelKey)}
              active={tab === key}
              onClick={() => show(key)}
              onKeyDown={tabArrowHandler(
                TABS.map((one) => one.key),
                tab,
                show,
              )}
            />
          ))}
        </div>
      </div>
      {/* Siblings rather than one swapped child, so a half-scrolled document
          survives a look at the FAQ and back. */}
      <div className={cx("min-h-0 flex-1", tab !== "help" && "hidden")}>
        <HelpTab />
      </div>
      <div className={cx("min-h-0 flex-1", tab !== "legal" && "hidden")}>
        <LegalTab />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

/**
 * The FAQ.
 *
 * ## The group name is edited on every row at once
 *
 * `group_name` is stored per topic and the app groups by `group_slug`, taking
 * the heading from whichever row it reads first. So renaming it on one topic
 * splits the group in two and which name shows depends on sort order — a bug
 * that looks like a caching problem. The form edits the group as a group.
 */
function HelpTab() {
  const router = useRouter();
  /**
   * The term, and the mode it puts the list in.
   *
   * Searching and reordering are different jobs on one list and cannot both be
   * on: a position among matches is not a position in the FAQ, so dragging
   * while filtered would write a `sort_order` nobody chose. The handles go away
   * and the list says why.
   */
  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const topics = useHelpTopics(searching ? search : "");
  const update = useUpdateHelpTopic();
  const remove = useDeleteHelpTopic();
  const reorder = useReorderHelpTopics();

  /** Which row to bring back into view — see `useRowFocus`. */
  const focus = useRowFocus();

  const rows = topics.data ?? [];

  const order = useReorder({
    ids: rows.map((row) => row.id),
    onReorder: (ids) => {
      const { updates } = applyOrder(rows, ids);
      reorder.mutate({ updates });
    },
    labelOf: (id) =>
      pickLocalized(rows.find((row) => row.id === id)?.question ?? {}),
    disabled: searching,
  });

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        {/* The same bar every list here carries: search on the right, the add
            button beside it. The header does not scroll, so this is the one
            copy of "add one" — no in-list button and no pinned bar, which were
            two more ways to reach an action that is now always visible. */}
        <div className="flex shrink-0 items-start gap-lg border-b border-border bg-surface px-xxl py-lg">
          {/* The field takes the slack. These two bars have no title to hold
              it — unlike the catalogue's, where the heading grows — so a fixed
              width left a stretch of empty white between the search and the
              button, which reads as something missing rather than as space. */}
          <div className="flex min-w-0 flex-grow flex-col gap-xxs">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("content.searchHelp")}
            />
            {/* Gone when there is nothing to sort — one row, or a filtered
                list. An instruction nobody can follow reads as a control that
                is broken. See `sortable` on `useReorder`. */}
            {order.sortable ? (
              <span className="ps-md text-[12px] text-text-faint">
                {t("content.reorderHint")}
              </span>
            ) : null}
          </div>
          <Button onClick={() => router.push("/settings/help/new")}>
            {t("content.addTopic")}
          </Button>
        </div>

        <div className="flex min-h-0 min-w-0 flex-grow flex-col gap-sm overflow-y-auto scroll-hint p-xxl">
          <p className="ps-md pb-sm text-[13px] text-text-soft">
            {t("content.helpBlurb")}
          </p>

          {topics.isPending && (
            <div aria-hidden className="flex flex-col gap-sm">
              {[0, 1, 2].map((one) => (
                <div
                  key={one}
                  className="h-[58px] rounded-md border border-border bg-surface opacity-60"
                />
              ))}
            </div>
          )}

          {topics.isError && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {t("content.failed")}
            </p>
          )}

          {order.instructions}

          {searching && rows.length === 0 && (
            <EmptyState
              titleKey="content.searchNone"
              params={{ term: search.trim() }}
              mood="lost"
            />
          )}

          {order
            .ordered(rows, (row) => row.id)
            .map((row) => (
              <HelpRow
                key={row.id}
                topic={row}
                open={focus.isFocused(row.id)}
                anchor={focus.attach(row.id)}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() => router.push(`/settings/help/${row.id}`)}
                onToggle={() => {
                  update.mutate({
                    id: row.id,
                    patch: { isActive: !row.isActive },
                  });
                }}
                onRemove={async () => {
                  await remove.mutateAsync({
                    id: row.id,
                    name: pickLocalized(row.question),
                  });
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

type ReorderProps = {
  rowProps: (
    id: string,
    className?: string,
  ) => { "data-reorder-id": string; className: string };
  handleProps: (id: string) => Record<string, unknown>;
};

function HelpRow({
  topic,
  open,
  anchor,
  rowProps,
  handleProps,
  onEdit,
  onToggle,
  onRemove,
}: {
  topic: HelpTopic;
  /** Whether this is the row just returned from. Draws the ring. */
  open: boolean;
  /** Scrolls this row back into view when it is the one returned to. */
  anchor: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => Promise<void>;
} & ReorderProps) {
  const name = pickLocalized(topic.question);

  const row = rowProps(
    topic.id,
    cx(
      ROW,
      !topic.isActive && "border-danger-wash bg-danger-wash/30",
      open &&
        "shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]",
      topic.isActive && !open && "border-border",
      topic.isActive && open && "border-active",
    ),
  );

  return (
    <div {...row} ref={anchor}>
      <button {...handleProps(topic.id)}>
        <GripIcon />
      </button>

      <button
        type="button"
        onClick={onEdit}
        // `ROW_TARGET` stretches this button's hit area over the whole row —
        // see `row.ts`. The row's own controls carry `ROW_ABOVE`.
        className={cx(
          ROW_TARGET,
          "flex min-w-0 flex-grow flex-col gap-xxs text-left",
        )}
      >
        <span className="truncate text-[15px] font-semibold">{name}</span>
        <span className="truncate text-[12px] text-text-faint">
          {pickLocalized(topic.groupName)}
        </span>
      </button>

      <ConfirmToggle
        on={topic.isActive}
        onChange={onToggle}
        labelOn={t("content.live")}
        labelOff={t("content.hidden")}
        params={{ name }}
        whenTurningOn={{
          titleKey: "content.showTitle",
          bodyKey: "content.showBody",
          confirmKey: "content.showConfirm",
        }}
        whenTurningOff={{
          titleKey: "content.hideTitle",
          bodyKey: "content.hideBody",
          confirmKey: "content.hideConfirm",
        }}
        className={cx(ROW_ABOVE, "w-[104px]")}
      />

      <ConfirmButton
        className={ROW_ABOVE}
        onConfirm={onRemove}
        titleKey="content.removeTopicTitle"
        // Says "cannot be undone" and means it: `help_topics` has no
        // `deleted_at`, so unlike every catalogue row this is a real delete.
        bodyKey="content.removeTopicBody"
        confirmKey="content.removeConfirm"
        params={{ name }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("content.remove")}
      </ConfirmButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legal
// ---------------------------------------------------------------------------

/**
 * Privacy and terms.
 *
 * A document editor with section reordering, not a table of rows — the flow
 * study's call, and the reason is that a legal document is *read in order*. The
 * order is the content, so dragging a section is the most consequential control
 * on the tab.
 */
function LegalTab() {
  const router = useRouter();
  const params = useSearchParams();

  /**
   * Which policy is on screen, seeded from the URL.
   *
   * The editor is a page now, and it comes back here by href — so it has to be
   * able to say *which* document it was editing, or returning from a terms
   * section would land on privacy and the row it asked to focus would not be in
   * the list. See `?doc=` in `policy-section-editor.tsx`.
   */
  const [document, setDocument] = useState<PolicyDocument>(
    params.get("doc") === "terms" ? "terms" : "privacy",
  );

  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const sections = usePolicySections(document, searching ? search : "");
  const remove = useDeletePolicySection(document);
  const reorder = useReorderPolicySections(document);

  /** Which row to bring back into view — see `useRowFocus`. */
  const focus = useRowFocus();

  const rows = sections.data ?? [];

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

  return (
    <div className="relative flex h-full">
      <div className="flex min-w-0 flex-grow flex-col">
        <div className="flex shrink-0 items-start gap-lg border-b border-border bg-surface px-xxl py-lg">
          <div className="w-[240px] shrink-0">
            <Select
              value={document}
              onChange={(next) => {
                setDocument(next as PolicyDocument);
                // The open section belongs to the document being left, and so
                // does the search — a term that matched in privacy has no
                // standing in terms.
                setSearch("");
              }}
              options={POLICY_DOCUMENTS.map((one) => ({
                value: one,
                label: t(`content.document.${one}`),
              }))}
            />
          </div>

          <div className="flex min-w-0 flex-grow flex-col gap-xxs">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("content.searchLegal")}
            />
            {/* Gone when there is nothing to sort — one row, or a filtered
                list. An instruction nobody can follow reads as a control that
                is broken. See `sortable` on `useReorder`. */}
            {order.sortable ? (
              <span className="ps-md text-[12px] text-text-faint">
                {t("content.reorderHint")}
              </span>
            ) : null}
          </div>

          <Button
            onClick={() => router.push(`/settings/legal/new?doc=${document}`)}
          >
            {t("content.addSection")}
          </Button>
        </div>

        <div className="flex min-h-0 min-w-0 flex-grow flex-col gap-sm overflow-y-auto scroll-hint p-xxl">
          <p className="ps-md pb-sm text-[13px] text-text-soft">
            {t("content.legalBlurb")}
          </p>

          {sections.isError && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {t("content.failed")}
            </p>
          )}

          {order.instructions}

          {searching && rows.length === 0 && (
            <EmptyState
              titleKey="content.searchNone"
              params={{ term: search.trim() }}
              mood="lost"
            />
          )}

          {order
            .ordered(rows, (row) => row.id)
            .map((row, index) => (
              <PolicyRow
                key={row.id}
                section={row}
                index={index}
                open={focus.isFocused(row.id)}
                anchor={focus.attach(row.id)}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() =>
                  router.push(`/settings/legal/${row.id}?doc=${document}`)
                }
                onRemove={async () => {
                  await remove.mutateAsync({
                    id: row.id,
                    name: pickLocalized(row.title),
                  });
                }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function PolicyRow({
  section,
  index,
  open,
  anchor,
  rowProps,
  handleProps,
  onEdit,
  onRemove,
}: {
  section: PolicySection;
  index: number;
  /** Whether this is the row just returned from. Draws the ring. */
  open: boolean;
  /** Scrolls this row back into view when it is the one returned to. */
  anchor: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onRemove: () => Promise<void>;
} & ReorderProps) {
  const name = pickLocalized(section.title);

  const row = rowProps(
    section.id,
    cx(
      ROW,
      open
        ? "border-active shadow-[0_0_0_1px_var(--color-active),0_0_0_4px_var(--color-active-wash)]"
        : "border-border",
    ),
  );

  return (
    <div {...row} ref={anchor}>
      <button {...handleProps(section.id)}>
        <GripIcon />
      </button>

      {/* The position, because in a legal document the order *is* content and
          "section 4" is how somebody refers to it out loud. */}
      <span
        aria-hidden
        className="w-[20px] shrink-0 tabular-nums text-[13px] text-text-faint"
      >
        {index + 1}
      </span>

      <button
        type="button"
        onClick={onEdit}
        // `ROW_TARGET` stretches this button's hit area over the whole row —
        // see `row.ts`. The row's own controls carry `ROW_ABOVE`.
        className={cx(
          ROW_TARGET,
          "flex min-w-0 flex-grow flex-col gap-xxs text-left",
        )}
      >
        <span className="truncate text-[15px] font-semibold">{name}</span>
        {/* One line of the body, as a reminder of which section this is — a
            policy body is paragraphs, so it is truncated hard rather than
            wrapped into a row three times the height of its neighbours. */}
        <span className="truncate text-[12px] text-text-faint">
          {pickLocalized(section.body)}
        </span>
      </button>

      <ConfirmButton
        className={ROW_ABOVE}
        onConfirm={onRemove}
        titleKey="content.removeSectionTitle"
        bodyKey="content.removeSectionBody"
        confirmKey="content.removeConfirm"
        params={{ name }}
        variant="danger"
        triggerVariant="danger"
        size="sm"
      >
        {t("content.remove")}
      </ConfirmButton>
    </div>
  );
}
