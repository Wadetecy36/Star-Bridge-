import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'development-only-secret');

export type RoomSession = { userId: string; roomId: string; sessionId: string };

export async function signRoomSession(payload: RoomSession) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(secret);
}

export async function verifyRoomSession(token?: string): Promise<RoomSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.userId !== 'string' || typeof payload.roomId !== 'string' || typeof payload.sessionId !== 'string') return null;
    return { userId: payload.userId, roomId: payload.roomId, sessionId: payload.sessionId };
  } catch {
    return null;
  }
}

function detectHttps(request?: Request | { headers?: { get: (name: string) => string | null }; url?: string }) {
  if (process.env.NODE_ENV === 'production') return true;
  if (!request) return true;
  const proto = request.headers?.get?.('x-forwarded-proto');
  if (proto && proto.includes('https')) return true;
  const host = request.headers?.get?.('host');
  if (host && (host.includes('.run.app') || host.includes('.googleusercontent.com'))) return true;
  if (request.url && request.url.startsWith('https://')) return true;
  return false;
}

export function getCookieOptions(request?: Request | { headers?: { get: (name: string) => string | null }; url?: string }) {
  const isHttps = detectHttps(request);

  if (isHttps) {
    return {
      httpOnly: true,
      sameSite: 'none' as const,
      secure: true,
      partitioned: true,
      maxAge: 60 * 60 * 24 * 90,
      path: '/',
    };
  }

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: false,
    maxAge: 60 * 60 * 24 * 90,
    path: '/',
  };
}

export function getDeleteCookieOptions(request?: Request | { headers?: { get: (name: string) => string | null }; url?: string }) {
  const isHttps = detectHttps(request);

  if (isHttps) {
    return {
      httpOnly: true,
      sameSite: 'none' as const,
      secure: true,
      partitioned: true,
      maxAge: 0,
      path: '/',
    };
  }

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: false,
    maxAge: 0,
    path: '/',
  };
}

export async function getSessionFromRequest(request?: any): Promise<RoomSession | null> {
  // 1. Check Authorization header: Bearer <token>
  try {
    const authHeader = request?.headers?.get?.('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      const session = await verifyRoomSession(token);
      if (session) return session;
    }
  } catch {}

  // 2. Check x-session-token header
  try {
    const xToken = request?.headers?.get?.('x-session-token');
    if (xToken) {
      const session = await verifyRoomSession(xToken);
      if (session) return session;
    }
  } catch {}

  // 3. Check URL query param ?token= or ?session=
  try {
    if (request && typeof request.url === 'string') {
      const parsedUrl = new URL(request.url);
      const queryToken = parsedUrl.searchParams.get('token') || parsedUrl.searchParams.get('session');
      if (queryToken) {
        const session = await verifyRoomSession(queryToken);
        if (session) return session;
      }
    }
  } catch {}

  // 4. Check cookies from NextRequest
  try {
    const cookieVal = request?.cookies?.get?.('constellation_session')?.value;
    if (cookieVal) {
      const session = await verifyRoomSession(cookieVal);
      if (session) return session;
    }
  } catch {}

  // 5. Fallback to cookies() store from next/headers
  try {
    const store = await cookies();
    const cookieVal = store.get('constellation_session')?.value;
    if (cookieVal) {
      const session = await verifyRoomSession(cookieVal);
      if (session) return session;
    }
  } catch {}

  return null;
}
