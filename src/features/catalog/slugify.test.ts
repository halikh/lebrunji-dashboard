import { describe, expect, it } from "vitest";

import { slugify } from "./menu-item-editor";
import { validateSlug } from "@/lib/validation";

/**
 * A generated slug becomes the key an import file joins on, so a bad one is not
 * cosmetic — it is a row that will not match next month. Every case here is
 * asserted to *also* pass `validateSlug`, because the generator and the
 * validator disagreeing is the failure that would never be noticed: the form
 * would refuse a slug it produced itself.
 */
const generates = (input: string) => {
  const slug = slugify(input);
  if (slug.length > 0) expect(validateSlug(slug).ok).toBe(true);
  return slug;
};

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(generates("Kibbeh Plate")).toBe("kibbeh-plate");
  });

  it("collapses runs of punctuation into one hyphen", () => {
    // `kibbeh--plate` would be refused by the validator, which is exactly the
    // disagreement this file exists to prevent.
    expect(generates("Kibbeh  &  Plate")).toBe("kibbeh-plate");
  });

  it("trims hyphens from both ends", () => {
    expect(generates("  Kibbeh!  ")).toBe("kibbeh");
    expect(generates("...Kibbeh...")).toBe("kibbeh");
  });

  it("keeps the letter when stripping an accent", () => {
    // "café" must become "cafe", not "caf" — the accent is separated by NFD and
    // then removed, so the base letter survives.
    expect(generates("Café Latte")).toBe("cafe-latte");
  });

  it("keeps digits", () => {
    expect(generates("2 for 1 Tuesday")).toBe("2-for-1-tuesday");
  });

  it("returns nothing for a name with no Latin letters", () => {
    // Deliberate. Transliterating Arabic is a guess, and a wrong guess becomes
    // the key an import joins on — so the operator is asked to type one rather
    // than handed something plausible and wrong.
    expect(slugify("صحن كبة")).toBe("");
  });

  it("stays within the column", () => {
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(64);
  });

  it("does not end on a hyphen after being cut to length", () => {
    // A truncation landing on a separator produces `some-long-name-`, which the
    // validator refuses — the form would reject a slug it generated itself.
    //
    // The word length is chosen so character 64 falls exactly on a hyphen:
    // 'abcd ' repeated puts a separator at every fifth character, and 65 is one.
    // The first version of `slugify` trimmed before slicing and failed this.
    const slug = slugify("abcd ".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(64);
    expect(slug.endsWith("-")).toBe(false);
    expect(validateSlug(slug).ok).toBe(true);
  });
});
