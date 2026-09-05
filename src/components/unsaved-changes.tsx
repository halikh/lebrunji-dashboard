"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { t } from "@/i18n/translations";

/**
 * The one thing standing between a half-typed form and the click that discards
 * it.
 *
 * ## What it guards, and how each is different
 *
 * - **A link.** Caught by the document listener below, held, and released or
 *   not by the dialog. This covers moving between *pages*.
 * - **Everything else that leaves a form**, which is most of it and none of it
 *   a link: the tab strips are `<button>` calling `router.replace`, a Cancel
 *   calls `setOpen(null)`, a panel's X calls `onClose`, and clicking a second
 *   driver swaps a keyed editor out from under the first. Those are named one
 *   at a time with `useGuardedAction` — see the note on it for why they cannot
 *   be caught by a listener.
 * - **Signing out.** Already a confirmation; it grows a sentence when there is
 *   something to lose. See `SignOutButton`.
 * - **Closing the tab, or reloading.** `beforeunload`, which is the *browser's*
 *   dialog and cannot be styled or worded — browsers stopped honouring custom
 *   text years ago precisely because it was used to trap people. So that one
 *   looks like the browser rather than like this app, and there is no way to
 *   make it not.
 *
 * ## What is deliberately not guarded
 *
 * A **save that landed**. Several screens pass one `onClose` to both the Cancel
 * button and the mutation's `onSuccess`; guarding the prop rather than the
 * button would ask an operator whether to discard the thing they had just
 * successfully created. Where those share a handler, the call sites guard the
 * button and leave `onSuccess` alone.
 *
 * A **search box or a filter**. Both write the URL through `router.replace` on
 * every keystroke, and neither leaves anything. Guarding navigation wholesale
 * would put a dialog in front of typing.
 *
 * ## What it does not guard
 *
 * The **back button**. The App Router gives no cancellable hook for a history
 * pop — by the time `popstate` fires the navigation has happened, and the trick
 * for faking one (pushing a sentinel entry and pushing it back on every pop) is
 * how you end up with a tab whose Back button does nothing at all. Losing edits
 * to Back is bad; a browser control that silently stops working is worse.
 *
 * ## Why a registry rather than a prop
 *
 * A form does not know what is above it, and the rail does not know what is
 * below it. Forms say only "I have unsaved work" and the shell asks only "does
 * anything?" — so a new form is one line, and nothing has to be threaded
 * through the layout.
 *
 * The set lives in a **ref**. Dirtiness changes on almost every keystroke, and
 * a context value that changed with it would re-render the whole dashboard
 * under the operator's cursor. What is in state instead is the far coarser
 * "is anything dirty at all", which flips once per form rather than once per
 * character — and only `SignOutButton` reads it.
 */
type Guard = {
  /** Called by `useUnsavedChanges`. Idempotent. */
  setDirty: (id: string, dirty: boolean) => void;
  /**
   * Resolves true when it is safe to leave.
   *
   * Immediately true when nothing is dirty, so a caller can await it
   * unconditionally rather than checking first and racing its own check.
   */
  confirmLeave: () => Promise<boolean>;
  /** Whether anything at all is unsaved. Reactive; see above. */
  anyDirty: boolean;
};

