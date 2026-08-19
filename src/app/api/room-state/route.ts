import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRoomSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

async function current() { const store = await cookies(); return verifyRoomSession(store.get('constellation_session')?.value); }

export async function GET() {
  const session = await current();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await supabaseAdmin.from('users').select('id,room_id,username,is_online,last_seen_at').eq('id', session.userId).maybeSingle();
  if (!me || me.room_id !== session.roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [{ data: people }, { data: activeRound }] = await Promise.all([
    supabaseAdmin.from('users').select('id,username,is_online,last_seen_at').eq('room_id', me.room_id).order('created_at'),
    supabaseAdmin.from('constellation_rounds').select('*').eq('room_id', me.room_id).eq('status', 'active').maybeSingle(),
  ]);
  const { data: stars } = activeRound ? await supabaseAdmin.from('constellation_stars').select('*').eq('round_id', activeRound.id).order('position') : { data: [] };
  return NextResponse.json({ me, people: people || [], activeRound, stars: stars || [] });
}

export async function POST(request: NextRequest) {
  const session = await current();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await supabaseAdmin.from('users').select('id,room_id').eq('id', session.userId).maybeSingle();
  if (!me || me.room_id !== session.roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await supabaseAdmin.from('users').update({ is_online: true, last_seen_at: new Date().toISOString() }).eq('id', me.id);
  return NextResponse.json({ ok: true });
}
