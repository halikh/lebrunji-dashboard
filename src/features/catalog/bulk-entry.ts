import { TEXT } from "@/lib/limits";
import { validatePrice, type Localized } from "@/lib/validation";

/**
 * Reading a list of choices out of a block of typed text.
 *
 * ## Why bulk entry exists
 *
 * A question's answers arrive as a *set*, not one at a time: sizes are small,
 * medium and large; extras are six things the kitchen already knows. The form
 * that adds them takes a name in every language and a price, and doing that six
 * times — six focus changes, six Add presses, six round trips — is the whole
 * job of setting up a menu repeated at its most tedious scale. Operators
 * already have the list, usually in a message or a spreadsheet. This lets them
 * paste it.
 *
 * ## The format is one choice per line, columns separated by `|`
 *
 * `|` rather than a comma or a tab. A comma appears inside real names — "Salt,
 * Pepper & Herbs" is one choice, not three — and a tab is invisible, so a line
 * that failed to parse would look identical to one that worked. `|` is
 * unambiguous, survives copying out of a spreadsheet, and is visible while
 * being typed.
 *
 * ## A column per language, in the order the languages come back
 *
 * Not hardcoded to English-then-Arabic. `languages` is a table, and every
 * content form in this dashboard grows a field when a row is added to it — a
 * parser that assumed two columns would be the one place that silently kept
 * asking for two. The caller passes `codes`; the columns follow it, and the
 * hint on screen is built from the same array so what is asked for and what is
 * read can never disagree.
 *
 * Every language is required, because `0051` requires them: `item_options.name`
 * must carry a non-empty string for each, and a row missing one is refused by
 * the database rather than saved half-translated.
 *
 * ## The price is the last column and may be left off
 *
 * A free choice is the common case — most extras on most menus cost nothing —
 * so a line with no price is free rather than invalid. It is typed the way
 * people say it (`1.50`, not `150`) and scaled by the shop's currency, which is
 * the same bargain `MoneyInput` makes everywhere else.
 *
 * ## Nothing is created until every line parses
 *
 * The parse returns rows *or* problems, never a mixture applied halfway. A bulk
 * add that inserted the first four lines and then failed on the fifth would
 * leave the operator to work out which four landed, and re-pasting the list
 * would duplicate them. All or nothing is the only outcome that can be
 * described in one sentence.
 */

export type ParsedChoice = {
  name: Localized;
  /** Minor units, already scaled by the currency's decimals. */
  price: number;
};

/** A line that could not be read, and why — `line` is 1-based, as typed. */
export type LineProblem = {
  line: number;
  /** A translation key, so the message goes through `t()` like every other. */
  key: BulkProblemKey;
  params?: Record<string, string | number>;
};

export type BulkProblemKey =
  | "options.bulkColumns"
  | "options.bulkNameMissing"
  | "options.bulkNameLong"
  | "options.bulkPrice"
  | "options.bulkPriceRange"
  | "options.bulkDuplicate";

export type BulkParse =
  | { ok: true; choices: ParsedChoice[] }
  | { ok: false; problems: LineProblem[] };

/**
 * Turns the textarea's contents into choices, or into a list of problems.
 *
 * @param text     What was typed. Blank lines are skipped, not reported —
 *                 pasted lists routinely carry a trailing newline, and refusing
 *                 one would be pedantry the operator has to fix by hand.
 * @param codes    The language codes, in the order their columns appear.
 * @param decimals The shop currency's decimal places, for scaling the price.
 *                 `null` while the currency is unknown, which makes every
 *                 priced line a problem rather than a guess — the same rule
 *                 `MoneyInput` follows, and for the same reason: a scale
 *                 guessed wrong is wrong by a factor of a hundred.
 */
export function parseBulkChoices(
  text: string,
  codes: string[],
  decimals: number | null,
): BulkParse {
  const problems: LineProblem[] = [];
  const choices: ParsedChoice[] = [];
  /** Lower-cased first-language names, to catch a list pasted twice. */
  const seen = new Map<string, number>();

  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const at = index + 1;
    if (raw.trim() === "") continue;

    const columns = raw.split("|").map((column) => column.trim());

    // One column per language, plus an optional price. More than that is a
    // stray `|` inside a name, which is worth saying rather than silently
    // dropping half of it.
    if (columns.length < codes.length || columns.length > codes.length + 1) {
      problems.push({
        line: at,
        key: "options.bulkColumns",
        params: { expected: codes.length, found: columns.length },
      });
      continue;
    }

    const name: Localized = {};
    let named = true;

    for (let column = 0; column < codes.length; column += 1) {
      const value = columns[column];
      if (value === "") {
        problems.push({
          line: at,
          key: "options.bulkNameMissing",
          params: { code: codes[column].toUpperCase() },
        });
        named = false;
        break;
      }
      if (value.length > TEXT.name) {
        problems.push({
          line: at,
          key: "options.bulkNameLong",
          params: { code: codes[column].toUpperCase(), max: TEXT.name },
        });
        named = false;
        break;
      }
      name[codes[column]] = value;
    }

    if (!named) continue;

    const typed = columns[codes.length];
    const price = toMinorUnits(typed, decimals);
    if (price === null) {
      problems.push({ line: at, key: "options.bulkPrice" });
      continue;
    }

    const money = validatePrice(price);
    if (!money.ok) {
      problems.push({ line: at, key: "options.bulkPriceRange" });
      continue;
    }

    // Within the pasted block only. Whether it collides with a choice already
    // on the question is the database's business — `item_options_group_slug_idx`
    // (0067) is unique per group — and repeating that rule here would be a
    // second copy of it to drift.
    const handle = (name[codes[0]] ?? "").toLowerCase();
    const first = seen.get(handle);
    if (first !== undefined) {
      problems.push({
        line: at,
        key: "options.bulkDuplicate",
        params: { name: name[codes[0]] ?? "", first },
      });
      continue;
    }
    seen.set(handle, at);

    choices.push({ name, price });
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, choices };
}

/**
 * A typed price as minor units, or `null` when it is not a number.
 *
 * An absent column is free — see the note above. `Math.round` rather than a
 * truncation, and the same expression `MoneyInput` uses, so a price typed into
 * the box and the same price pasted into the list land on the same integer.
 */
function toMinorUnits(typed: string | undefined, decimals: number | null): number | null {
  if (typed === undefined || typed === "") return 0;
  if (decimals === null) return null;

  const amount = Number(typed);
  if (!Number.isFinite(amount)) return null;

  return Math.round(amount * 10 ** decimals);
}

/**
 * The example shown under the box, built from the same `codes` the parser uses.
 *
 * Generated rather than written out, so a third language adds a column to the
 * hint and to the parse at once. A hint that fell behind the format would be
 * worse than none: it would be an instruction to type something that fails.
 */
export function bulkPlaceholder(codes: string[]): string {
  const examples: Record<string, string[]> = {
    en: ["Small", "Medium", "Large"],
    ar: ["صغير", "وسط", "كبير"],
  };

  return [0, 1, 2]
    .map((row) => {
      const columns = codes.map(
        (code) => examples[code]?.[row] ?? `${code}-${row + 1}`,
      );
      // A free first line and priced ones after it, because both shapes are
      // valid and the example is the only place that is said.
      return [...columns, ["", "1.50", "3"][row]].filter(Boolean).join(" | ");
    })
    .join("\n");
}
