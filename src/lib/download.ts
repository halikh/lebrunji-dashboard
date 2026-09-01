/**
 * Handing a generated file to the browser.
 *
 * One function, because the object-URL dance is three lines and the third one
 * is the one everybody forgets: without `revokeObjectURL` every export leaks
 * its blob for the life of the tab, and the dashboard is a tab somebody leaves
 * open all day.
 *
 * The anchor is created, clicked and dropped rather than rendered. A visible
 * `<a download>` would have to know the file's contents before anybody asked
 * for it, which for a report means building a spreadsheet on every render.
 */
export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // A frame's grace before revoking: Safari has historically cancelled a
  // download whose URL was revoked in the same tick as the click.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * A CSV file, from rows of values.
 *
 * ## Written here rather than pulled in
 *
 * It is about twenty lines, and the whole difficulty is three rules that a
 * dependency would not get more right:
 *
 * - **A field containing a comma, a quote or a newline is quoted**, and a quote
 *   inside it is doubled. Miss this and a dish called `Kibbeh, large` silently
 *   becomes two columns.
 * - **CRLF line endings.** Excel on Windows treats a lone `\n` as one long
 *   line in some locales, and the file opens as a single row.
 * - **A byte-order mark.** Without it Excel reads the file as the system
 *   codepage and every Arabic name arrives as mojibake — which is the failure
 *   that looks like the export is broken rather than the reader.
 *
 * Numbers are written bare so a spreadsheet treats them as numbers. Everything
 * else is text.
 */
export function toCsv(rows: (string | number)[][]): Blob {
  const body = rows.map((row) => row.map(cell).join(",")).join("\r\n");

  // `﻿` is the BOM. It is a character in the string, not a Blob option —
  // `type` only sets the MIME type and does not put one there.
  return new Blob([`﻿${body}`], {
    type: "text/csv;charset=utf-8",
  });
}

function cell(value: string | number): string {
  if (typeof value === "number") return String(value);
  const text = value ?? "";
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** `revenue-2026-08-01-to-2026-08-31.csv` — sortable, and says what it holds. */
export function reportFilename(
  what: string,
  from: string,
  to: string,
  extension: string,
): string {
  return `${what}-${from}-to-${to}.${extension}`;
}
