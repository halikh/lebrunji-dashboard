"use client";

import { AlertTriangle, ArchiveRestore, Inbox, SearchX } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  SearchInput,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { useMoney } from "@/features/reference/use-currencies";
import { pickLocalized } from "@/i18n/db-text";
import { t, type TranslationKey } from "@/i18n/translations";
import { formatDate } from "@/lib/time";
import type { Localized } from "@/lib/validation";

import { useArchive, useRestore } from "../use-menu";
import { useStore } from "../use-stores";

/**
 * Everything this shop has put away, and the way back.
 *
 * Nothing in this product is really deleted — order lines point at dishes and
 * choices for ever — so archiving writes `deleted_at` and withdrawing writes
 * `is_active = false`. Without this tab the only effect of either was that
 * something vanished.
 *
 * Two mechanisms, and the headings keep the product's own words: sections and
 * dishes are **archived**, questions and choices **withdrawn** (they have no
 * `deleted_at`, by `0019`'s design), branches **closed**. Every row says where
 * it would come back to — for a dish that decides whether it can at all,
 * because a dish restored into an archived section is listed nowhere, so the
 * row says "bring the section back first" in place of the button.
 */

type Kind = "all" | "sections" | "items" | "groups" | "options" | "branches";

const KINDS: { key: Kind; labelKey: TranslationKey }[] = [
  { key: "all", labelKey: "archive.all" },
  { key: "sections", labelKey: "archive.sections" },
  { key: "items", labelKey: "archive.items" },
  { key: "groups", labelKey: "archive.groups" },
  { key: "options", labelKey: "archive.options" },
  // Last: the rarest, and the only kind that is not the menu coming apart.
  { key: "branches", labelKey: "archive.branches" },
];

type Asking = {
  name: string;
  body: TranslationKey;
  run: () => Promise<unknown>;
};

