import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, getDeleteCookieOptions } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ active: false, roomId: null, userId: null });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id,room_id')
    .eq('id', session.userId)
    .maybeSingle();

  if (!user || user.room_id !== session.roomId) {
    const res = NextResponse.json({ active: false, roomId: null, userId: null });
    res.cookies.set('constellation_session', '', getDeleteCookieOptions(request));
    return res;
  }

  return NextResponse.json({
    active: true,
    roomId: session.roomId,
    userId: session.userId,
  });
}
