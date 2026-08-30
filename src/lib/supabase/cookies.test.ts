import { describe, expect, it } from 'vitest';

import { REMEMBER_MAX_AGE, withRememberMe } from './cookies';

/**
 * These are about one question: what happens to a cookie's lifetime.
 *
 * Worth testing rather than eyeballing, because every failure mode here is
 * silent. A session that outlives the browser looks identical to one that does
 * not until somebody closes the window, and a deletion that does not delete
 * looks like nothing at all until a token gets long enough to need two chunks.
 */
describe('withRememberMe', () => {
  describe('when the box is ticked', () => {
    it('gives a cookie a lifetime so it survives the browser closing', () => {
      expect(withRememberMe({}, true)).toEqual({ maxAge: REMEMBER_MAX_AGE });
    });

    it('does not override a lifetime the library asked for', () => {
      expect(withRememberMe({ maxAge: 3600 }, true)).toEqual({ maxAge: 3600 });
    });

    it('keeps everything else untouched', () => {
      expect(withRememberMe({ path: '/', sameSite: 'lax' }, true)).toMatchObject({
        path: '/',
        sameSite: 'lax',
      });
    });
  });

  describe('when the box is cleared', () => {
    it('strips the lifetime, making it a session cookie', () => {
      // Not "sets a short maxAge": there is no value of maxAge that means
      // "until the window closes". Only the absence of one does.
      const result = withRememberMe({ maxAge: REMEMBER_MAX_AGE, path: '/' }, false);
      expect(result).not.toHaveProperty('maxAge');
      expect(result).toEqual({ path: '/' });
    });

    it('strips an absolute expiry too', () => {
      const result = withRememberMe({ expires: new Date('2030-01-01'), path: '/' }, false);
      expect(result).not.toHaveProperty('expires');
    });
  });

  /**
   * The bug this pair exists to prevent.
   *
   * `@supabase/ssr` deletes a cookie by writing `value: ""` with `maxAge: 0`.
   * Stripping that zero turns a deletion into an empty cookie that lives until
   * the browser closes — and for a *chunk* that is not cosmetic: the next read
   * reassembles chunk `.0` plus an empty `.1` into a corrupted token, which
   * presents as being signed out at random with nothing in the logs.
   */
  describe('a deletion is never reinterpreted', () => {
    it('keeps maxAge: 0 when the box is cleared', () => {
      expect(withRememberMe({ maxAge: 0, path: '/' }, false, '')).toEqual({
        maxAge: 0,
        path: '/',
      });
    });

    it('keeps maxAge: 0 when the box is ticked', () => {
      // The other direction matters too: `options.maxAge ?? REMEMBER_MAX_AGE`
      // happens to leave a 0 alone, but only because 0 is not nullish. Pinning
      // it here means a future rewrite to `||` fails a test instead of giving
      // every sign-out a thirty-day cookie.
      expect(withRememberMe({ maxAge: 0 }, true, '')).toEqual({ maxAge: 0 });
    });

    it('recognises a removal by its empty value alone', () => {
      expect(withRememberMe({ path: '/' }, false, '')).toEqual({ path: '/' });
    });

    it('does not mistake an omitted value for a removal', () => {
      // The default parameter is a sentinel, not `''`. If it were `''`, every
      // caller that did not pass a value would be treated as deleting, and
      // remember-me would silently stop working.
      expect(withRememberMe({}, true)).toEqual({ maxAge: REMEMBER_MAX_AGE });
    });
  });
});
