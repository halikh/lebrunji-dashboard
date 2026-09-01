import { cx } from "./index";

/**
 * Initials on a coloured ground, for a person with no picture.
 *
 * ## The colour is not random
 *
 * It looks random and it is a hash of the id, which matters: a genuinely random
 * colour would change on every render, so a list would reshuffle its colours on
 * each refetch and the avatar would become noise rather than a handle. Derived,
 * the same customer is the same colour forever — on the list, on their profile,
 * and tomorrow — which is the only thing that makes it worth drawing at all.
 *
 * The hash is over the **id**, not the name. Two customers called Alin should
 * be two colours; one who changes their name should keep theirs.
 *
 * ## Ink on a wash, on every tone
 *
 * The same rule the tag chips follow, and for the same measured reason: the
 * palette records coral on `coralTint` at 2.4:1, which fails for text this
 * small. The wash carries the identity and ink carries the letters.
 */

/**
 * The washes an avatar can take.
 *
 * Written out rather than assembled — `bg-${tone}-wash` is a class name
 * Tailwind never sees in the source, so the utility is never generated and the
 * avatar comes out transparent with no error anywhere.
 *
 * No `danger`: red is alarm, and a customer is not one.
 */
const GROUNDS = [
  "bg-accent-wash",
  "bg-yellow-wash",
  "bg-active-wash",
  "bg-info-wash",
  "bg-primary-wash",
] as const;

export function Avatar({
  /** Hashed for the colour. Stable for the life of the row. */
  id,
  /** May be empty — an unfinished signup has no name yet. */
  name,
  size = 36,
  className,
}: {
  id: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const letters = initials(name);

  return (
    <span
      // Decorative: the name is right beside it in text, and reading the
      // initials out before it would be the same information twice.
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-text",
        GROUNDS[hash(id) % GROUNDS.length],
        className,
      )}
    >
      {letters}
    </span>
  );
}

/**
 * One or two letters.
 *
 * The first letter of the first two words — "Rami Haddad" is RH — because a
 * single letter collides constantly on a list where half the names share an
 * initial. A name that is one word gives one letter rather than two from the
 * same word, which reads as an abbreviation of something else.
 *
 * An empty name is a real state here (`users.name = ''` is "signup not
 * finished"), and it gets a dash rather than a blank circle: an avatar with
 * nothing in it looks like a failure to load.
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  return words
    .slice(0, 2)
    .map((word) => [...word][0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * A small, stable hash.
 *
 * FNV-1a, chosen because it is short, has no dependencies and spreads adjacent
 * strings well — uuids differ in a few characters, and a weaker hash would give
 * consecutive customers the same colour. It is not a security primitive and
 * nothing here treats it as one.
 *
 * `>>> 0` keeps it unsigned, so the modulo cannot come back negative and index
 * off the front of the array.
 */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}
