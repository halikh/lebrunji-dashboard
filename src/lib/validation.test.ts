import { describe, expect, it } from "vitest";

import { PASSWORD, TEXT } from "./limits";
import {
  firstFailure,
  sniffImageType,
  validateDeliveryBand,
  validateDiscountValue,
  validateDiscountWindow,
  validateHours,
  validateImage,
  validateLocalizedText,
  validatePassword,
  validatePrepWindow,
  validatePrice,
  validateSlug,
} from "./validation";

/** Reads better than `expect(r.ok).toBe(false)` and names the message. */
const message = (r: ReturnType<typeof validateSlug>) =>
  r.ok ? null : r.message;

describe("validateSlug", () => {
  it("accepts the shape every existing slug takes", () => {
    for (const slug of [
      "kibbeh",
      "kibbeh-plate",
      "store-aurora",
      "a1",
      "2for1-tuesday",
    ]) {
      expect(validateSlug(slug).ok).toBe(true);
    }
  });

  it("rejects the shapes that would break an import join", () => {
    for (const slug of [
      "Kibbeh",
      "kibbeh plate",
      "-kibbeh",
      "kibbeh-",
      "kibbeh--plate",
      "",
    ]) {
      expect(validateSlug(slug).ok).toBe(false);
    }
  });

  it("rejects a slug past the column limit", () => {
    expect(validateSlug("a".repeat(TEXT.slug + 1)).ok).toBe(false);
  });
});

describe("validateLocalizedText", () => {
  const languages = ["en", "ar"];

  it("accepts a value in every language", () => {
    expect(
      validateLocalizedText({ en: "Kibbeh", ar: "كبة" }, languages, TEXT.name)
        .ok,
    ).toBe(true);
  });

  it("names the missing language rather than failing anonymously", () => {
    // This is the case the locales CHECK constraint would otherwise report as
    // `menu_items_name_locales`, which tells the operator nothing.
    expect(
      message(validateLocalizedText({ en: "Kibbeh" }, languages, TEXT.name)),
    ).toContain("ar");
  });

  it("treats whitespace as empty, because the constraint does too", () => {
    expect(
      validateLocalizedText({ en: "Kibbeh", ar: "   " }, languages, TEXT.name)
        .ok,
    ).toBe(false);
  });

  it("requires nothing at all when the column is nullable", () => {
    expect(
      validateLocalizedText({}, languages, TEXT.tagline, { optional: true }).ok,
    ).toBe(true);
    // …but half of an optional value is still half a value.
    expect(
      validateLocalizedText({ en: "Fresh" }, languages, TEXT.tagline, {
        optional: true,
      }).ok,
    ).toBe(false);
  });

  it("reports which language is too long", () => {
    const over = { en: "x".repeat(TEXT.name + 1), ar: "كبة" };
    expect(
      message(validateLocalizedText(over, languages, TEXT.name)),
    ).toContain("en");
  });

  it("follows the languages it is given, not a hardcoded pair", () => {
    // The point of reading `languages` from the database: adding one is a row.
    const three = ["en", "ar", "ku"];
    expect(
      validateLocalizedText({ en: "a", ar: "b" }, three, TEXT.name).ok,
    ).toBe(false);
    expect(
      validateLocalizedText({ en: "a", ar: "b", ku: "c" }, three, TEXT.name).ok,
    ).toBe(true);
  });
});

describe("validatePrice", () => {
  it("accepts zero, because a free item is a real thing", () => {
    expect(validatePrice(0).ok).toBe(true);
  });

  it("rejects a negative price", () => {
    expect(validatePrice(-1).ok).toBe(false);
  });

  it("rejects a fraction rather than rounding it", () => {
    // 12.50 here almost always means "major units", which would be a hundredth
    // of the intended charge. Refusing is the only safe answer.
    expect(validatePrice(12.5).ok).toBe(false);
  });

  it("catches a fat-fingered zero", () => {
    expect(validatePrice(100_000_000_0).ok).toBe(false);
  });
});

describe("validateHours", () => {
  it("accepts an ordinary daytime window", () => {
    expect(validateHours(1, "09:00", "17:30").ok).toBe(true);
  });

  it("accepts a window that runs past midnight", () => {
    // The case a naive `closes > opens` check would have made unwritable, and
    // the reason no such constraint exists in the database.
    expect(validateHours(5, "22:00", "02:00").ok).toBe(true);
  });

  it("rejects a malformed time", () => {
    expect(validateHours(1, "9:00", "17:00").ok).toBe(false);
    expect(validateHours(1, "24:00", "02:00").ok).toBe(false);
  });

  it("rejects a day outside the week", () => {
    expect(validateHours(7, "09:00", "17:00").ok).toBe(false);
  });
});

describe("validatePrepWindow", () => {
  it("accepts the seeded default", () => {
    expect(validatePrepWindow(10, 20).ok).toBe(true);
  });

  it("rejects a window that runs backwards", () => {
    expect(validatePrepWindow(30, 10).ok).toBe(false);
  });
});

