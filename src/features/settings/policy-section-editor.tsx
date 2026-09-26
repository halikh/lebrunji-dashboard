"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { EditorPage } from "@/components/ui/editor-page";
import { LocalizedField } from "@/components/ui/localized-field";
import { EmptyState } from "@/components/ui/empty-state";
import { changed, useUnsavedChanges } from "@/components/unsaved-changes";
import { useLanguages } from "@/features/reference/use-languages";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";
import { TEXT } from "@/lib/limits";
import { validateLocalizedText, type Localized } from "@/lib/validation";

import type { PolicyDocument, PolicySection } from "./api/content";
import {
  useCreatePolicySection,
  usePolicySections,
  useUpdatePolicySection,
} from "./use-content";

/**
 * Which of the two policies a section belongs to, out of the URL.
 *
 * The legal tab keeps the chosen document in its own state, so the editor has
 * to be told which one the row came from — otherwise saving a *terms* section
 * would read and write the privacy list. It travels as `?doc=`, and goes back
 * on the return href so the list reopens on the document it was left on rather
 * than snapping to privacy.
 */
function useDocument(): PolicyDocument {
  return useSearchParams().get("doc") === "terms" ? "terms" : "privacy";
}

function listHref(document: PolicyDocument) {
  return `/settings?tab=legal&doc=${document}`;
}

/**
 * One section of a policy, on a page of its own.
 *
 * The other panel that had no header — see `HelpTopicEditor`.
 *
 * It also has the most to gain from the width: a section is a title and a
 * *body*, and the body is prose. Editing a paragraph of a privacy policy in a
 * 420pt column meant a textarea about forty characters wide, which is a shape
 * nobody writes in.
 */
export function PolicySectionEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const document = useDocument();
  const LIST_HREF = listHref(document);

  const sections = usePolicySections(document);
  const rows = sections.data ?? [];
  const initial = id ? (rows.find((row) => row.id === id) ?? null) : null;

  const create = useCreatePolicySection(document);
  const update = useUpdatePolicySection(document);

  const back = (focusId: string | null) => {
    const focus = focusId ? `&focus=${focusId}` : "";
    router.replace(`${LIST_HREF}${focus}`);
  };

  if (id && !initial) {
    return (
      <EditorPage
        title={t("content.addSection")}
        backHref={LIST_HREF}
        backLabel={t("content.tabLegal")}
      >
        {sections.isPending ? (
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
      listHref={LIST_HREF}
      pending={create.isPending || update.isPending}
      onSave={(draft) => {
        const name = pickLocalized(draft.title);
        // The document is the route's, not the form's — a section belongs to
        // the policy it was opened from and cannot be moved between them here.
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
  listHref: LIST_HREF,
  pending,
  onSave,
  onCancel,
}: {
  initial?: PolicySection;
  listHref: string;
  pending: boolean;
  onSave: (draft: { title: Localized; body: Localized }) => void;
  onCancel: () => void;
}) {
  const languages = useLanguages();
  const codes = languages.data?.map((language) => language.code) ?? [];

  const [title, setTitle] = useState<Localized>(initial?.title ?? {});
  const [body, setBody] = useState<Localized>(initial?.body ?? {});
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});

  // The guard that used to belong to the panel: a page is left by navigating,
  // which nothing intercepts on its own. See `CategoryEditor`.
  useUnsavedChanges(
    changed(
      { title, body },
      { title: initial?.title ?? {}, body: initial?.body ?? {} },
    ),
  );

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
    <EditorPage
      title={initial ? pickLocalized(initial.title) : t("content.addSection")}
      backHref={initial ? `${LIST_HREF}&focus=${initial.id}` : LIST_HREF}
      backLabel={t("content.tabLegal")}
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
    </EditorPage>
  );
}
