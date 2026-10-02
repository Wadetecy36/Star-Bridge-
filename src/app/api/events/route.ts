import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRoomSession } from '@/lib/session';
import { getEventsForRoom } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const store = await cookies();
  const session = await verifyRoomSession(store.get('constellation_session')?.value);
  const roomId = request.nextUrl.searchParams.get('roomId') || session?.roomId;
  if (!roomId) return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });

  const since = Number(request.nextUrl.searchParams.get('since') || 0);
  const events = getEventsForRoom(roomId, since);
  return NextResponse.json({ events });
}