const GuardContext = createContext<Guard | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const dirty = useRef<Set<string>>(new Set());
  const [anyDirty, setAnyDirty] = useState(false);

  // The dialog's answer, handed back to whoever asked. A ref rather than state
  // because storing a function in state means fighting the updater form of
  // `setState`, and this value is never rendered.
  const answer = useRef<((leave: boolean) => void) | null>(null);
  const [asking, setAsking] = useState(false);

  const setDirty = useCallback((id: string, isDirty: boolean) => {
    if (isDirty) dirty.current.add(id);
    else dirty.current.delete(id);
    setAnyDirty(dirty.current.size > 0);
  }, []);

  const confirmLeave = useCallback(() => {
    if (dirty.current.size === 0) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      answer.current = resolve;
      setAsking(true);
    });
  }, []);

  const settle = useCallback((leave: boolean) => {
    setAsking(false);
    const resolve = answer.current;
    answer.current = null;
    resolve?.(leave);
  }, []);

  /**
   * The tab closing, or reloading.
   *
   * Registered once and gated on the ref inside, rather than added and removed
   * as dirtiness changes: an effect that depended on `anyDirty` would run on
   * every flip, and the listener is cheap to leave in place.
   *
   * `preventDefault` is the modern spelling and `returnValue` the old one.
   * Both are set because Safari still wants the second, and a guard that works
   * in three browsers out of four is a guard nobody can rely on.
   */
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (dirty.current.size === 0) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /**
   * Every link in the dashboard, caught before it navigates.
   *
   * ## Why a document listener rather than a prop on `Link`
   *
   * Next's `Link` takes an `onNavigate` that can cancel, and using it would mean
   * remembering to pass a guard to every link in the app — the rail's six, the
   * breadcrumbs, every row that opens a record. The one that gets forgotten is
   * the one somebody loses an afternoon of menu edits to.
   *
   * A listener in the **capture** phase runs before React's own handler, so the
   * navigation can be stopped before Next has begun it. That is the whole reason
   * for `capture: true`; in the bubble phase the click has already been handled.
   *
   * ## What is deliberately let through
   *
   * Anything that is not a plain left-click on a same-tab, same-origin link:
   * a middle-click or ⌘/Ctrl-click opens a new tab and *leaves the form where it
   * is*, an external link is `beforeunload`'s business, and a download is not a
   * navigation at all. Guarding those would be asking a question with no stakes,
   * which is how a dialog trains people to dismiss it.
   */
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (dirty.current.size === 0) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      // A link to where you already are is not a way out of the form. The skip
      // link at the top of the layout is exactly this, and stopping to ask about
      // it would be absurd.
      const here = window.location.pathname + window.location.search;
      if (url.pathname + url.search === here) return;

      event.preventDefault();
      // Stops React's own handler, and Next's, from running after this one.
      event.stopPropagation();

      void confirmLeave().then((leave) => {
        if (leave) router.push(url.pathname + url.search + url.hash);
      });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [confirmLeave, router]);

  const value = useMemo<Guard>(
    () => ({ setDirty, confirmLeave, anyDirty }),
    [setDirty, confirmLeave, anyDirty],
  );

  return (
    <GuardContext.Provider value={value}>
      {children}

      <Modal
        open={asking}
        // Escape and the backdrop mean "no" — the safe answer, and the one that
        // keeps the work. A dismissal that discarded would be a trap.
        onClose={() => settle(false)}
        labelledBy="unsaved-title"
        describedBy="unsaved-body"
      >
        <h2 id="unsaved-title" className="pe-xxl text-[17px] font-semibold">
          {t("unsaved.title")}
        </h2>
        <p id="unsaved-body" className="mt-sm text-[15px] text-text-soft">
          {t("unsaved.body")}
        </p>

        <div className="mt-xxl flex justify-end gap-sm">
          {/*
            Keep editing is the safe answer, so it takes focus: Enter on a
            dialog that appeared unbidden must not be the destructive one. The
            same rule `ConfirmButton` follows, for the same reason.
          */}
          <Button variant="secondary" onClick={() => settle(false)} autoFocus>
            {t("unsaved.stay")}
          </Button>
          <Button variant="danger" onClick={() => settle(true)}>
            {t("unsaved.discard")}
          </Button>
        </div>
      </Modal>
    </GuardContext.Provider>
  );
}

/**
 * Declares that this form has work in it that is not saved.
 *
 * One line in a form, taking whatever that form already knows about itself:
 *
 * ```tsx
 * useUnsavedChanges(name !== initial.name || phone !== initial.phone);
 * ```
 *
 * The identity is a `useId`, so two of the same form open at once — a driver
 * panel and a shop panel — are counted separately, and one closing does not
 * clear the other's claim.
 *
 * Unregisters on unmount, which is what makes navigating away after a save
 * work: the form goes, its claim goes with it, and the next link is not
 * questioned.
 */
