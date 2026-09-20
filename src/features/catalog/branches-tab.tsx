"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ImagePlaceholder, PreviewImage } from "@/components/ui/image-preview";
import { Button, cx } from "@/components/ui";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useRowFocus } from "@/components/ui/row-focus";
import { ROW, ROW_ABOVE, ROW_TARGET } from "@/components/ui/row";
import { SearchInput } from "@/components/ui/search-input";
import { useGuardedAction } from "@/components/unsaved-changes";
import { pickLocalized } from "@/i18n/db-text";
import { t } from "@/i18n/translations";

import type { Branch } from "./api/branches";
import { NoPinWarning } from "./no-pin-warning";
import { useArchiveBranch, useBranches } from "./use-branches";

import { useStore } from "./use-stores";

/**
 * The places one shop trades from.
 *
 * ## Why this is a tab and not a field on Details
 *
 * Because the shop that has one branch and the shop that has nine are the same
 * screen. Migration `0101` gave every existing shop a branch, so this list is
 * never empty and never has a "turn on branches" step — a chain is a shop with
 * more rows here, not a shop in a different mode.
 *
 * ## What moved off Details to get here
 *
 * The pin, the prep window, the WhatsApp number and the opening hours — all
 * four answer "where and when and how does an order reach a kitchen", and all
 * four are wrong the moment a shop has two addresses.
 *
 * That left Details holding three fields, which were briefly folded into the
 * branch editor and are now back on a Details tab of their own. The reason is
 * in `store-details.tsx`, and it is the picture: two records behind one Save,
 * each with an uploader, is a form where changing the shop's photograph changes
 * one branch's.
 *
 * ## And a branch may now differ on two of them
 *
 * `0110` gave `branches` an `image_url` and a `currency_code`, both nullable,
 * both meaning "the shop's" when absent. Not a copy — a live reference, so a
 * shop that changes either still moves every branch that has not set its own.
 * Every read here is therefore `branch ?? store`, and the money path in the
 * database resolves the same `coalesce` on the side that charges.
 */
export function BranchesTab({ storeId }: { storeId: string }) {
  const router = useRouter();
  /**
   * The shop the branches belong to — for the panel, which edits it, and for
   * the two things on a row that fall back to it.
   *
   * The **picture** is the branch's where it has set one and the shop's
   * otherwise. It used to be the shop's full stop, on the reasoning that giving
   * a branch its own would invite a merchant to photograph nine shopfronts to
   * fill a 46pt square — which was right about the effort and wrong about who
   * gets to decide. `0110` made it optional instead, so the default is still
   * one photograph for the chain and a branch that wants its own may have it.
   *
   * The **category** is the shop's too, and it repeats down the column
   * unchanged. That is the point rather than an oversight: the meta line reads
   * the same on both screens, so nobody has to work out whether a branch can
   * belong to a different one. (It cannot — `category_id` is on `stores`.)
   *
   * Already cached by the tab strip above, so this costs nothing.
   */
  const store = useStore(storeId);

  /**
   * What the operator typed.
   *
   * State rather than the URL: the shop page's query string already carries
   * `?tab=`, and a half-typed branch name is not a view anybody links to.
   *
   * It reaches the database rather than filtering the rows on screen — the
   * list is capped, so a client-side filter would search what was *read* and
   * quietly miss the rest. A chain long enough to need the box is exactly the
   * chain where that difference bites.
   */
  const [search, setSearch] = useState("");
  const branches = useBranches(storeId, search);
  const searching = search.trim().length > 0;
  const archive = useArchiveBranch(storeId);
  const guarded = useGuardedAction();

  /** Which row to bring back into view — see `useRowFocus`. */
  const focus = useRowFocus();

  const rows = branches.data ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-lg border-b border-border bg-surface px-xxl py-lg">
        <h2 className="shrink-0 text-[18px]">{t("branches.tab")}</h2>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("branches.searchPlaceholder")}
        />
        <Button
          onClick={guarded(() =>
            router.push(`/catalogue/${storeId}/branches/new`),
          )}
        >
          {t("branches.add")}
        </Button>
      </div>

      <div className="flex min-h-0 flex-grow flex-col gap-sm overflow-y-auto scroll-hint p-xxl">
        {/* Says why the tab exists on a shop with one branch, which is the
              first question it gets. */}
        <p className="ps-md text-[13px] text-text-faint">
          {t("branches.intro")}
        </p>

        {branches.isPending && (
          <div aria-hidden className="flex flex-col gap-sm">
            {[0, 1].map((row) => (
              <div key={row} className="h-[64px] rounded-md bg-neutral-fill" />
            ))}
          </div>
        )}

        {/* A search that matched nothing, said as its own state. Without it
            the list simply empties, which reads as a shop that has lost its
            branches rather than as a term that found none. */}
        {branches.isSuccess && rows.length === 0 && searching && (
          <p className="ps-md text-[13px] text-text-soft">
            {t("branches.noMatches")}
          </p>
        )}

        {rows.map((branch) => (
          <BranchRow
            key={branch.id}
            branch={branch}
            imageUrl={branch.imageUrl ?? store.data?.imageUrl ?? null}
            categoryName={store.data?.categoryName ?? ""}
            anchor={focus.attach(branch.id)}
            /**
             * The shop's only branch opens **Details**, not the branch editor.
             *
             * With one branch the two rows are one shopfront, and Details now
             * owns it — the name, the pin, the prep window, the WhatsApp
             * number, all writing through to this branch. What the branch
             * editor would still offer is a name nothing in the app draws, an
             * image and a currency that can only override the shop's with the
             * shop's own values, and an active switch that cannot be turned
             * off. Every field on it is a no-op, which is the decoy this whole
             * change is about.
             *
             * It opens normally the moment a second branch exists, because
             * then each of those fields means something.
             */
            onEdit={guarded(() =>
              router.push(
                !searching && rows.length === 1
                  ? `/catalogue/${storeId}?tab=details`
                  : `/catalogue/${storeId}/branches/${branch.id}`,
              ),
            )}
            /* Its own page rather than a tab on the editor: the editor is a
                 form with a Save, and this is a list of switches that write as
                 they are flipped. One header over both would make the Save look
                 as though it governed them. */
            onShowMenu={guarded(() =>
              router.push(`/catalogue/${storeId}/branches/${branch.id}/menu`),
            )}
            onClose={async () => {
              await archive.mutateAsync({
                id: branch.id,
                name: pickLocalized(branch.name),
                live: rows.length,
              });
            }}
            /**
             * Whether this row is the whole shop.
             *
             * A shop that has never been thought about as a chain has exactly
             * the one branch migration `0101` gave it, named after itself —
             * which is what the merchant sees here, and it reads as the store
             * rather than as a place the store trades from. Neither action on
             * the row means anything in that state:
             *
             * - **Close** was already impossible. A shop with no branches is
             *   listed, has a menu, and has nowhere for an order to arrive, so
             *   the button was rendered at 40% and swallowed its own clicks —
             *   a control whose only job was to look unavailable.
             * - **Menu here** offers to hide items and override prices *at
             *   this branch*, and there is nothing to differ from. Every
             *   override would apply everywhere the shop trades, which is what
             *   the Menu tab already edits.
             *
             * Both come back the moment a second branch exists, including on
             * this row: once there are two places, the first one is a place
             * like any other and its menu really can differ.
             *
             * `archiveBranch` still refuses the last branch on its own — a
             * stale list is the one case a hidden button does not cover.
             */
            /* Never while searching: `rows.length` is then how many
               *matched*, and one match in a chain of nine would hide Close and
               Menu here on a branch that is not the shop's only one. Unfiltered
               it is the count it has always been. */
            soleBranch={!searching && rows.length === 1}
          />
        ))}
      </div>
    </div>
  );
}

