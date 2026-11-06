"use client";

import { Clock } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { useClock } from "@/features/settings/use-clock";

import { cx } from "./cx";

/**
 * A time of day — chosen from a list, or typed.
 *
 * ## Not `<input type="time">`
 *
 * The native input shows 12- or 24-hour by the *machine's* locale, so one
 * shop's hours would read `9:00 PM` on one laptop and `21:00` on the next.
 * Here the format is the business's (`app_settings.clock_24h` via
 * `useClock`), the same everywhere.
 *
 * ## What it edits
 *
 * `store_hours.opens_at` is **text**, `HH:MM`, a wall clock with no date and
 * no zone. Nothing is converted: nine in the morning is nine in the morning.
 * No `Date` is involved at all — the string is parsed and built by hand, so no
 * locale or zone can leak in.
 *
 * ## Fifteen minutes, and typing
 *
 * The list steps by the quarter hour (shops open on it); typing stays
 * available for the kitchen that really closes at 22:50 — `2250`, `22:50`,
 * `10:50 pm` and `10.50p` all read.
 */
export function TimeField({
  value,
  onChange,
  disabled = false,
  invalid,
  className,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
}: {
  /** `HH:MM`, 24-hour — what the column holds, whatever is shown. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  /** `Field`'s render props. */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label"?: string;
}) {
  const clock = useClock();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const isInvalid = invalid ?? (ariaInvalid === true || ariaInvalid === "true");

  const normalized = parseTime(value) ?? "";
  // An off-grid stored time (22:50) is offered too, so it shows as chosen.
  const slots = useMemo(
    () =>
      !normalized || SLOTS.includes(normalized)
        ? SLOTS
        : [...SLOTS, normalized].sort(),
    [normalized],
  );
  const shown = draft ?? (normalized ? clock.hhmm(normalized) : value);

  // Bring the chosen (or highlighted) slot into view as the list opens/moves.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const target = active !== null ? slots[active] : normalized || "09:00";
      list.current
        ?.querySelector<HTMLElement>(`[data-slot="${target}"]`)
        ?.scrollIntoView({ block: active !== null ? "nearest" : "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, active, normalized, slots]);

  function settle() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === "") {
      if (value !== "") onChange("");
      return;
    }
    const parsed = parseTime(text);
    if (parsed && parsed !== normalized) onChange(parsed);
  }

  function pick(slot: string) {
    setDraft(null);
    setActive(null);
    setOpen(false);
    if (slot !== normalized) onChange(slot);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const from = active ?? Math.max(0, slots.indexOf(normalized || "09:00"));
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive(
        active === null ? from : (from + step + slots.length) % slots.length,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open && active !== null) pick(slots[active]);
      else {
        settle();
        setOpen(false);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setDraft(null);
      setActive(null);
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open && !disabled}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setActive(null);
      }}
    >
      <PopoverPrimitive.Anchor asChild>
        <div
          ref={anchor}
          className={cx(
            "relative shrink-0",
            clock.clock24h ? "w-28" : "w-32",
            className,
          )}
        >
          <input
            id={id}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && active !== null ? `${listId}-${active}` : undefined
            }
            aria-label={ariaLabel}
            aria-describedby={describedBy}
            aria-invalid={isInvalid || undefined}
            disabled={disabled}
            value={shown}
            placeholder={clock.clock24h ? "09:00" : "9:00 AM"}
            autoComplete="off"
            onChange={(event) => {
              setDraft(event.target.value);
              setActive(null);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={settle}
            onKeyDown={onKeyDown}
            className="h-9 w-full rounded-md border border-line-strong bg-surface ps-3 pe-8 text-[14px] text-ink tabular-nums shadow-xs transition-[border-color,box-shadow] placeholder:text-ink-4 hover:border-ink-4 focus:border-accent focus:shadow-focus focus:outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-3 aria-invalid:border-danger"
          />
          <Clock
            aria-hidden
            className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-4"
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchor.current?.contains(event.target as Node))
              event.preventDefault();
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-28 overflow-hidden rounded-lg border border-line bg-surface shadow-lg animate-pop-in"
        >
          <div
            ref={list}
            id={listId}
            role="listbox"
            className="max-h-60 overflow-y-auto overscroll-contain p-1 scrollbar-thin"
          >
            {slots.map((slot, index) => {
              const selected = slot === normalized;
              return (
                <div
                  key={slot}
                  id={`${listId}-${index}`}
                  data-slot={slot}
                  role="option"
                  aria-selected={selected}
                  // Keep focus in the input; a mousedown would blur it first.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(slot)}
                  onMouseEnter={() => setActive(index)}
                  className={cx(
                    "flex h-8 cursor-pointer items-center rounded-md px-2.5 text-[14px] tabular-nums",
                    index === active && "bg-hover",
                    selected ? "font-medium text-accent-ink" : "text-ink",
                  )}
                >
                  {clock.hhmm(slot)}
                </div>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Every quarter hour of a day, as `HH:MM`. */
const SLOTS: readonly string[] = Array.from({ length: 96 }, (_, i) => {
  const hour = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

/**
 * What a person typed, as `HH:MM` — or null if it does not read as a time.
 *
 * `9`, `09`, `930`, `0930`, `9:30`, `9.30`, `21:00`, `9pm`, `9:30 PM`,
 * `12am` (midnight). Built by hand, never through `Date`.
 */
export function parseTime(input: string): string | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "");
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?(a|am|p|pm)?$/.exec(text);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] === undefined ? 0 : Number(match[2]);
  const meridiem = match[3];
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (meridiem.startsWith("p")) hour += 12;
  }
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
