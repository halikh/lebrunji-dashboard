"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { t } from "@/i18n/translations";

import { cx } from "./cx";
import { Spinner } from "./spinner";

/**
 * A choice from a set the database supplies — searchable, keyboard-complete,
 * and drawn in the kit's own look.
 *
 * Built on Radix Popover (placement, collision flipping, layering above a
 * `Dialog` or `Sheet`) and cmdk (filtering, arrow-key focus, `listbox`
 * semantics). No screen imports either directly, so swapping one later is
 * this file.
 *
 * ## Wiring to a `Field`
 *
 * `Field` hands its control `id`, `aria-describedby` and `aria-invalid`
 * through a render function; every control here accepts exactly those, so
 * `<Field>{(p) => <Select {...p} … />}</Field>` ties label, hint and error to
 * it. `invalid` is the older name for the same thing and still works.
 *
 * ## The `note` is why this is not a `<select>`
 *
 * An option can carry a short remark beside its label — "no options yet"
 * against a dish that has none — in its own colour, so the eye can skim the
 * column for it. A native `<option>` holds no markup.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** A short remark shown beside the label — "no options yet". */
  note?: string;
  /**
   * Drawn in place of the label text where the option *is* something to look
   * at — a tag's colour, shown as the chip it produces. `label` is still what
   * the search matches and what a screen reader announces.
   */
  render?: ReactNode;
  /**
   * A small second line under the label, in the open list only — a branch's
   * phone under its name. The closed control stays one line.
   */
  detail?: string;
};

/** What `Field` passes a control, plus the older `invalid` flag. */
type Wiring = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  invalid?: boolean;
};

function isInvalid(wiring: Wiring): boolean {
  if (wiring.invalid !== undefined) return wiring.invalid;
  const aria = wiring["aria-invalid"];
  return aria === true || aria === "true";
}

/**
 * Nothing goes in the search box. Chrome guesses a bare text input is a login
 * field and fills it with the operator's email — on Settings that once put an
 * address over an empty hours menu. `new-password` is the token it honours;
 * the `data-*` flags are what the password-manager extensions read.
 */
