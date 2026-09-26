import { likeAny, searchTerm } from "@/lib/search";
import { getClient } from "@/lib/supabase/client";
import { t } from "@/i18n/translations";
import type { Localized } from "@/lib/validation";

/**
 * The written content the app shows and nobody could edit.
 *
 * Four tables, one file, because they are one errand: help topics, the privacy
 * and terms documents, the payment methods, and the names of the steps an order
 * walks. Each is a short ordered list of localised text with a switch on it, and
 * splitting them into four features would be four copies of the same shape.
 *
 * ## Why this exists at all
 *
 * All four were seeded by migration and reachable only from the SQL editor.
 * `0016` moved their text out of translation keys and into the database
 * *precisely so it could be edited* — and then nothing could edit it. This is
 * the screen that sentence was written for.
 *
 * ## None of them is paginated, and that is checkable rather than hopeful
 *
 * A FAQ, a privacy policy, one payment method and five order steps are bounded
 * by what a person is willing to write and read. Each read below is capped, and
 * the cap is stated: if one is ever hit, this needs a different screen rather
 * than a bigger number.
 */

const CAP = 200;

// ---------------------------------------------------------------------------
// Help topics
// ---------------------------------------------------------------------------

export type HelpTopic = {
  id: string;
  slug: string;
  /**
   * Which heading it sits under in the app.
   *
   * Two columns, because `0016` kept both: `group_slug` is the key rows are
   * grouped *by*, and `group_name` is what that heading reads. Editing the name
   * on one topic and not its siblings would split a group in two, so the screen
   * edits the group as a group — see `renameHelpGroup`.
   */
  groupSlug: string;
  groupName: Localized;
  question: Localized;
  answer: Localized;
  sortOrder: number;
  isActive: boolean;
};

/**
 * Every topic, or the ones matching a term.
 *
 * The term goes into the query rather than filtering the rows already here.
 * This list is short enough that either would find the same thing today, and
 * that is exactly why it is worth doing properly: a client-side filter is a
 * habit that is wrong on every list that pages, where it searches what has been
 * *downloaded* and silently cannot find the rest.
 *
 * Both languages, and the answer as well as the question — somebody looking for
 * the topic that mentions refunds is searching for a word in the body of it.
 */
export async function fetchHelpTopics(
  search?: string | null,
): Promise<HelpTopic[]> {
  let query = getClient()
    .from("help_topics")
    .select(
      "id, slug, group_slug, group_name, question, answer, sort_order, is_active",
    )
    .order("sort_order", { ascending: true })
    .limit(CAP);

  // Quoted — a term with a comma in it would otherwise be read as two
  // conditions and the filter refused. See `lib/search.ts`.
  //
  // `group_name->>ar` is here now too. It was the one column of the three
  // whose Arabic was not searched, so a group named only in Arabic could be
  // found by its question and not by the heading it sits under — and the app's
  // own read searches all six, which is the list a customer types into.
  const term = searchTerm(search);
  if (term) {
    query = query.or(
      likeAny(
        [
          "question->>en",
          "question->>ar",
          "answer->>en",
          "answer->>ar",
          "group_name->>en",
          "group_name->>ar",
        ],
        term,
      ),
    );
  }

  const { data, error } = await query;

  if (error)
    throw new Error(`Could not read the help topics: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    groupSlug: (row.group_slug as string) ?? "",
    groupName: (row.group_name as Localized) ?? {},
    question: (row.question as Localized) ?? {},
    answer: (row.answer as Localized) ?? {},
    sortOrder: row.sort_order as number,
    isActive: row.is_active as boolean,
  }));
}

export type HelpTopicDraft = {
  groupSlug: string;
  groupName: Localized;
  question: Localized;
  answer: Localized;
  isActive: boolean;
};

export async function createHelpTopic(
  draft: HelpTopicDraft,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient()
    .from("help_topics")
    .insert({
      // `help_topics` is not in `0071`'s trigger list — it has no jsonb column
      // the generator reads by name — so the slug is derived here, and the unique
      // index is what settles a collision rather than a check-then-insert.
      slug: slugify(draft.question.en ?? "", "topic"),
      group_slug: draft.groupSlug,
      group_name: draft.groupName,
      question: draft.question,
      answer: draft.answer,
      sort_order: sortOrder,
      is_active: draft.isActive,
    });

  if (error) throw new Error(friendly(error.message));
}

export type HelpTopicPatch = Partial<HelpTopicDraft> & { sortOrder?: number };

export async function updateHelpTopic(
  id: string,
  patch: HelpTopicPatch,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.groupSlug !== undefined) row.group_slug = patch.groupSlug;
  if (patch.groupName !== undefined) row.group_name = patch.groupName;
  if (patch.question !== undefined) row.question = patch.question;
  if (patch.answer !== undefined) row.answer = patch.answer;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { error } = await getClient()
    .from("help_topics")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/**
 * Renames a whole group, on every topic in it.
 *
 * `group_name` is stored per topic, so a rename applied to one row splits the
 * group: the app groups by `group_slug` and takes the heading from whichever
 * row it reads first, which means the FAQ would show one name or the other
 * depending on sort order. Editing every member is what keeps the group a
 * group.
 */
export async function renameHelpGroup(
  groupSlug: string,
  groupName: Localized,
): Promise<void> {
  const { error } = await getClient()
    .from("help_topics")
    .update({ group_name: groupName })
    .eq("group_slug", groupSlug);
  if (error) throw new Error(friendly(error.message));
}

/**
 * Removes a topic outright.
 *
 * `help_topics` has no `deleted_at` — nothing references it and nothing records
 * that it was ever read, so there is no history to keep. It is the one table on
 * this screen where delete means delete, which is why the confirmation says so.
 */
export async function deleteHelpTopic(id: string): Promise<void> {
  const { error } = await getClient().from("help_topics").delete().eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

// ---------------------------------------------------------------------------
// Policy sections
// ---------------------------------------------------------------------------

/** The two documents `policy_document` allows. Adding one is a migration. */
export type PolicyDocument = "privacy" | "terms";
export const POLICY_DOCUMENTS: PolicyDocument[] = ["privacy", "terms"];

export type PolicySection = {
  id: string;
  slug: string;
  document: PolicyDocument;
  title: Localized;
  body: Localized;
  sortOrder: number;
};

/**
 * One document's sections, or the ones matching a term.
 *
 * Scoped to the document as well as the term: a heading may legitimately appear
 * in both privacy and terms, and a search that crossed between them would offer
 * to edit a section of the document nobody is looking at.
 */
export async function fetchPolicySections(
  document: PolicyDocument,
  search?: string | null,
): Promise<PolicySection[]> {
  let query = getClient()
    .from("policy_sections")
    .select("id, slug, document, title, body, sort_order")
    .eq("document", document)
    .order("sort_order", { ascending: true })
    .limit(CAP);

  // Quoted, and the same four columns the app's own read searches.
  const term = searchTerm(search);
  if (term) {
    query = query.or(
      likeAny(["title->>en", "title->>ar", "body->>en", "body->>ar"], term),
    );
  }

  const { data, error } = await query;

  if (error) throw new Error(`Could not read the document: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    document: row.document as PolicyDocument,
    title: (row.title as Localized) ?? {},
    body: (row.body as Localized) ?? {},
    sortOrder: row.sort_order as number,
  }));
}

