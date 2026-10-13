/**
 * Authentication Configuration
 * 
 * This module provides authentication utilities for the application
 */

import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { getAuthenticatedUserById } from '@/lib/auth-credentials';
import { staffCanAccessApi } from '@/lib/admin-access';

export interface AuthSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user' | 'superadmin' | 'vendor';
    emailVerified?: boolean;
    dashboardAccess?: boolean;
    allowedPages?: string[];
    phone?: string | null;
    address?: string | null;
    avatar?: string | null;
  };
}

/**
 * Read the access token from `Authorization: Bearer`, used by the mobile apps.
 *
 * Browsers never attach this header automatically, so supporting it alongside
 * the cookie does not widen CSRF exposure.
 */
async function getBearerToken(): Promise<string | undefined> {
  try {
    const headerStore = await headers();
    const authorization = headerStore.get('authorization');
    if (!authorization) return undefined;
    const [scheme, ...rest] = authorization.split(' ');
    if (scheme.toLowerCase() !== 'bearer') return undefined;
    return rest.join(' ').trim() || undefined;
  } catch {
    // headers() throws outside a request scope (e.g. static generation).
    return undefined;
  }
}

/**
 * Get the current session from either the signed httpOnly `session` cookie
 * (web) or an `Authorization: Bearer` access token (mobile). Both carry the
 * same HMAC-signed payload and are verified identically, so every route that
 * already calls this gains native-client support for free.
 *
 * A missing/invalid/expired token yields `null` (fail closed). This is the
 * single source of truth for authorization.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    let token = await getBearerToken();
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE)?.value;
    }
    const payload = await verifySessionToken(token);
    if (!payload) return null;
    const user = await getAuthenticatedUserById(payload.id);
    if (!user || user.sessionVersion !== (payload.sessionVersion ?? 0)) return null;
    if (!['user', 'vendor', 'admin', 'superadmin'].includes(user.role)) return null;
    return { user: { ...user, role: user.role as AuthSession['user']['role'] } };
  } catch (error) {
    console.error('[Auth] Session verification error:', error);
    return null;
  }
}

/**
 * Get the authenticated user id from the verified session, or null.
 * Use this on user-data API routes instead of trusting a client-supplied id.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id || null;
}

type GuardOk<T> = { ok: true } & T;
type GuardFail = { ok: false; response: NextResponse };

/**
 * Route guard: require any authenticated user. Returns the session user on
 * success, or a ready-to-return 401 response on failure.
 *
 * @example
 *   const guard = await requireUser();
 *   if (!guard.ok) return guard.response;
 *   const userId = guard.user.id;
 */
export async function requireUser(): Promise<GuardOk<{ user: AuthSession['user'] }> | GuardFail> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  return { ok: true, user: session.user };
}

/**
 * Route guard: require an admin (or superadmin). Returns the admin user id on
 * success, or a ready-to-return 401 response on failure.
 */
export async function requireAdmin(): Promise<GuardOk<{ userId: string }> | GuardFail> {
  const auth = await checkAdminAuthorization();
  if (!auth.authorized) {
    return {
      ok: false,
      response: NextResponse.json({ error: auth.error || 'Admin access required' }, { status: 401 }),
    };
  }

  return { ok: true, userId: auth.userId! };
}

export async function requireFullAdmin(): Promise<GuardOk<{ user: AuthSession['user'] }> | GuardFail> {
  const guard = await requireUser();
  if (!guard.ok) return guard;
  if (guard.user.role !== 'admin' && guard.user.role !== 'superadmin') {
    return { ok: false, response: NextResponse.json({ error: 'Full administrator access required' }, { status: 403 }) };
  }
  return guard;
}

/**
 * Route guard: require a vendor (admins also allowed). Returns the session user
 * on success, or a ready-to-return 401/403 response on failure.
 */
export async function requireVendor(): Promise<GuardOk<{ user: AuthSession['user'] }> | GuardFail> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  const role = session.user.role;
  if (role !== 'vendor' && role !== 'admin' && role !== 'superadmin') {
    return { ok: false, response: NextResponse.json({ error: 'Vendor access required' }, { status: 403 }) };
  }
  return { ok: true, user: session.user };
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  return session?.user?.role === 'admin' || session?.user?.role === 'superadmin';
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<AuthSession['user'] | null> {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Placeholder for NextAuth authOptions - used when NextAuth is configured
 * This is a stub to prevent import errors
 */
export const authOptions = {
  // This would contain NextAuth configuration when NextAuth is fully set up
  providers: [],
  callbacks: {},
  pages: {},
};

/**
 * Helper to check admin authorization for API routes.
 *
 * Authenticates via the signed session cookie (who is this user), then
 * authorizes by looking up the LIVE database record (what can they do).
 * This avoids stale session-token data (e.g. dashboardAccess granted after
 * login) causing false rejections.
 */
export async function checkAdminAuthorization(): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session?.user) {
      return { authorized: false, error: 'Authentication required' };
    }
    const requestHeaders = await headers();
    const path = requestHeaders.get('x-sara-request-path') || '';
    if (staffCanAccessApi(session.user, path)) {
      return { authorized: true, userId: session.user.id };
    }
    return { authorized: false, error: 'Admin access required' };
  } catch (error) {
    console.error('[Auth] Authorization check failed', error);
    return { authorized: false, error: 'Authorization check failed' };
  }
}
