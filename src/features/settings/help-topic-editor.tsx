"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Field } from "@/components/ui";
import { EditorPage } from "@/components/ui/editor-page";
import { LocalizedField } from "@/components/ui/localized-field";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { HelpTopic } from "./api/content";
import {
  useCreateHelpTopic,
  useHelpTopics,
  useUpdateHelpTopic,
} from "./use-content";

const LIST_HREF = "/settings?tab=help";

/**
 * One help topic, on a page of its own.
 *
 * ## This is one of the two that had no header at all
 *
 * `PanelHeader`'s own note records it: every panel in the dashboard carried its
 * own copy of the same title-and-close bar, and the two settings panels had
 * none — so a form opened here with nothing saying what it was editing and no
 * button to close it, on the one screen reached from a list of near-identical
 * rows. The shared component fixed that; a route makes it structural, because
 * `EditorPage` cannot be rendered without a title and a way back.
 */
export function HelpTopicEditor({ id }: { id: string | null }) {
  const router = useRouter();

  const topics = useHelpTopics("");
  const rows = topics.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreateHelpTopic();
  const update = useUpdateHelpTopic();

  const back = (focusId: string | null) => {
    const focus = focusId ? `&focus=${focusId}` : "";
    router.replace(`${LIST_HREF}${focus}`);
  };

  if (id && !initial) {
    return (
      <EditorPage
        title={t("content.addTopic")}
        backHref={LIST_HREF}
        backLabel={t("content.tabHelp")}
      >
        {topics.isPending ? (
          <div aria-hidden className="h-[64px] rounded-md bg-neutral-fill" />
        ) : (
          <EmptyState titleKey="content.notFound" mood="lost" />
        )}
      </EditorPage>
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

  // The guard that used to belong to the panel: a page is left by navigating,
  // which nothing intercepts on its own. See `CategoryEditor`.
  useUnsavedChanges(
    changed(
      { groupSlug, question, answer, isActive },
      {
        groupSlug: initial?.groupSlug ?? known[0]?.[0] ?? "",
        question: initial?.question ?? {},
        answer: initial?.answer ?? {},
        isActive: initial?.isActive ?? true,
      },
    ),
  );

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
    <EditorPage
      title={initial ? pickLocalized(initial.question) : t("content.addTopic")}
      backHref={initial ? `${LIST_HREF}&focus=${initial.id}` : LIST_HREF}
      backLabel={t("content.tabHelp")}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} pending={pending}>
            {t("content.save")}
          </Button>
        </>
      }
    >
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
    </EditorPage>
  );
}
