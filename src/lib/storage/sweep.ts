/**
 * Which objects in the bucket nothing uses — decided, not done.
 *
 * Pure, so the rules can be tested without a bucket or a database. The route
 * (`app/api/images/unused`) does the listing, the asking and the deleting.
 *
 * ## Where the orphans come from
 *
 * The uploader deletes a file it superseded inside one editing session, and
 * nothing else: it cannot know whether a form it unmounted from was saved, and
 * it never touches a picture a row arrived with, because that row still points
 * at it until the save. So these stay behind:
 *
 * - the picture a saved replacement took over from,
 * - the picture of a row deleted for good,
 * - the last upload of an editor closed without saving,
 * - the `categories/` objects from before the folder was renamed.
 *
 * ## The rules, each one a way the sweep could otherwise delete a live picture
 *
 * - **Only the key shape an upload mints.** Anything else in the bucket was put
 *   there by hand, by somebody, for a reason this cannot see.
 * - **Nothing younger than a day.** An upload sits unreferenced from the moment
 *   it lands until its form is saved, which can be a long lunch. A day is far
 *   longer than any edit and far shorter than anybody would notice clutter.
 * - **Archived rows count as using their picture** — that is the database's
 *   half (`api_v1_image_keys_in_use`, migration 0188), so a restore never
 *   comes back blank.
 * - **Refuse when the bucket and the database do not look like the same
 *   environment.** `S3_BUCKET` pointing at production while the Supabase keys
 *   point at dev is one wrong line in an env file, and from here it looks
 *   exactly like "almost every picture is unused". So: if the database uses
 *   nothing at all while the bucket holds uploads, or if most of the keys the
 *   database uses are not in this bucket, nothing is deleted.
 */

/** The shape `POST /api/images` mints, plus the pre-rename `categories`. */
export const KEY_SHAPE =
  /^(menu-items|stores|promotions|artwork|categories|category-art|tag-art|menu-sections|sounds)\/[0-9a-f-]{36}\.(jpg|png|webp|mp3)$/;

/** How long an unreferenced upload is left alone. */
export const GRACE_MS = 24 * 60 * 60 * 1000;

export type SweepObject = { key: string; size: number; lastModified: Date };

export type SweepPlan =
  | { ok: true; unused: SweepObject[]; bytes: number }
  | { ok: false; reason: "nothing-in-use" | "mismatch" };

export function planSweep({
  objects,
  inUse,
  now,
}: {
  objects: readonly SweepObject[];
  inUse: ReadonlySet<string>;
  now: Date;
}): SweepPlan {
  const ours = objects.filter((object) => KEY_SHAPE.test(object.key));

  if (inUse.size === 0) {
    return ours.length === 0
      ? { ok: true, unused: [], bytes: 0 }
      : { ok: false, reason: "nothing-in-use" };
  }

  const stored = new Set(ours.map((object) => object.key));
  let present = 0;
  for (const key of inUse) if (stored.has(key)) present += 1;
  // Half, not all: a row can point at a picture that is genuinely gone, and a
  // handful of those should not stop the sweep. A different environment's
  // bucket shares almost no keys with this database, so it is nowhere near.
  if (present * 2 < inUse.size) return { ok: false, reason: "mismatch" };

  const cutoff = now.getTime() - GRACE_MS;
  const unused = ours.filter(
    (object) =>
      !inUse.has(object.key) && object.lastModified.getTime() < cutoff,
  );

  return {
    ok: true,
    unused,
    bytes: unused.reduce((total, object) => total + object.size, 0),
  };
}
