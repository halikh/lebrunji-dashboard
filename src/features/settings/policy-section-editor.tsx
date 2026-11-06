"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, SearchX } from "lucide-react";
import { useState } from "react";

import {
  Badge,
  Button,
  EmptyState,
  Page,
  PageHeader,
  Section,
  Skeleton,
} from "@/components/ui";
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

import type { PolicyDocument, PolicySection } from "./api/content";
import { useDocumentParam } from "./legal-tab";
import { SaveBar } from "./settings-parts";
import {
  useCreatePolicySection,
  usePolicySections,
  useUpdatePolicySection,
} from "./use-content";

function listHref(document: PolicyDocument) {
  return `/settings?tab=legal&doc=${document}`;
}

/**
 * One section of a policy, on a page of its own.
 *
 * The document comes from `?doc=` — the list keeps it in the URL — so saving a
 * *terms* section reads and writes the terms list, and the way back reopens
 * the document it was left on. A section belongs to the policy it was opened
 * from and cannot be moved between them here.
 */
export function PolicySectionEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const document = useDocumentParam();
  const LIST_HREF = listHref(document);

  const sections = usePolicySections(document);
  const rows = sections.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreatePolicySection(document);
  const update = useUpdatePolicySection(document);

  const back = (focusId: string | null) =>
    router.replace(focusId ? `${LIST_HREF}&focus=${focusId}` : LIST_HREF);

  if (sections.isPending) {
    return (
      <Page width="narrow">
        <PageHeader title={t(id ? "common.loading" : "content.addSection")} />
        <Skeleton className="h-64 rounded-lg" />
      </Page>
    );
  }

  if (sections.isError || (id && !initial)) {
    return (
      <Page width="narrow">
        <PageHeader title={t("content.sectionForm")} />
        {sections.isError ? (
          <EmptyState
            icon={<AlertCircle />}
            title={t("content.failed")}
            action={
              <Button onClick={() => void sections.refetch()}>
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
      document={document}
      pending={create.isPending || update.isPending}
      onSave={(draft) => {
        const name = pickLocalized(draft.title);
        const patch = { ...draft, document };
        const done = () => back(initial?.id ?? null);
        if (initial) {
          update.mutate({ id: initial.id, patch, name }, { onSuccess: done });
        } else {
          create.mutate(
            { draft: patch, sortOrder: rows.length, name },
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
  document,
  pending,
  onSave,
  onCancel,
}: {
  initial?: PolicySection;
  document: PolicyDocument;
  pending: boolean;
  onSave: (draft: { title: Localized; body: Localized }) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];
  const guarded = useGuardedAction();

  const [title, setTitle] = useState<Localized>(initial?.title ?? {});
  const [body, setBody] = useState<Localized>(initial?.body ?? {});
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});

  const dirty = changed(
    { title, body },
    { title: initial?.title ?? {}, body: initial?.body ?? {} },
  );
  useUnsavedChanges(dirty);

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

  const documentName = t(`content.document.${document}`);

  return (
    <Page width="narrow">
      <PageHeader
        title={
          initial
            ? pickLocalized(initial.title) || t("content.sectionForm")
            : t("content.addSection")
        }
        meta={<Badge>{documentName}</Badge>}
        description={t("content.inDocument", { document: documentName })}
      />

      <Section
        title={t("content.sectionSectionTitle")}
        description={t("content.sectionSectionBlurb")}
      >
        <div className="flex flex-col gap-5">
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
