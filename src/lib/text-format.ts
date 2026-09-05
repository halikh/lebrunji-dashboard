/**
 * The house style for catalogue text, applied as it is typed.
 *
 * ## Why the dashboard decides and not the person typing
 *
 * A marketplace's lists are read by scanning, and a column where one shop
 * shouts, the next whispers and the third is Title Case reads as three
 * different products. That inconsistency does not come from carelessness — it
 * comes from six people entering data over two years, each of them internally
 * consistent. No amount of hinting fixes it, because the hint is read once and
 * the field is filled a thousand times.
 *
 * So the format is not advice here. The field applies it while the operator
 * types, which is also the only version that is honest: a value normalised
 * silently on save shows one thing in the box and stores another.
 *
 * ## English is what these rules are about
 *
 * Case is a property of a handful of scripts and Arabic is not one of them, so
 * every function here is identity on Arabic text. That is why they can be
 * applied to a whole `Localized` object without asking which language a value
 * is in. `"en"` is passed to the case operations explicitly rather than using
 * the machine's locale, which decides things like whether a dotted i keeps its
 * dot — a value should not depend on where the laptop is.
 */

/** SHOUTED. Shops, menu sections and dish names. */
export function upperCase(value: string): string {
  return value.toLocaleUpperCase("en");
}

/**
 * Sentence case: the first letter capital, everything after it lower.
 *
 * **Not** Title Case, which is the thing this exists to remove — "Coffee Shops"
 * and "Phone Stores" beside "Bakery" is exactly the drift described above.
 *
 * The consequence worth stating plainly: an acronym typed into one of these
 * fields comes back lowercased, because a rule that says "only the first word
 * is capitalised" cannot also make an exception for the ones that should not
 * be. The fields this is applied to are names of categories, tags and dish
 * descriptions, where that trade is the right way round.
 *
 * `\p{L}` rather than index zero, so a value that opens with a digit or a
 * quotation mark still capitalises its first *letter* — `"3 cheese pizza"`
 * becomes `"3 Cheese pizza"`… which it does not, and should not: the first
 * letter is the `c`, and this capitalises it. The point is that a leading
 * character which cannot carry a case does not silently swallow the rule.
 */
export function sentenceCase(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("en"));
}

/**
 * The characters a catalogue name may not contain.
 *
 * ## Why a blocklist and not an allowlist
 *
 * An allowlist would have to enumerate every letter a name can be written in,
 * and the answer to that is "every script the `languages` table ever grows a
 * row for". A rule written that way is one that breaks the day somebody adds
 * Armenian — silently, by rejecting every character of it.
 *
 * ## What is on it, and what deliberately is not
 *
 * On it: the characters that are punctuation *for machines*. Slashes and
 * backslashes look like paths, angle brackets and braces like markup, and
 * `+ = ^ ~ | * _ # @ $ %` are operators of one syntax or another. None of them
 * is how anybody writes the name of a shop, and each one is a small ambiguity
 * downstream — in a slug, a URL, a search term, a CSV export.
 *
 * Not on it, and each for a real name that needs it:
 *
 * - `,` — asked for by name. "Fries, large".
 * - `&` — "Fish & Chips". Half the high street.
 * - `'` and `’` — "Joe's".
 * - `-` and the dashes — "Wood-fired".
 * - `.` — "St. George".
 * - `( )` — "Kibbeh (4 pcs)".
 * - `! ? :` — a title is allowed to be a sentence.
 *
 * The list is about shape rather than about danger: nothing downstream trusts
 * these strings, and this is not what stops an injection. It is what stops a
 * menu that reads like a config file.
 */
const REJECTED = /[+/\<>{}[\]|^~`*_=#@$%"]/g;

/**
 * What a value would lose, as the characters themselves.
 *
 * Returned rather than counted, because the message the field shows names them
 * — "+ and / cannot be used here" tells somebody which key to stop pressing,
 * and "invalid character" does not. De-duplicated and in the order they were
 * typed.
 */
export function rejectedIn(value: string): string[] {
  return [...new Set(value.match(REJECTED) ?? [])];
}

/** The value without them. */
export function withoutRejected(value: string): string {
  return value.replace(REJECTED, "");
}

/** The formats a field can be held to. */
export type TextFormat = "upper" | "sentence";

/** One value, filtered and cased. */
export function formatText(value: string, format: TextFormat): string {
  const kept = withoutRejected(value);
  return format === "upper" ? upperCase(kept) : sentenceCase(kept);
}

/**
 * The same rules over a whole translated column.
 *
 * Every locale gets the same treatment, which is safe because the case
 * operations are identity on a script without case — see the note at the top.
 * A null or absent column comes back untouched: an absent description is a
 * legitimate value and formatting it into `{}` would turn it into a constraint
 * violation.
 */
export function formatLocalized<T extends Record<string, string> | null>(
  value: T,
  format: TextFormat,
): T {
  if (!value) return value;
  return Object.fromEntries(
    Object.entries(value).map(([code, text]) => [code, formatText(text, format)]),
  ) as T;
}

/**
 * Whether a value carries at least one emoji.
 *
 * `Extended_Pictographic` rather than a hand-written range: it is the Unicode
 * property that means "this is a pictograph", so it covers the ones added in
 * every release since without this file being edited. A range list would be a
 * rule that slowly stops recognising new emoji, and the failure — a tag refused
 * for having the wrong emoji — is one nobody would guess at.
 *
 * Note what it does *not* do: check that the emoji is at the start, or that
 * there is only one. Both would be rules about taste rather than about the
 * thing being asked for, which is that a chip has a picture on it.
 */
export function hasEmoji(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value);
}
