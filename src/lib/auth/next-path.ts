/**
 * Where to go after signing in, from the login page's `?next=`.
 *
 * The login page is reachable signed out, so `?next=` is whatever a stranger's
 * link says it is, and handing it to the router unchecked is an open redirect:
 * a real sign-in on our page, then a hop to a copy of it asking for the
 * password again.
 *
 * "Starts with one slash" is not the check, though it reads like one. A URL
 * parser treats `\` as `/` and drops tabs and newlines before it looks, so
 * `/\evil.com`, `/\/evil.com` and `/<tab>/evil.com` all come out as
 * `//evil.com` — another host. The answer here is decided by the parser itself:
 * resolve against our own origin and keep it only if it is still ours.
 * Backslashes and control characters are refused before that, since nothing
 * the dashboard links to contains one and they are only ever there to make the
 * string mean something other than what it looks like.
 */
export function safeNextPath(next: string | null, origin: string): string {
  if (!next || !next.startsWith("/")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return "/";

  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return "/";
  }
  if (url.origin !== new URL(origin).origin) return "/";
  return url.pathname + url.search + url.hash;
}
