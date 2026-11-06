import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names, letting a later Tailwind utility override an earlier one. */
export function cx(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}
