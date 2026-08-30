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

/** Joins class names, dropping the falsey ones. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
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
        "items-center justify-center gap-sm rounded-md font-semibold",
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

/**
 * A labelled control with room for an error.
 *
 * The error is wired to the input with `aria-describedby` and announced with
 * `role="alert"`, because a message only a sighted person notices is half a
 * message. `htmlFor`/`id` are required rather than optional for the same
 * reason — a placeholder is not a label.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={id} className="text-[13px] font-semibold text-text-soft">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[13px] text-text-faint">{hint}</p>}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-[13px] font-medium text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({
  invalid = false,
  className,
  ref,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  // React 19 passes `ref` as an ordinary prop to function components, so no
  // `forwardRef` wrapper is needed — but the type has to say so.
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <input
      {...rest}
      ref={ref}
      aria-invalid={invalid || undefined}
      aria-describedby={
        invalid && rest.id ? `${rest.id}-error` : rest["aria-describedby"]
      }
      className={cx(
        "w-full rounded-md border bg-surface px-md py-md text-[15px] text-text",
        "placeholder:text-text-faint",
        // A shade warmer while it is being typed into — "this one is live",
        // not "this one is highlighted". The app does the same.
        //
        // No ring of its own: the focus ring is one rule in `globals.css`, and
        // it applies here. A second one declared on the input was both a
        // duplicate and a divergence waiting to happen — the button next to it
        // would have focused differently.
        "focus:bg-field-focus",
        invalid ? "border-danger" : "border-border",
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
