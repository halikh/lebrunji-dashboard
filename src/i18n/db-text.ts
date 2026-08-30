import type { Localized } from "@/lib/validation";

/**
 * One readable string out of a `jsonb` column that holds several.
 *
 * Since `0051_translations_to_json.sql` the translated columns are objects
 * keyed by language code — `{"en": "Kibbeh", "ar": "كبة"}`. Everything that
 * shows one to a person needs the same answer to "which", and it was being
 * written separately in the store list, the store API and the menu screen,
 * which is three chances for the fallback to differ.
 *
 * ## The fallback order, and why it is not just English
 *
 * English first, because the dashboard's chrome is English and a name beside an
 * English label should match it where it can. Then **any other language that
 * has something**, because a row named only in Arabic is a row the operator
 * needs to be able to find — showing an empty cell for it would make it look
 * broken or, worse, look like a different row.
 *
 * Empty string last. A caller that needs to distinguish "no name" from "name is
 * blank" should look at the object; this is for putting a word on the screen.
 */
export function pickLocalized(value: Localized | null | undefined): string {
  if (!value) return "";
  for (const candidate of [value.en, ...Object.values(value)]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return "";
}
