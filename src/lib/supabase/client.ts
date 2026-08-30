'use client';

import { createBrowserClient } from '@supabase/ssr';

import { readEnv } from '../env';
import { REMEMBER_COOKIE, withRememberMe, type CookieOptions } from './cookies';

/**
 * The browser client. Anon key, and a real signed-in user behind it.
 *
 * This is the one that does nearly all the work — reads, writes, Realtime
 * subscriptions and Storage uploads all go straight from the browser to
 * Supabase. There is no API route in front of them, and that is not a shortcut:
 * every permission is an RLS policy or an `is_admin()`-gated RPC, so a server
 * hop would add a second place to get authorisation right without adding any
 * authorisation. It would also break Realtime, which the order queue is built
 * on.
 *
 * ## One instance
 *
 * `createBrowserClient` is memoised below. Two clients would mean two Realtime
 * connections and two copies of the auth state trying to refresh the same
 * token, which surfaces as an intermittent sign-out that is very hard to
 * attribute.
 */

// Typed off `create` rather than off `createBrowserClient` directly: the latter
// is generic, so `ReturnType` resolves its parameters to their defaults and the
// client comes back weakly typed — which surfaces later as `implicitly has an
// any type` on every callback the client hands you.
let client: ReturnType<typeof create> | null = null;

export function getClient() {
  client ??= create();
  return client;
}

function create() {
  const { supabaseUrl, supabaseAnonKey } = readEnv();

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return readCookies();
      },
      // Supabase writes the auth cookies itself, from inside the sign-in call,
      // so this is the only place the remember-me preference can reach them.
      // It reads the preference back out of its own cookie on every write
      // rather than being told once at construction: the client is created
      // once and the preference changes at each sign-in.
      setAll(cookies) {
        const remember = readCookies().some(
          (cookie) => cookie.name === REMEMBER_COOKIE && cookie.value === '1',
        );
        for (const { name, value, options } of cookies) {
          writeCookie(name, value, withRememberMe((options ?? {}) as CookieOptions, remember, value));
        }
      },
    },
  });
}

function readCookies(): { name: string; value: string }[] {
  if (typeof document === 'undefined') return [];
  return document.cookie
    .split('; ')
    .filter(Boolean)
    .map((pair) => {
      const index = pair.indexOf('=');
      return {
        name: pair.slice(0, index),
        value: decodeURIComponent(pair.slice(index + 1)),
      };
    });
}

function writeCookie(name: string, value: string, options: CookieOptions) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`];

  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires instanceof Date) parts.push(`Expires=${options.expires.toUTCString()}`);
  parts.push(`SameSite=${(options.sameSite as string) ?? 'Lax'}`);
  // Localhost is served over http in development, and a Secure cookie would
  // simply not be stored there — which looks exactly like a broken login.
  if (window.location.protocol === 'https:') parts.push('Secure');

  document.cookie = parts.join('; ');
}
