import { describe, expect, it } from "vitest";

import {
  cleanLocalized,
  isTagName,
  lettersOnly,
  rejectedIn,
  tagName,
  titleCase,
  titleLocalized,
  withoutRejected,
} from "./text-format";

describe("the rejected characters", () => {
  it("names what it would drop, once each, in order", () => {
    expect(rejectedIn("a+b/c+d")).toEqual(["+", "/"]);
  });

  it("finds nothing in a name made of allowed punctuation", () => {
    expect(rejectedIn("Fish & Chips, large (2 pcs) - Joe's!")).toEqual([]);
  });

  it("drops them and keeps everything else", () => {
    expect(withoutRejected("Fries + dip / large")).toBe("Fries  dip  large");
  });
});

describe("cleanLocalized", () => {
  // The whole point of the change that introduced it: case is the operator's.
  it("keeps case exactly as typed", () => {
    expect(cleanLocalized({ en: "McDonald's iPhone USD", ar: "مطعم" })).toEqual(
      { en: "McDonald's iPhone USD", ar: "مطعم" },
    );
  });

  it("drops the rejected characters in every language", () => {
    expect(cleanLocalized({ en: "pizza <b>", ar: "مطعم #" })).toEqual({
      en: "pizza b",
      ar: "مطعم ",
    });
  });

  it("leaves null alone", () => {
    expect(cleanLocalized(null)).toBe(null);
  });
});

describe("titleCase", () => {
  it("capitalises every word whatever case it was typed in", () => {
    expect(titleCase("MILK BASED")).toBe("Milk Based");
    expect(titleCase("milk based")).toBe("Milk Based");
    expect(titleCase("mILk Based")).toBe("Milk Based");
  });

  it("keeps spacing, including a trailing space mid-typing", () => {
    expect(titleCase("milk ")).toBe("Milk ");
    expect(titleCase("  fish   chips")).toBe("  Fish   Chips");
  });

  it("raises the first letter, not the first character", () => {
    expect(titleCase("kibbeh (4 PCS)")).toBe("Kibbeh (4 Pcs)");
    expect(titleCase("(large)")).toBe("(Large)");
  });

  it("does not raise letters after punctuation or a digit inside a word", () => {
    expect(titleCase("JOE'S wood-fired")).toBe("Joe's Wood-fired");
    expect(titleCase("2ND floor")).toBe("2nd Floor");
  });

  it("leaves scripts without case alone", () => {
    expect(titleCase("مطبخ نارا")).toBe("مطبخ نارا");
  });

  it("keeps the length when a letter has no single-character upper case", () => {
    expect(titleCase("ßtraße")).toHaveLength("ßtraße".length);
  });
});

describe("titleLocalized", () => {
  it("cleans and title-cases every language", () => {
    expect(titleLocalized({ en: "MILK #BASED", ar: "حليب" })).toEqual({
      en: "Milk Based",
      ar: "حليب",
    });
  });

  it("leaves null alone", () => {
    expect(titleLocalized(null)).toBe(null);
  });
});

describe("isTagName", () => {
  it("takes words of letters with single spaces", () => {
    expect(isTagName("Spicy")).toBe(true);
    expect(isTagName("Gluten free")).toBe(true);
    expect(isTagName("Végétarien")).toBe(true);
    expect(isTagName("حار")).toBe(true);
    expect(isTagName("خالٍ من الغلوتين")).toBe(true);
  });

  it("is not bothered by spaces at the edges or doubled", () => {
    expect(isTagName("  Gluten   free ")).toBe(true);
  });

  it("refuses emoji, digits and punctuation", () => {
    expect(isTagName("🌶️ Spicy")).toBe(false);
    expect(isTagName("Top 10")).toBe(false);
    expect(isTagName("Chef's pick")).toBe(false);
    expect(isTagName("Hot-ish")).toBe(false);
  });
});

describe("tagName", () => {
  it("trims and collapses, and leaves case alone", () => {
    expect(tagName("  Gluten   FREE ")).toBe("Gluten FREE");
  });
});

describe("lettersOnly", () => {
  it("drops what a tag cannot hold and names it", () => {
    expect(lettersOnly("Top 10!")).toEqual({
      kept: "Top ",
      dropped: ["1", "0", "!"],
    });
  });

  it("keeps a trailing space for the next word, not a leading one", () => {
    expect(lettersOnly(" Gluten  ").kept).toBe("Gluten ");
  });

  it("does not name an invisible variation selector", () => {
    expect(lettersOnly("🌶️Hot").dropped).toEqual(["🌶"]);
  });
});
