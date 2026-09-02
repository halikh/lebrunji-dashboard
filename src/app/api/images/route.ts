import { NextResponse, type NextRequest } from "next/server";

import { requireOperator } from "@/lib/auth/operator";
import { IMAGE, SOUND } from "@/lib/limits";
import { deleteObject, imageUrlFor, presignUpload } from "@/lib/storage/bucket";

/**
 * Where the browser asks permission to put a picture in the bucket, and where
 * it asks for one to be taken out again.
 *
 * The bytes do not come through here — see `lib/storage/bucket.ts` for why the
 * browser uploads straight to the store. What comes through here is the
 * *decision*, which is the part that must not be the browser's.
 *
 * ## Everything the client says is re-decided
 *
 * The uploader already sniffs the file's magic bytes and checks its size before
 * sending anything, and that is worth doing — it saves a shop's phone from
 * spending its data on a file that was never going to be accepted. But it is a
 * courtesy to the operator, not a control: a hand-written request skips it
 * entirely.
 *
 * So the type and the size are checked again here against the same `IMAGE`
 * limits, and **the key is generated here**, never accepted. A client-supplied
 * key is a client-supplied path — `../` in it, or a name that collides with an
 * object a live row points at, and a form field becomes a way to overwrite
 * somebody else's picture.
 *
 * This is the plan's "the UI is never the only guard" in the one part of the
 * product where the guard cannot be a CHECK constraint.
 */

/**
 * Where an upload can belong. Anything else is not a folder.
 *
 * `sounds` is here rather than in a route of its own: the decision this
 * endpoint makes — is the caller an operator, is the type allowed, what is the
 * key — is identical for a chime and a photograph, and a second copy of that
 * would be a second place for the operator check to drift.
 */
const FOLDERS = ["menu-items", "stores", "categories", "sounds"] as const;
type Folder = (typeof FOLDERS)[number];

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
};

/**
 * Which types each folder accepts, and how big.
 *
 * Per folder rather than one global list, because they are different limits for
 * different reasons — 5 MB is a reasonable photograph and an absurd chime — and
 * because a photograph in `sounds` would be served as audio and play nothing.
 */
const ALLOWED: Record<Folder, { types: readonly string[]; maxBytes: number }> =
  {
    "menu-items": { types: IMAGE.types, maxBytes: IMAGE.maxBytes },
    stores: { types: IMAGE.types, maxBytes: IMAGE.maxBytes },
    categories: { types: IMAGE.types, maxBytes: IMAGE.maxBytes },
    sounds: { types: SOUND.types, maxBytes: SOUND.maxBytes },
  };

export async function POST(request: NextRequest) {
  // Built first, so a token rotation inside the check has a jar to write into.
  const carrier = NextResponse.json({});
  const check = await requireOperator(request, carrier);
  if (!check.ok) return check.response;

  let body: { folder?: unknown; type?: unknown; bytes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "malformed" }, { status: 400 });
  }

  const folder = body.folder;
  if (typeof folder !== "string" || !FOLDERS.includes(folder as Folder)) {
    return NextResponse.json({ error: "folder" }, { status: 400 });
  }

  const rules = ALLOWED[folder as Folder];

  const type = body.type;
  // Checked against **this folder's** list, not against every type the route
  // knows: a JPEG uploaded into `sounds` would be stored, served as audio, and
  // play nothing with nothing to explain it.
  if (typeof type !== "string" || !rules.types.includes(type)) {
    return NextResponse.json({ error: "type" }, { status: 400 });
  }

  const bytes = body.bytes;
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return NextResponse.json({ error: "size" }, { status: 400 });
  }
  if (bytes > rules.maxBytes) {
    return NextResponse.json({ error: "tooBig" }, { status: 413 });
  }

  // Never the file's own name. Two shops uploading `logo.png` would collide,
  // and a filename is text somebody typed appearing verbatim in a URL the app
  // then requests.
  const key = `${folder}/${crypto.randomUUID()}.${EXTENSIONS[type]}`;
  const uploadUrl = await presignUpload(key, type);

  return NextResponse.json(
    { key, uploadUrl, url: imageUrlFor(key, request.nextUrl.origin) },
    // A signed URL is a credential, however short-lived.
    { status: 200, headers: { "cache-control": "no-store, private" } },
  );
}

/**
 * Removes an object the uploader put there and then replaced.
 *
 * The client says which, and that is a claim worth being careful about: this
 * key is the only thing standing between the endpoint and "delete any picture
 * in the product". It cannot be verified from here — the bucket does not know
 * which objects a row points at — so the shape is constrained instead, to
 * exactly what `POST` above generates, and the honest limit is written down:
 * **an operator can delete an operator's images.** That is a much smaller claim
 * than it looks, because being an operator is already the power to blank the
 * column and archive the row.
 */
export async function DELETE(request: NextRequest) {
  const carrier = NextResponse.json({});
  const check = await requireOperator(request, carrier);
  if (!check.ok) return check.response;

  const key = request.nextUrl.searchParams.get("key") ?? "";

  // The exact shape `POST` mints: a known folder, a uuid, a known extension.
  // No `..`, no nesting, nothing outside the three folders — and matching the
  // whole string, because a pattern that only has to appear *somewhere* is not
  // a constraint on a path.
  const shape =
    /^(menu-items|stores|categories|sounds)\/[0-9a-f-]{36}\.(jpg|png|webp|mp3)$/;
  if (!shape.test(key)) {
    return NextResponse.json({ error: "key" }, { status: 400 });
  }

  await deleteObject(key);
  return new NextResponse(null, { status: 204 });
}
