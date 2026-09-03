import { TEXT } from "@/lib/limits";
import { validatePrice, type Localized } from "@/lib/validation";

/**
 * Reading a list of named rows out of a block of typed text.
 *
 * ## Why bulk entry exists
 *
 * Menu content arrives as a *set*, not one thing at a time. A shop's sections
 * are the six headings on its printed menu. A section's items are the eleven
 * lines under one of those headings. A question's answers are small, medium and
 * large. Every one of those is typed into a form that takes a name in each
 * language, once per row — and doing that eleven times is eleven focus changes,
 * eleven Add presses and eleven round trips, which is the job of setting up a
 * menu at its most tedious scale. Operators already have the list, usually in a
 * message or a spreadsheet. This lets them paste it.
 *
 * ## One parser for all three
 *
 * Sections, items and choices differ in exactly one way: whether a row carries
 * a price, and whether that price is required. Everything else — the columns,
 * the languages, the duplicate check, the all-or-nothing rule — is identical,
 * and three copies of it would be three places for the currency scaling to
 * drift. `price` says which of the three this is.
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

/** What a row asks of its last column. */
export type PriceRule =
  /** Sections: no price column at all. */
  | "none"
  /** Choices: a free answer is the common case, so an absent price is zero. */
  | "optional"
  /** Items: a dish with no price is not a dish, so the column must be there. */
  | "required";

export type ParsedRow = {
  name: Localized;
  /** Minor units, already scaled. `null` only when the rule is `none`. */
  price: number | null;
};

/** A line that could not be read, and why — `line` is 1-based, as typed. */
export type LineProblem = {
  line: number;
  /** A translation key, so the message goes through `t()` like every other. */
  key: BulkProblemKey;
  params?: Record<string, string | number>;
};

export type BulkProblemKey =
  | "bulk.columns"
  | "bulk.nameMissing"
  | "bulk.nameLong"
  | "bulk.price"
  | "bulk.priceRange"
  | "bulk.duplicate";

export type BulkParse =
  | { ok: true; rows: ParsedRow[] }
  | { ok: false; problems: LineProblem[] };

/**
 * Turns the textarea's contents into rows, or into a list of problems.
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
 * @param price    Whether the last column is a price, and whether it must be
 *                 there. See {@link PriceRule}.
 */
export function parseBulkRows(
  text: string,
  codes: string[],
  decimals: number | null,
  price: PriceRule,
): BulkParse {
  const problems: LineProblem[] = [];
  const rows: ParsedRow[] = [];
  /** Lower-cased first-language names, to catch a list pasted twice. */
  const seen = new Map<string, number>();

  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const at = index + 1;
    if (raw.trim() === "") continue;

    const columns = raw.split("|").map((column) => column.trim());

    // One column per language, then the price if this kind has one. Anything
    // else is a stray `|` inside a name or a missing column, and both are worth
    // saying rather than silently dropping half a row.
    const least = codes.length + (price === "required" ? 1 : 0);
    const most = codes.length + (price === "none" ? 0 : 1);

    if (columns.length < least || columns.length > most) {
      problems.push({
        line: at,
        key: "bulk.columns",
        params: { expected: least, found: columns.length },
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
          key: "bulk.nameMissing",
          params: { code: codes[column].toUpperCase() },
        });
        named = false;
        break;
      }
      if (value.length > TEXT.name) {
        problems.push({
          line: at,
          key: "bulk.nameLong",
          params: { code: codes[column].toUpperCase(), max: TEXT.name },
        });
        named = false;
        break;
      }
      name[codes[column]] = value;
    }

    if (!named) continue;

    let amount: number | null = null;

    if (price !== "none") {
      amount = toMinorUnits(columns[codes.length], decimals);
      if (amount === null) {
        problems.push({ line: at, key: "bulk.price" });
        continue;
      }

      const money = validatePrice(amount);
      if (!money.ok) {
        problems.push({ line: at, key: "bulk.priceRange" });
        continue;
      }
    }

    // Within the pasted block only. Whether it collides with something already
    // on the shop is the database's business — the slug indexes from `0067` and
    // `0071` are unique per group and per store — and repeating those rules
    // here would be a second copy of them to drift.
    const handle = (name[codes[0]] ?? "").toLowerCase();
    const first = seen.get(handle);
    if (first !== undefined) {
      problems.push({
        line: at,
        key: "bulk.duplicate",
        params: { name: name[codes[0]] ?? "", first },
      });
      continue;
    }
    seen.set(handle, at);

    rows.push({ name, price: amount });
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, rows };
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
export function bulkPlaceholder(
  codes: string[],
  price: PriceRule,
  kind: "sections" | "items" | "choices" = "choices",
): string {
  const examples: Record<string, Record<string, string[]>> = {
    sections: {
      en: ["Starters", "Mains", "Desserts"],
      ar: ["المقبلات", "الأطباق الرئيسية", "الحلويات"],
    },
    items: {
      en: ["Hummus", "Falafel plate", "Tabbouleh"],
      ar: ["حمص", "صحن فلافل", "تبولة"],
    },
    choices: {
      en: ["Small", "Medium", "Large"],
      ar: ["صغير", "وسط", "كبير"],
    },
  };

  // Prices for the three example lines. Where one may be left off, the first
  // line leaves it off — both shapes are valid, and the example is the only
  // place that is said. Where it is required, all three carry one.
  const prices =
    price === "none"
      ? ["", "", ""]
      : price === "optional"
        ? ["", "1.50", "3"]
        : ["4", "6.50", "5"];

  return [0, 1, 2]
    .map((row) => {
      const columns = codes.map(
        (code) => examples[kind][code]?.[row] ?? `${code}-${row + 1}`,
      );
      return [...columns, prices[row]].filter(Boolean).join(" | ");
    })
    .join("\n");
}
