import { t } from "@/i18n/translations";

/**
 * The bucket sweep, from the browser. The decisions are all server-side — see
 * `app/api/images/unused/route.ts` and `lib/storage/sweep.ts`.
 */

export type UnusedPictures = { count: number; bytes: number };
export type SweepResult = { deleted: number; bytes: number; failed: number };

export async function fetchUnusedPictures(): Promise<UnusedPictures> {
  const response = await fetch("/api/images/unused", { cache: "no-store" });
  if (!response.ok) throw new Error(await reason(response));
  return (await response.json()) as UnusedPictures;
}

export async function removeUnusedPictures(): Promise<SweepResult> {
  const response = await fetch("/api/images/unused", { method: "POST" });
  if (!response.ok) throw new Error(await reason(response));
  return (await response.json()) as SweepResult;
}

/** Why it would not, in words the operator can act on. */
async function reason(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  switch (body.error) {
    case "expired":
      return t("images.notSignedIn");
    case "forbidden":
      return t("general.unusedForbidden");
    case "not-ready":
      return t("general.unusedNotReady");
    case "nothing-in-use":
    case "mismatch":
      return t("general.unusedMismatch");
    default:
      return t("common.somethingWentWrong");
  }
}
