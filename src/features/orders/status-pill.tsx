import { cx } from "@/components/ui";
import { statusTone } from "@/lib/order-status";

/**
 * An order's status as the app draws a pill: fully round, Inter 500, a dot
 * and the name.
 *
 * The ground is the status's own wash and the type its own ink, so the pill
 * reads as the same legend the queue's tabs and dots are. `md` is the app's 24
 * tall at 12px; `lg` is its 28 at 13px, for a receipt's header.
 */
export function StatusPill({
  slug,
  name,
  size = "lg",
}: {
  slug: string;
  name: string;
  size?: "md" | "lg";
}) {
  const tone = statusTone(slug);

  return (
    <span
      className={cx(
        "flex w-fit shrink-0 items-center gap-[6px] whitespace-nowrap rounded-full px-[10px] font-medium",
        size === "lg" ? "h-[28px] text-[13px]" : "h-[24px] text-[12px]",
      )}
      style={{ background: tone.wash, color: tone.ink }}
    >
      <span
        aria-hidden
        className="size-[7px] shrink-0 rounded-full"
        style={{ background: tone.dot }}
      />
      {name}
    </span>
  );
}
