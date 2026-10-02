import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

const MAX_BOTTLES = 100;

async function roomUser(request?: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return null;
  const { data: user } = await supabaseAdmin.from('users').select('id,room_id,username').eq('id', session.userId).maybeSingle();
  if (!user || user.room_id !== session.roomId) return null;
  return user;
}

export async function GET(request: NextRequest) {
  const me = await roomUser(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('memory_bottles').select('id,content,created_at,user_id').eq('room_id', me.room_id).order('created_at', { ascending: false }).limit(MAX_BOTTLES);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const userIds = [...new Set((data || []).map((item: any) => item.user_id))];
  const { data: people } = userIds.length ? await supabaseAdmin.from('users').select('id,username').in('id', userIds) : { data: [] };
  const names = new Map((people || []).map((person: any) => [person.id, person.username]));
  return NextResponse.json({ bottles: (data || []).map((item: any) => ({ ...item, username: names.get(item.user_id) || 'A little star' })) });
}

export async function POST(request: NextRequest) {
  const me = await roomUser(request);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const content = String(body?.content || '').trim().slice(0, 300);
  if (!content) return NextResponse.json({ error: 'Write a little note first.' }, { status: 400 });
  const { data: bottle, error } = await supabaseAdmin.from('memory_bottles').insert({ room_id: me.room_id, user_id: me.id, content }).select('id,content,created_at,user_id').single();
  if (error || !bottle) return NextResponse.json({ error: error?.message || 'Could not drop this bottle.' }, { status: 400 });
  const { data: all } = await supabaseAdmin.from('memory_bottles').select('id').eq('room_id', me.room_id).order('created_at', { ascending: false });
  const overflow = (all || []).slice(MAX_BOTTLES).map((item: any) => item.id);
  if (overflow.length) await supabaseAdmin.from('memory_bottles').delete().in('id', overflow);
  return NextResponse.json({ bottle: { ...bottle, username: me.username } });
}
