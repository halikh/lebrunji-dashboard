import { describe, expect, it } from "vitest";

import {
  formatLocalized,
  formatText,
  hasEmoji,
  rejectedIn,
  sentenceCase,
  upperCase,
  withoutRejected,
} from "./text-format";

describe("upperCase", () => {
  it("shouts", () => {
    expect(upperCase("el grande pizza")).toBe("EL GRANDE PIZZA");
  });

  it("leaves a script with no case alone", () => {
    expect(upperCase("مطبخ نارة")).toBe("مطبخ نارة");
  });
});

describe("sentenceCase", () => {
  it("capitalises the first letter and lowers the rest", () => {
    expect(sentenceCase("Coffee Shops")).toBe("Coffee shops");
    expect(sentenceCase("PHONE STORES")).toBe("Phone stores");
  });

  // The trade the doc comment names: a rule that capitalises only the first
  // word cannot also keep an acronym.
  it("lowercases an acronym, knowingly", () => {
    expect(sentenceCase("priced in USD")).toBe("Priced in usd");
  });

  it("finds the first letter past a leading digit or space", () => {
    expect(sentenceCase(" 4 pieces")).toBe(" 4 Pieces");
  });

  it("leaves a script with no case alone", () => {
    expect(sentenceCase("مقاهي")).toBe("مقاهي");
  });

  it("survives an empty value", () => {
    expect(sentenceCase("")).toBe("");
  });
});

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

describe("formatText", () => {
  it("filters before it cases", () => {
    // The angle brackets and the closing slash all go, which is the point:
    // what is left is text rather than half a tag.
    expect(formatText("pizza <b>margherita</b>", "upper")).toBe(
      "PIZZA BMARGHERITAB",
    );
  });

  it("does both for sentence case", () => {
    expect(formatText("SERVED with #chips", "sentence")).toBe(
      "Served with chips",
    );
  });
});

describe("hasEmoji", () => {
  it("finds one anywhere in the value", () => {
    expect(hasEmoji("🌶️ Spicy")).toBe(true);
    expect(hasEmoji("Spicy 🌶")).toBe(true);
  });

  it("is false for words alone", () => {
    expect(hasEmoji("Spicy")).toBe(false);
    expect(hasEmoji("حار")).toBe(false);
  });
});

describe("formatLocalized", () => {
  it("does every language and leaves null alone", () => {
    expect(formatLocalized({ en: "el grande", ar: "مطعم" }, "upper")).toEqual({
      en: "EL GRANDE",
      ar: "مطعم",
    });
    expect(formatLocalized(null, "sentence")).toBe(null);
  });
});
