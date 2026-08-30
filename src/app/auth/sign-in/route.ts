import { NextResponse, type NextRequest } from 'next/server';

import { REMEMBER_COOKIE, REMEMBER_MAX_AGE } from '@/lib/auth/cookies';
import { anonymousClient, toPair, writeSession } from '@/lib/auth/session';

/**
 * Signing in, on the server, so the refresh token never reaches JavaScript.
 *
 * The password arrives in a POST body over TLS and goes no further than this
 * handler. What comes back to the browser is an access token with an hour on
 * it — enough for Realtime and for queries, and not enough to be worth stealing
 * for later.
 *
 * ## The error the browser is told
 *
 * The distinctions are made here rather than in the form, because the form
 * would have to be given something to distinguish on, and every extra detail is
 * a detail this endpoint discloses. Rate limiting is passed through — it says
 * nothing about whether an account exists. Everything else collapses into
 * `invalid`, including "email not confirmed", which would otherwise confirm the
 * address belongs to somebody.
 */
export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown; remember?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const remember = body.remember === true;

  if (!email || !password) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }

  const supabase = anonymousClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    const rateLimited = error?.status === 429 || error?.code === 'over_request_rate_limit';
    return NextResponse.json(
      { error: rateLimited ? 'rate_limited' : 'invalid' },
      { status: rateLimited ? 429 : 401 },
    );
  }

  const pair = toPair(data.session);
  const isSecure = request.nextUrl.protocol === 'https:';

  const response = NextResponse.json({
    accessToken: pair.accessToken,
    expiresAt: pair.expiresAt,
    email: data.user?.email ?? null,
  });

  // The preference is written here rather than by the form, so that the cookie
  // attributes and the choice they came from are decided in one place.
  response.cookies.set(REMEMBER_COOKIE, remember ? '1' : '0', {
    // Not HttpOnly and not a credential: it records how this machine wants to
    // be treated, and knowing it grants nothing.
    httpOnly: false,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: REMEMBER_MAX_AGE,
  });

  writeSession(response.cookies, pair, { remember, isSecure });

  return response;
}
