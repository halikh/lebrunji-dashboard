"use client";

import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

import { cx } from "./cx";

/*
 * Plain table parts with the house styling. A wrapper rather than a grid
 * engine: lists here are a few hundred rows at most, and a real <table> is
 * what a screen reader and a copy-paste into a spreadsheet both expect.
 */

/**
 * A table wider than its card scrolls sideways, and a scrollbar only at the
 * bottom is found only by scrolling to the end of the list (user,
 * 2026-11-11). So a wide table gets a second one along its top, kept in step
 * with the bottom one. It is there only while the table overflows, and is
 * hidden from screen readers: the table itself is what they read.
 */
export function Table({
  className,
  ...rest
}: HTMLAttributes<HTMLTableElement>) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      setScrollWidth(body.scrollWidth);
      setOverflows(body.scrollWidth > body.clientWidth + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    if (body.firstElementChild) observer.observe(body.firstElementChild);
    return () => observer.disconnect();
  }, []);

  // Each bar follows the other. Setting the same position fires no event, so
  // the two cannot chase each other.
  const follow = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (from && to && to.scrollLeft !== from.scrollLeft) {
      to.scrollLeft = from.scrollLeft;
    }
  };

  return (
    <div className="w-full">
      {overflows && (
        <div
          ref={topRef}
          aria-hidden
          onScroll={() => follow(topRef.current, bodyRef.current)}
          className="w-full overflow-x-auto overflow-y-hidden scrollbar-thin"
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
      <div
        ref={bodyRef}
        onScroll={() => follow(bodyRef.current, topRef.current)}
        className="w-full overflow-x-auto scrollbar-thin"
      >
        <table
          className={cx("w-full border-collapse text-[13.5px]", className)}
          {...rest}
        />
      </div>
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
