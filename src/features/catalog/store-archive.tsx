"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { ROW_STATIC } from "@/components/ui/row";
import { FilterTab, tabArrowHandler } from "@/components/ui/tab";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import { formatDate } from "@/lib/time";

import { useMoney } from "@/features/reference/use-currencies";

import { useArchive, useRestore } from "./use-menu";
import { useStore } from "./use-stores";

/**
 * Everything this shop has put away, and the way back.
 *
 * ## Why the screen has to exist
 *
 * Nothing in this product is ever really deleted. Order lines reference dishes
 * and choices for ever, so archiving writes a `deleted_at` and withdrawing
 * writes `is_active = false` — and until this tab, the *only* observable effect
 * of either was that something vanished. There was no list of what had gone, no
 * way back, and no answer to "where did Signature plates go" except to
 * re-create it under a name the slug index would then refuse as a duplicate.
 *
 * A soft delete you cannot see into is a hard delete that also costs storage.
 * This is the missing half.
 *
 * ## Two mechanisms, and the screen says which is which
 *
 * A section and a dish are **archived** — `deleted_at`. A question and a choice
 * are **withdrawn** — `is_active`, because `option_groups` and `item_options`
 * have no `deleted_at` and migration 0019 is explicit that they should not
 * ("two ways to say gone is two places to check"). Both belong here, because an
 * operator looking for a missing thing does not know which table it was in. But
 * they are not collapsed into one word: the headings keep the product's own
 * vocabulary, so the label matches what the row's own screen calls it.
 *
 * ## Every row says where it would come back to
 *
 * A dish shows its section, a choice shows its question and its dish. That is
 * not decoration — for a dish it is the fact that decides whether the button
 * works at all, because a dish restored into an archived section is listed by
 * neither the dashboard nor the app. `restoreMenuItem` refuses that, and the
 * row says so before it is pressed rather than after.
 */
/**
 * Which kind of put-away thing is on screen.
 *
 * The same strip the queue, the customers list and the drivers list use, in the
 * same place with the same keyboard behaviour — these are the same kind of
 * control, and two spellings of it would be two things to learn.
 *
 * "All" carries no tone, because it is not a kind: it keeps the app's coral,
 * the way every other "All" in the dashboard does.
 */
const TABS: { key: Kind; labelKey: TranslationKey }[] = [
  { key: "all", labelKey: "archive.all" },
  { key: "sections", labelKey: "archive.sections" },
  { key: "items", labelKey: "archive.items" },
  { key: "groups", labelKey: "archive.groups" },
  { key: "options", labelKey: "archive.options" },
];

type Kind = "all" | "sections" | "items" | "groups" | "options";

