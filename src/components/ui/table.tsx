import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cx } from "./cx";

/*
 * Plain table parts with the house styling. A wrapper rather than a grid
 * engine: lists here are a few hundred rows at most, and a real <table> is
 * what a screen reader and a copy-paste into a spreadsheet both expect.
 */

export function Table({
  className,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <table
        className={cx("w-full border-collapse text-[13.5px]", className)}
        {...rest}
      />
    </div>
  );
}

export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      {...props}
      className={cx("sticky top-0 z-[1] bg-subtle", props.className)}
    />
  );
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody {...props} className={cx("divide-y divide-line", props.className)} />
  );
}

export function Tr({
  className,
  interactive,
  selected,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & {
  interactive?: boolean;
  selected?: boolean;
}) {
  return (
    <tr
      className={cx(
        interactive && "cursor-pointer transition-colors hover:bg-subtle",
        selected && "bg-accent-soft/60 hover:bg-accent-soft/60",
        className,
      )}
      aria-selected={selected || undefined}
      {...rest}
    />
  );
}

export function Th({
  className,
  align,
  ...rest
}: Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> & { align?: "end" }) {
  return (
    <th
      scope="col"
      className={cx(
        "h-10 border-b border-line px-4 text-start text-[12px] font-medium whitespace-nowrap text-ink-3",
        align === "end" && "text-end",
        className,
      )}
      {...rest}
    />
  );
}

export function Td({
  className,
  align,
  ...rest
}: Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> & { align?: "end" }) {
  return (
    <td
      className={cx(
        "h-12 px-4 align-middle text-ink",
        align === "end" && "text-end tabular-nums",
        className,
      )}
      {...rest}
    />
  );
}
