import { t } from "@/i18n/translations";
import { IMAGE } from "./limits";
import { sniffImageType, validateImage } from "./validation";

/**
 * Pictures, from the browser into the object store.
 *
 * In `lib` rather than under `features/catalog`, because three features upload
 * into the same bucket — menu items, stores, categories — and because the
 * `ImageUploader` primitive in `components/ui` needs it, which the lint
 * boundary forbids it from reaching into a feature to get.
 *
 * ## Two hops, and only the second carries the file
 *
 * 1. `POST /api/images` — the server checks that the caller is the operator,
 *    re-checks the type and size, mints the key and signs a URL.
 * 2. `PUT` to that URL — the bytes go straight from the browser to the store.
 *
 * The reason for the split is in `lib/storage/bucket.ts`: the store's key
 * cannot be in the browser, and the file cannot go through the server. This is
 * the arrangement that satisfies both.
 *
 * It replaces an upload that went directly to a Supabase bucket under the
 * operator's own token, where RLS decided. That was better — no privileged
 * credential anywhere and no authorisation written by hand — and it is worth
 * saying plainly, because the shape of this file is otherwise a puzzle: the
 * store this now writes to has no notion of a Supabase user, so somebody has to
 * check, and that somebody is a route handler.
 *
 * ## Why an `XMLHttpRequest` for the upload
 *
 * `fetch` still cannot report upload progress. Five megabytes over a shop's
 * tethered phone behind a spinner that says nothing is indistinguishable from a
 * hang, and that is the state in which people press the button again.
 */

export type UploadedImage = {
  /** The object's key — what `deleteImage` takes. */
  path: string;
  /** The URL that goes in the `image_url` column. */
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
 * PDF claims `image/png` there. The store would accept it, the column would
 * hold a URL, and the app would render a broken image with nothing to explain
 * it.
 *
 * These checks are a courtesy, not a control: the server makes them again, and
 * it is the server's answer that decides. See `app/api/images/route.ts`.
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

  const permission = await fetch("/api/images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ folder, type, bytes: file.size }),
    signal: options.signal,
  });

  if (!permission.ok) throw new Error(signMessage(permission.status));

  const { key, uploadUrl, url } = (await permission.json()) as {
    key: string;
    uploadUrl: string;
    url: string;
  };

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    // The sniffed type, not `file.type`. It is also part of what the URL was
    // signed for, so a different one here is refused by the store rather than
    // quietly stored — and it is the type the object is later served with.
    request.setRequestHeader("content-type", type as string);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(event.loaded / event.total);
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(putMessage(request.status)));
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

  return { path: key, url };
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
  const response = await fetch(`/api/images?key=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(t("images.failed"));
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

/**
 * Why permission was refused, in terms the operator can act on.
 *
 * The distinction that matters is the one the sign-in form draws: a refusal
 * they can do something about versus one they cannot. A signed-out session is
 * fixed by signing in; not being an operator is not fixed by retrying, and
 * saying so beats leaving somebody clicking.
 */
function signMessage(status: number): string {
  if (status === 401) return t("images.notSignedIn");
  if (status === 403) return t("images.notAllowed");
  if (status === 413) {
    return t("validation.imageTooBig", {
      max: Math.round(IMAGE.maxBytes / 1024 / 1024),
    });
  }
  return t("images.failed");
}

/**
 * Why the store refused the file itself.
 *
 * 403 here is not "you are not an operator" — permission was granted a moment
 * ago. It is an expired or altered signature, and the answer to both is to try
 * again, which is what the message says.
 */
function putMessage(status: number): string {
  if (status === 403) return t("images.linkExpired");
  return t("images.failed");
}
