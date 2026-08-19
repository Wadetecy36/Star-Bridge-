import { NextRequest, NextResponse } from 'next/server';
import { verifyRoomSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await verifyRoomSession(request.cookies.get('constellation_session')?.value);
  return NextResponse.json({ active: Boolean(session), roomId: session?.roomId || null, userId: session?.userId || null });
}
