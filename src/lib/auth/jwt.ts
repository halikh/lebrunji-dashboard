/**
 * The claims inside a JWT, read without verifying it.
 *
 * Every caller says why that is enough for what it decides. In short: either
 * the token came straight back from Supabase over TLS, or the worst a forged
 * claim can do is mistime a refresh that Supabase then rejects anyway.
 */
export function payloadOf(jwt: string): Record<string, unknown> | null {
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const claims: unknown = JSON.parse(json);
    return claims && typeof claims === "object"
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
