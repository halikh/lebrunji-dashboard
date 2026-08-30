import { cx } from '@/components/ui';

/**
 * The shape of one thing in the rail.
 *
 * Shared rather than repeated, because sign-out has to look like a nav item —
 * same box, same stack, same type — and differ only in colour. Written twice,
 * the two would drift the first time the rail's padding changed, and the drift
 * would be visible as a control that is a few pixels taller than its
 * neighbours for no reason anyone could name.
 *
 * `group` is here rather than at the call site: the icon's hover animation
 * depends on it, so an item that forgot it would silently lose the animation
 * rather than break.
 */
export type RailTone = 'default' | 'danger';

export function railItemClass(options: { tone?: RailTone; active?: boolean } = {}) {
  const { tone = 'default', active = false } = options;

  return cx(
    // `w-full` rather than relying on the parent to stretch it. Nav links sit in
    // a column flex container and stretch by default; sign-out sits in a plain
    // block, where a `button` shrinks to its content and sits left. Stating it
    // here means the item looks the same wherever it is put.
    'group relative flex w-full flex-1 cursor-pointer flex-col items-center gap-xxs rounded-md px-xs py-sm',
    'text-[11px] font-semibold md:flex-none md:py-md md:text-[12px]',
    active && 'bg-active-wash text-active-ink',
    !active && tone === 'default' && 'text-text-soft hover:bg-neutral-fill',
    // Danger is never the "active" state — there is no page to be on — so it
    // only has the two. Muted until hovered, because a permanently red item in
    // a navigation rail reads as an error rather than as an action.
    tone === 'danger' && 'text-text-soft hover:bg-danger-wash hover:text-danger',
  );
}

// The hover animation is not here. Each icon animates the part of itself that
// carries its meaning, which is per-icon keyframes in `globals.css` keyed on
// `data-anim` — a single shared transform would move every icon identically and
// so would say nothing about what any of them does.
