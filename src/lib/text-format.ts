/**
 * What a catalogue name may contain, and how its letters are cased.
 *
 * ## Names are Title Case
 *
 * Shop, category, menu-section and dish names are stored with the first letter
 * of every word capitalised and the rest lower-case — "MILK BASED", "milk
 * based" and "mILk Based" all become "Milk Based". One rule, so a menu reads as
 * one menu whoever typed it.
 *
 * The cost is known and accepted: an acronym or a brand's own casing is
 * flattened too ("USD" becomes "Usd", "McDonald's" becomes "Mcdonald's").
 *
 * It applies in two places for the same reason the character filter does: as
 * the operator types (`LocalizedField`'s `"title"` filter) so the box shows what
 * will be stored, and on save (`titleLocalized`) so bulk paste and any screen
 * written next obey it too. Descriptions, options and long-form content are
 * left exactly as typed.
 */

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

/**
 * The rejected characters over a whole translated column.
 *
 * The second layer under the field's live filter — bulk paste and any screen
 * written next arrive at the api without passing through `LocalizedField`. It
 * removes characters only; case is left exactly as typed — names go through
 * `titleLocalized` below, which adds the casing. A null or absent
 * column comes back untouched: an absent description is a legitimate value and
 * cleaning it into `{}` would turn it into a constraint violation.
 */
export function cleanLocalized<T extends Record<string, string> | null>(
  value: T,
): T {
  if (!value) return value;
  return Object.fromEntries(
    Object.entries(value).map(([code, text]) => [code, withoutRejected(text)]),
  ) as T;
}

/**
 * Title Case: the first letter of every word upper-case, every other letter
 * lower-case.
 *
 * A word is a run of non-space characters, and its first *letter* is the one
 * raised — so "(large)" becomes "(Large)" — while letters after punctuation
 * or a digit inside a word are not: "joe's" is "Joe's", "2ND" is "2nd". Scripts without case,
 * Arabic among them, pass through unchanged.
 *
 * A letter whose upper-case form is longer than one character (German "ß") is
 * left as it is, so the value keeps its length and the caret in the field it
 * is typed into does not move.
 */
export function titleCase(value: string): string {
  let out = "";
  let atWordStart = true;
  for (const char of value) {
    if (/\s/u.test(char)) {
      out += char;
      atWordStart = true;
    } else if (atWordStart && /\p{L}/u.test(char)) {
      const upper = char.toUpperCase();
      out += upper.length === char.length ? upper : char;
      atWordStart = false;
    } else {
      const lower = char.toLowerCase();
      out += lower.length === char.length ? lower : char;
      // A digit starts the word too: "2nd", not "2Nd".
      if (/\p{N}/u.test(char)) atWordStart = false;
    }
  }
  return out;
}

/**
 * A translated name as it is stored: the rejected characters removed and
 * every language in Title Case. The save-side half of the rule at the top of
 * this file; `cleanLocalized` is the same without the casing, for descriptions.
 */
export function titleLocalized<T extends Record<string, string> | null>(
  value: T,
): T {
  const cleaned = cleanLocalized(value);
  if (!cleaned) return cleaned;
  return Object.fromEntries(
    Object.entries(cleaned).map(([code, text]) => [code, titleCase(text)]),
  ) as T;
}

/**
 * One word of a tag name: letters only, Latin (with its accented ranges) or
 * Arabic. **Must match `menu_item_tags_name_letters`** character for
 * character — the dashboard and the database have to agree on what a letter
 * is, or a name passes here and is refused there.
 */
const TAG_WORD = "[A-Za-zÀ-ÖØ-öø-ɏء-غف-يً-ْٰٱ-ۓ]+";

/** A whole tag name: words of letters, one space between each. */
const TAG_NAME = new RegExp(`^${TAG_WORD}( ${TAG_WORD})*$`, "u");

/** One character a tag name may hold, other than the space between words. */
const TAG_LETTER = new RegExp(`^${TAG_WORD}$`, "u");

/**
 * Whether a tag name is letters and single spaces and nothing else.
 *
 * Tested on the value trimmed and with runs of whitespace collapsed — the same
 * shape `tagName` below writes — so stray spaces at the edges are not what
 * refuses a name. An empty value is not this function's business: whether a
 * language may be blank is `validateLocalizedText`'s.
 */
export function isTagName(value: string): boolean {
  return TAG_NAME.test(tagName(value));
}

/** A tag name as it is stored: trimmed, with single spaces between words. */
export function tagName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * A tag name as it is being typed: everything that is not a letter or a space
 * removed, and runs of spaces kept to one.
 *
 * A trailing space survives — it is somebody about to type the next word — and
 * a leading one does not, since no word can start before it. Returns what was
 * dropped as well, de-duplicated and in order, so the field can name the keys
 * that did nothing rather than eat them silently.
 */
export function lettersOnly(value: string): {
  kept: string;
  dropped: string[];
} {
  const dropped: string[] = [];
  let kept = "";
  for (const char of value) {
    if (/\s/u.test(char)) {
      if (kept !== "" && !kept.endsWith(" ")) kept += " ";
    } else if (TAG_LETTER.test(char)) {
      kept += char;
    } else if (!/[\p{Mn}\p{Cf}]/u.test(char) && !dropped.includes(char)) {
      // Invisible joiners and variation selectors are dropped without being
      // named — a message listing a character nobody can see would
      // point at nothing.
      dropped.push(char);
    }
  }
  return { kept, dropped };
}