function BranchRow({
  branch,
  imageUrl,
  categoryName,
  anchor,
  onEdit,
  onShowMenu,
  onClose,
  soleBranch,
}: {
  branch: Branch;
  /** This branch's picture, already resolved against the shop's by the caller. */
  imageUrl: string | null;
  /** The shop's category, repeated down the column on purpose. */
  categoryName: string;
  anchor: (node: HTMLElement | null) => void;
  onEdit: () => void;
  onShowMenu: () => void;
  onClose: () => Promise<void>;
  /** The shop's only branch — see the call site. Renders no actions. */
  soleBranch: boolean;
}) {
  const name = pickLocalized(branch.name);
  const pinned = branch.latitude !== null && branch.longitude !== null;

  return (
    <div
      ref={anchor}
      className={cx(
        ROW,
        !branch.isActive && "border-danger-wash bg-danger-wash/30",
        branch.isActive && "border-border",
      )}
    >
      {/* The same 46pt square the shops list draws, greyed the same way when
          the row is hidden — a branch row should read as the same kind of
          object as the shop row the operator arrived from. The placeholder is
          not optional: without it the rows of a shop that has no picture line
          up differently from every other list in the app. */}
      {imageUrl ? (
        <PreviewImage
          src={imageUrl}
          name={name}
          className={cx(
            "size-[46px] rounded-md",
            !branch.isActive && "opacity-50 grayscale",
          )}
        />
      ) : (
        <ImagePlaceholder className="size-[46px] rounded-md" />
      )}

      <button
        type="button"
        onClick={onEdit}
        // `ROW_TARGET` stretches this button's hit area over the whole row —
        // see `row.ts`. The row's own controls carry `ROW_ABOVE`.
        className={cx(
          ROW_TARGET,
          "flex min-w-0 flex-grow flex-col items-start gap-xxs text-left",
        )}
      >
        <span className="flex items-center gap-sm">
          <span className="truncate text-[15px] font-semibold">{name}</span>
          {/* Said in words, not only in colour — the same badge the shops list
              puts on a shop that is off the storefront. */}
          {!branch.isActive && (
            <span className="shrink-0 rounded-full bg-danger-wash px-sm text-[11px] font-bold text-danger">
              {t("branches.notTrading")}
            </span>
          )}
        </span>

        {/* The shops list's meta line, with the half that is now the branch's.
            The category is the brand's and repeats; the prep window is this
            kitchen's, and since `0101` it is the only place it lives. */}
        <span className="truncate text-[12px] text-text-faint">
          {categoryName ? `${categoryName} · ` : ""}
          {t("catalogue.prep", {
            min: branch.prepMinMinutes,
            max: branch.prepMaxMinutes,
          })}
        </span>

        {/* An unpinned branch charges every order at the top distance band —
            and since `0109` the distance is measured from *here*, so this is
            the row where it actually bites. Same warning, same words as the
            shops list. */}
        {!pinned && <NoPinWarning />}
      </button>

      {/* Nothing on a one-branch shop — the row is the store, and both of these
          are answers to questions only a chain can ask. See the call site. */}
      {!soleBranch && (
        <>
          <Button variant="primary-quiet" size="sm" onClick={onShowMenu}>
            {t("branches.menuHere")}
          </Button>

          <ConfirmButton
            className={ROW_ABOVE}
            onConfirm={onClose}
            titleKey="branches.closeTitle"
            bodyKey="branches.closeBody"
            confirmKey="branches.closeConfirm"
            params={{ name }}
            variant="danger"
            triggerVariant="danger-quiet"
            size="sm"
          >
            {t("branches.closeConfirm")}
          </ConfirmButton>
        </>
      )}
    </div>
  );
}
