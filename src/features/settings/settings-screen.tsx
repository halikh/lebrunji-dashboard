"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Button, cx } from "@/components/ui";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmToggle } from "@/components/ui/confirm-toggle";
import { Field } from "@/components/ui/field";
import { LocalizedField } from "@/components/ui/localized-field";
import { Panel } from "@/components/ui/panel";
import { PanelHeader } from "@/components/ui/panel-header";
import { GripIcon, useReorder } from "@/components/ui/reorderable";
import { ROW } from "@/components/ui/row";
import { Select } from "@/components/ui/select";
import { SectionTab, tabArrowHandler } from "@/components/ui/tab";

import { Toggle } from "@/components/ui/toggle";
import { useConfirmLeave } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import { statusTone } from "@/lib/order-status";
import { SEARCH, TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import { applyOrder } from "../catalog/api/menu";
import {
  POLICY_DOCUMENTS,
  type HelpTopic,
  type PolicyDocument,
  type PolicySection,
} from "./api/content";
import {
  useCreateHelpTopic,
  useCreatePolicySection,
  useDeleteHelpTopic,
  useDeletePolicySection,
  useHelpTopics,
  useOrderStatusContent,
  usePaymentMethods,
  usePolicySections,
  useReorderHelpTopics,
  useReorderPolicySections,
  useUpdateHelpTopic,
  useUpdateOrderStatusContent,
  useUpdatePaymentMethod,
  useUpdatePolicySection,
} from "./use-content";

/**
 * Settings — the writing the app does that nobody could edit.
 *
 * ## Why these four sit together
 *
 * The help topics, the two legal documents, the payment methods and the words
 * on the order timeline are one errand: they are the app's *prose*. Each is a
 * short ordered list of localised text with a switch on it, visited rarely, and
 * none of them is big enough to deserve a place on the rail.
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

type TabKey = "help" | "legal" | "payments" | "steps";

const TABS: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: "help", labelKey: "content.tabHelp" },
  { key: "legal", labelKey: "content.tabLegal" },
  { key: "payments", labelKey: "content.tabPayments" },
  { key: "steps", labelKey: "content.tabSteps" },
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
   * tab button: there is one `show`, and there are five tabs.
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
      <div className={cx("min-h-0 flex-1", tab !== "payments" && "hidden")}>
        <PaymentsTab />
      </div>
      <div className={cx("min-h-0 flex-1", tab !== "steps" && "hidden")}>
        <StepsTab />
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
  const create = useCreateHelpTopic();
  const update = useUpdateHelpTopic();
  const remove = useDeleteHelpTopic();
  const reorder = useReorderHelpTopics();

  const [open, setOpen] = useState<string | null>(null);

  const rows = topics.data ?? [];
  const editing = rows.find((row) => row.id === open) ?? null;

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
          <Button onClick={() => setOpen("new")}>
            {t("content.addTopic")}
          </Button>
        </div>

        <div className="flex min-h-0 min-w-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
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
                open={open === row.id}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() => setOpen(row.id)}
                onToggle={() => {
                  setOpen(null);
                  update.mutate({
                    id: row.id,
                    patch: { isActive: !row.isActive },
                  });
                }}
                onRemove={async () => {
                  setOpen(null);
                  await remove.mutateAsync({
                    id: row.id,
                    name: pickLocalized(row.question),
                  });
                }}
              />
            ))}
        </div>
      </div>

      <Panel
        open={open !== null}
        onClose={() => setOpen(null)}
        label={t("content.topicForm")}
      >
        {open && (
          <>
            <PanelHeader
              title={
                editing
                  ? pickLocalized(editing.question)
                  : t("content.addTopic")
              }
              onClose={() => setOpen(null)}
            />

            <HelpEditor
              key={open}
              initial={editing ?? undefined}
              groups={rows}
              pending={create.isPending || update.isPending}
              onSave={(draft) => {
                const name = pickLocalized(draft.question);
                if (editing) {
                  update.mutate(
                    { id: editing.id, patch: draft, name },
                    { onSuccess: () => setOpen(null) },
                  );
                } else {
                  create.mutate(
                    { draft, sortOrder: rows.length, name },
                    { onSuccess: () => setOpen(null) },
                  );
                }
              }}
              onCancel={() => setOpen(null)}
            />
          </>
        )}
      </Panel>
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
  rowProps,
  handleProps,
  onEdit,
  onToggle,
  onRemove,
}: {
  topic: HelpTopic;
  open: boolean;
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
    <div {...row}>
      <button {...handleProps(topic.id)}>
        <GripIcon />
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="flex min-w-0 flex-grow flex-col gap-xxs text-left"
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
        className="w-[104px]"
      />

      <ConfirmButton
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

function HelpEditor({
  initial,
  groups,
  pending,
  onSave,
  onCancel,
}: {
  initial?: HelpTopic;
  groups: HelpTopic[];
  pending: boolean;
  onSave: (draft: {
    groupSlug: string;
    groupName: Localized;
    question: Localized;
    answer: Localized;
    isActive: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  // One entry per group that exists, so a new topic joins an existing heading
  // rather than inventing a near-duplicate of it.
  const known = [
    ...new Map(
      groups.map((one) => [one.groupSlug, one.groupName] as const),
    ).entries(),
  ];

  const [groupSlug, setGroupSlug] = useState(
    initial?.groupSlug ?? known[0]?.[0] ?? "",
  );
  const [question, setQuestion] = useState<Localized>(initial?.question ?? {});
  const [answer, setAnswer] = useState<Localized>(initial?.answer ?? {});
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [errors, setErrors] = useState<{
    question?: string;
    answer?: string;
    group?: string;
  }>({});

  const groupName =
    known.find(([slug]) => slug === groupSlug)?.[1] ?? ({} as Localized);

  function submit() {
    const questionCheck = validateLocalizedText(
      question,
      codes,
      TEXT.helpQuestion,
    );
    const answerCheck = validateLocalizedText(answer, codes, TEXT.helpAnswer);

    const found = {
      question: questionCheck.ok
        ? undefined
        : t(questionCheck.key, questionCheck.params),
      answer: answerCheck.ok
        ? undefined
        : t(answerCheck.key, answerCheck.params),
      group: groupSlug ? undefined : t("content.groupRequired"),
    };

    setErrors(found);
    if (found.question || found.answer || found.group) return;

    onSave({ groupSlug, groupName, question, answer, isActive });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <Field
          label={t("content.group")}
          hint={t("content.groupHint")}
          error={errors.group}
        >
          <Select
            value={groupSlug}
            onChange={setGroupSlug}
            placeholder={t("content.pickGroup")}
            options={known.map(([slug, name]) => ({
              value: slug,
              label: pickLocalized(name) || slug,
            }))}
          />
        </Field>

        <LocalizedField
          label={t("content.question")}
          value={question}
          onChange={setQuestion}
          maxLength={TEXT.helpQuestion}
          error={errors.question}
          placeholder={{
            en: "How do I track my order?",
            ar: "كيف أتتبع طلبي؟",
          }}
        />

        <LocalizedField
          label={t("content.answer")}
          value={answer}
          onChange={setAnswer}
          maxLength={TEXT.helpAnswer}
          multiline
          error={errors.answer}
          placeholder={{
            en: "Open the order from the Orders tab.",
            ar: "افتح الطلب من تبويب الطلبات.",
          }}
        />

        <Field
          label={t("content.visibility")}
          hint={isActive ? t("content.liveHint") : t("content.hiddenHint")}
        >
          <Toggle
            on={isActive}
            onChange={() => setIsActive((current) => !current)}
            labelOn={t("content.live")}
            labelOff={t("content.hidden")}
          />
        </Field>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={pending}>
          {t("content.save")}
        </Button>
      </div>
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
  const [document, setDocument] = useState<PolicyDocument>("privacy");

  const [search, setSearch] = useState("");
  const searching = search.trim().length >= SEARCH.minTerm;

  const sections = usePolicySections(document, searching ? search : "");
  const create = useCreatePolicySection(document);
  const update = useUpdatePolicySection(document);
  const remove = useDeletePolicySection(document);
  const reorder = useReorderPolicySections(document);

  const [open, setOpen] = useState<string | null>(null);

  const rows = sections.data ?? [];
  const editing = rows.find((row) => row.id === open) ?? null;

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
                setOpen(null);
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

          <Button onClick={() => setOpen("new")}>
            {t("content.addSection")}
          </Button>
        </div>

        <div className="flex min-h-0 min-w-0 flex-grow flex-col gap-sm overflow-y-auto p-xxl">
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
                open={open === row.id}
                rowProps={order.rowProps}
                handleProps={order.handleProps}
                onEdit={() => setOpen(row.id)}
                onRemove={async () => {
                  setOpen(null);
                  await remove.mutateAsync({
                    id: row.id,
                    name: pickLocalized(row.title),
                  });
                }}
              />
            ))}
        </div>
      </div>

      <Panel
        open={open !== null}
        onClose={() => setOpen(null)}
        label={t("content.sectionForm")}
      >
        {open && (
          <>
            <PanelHeader
              title={
                editing ? pickLocalized(editing.title) : t("content.addSection")
              }
              onClose={() => setOpen(null)}
            />

            <PolicyEditor
              key={`${document}-${open}`}
              initial={editing ?? undefined}
              pending={create.isPending || update.isPending}
              onSave={(draft) => {
                const name = pickLocalized(draft.title);
                if (editing) {
                  update.mutate(
                    { id: editing.id, patch: draft, name },
                    { onSuccess: () => setOpen(null) },
                  );
                } else {
                  create.mutate(
                    {
                      draft: { ...draft, document },
                      sortOrder: rows.length,
                      name,
                    },
                    { onSuccess: () => setOpen(null) },
                  );
                }
              }}
              onCancel={() => setOpen(null)}
            />
          </>
        )}
      </Panel>
    </div>
  );
}

function PolicyRow({
  section,
  index,
  open,
  rowProps,
  handleProps,
  onEdit,
  onRemove,
}: {
  section: PolicySection;
  index: number;
  open: boolean;
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
    <div {...row}>
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
        className="flex min-w-0 flex-grow flex-col gap-xxs text-left"
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

function PolicyEditor({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial?: PolicySection;
  pending: boolean;
  onSave: (draft: { title: Localized; body: Localized }) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const [title, setTitle] = useState<Localized>(initial?.title ?? {});
  const [body, setBody] = useState<Localized>(initial?.body ?? {});
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});

  function submit() {
    const titleCheck = validateLocalizedText(title, codes, TEXT.policyTitle);
    const bodyCheck = validateLocalizedText(body, codes, TEXT.policyBody);

    const found = {
      title: titleCheck.ok ? undefined : t(titleCheck.key, titleCheck.params),
      body: bodyCheck.ok ? undefined : t(bodyCheck.key, bodyCheck.params),
    };

    setErrors(found);
    if (found.title || found.body) return;

    onSave({ title, body });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-grow flex-col gap-lg overflow-y-auto p-xxl">
        <LocalizedField
          label={t("content.sectionTitle")}
          value={title}
          onChange={setTitle}
          maxLength={TEXT.policyTitle}
          error={errors.title}
          placeholder={{ en: "What we collect", ar: "ما الذي نجمعه" }}
        />

        <LocalizedField
          label={t("content.sectionBody")}
          value={body}
          onChange={setBody}
          maxLength={TEXT.policyBody}
          multiline
          error={errors.body}
          placeholder={{
            en: "We keep your name, phone number and delivery addresses.",
            ar: "نحتفظ باسمك ورقم هاتفك وعناوين التوصيل.",
          }}
        />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-sm border-t border-border p-xxl">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} pending={pending}>
          {t("content.save")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

/**
 * How a customer pays.
 *
 * **There is one row, `cod`, and no gateway exists anywhere in this codebase.**
 * So this renames and describes what is there and offers no way to add
 * anything: a form that created a payment method would be offering a decision
 * with no consequence, because nothing would take the money.
 *
 * The switch still confirms. Turning off the only way to pay is not a
 * presentation change — it is closing the shop.
 */
function PaymentsTab() {
  const methods = usePaymentMethods();
  const update = useUpdatePaymentMethod();
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-lg overflow-y-auto p-xxl">
      <p className="ps-md text-[13px] text-text-soft">
        {t("content.paymentsBlurb")}
      </p>

      {methods.isError && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {t("content.failed")}
        </p>
      )}

      {(methods.data ?? []).map((method) => (
        <InlineEditor
          key={method.id}
          codes={codes}
          title={pickLocalized(method.name)}
          fields={[
            {
              key: "name",
              label: t("content.methodName"),
              value: method.name,
              max: TEXT.paymentMethodName,
            },
            {
              key: "detail",
              label: t("content.methodDetail"),
              value: method.detail,
              max: TEXT.paymentMethodDetail,
              multiline: true,
            },
          ]}
          pending={update.isPending}
          onSave={(values) =>
            update.mutate({
              id: method.id,
              patch: { name: values.name, detail: values.detail },
              name: pickLocalized(values.name ?? method.name),
            })
          }
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order steps
// ---------------------------------------------------------------------------

/**
 * What a customer is told at each step.
 *
 * ## Why this is a timeline and not a stack of cards
 *
 * It was a stack, and a stack is the wrong shape for it: five cards of three
 * fields each is fifteen inputs down one column, and the operator has to hold
 * the *order* in their head while scrolling past it. But the order is the whole
 * subject — `progress` is what makes these steps rather than settings, and the
 * app draws them as a line the customer watches an order move along.
 *
 * So the screen draws the line too. Picking a step edits that step, and only
 * that step: one set of fields on screen, with the path visible above it.
 *
 * The dots wear the order-status ramp, so a step here is the same colour as its
 * chip in the queue and its tab on the overview.
 *
 * ## Only the words are editable
 *
 * `progress` decides the path — which step is first (`place_order` reads
 * `min(progress)`), what order they come in, and which end an order — and
 * changing that is a change to how the business runs rather than to how it
 * reads. `0032` is explicit that inserting a step is supported; it is a
 * migration, deliberately, because a control that reordered the delivery path
 * would be the most consequential thing in the product sitting on its quietest
 * screen. The strip shows the order and does not offer to change it.
 */
function StepsTab() {
  const statuses = useOrderStatusContent();
  const update = useUpdateOrderStatusContent();
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const [selected, setSelected] = useState<string | null>(null);

  const rows = statuses.data ?? [];
  // The path, then whatever sits off it. `progress: null` is not a later step,
  // it is a way out — drawing it in line would say an order passes through
  // "cancelled" on its way to being delivered.
  const path = rows.filter((one) => one.progress !== null);
  const offPath = rows.filter((one) => one.progress === null);

  const current = rows.find((one) => one.id === selected) ?? rows[0] ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-xxl overflow-y-auto p-xxl">
      <p className="ps-md text-[13px] text-text-soft">
        {t("content.stepsBlurb")}
      </p>

      {statuses.isError && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {t("content.failed")}
        </p>
      )}

      {rows.length > 0 && (
        <>
          {/* The path, drawn as one. Horizontal because that is the shape of a
              sequence, and because five names across is far less to read than
              five cards down. */}
          <div
            role="tablist"
            aria-label={t("content.tabSteps")}
            className="flex flex-wrap items-stretch gap-xs"
          >
            {path.map((status, index) => (
              <StepChip
                key={status.id}
                slug={status.slug}
                label={pickLocalized(status.name)}
                caption={t("content.step", { at: index + 1 })}
                active={current?.id === status.id}
                onClick={() => setSelected(status.id)}
                // A connector on every chip but the first, so the strip reads
                // as one line rather than as a row of separate buttons.
                joined={index > 0}
              />
            ))}

            {offPath.length > 0 && (
              <>
                <span
                  aria-hidden
                  className="mx-sm self-center text-[13px] text-text-faint"
                >
                  {"·"}
                </span>
                {offPath.map((status) => (
                  <StepChip
                    key={status.id}
                    slug={status.slug}
                    label={pickLocalized(status.name)}
                    caption={t("content.offPath")}
                    active={current?.id === status.id}
                    onClick={() => setSelected(status.id)}
                  />
                ))}
              </>
            )}
          </div>

          {current && (
            <InlineEditor
              // Keyed on the step, so picking another rebuilds the fields
              // rather than leaving the previous step's text in them.
              key={current.id}
              codes={codes}
              title={pickLocalized(current.name)}
              badge={
                current.progress === null
                  ? t("content.offPath")
                  : t("content.step", {
                      at: path.findIndex((one) => one.id === current.id) + 1,
                    })
              }
              badgeTone={statusTone(current.slug)}
              fields={[
                {
                  key: "name",
                  label: t("content.stepName"),
                  value: current.name,
                  max: TEXT.statusName,
                },
                {
                  key: "timelineTitle",
                  label: t("content.timelineTitle"),
                  value: current.timelineTitle,
                  max: TEXT.statusTimelineTitle,
                },
                {
                  key: "timelineDetail",
                  label: t("content.timelineDetail"),
                  value: current.timelineDetail,
                  max: TEXT.statusTimelineDetail,
                  multiline: true,
                },
              ]}
              pending={update.isPending}
              onSave={(values) =>
                update.mutate({
                  id: current.id,
                  patch: {
                    name: values.name,
                    timelineTitle: values.timelineTitle,
                    timelineDetail: values.timelineDetail,
                  },
                  name: pickLocalized(values.name ?? current.name),
                })
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * One step on the strip.
 *
 * The dot carries the status ramp — the same colour this step wears in the
 * queue and on the overview — so the strip doubles as the legend for both. A
 * dot as well as a ground, because colour alone is not a distinction a
 * colour-blind operator can rely on.
 */
function StepChip({
  slug,
  label,
  caption,
  active,
  joined,
  onClick,
}: {
  slug: string;
  label: string;
  caption: string;
  active: boolean;
  joined?: boolean;
  onClick: () => void;
}) {
  const tone = statusTone(slug);

  return (
    <div className="flex items-center">
      {joined && (
        <span aria-hidden className="h-px w-[14px] shrink-0 bg-border" />
      )}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onClick}
        style={
          active ? { borderColor: tone.dot, background: tone.wash } : undefined
        }
        className={cx(
          "flex min-w-[128px] flex-col gap-xxs rounded-md border px-lg py-md text-left",
          active
            ? "shadow-card"
            : "border-border bg-surface hover:border-active",
        )}
      >
        <span className="flex items-center gap-sm">
          <span
            aria-hidden
            className="size-[8px] shrink-0 rounded-full"
            style={{ background: tone.dot }}
          />
          <span className="min-w-0 truncate text-[13px] font-semibold">
            {label}
          </span>
        </span>
        <span className="text-[11px] text-text-faint">{caption}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * A card that edits a fixed row in place.
 *
 * Used where the list cannot grow — one payment method, five order steps. A
 * panel would be the wrong shape: there is nothing to choose *from*, so opening
 * a form beside a list of two is a click that only ever has one destination.
 *
 * Save is disabled until something changes, so a card that has been read rather
 * than edited does not invite a pointless round trip.
 */
function InlineEditor({
  codes,
  title,
  badge,
  badgeTone,
  fields,
  pending,
  onSave,
  aside,
}: {
  codes: string[];
  title: string;
  badge?: string;
  /**
   * The colour the badge wears, as CSS values.
   *
   * Only the order steps pass one: their badge names a *status*, and a status
   * has a colour everywhere else in the product — the strip above, the queue's
   * tabs, the chips on a customer's orders. A grey "Step 2" beside a coloured
   * "Confirmed" is the same fact drawn two ways on one screen.
   *
   * No dot here, unlike the chips elsewhere. The strip directly above already
   * carries one per step and is doing the colour-blind work for this screen; a
   * second dot on the same status a line below is repetition, not redundancy.
   */
  badgeTone?: { wash: string; ink: string; dot: string };
  fields: {
    key: string;
    label: string;
    value: Localized;
    max: number;
    multiline?: boolean;
  }[];
  pending: boolean;
  onSave: (values: Record<string, Localized>) => void;
  aside?: React.ReactNode;
}) {
  const [values, setValues] = useState<Record<string, Localized>>(
    Object.fromEntries(fields.map((field) => [field.key, field.value])),
  );
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const dirty = fields.some(
    (field) =>
      JSON.stringify(values[field.key] ?? {}) !== JSON.stringify(field.value),
  );

  function submit() {
    const found: Record<string, string | undefined> = {};
    for (const field of fields) {
      const check = validateLocalizedText(
        values[field.key] ?? {},
        codes,
        field.max,
      );
      found[field.key] = check.ok ? undefined : t(check.key, check.params);
    }

    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    onSave(values);
  }

  return (
    <section className="flex flex-col gap-lg rounded-md border border-border bg-surface p-lg">
      <div className="flex items-center gap-md">
        <h2 className="min-w-0 flex-grow truncate text-[16px] font-semibold">
          {title}
        </h2>
        {badge && (
          <span
            style={
              badgeTone
                ? { background: badgeTone.wash, color: badgeTone.ink }
                : undefined
            }
            className={cx(
              "flex shrink-0 items-center gap-xs rounded-sm px-sm py-[2px] text-[11px] font-semibold",
              !badgeTone && "bg-neutral-fill text-text-soft",
            )}
          >
            {badge}
          </span>
        )}
        {aside}
      </div>

      {fields.map((field) => (
        <LocalizedField
          key={field.key}
          label={field.label}
          value={values[field.key] ?? {}}
          onChange={(next) =>
            setValues((current) => ({ ...current, [field.key]: next }))
          }
          maxLength={field.max}
          multiline={field.multiline}
          error={errors[field.key]}
        />
      ))}

      {/* Sticky to the bottom of the scroll region, not parked under the last
          field. A card here runs to three localised fields — six inputs — and
          on the order steps there is a timeline above it too, so Save is off
          screen exactly when somebody has finished typing and is looking for
          it. Scrolling back down to find a button is a cost paid on every
          single edit.

          Negative margins pull it through the card's own padding so it spans
          the full width and sits flush with the corner, and the surface
          background is what stops the fields showing through as they pass
          underneath. */}
      <div className="sticky bottom-0 -mx-lg -mb-lg flex justify-end rounded-b-md border-t border-border bg-surface px-lg py-md">
        <Button onClick={submit} pending={pending} disabled={!dirty}>
          {t("content.save")}
        </Button>
      </div>
    </section>
  );
}