const AUTOFILL_OFF = {
  autoComplete: "new-password",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;

/** The closed control's frame — `Input`'s look, so a select lines up beside one. */
const frame =
  "w-full rounded-md border border-line-strong bg-surface text-[14px] text-ink shadow-xs transition-[border-color,box-shadow] hover:border-ink-4 focus-visible:border-accent focus-visible:shadow-focus focus-visible:outline-none data-[state=open]:border-accent data-[state=open]:shadow-focus aria-invalid:border-danger aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-ink-3 aria-disabled:hover:border-line-strong";

/** Matches on what a person reads, never on the id hidden in `value`. */
function optionKeywords(option: SelectOption): string[] {
  return [option.label, option.note ?? "", option.detail ?? ""];
}

function filterOptions(_value: string, search: string, keywords?: string[]) {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return 1;
  const hay = (keywords ?? []).join(" ").toLocaleLowerCase();
  if (hay.startsWith(needle)) return 1;
  return hay.includes(needle) ? 0.5 : 0;
}

/** One option's contents, in the list (`menu`) or the closed control (`value`). */
function OptionContent({
  option,
  context,
}: {
  option: SelectOption;
  context: "menu" | "value";
}) {
  const line = (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="min-w-0 truncate">{option.render ?? option.label}</span>
      {option.note && (
        <span className="shrink-0 text-[12px] text-ink-4">{option.note}</span>
      )}
    </span>
  );
  if (!option.detail || context !== "menu") return line;
  return (
    <span className="flex min-w-0 flex-col">
      {line}
      <span className="truncate text-[12px] text-ink-3">{option.detail}</span>
    </span>
  );
}

/** The open list: a search box, then the options. Shared by all three controls. */
function OptionPanel({
  options,
  selected,
  onPick,
  search,
  onSearch,
  filter = true,
  loading = false,
  empty,
}: {
  options: readonly SelectOption[];
  selected: ReadonlySet<string>;
  onPick: (option: SelectOption) => void;
  search: string;
  onSearch: (value: string) => void;
  /** False when the caller already filtered (the async control). */
  filter?: boolean;
  loading?: boolean;
  empty?: ReactNode;
}) {
  return (
    <Command
      shouldFilter={filter}
      filter={filterOptions}
      loop
      className="flex flex-col"
    >
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search aria-hidden className="size-4 shrink-0 text-ink-4" />
        <Command.Input
          value={search}
          onValueChange={onSearch}
          placeholder={t("common.search")}
          className="h-9 w-full min-w-0 bg-transparent text-[14px] text-ink placeholder:text-ink-4 focus:outline-none"
          {...AUTOFILL_OFF}
        />
        {loading && <Spinner className="size-3.5 shrink-0 text-ink-4" />}
      </div>
      <Command.List className="max-h-[min(280px,var(--radix-popover-content-available-height,280px))] overflow-y-auto overscroll-contain p-1 scrollbar-thin">
        <Command.Empty className="px-2.5 py-6 text-center text-[13px] text-ink-3">
          {loading ? t("common.loading") : (empty ?? t("controls.noMatches"))}
        </Command.Empty>
        {options.map((option) => {
          const isSelected = selected.has(option.value);
          return (
            <Command.Item
              key={option.value}
              value={option.value}
              keywords={optionKeywords(option)}
              onSelect={() => onPick(option)}
              className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[14px] text-ink outline-none select-none data-[selected=true]:bg-hover"
            >
              <span className="min-w-0 flex-1">
                <OptionContent option={option} context="menu" />
              </span>
              <Check
                aria-hidden
                className={cx(
                  "size-4 shrink-0 text-accent",
                  isSelected ? "opacity-100" : "opacity-0",
                )}
              />
            </Command.Item>
          );
        })}
      </Command.List>
    </Command>
  );
}

function PanelContent({
  children,
  anchor,
  id,
}: {
  children: ReactNode;
  /** Named by the control's `aria-controls`. */
  id: string;
  /** A box that opens the list itself, so pressing it is not "outside". */
  anchor?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        id={id}
        onInteractOutside={(event) => {
          const target = event.target as Node | null;
          if (target && anchor?.current?.contains(target))
            event.preventDefault();
        }}
        align="start"
        sideOffset={4}
        collisionPadding={8}
        className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-lg animate-pop-in focus:outline-none"
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

/* ───────────────────────────── Select ───────────────────────────── */

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  isClearable = false,
  className,
  "aria-label": ariaLabel,
  ...wiring
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  isClearable?: boolean;
  className?: string;
  "aria-label"?: string;
} & Wiring) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value) ?? null;
  const invalid = isInvalid(wiring);
  const clearable = isClearable && !!selected && !disabled;

  function openChange(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (!next) setSearch("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={openChange}>
      <div className={cx("relative", className)}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            id={wiring.id}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel}
            aria-describedby={wiring["aria-describedby"]}
            aria-invalid={invalid || undefined}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            className={cx(
              frame,
              "flex h-9 items-center gap-2 ps-3 text-start",
              clearable ? "pe-14" : "pe-9",
            )}
          >
            <span
              className={cx(
                "min-w-0 flex-1 truncate",
                !selected && "text-ink-4",
              )}
            >
              {selected ? (
                <OptionContent option={selected} context="value" />
              ) : (
                (placeholder ?? "")
              )}
            </span>
          </button>
        </PopoverPrimitive.Trigger>
        {clearable && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t("common.clear")}
            title={t("common.clear")}
            className="absolute end-8 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        />
      </div>
      <PanelContent id={listId}>
        <OptionPanel
          options={options}
          selected={new Set(selected ? [selected.value] : [])}
          search={search}
          onSearch={setSearch}
          onPick={(option) => {
            onChange(option.value);
            openChange(false);
          }}
        />
      </PanelContent>
    </PopoverPrimitive.Root>
  );
}

