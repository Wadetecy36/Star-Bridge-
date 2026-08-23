import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRoomSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  const store = await cookies(); const session = await verifyRoomSession(store.get('constellation_session')?.value);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await supabaseAdmin.from('users').select('room_id').eq('id', session.userId).maybeSingle();
  if (!me || me.room_id !== session.roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: rounds, error } = await supabaseAdmin.from('constellation_rounds').select('id,difficulty,target_count,grid_size,completed_at,started_at').eq('room_id', me.room_id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rounds: rounds || [] });
}
