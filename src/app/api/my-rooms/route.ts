import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRoomSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

const HISTORY_COOKIE = 'constellation_rooms';

type SavedRoom = { roomId: string; inviteCode: string; username: string; savedAt: number };

export async function GET() {
  const store = await cookies();
  try { return NextResponse.json({ rooms: JSON.parse(store.get(HISTORY_COOKIE)?.value || '[]') }); } catch { return NextResponse.json({ rooms: [] }); }
}

export async function POST(request: NextRequest) {
  const session = await verifyRoomSession(request.cookies.get('constellation_session')?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: user } = await supabaseAdmin.from('users').select('id,room_id,username').eq('id', session.userId).maybeSingle();
  if (!user || user.room_id !== session.roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: room } = await supabaseAdmin.from('rooms').select('invite_code').eq('id', user.room_id).maybeSingle();
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  let previous: SavedRoom[] = [];
  try { previous = JSON.parse(request.cookies.get(HISTORY_COOKIE)?.value || '[]'); } catch {}
  const next = [{ roomId: user.room_id, inviteCode: room.invite_code, username: user.username, savedAt: Date.now() }, ...previous.filter(item => item.roomId !== user.room_id)].slice(0, 8);
  const response = NextResponse.json({ rooms: next });
  response.cookies.set(HISTORY_COOKIE, JSON.stringify(next), { httpOnly: false, sameSite: 'lax', secure: false, maxAge: 60 * 60 * 24 * 90, path: '/' });
  return response;
}
