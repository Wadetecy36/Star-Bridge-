import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me } = await supabaseAdmin
    .from('users')
    .select('id,room_id,username,is_online,last_seen_at')
    .eq('id', session.userId)
    .maybeSingle();

  if (!me || me.room_id !== session.roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Update caller presence
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('users')
    .update({ is_online: true, last_seen_at: now })
    .eq('id', me.id);

  const [{ data: people }, { data: activeRound }] = await Promise.all([
    supabaseAdmin
      .from('users')
      .select('id,username,is_online,last_seen_at')
      .eq('room_id', me.room_id)
      .order('created_at'),
    supabaseAdmin
      .from('constellation_rounds')
      .select('*')
      .eq('room_id', me.room_id)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  const activeCutoff = Date.now() - 15000;
  const updatedPeople = (people || []).map((person: any) => {
    if (person.id === me.id) {
      return { ...person, is_online: true, last_seen_at: now };
    }
    const lastSeen = person.last_seen_at ? new Date(person.last_seen_at).getTime() : 0;
    return { ...person, is_online: lastSeen > activeCutoff };
  });

  const { data: stars } = activeRound
    ? await supabaseAdmin.from('constellation_stars').select('*').eq('round_id', activeRound.id).order('position')
    : { data: [] };

  return NextResponse.json({
    me: { ...me, is_online: true, last_seen_at: now },
    people: updatedPeople,
    activeRound,
    stars: stars || [],
  });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me } = await supabaseAdmin
    .from('users')
    .select('id,room_id')
    .eq('id', session.userId)
    .maybeSingle();

  if (!me || me.room_id !== session.roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabaseAdmin
    .from('users')
    .update({ is_online: true, last_seen_at: new Date().toISOString() })
    .eq('id', me.id);

  return NextResponse.json({ ok: true });
}
