import { NextResponse } from "next/server";

import { getObject } from "@/lib/storage/bucket";

/**
 * Serves a stored picture to anyone, with no session.
 *
 * ## Why this route exists at all
 *
 * `stores.image_url`, `menu_items.image_url` and `discounts.image_url` are
 * plain text columns the **customer app** hands to an
 * `<Image>` while signed out. They need a URL that works forever and needs no
 * credential.
 *
 * The bucket cannot give one: it has no public read, no bucket policy, and its
 * ACLs are accepted and ignored. Only a signed request succeeds, and a signed
 * URL expires — a column full of those would hold links that worked on the day
 * they were written and 403 a fortnight later, silently, on somebody's phone.
 *
 * So this stands in for the CDN the bucket does not have. The signature is made
 * here and never leaves; the customer sees an ordinary URL.
 *
 * ## What makes it cheap enough to be reasonable
 *
 * A function invocation per image would be absurd for a menu of forty dishes.
 * Two things stop it:
 *
 * - **The response is immutable.** A key contains a uuid minted for one upload
 *   and is never rewritten — replacing a picture writes a *new* key into the
 *   column. So `immutable` is the literal truth rather than an optimistic
 *   header, and a browser that has the file never asks again.
 * - **`s-maxage` lets the edge keep it.** After the first request in a region,
 *   the CDN answers and this code does not run.
 *
 * ## And what it deliberately does not do
 *
 * No listing, no directory, no key that is not the exact shape an upload mints.
 * Without that check the path is whatever somebody puts in a URL, and a route
 * that streams arbitrary keys from a private bucket is a way to read anything
 * in it — which, on a shared bucket, need not be an image at all.
 */

/**
 * Exactly what `POST /api/images` generates — plus one name it no longer does.
 *
 * `categories` is where promotion pictures were uploaded before that folder was
 * renamed to `promotions`. The rename does not move objects, and it must not:
 * a key is written into `discounts.image_url` and the row goes on pointing at
 * it forever. Dropping the old prefix here would 404 every promotion picture
 * saved before the rename — a blank card in the customer app, with a URL that
 * looks perfectly correct.
 */
const KEY =
  /^(menu-items|stores|promotions|categories|sounds)\/[0-9a-f-]{36}\.(jpg|png|webp|mp3)$/;

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp3: "audio/mpeg",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.join("/");

  if (!KEY.test(key)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const object = await getObject(key);
    const body = object.Body;
    if (!body) return new NextResponse(null, { status: 404 });

    return new NextResponse(body.transformToWebStream(), {
      status: 200,
      headers: {
        // The stored type where the object has one, otherwise the extension —
        // which the key's shape guarantees is one of three.
        "content-type":
          object.ContentType ?? TYPES[key.split(".").pop() as string],
        ...(object.ContentLength
          ? { "content-length": String(object.ContentLength) }
          : {}),
        // A year in the browser, a year at the edge. Safe because a key is
        // never reused: see above.
        "cache-control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
        // The app requests these from another origin, and a canvas or a
        // download in the dashboard reads them back.
        "access-control-allow-origin": "*",
      },
    });
  } catch {
    // A missing object and an unreachable store are both "no picture here".
    // Saying which would describe the bucket to anybody who asks.
    return new NextResponse(null, { status: 404 });
  }
}
