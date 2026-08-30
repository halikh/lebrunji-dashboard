import { getClient } from "@/lib/supabase/client";

/**
 * The languages content is written in.
 *
 * Read from the database, never a constant. Since migration 0051 every
 * translated column is one `jsonb` object holding every locale, and each
 * carries a `<table>_<col>_locales` CHECK constraint requiring **all** of them
 * — so this list is not a preference, it is the shape a write has to satisfy.
 *
 * That is also what makes adding a language a database row rather than a
 * release: `LocalizedField` renders one input per row here, so a third language
 * appears in every content form in the dashboard with no code change at all.
 */
export type Language = {
  code: string;
  /** The language's own name for itself, not the reader's word for it. */
  name: string;
  /** Right-to-left scripts need the input flipped, not only the page. */
  rtl: boolean;
};

/**
 * Which scripts read right to left.
 *
 * A short list rather than a lookup, because there is no `rtl` column and
 * inventing one would mean a migration for something `Intl` already knows —
 * but `Intl.Locale.prototype.getTextInfo` is not in every engine yet, so this
 * is the dependable version. Adding a language means adding it here only if it
 * is RTL.
 */
const RTL = new Set(["ar", "he", "fa", "ur", "ckb", "ps"]);

export async function fetchLanguages(): Promise<Language[]> {
  const { data, error } = await getClient()
    .from("languages")
    .select("code, name");

  if (error) throw new Error(`Could not read languages: ${error.message}`);

  return (data ?? []).map((row) => {
    const code = row.code as string;
    const names = row.name as Record<string, string> | null;
    return {
      code,
      // A language's own name for itself — `{"en": "Arabic", "ar": "العربية"}`
      // keyed by its own code gives العربية, which is what a person writing
      // Arabic expects to see on the tab they type into.
      name: names?.[code] ?? names?.en ?? code,
      rtl: RTL.has(code),
    };
  });
}