/* ─────────────────────────── Multi box ──────────────────────────── */

/**
 * The closed multi control: chips with their own remove buttons, and a
 * clear-all. Not a `<button>` because it contains buttons; a focusable
 * `combobox` that opens on Enter, Space or ↓, and drops the last chip on
 * Backspace.
 */
function MultiBox({
  chosen,
  onRemove,
  onClear,
  open,
  onOpen,
  placeholder,
  disabled,
  ariaLabel,
  controls,
  wiring,
  className,
  boxRef,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
  chosen: readonly SelectOption[];
  onRemove: (value: string) => void;
  onClear: () => void;
  open: boolean;
  onOpen: () => void;
  placeholder?: string;
  disabled: boolean;
  ariaLabel?: string;
  controls: string;
  wiring: Wiring;
  className?: string;
}) {
  const invalid = isInvalid(wiring);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || event.target !== event.currentTarget) return;
    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      onOpen();
    } else if (event.key === "Backspace" && chosen.length > 0) {
      event.preventDefault();
      onRemove(chosen[chosen.length - 1].value);
    }
  }

  return (
    <div ref={boxRef} className={cx("relative", className)}>
      <PopoverPrimitive.Anchor asChild>
        <div
          id={wiring.id}
          role="combobox"
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={controls}
          aria-label={ariaLabel}
          aria-describedby={wiring["aria-describedby"]}
          aria-invalid={invalid || undefined}
          aria-disabled={disabled || undefined}
          data-state={open ? "open" : "closed"}
          onClick={() => !disabled && onOpen()}
          onKeyDown={onKeyDown}
          className={cx(
            frame,
            "flex min-h-9 cursor-pointer flex-wrap items-center gap-1 py-1 ps-1.5",
            chosen.length > 0 ? "pe-14" : "pe-9",
          )}
        >
          {chosen.length === 0 && (
            <span className="truncate ps-1.5 text-ink-4">
              {placeholder ?? ""}
            </span>
          )}
          {chosen.map((option) => (
            <span
              key={option.value}
              className="inline-flex h-6 max-w-full items-center gap-0.5 rounded-[5px] border border-line bg-subtle ps-2 pe-0.5 text-[13px] text-ink"
            >
              <span className="min-w-0 truncate">
                {option.render ?? option.label}
              </span>
              {!disabled && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(option.value);
                  }}
                  aria-label={t("controls.remove", { name: option.label })}
                  className="flex size-5 items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      </PopoverPrimitive.Anchor>
      {chosen.length > 0 && !disabled && (
        <button
          type="button"
          onClick={onClear}
          aria-label={t("common.clear")}
          title={t("common.clear")}
          className="absolute end-8 top-[7px] flex size-6 items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3 top-[10px] size-4 text-ink-3"
      />
    </div>
  );
}

/* ─────────────────────────── MultiSelect ────────────────────────── */

/**
 * The same control, accepting several answers — a dish's tags. Separate from
 * {@link Select} because the value types differ (a list, not a string).
 *
 * Chips read in the order they were picked; nothing downstream uses that
 * order — a tag's position on a dish comes from `menu_item_tags.sort_order`.
 * Picked options leave the list, and the list stays open between picks.
 */
export function MultiSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
  "aria-label": ariaLabel,
  ...wiring
}: {
  value: readonly string[];
  onChange: (value: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
} & Wiring) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [search, setSearch] = useState("");
  const box = useRef<HTMLDivElement>(null);

  // Mapped through `options` rather than held as objects, so a label edited
  // elsewhere is the label shown after a refetch.
  const chosen = value
    .map((id) => options.find((option) => option.value === id))
    .filter((option): option is SelectOption => option !== undefined);
  const remaining = options.filter((option) => !value.includes(option.value));

  function openChange(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (!next) setSearch("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={openChange}>
      <MultiBox
        boxRef={box}
        chosen={chosen}
        onRemove={(id) => onChange(value.filter((v) => v !== id))}
        onClear={() => onChange([])}
        open={open}
        onOpen={() => openChange(true)}
        placeholder={placeholder}
        disabled={disabled}
        ariaLabel={ariaLabel}
        controls={listId}
        wiring={wiring}
        className={className}
      />
      <PanelContent id={listId} anchor={box}>
        <OptionPanel
          options={remaining}
          selected={new Set()}
          search={search}
          onSearch={setSearch}
          empty={
            remaining.length === 0 && !search
              ? t("controls.allChosen")
              : undefined
          }
          onPick={(option) => {
            onChange([...value, option.value]);
            setSearch("");
          }}
        />
      </PanelContent>
    </PopoverPrimitive.Root>
  );
}

/* ───────────────────────── Async loading ────────────────────────── */

/**
 * Options from `loadOptions` while the list is open: the first page at once,
 * then again 250 ms after the typing stops. Only the latest request may write
 * — an older, slower answer to a shorter search loses.
 */
function useAsyncOptions(
  open: boolean,
  search: string,
  loadOptions: (input: string) => Promise<SelectOption[]>,
) {
  const [results, setResults] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const loader = useRef(loadOptions);
  useEffect(() => {
    loader.current = loadOptions;
  });

  useEffect(() => {
    if (!open) return;
    const ticket = ++request.current;
    const timer = setTimeout(
      () => {
        setLoading(true);
        loader.current(search).then(
          (found) => {
            if (ticket !== request.current) return;
            setResults(found);
            setLoading(false);
          },
          () => {
            if (ticket !== request.current) return;
            setResults([]);
            setLoading(false);
          },
        );
      },
      search ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [open, search]);

  return { results, loading };
}

/* ─────────────────────────── AsyncSelect ────────────────────────── */

/**
 * One answer from a set with **no ceiling** — a shop among all the shops.
 * Options come from `loadOptions` as the operator types; nothing is loaded
 * until the list opens.
 *
 * `value` is the id, as the form stores it. Its label comes from the option
 * last picked here, or — for a saved choice the list has not shown yet, as
 * when an editor opens — from `resolveOption`, asked once per value.
 */
export function AsyncSelect({
  value,
  onChange,
  loadOptions,
  resolveOption,
  placeholder,
  disabled = false,
  isClearable = false,
  noOptionsMessage,
  className,
  "aria-label": ariaLabel,
  ...wiring
}: {
  value: string;
  onChange: (value: string, option: SelectOption | null) => void;
  /** Asked as the operator types, debounced here. */
  loadOptions: (input: string) => Promise<SelectOption[]>;
  /** The option for a saved `value` the list has not shown yet. */
  resolveOption?: (value: string) => Promise<SelectOption | null>;
  placeholder?: string;
  disabled?: boolean;
  isClearable?: boolean;
  /** What an empty result says. Should name the term the operator typed. */
  noOptionsMessage?: (input: string) => string;
  className?: string;
  "aria-label"?: string;
} & Wiring) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [search, setSearch] = useState("");
  const { results, loading } = useAsyncOptions(open, search, loadOptions);
  /** Every option seen, so the closed control can name its value. */
  const [known, setKnown] = useState<ReadonlyMap<string, SelectOption>>(
    () => new Map(),
  );

  const resolver = useRef(resolveOption);
  useEffect(() => {
    resolver.current = resolveOption;
  });
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!value || known.has(value) || asked.current.has(value)) return;
    if (!resolver.current) return;
    asked.current.add(value);
    resolver.current(value).then(
      (option) => {
        if (!option) return;
        setKnown((current) => new Map(current).set(option.value, option));
      },
      () => {},
    );
  }, [value, known]);

  const selected =
    (value &&
      (results.find((one) => one.value === value) ?? known.get(value))) ||
    null;
  const invalid = isInvalid(wiring);
  const clearable = isClearable && !!value && !disabled;

  function openChange(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (!next) setSearch("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={openChange}>
      <div className={cx("relative", className)}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            id={wiring.id}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel}
            aria-describedby={wiring["aria-describedby"]}
            aria-invalid={invalid || undefined}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            className={cx(
              frame,
              "flex h-9 items-center gap-2 ps-3 text-start",
              clearable ? "pe-14" : "pe-9",
            )}
          >
            <span
              className={cx(
                "min-w-0 flex-1 truncate",
                !selected && "text-ink-4",
              )}
            >
              {selected ? (
                <OptionContent option={selected} context="value" />
              ) : value ? (
                t("common.loading")
              ) : (
                (placeholder ?? "")
              )}
            </span>
          </button>
        </PopoverPrimitive.Trigger>
        {clearable && (
          <button
            type="button"
            onClick={() => onChange("", null)}
            aria-label={t("common.clear")}
            title={t("common.clear")}
            className="absolute end-8 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-ink-4 hover:bg-hover hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        />
      </div>
      <PanelContent id={listId}>
        <OptionPanel
          options={results}
          selected={new Set(value ? [value] : [])}
          search={search}
          onSearch={setSearch}
          filter={false}
          loading={loading}
          empty={noOptionsMessage ? noOptionsMessage(search) : undefined}
          onPick={(option) => {
            setKnown((current) => new Map(current).set(option.value, option));
            onChange(option.value, option);
            openChange(false);
          }}
        />
      </PanelContent>
    </PopoverPrimitive.Root>
  );
}

/* ──────────────────────── AsyncMultiSelect ──────────────────────── */

/**
 * Several answers from a set with **no ceiling** — every dish in every shop.
 * Options come from `loadOptions` as the operator types (debounced), with the
 * first page loaded on open so the list is never a dead end.
 *
 * `value` holds whole options rather than ids: there is no list to look a
 * label up in, so the caller resolves stored ids into labels when the form
 * opens.
 */
export function AsyncMultiSelect({
  value,
  onChange,
  loadOptions,
  placeholder,
  disabled = false,
  noOptionsMessage,
  className,
  "aria-label": ariaLabel,
  ...wiring
}: {
  value: readonly SelectOption[];
  onChange: (value: SelectOption[]) => void;
  /** Asked as the operator types, debounced here. */
  loadOptions: (input: string) => Promise<SelectOption[]>;
  placeholder?: string;
  disabled?: boolean;
  /** What an empty result says. Should name the term the operator typed. */
  noOptionsMessage?: (input: string) => string;
  className?: string;
  "aria-label"?: string;
} & Wiring) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const [search, setSearch] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const { results, loading } = useAsyncOptions(open, search, loadOptions);

  const chosenIds = new Set(value.map((option) => option.value));
  const remaining = results.filter((option) => !chosenIds.has(option.value));

  function openChange(next: boolean) {
    if (disabled) return;
    setOpen(next);
    if (!next) setSearch("");
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={openChange}>
      <MultiBox
        boxRef={box}
        chosen={value}
        onRemove={(id) =>
          onChange(value.filter((option) => option.value !== id))
        }
        onClear={() => onChange([])}
        open={open}
        onOpen={() => openChange(true)}
        placeholder={placeholder}
        disabled={disabled}
        ariaLabel={ariaLabel}
        controls={listId}
        wiring={wiring}
        className={className}
      />
      <PanelContent id={listId} anchor={box}>
        <OptionPanel
          options={remaining}
          selected={new Set()}
          search={search}
          onSearch={setSearch}
          filter={false}
          loading={loading}
          empty={noOptionsMessage ? noOptionsMessage(search) : undefined}
          onPick={(option) => {
            onChange([...value, option]);
          }}
        />
      </PanelContent>
    </PopoverPrimitive.Root>
  );
}
