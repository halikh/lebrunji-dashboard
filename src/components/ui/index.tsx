/**
 * The primitives. Everything visible is made of these.
 *
 * None of them declares a `transition`. Focus, hover and colour changes are
 * animated once, in `globals.css`, for every interactive element — a component
 * that declared its own would *replace* that list rather than extend it, and
 * whichever property it left out would be the one that snapped.
 *
 * ## Why they are written here rather than installed
 *
 * The app already has a considered design system — `src/theme/colors.ts`,
 * `spacing.ts`, `radius.ts`, `typography.ts` — with the roles worked out and
 * the contrast ratios measured. A component library would arrive with its own
 * answers to all of that, and the work would become bending it back toward the
 * app's rather than building screens. These are small enough that writing them
 * is the cheaper half of that trade.
 *
 * ## The rules they encode
 *
 * - **Coral is what you press next**, blue is what can be acted on. So `Button`
 *   defaults to coral and links are blue. See `theme.css`.
 * - **Every action can be in flight**, so pending is a prop on the button
 *   rather than something each screen re-invents.
 * - **No component names a colour.** Roles only.
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
} from "react";

import { useFieldWiring } from "./field";

/** Joins class names, dropping the falsey ones. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  | "danger"
  | "danger-quiet"
  | "primary-quiet"
  | "accent";
type ButtonSize = "md" | "sm";

/**
 * Size is a prop, not something a caller patches on with a class.
 *
 * Passing `px-sm` to a button that already says `px-lg` looks like it should
 * win — it is written later — and it does not. Tailwind emits both, they have
 * equal specificity, and the one that applies is whichever the stylesheet
 * happens to order last. So the override is a coin toss that changes when an
 * unrelated utility is used somewhere else in the app.
 *
 * Enumerating the sizes here means there is nothing to override.
 */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  md: "px-lg py-md text-[15px]",
  sm: "px-md py-sm text-[13px]",
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Coral: the one to press to go on. White on it is 3.1:1 — the design's call,
  // recorded in `colors.ts` with the number in hand rather than around it.
  primary: "bg-active-fill text-on-active hover:brightness-95",
  secondary: "bg-neutral-fill text-text hover:brightness-[0.97]",
  quiet: "bg-transparent text-primary hover:bg-primary-wash",
  // `danger-action`, not `danger`: the darker red is tuned for text on cream and
  // reads as near-black poured across a whole button.
  danger: "bg-danger-action text-on-active hover:brightness-95",
  /**
   * Destructive, on a wash rather than a fill — `danger`'s half of the same
   * pattern `primary-quiet` is.
   *
   * For a destructive action that repeats down a list. `danger` filled is right
   * for the one action on a screen; a column of filled red buttons is a page
   * nobody reads, and the warning stops meaning anything by the fourth row.
   *
   * It was `bg-transparent`, which is what `quiet` means unprefixed — and that
   * put it out of step with the only thing it ever appears beside. On the
   * branch row it sits next to a `primary-quiet` button, so one of the pair had
   * a ground and the other did not, and the red one read as unavailable rather
   * than as the quieter of two live controls. In this palette `X-quiet` is X's
   * wash; `quiet` is the transparent one.
   *
   * `danger`, not `danger-action`, because this is **type**: the darker red is
   * the one tuned for text on cream, and on the tint behind it here it is well
   * clear of 4.5:1.
   */
  "danger-quiet": "bg-danger-wash text-danger hover:brightness-95",
  /**
   * A filled ground without the weight of the primary action.
   *
   * For the second-most-likely thing to press when it needs to look pressable
   * — beside a coral Save, a blue-on-tint button reads as a real button and
   * still loses the contest for the eye, which is what a secondary action
   * should do.
   */
  "primary-quiet": "bg-primary-wash text-primary hover:brightness-95",
  /**
   * The product's success colour — mint, the theme's "going well".
   *
   * For an action that *restores* something: bringing a driver back, lifting a
   * suspension. `secondary` was wrong for those in a way worth naming — grey
   * beside a red "Deactivate" says the two are peers, when one puts somebody
   * back on the rota and the other takes them off it.
   *
   * **`accent-deep`, not `accent`.** White on mint measures 2.5:1, under even
   * the 3:1 a graphic wants, and this variant carries a *label*. The deep mint
   * is 5.9:1 and still unmistakably the same green — the same reasoning the
   * coral note above records, reaching the opposite answer because the number
   * came out differently.
   */
  accent: "bg-accent-deep text-on-accent hover:brightness-110",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  pending = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fills its container. `flex`, not `inline-flex`, so centring actually has room to work. */
  fullWidth?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      {...rest}
      // A pending button that stays clickable is how an order gets advanced
      // twice, so this is not only cosmetic.
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cx(
        // `items-center justify-center` centres the icon against the label and
        // the pair against the button. Both matter: a button wide enough to
        // have spare room will show the difference.
        // A label never wraps, and a button never shrinks below it.
        //
        // "New category" beside a `flex-grow` search box wrapped onto two
        // lines and made the button twice as tall as everything around it.
        // Wrapping is the wrong answer for a control whose whole job is one
        // short verb: it is the *field* that should give up width, not the
        // action. `shrink-0` is what says so in a flex row.
        "shrink-0 items-center justify-center gap-sm whitespace-nowrap rounded-md font-semibold",
        "disabled:cursor-not-allowed disabled:opacity-60",
        fullWidth ? "flex w-full" : "inline-flex",
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-[14px] animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

// ---------------------------------------------------------------------------
// Field + Input
// ---------------------------------------------------------------------------

export function Input({
  invalid,
  padding = "px-md",
  className,
  ref,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  /** Overrides the field's own verdict. Rarely needed. */
  invalid?: boolean;
  /**
   * Horizontal padding, as a prop rather than a class to override.
   *
   * `className="ps-[42px]"` on top of a base `px-md` looks like it should win
   * and does not: `padding-left` and `padding-inline-start` are different
   * properties resolving to the same computed value, so which one applies
   * depends on stylesheet order — the same coin-toss the `Button` size prop was
   * added to remove. Replacing the value leaves nothing to conflict.
   */
  padding?: string;
  // React 19 passes `ref` as an ordinary prop to function components, so no
  // `forwardRef` wrapper is needed — but the type has to say so.
  ref?: Ref<HTMLInputElement>;
}) {
  // Taken from the surrounding `Field` when there is one. Doing this by hand at
  // each call site is how `aria-describedby` goes missing: nothing looks wrong
  // on screen without it — the error is drawn, it is simply never read out.
  const field = useFieldWiring();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <input
      {...rest}
      ref={ref}
      id={rest.id ?? field?.id}
      aria-invalid={isInvalid || undefined}
      aria-describedby={rest["aria-describedby"] ?? field?.describedBy}
      className={cx(
        "w-full rounded-md border bg-surface py-md text-[15px] text-text",
        padding,
        "placeholder:text-text-faint",
        // A shade warmer while it is being typed into — "this one is live",
        // not "this one is highlighted". The app does the same.
        //
        // No ring of its own: the focus ring is one rule in `globals.css`, and
        // it applies here. A second one declared on the input was both a
        // duplicate and a divergence waiting to happen — the button next to it
        // would have focused differently.
        "focus:bg-field-focus",
        isInvalid ? "border-danger" : "border-border",
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-border bg-surface p-xxl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The form-level error line.
 *
 * Separate from `Field`'s error because it answers a different question: a
 * field error says "this value is wrong", this says "the whole thing did not
 * go through". Rendering the second one inside a field would attach the blame
 * to an input that may be perfectly fine.
 */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-md bg-danger-wash px-md py-md text-[14px] font-medium text-danger"
    >
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-md bg-accent-wash px-md py-md text-[14px] font-medium text-accent-deep">
      {children}
    </p>
  );
}

// Re-exported so a screen imports its form pieces from one place.
export { Field, useFieldWiring } from "./field";
