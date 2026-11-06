"use client";

import { AlertTriangle, ArrowRight, ChevronDown } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";

import { Badge, Button, Dialog, NativeSelect, cx } from "@/components/ui";
import { ChoiceList } from "@/components/ui/choice-list";
import { Price } from "@/features/reference/price";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Branch } from "../api/branches";
import type { MenuSection } from "../api/menu";
import type { Store } from "../api/stores";
import {
  useBranchOverrides,
  useCopyBranchPrices,
  type BranchMenuOverrides,
} from "../use-branch-menu";
import { useStoreQuestions } from "../use-options";

import { BranchLabel } from "./branch-label";
import { movedCount, previewCopy, type CopyPreview } from "./copy-prices";
import { Notice } from "./form-bits";

type Scope = "whole" | "section";

/**
 * The one way to copy prices into a branch: from which branch, the whole menu
 * or one section, and — before anything is written — what that would change.
 *
 * ## Said before it is done
 *
 * `copy_branch_prices` rewrites a price list in one statement, so the dialog
 * reads the source's prices the same way the Menu tab reads this branch's
 * (`useBranchOverrides`) and works out the outcome here (`previewCopy`, which
 * mirrors the RPC's rule). "12 dishes will change price" is checkable; a bare
 * "Copy prices?" is not. When nothing would change, it says so and there is
 * nothing to press.
 *
 * ## Never across currencies
 *
 * A price is digits with no currency of its own, and the RPC refuses two
 * branches that charge in different ones (`0229`). Such a branch is still
 * listed — the operator is looking for it — marked with its currency, and
 * choosing it says why it cannot be copied from instead of sending a request
 * that would fail.
 *
 * Mounted only while open, so it starts fresh each time and reads nothing
 * until it is asked.
 */