export type PolicySectionDraft = {
  document: PolicyDocument;
  title: Localized;
  body: Localized;
};

export async function createPolicySection(
  draft: PolicySectionDraft,
  sortOrder: number,
): Promise<void> {
  const { error } = await getClient()
    .from("policy_sections")
    .insert({
      // Unique per `(document, slug)`, not globally — the same heading may
      // legitimately appear in both documents.
      slug: slugify(draft.title.en ?? "", "section"),
      document: draft.document,
      title: draft.title,
      body: draft.body,
      sort_order: sortOrder,
    });

  if (error) throw new Error(friendly(error.message));
}

export async function updatePolicySection(
  id: string,
  patch: Partial<Omit<PolicySectionDraft, "document">> & { sortOrder?: number },
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.body !== undefined) row.body = patch.body;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;

  const { error } = await getClient()
    .from("policy_sections")
    .update(row)
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

/** Same as a help topic: no `deleted_at`, nothing references it, gone is gone. */
export async function deletePolicySection(id: string): Promise<void> {
  const { error } = await getClient()
    .from("policy_sections")
    .delete()
    .eq("id", id);
  if (error) throw new Error(friendly(error.message));
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/**
 * Reorders any of these lists.
 *
 * The same shape as everywhere else here — several writes rather than one, for
 * the reason `setSortOrder` in `api/menu.ts` sets out: PostgREST's bulk upsert
 * would have to satisfy an insert to touch one integer. Acceptable because
 * `sort_order` is presentation, the call is idempotent, and the list is
 * refetched on success *and* failure.
 */
export async function setContentOrder(
  table: "help_topics" | "policy_sections",
  updates: { id: string; sortOrder: number }[],
): Promise<void> {
  if (updates.length === 0) return;

  const client = getClient();
  const results = await Promise.all(
    updates.map(({ id, sortOrder }) =>
      client.from(table).update({ sort_order: sortOrder }).eq("id", id),
    ),
  );

  const failure = results.find((result) => result.error);
  if (failure?.error) throw new Error(friendly(failure.error.message));
}

/**
 * Text to the shape a slug column accepts.
 *
 * These two tables are not in `0071`'s trigger list — the generator reads a
 * named jsonb column, and neither `help_topics` nor `policy_sections` has one
 * it was told about — so the slug is derived here. The unique index settles a
 * collision by refusing the insert, rather than this checking first: check then
 * insert is two round trips with a gap, and the gap is where two tabs both
 * decide the same slug is free.
 */
function slugify(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58);
  return slug || `${fallback}-${Date.now().toString(36)}`;
}

function friendly(message: string): string {
  if (message.includes("slug")) return t("dbError.duplicateSlug");
  if (message.includes("_locales")) return t("dbError.missingLanguage");
  if (message.includes("_len")) return t("dbError.tooLong");
  return message;
}