export function StoreArchive({ storeId }: { storeId: string }) {
  /**
   * Component state, not the URL.
   *
   * The shop page already spends its query string on `?tab=` and, for the
   * options screen, on `?section=&item=` — and unlike those, which kind of
   * archived thing you were looking at is not worth linking to. A filter that
   * survives a reload but nobody ever pastes is state.
   */
  const [kind, setKind] = useState<Kind>("all");
  const archive = useArchive(storeId);
  const restore = useRestore(storeId);
  const store = useStore(storeId);
  const { format } = useMoney();

  const currencyCode = store.data?.currencyCode ?? "";
  const data = archive.data;

  const empty =
    data !== undefined &&
    data.sections.length === 0 &&
    data.items.length === 0 &&
    data.groups.length === 0 &&
    data.options.length === 0;

  if (archive.isError) {
    return (
      <EmptyState
        mood="lost"
        titleKey="archive.failedTitle"
        bodyKey="archive.hint"
      />
    );
  }

  if (empty) {
    return (
      <EmptyState
        mood="done"
        titleKey="archive.emptyTitle"
        bodyKey="archive.emptyBody"
      />
    );
  }

  const counts: Record<Kind, number> = {
    all:
      (data?.sections.length ?? 0) +
      (data?.items.length ?? 0) +
      (data?.groups.length ?? 0) +
      (data?.options.length ?? 0),
    sections: data?.sections.length ?? 0,
    items: data?.items.length ?? 0,
    groups: data?.groups.length ?? 0,
    options: data?.options.length ?? 0,
  };

  /** Whether a section is drawn at all — "All", or the one that was picked. */
  const showing = (which: Kind) => kind === "all" || kind === which;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Above the scroller, not inside it. A filter strip that scrolls away
          leaves the operator looking at a filtered list with no visible sign
          that a filter is on. */}
      <div
        role="tablist"
        aria-label={t("archive.title")}
        className="flex shrink-0 gap-xxs overflow-x-auto border-b border-border bg-surface px-xxl pt-sm"
      >
        {TABS.map(({ key, labelKey }) => (
          <FilterTab
            key={key}
            label={t(labelKey)}
            count={counts[key]}
            active={kind === key}
            onClick={() => setKind(key)}
            onKeyDown={tabArrowHandler(
              TABS.map((one) => one.key),
              kind,
              setKind,
            )}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-grow flex-col gap-xxl overflow-y-auto p-xxl">
        <p className="max-w-[560px] text-[13px] text-text-soft">
          {t("archive.hint")}
        </p>

        {/* A filter with nothing behind it is its own state. Without this the
            screen would go blank under a strip that says the count is zero,
            which reads as broken rather than as empty. */}
        {counts[kind] === 0 && (
          <EmptyState
            mood="waiting"
            titleKey="archive.noneOfThese"
            bodyKey="archive.noneOfTheseBody"
          />
        )}

        {/* Sections first, and deliberately: a dish cannot come back until its
          section has, so the list that unblocks the others is the one at the
          top. */}
        <Group
          title={t("archive.sections")}
          rows={showing("sections") ? counts.sections : 0}
        >
          {data?.sections.map((section) => (
            <div key={section.id} className={ROW_STATIC}>
              <span className="flex min-w-0 flex-grow flex-col gap-xxs">
                <span className="truncate text-[15px] font-semibold">
                  {pickLocalized(section.title)}
                </span>
                <span className="truncate text-[12px] text-text-faint">
                  {t("archive.archivedOn", {
                    when: formatDate(section.archivedAt),
                  })}
                </span>
              </span>
              <Restore
                pending={restore.section.isPending}
                onClick={() =>
                  restore.section.mutate({
                    id: section.id,
                    name: section.title,
                  })
                }
              />
            </div>
          ))}
        </Group>

        <Group
          title={t("archive.items")}
          rows={showing("items") ? counts.items : 0}
        >
          {data?.items.map((item) => (
            <div key={item.id} className={ROW_STATIC}>
              <span className="flex min-w-0 flex-grow flex-col gap-xxs">
                <span className="truncate text-[15px] font-semibold">
                  {pickLocalized(item.name)}
                </span>
                <span className="truncate text-[12px] text-text-faint">
                  {[
                    t("archive.inSection", {
                      name: pickLocalized(item.sectionTitle),
                    }),
                    t("archive.archivedOn", {
                      when: formatDate(item.archivedAt),
                    }),
                  ].join(" · ")}
                </span>
              </span>

              <span className="shrink-0 text-[13px] tabular-nums text-text-soft">
                {format(item.price, currencyCode)}
              </span>

              {/* Refused rather than mislaid, and the reason stands *in place of*
                the button rather than beside it: a disabled control with an
                explanation next to it still invites the press. What is needed
                here is the next step, which is the section. */}
              {item.sectionArchived ? (
                <span className="max-w-[260px] shrink-0 text-end text-[12px] text-danger">
                  {t("archive.sectionGoneFirst", {
                    name: pickLocalized(item.sectionTitle),
                  })}
                </span>
              ) : (
                <Restore
                  pending={restore.item.isPending}
                  onClick={() =>
                    restore.item.mutate({ id: item.id, name: item.name })
                  }
                />
              )}
            </div>
          ))}
        </Group>

        <Group
          title={t("archive.groups")}
          rows={showing("groups") ? counts.groups : 0}
        >
          {data?.groups.map((group) => (
            <div key={group.id} className={ROW_STATIC}>
              <span className="flex min-w-0 flex-grow flex-col gap-xxs">
                <span className="truncate text-[15px] font-semibold">
                  {pickLocalized(group.title)}
                </span>
                <span className="truncate text-[12px] text-text-faint">
                  {t("archive.onDish", { name: pickLocalized(group.itemName) })}
                </span>
              </span>
              <Restore
                pending={restore.group.isPending}
                onClick={() =>
                  restore.group.mutate({ id: group.id, name: group.title })
                }
              />
            </div>
          ))}
        </Group>

        <Group
          title={t("archive.options")}
          rows={showing("options") ? counts.options : 0}
        >
          {data?.options.map((option) => (
            <div key={option.id} className={ROW_STATIC}>
              <span className="flex min-w-0 flex-grow flex-col gap-xxs">
                <span className="truncate text-[15px] font-semibold">
                  {pickLocalized(option.name)}
                </span>
                <span className="truncate text-[12px] text-text-faint">
                  {t("archive.inQuestion", {
                    question: pickLocalized(option.groupTitle),
                    dish: pickLocalized(option.itemName),
                  })}
                </span>
              </span>

              <span className="shrink-0 text-[13px] tabular-nums text-text-soft">
                {option.price === 0
                  ? t("options.free")
                  : `+ ${format(option.price, currencyCode)}`}
              </span>

              <Restore
                pending={restore.option.isPending}
                onClick={() =>
                  restore.option.mutate({ id: option.id, name: option.name })
                }
              />
            </div>
          ))}
        </Group>
      </div>
    </div>
  );
}

/**
 * One kind of put-away thing.
 *
 * Empty groups are dropped rather than shown with a "none" line. Four headings
 * on a screen holding one archived dish is a page about its own structure, and
 * the operator came here to find one thing.
 */
function Group({
  title,
  rows,
  children,
}: {
  title: string;
  rows: number;
  children: ReactNode;
}) {
  if (rows === 0) return null;

  return (
    <section className="flex flex-col gap-sm">
      <h2 className="ps-md text-[13px] font-semibold uppercase tracking-wide text-text-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Mint, the theme's "going well" — the same button the drivers list uses to
 * bring somebody back. Restoring is the one action on this screen and it is a
 * restoration, so it should not be wearing the neutral grey of a Cancel.
 */
function Restore({
  pending,
  onClick,
}: {
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="accent"
      size="sm"
      className="shrink-0"
      pending={pending}
      onClick={onClick}
    >
      {t("archive.restore")}
    </Button>
  );
}
