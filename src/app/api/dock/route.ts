import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRoomSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-server';

async function current() { const store = await cookies(); return verifyRoomSession(store.get('constellation_session')?.value); }
async function roomUser() { const session = await current(); if (!session) return null; const { data: me } = await supabaseAdmin.from('users').select('id,room_id').eq('id', session.userId).maybeSingle(); return me?.room_id === session.roomId ? me : null; }
async function roomUserIds(roomId: string) { const { data } = await supabaseAdmin.from('users').select('id').eq('room_id', roomId); return (data || []).map(user => user.id); }

export async function GET() {
  const me = await roomUser(); if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ids = await roomUserIds(me.room_id);
  const [{ data: messages, error: messageError }, { data: emotes, error: emoteError }] = await Promise.all([
    ids.length ? supabaseAdmin.from('messages').select('*').in('user_id', ids).order('sent_at').limit(100) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabaseAdmin.from('emotes').select('*').in('user_id', ids).order('sent_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
  ]);
  if (messageError || emoteError) return NextResponse.json({ error: messageError?.message || emoteError?.message || 'Could not load the dock.' }, { status: 400 });
  return NextResponse.json({ messages: messages || [], emotes: emotes || [] });
}

export async function POST(request: NextRequest) {
  const me = await roomUser(); if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.action === 'message') {
    const content = String(body.content || '').trim().slice(0, 500);
    if (!content) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });
    const { data: message, error } = await supabaseAdmin.from('messages').insert({ user_id: me.id, content }).select('*').single();
    if (error || !message) return NextResponse.json({ error: error?.message || 'Could not send that message.' }, { status: 400 });
    return NextResponse.json({ message });
  }
  if (body?.action === 'emote') {
    const emote = String(body.emote || '').trim().slice(0, 12);
    if (!emote) return NextResponse.json({ error: 'Choose an emote.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('emotes').insert({ user_id: me.id, emote }).select('*').single();
    if (error || !data) return NextResponse.json({ error: error?.message || 'Could not send that emote.' }, { status: 400 });
    return NextResponse.json({ emote: data });
  }
  return NextResponse.json({ error: 'Unknown Dock action.' }, { status: 400 });
}
