import { payloadOf } from "./jwt";

/**
 * Whether a session was opened by a recovery link, and recently.
 *
 * `/auth/update-password` asks for nothing but the session, because following
 * the emailed link is the proof. That only holds if the session really came
 * from the link. An ordinary signed-in session (an unattended laptop, or an
 * XSS on this origin) has to go through `/auth/account` and type the current
 * password.
 *
 * ## Where the proof comes from
 *
 * Supabase records how a session was authenticated in the access token's
 * `amr` claim. `verifyOtp({ type: "recovery" })` in `/auth/confirm` gives an
 * entry with `method: "recovery"` and the second it happened, and refreshing
 * keeps it. A password sign-in never produces one.
 *
 * The token read here is the one `refreshSession` has just returned from
 * Supabase, not the cookie, so it is not checked a second time. Nothing in the
 * browser can put a claim into it.
 *
 * ## Why there is a window
 *
 * The entry stays on the session for as long as the session lasts. Without a
 * limit, a session opened from a reset link last week would still count as
 * proof today, which is the unattended-laptop case again. The link is followed
 * and the form filled in within minutes, so the window is fifteen.
 */
export const RECOVERY_WINDOW_SECONDS = 15 * 60;

/** When the session was recovered, as a Unix second, or `null` if it was not. */
export function recoveredAt(accessToken: string): number | null {
  const amr = payloadOf(accessToken)?.amr;
  if (!Array.isArray(amr)) return null;

  let latest: number | null = null;
  for (const entry of amr) {
    if (
      entry &&
      typeof entry === "object" &&
      (entry as { method?: unknown }).method === "recovery"
    ) {
      const at = (entry as { timestamp?: unknown }).timestamp;
      if (typeof at === "number" && (latest === null || at > latest)) {
        latest = at;
      }
    }
  }
  return latest;
}

export function isFreshRecovery(
  accessToken: string,
  now = Date.now(),
): boolean {
  const at = recoveredAt(accessToken);
  if (at === null) return false;
  const age = Math.floor(now / 1000) - at;
  // A timestamp from the future is a clock disagreement, not a fresh recovery
  // to be trusted indefinitely. A minute of skew is allowed.
  return age >= -60 && age <= RECOVERY_WINDOW_SECONDS;
}
