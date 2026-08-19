import { SignJWT, jwtVerify } from 'jose';

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
