import { t, type TranslationKey } from "@/i18n/translations";

import { cx } from "./index";

/**
 * What a screen shows when it has nothing to show.
 *
 * An empty screen is a state, not an absence, and the difference matters here:
 * "no orders right now" and "orders failed to load" look identical if neither
 * is drawn. Every list in this dashboard renders one of four things — idle,
 * loading, empty, failed — and this is the third.
 *
 * `mood` is which face the mascot pulls. It is a small thing and it is the
 * reason an empty queue reads as *quiet* rather than as *broken*, which is the
 * single most common misreading of a blank screen.
 */
export function EmptyState({
  titleKey,
  bodyKey,
  mood = "waiting",
  className,
}: {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  mood?: "waiting" | "done" | "lost";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex h-full flex-col items-center justify-center gap-lg px-xxl py-huge text-center",
        className,
      )}
    >
      <Placeholder mood={mood} />
      <div className="flex max-w-[380px] flex-col gap-xs">
        <h2 className="text-[18px]">{t(titleKey)}</h2>
        <p className="text-[14px] text-text-soft">{t(bodyKey)}</p>
      </div>
    </div>
  );
}

/**
 * A stand-in for the mascot.
 *
 * `lebrunji.tsx` in the app is 937 lines of `react-native-svg` across six
 * moods, and porting it is its own piece of work rather than something to do
 * badly in passing — the app's own docblock also notes the artwork is a
 * placeholder pending final art, so porting it now would mean porting it twice.
 *
 * This holds the space at the right size and weight so the layout is real, and
 * is the one thing in the shell that is deliberately temporary.
 */
function Placeholder({ mood }: { mood: "waiting" | "done" | "lost" }) {
  const tone = {
    waiting: "text-text-faint",
    done: "text-accent",
    lost: "text-text-faint",
  }[mood];

  return (
    <svg
      width={72}
      height={72}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={tone}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h.01M15 10h.01" />
      {mood === "done" ? (
        <path d="M8.5 14.5a4 4 0 0 0 7 0" />
      ) : (
        <path d="M9 15h6" />
      )}
    </svg>
  );
}
