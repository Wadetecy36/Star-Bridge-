import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRoomSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

async function current() { const store = await cookies(); return verifyRoomSession(store.get('constellation_session')?.value); }

export async function GET() {
  const session = await current();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await supabaseAdmin.from('users').select('id,room_id').eq('id', session.userId).maybeSingle();
  if (!me || me.room_id !== session.roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: people } = await supabaseAdmin.from('users').select('id').eq('room_id', me.room_id);
  const ids = (people || []).map(person => person.id);
  const { data: plants, error } = ids.length ? await supabaseAdmin.from('garden_plants').select('*').in('user_id', ids).order('planted_at') : { data: [], error: null };
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ plants: plants || [] });
}

export async function POST(request: NextRequest) {
  const session = await current();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await supabaseAdmin.from('users').select('id,room_id').eq('id', session.userId).maybeSingle();
  if (!me || me.room_id !== session.roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const x = Number(body?.x); const y = Number(body?.y); const seed = String(body?.seed_emoji || '').trim().slice(0, 12);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100 || !seed) return NextResponse.json({ error: 'Choose a seed and plant inside the garden.' }, { status: 400 });
  const { data: plant, error } = await supabaseAdmin.from('garden_plants').insert({ user_id: me.id, seed_emoji: seed, x, y }).select('*').single();
  if (error || !plant) return NextResponse.json({ error: error?.message || 'Could not plant this seed.' }, { status: 400 });
  return NextResponse.json({ plant });
}
