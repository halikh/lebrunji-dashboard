import { t } from "@/i18n/translations";
import { readEnv } from "./env";
import { IMAGE } from "./limits";
import { getAccessToken, getClient } from "./supabase/client";
import { sniffImageType, validateImage } from "./validation";

/**
 * Pictures, straight from the browser to Storage.
 *
 * In `lib` rather than under `features/catalog`, because three features upload
 * into the same bucket — menu items, stores, categories — and because the
 * `ImageUploader` primitive in `components/ui` needs it, which the lint
 * boundary forbids it from reaching into a feature to get.
 *
 * The `images` bucket (migration 0065) is public to read and admin-only to
 * write, so the upload carries the operator's own token and RLS decides — the
 * same arrangement as every other write in this dashboard. Nothing passes
 * through a server route, and there is no service-role key anywhere near it.
 *
 * The bucket is public rather than signed because `stores.image_url`,
 * `menu_items.image_url`, `categories.image_url` and `discounts.image_url` are
 * plain text columns the app hands to an `<Image>` while signed out. A signed
 * URL expires; the column would then hold a link that worked when it was
 * written and does not now.
 */

const BUCKET = "images";

export type UploadedImage = {
  /** The object's path inside the bucket — what `deleteImage` takes. */
  path: string;
  /** The public URL, which is what goes in the `image_url` column. */
  url: string;
};

/**
 * Checks a file, then uploads it.
 *
 * ## Everything is decided before a byte is sent
 *
 * Type, size and dimensions are all settled first. Uploading and then
 * discovering the image is 12000 pixels wide wastes the operator's connection
 * and — on the shop's phone tethered in a back room — their data.
 *
 * **The type comes from the file's first bytes, not from `File.type`**, which
 * the operating system derives from the extension. A `.png` that is really a
 * PDF claims `image/png` there. The bucket would accept it, the column would
 * hold a URL, and the app would render a broken image with nothing to explain
 * it.
 *
 * ## Why not supabase-js
 *
 * `storage.upload` reports no progress. A five-megabyte photograph behind a
 * spinner that says nothing is the state in which people press the button
 * again, so this is an `XMLHttpRequest` — still the only way to watch an upload
 * — carrying the token the client would have used.
 */
export async function uploadImage(
  file: File,
  folder: "menu-items" | "stores" | "categories",
  options: {
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<UploadedImage> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = sniffImageType(head);

  const size = await readDimensions(file);
  const verdict = validateImage({
    bytes: file.size,
    type,
    width: size?.width,
    height: size?.height,
  });
  if (!verdict.ok) throw new Error(t(verdict.key, verdict.params));

  const { supabaseUrl, supabaseAnonKey } = readEnv();
  const token = await getAccessToken();
  if (!token) throw new Error(t("images.notSignedIn"));

  // Never the file's own name. Two shops both uploading `logo.png` would
  // collide, and a filename is text somebody typed appearing verbatim in a URL
  // the app requests.
  const path = `${folder}/${crypto.randomUUID()}.${extensionFor(type as string)}`;

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`);
    request.setRequestHeader("authorization", `Bearer ${token}`);
    request.setRequestHeader("apikey", supabaseAnonKey);
    // The sniffed type, not `file.type` — the same reasoning as above, and this
    // is the header the CDN will serve the object with.
    request.setRequestHeader("content-type", type as string);
    // The bucket is admin-only to write and the path is a fresh uuid, so an
    // overwrite would mean a uuid collision. Refusing is the louder answer.
    request.setRequestHeader("x-upsert", "false");

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(event.loaded / event.total);
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else
        reject(new Error(storageMessage(request.status, request.responseText)));
    });
    request.addEventListener("error", () =>
      reject(new Error(t("images.failed"))),
    );
    request.addEventListener("abort", () =>
      reject(new DOMException("Aborted", "AbortError")),
    );

    options.signal?.addEventListener("abort", () => request.abort(), {
      once: true,
    });
    request.send(file);
  });

  return {
    path,
    url: getClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
  };
}

/**
 * Removes an object.
 *
 * Only ever called on a file this session uploaded and then replaced before
 * saving — one that no row has ever pointed at. Deleting an image a row still
 * references would take the picture out of the app, and the row would go on
 * holding a URL that 404s.
 */
export async function deleteImage(path: string): Promise<void> {
  const { error } = await getClient().storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

/**
 * The image's dimensions, or null if they cannot be read.
 *
 * Null rather than throwing: `createImageBitmap` refuses some valid files —
 * animated WebP in older Safari among them — and refusing to upload a
 * perfectly good photograph because the browser would not measure it is the
 * wrong trade. `validateImage` skips the pixel checks when it has no numbers,
 * and the size and type checks still apply.
 */
async function readDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    // Bitmaps hold their pixels until collected, and these are large.
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/**
 * What went wrong, in terms the operator can act on.
 *
 * The distinction that matters is the same one the sign-in form draws: a
 * refusal they can do something about, versus one they cannot. 403 means this
 * account is not an operator — retrying will not help and they should be told
 * so rather than left clicking.
 */
function storageMessage(status: number, body: string): string {
  if (status === 401 || status === 403) return t("images.notAllowed");
  if (status === 413) {
    return t("validation.imageTooBig", {
      max: Math.round(IMAGE.maxBytes / 1024 / 1024),
    });
  }
  // Unrecognised. The raw body is ugly and true; inventing a friendlier
  // sentence for a failure nobody has read would say something confident about
  // something not understood.
  return body || t("images.failed");
}