describe("validateDeliveryBand", () => {
  it("accepts a seeded band", () => {
    expect(validateDeliveryBand(3, 100).ok).toBe(true);
  });

  it("refuses a duplicate ceiling", () => {
    expect(validateDeliveryBand(5, 150, [3, 5, 8]).ok).toBe(false);
  });

  it("refuses more precision than the column keeps", () => {
    expect(validateDeliveryBand(3.456, 100).ok).toBe(false);
    expect(validateDeliveryBand(3.45, 100).ok).toBe(true);
  });
});

describe("discounts", () => {
  it("caps a percentage at 100", () => {
    expect(validateDiscountValue("percentage", 100).ok).toBe(true);
    expect(validateDiscountValue("percentage", 101).ok).toBe(false);
    // A fixed amount has no such ceiling — it is money, in minor units.
    expect(validateDiscountValue("fixedAmount", 500_000).ok).toBe(true);
  });

  it("refuses a window that ends before it starts", () => {
    expect(validateDiscountWindow("2026-09-01", "2026-08-01").ok).toBe(false);
    expect(validateDiscountWindow("2026-08-01", "2026-09-01").ok).toBe(true);
    // An open-ended promotion is normal.
    expect(validateDiscountWindow("2026-08-01", null).ok).toBe(true);
  });
});

describe("sniffImageType", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);

  it("reads the signature, not the name", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("returns null for anything else", () => {
    // A .pdf renamed to .png: the browser would call this image/png.
    expect(sniffImageType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });

  it("is what validateImage trusts", () => {
    const renamed = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(
      validateImage({ bytes: 1000, type: sniffImageType(renamed) }).ok,
    ).toBe(false);
  });
});

describe("validateImage", () => {
  it("accepts a reasonable photograph", () => {
    expect(
      validateImage({
        bytes: 400_000,
        type: "image/jpeg",
        width: 1200,
        height: 800,
      }).ok,
    ).toBe(true);
  });

  it("rejects one too large to upload", () => {
    expect(validateImage({ bytes: 20_000_000, type: "image/jpeg" }).ok).toBe(
      false,
    );
  });

  it("rejects a thumbnail pretending to be artwork", () => {
    expect(
      validateImage({ bytes: 1000, type: "image/png", width: 40, height: 40 })
        .ok,
    ).toBe(false);
  });
});

describe("firstFailure", () => {
  it("reports the first problem, so a form shows one message at a time", () => {
    const result = firstFailure([
      validateSlug("ok"),
      validatePrice(-1),
      validateSlug("Bad"),
    ]);
    expect(message(result)).toBe("A price cannot be negative.");
  });

  it("passes when everything passes", () => {
    expect(firstFailure([validateSlug("ok"), validatePrice(100)]).ok).toBe(
      true,
    );
  });
});

describe("validatePassword", () => {
  it("accepts a long passphrase", () => {
    expect(validatePassword("correct horse battery staple").ok).toBe(true);
  });

  it("rejects one under the minimum", () => {
    expect(validatePassword("a".repeat(PASSWORD.min - 1)).ok).toBe(false);
  });

  it("asks for length rather than punctuation", () => {
    // No composition rule. `Password1!` satisfies every character class and is
    // guessed instantly; a long passphrase satisfies none and is not. Length is
    // what costs an attacker, so length is what is asked for.
    expect(validatePassword("a-perfectly-ordinary-passphrase").ok).toBe(true);
  });

  it("refuses past the bcrypt truncation point rather than ignoring the tail", () => {
    expect(validatePassword("x".repeat(PASSWORD.max + 1)).ok).toBe(false);
  });

  it("counts bytes, not characters, for that limit", () => {
    // 71 emoji are 284 bytes. Accepting this would mean most of what was typed
    // does nothing, which is worse than refusing it.
    expect(validatePassword("\u{1F642}".repeat(71)).ok).toBe(false);
  });

  it("refuses a leading or trailing space", () => {
    expect(validatePassword(" a-long-enough-passphrase").ok).toBe(false);
    expect(validatePassword("a-long-enough-passphrase ").ok).toBe(false);
  });

  it("refuses the email address inside the password", () => {
    // Note the phrase avoids the denylisted words on purpose: this test is
    // about the email rule, and a string that trips two rules would pass for
    // the wrong reason.
    expect(
      validatePassword("halikh-rides-a-bicycle", {
        email: "halikh@example.com",
      }).ok,
    ).toBe(false);
    // Without the email it cannot know, and must not guess.
    expect(validatePassword("halikh-rides-a-bicycle").ok).toBe(true);
  });

  it("ignores a very short local part, which would match almost anything", () => {
    expect(
      validatePassword("a-long-enough-passphrase", { email: "hi@example.com" })
        .ok,
    ).toBe(true);
  });

  it("refuses the words an attacker starts with", () => {
    expect(validatePassword("lebrunji-forever-2026").ok).toBe(false);
    expect(validatePassword("my-password-is-good").ok).toBe(false);
  });
});