export function CopyPricesDialog({
  storeId,
  store,
  branch,
  others,
  sections,
  target,
  onClose,
}: {
  storeId: string;
  store: Store | null;
  branch: Branch;
  /** The shop's other branches. Never empty — the button is hidden then. */
  others: Branch[];
  /** Sections with dishes, in menu order, with their full path. */
  sections: { section: MenuSection; path: string }[];
  /** This branch's own prices, as the Menu tab already has them. */
  target: BranchMenuOverrides;
  onClose: () => void;
}) {
  const copy = useCopyBranchPrices(branch.id);
  const shopCode = store?.currencyCode ?? "";
  const codeOf = (one: Branch) => one.currencyCode ?? shopCode;
  const targetCode = codeOf(branch);
  const name = pickLocalized(branch.name);

  const [sourceId, setSourceId] = useState(
    () => (others.find((one) => codeOf(one) === targetCode) ?? others[0]).id,
  );
  const source = others.find((one) => one.id === sourceId) ?? others[0];
  const sourceCode = codeOf(source);
  const sameMoney = sourceCode === targetCode;
  const from = pickLocalized(source.name);

  const [scope, setScope] = useState<Scope>("whole");
  const [sectionId, setSectionId] = useState(sections[0]?.section.id ?? "");
  const section =
    scope === "section"
      ? (sections.find((one) => one.section.id === sectionId) ?? null)
      : null;

  const sourcePrices = useBranchOverrides(sameMoney ? source.id : null);
  const questions = useStoreQuestions(storeId);

  const preview = useMemo<CopyPreview | null>(() => {
    if (!sourcePrices.data || !questions.data) return null;
    const scoped = section ? [section] : sections;
    return previewCopy({
      items: scoped.flatMap(({ section: one }) =>
        one.items.map((item) => ({
          id: item.id,
          name: pickLocalized(item.name),
          shopPrice: item.price,
        })),
      ),
      questions: questions.data,
      source: sourcePrices.data,
      target,
    });
  }, [sourcePrices.data, questions.data, section, sections, target]);

  const moved = preview ? movedCount(preview) : 0;
  const busy = copy.isPending;

  async function confirm() {
    try {
      await copy.mutateAsync({
        fromBranchId: source.id,
        fromName: from,
        sectionId: section?.section.id ?? null,
      });
      onClose();
    } catch {
      // Reported by the hook's toast; the dialog stays for a retry.
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !busy && onClose()}
      title={t("branchMenu.copyTitle", { name })}
      description={t("branchMenu.copyBody", { from, to: name })}
      size="md"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            pending={busy}
            disabled={!sameMoney || moved === 0}
            onClick={() => void confirm()}
          >
            {moved === 1
              ? t("branchMenu.copyConfirmOne")
              : t("branchMenu.copyConfirm", { count: moved })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Step title={t("branchMenu.copyFrom")}>
          {(label) => (
            <div className="max-h-64 overflow-y-auto pe-1 scrollbar-thin">
              <ChoiceList
                label={label}
                value={source.id}
                onChange={setSourceId}
                disabled={busy}
                choices={others.map((one) => ({
                  value: one.id,
                  label: (
                    <BranchLabel
                      branch={one}
                      aside={
                        codeOf(one) !== targetCode ? (
                          <Badge tone="neutral">
                            {t("branchMenu.copyOtherCurrency", {
                              code: codeOf(one),
                            })}
                          </Badge>
                        ) : undefined
                      }
                    />
                  ),
                }))}
              />
            </div>
          )}
        </Step>

        <Step title={t("branchMenu.copyWhat")}>
          {(label) => (
            <ChoiceList<Scope>
              label={label}
              value={scope}
              onChange={setScope}
              disabled={busy}
              choices={[
                { value: "whole", label: t("branchMenu.copyWhole") },
                {
                  value: "section",
                  label: t("branchMenu.copySection"),
                  children: (
                    <NativeSelect
                      aria-label={t("branchMenu.copySectionLabel")}
                      value={sectionId}
                      disabled={busy}
                      onChange={(event) => setSectionId(event.target.value)}
                      className="w-full sm:w-72"
                    >
                      {sections.map((one) => (
                        <option key={one.section.id} value={one.section.id}>
                          {one.path}
                        </option>
                      ))}
                    </NativeSelect>
                  ),
                },
              ]}
            />
          )}
        </Step>

        {!sameMoney ? (
          <Notice tone="warning" icon={<AlertTriangle />}>
            {t("branchMenu.copyCurrencyRefused", {
              from,
              fromCode: sourceCode,
              to: name,
              toCode: targetCode,
            })}
          </Notice>
        ) : sourcePrices.isError || questions.isError ? (
          <Notice tone="danger" icon={<AlertTriangle />}>
            {t("branchMenu.copyFailed", { name: from })}
          </Notice>
        ) : !preview ? (
          <p role="status" className="text-[13.5px] text-ink-3">
            {t("branchMenu.copyLoading")}
          </p>
        ) : (
          <PreviewSummary
            preview={preview}
            from={from}
            code={targetCode}
            shopRate={
              branch.currencyCode === null || branch.currencyCode === shopCode
                ? (store?.exchangeRate ?? null)
                : null
            }
          />
        )}
      </div>
    </Dialog>
  );
}

/** A titled step of the dialog; the title names the radio group too. */
function Step({
  title,
  children,
}: {
  title: string;
  children: (label: string) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {children(title)}
    </div>
  );
}

function counted(dishes: number, choices: number): string {
  const dish =
    dishes === 1
      ? t("branchMenu.dishCountOne")
      : t("branchMenu.dishCount", { count: dishes });
  const choice =
    choices === 1
      ? t("branchMenu.choiceCountOne")
      : t("branchMenu.choiceCount", { count: choices });
  if (dishes > 0 && choices > 0)
    return t("branchMenu.copyAnd", { a: dish, b: choice });
  return dishes > 0 ? dish : choice;
}

function PreviewSummary({
  preview,
  from,
  code,
  shopRate,
}: {
  preview: CopyPreview;
  from: string;
  code: string;
  shopRate: number | null;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (movedCount(preview) === 0) {
    return (
      <p
        role="status"
        className="rounded-md bg-subtle px-3 py-2.5 text-[13.5px] text-ink-2"
      >
        {t("branchMenu.copyNothing", { from })}
      </p>
    );
  }

  const sentences = [
    preview.dishesChange + preview.choicesChange > 0
      ? t("branchMenu.copyWillChange", {
          what: counted(preview.dishesChange, preview.choicesChange),
        })
      : null,
    preview.dishesBack + preview.choicesBack > 0
      ? t("branchMenu.copyWillGoBack", {
          what: counted(preview.dishesBack, preview.choicesBack),
        })
      : null,
    preview.same > 0
      ? preview.same === 1
        ? t("branchMenu.copySameOne")
        : t("branchMenu.copySame", { count: preview.same })
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-subtle px-3 py-2.5">
      <p role="status" className="text-[13.5px] text-ink-2">
        {sentences.join(" ")}
      </p>
      {preview.dishes.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="-ms-2 w-fit text-ink-3"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
          >
            {open
              ? t("branchMenu.copyHideChanges")
              : t("branchMenu.copyShowChanges")}
            <ChevronDown
              className={cx("transition-transform", open && "rotate-180")}
            />
          </Button>
          {open && (
            <ul
              id={listId}
              className="flex max-h-60 flex-col divide-y divide-line overflow-y-auto rounded-md border border-line bg-surface scrollbar-thin"
            >
              {preview.dishes.map((dish) => (
                <li
                  key={dish.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]"
                >
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {dish.name}
                  </span>
                  <span className="flex items-center gap-2 text-ink-3">
                    <Price value={dish.from} code={code} shopRate={shopRate} />
                    <ArrowRight
                      aria-hidden
                      className="size-3.5 shrink-0 rtl:rotate-180"
                    />
                    <Price
                      value={dish.to}
                      code={code}
                      shopRate={shopRate}
                      className="font-medium text-ink"
                    />
                    {dish.backToShop && (
                      <Badge tone="neutral">
                        {t("branchMenu.copyBackToShop")}
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
