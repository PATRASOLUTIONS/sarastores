/**
 * Authentication Configuration
 * 
 * This module provides authentication utilities for the application
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

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
 * Get the current session by verifying the signed, httpOnly `session` cookie.
 *
 * The cookie is HMAC-signed with a server-only secret, so its contents cannot
 * be forged or modified by the client. A missing/invalid/expired token yields
 * `null` (fail closed). This is the single source of truth for authorization.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    const payload = await verifySessionToken(token);
    if (!payload) return null;

    return {
      user: {
        id: payload.id,
        // Older tokens predate `name`; fall back to the email local-part.
        name: payload.name || payload.email?.split('@')[0] || 'User',
        email: payload.email,
        role: payload.role || 'user',
        dashboardAccess: payload.dashboardAccess,
        allowedPages: payload.allowedPages,
      },
    } as AuthSession;
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

    console.log(
      `[Auth] checkAdminAuthorization: session=${session ? 'yes' : 'null'} ` +
        `role=${session?.user?.role} dashboardAccess=${session?.user?.dashboardAccess} ` +
        `id=${session?.user?.id}`
    );

    if (!session?.user) {
      return { authorized: false, error: 'Authentication required' };
    }

    const userId = session.user.id || session.user.email;

    // Fast path: session token already has admin role
    const sessionIsAdmin = session.user.role && ['admin', 'superadmin'].includes(session.user.role);
    if (sessionIsAdmin) {
      console.log(`[Auth] checkAdminAuthorization: fast path authorized (role=${session.user.role})`);
      return { authorized: true, userId };
    }

    // Authorize against the live DB so stale session tokens don't block access.
    try {
      const { connectToDatabase } = await import('@/lib/mongodb');
      const { ObjectId } = await import('mongodb');
      const { db } = await connectToDatabase();
      const id = session.user.id;

      let userDoc: any = null;

      // Try common ID patterns used across this codebase
      if (ObjectId.isValid(id)) {
        userDoc = await db.collection('users').findOne({ _id: new ObjectId(id) });
      }
      if (!userDoc) {
        userDoc = await db.collection('users').findOne({ _id: id } as any);
      }
      if (!userDoc) {
        userDoc = await db.collection('users').findOne({ id } as any);
      }

      if (!userDoc) {
        console.warn(`[Auth] Admin check: user ${id} not found in DB`);
        return { authorized: false, error: 'Admin access required' };
      }

      const dbRole = userDoc.role as string | undefined;
      const dbDash = !!userDoc.dashboardAccess;
      if (dbRole === 'admin' || dbRole === 'superadmin' || dbDash) {
        return { authorized: true, userId };
      }

      console.warn(
        `[Auth] Admin check denied for ${id}: db.role=${dbRole} db.dashboardAccess=${dbDash}`,
      );
    } catch (dbErr) {
      console.error('[Auth] DB admin-check failed, falling back to session', dbErr);
      // DB is down — fall back to session token so the app is not completely blocked
      if (session.user.dashboardAccess) {
        return { authorized: true, userId };
      }
    }

    return { authorized: false, error: 'Admin access required' };
  } catch (error) {
    return { authorized: false, error: 'Authorization check failed' };
  }
}
