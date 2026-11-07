"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, SearchX } from "lucide-react";
import { useState } from "react";

import {
  Button,
  EmptyState,
  Field,
  Page,
  PageHeader,
  Section,
  Skeleton,
  Switch,
} from "@/components/ui";
import { Select } from "@/components/ui/select";
import { LocalizedField } from "@/components/ui/localized-field";
import {
  changed,
  useGuardedAction,
  useUnsavedChanges,
} from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { HelpTopic } from "./api/content";
import { SaveBar } from "./settings-parts";
import {
  useCreateHelpTopic,
  useHelpTopics,
  useUpdateHelpTopic,
} from "./use-content";

const LIST_HREF = "/settings?tab=help";

/** One help topic, new (`id` null) or existing, on a page of its own. */
export function HelpTopicEditor({ id }: { id: string | null }) {
  const router = useRouter();

  const topics = useHelpTopics("");
  const rows = topics.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreateHelpTopic();
  const update = useUpdateHelpTopic();

  const back = (focusId: string | null) =>
    router.replace(focusId ? `${LIST_HREF}&focus=${focusId}` : LIST_HREF);

  // A new topic needs the list too: it is where the groups come from, and its
  // length is where the new one goes.
  if (topics.isPending) {
    return (
      <Page width="narrow">
        <PageHeader title={t(id ? "common.loading" : "content.addTopic")} />
        <Skeleton className="h-64 rounded-lg" />
      </Page>
    );
  }

  if (topics.isError || (id && !initial)) {
    return (
      <Page width="narrow">
        <PageHeader title={t("content.topicForm")} />
        {topics.isError ? (
          <EmptyState
            icon={<AlertCircle />}
            title={t("content.failed")}
            action={
              <Button onClick={() => void topics.refetch()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<SearchX />}
            title={t("content.notFound")}
            description={t("content.notFoundBody")}
          />
        )}
      </Page>
    );
  }

  return (
    <Form
      key={initial?.id ?? "new"}
      initial={initial ?? undefined}
      groups={rows}
      pending={create.isPending || update.isPending}
      onSave={(draft) => {
        const name = pickLocalized(draft.question);
        const done = () => back(initial?.id ?? null);
        if (initial) {
          update.mutate(
            { id: initial.id, patch: draft, name },
            { onSuccess: done },
          );
        } else {
          create.mutate(
            { draft, sortOrder: rows.length, name },
            { onSuccess: done },
          );
        }
      }}
      onCancel={() => back(initial?.id ?? null)}
    />
  );
}

type Draft = {
  groupSlug: string;
  groupName: Localized;
  question: Localized;
  answer: Localized;
  isActive: boolean;
};

function Form({
  initial,
  groups,
  pending,
  onSave,
  onCancel,
}: {
  initial?: HelpTopic;
  groups: HelpTopic[];
  pending: boolean;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const guarded = useGuardedAction();

  /**
   * One entry per group that exists. `group_name` is stored per topic and the
   * app groups by `group_slug`, so a name typed here would split a heading in
   * two — choosing from what exists is what keeps that from happening.
   */
  const known = [
    ...new Map(
      groups.map((one) => [one.groupSlug, one.groupName] as const),
    ).entries(),
  ];

  const startGroup = initial?.groupSlug ?? known[0]?.[0] ?? "";
  const [groupSlug, setGroupSlug] = useState(startGroup);
  const [question, setQuestion] = useState<Localized>(initial?.question ?? {});
  const [answer, setAnswer] = useState<Localized>(initial?.answer ?? {});
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [errors, setErrors] = useState<{
    question?: string;
    answer?: string;
    group?: string;
  }>({});

  const dirty = changed(
    { groupSlug, question, answer, isActive },
    {
      groupSlug: startGroup,
      question: initial?.question ?? {},
      answer: initial?.answer ?? {},
      isActive: initial?.isActive ?? true,
    },
  );
  useUnsavedChanges(dirty);

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
    <Page width="narrow">
      <PageHeader
        title={
          initial
            ? pickLocalized(initial.question) || t("content.topicForm")
            : t("content.addTopic")
        }
        description={t("content.helpBlurb")}
      />

      <Section
        title={t("content.groupSectionTitle")}
        description={t("content.groupHint")}
      >
        <Field
          label={t("content.group")}
          error={errors.group}
          hint={known.length === 0 ? t("content.noGroups") : undefined}
        >
          {(props) => (
            <Select
              {...props}
              value={groupSlug}
              disabled={known.length === 0}
              onChange={(next) => next && setGroupSlug(next)}
              placeholder={t("content.pickGroup")}
              options={known.map(([slug, name]) => ({
                value: slug,
                label: pickLocalized(name) || slug,
              }))}
            />
          )}
        </Field>
      </Section>

      <Section
        title={t("content.topicSectionTitle")}
        description={t("content.topicSectionBlurb")}
      >
        <div className="flex flex-col gap-5">
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
        </div>
      </Section>

      <Section
        title={t("content.visibility")}
        description={t("content.visibilityBlurb")}
      >
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          label={isActive ? t("content.live") : t("content.hidden")}
          description={
            isActive ? t("content.liveHint") : t("content.hiddenHint")
          }
        />
      </Section>

      <SaveBar
        dirty={dirty}
        pending={pending}
        saveLabel={t("content.save")}
        onSave={submit}
        onCancel={guarded(onCancel)}
      />
    </Page>
  );
}