export function ShopArchiveTab({ storeId }: { storeId: string }) {
  // Component state, not the URL: which kind you were looking at is not worth
  // linking to, and the shop page already spends its query string on `?tab=`.
  const [kind, setKind] = useState<Kind>("all");
  // Reaches the database, all five reads: an archive only grows, and what is
  // hunted for is by definition old — past what a capped read would hold.
  const [search, setSearch] = useState("");
  const archive = useArchive(storeId, search);
  const restore = useRestore(storeId);
  const store = useStore(storeId);
  const { format } = useMoney();
  const [asking, setAsking] = useState<Asking | null>(null);

  const currencyCode = store.data?.currencyCode ?? "";
  const data = archive.data;
  const searching = search.trim().length > 0;

  if (archive.isError) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title={t("archive.failedTitle")}
        description={t("archive.hint")}
        action={
          <Button onClick={() => void archive.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  // Before the first answer, above the strip too: a strip of zeros that is
  // then taken away by an empty state reads as a glitch.
  if (archive.isPending || data === undefined) {
    return (
      <div aria-hidden className="flex flex-col gap-3">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const counts: Record<Kind, number> = {
    sections: data.sections.length,
    items: data.items.length,
    groups: data.groups.length,
    options: data.options.length,
    branches: data.branches.length,
    all:
      data.sections.length +
      data.items.length +
      data.groups.length +
      data.options.length +
      data.branches.length,
  };

  // Empty *and* nothing typed. A search that found nothing keeps the box, so
  // the term can be corrected.
  if (counts.all === 0 && !searching) {
    return (
      <EmptyState
        icon={<Inbox />}
        title={t("archive.emptyTitle")}
        description={t("archive.emptyBody")}
      />
    );
  }

  const showing = (which: Kind) => kind === "all" || kind === which;
  const ask = (name: Localized, body: TranslationKey, run: Asking["run"]) =>
    setAsking({ name: pickLocalized(name), body, run });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("archive.searchStorePlaceholder")}
            className="w-full sm:w-80"
          />
          <p className="text-[13px] text-ink-3">{t("archive.hint")}</p>
        </div>
        <Tabs
          items={KINDS.map(({ key, labelKey }) => ({
            key,
            label: t(labelKey),
            count: counts[key],
          }))}
          value={kind}
          onChange={setKind}
        />
      </div>

      {counts[kind] === 0 && (
        <EmptyState
          icon={<SearchX />}
          title={searching ? t("archive.noMatches") : t("archive.noneOfThese")}
          description={
            searching
              ? t("archive.noMatchesBody")
              : t("archive.noneOfTheseBody")
          }
        />
      )}

      {/* Sections first: a dish cannot come back until its section has. */}
      {showing("sections") && (
        <Group title={t("archive.sections")} count={counts.sections}>
          {data.sections.map((section) => (
            <Row
              key={section.id}
              title={pickLocalized(section.title)}
              meta={t("archive.archivedOn", {
                when: formatDate(section.archivedAt),
              })}
              action={
                <RestoreButton
                  onClick={() =>
                    ask(section.title, "archive.restoreSection", () =>
                      restore.section.mutateAsync({
                        id: section.id,
                        name: section.title,
                      }),
                    )
                  }
                />
              }
            />
          ))}
        </Group>
      )}

      {showing("items") && (
        <Group title={t("archive.items")} count={counts.items}>
          {data.items.map((item) => (
            <Row
              key={item.id}
              title={pickLocalized(item.name)}
              meta={[
                t("archive.inSection", {
                  name: pickLocalized(item.sectionTitle),
                }),
                t("archive.archivedOn", { when: formatDate(item.archivedAt) }),
              ].join(", ")}
              value={format(item.price, currencyCode)}
              action={
                // Refused rather than mislaid: the reason stands in place of
                // the button, since what is needed is the section first.
                item.sectionArchived ? (
                  <span className="max-w-56 text-end text-[12.5px] text-ink-3">
                    {t("archive.sectionGoneFirst", {
                      name: pickLocalized(item.sectionTitle),
                    })}
                  </span>
                ) : (
                  <RestoreButton
                    onClick={() =>
                      ask(item.name, "archive.restoreItem", () =>
                        restore.item.mutateAsync({
                          id: item.id,
                          name: item.name,
                        }),
                      )
                    }
                  />
                )
              }
            />
          ))}
        </Group>
      )}

      {showing("groups") && (
        <Group title={t("archive.groups")} count={counts.groups}>
          {data.groups.map((group) => (
            <Row
              key={group.id}
              title={pickLocalized(group.title)}
              meta={t("archive.onDish", {
                name: pickLocalized(group.itemName),
              })}
              action={
                <RestoreButton
                  onClick={() =>
                    ask(group.title, "archive.restoreGroup", () =>
                      restore.group.mutateAsync({
                        id: group.id,
                        name: group.title,
                      }),
                    )
                  }
                />
              }
            />
          ))}
        </Group>
      )}

      {showing("options") && (
        <Group title={t("archive.options")} count={counts.options}>
          {data.options.map((option) => (
            <Row
              key={option.id}
              title={pickLocalized(option.name)}
              meta={t("archive.inQuestion", {
                question: pickLocalized(option.groupTitle),
                dish: pickLocalized(option.itemName),
              })}
              value={
                option.price === 0
                  ? t("options.free")
                  : t("store.plusPrice", {
                      price: format(option.price, currencyCode),
                    })
              }
              action={
                <RestoreButton
                  onClick={() =>
                    ask(option.name, "archive.restoreOption", () =>
                      restore.option.mutateAsync({
                        id: option.id,
                        name: option.name,
                      }),
                    )
                  }
                />
              }
            />
          ))}
        </Group>
      )}

      {showing("branches") && (
        <Group title={t("archive.branches")} count={counts.branches}>
          {data.branches.map((branch) => (
            <Row
              key={branch.id}
              title={pickLocalized(branch.name)}
              // "Closed", not "Archived" — the Branches tab's own word.
              meta={t("archive.closedOn", {
                when: formatDate(branch.archivedAt),
              })}
              action={
                <RestoreButton
                  onClick={() =>
                    ask(branch.name, "archive.restoreBranch", () =>
                      restore.branch.mutateAsync({
                        id: branch.id,
                        name: branch.name,
                      }),
                    )
                  }
                />
              }
            />
          ))}
        </Group>
      )}

      {/* Asks, because restoring is outward-facing — a dish is orderable the
          moment it lands — and the question names the row, which is what
          catches the wrong one. */}
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={t("archive.restoreTitle", { name: asking?.name ?? "" })}
        description={asking ? t(asking.body, { name: asking.name }) : undefined}
        confirmLabel={t("archive.restoreConfirm")}
        onConfirm={async () => {
          try {
            await asking?.run();
          } catch {
            // Reported by the hook's toast, refusals included.
          }
        }}
      />
    </div>
  );
}

/** One kind of put-away thing; dropped entirely when it holds nothing. */
function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
        {title}
        <span className="text-[12.5px] font-normal text-ink-4 tabular-nums">
          {count}
        </span>
      </h3>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-xs">
        {children}
      </ul>
    </section>
  );
}

function Row({
  title,
  meta,
  value,
  action,
}: {
  title: string;
  meta: string;
  value?: string;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[14px] font-medium text-ink">{title}</p>
        <p className="truncate text-[12.5px] text-ink-3">{meta}</p>
      </div>
      {value && (
        <span className="shrink-0 text-[13px] text-ink-2 tabular-nums">
          {value}
        </span>
      )}
      <div className="shrink-0">{action}</div>
    </li>
  );
}

function RestoreButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick}>
      <ArchiveRestore />
      {t("archive.restore")}
    </Button>
  );
}
