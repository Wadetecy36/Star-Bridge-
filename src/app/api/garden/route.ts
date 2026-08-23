import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRoomSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

async function current() { const store = await cookies(); return verifyRoomSession(store.get('constellation_session')?.value); }
async function roomUser() { const session = await current(); if (!session) return null; const { data: me } = await supabaseAdmin.from('users').select('id,room_id').eq('id', session.userId).maybeSingle(); return me?.room_id === session.roomId ? me : null; }
async function roomUserIds(roomId: string) { const { data } = await supabaseAdmin.from('users').select('id').eq('room_id', roomId); return (data || []).map(person => person.id); }

export async function GET() {
  const me = await roomUser(); if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ids = await roomUserIds(me.room_id);
  const { data: plants, error } = ids.length ? await supabaseAdmin.from('garden_plants').select('*').in('user_id', ids).order('planted_at') : { data: [], error: null };
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ plants: plants || [] });
}

export async function POST(request: NextRequest) {
  const me = await roomUser(); if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const action = body?.action || 'plant';
  const ids = await roomUserIds(me.room_id);
  if (action === 'undo') {
    const { data: plants, error } = ids.length ? await supabaseAdmin.from('garden_plants').select('*').in('user_id', ids).order('planted_at', { ascending: false }).limit(1) : { data: [], error: null };
    const plant = plants?.[0];
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!plant) return NextResponse.json({ error: 'There is nothing to undo yet.' }, { status: 400 });
    const { error: deleteError } = await supabaseAdmin.from('garden_plants').delete().eq('id', plant.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
    return NextResponse.json({ removedId: plant.id });
  }
  if (action === 'clear') {
    if (ids.length) { const { error } = await supabaseAdmin.from('garden_plants').delete().in('user_id', ids); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); }
    return NextResponse.json({ cleared: true });
  }
  const x = Number(body?.x); const y = Number(body?.y); const seed = String(body?.seed_emoji || '').trim().slice(0, 12);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100 || !seed) return NextResponse.json({ error: 'Choose a seed and plant inside the garden.' }, { status: 400 });
  const { data: plant, error } = await supabaseAdmin.from('garden_plants').insert({ user_id: me.id, seed_emoji: seed, x, y }).select('*').single();
  if (error || !plant) return NextResponse.json({ error: error?.message || 'Could not plant this seed.' }, { status: 400 });
  return NextResponse.json({ plant });
}