export function useUnsavedChanges(dirty: boolean): void {
  const guard = useContext(GuardContext);
  const id = useId();

  useEffect(() => {
    guard?.setDirty(id, dirty);
    return () => guard?.setDirty(id, false);
  }, [guard, id, dirty]);
}

/**
 * Ask, from code, whether it is alright to leave.
 *
 * For the ways out that are not a link — signing out is the one that exists
 * today. Resolves true immediately when there is nothing to lose, so the caller
 * can await it unconditionally.
 */
export function useConfirmLeave(): () => Promise<boolean> {
  const guard = useContext(GuardContext);
  return useMemo(
    () => guard?.confirmLeave ?? (() => Promise.resolve(true)),
    [guard],
  );
}

/**
 * Wraps an action so it asks before discarding work.
 *
 * ## Why this exists next to the link guard
 *
 * The document listener above catches anchors, and for a while that looked like
 * it caught everything — every *page* in this dashboard is reached by one. It
 * is not how you leave a **form**. The tab strips are `<button>` calling
 * `router.replace`, a Cancel calls `setOpen(null)`, a panel's X calls `onClose`:
 * three ways out that never touch an `<a>`, and all three are more likely than
 * clicking the rail.
 *
 * There is no listener that catches those without also catching Save, so they
 * are named one at a time. This makes naming one cheap:
 *
 * ```tsx
 * const guarded = useGuardedAction();
 * <Button onClick={guarded(() => setOpen(null))}>Cancel</Button>
 * ```
 *
 * The action runs unchanged when nothing is dirty, so wrapping something that
 * turns out never to need it costs a resolved promise.
 */
export function useGuardedAction(): (action: () => void) => () => void {
  const confirmLeave = useConfirmLeave();

  return useCallback(
    (action: () => void) => () => {
      void confirmLeave().then((leave) => {
        if (leave) action();
      });
    },
    [confirmLeave],
  );
}

/**
 * Whether anything in the dashboard is unsaved.
 *
 * For a control that needs to *say something different* when there is work to
 * lose, rather than merely ask afterwards — sign-out changes its sentence. This
 * re-renders its caller when the answer flips, which is why it is a separate
 * hook: a form should take `useUnsavedChanges` and not this.
 */
export function useAnyUnsaved(): boolean {
  return useContext(GuardContext)?.anyDirty ?? false;
}

/**
 * Whether a form's values have moved off what it opened with.
 *
 * ## Why not `===` per field
 *
 * Because half these forms hold objects — a `Localized` name, a week of hours —
 * and `===` on those is always false, which would mark every form dirty the
 * moment it mounted and make the dialog meaningless. Comparing by value is the
 * only version of this that is ever right.
 *
 * ## Why keys are sorted
 *
 * `JSON.stringify` writes keys in insertion order, and a `Localized` read from
 * the database and the same one after an edit put its languages in a different
 * order surprisingly often — `{en, ar}` against `{ar, en}` is the same name and
 * two different strings. Sorting makes the comparison about the values.
 *
 * Only plain JSON goes through here: strings, numbers, booleans, null, and
 * arrays and objects of those. That is what every form in this dashboard holds.
 */
export function changed(a: unknown, b: unknown): boolean {
  return canonical(a) !== canonical(b);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, held: unknown) => {
    if (held === null || typeof held !== "object" || Array.isArray(held))
      return held;

    // Order is not meaning for an object; it is for an array, which is why only
    // one of the two is sorted.
    return Object.fromEntries(
      Object.entries(held as Record<string, unknown>).sort(([one], [two]) =>
        one < two ? -1 : one > two ? 1 : 0,
      ),
    );
  });
}
